import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { prisma } from '@factura-ecf/database';
import { PaymentGatewayFactory, PaymentGatewayAdapter } from './gateways/payment-gateway.interface';

export interface PlanConfig {
  id: string;
  code: 'BASIC' | 'MEDIUM' | 'PRO';
  name: string;
  description: string;
  priceDop: number;
  priceUsd: number;
  monthlyInvoiceLimit: number;
  maxUsers: number;
  maxBranches: number;
  allowedEcfTypes: number[];
  apiAccess: boolean;
  isActive: boolean;
}

export interface SubscriptionState {
  id: string;
  tenantId: string;
  planId: string;
  planCode: 'BASIC' | 'MEDIUM' | 'PRO';
  plan: PlanConfig;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  gracePeriodEndsAt: Date | null;
  graceDaysRemaining?: number;
  invoicesUsedCurrentPeriod: number;
  monthlyInvoiceLimit: number;
  lastPaymentLinkUrl: string | null;
  externalCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRecord {
  id: string;
  subscriptionId: string;
  tenantId: string;
  planCode: string;
  amount: number;
  currency: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  gateway: string;
  gatewayTransactionId: string | null;
  status: 'PENDING' | 'PAID' | 'FAILED';
  checkoutUrl: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  // Catálogo oficial de Planes SaaS ANTEK Factura
  public readonly plans: PlanConfig[] = [
    {
      id: 'plan_basic_01',
      code: 'BASIC',
      name: 'Plan Básico',
      description: 'Ideal para pequeños negocios, comercios y profesionales independientes.',
      priceDop: 990,
      priceUsd: 18,
      monthlyInvoiceLimit: 100,
      maxUsers: 2,
      maxBranches: 1,
      allowedEcfTypes: [31, 32], // Factura de Crédito Fiscal y Consumo
      apiAccess: false,
      isActive: true,
    },
    {
      id: 'plan_medium_02',
      code: 'MEDIUM',
      name: 'Plan Medio',
      description: 'Para empresas en crecimiento con alto volumen de facturación y sucursales.',
      priceDop: 2450,
      priceUsd: 45,
      monthlyInvoiceLimit: 600,
      maxUsers: 5,
      maxBranches: 3,
      allowedEcfTypes: [31, 32, 33, 34, 44, 45], // Crédito Fiscal, Consumo, Notas Débito/Crédito, Regímenes Especiales, Gubernamental
      apiAccess: true,
      isActive: true,
    },
    {
      id: 'plan_pro_03',
      code: 'PRO',
      name: 'Plan Pro',
      description: 'Para corporaciones, distribuidoras y cadenas con emisión masiva vía API y multimoneda.',
      priceDop: 4900,
      priceUsd: 90,
      monthlyInvoiceLimit: 3000,
      maxUsers: 25,
      maxBranches: 10,
      allowedEcfTypes: [31, 32, 33, 34, 41, 43, 44, 45, 46, 47], // Toda la gama de comprobantes fiscales DGII
      apiAccess: true,
      isActive: true,
    },
  ];

  // Almacenamiento reactivo en memoria con persistencia de tenant
  private subscriptions = new Map<string, SubscriptionState>();
  private payments = new Map<string, PaymentRecord>();

  constructor() {
    this.initDefaultSubscription('tenant-principal');
  }

  private initDefaultSubscription(tenantId: string) {
    if (!this.subscriptions.has(tenantId)) {
      const defaultPlan = this.plans.find((p) => p.code === 'MEDIUM') || this.plans[1];
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const sub: SubscriptionState = {
        id: `sub_${tenantId}`,
        tenantId,
        planId: defaultPlan.id,
        planCode: defaultPlan.code,
        plan: defaultPlan,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        gracePeriodEndsAt: null,
        invoicesUsedCurrentPeriod: 0,
        monthlyInvoiceLimit: defaultPlan.monthlyInvoiceLimit,
        lastPaymentLinkUrl: null,
        externalCustomerId: null,
        createdAt: now,
        updatedAt: now,
      };

      this.subscriptions.set(tenantId, sub);

      // Registrar historial inicial de pago
      const initialPayment: PaymentRecord = {
        id: `pay_initial_${tenantId}`,
        subscriptionId: sub.id,
        tenantId,
        planCode: defaultPlan.code,
        amount: defaultPlan.priceDop,
        currency: 'DOP',
        billingCycle: 'MONTHLY',
        gateway: 'CARDNET',
        gatewayTransactionId: 'cn_init_98231a',
        status: 'PAID',
        checkoutUrl: null,
        paidAt: now,
        createdAt: now,
      };
      this.payments.set(initialPayment.id, initialPayment);
    }
  }

  public getPlans(): PlanConfig[] {
    return this.plans;
  }

  public getSubscription(tenantId: string = 'tenant-principal'): SubscriptionState {
    this.initDefaultSubscription(tenantId);
    const sub = this.subscriptions.get(tenantId)!;

    // Calcular días de gracia restantes si está en PAST_DUE
    let graceDaysRemaining: number | undefined;
    if (sub.status === 'PAST_DUE' && sub.gracePeriodEndsAt) {
      const msLeft = sub.gracePeriodEndsAt.getTime() - Date.now();
      graceDaysRemaining = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
    }

    return {
      ...sub,
      graceDaysRemaining,
    };
  }

  /**
   * 1. Generación de Link de Pago (POST /v1/billing/checkout)
   */
  public async createCheckout(
    tenantId: string = 'tenant-principal',
    dto: {
      planCode: 'BASIC' | 'MEDIUM' | 'PRO';
      billingCycle?: 'MONTHLY' | 'ANNUAL';
      gateway?: string;
      customerEmail?: string;
      returnUrl?: string;
      cancelUrl?: string;
    }
  ): Promise<{
    paymentId: string;
    checkoutUrl: string;
    amount: number;
    currency: string;
    planCode: string;
    billingCycle: 'MONTHLY' | 'ANNUAL';
    gateway: string;
  }> {
    this.initDefaultSubscription(tenantId);
    const sub = this.subscriptions.get(tenantId)!;

    const targetPlan = this.plans.find((p) => p.code === dto.planCode);
    if (!targetPlan) {
      throw new BadRequestException(`Plan inválido: ${dto.planCode}. Opciones: BASIC, MEDIUM, PRO.`);
    }

    const billingCycle = dto.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';
    // Descuento anual del 15% (aprox 10 meses de costo por 12 meses de servicio)
    const amount = billingCycle === 'ANNUAL' ? Math.round(targetPlan.priceDop * 10.2) : targetPlan.priceDop;
    const currency = 'DOP';

    const paymentId = `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const gateway = dto.gateway || process.env.DEFAULT_PAYMENT_GATEWAY || 'MOCK';
    const adapter = PaymentGatewayFactory.getAdapter(gateway);

    const host = process.env.WEB_BASE_URL || 'http://localhost:3000';
    const returnUrl = dto.returnUrl || `${host}/app/settings/billing`;
    const cancelUrl = dto.cancelUrl || `${host}/app/settings/billing?cancelled=true`;

    const session = await adapter.createPaymentSession({
      paymentId,
      subscriptionId: sub.id,
      tenantId,
      planCode: targetPlan.code,
      planName: targetPlan.name,
      amount,
      currency,
      billingCycle,
      customerEmail: dto.customerEmail,
      returnUrl,
      cancelUrl,
    });

    const paymentRecord: PaymentRecord = {
      id: paymentId,
      subscriptionId: sub.id,
      tenantId,
      planCode: targetPlan.code,
      amount,
      currency,
      billingCycle,
      gateway: session.gateway,
      gatewayTransactionId: session.gatewayTransactionId,
      status: 'PENDING',
      checkoutUrl: session.checkoutUrl,
      paidAt: null,
      createdAt: new Date(),
    };

    this.payments.set(paymentId, paymentRecord);

    // Actualizar referencia de último link en la suscripción
    sub.lastPaymentLinkUrl = session.checkoutUrl;
    sub.updatedAt = new Date();

    this.logger.log(
      `[Billing] Link de pago generado (${paymentId}) para ${tenantId}: Plan ${targetPlan.code} - ${amount} DOP (${billingCycle})`
    );

    return {
      paymentId,
      checkoutUrl: session.checkoutUrl,
      amount,
      currency,
      planCode: targetPlan.code,
      billingCycle,
      gateway: session.gateway,
    };
  }

  /**
   * 2. Webhook de Confirmación (POST /v1/webhooks/payments)
   */
  public async handlePaymentWebhook(
    payload: any,
    signature: string,
    secret?: string
  ): Promise<{
    success: boolean;
    paymentId: string;
    subscriptionId: string;
    status: string;
    planCode: string;
    currentPeriodEnd: Date;
  }> {
    const gatewayName = payload?.gateway || 'MOCK';
    const adapter = PaymentGatewayFactory.getAdapter(gatewayName);
    const verification = adapter.verifyWebhookSignature(payload, signature, secret);

    if (!verification.isValid) {
      this.logger.warn(`[Billing Webhook] Firma de webhook inválida para gateway ${gatewayName}`);
      throw new HttpException(
        { statusCode: 400, error: 'InvalidSignature', message: 'Firma de webhook de pasarela de pago inválida.' },
        HttpStatus.BAD_REQUEST
      );
    }

    const paymentId = verification.paymentId || payload?.paymentId;
    let payment = paymentId ? this.payments.get(paymentId) : undefined;

    // Si no se encuentra por paymentId, buscar por gatewayTransactionId o último pendiente
    if (!payment && verification.gatewayTransactionId) {
      payment = Array.from(this.payments.values()).find(
        (p) => p.gatewayTransactionId === verification.gatewayTransactionId
      );
    }
    if (!payment) {
      payment = Array.from(this.payments.values()).find((p) => p.status === 'PENDING');
    }

    if (!payment) {
      throw new NotFoundException(`Transacción de pago no encontrada.`);
    }

    // Si el pago ya fue marcado como PAID, retornar idempotente
    if (payment.status === 'PAID') {
      const sub = this.subscriptions.get(payment.tenantId)!;
      return {
        success: true,
        paymentId: payment.id,
        subscriptionId: sub.id,
        status: sub.status,
        planCode: sub.planCode,
        currentPeriodEnd: sub.currentPeriodEnd,
      };
    }

    // Marcar el pago como PAID
    payment.status = 'PAID';
    payment.paidAt = new Date();
    if (verification.gatewayTransactionId) {
      payment.gatewayTransactionId = verification.gatewayTransactionId;
    }

    // Actualizar la Suscripción
    const sub = this.subscriptions.get(payment.tenantId);
    if (!sub) {
      throw new NotFoundException(`Suscripción no encontrada para el tenant ${payment.tenantId}`);
    }

    // Si el pago contemplaba un cambio de plan (Upgrade / Downgrade)
    if (payment.planCode && payment.planCode !== sub.planCode) {
      const newPlan = this.plans.find((p) => p.code === payment.planCode);
      if (newPlan) {
        sub.planId = newPlan.id;
        sub.planCode = newPlan.code;
        sub.plan = newPlan;
        sub.monthlyInvoiceLimit = newPlan.monthlyInvoiceLimit;
      }
    }

    const now = new Date();
    const isAnnual = payment.billingCycle === 'ANNUAL';
    const periodDays = isAnnual ? 365 : 30;
    const newPeriodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

    sub.status = 'ACTIVE';
    sub.currentPeriodStart = now;
    sub.currentPeriodEnd = newPeriodEnd;
    sub.gracePeriodEndsAt = null;
    sub.invoicesUsedCurrentPeriod = 0; // Reinicio de consumo del período
    sub.lastPaymentLinkUrl = null;
    sub.updatedAt = now;

    // Sincronización atómica inmediata en Supabase PostgreSQL (<3 segundos)
    try {
      const planRecord = await prisma.plan.findUnique({ where: { code: sub.planCode } });
      await prisma.subscription.upsert({
        where: { tenantId: payment.tenantId },
        update: {
          status: 'ACTIVE',
          planId: planRecord?.id || sub.planId,
          currentPeriodStart: now,
          currentPeriodEnd: newPeriodEnd,
          gracePeriodEndsAt: null,
          invoicesUsedCurrentPeriod: 0,
        },
        create: {
          tenantId: payment.tenantId,
          planId: planRecord?.id || sub.planId,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: newPeriodEnd,
          gracePeriodEndsAt: null,
          invoicesUsedCurrentPeriod: 0,
        },
      });
      this.logger.log(`[Billing Webhook] Suscripción sincronizada en Supabase PostgreSQL para ${payment.tenantId}`);
    } catch (dbErr: any) {
      this.logger.warn(`[Billing Webhook] Aviso sincronización Supabase: ${dbErr.message}`);
    }

    this.logger.log(
      `[Billing Webhook] Pago confirmado para ${payment.tenantId}. Suscripción reactivada a ACTIVE hasta ${newPeriodEnd.toISOString()}`
    );

    return {
      success: true,
      paymentId: payment.id,
      subscriptionId: sub.id,
      status: sub.status,
      planCode: sub.planCode,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  /**
   * 3. Cron Job de Control de Vencimientos y Días de Gracia
   * - Paso A (Inicio de gracia): ACTIVE donde currentPeriodEnd < now() -> PAST_DUE, gracePeriodEndsAt = currentPeriodEnd + 5 días
   * - Paso B (Suspensión): PAST_DUE donde gracePeriodEndsAt < now() -> SUSPENDED
   */
  public evaluateSubscriptionsExpiration(): {
    evaluatedAt: Date;
    movedToPastDue: number;
    movedToSuspended: number;
    totalActive: number;
  } {
    const now = new Date();
    let movedToPastDue = 0;
    let movedToSuspended = 0;
    let totalActive = 0;

    for (const [tenantId, sub] of this.subscriptions.entries()) {
      // Paso A: Vencimiento de suscripción activa -> Entrar en plazo de gracia de 5 días
      if (sub.status === 'ACTIVE') {
        if (sub.currentPeriodEnd.getTime() < now.getTime()) {
          sub.status = 'PAST_DUE';
          // Se otorgan 5 días calendario exactos desde el fin del período
          sub.gracePeriodEndsAt = new Date(sub.currentPeriodEnd.getTime() + 5 * 24 * 60 * 60 * 1000);
          sub.updatedAt = now;
          movedToPastDue++;
          this.logger.warn(
            `[Cron Paso A] Suscripción ${sub.id} (Tenant ${tenantId}) venció. Estado -> PAST_DUE con 5 días de gracia hasta ${sub.gracePeriodEndsAt.toISOString()}`
          );
        } else {
          totalActive++;
        }
      }
      // Paso B: Vencimiento de plazo de gracia de 5 días -> Suspensión total
      else if (sub.status === 'PAST_DUE') {
        if (sub.gracePeriodEndsAt && sub.gracePeriodEndsAt.getTime() < now.getTime()) {
          sub.status = 'SUSPENDED';
          sub.updatedAt = now;
          movedToSuspended++;
          this.logger.error(
            `[Cron Paso B] Plazo de gracia vencido para suscripción ${sub.id} (Tenant ${tenantId}). Estado -> SUSPENDED (Bloqueo de emisión).`
          );
        }
      }
    }

    return {
      evaluatedAt: now,
      movedToPastDue,
      movedToSuspended,
      totalActive,
    };
  }

  /**
   * 4. SubscriptionGuard Validator
   * Valida restricciones antes de emitir e-CF
   */
  public checkEmissionAllowed(
    tenantId: string = 'tenant-principal',
    tipoEcf: number,
    isApiKeyRequest: boolean = false
  ): void {
    const sub = this.getSubscription(tenantId);
    const plan = sub.plan;

    // Regla 1: Si status === 'SUSPENDED' -> HTTP 402 SUBSCRIPTION_SUSPENDED
    if (sub.status === 'SUSPENDED') {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          error: 'PaymentRequired',
          code: 'SUBSCRIPTION_SUSPENDED',
          message:
            'Tu suscripción está suspendida por falta de pago tras vencer los 5 días de gracia. Genera un Link de Pago para reactivar el servicio de inmediato.',
          plan: plan.name,
          paymentLink: sub.lastPaymentLinkUrl,
        },
        HttpStatus.PAYMENT_REQUIRED
      );
    }

    // Regla 2: Límite mensual de comprobantes -> HTTP 402 PLAN_LIMIT_REACHED
    if (sub.invoicesUsedCurrentPeriod >= plan.monthlyInvoiceLimit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          error: 'PaymentRequired',
          code: 'PLAN_LIMIT_REACHED',
          message: `Has alcanzado el límite mensual de tu plan (${sub.invoicesUsedCurrentPeriod}/${plan.monthlyInvoiceLimit} e-CF). Realiza un Upgrade a Plan Medio o Pro para continuar emitiendo.`,
          currentUsage: sub.invoicesUsedCurrentPeriod,
          limit: plan.monthlyInvoiceLimit,
        },
        HttpStatus.PAYMENT_REQUIRED
      );
    }

    // Regla 3: Tipos de e-CF permitidos según el plan -> HTTP 403 PLAN_UPGRADE_REQUIRED
    if (tipoEcf && !plan.allowedEcfTypes.includes(tipoEcf)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          code: 'PLAN_UPGRADE_REQUIRED',
          message: `El tipo de comprobante e-CF ${tipoEcf} no está habilitado en el ${plan.name}. Requiere Plan Medio o Plan Pro.`,
          allowedTypes: plan.allowedEcfTypes,
          requestedType: tipoEcf,
        },
        HttpStatus.FORBIDDEN
      );
    }

    // Regla 4: Acceso a la API REST pública -> HTTP 403 PLAN_UPGRADE_REQUIRED
    if (isApiKeyRequest && !plan.apiAccess) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          code: 'PLAN_UPGRADE_REQUIRED',
          message: `El acceso a la API REST de emisión requiere Plan Medio o Plan Pro. Actualiza tu plan para habilitar integración con tu tienda online o ERP.`,
        },
        HttpStatus.FORBIDDEN
      );
    }
  }

  /**
   * Incremento atómico del contador mensual de facturas
   */
  public incrementUsage(tenantId: string = 'tenant-principal'): number {
    const sub = this.subscriptions.get(tenantId);
    if (sub) {
      sub.invoicesUsedCurrentPeriod += 1;
      sub.updatedAt = new Date();
      return sub.invoicesUsedCurrentPeriod;
    }
    return 1;
  }

  public getPaymentHistory(tenantId: string = 'tenant-principal'): PaymentRecord[] {
    return Array.from(this.payments.values())
      .filter((p) => p.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Helper para simular estados de prueba (PAST_DUE, SUSPENDED, ACTIVE) en desarrollo
   */
  public simulateSubscriptionStatus(
    tenantId: string = 'tenant-principal',
    status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED',
    graceDaysRemaining: number = 3
  ): SubscriptionState {
    this.initDefaultSubscription(tenantId);
    const sub = this.subscriptions.get(tenantId)!;
    sub.status = status;
    const now = new Date();

    if (status === 'PAST_DUE') {
      sub.currentPeriodEnd = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      sub.gracePeriodEndsAt = new Date(now.getTime() + graceDaysRemaining * 24 * 60 * 60 * 1000);
    } else if (status === 'SUSPENDED') {
      sub.currentPeriodEnd = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      sub.gracePeriodEndsAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    } else {
      sub.currentPeriodStart = now;
      sub.currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      sub.gracePeriodEndsAt = null;
    }

    sub.updatedAt = now;
    return this.getSubscription(tenantId);
  }
}
