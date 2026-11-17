import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private readonly memoryCache = new Map<string, { value: any; expiresAt: number }>();

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        connectTimeout: 800,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // No spamear reintentos si Redis local está inactivo
      });

      this.redis
        .connect()
        .then(() => {
          this.logger.log('✓ Conectado a Redis 7 para Caché y Rate Limiting de alta concurrencia.');
        })
        .catch(() => {
          this.logger.warn('Redis local no disponible; activando fallback de alta velocidad en memoria.');
          this.redis = null;
        });
    } catch {
      this.redis = null;
    }
  }

  onModuleDestroy() {
    if (this.redis) {
      this.redis.disconnect();
    }
  }

  public getTenantKey(tenantId: string, resource: string): string {
    return `${tenantId}:${resource}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const val = await this.redis.get(key);
        return val ? JSON.parse(val) : null;
      } catch {
        // Fallback memoria
      }
    }

    const item = this.memoryCache.get(key);
    if (!item) return null;
    if (item.expiresAt < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    return item.value as T;
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    const payload = JSON.stringify(value);
    if (this.redis) {
      try {
        await this.redis.set(key, payload, 'EX', ttlSeconds);
        return;
      } catch {
        // Fallback memoria
      }
    }

    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch {}
    }
    this.memoryCache.delete(key);
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds = 300): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await factory();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}

/**
 * Storage de Rate Limiting para @nestjs/throttler respaldado por Redis / memoria
 * optimizado para soportar 200+ usuarios concurrentes.
 */
@Injectable()
export class RedisThrottlerStorageService implements ThrottlerStorage {
  private redis: Redis | null = null;
  private readonly storage = new Map<string, { totalHits: number; expiresAt: number; blockExpiresAt?: number }>();

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        connectTimeout: 500,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      this.redis.connect().catch(() => {
        this.redis = null;
      });
    } catch {
      this.redis = null;
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    const fullKey = `throttle:${throttlerName}:${key}`;

    if (this.redis) {
      try {
        const hits = await this.redis.incr(fullKey);
        if (hits === 1) {
          await this.redis.expire(fullKey, Math.ceil(ttl / 1000));
        }
        const timeToExpire = await this.redis.pttl(fullKey);
        const isBlocked = hits > limit;

        return {
          totalHits: hits,
          timeToExpire: Math.max(0, timeToExpire),
          isBlocked,
          timeToBlockExpire: isBlocked ? Math.ceil(blockDuration / 1000) : 0,
        };
      } catch {
        // Fallback en memoria si Redis falla
      }
    }

    const now = Date.now();
    let record = this.storage.get(fullKey);

    if (!record || record.expiresAt < now) {
      record = { totalHits: 0, expiresAt: now + ttl };
      this.storage.set(fullKey, record);
    }

    record.totalHits += 1;
    const isBlocked = record.totalHits > limit;

    return {
      totalHits: record.totalHits,
      timeToExpire: Math.max(0, record.expiresAt - now),
      isBlocked,
      timeToBlockExpire: isBlocked ? blockDuration : 0,
    };
  }
}
