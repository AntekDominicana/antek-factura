import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Req,
  Res,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { BillingCronService } from './billing-cron.service';
import { TenantAuthGuard } from '../common/guards/tenant-auth.guard';

@ApiTags('Suscripciones & Links de Pago (Billing)')
@Controller('v1')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly billingCronService: BillingCronService
  ) {}

  private assertSuperAdmin(req: any) {
    const role = String(req.user?.role || '').toUpperCase();
    const email = String(req.user?.email || '').toLowerCase();
    if (role !== 'SUPERADMIN' && email !== 'rootfacturas@antek.com.do') {
      throw new ForbiddenException('Esta acción solo está permitida al Administrador Root.');
    }
  }

  @Get('billing/plans')
  @ApiOperation({ summary: 'Listar planes SaaS disponibles (Básico, Medio, Pro)' })
  async getPlans() {
    const plans = await this.billingService.getPlans();
    return { plans };
  }

  @Get('billing/payment-settings')
  @ApiOperation({ summary: 'Obtener métodos de pago y cuentas bancarias oficiales de ANTEK' })
  async getPaymentSettings() {
    return this.billingService.getPaymentSettings();
  }

  @Get('billing/subscription')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Consultar estado de la suscripción, límite y días de gracia' })
  getSubscription(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.billingService.getSubscription(tenantId);
  }

  @Get('billing/payments')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Consultar historial de pagos de suscripción y facturas ANTEK' })
  async getPayments(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const payments = await this.billingService.getPaymentHistory(tenantId);
    return { payments };
  }

  @Get('billing/payments/:id/receipt')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Descargar / visualizar factura u orden de pago de suscripción' })
  async downloadPaymentReceipt(
    @Param('id') paymentId: string,
    @Req() req: any,
    @Res() res: Response
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const isSuperAdmin =
      String(req.user?.role || '').toUpperCase() === 'SUPERADMIN' ||
      String(req.user?.email || '').toLowerCase() === 'rootfacturas@antek.com.do';

    const html = await this.billingService.getPaymentReceiptHtml(tenantId, paymentId, isSuperAdmin);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Post('billing/checkout')
  @UseGuards(TenantAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generar orden de pago o solicitud de cambio de plan' })
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
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.billingService.createCheckout(tenantId, body);
  }

  @Post('webhooks/payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook de confirmación de pago de pasarela (CardNet, Azul, Stripe)' })
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
  @UseGuards(TenantAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ejecutar manualmente el Cron Job de Vencimientos (Solo Root Admin)' })
  runCronManually(@Req() req: any) {
    this.assertSuperAdmin(req);
    return this.billingCronService.executeExpirationAudit();
  }

  @Post('billing/simulate-status')
  @UseGuards(TenantAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar estado de suscripción (Solo Root Admin)' })
  simulateStatus(
    @Body()
    body: {
      status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED';
      graceDaysRemaining?: number;
    },
    @Req() req: any
  ) {
    this.assertSuperAdmin(req);
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.billingService.simulateSubscriptionStatus(
      tenantId,
      body.status,
      body.graceDaysRemaining || 3
    );
  }
}
