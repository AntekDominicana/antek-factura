import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CryptoService } from './common/crypto.service';
import { CacheService, RedisThrottlerStorageService } from './common/cache.service';
import { FiscalService } from './fiscal/fiscal.service';
import { InvoicesController } from './invoices/invoices.controller';
import { DgiiReceptorController } from './dgii-receptor/dgii-receptor.controller';
import { SecurityShieldMiddleware, SecurityShieldService } from './security/security-shield.service';
import { BillingModule } from './billing/billing.module';
import { RncModule } from './rnc/rnc.module';
import { PurchasesModule } from './purchases/purchases.module';
import { SuperAdminModule } from './superadmin/superadmin.module';
import { HealthController } from './health/health.controller';
import { NotificationsService } from './notifications/notifications.service';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './storage/storage.module';
import { IntegrationsService } from './integrations/integrations.service';
import { ApiKeyAuthGuard } from './integrations/api-key-auth.guard';
import {
  DeliveryWebhooksController,
  PublicInvoicesV1Controller,
  TenantIntegrationsController,
} from './integrations/integrations.controller';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000, // 60 segundos
            limit: 120, // 120 peticiones por minuto por IP/token
          },
        ],
        storage: new RedisThrottlerStorageService(),
      }),
    }),
    CommonModule,
    BillingModule,
    RncModule,
    PurchasesModule,
    SuperAdminModule,
    AuthModule,
    StorageModule,
  ],
  controllers: [
    InvoicesController,
    DgiiReceptorController,
    HealthController,
    PublicInvoicesV1Controller,
    DeliveryWebhooksController,
    TenantIntegrationsController,
  ],
  providers: [
    SecurityShieldService,
    FiscalService,
    NotificationsService,
    IntegrationsService,
    ApiKeyAuthGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityShieldMiddleware).forRoutes('*');
  }
}
