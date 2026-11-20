import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { prisma } from '@factura-ecf/database';
import { CacheService } from '../common/cache.service';
import { CryptoService } from '../common/crypto.service';

export const API_KEY_SCOPE_KEY = 'apiKeyScope';
export const RequireApiKeyScope = (scope: 'invoices:write' | 'invoices:read') =>
  SetMetadata(API_KEY_SCOPE_KEY, scope);

interface CachedApiKeyCandidate {
  id: string;
  tenantId: string;
  userId: string | null;
  keyHash: string;
  scopes: string[];
  isActive: boolean;
  revoked: boolean;
  environment: 'SANDBOX' | 'PRODUCTION';
}

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  private readonly rateWindows = new Map<string, { count: number; resetAt: number }>();
  private readonly maxReqPerMinute = 60;

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService,
    private readonly cryptoService: CryptoService
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
          error: 'Falta encabezado Authorization: Bearer <api_key> o X-API-Key.',
          campo: 'Authorization',
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    // Calcular HMAC-SHA256 con API_KEY_PEPPER (+ respaldo SHA-256 solo para claves legacy ak_*)
    const hmacHash = this.cryptoService.hashApiKey(rawKey);
    const legacyHash = rawKey.startsWith('sk_') ? null : this.cryptoService.hashSha256(rawKey);
    const keyPrefix = rawKey.slice(0, 12);
    const cacheKey = `pub_apikey_prefix:${keyPrefix}`;

    let candidates: CachedApiKeyCandidate[] | null = await this.cacheService.get(cacheKey);

    if (!candidates) {
      const dbRecords = await prisma.apiKey.findMany({
        where: { keyPrefix },
        include: { tenant: { select: { id: true, environment: true } } },
      });

      candidates = dbRecords
        .filter((r) => Boolean(r.tenant))
        .map((r) => ({
          id: r.id,
          tenantId: r.tenantId,
          userId: r.createdByUserId || null,
          keyHash: r.keyHash,
          scopes:
            Array.isArray(r.scopes) && r.scopes.length > 0
              ? r.scopes
              : ['invoices:write', 'invoices:read'],
          isActive: r.isActive,
          revoked: Boolean(r.revoked),
          environment: (r.tenant.environment || r.environment || 'SANDBOX') as
            | 'SANDBOX'
            | 'PRODUCTION',
        }));

      if (candidates.length > 0) {
        await this.cacheService.set(cacheKey, candidates, 30);
      }
    }

    // Validación explícita en tiempo constante (crypto.timingSafeEqual)
    let matched: CachedApiKeyCandidate | undefined;
    for (const candidate of candidates || []) {
      const matchHmac = this.cryptoService.verifyHashTimingSafe(hmacHash, candidate.keyHash);
      const matchLegacy =
        Boolean(legacyHash) && this.cryptoService.verifyHashTimingSafe(legacyHash!, candidate.keyHash);
      if (matchHmac || matchLegacy) {
        matched = candidate;
        break;
      }
    }

    if (!matched || !matched.isActive || matched.revoked) {
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
    if (requiredScope && !matched.scopes.includes(requiredScope) && !matched.scopes.includes('*')) {
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
    let windowRec = this.rateWindows.get(matched.id);
    if (!windowRec || now > windowRec.resetAt) {
      windowRec = { count: 1, resetAt: now + 60_000 };
      this.rateWindows.set(matched.id, windowRec);
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
        where: { id: matched.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    req.tenantId = matched.tenantId;
    req.apiKeyId = matched.id;
    req.apiKeyUserId = matched.userId;
    req.apiKeyScopes = matched.scopes;
    req.environment = matched.environment;
    req.isApiKeyRequest = true;

    return true;
  }
}
