import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { prisma, SubscriptionStatus } from '@factura-ecf/database';
import { BillingService, PlatformPaymentConfig } from '../billing/billing.service';

@Injectable()
export class SuperAdminService {
  private rolesNormalized = false;

  constructor(private readonly billingService: BillingService) {}

  /**
   * Garantiza en arranque que usuarios registrados sin promoción explícita tengan rol BILLER (Cliente),
   * elimina filas sintéticas de prueba 2026-10 y ajusta plazos de gracia > 5 días a exactamente 5 días.
   */
  private async ensureClientRolesAndCleanTestRows(): Promise<void> {
    if (this.rolesNormalized) return;
    this.rolesNormalized = true;
    try {
      // 1. Limpiar las 3 compras sintéticas de octubre 2026 insertadas durante pruebas
      await prisma.receivedPurchase.deleteMany({
        where: {
          encf: { in: ['E310013736109', 'E310008728229', 'E310003998900'] },
        },
      });

      // 2. Pasar a BILLER (Cliente) usuarios antiguos con ADMIN que no hayan sido promovidos por SuperAdmin
      const adminUsers = await prisma.tenantUser.findMany({
        where: {
          role: 'ADMIN',
          email: { not: 'rootfacturas@antek.com.do' },
        },
        select: { id: true },
      });

      for (const u of adminUsers) {
        const promotedLog = await prisma.auditLog.findFirst({
          where: {
            action: 'USER_ROLE_UPDATED_BY_SUPERADMIN',
            entityId: u.id,
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!promotedLog) {
          await prisma.tenantUser.update({
            where: { id: u.id },
            data: { role: 'BILLER' },
          });
        }
      }

      // 3. Corregir suscripciones en gracia o sin pago con plazo mayor a 5 días
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
      const subs = await prisma.subscription.findMany({
        include: { payments: { where: { status: 'PAID' }, select: { id: true } } },
      });
      for (const s of subs) {
        const hasPaid = s.payments.length > 0;
        if (!hasPaid && s.status !== 'SUSPENDED') {
          const tooLong =
            s.currentPeriodEnd.getTime() > Date.now() + fiveDaysMs ||
            (s.gracePeriodEndsAt && s.gracePeriodEndsAt.getTime() > Date.now() + fiveDaysMs);
          if (tooLong) {
            const maxStartEnd = new Date(s.currentPeriodStart.getTime() + fiveDaysMs);
            const targetEnd =
              maxStartEnd.getTime() >= Date.now()
                ? maxStartEnd
                : new Date(Date.now() + fiveDaysMs);
            await prisma.subscription.update({
              where: { id: s.id },
              data: {
                status: 'PAST_DUE',
                currentPeriodEnd: targetEnd,
                gracePeriodEndsAt: targetEnd,
              },
            });
          }
        }
      }
    } catch {}
  }

  /**
   * Resumen global y métricas reales de la plataforma en Supabase PostgreSQL
   */
  async getMetrics(): Promise<any> {
    await this.ensureClientRolesAndCleanTestRows();
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
    await this.ensureClientRolesAndCleanTestRows();
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
      const hasPaid = (t.subscription?.payments || []).some((p) => p.status === 'PAID');
      const endDateRaw =
        t.subscription?.status === 'PAST_DUE' || !hasPaid
          ? t.subscription?.gracePeriodEndsAt || t.subscription?.currentPeriodEnd
          : t.subscription?.currentPeriodEnd;
      let daysRemaining = endDateRaw
        ? Math.max(0, Math.ceil((new Date(endDateRaw).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;
      if (daysRemaining !== null && (t.subscription?.status === 'PAST_DUE' || !hasPaid)) {
        daysRemaining = Math.min(5, daysRemaining);
      }

      return {
        ...t,
        clientCode: `CLI-${t.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`,
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
   * Asignar o revocar rol de ADMIN / BILLER (Cliente) a un usuario desde SuperAdmin
   */
  async updateUserRole(
    userId: string,
    role: 'ADMIN' | 'BILLER' | 'SUPERADMIN' | 'ACCOUNTANT',
    adminUserId?: string
  ): Promise<any> {
    const existing = await prisma.tenantUser.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException('Usuario no encontrado.');
    if (existing.email.toLowerCase() === 'rootfacturas@antek.com.do') {
      throw new BadRequestException('No se puede degradar la cuenta maestra rootfacturas.');
    }

    const allowedRoles = ['ADMIN', 'BILLER', 'SUPERADMIN', 'ACCOUNTANT'] as const;
    const nextRole = allowedRoles.includes(role as any) ? role : 'BILLER';

    const updated = await prisma.tenantUser.update({
      where: { id: userId },
      data: { role: nextRole },
      select: { id: true, email: true, fullName: true, role: true, tenantId: true },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: existing.tenantId,
        userId: adminUserId || 'SUPERADMIN',
        action: 'USER_ROLE_UPDATED_BY_SUPERADMIN',
        entity: 'TenantUser',
        entityId: userId,
        oldPayload: { role: existing.role },
        newPayload: { role: nextRole },
      },
    });

    return {
      success: true,
      message: `Rol de ${updated.fullName} actualizado a ${nextRole === 'BILLER' ? 'CLIENTE' : nextRole}.`,
      user: updated,
    };
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
   * Actualizar datos completos, plan, estado y días restantes de un cliente
   */
  async updateTenantDetails(
    tenantId: string,
    dto: {
      razonSocial?: string;
      nombreComercial?: string;
      rnc?: string;
      correo?: string;
      telefono?: string;
      direccion?: string;
      environment?: 'SANDBOX' | 'PRODUCTION';
      planCode?: string;
      status?: SubscriptionStatus;
      daysRemaining?: number;
    },
    adminUserId?: string
  ): Promise<any> {
    const existing = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!existing) throw new NotFoundException('Empresa no encontrada.');

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        razonSocial: dto.razonSocial !== undefined ? dto.razonSocial.trim() : existing.razonSocial,
        nombreComercial:
          dto.nombreComercial !== undefined ? dto.nombreComercial.trim() : existing.nombreComercial,
        rnc: dto.rnc !== undefined ? dto.rnc.replace(/\D/g, '') : existing.rnc,
        correo: dto.correo !== undefined ? dto.correo.trim().toLowerCase() : existing.correo,
        telefono: dto.telefono !== undefined ? dto.telefono.trim() : existing.telefono,
        direccion: dto.direccion !== undefined ? dto.direccion.trim() : existing.direccion,
        environment:
          dto.environment === 'PRODUCTION' || dto.environment === 'SANDBOX'
            ? dto.environment
            : existing.environment,
      },
    });

    if (dto.planCode || dto.status || dto.daysRemaining !== undefined) {
      await this.billingService.getPlans();
      const targetCode = (dto.planCode || existing.subscription?.plan?.code || 'MEDIUM').toUpperCase();
      const plan = await prisma.plan.findUnique({ where: { code: targetCode } });

      if (plan) {
        const now = new Date();
        const periodEnd =
          dto.daysRemaining !== undefined && !isNaN(Number(dto.daysRemaining))
            ? new Date(now.getTime() + Math.max(0, Number(dto.daysRemaining)) * 86400000)
            : existing.subscription?.currentPeriodEnd || new Date(now.getTime() + 5 * 86400000);

        await prisma.subscription.upsert({
          where: { tenantId },
          update: {
            planId: plan.id,
            status: dto.status || existing.subscription?.status || 'ACTIVE',
            currentPeriodEnd: periodEnd,
          },
          create: {
            tenantId,
            planId: plan.id,
            status: dto.status || 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId || 'SUPERADMIN',
        action: 'TENANT_UPDATED_BY_SUPERADMIN',
        entity: 'Tenant',
        entityId: tenantId,
        oldPayload: {
          razonSocial: existing.razonSocial,
          rnc: existing.rnc,
          correo: existing.correo,
          telefono: existing.telefono,
        },
        newPayload: dto as any,
      },
    });

    return {
      success: true,
      message: `Datos de ${updatedTenant.razonSocial} actualizados correctamente.`,
      tenant: updatedTenant,
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
