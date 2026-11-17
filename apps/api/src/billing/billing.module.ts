import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingCronService } from './billing-cron.service';
import { BillingController } from './billing.controller';
import { SubscriptionGuard } from './subscription.guard';

@Module({
  controllers: [BillingController],
  providers: [BillingService, BillingCronService, SubscriptionGuard],
  exports: [BillingService, BillingCronService, SubscriptionGuard],
})
export class BillingModule {}
