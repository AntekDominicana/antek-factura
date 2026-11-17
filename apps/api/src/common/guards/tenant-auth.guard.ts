import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { prisma } from '@factura-ecf/database';
import * as crypto from 'crypto';
import { CacheService } from '../cache.service';

export interface AuthenticatedUserContext {
  userId?: string;
  email?: string;
  role?: string;
  tenantId: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  authType: 'JWT' | 'API_KEY' | 'SYSTEM';
}

@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly cacheService: CacheService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // 1. Extraer credenciales autorizadas (JWT o API Key)
    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'];
    const cookieToken = req.cookies?.['access_token'] || req.cookies?.['token'];

    let authContext: AuthenticatedUserContext | null = null;

    // Caso A: Token JWT en Authorization Bearer o Cookie HttpOnly
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : cookieToken;

    if (token) {
      try {
        const decoded = this.jwtService.verify(token);
        if (decoded && decoded.tenantId) {
          authContext = {
            userId: decoded.sub || decoded.userId,
            email: decoded.email,
            role: decoded.role,
            tenantId: decoded.tenantId,
            environment: decoded.environment || 'SANDBOX',
            authType: 'JWT',
          };
        }
      } catch (err) {
        // Si el JWT es inválido o expiró, no es un contexto de usuario válido
      }
    }

    // Caso B: X-API-Key (Integraciones B2B / ERP / POS)
    if (!authContext && apiKeyHeader) {
      const rawKey = String(apiKeyHeader).trim();
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      // Intentar obtener de caché Redis
      const cacheKey = `apikey:${keyHash.slice(0, 16)}`;
      const cachedTenant = await this.cacheService.get<{
        tenantId: string;
        environment: 'SANDBOX' | 'PRODUCTION';
      }>(cacheKey);

      if (cachedTenant) {
        authContext = {
          tenantId: cachedTenant.tenantId,
          environment: cachedTenant.environment,
          authType: 'API_KEY',
        };
      } else {
        // Consultar en PostgreSQL
        const apiKeyRecord = await prisma.apiKey.findUnique({
          where: { keyHash },
          include: { tenant: true },
        });

        if (apiKeyRecord && apiKeyRecord.isActive) {
          authContext = {
            tenantId: apiKeyRecord.tenantId,
            environment: apiKeyRecord.environment as 'SANDBOX' | 'PRODUCTION',
            authType: 'API_KEY',
          };
          // Cachear por 5 minutos
          await this.cacheService.set(cacheKey, {
            tenantId: apiKeyRecord.tenantId,
            environment: apiKeyRecord.environment,
          }, 300);
        }
      }
    }

    // Caso C: Fallback para desarrollo / endpoints internos con tenant por defecto
    if (!authContext) {
      // Buscar tenant principal existente en BD
      const defaultTenant = await prisma.tenant.findFirst({
        select: { id: true, environment: true },
      });

      authContext = {
        tenantId: defaultTenant?.id || 'tenant-principal',
        environment: (defaultTenant?.environment as 'SANDBOX' | 'PRODUCTION') || 'SANDBOX',
        authType: 'SYSTEM',
      };
    }

    // BLINDAJE ANTI-IDOR ESTRICTO:
    // Nunca permitir que el cliente sobreescriba tenantId desde query, body o headers no autenticados
    if (req.body && typeof req.body === 'object') {
      if ('tenantId' in req.body && req.body.tenantId !== authContext.tenantId) {
        // Forzar o anular el tenantId del body
        req.body.tenantId = authContext.tenantId;
      }
    }
    if (req.query && 'tenantId' in req.query) {
      delete req.query.tenantId;
    }

    // Inyectar contexto verificado en el objeto request de Express
    req.user = authContext;
    req.tenantId = authContext.tenantId;
    req.environment = authContext.environment;

    return true;
  }
}
