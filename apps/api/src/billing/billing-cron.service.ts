import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import * as net from 'net';
import { prisma } from '@factura-ecf/database';
import { BillingService } from './billing.service';

@Injectable()
export class BillingCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingCronService.name);
  private timer: NodeJS.Timeout | null = null;
  private bullQueue: any = null;

  constructor(private readonly billingService: BillingService) {}

  async onModuleInit() {
    this.logger.log('--- Iniciando Cron Job de Control de Vencimientos y Días de Gracia ANTEK Factura ---');
    await this.initBullMqOrFallback();
  }

  private async isRedisAvailable(host: string, port: number, timeoutMs = 800): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let hasResolved = false;

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => {
        if (!hasResolved) {
          hasResolved = true;
          socket.destroy();
          resolve(true);
        }
      });

      socket.once('timeout', () => {
        if (!hasResolved) {
          hasResolved = true;
          socket.destroy();
          resolve(false);
        }
      });

      socket.once('error', () => {
        if (!hasResolved) {
          hasResolved = true;
          socket.destroy();
          resolve(false);
        }
      });

      socket.connect(port, host);
    });
  }

  private async initBullMqOrFallback() {
    const redisHost = process.env.REDIS_HOST || '127.0.0.1';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

    const isAvailable = await this.isRedisAvailable(redisHost, redisPort, 500);

    if (isAvailable) {
      try {
        const { Queue, Worker } = await import('bullmq');
        const connection = { host: redisHost, port: redisPort, maxRetriesPerRequest: 1 };

        this.bullQueue = new Queue('billing-expiration-cron', { connection });
        await this.bullQueue.add(
          'check-expirations',
          {},
          {
            repeat: {
              every: 60 * 60 * 1000,
            },
            removeOnComplete: true,
          }
        );

        new Worker(
          'billing-expiration-cron',
          async () => {
            this.executeExpirationAudit();
          },
          { connection }
        );

        this.logger.log(`✓ BullMQ Repeatable Job configurado exitosamente (cada 1 hora vía Redis)`);
        return;
      } catch (err: any) {
        this.logger.warn(`Error inicializando BullMQ (${err.message}). Pasando a fallback local.`);
      }
    } else {
      this.logger.log('Redis no detectado en puerto 6379. Activando temporizador en memoria de alta precisión.');
    }

    this.startInternalTimer();
  }

  private startInternalTimer() {
    this.executeExpirationAudit();

    // Cada 1 hora (3600000 ms)
    const intervalMs = 60 * 60 * 1000;
    this.timer = setInterval(() => {
      this.executeExpirationAudit();
    }, intervalMs);

    this.logger.log('✓ Temporizador periódico de control de suscripciones activo (frecuencia: cada 1 hora)');
  }

  public async executeExpirationAudit() {
    // 1. Supabase Keep-Alive Ping (previene que la instancia entre en reposo por inactividad)
    try {
      await prisma.$queryRaw`SELECT 1 as keepalive;`;
      this.logger.log('✓ Supabase keep-alive ping exitoso (instancia activa)');
    } catch (keepErr: any) {
      this.logger.warn(`Aviso en keep-alive ping de Supabase: ${keepErr?.message || keepErr}`);
    }

    // 2. Control de Vencimientos y Días de Gracia
    const result = this.billingService.evaluateSubscriptionsExpiration();
    this.logger.log(
      `[BillingCron] Evaluación: ${result.totalActive} activas, ${result.movedToPastDue} a gracia (PAST_DUE 5d), ${result.movedToSuspended} suspendidas.`
    );
    return result;
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.bullQueue) {
      this.bullQueue.close().catch(() => {});
    }
  }
}
