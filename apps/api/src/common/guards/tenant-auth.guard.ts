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
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;
    const isBearerApiKey = Boolean(
      bearerToken &&
        (bearerToken.startsWith('ak_') ||
          bearerToken.startsWith('ecf_') ||
          bearerToken.startsWith('antk_'))
    );
    const token = isBearerApiKey ? undefined : bearerToken || cookieToken;

    if (token) {
      try {
        let decoded: any = null;
        try {
          decoded = this.jwtService.verify(token);
        } catch (verifyErr: any) {
          if (verifyErr?.name === 'TokenExpiredError') {
            const candidate = this.jwtService.verify(token, { ignoreExpiration: true });
            const issuedAt = Number(candidate?.iat || 0);
            const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt;
            if (issuedAt > 0 && ageSeconds <= 7 * 86400) {
              decoded = candidate;
            }
          }
        }

        if (decoded && (decoded.sub || decoded.userId)) {
          const userId = decoded.sub || decoded.userId;

          // REVISIÓN DE PERMISOS EN CADA PETICIÓN (Con caché TTL de 15s para alta concurrencia):
          const cacheKey = `auth_user:${userId}`;
          let liveUser = await this.cacheService.get<any>(cacheKey);
          if (!liveUser) {
            liveUser = await prisma.tenantUser.findUnique({
              where: { id: userId },
              include: { tenant: true },
            });
            if (liveUser) {
              await this.cacheService.set(cacheKey, liveUser, 15);
            }
          }

          if (!liveUser || !liveUser.isActive) {
            throw new UnauthorizedException('La cuenta de usuario está desactivada o ha sido eliminada.');
          }

          if (liveUser.lockedUntil && liveUser.lockedUntil > new Date()) {
            throw new UnauthorizedException('La cuenta se encuentra bloqueada temporalmente por intentos fallidos.');
          }

          if (!liveUser.tenant) {
            throw new UnauthorizedException('La cuenta de la empresa no fue encontrada.');
          }

          authContext = {
            userId: liveUser.id,
            email: liveUser.email,
            role: liveUser.role,
            tenantId: liveUser.tenantId,
            environment: (liveUser.tenant?.environment as 'SANDBOX' | 'PRODUCTION') || decoded.environment || 'SANDBOX',
            authType: 'JWT',
          };
        }
      } catch (err: any) {
        if (err instanceof UnauthorizedException) {
          throw err;
        }
        // Token inválido o expirado
      }
    }

    // Caso B: API Key en Authorization Bearer ak_live_... o X-API-Key (Integraciones B2B / ERP / POS)
    const rawApiKeyCandidate =
      (isBearerApiKey ? bearerToken : undefined) ||
      (apiKeyHeader ? String(apiKeyHeader).trim() : undefined);

    if (!authContext && rawApiKeyCandidate) {
      const rawKey = rawApiKeyCandidate;
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      // Intentar obtener de caché Redis (30s para reflejar revocaciones con rapidez)
      const cacheKey = `apikey:${keyHash.slice(0, 16)}`;
      const cachedTenant = await this.cacheService.get<{
        id?: string;
        tenantId: string;
        environment: 'SANDBOX' | 'PRODUCTION';
        revoked?: boolean;
      }>(cacheKey);

      if (cachedTenant && !cachedTenant.revoked) {
        authContext = {
          tenantId: cachedTenant.tenantId,
          environment: cachedTenant.environment,
          authType: 'API_KEY',
        };
        if (cachedTenant.id) {
          prisma.apiKey
            .update({ where: { id: cachedTenant.id }, data: { lastUsedAt: new Date() } })
            .catch(() => undefined);
        }
      } else {
        // Consultar en PostgreSQL
        const apiKeyRecord = await prisma.apiKey.findUnique({
          where: { keyHash },
          include: { tenant: true },
        });

        if (apiKeyRecord && apiKeyRecord.isActive && !apiKeyRecord.revoked && apiKeyRecord.tenant) {
          authContext = {
            tenantId: apiKeyRecord.tenantId,
            environment: (apiKeyRecord.tenant.environment || apiKeyRecord.environment) as 'SANDBOX' | 'PRODUCTION',
            authType: 'API_KEY',
          };
          prisma.apiKey
            .update({ where: { id: apiKeyRecord.id }, data: { lastUsedAt: new Date() } })
            .catch(() => undefined);
          await this.cacheService.set(
            cacheKey,
            {
              id: apiKeyRecord.id,
              tenantId: apiKeyRecord.tenantId,
              environment: authContext.environment,
              revoked: false,
            },
            30
          );
        }
      }
    }

    // Caso C: Rechazo estricto si no hay credenciales válidas
    if (!authContext) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Acceso no autorizado: Debe enviar un Bearer token válido o X-API-Key.');
      }

      // Solo en desarrollo local offline:
      const defaultTenant = await prisma.tenant.findFirst({
        select: { id: true, environment: true },
      });

      if (!defaultTenant) {
        throw new UnauthorizedException('No hay organizaciones disponibles.');
      }

      authContext = {
        tenantId: defaultTenant.id,
        environment: (defaultTenant.environment as 'SANDBOX' | 'PRODUCTION') || 'SANDBOX',
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
