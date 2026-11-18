import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { prisma, SubscriptionStatus } from '@factura-ecf/database';
import { BillingService, PlatformPaymentConfig } from '../billing/billing.service';

@Injectable()
export class SuperAdminService {
  constructor(private readonly billingService: BillingService) {}

  /**
   * Resumen global y métricas reales de la plataforma en Supabase PostgreSQL
   */
  async getMetrics(): Promise<any> {
    const [
      totalTenants,
      activeSubscriptions,
      pendingPaymentsCount,
      totalInvoices,
      totalAccepted,
      totalPurchases606,
      activeSubsWithPlan,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscriptionPayment.count({ where: { status: 'PENDING' } }),
      prisma.invoice.count(),
      prisma.invoice.count({ where: { status: 'ACCEPTED' } }),
      prisma.receivedPurchase.count(),
      prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: { plan: true },
      }),
    ]);

    let mrrDop = 0;
    activeSubsWithPlan.forEach((s: any) => {
      mrrDop += Number(s.plan?.priceDop || 0);
    });

    return {
      totalTenants,
      activeSubscriptions,
      pendingPaymentsCount,
      totalInvoices,
      totalAccepted,
      totalPurchases606,
      mrrDop,
      uptimeSeconds: process.uptime(),
      complianceLey32_23: '100% Certified',
      platformBrand: 'ANTEK Factura',
      developer: 'antek',
    };
  }

  /**
   * Listado completo de empresas/tenants registrados con pagos recientes
   */
  async getAllTenants(): Promise<any> {
    const tenants = await prisma.tenant.findMany({
      include: {
        users: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        subscription: {
          include: {
            plan: true,
            payments: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
        _count: {
          select: {
            invoices: true,
            receivedPurchases: true,
            users: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map((t) => {
      const endDateRaw = t.subscription?.currentPeriodEnd;
      const daysRemaining = endDateRaw
        ? Math.max(0, Math.ceil((new Date(endDateRaw).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

      return {
        ...t,
        daysRemaining,
        subscription: t.subscription
          ? {
              ...t.subscription,
              plan: t.subscription.plan
                ? {
                    ...t.subscription.plan,
                    priceDop: Number(t.subscription.plan.priceDop),
                    priceUsd: Number(t.subscription.plan.priceUsd),
                  }
                : null,
              payments: (t.subscription.payments || []).map((p) => ({
                ...p,
                amount: Number(p.amount),
              })),
            }
          : null,
      };
    });
  }

  /**
   * Activación o actualización manual de suscripción y estado
   */
  async manuallyActivateSubscription(
    tenantId: string,
    planCode: string,
    months = 1,
    status: SubscriptionStatus = 'ACTIVE'
  ): Promise<any> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado.');

    await this.billingService.getPlans();
    const plan = await prisma.plan.findUnique({ where: { code: planCode.toUpperCase() } });
    if (!plan) throw new NotFoundException('Plan no encontrado.');

    const now = new Date();
    const periodEnd = new Date(now.getTime() + Math.max(1, months) * 30 * 24 * 60 * 60 * 1000);
    const gracePeriodEndsAt =
      status === 'PAST_DUE' ? new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000) : null;

    const subscription = await prisma.subscription.upsert({
      where: { tenantId },
      update: {
        planId: plan.id,
        status,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        gracePeriodEndsAt,
        invoicesUsedCurrentPeriod: 0,
        lastPaymentLinkUrl: null,
        externalCustomerId: null,
      },
      create: {
        tenantId,
        planId: plan.id,
        status,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        gracePeriodEndsAt,
        invoicesUsedCurrentPeriod: 0,
      },
    });

    if (status === 'ACTIVE') {
      await prisma.subscriptionPayment.updateMany({
        where: { subscriptionId: subscription.id, status: 'PENDING' },
        data: { status: 'PAID', paidAt: now },
      });

      const txNum = `TRANS-MANUAL-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      await prisma.subscriptionPayment.create({
        data: {
          subscriptionId: subscription.id,
          amount: Number(plan.priceDop) * Math.max(1, months),
          currency: 'DOP',
          gateway: `MANUAL|${plan.code}|${months >= 12 ? 'ANNUAL' : 'MONTHLY'}`,
          gatewayTransactionId: txNum,
          status: 'PAID',
          paidAt: now,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: 'SUPERADMIN',
        action: 'MANUAL_SUBSCRIPTION_ACTIVATION',
        entity: 'Subscription',
        entityId: subscription.id,
        newPayload: { planCode: plan.code, months, status, periodEnd },
        ipAddress: '127.0.0.1',
      },
    });

    return {
      success: true,
      message: `Suscripción actualizada a ${plan.name} (${status}, ${months} mes/es).`,
      subscription,
    };
  }

  /**
   * Enviar nueva factura y/o link de pago a un cliente (y opcionalmente activar de inmediato si viene PAID)
   */
  async sendInvoiceAndPaymentLink(
    tenantId: string,
    dto: {
      planCode: string;
      billingCycle?: 'MONTHLY' | 'ANNUAL';
      amount?: number;
      checkoutUrl?: string;
      invoiceNumber?: string;
      status?: 'PENDING' | 'PAID';
      months?: number;
      adminNote?: string;
    },
    adminUserId?: string
  ): Promise<any> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Empresa no encontrada.');

    await this.billingService.getPlans();
    const upperPlan = String(dto.planCode || 'MEDIUM').toUpperCase();
    const plan = await prisma.plan.findUnique({ where: { code: upperPlan } });
    if (!plan) throw new NotFoundException(`Plan ${upperPlan} no encontrado.`);

    const billingCycle = dto.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';
    const months = Math.max(1, Number(dto.months || (billingCycle === 'ANNUAL' ? 12 : 1)));
    const defaultAmount =
      billingCycle === 'ANNUAL'
        ? Math.round(Number(plan.priceDop) * 10.2)
        : Number(plan.priceDop) * months;
    const amount = dto.amount !== undefined && Number(dto.amount) >= 0 ? Number(dto.amount) : defaultAmount;

    if (amount <= 0) {
      throw new BadRequestException('El monto de la factura debe ser mayor a 0.');
    }

    const settings = await this.billingService.getPaymentSettings();
    const defaultLink =
      (billingCycle === 'ANNUAL'
        ? settings.planLinks?.[upperPlan]?.annual
        : settings.planLinks?.[upperPlan]?.monthly) || settings.generalPaymentLink || '';
    const checkoutUrl = String(dto.checkoutUrl ?? defaultLink).trim() || null;

    const cleanCustomInv = String(dto.invoiceNumber || '').trim();
    const txId =
      cleanCustomInv.length > 0
        ? cleanCustomInv
        : `FAC-ANTEK-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const paymentStatus = dto.status === 'PAID' ? 'PAID' : 'PENDING';
    const now = new Date();
    const periodEnd = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);

    let subscription = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          tenantId,
          planId: plan.id,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          lastPaymentLinkUrl: paymentStatus === 'PENDING' ? checkoutUrl : null,
          externalCustomerId: paymentStatus === 'PENDING' ? `REQ:${upperPlan}:${billingCycle}` : null,
        },
      });
    } else if (paymentStatus === 'PAID') {
      subscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: plan.id,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          gracePeriodEndsAt: null,
          invoicesUsedCurrentPeriod: 0,
          lastPaymentLinkUrl: null,
          externalCustomerId: null,
        },
      });
    } else {
      subscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          lastPaymentLinkUrl: checkoutUrl,
          externalCustomerId: `REQ:${upperPlan}:${billingCycle}`,
        },
      });
    }

    const existingTx = await prisma.subscriptionPayment.findUnique({
      where: { gatewayTransactionId: txId },
    });
    const finalTxId = existingTx ? `${txId}-${crypto.randomBytes(2).toString('hex').toUpperCase()}` : txId;

    const payment = await prisma.subscriptionPayment.create({
      data: {
        subscriptionId: subscription.id,
        amount,
        currency: 'DOP',
        gateway: `ADMIN|${upperPlan}|${billingCycle}`,
        gatewayTransactionId: finalTxId,
        status: paymentStatus,
        checkoutUrl,
        paidAt: paymentStatus === 'PAID' ? now : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId || 'SUPERADMIN',
        action:
          paymentStatus === 'PAID'
            ? 'ADMIN_INVOICE_PAID_ACTIVATED'
            : 'ADMIN_SENT_INVOICE_AND_PAYMENT_LINK',
        entity: 'SubscriptionPayment',
        entityId: payment.id,
        newPayload: {
          invoiceNumber: finalTxId,
          planCode: upperPlan,
          billingCycle,
          amount,
          status: paymentStatus,
          checkoutUrl,
          months,
          adminNote: dto.adminNote?.trim() || '',
        },
      },
    });

    return {
      success: true,
      message:
        paymentStatus === 'PAID'
          ? `Factura ${finalTxId} registrada como PAGADA y plan ${plan.name} activado para ${tenant.razonSocial}.`
          : `Factura ${finalTxId} y Link de Pago enviados a ${tenant.razonSocial}.`,
      payment: {
        ...payment,
        amount: Number(payment.amount),
      },
      subscription,
    };
  }

  /**
   * Ajuste de cuota de e-CF mensual para un tenant específico
   */
  async adjustInvoiceQuota(tenantId: string, additionalQuota: number): Promise<any> {
    const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!subscription) throw new NotFoundException('Suscripción no encontrada.');

    const newUsed = Math.max(0, subscription.invoicesUsedCurrentPeriod - additionalQuota);

    const updated = await prisma.subscription.update({
      where: { tenantId },
      data: { invoicesUsedCurrentPeriod: newUsed },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: 'SUPERADMIN',
        action: 'QUOTA_ADJUSTMENT',
        entity: 'Subscription',
        entityId: subscription.id,
        newPayload: { additionalQuota, newUsed },
      },
    });

    return {
      success: true,
      message: `Cuota ajustada exitosamente. Facturas contabilizadas este período: ${newUsed}.`,
      subscription: updated,
    };
  }

  /**
   * Consulta el registro de auditoría inmutable
   */
  async getAuditLogs(limit = 100): Promise<any> {
    return prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  getPlans() {
    return this.billingService.getPlans();
  }

  updatePlan(code: string, data: any, adminUserId?: string) {
    return this.billingService.updatePlan(code, data, adminUserId);
  }

  getPaymentSettings() {
    return this.billingService.getPaymentSettings();
  }

  updatePaymentSettings(data: Partial<PlatformPaymentConfig>, adminUserId?: string) {
    return this.billingService.updatePaymentSettings(data, adminUserId);
  }
}
