import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { BillingCronService } from './billing-cron.service';
import { TenantAuthGuard } from '../common/guards/tenant-auth.guard';

@ApiTags('Suscripciones & Links de Pago (Billing)')
@Controller('v1')
@UseGuards(TenantAuthGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly billingCronService: BillingCronService
  ) {}

  @Get('billing/plans')
  @ApiOperation({ summary: 'Listar planes SaaS disponibles (Básico, Medio, Pro)' })
  getPlans() {
    return {
      plans: this.billingService.getPlans(),
    };
  }

  @Get('billing/subscription')
  @ApiOperation({ summary: 'Consultar estado de la suscripción, límite y días de gracia' })
  getSubscription(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.tenantId || 'tenant-principal';
    return this.billingService.getSubscription(tenantId);
  }

  @Get('billing/payments')
  @ApiOperation({ summary: 'Consultar historial de pagos de suscripción y facturas ANTEK' })
  getPayments(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.tenantId || 'tenant-principal';
    return {
      payments: this.billingService.getPaymentHistory(tenantId),
    };
  }

  @Post('billing/checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generar Link de Pago para suscripción mensual o anual' })
  createCheckout(
    @Body()
    body: {
      planCode: 'BASIC' | 'MEDIUM' | 'PRO';
      billingCycle?: 'MONTHLY' | 'ANNUAL';
      gateway?: string;
      customerEmail?: string;
      returnUrl?: string;
      cancelUrl?: string;
    },
    @Req() req: any
  ) {
    const tenantId = req.user?.tenantId || req.tenantId || 'tenant-principal';
    return this.billingService.createCheckout(tenantId, body);
  }

  @Post('webhooks/payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook de confirmación de pago de pasarela (CardNet, Azul, Stripe, Mock)' })
  handlePaymentWebhook(
    @Body() payload: any,
    @Headers('x-signature') signature?: string,
    @Headers('stripe-signature') stripeSig?: string,
    @Headers('x-cardnet-signature') cardnetSig?: string
  ) {
    const effectiveSig = signature || stripeSig || cardnetSig || '';
    return this.billingService.handlePaymentWebhook(payload, effectiveSig);
  }

  @Post('billing/simulate-cron')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ejecutar manualmente el Cron Job de Vencimientos y Días de Gracia' })
  runCronManually() {
    return this.billingCronService.executeExpirationAudit();
  }

  @Post('billing/simulate-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Simular estados de suscripción para pruebas (ACTIVE, PAST_DUE, SUSPENDED)' })
  simulateStatus(
    @Body()
    body: {
      status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED';
      graceDaysRemaining?: number;
    },
    @Req() req: any
  ) {
    const tenantId = req.user?.tenantId || req.tenantId || 'tenant-principal';
    return this.billingService.simulateSubscriptionStatus(
      tenantId,
      body.status,
      body.graceDaysRemaining || 3
    );
  }
}
