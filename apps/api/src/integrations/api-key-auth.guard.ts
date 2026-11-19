import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as crypto from 'crypto';
import { prisma } from '@factura-ecf/database';
import { CacheService } from '../common/cache.service';

export const API_KEY_SCOPE_KEY = 'apiKeyScope';
export const RequireApiKeyScope = (scope: 'invoices:write' | 'invoices:read') =>
  SetMetadata(API_KEY_SCOPE_KEY, scope);

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  private readonly rateWindows = new Map<string, { count: number; resetAt: number }>();
  private readonly maxReqPerMinute = 60;

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const authHeader = String(req.headers['authorization'] || '');
    const altHeader = String(req.headers['x-api-key'] || '');

    let rawKey = '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      rawKey = authHeader.slice(7).trim();
    } else if (altHeader) {
      rawKey = altHeader.trim();
    }

    if (!rawKey) {
      throw new HttpException(
        {
          error: 'Falta encabezado Authorization: Bearer <api_key>.',
          campo: 'Authorization',
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const keyHash = crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex');
    const cacheKey = `pub_apikey:${keyHash.slice(0, 24)}`;

    let keyRecord: {
      id: string;
      tenantId: string;
      scopes: string[];
      isActive: boolean;
      revoked: boolean;
      environment: 'SANDBOX' | 'PRODUCTION';
    } | null = await this.cacheService.get(cacheKey);

    if (!keyRecord) {
      const dbRecord = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: { tenant: { select: { id: true, environment: true } } },
      });

      if (dbRecord && dbRecord.tenant) {
        keyRecord = {
          id: dbRecord.id,
          tenantId: dbRecord.tenantId,
          scopes:
            Array.isArray(dbRecord.scopes) && dbRecord.scopes.length > 0
              ? dbRecord.scopes
              : ['invoices:write', 'invoices:read'],
          isActive: dbRecord.isActive,
          revoked: Boolean(dbRecord.revoked),
          environment: (dbRecord.tenant.environment || dbRecord.environment || 'SANDBOX') as
            | 'SANDBOX'
            | 'PRODUCTION',
        };
        await this.cacheService.set(cacheKey, keyRecord, 30);
      }
    }

    if (!keyRecord || !keyRecord.isActive || keyRecord.revoked) {
      throw new HttpException(
        {
          error: 'API Key inválida o revocada.',
          campo: 'Authorization',
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    // Verificar scope requerido
    const requiredScope = this.reflector.getAllAndOverride<'invoices:write' | 'invoices:read'>(
      API_KEY_SCOPE_KEY,
      [context.getHandler(), context.getClass()]
    );
    if (requiredScope && !keyRecord.scopes.includes(requiredScope) && !keyRecord.scopes.includes('*')) {
      throw new HttpException(
        {
          error: `La API Key no posee el permiso requerido '${requiredScope}'.`,
          campo: 'Authorization',
        },
        HttpStatus.FORBIDDEN
      );
    }

    // Rate Limit básico por key: 60 req/min
    const now = Date.now();
    let windowRec = this.rateWindows.get(keyRecord.id);
    if (!windowRec || now > windowRec.resetAt) {
      windowRec = { count: 1, resetAt: now + 60_000 };
      this.rateWindows.set(keyRecord.id, windowRec);
    } else {
      windowRec.count += 1;
    }

    const remaining = Math.max(0, this.maxReqPerMinute - windowRec.count);
    res.setHeader('X-RateLimit-Limit', String(this.maxReqPerMinute));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(windowRec.resetAt / 1000)));

    if (windowRec.count > this.maxReqPerMinute) {
      throw new HttpException(
        {
          error: `Límite de peticiones excedido (${this.maxReqPerMinute} req/min por API Key). Intenta nuevamente en unos segundos.`,
          campo: 'Authorization',
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Actualizar ultimo_uso sin bloquear la respuesta
    prisma.apiKey
      .update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    req.tenantId = keyRecord.tenantId;
    req.apiKeyId = keyRecord.id;
    req.apiKeyScopes = keyRecord.scopes;
    req.environment = keyRecord.environment;
    req.isApiKeyRequest = true;

    return true;
  }
}
