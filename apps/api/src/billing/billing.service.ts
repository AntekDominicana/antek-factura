import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { prisma, SubscriptionStatus } from '@factura-ecf/database';
import { PaymentGatewayFactory } from './gateways/payment-gateway.interface';

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
  paymentLinkMonthly?: string;
  paymentLinkAnnual?: string;
}

export interface BankAccountConfig {
  bankName: string;
  accountNumber: string;
  accountType: string;
  holderName: string;
  rnc: string;
}

export interface PlatformPaymentConfig {
  activeGateway: string;
  enabledMethods: string[];
  planLinks: Record<string, { monthly: string; annual: string }>;
  generalPaymentLink: string;
  bankAccounts: BankAccountConfig[];
  supportWhatsapp: string;
  supportEmail: string;
  instructions: string;
}

export interface SubscriptionState {
  id: string;
  tenantId: string;
  planId: string;
  planCode: string;
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
  requestedPlanChange?: { planCode: string; billingCycle: string } | null;
  pendingPayment?: PaymentRecord | null;
  paymentSettings?: PlatformPaymentConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRecord {
  id: string;
  subscriptionId: string;
  tenantId: string;
  invoiceNumber: string;
  planCode: string;
  amount: number;
  currency: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  gateway: string;
  gatewayTransactionId: string | null;
  status: 'PENDING' | 'PAID' | 'FAILED';
  checkoutUrl: string | null;
  adminNote?: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

const DEFAULT_PLANS: PlanConfig[] = [
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
    allowedEcfTypes: [31, 32, 33, 34, 41, 43, 44, 45],
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
    allowedEcfTypes: [31, 32, 33, 34, 41, 43, 44, 45, 46, 47],
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
    allowedEcfTypes: [31, 32, 33, 34, 41, 43, 44, 45, 46, 47],
    apiAccess: true,
    isActive: true,
  },
];

const DEFAULT_PAYMENT_SETTINGS: PlatformPaymentConfig = {
  activeGateway: 'CARDNET',
  enabledMethods: ['CARD_LINK', 'BANK_TRANSFER'],
  planLinks: {
    BASIC: { monthly: '', annual: '' },
    MEDIUM: { monthly: '', annual: '' },
    PRO: { monthly: '', annual: '' },
  },
  generalPaymentLink: '',
  bankAccounts: [
    {
      bankName: 'Banreservas',
      accountNumber: '9601005113',
      accountType: 'Cuenta de Ahorro DOP',
      holderName: 'ANTEK Dominicana SRL',
      rnc: '131880738',
    },
    {
      bankName: 'Banco BHD',
      accountNumber: '32348260017',
      accountType: 'Cuenta de Ahorro DOP',
      holderName: 'ANTEK Dominicana SRL',
      rnc: '131880738',
    },
    {
      bankName: 'Banco Popular Dominicano',
      accountNumber: '853291680',
      accountType: 'Cuenta Corriente DOP',
      holderName: 'ANTEK Dominicana SRL',
      rnc: '131880738',
    },
  ],
  supportWhatsapp: '18095550199',
  supportEmail: 'facturacion@antek.com.do',
  instructions:
    'Realiza tu pago con tarjeta mediante el Link de Pago Seguro o por transferencia bancaria. Una vez completado, el administrador activará tu plan y te enviará tu factura fiscal e-CF.',
};

function escapeHtml(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseGatewayMeta(
  rawGateway: string | null | undefined,
  fallbackPlanCode: string
): { gateway: string; planCode: string; billingCycle: 'MONTHLY' | 'ANNUAL' } {
  const str = String(rawGateway || 'CARDNET').trim();
  if (str.includes('|')) {
    const [gw, plan, cycle] = str.split('|');
    return {
      gateway: gw || 'CARDNET',
      planCode: (plan || fallbackPlanCode || 'MEDIUM').toUpperCase(),
      billingCycle: cycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY',
    };
  }
  return {
    gateway: str || 'CARDNET',
    planCode: (fallbackPlanCode || 'MEDIUM').toUpperCase(),
    billingCycle: 'MONTHLY',
  };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly subscriptionsFallback = new Map<string, SubscriptionState>();
  private plansSeeded = false;
  private plansCache: { data: PlanConfig[]; expiresAt: number } | null = null;
  private settingsCache: { data: PlatformPaymentConfig; expiresAt: number } | null = null;

  private async ensureDefaultPlans(): Promise<void> {
    if (this.plansSeeded) return;
    try {
      for (const p of DEFAULT_PLANS) {
        await prisma.plan.upsert({
          where: { code: p.code },
          update: {},
          create: {
            code: p.code,
            name: p.name,
            description: p.description,
            priceDop: p.priceDop,
            priceUsd: p.priceUsd,
            monthlyInvoiceLimit: p.monthlyInvoiceLimit,
            maxUsers: p.maxUsers,
            maxBranches: p.maxBranches,
            allowedEcfTypes: p.allowedEcfTypes,
            apiAccess: p.apiAccess,
            isActive: p.isActive,
          },
        });
      }
      this.plansSeeded = true;
    } catch (err: any) {
      this.logger.warn(`[Billing] Aviso al verificar planes iniciales: ${err?.message || err}`);
    }
  }

  public async getPaymentSettings(): Promise<PlatformPaymentConfig> {
    if (this.settingsCache && this.settingsCache.expiresAt > Date.now()) {
      return this.settingsCache.data;
    }
    try {
      const latest = await prisma.auditLog.findFirst({
        where: {
          entity: 'PlatformPaymentConfig',
          action: 'UPDATE_PAYMENT_SETTINGS',
        },
        orderBy: { createdAt: 'desc' },
      });

      const saved = (latest?.newPayload || {}) as Partial<PlatformPaymentConfig>;
      const resolved: PlatformPaymentConfig = {
        ...DEFAULT_PAYMENT_SETTINGS,
        ...saved,
        planLinks: {
          BASIC: { ...DEFAULT_PAYMENT_SETTINGS.planLinks.BASIC, ...(saved.planLinks?.BASIC || {}) },
          MEDIUM: { ...DEFAULT_PAYMENT_SETTINGS.planLinks.MEDIUM, ...(saved.planLinks?.MEDIUM || {}) },
          PRO: { ...DEFAULT_PAYMENT_SETTINGS.planLinks.PRO, ...(saved.planLinks?.PRO || {}) },
        },
        enabledMethods:
          Array.isArray(saved.enabledMethods) && saved.enabledMethods.length > 0
            ? saved.enabledMethods
            : DEFAULT_PAYMENT_SETTINGS.enabledMethods,
        bankAccounts:
          Array.isArray(saved.bankAccounts) && saved.bankAccounts.length > 0
            ? saved.bankAccounts
            : DEFAULT_PAYMENT_SETTINGS.bankAccounts,
      };
      this.settingsCache = { data: resolved, expiresAt: Date.now() + 60_000 };
      return resolved;
    } catch {
      return DEFAULT_PAYMENT_SETTINGS;
    }
  }

  public async updatePaymentSettings(
    updates: Partial<PlatformPaymentConfig>,
    adminUserId?: string
  ): Promise<PlatformPaymentConfig> {
    const current = await this.getPaymentSettings();
    const merged: PlatformPaymentConfig = {
      ...current,
      ...updates,
      planLinks: {
        BASIC: { ...current.planLinks.BASIC, ...(updates.planLinks?.BASIC || {}) },
        MEDIUM: { ...current.planLinks.MEDIUM, ...(updates.planLinks?.MEDIUM || {}) },
        PRO: { ...current.planLinks.PRO, ...(updates.planLinks?.PRO || {}) },
      },
      enabledMethods:
        Array.isArray(updates.enabledMethods) && updates.enabledMethods.length > 0
          ? updates.enabledMethods
          : current.enabledMethods,
      bankAccounts: Array.isArray(updates.bankAccounts)
        ? updates.bankAccounts
        : current.bankAccounts,
    };

    await prisma.auditLog.create({
      data: {
        tenantId: null,
        userId: adminUserId || 'SUPERADMIN',
        action: 'UPDATE_PAYMENT_SETTINGS',
        entity: 'PlatformPaymentConfig',
        entityId: 'platform-payment-config',
        oldPayload: current as any,
        newPayload: merged as any,
      },
    });

    this.settingsCache = null;
    this.plansCache = null;
    return merged;
  }

  public async getPlans(): Promise<PlanConfig[]> {
    if (this.plansCache && this.plansCache.expiresAt > Date.now()) {
      return this.plansCache.data;
    }
    await this.ensureDefaultPlans();
    const settings = await this.getPaymentSettings();

    try {
      const dbPlans = await prisma.plan.findMany({
        orderBy: { priceDop: 'asc' },
      });

      if (dbPlans.length > 0) {
        const mapped: PlanConfig[] = dbPlans.map((p) => {
          const links = settings.planLinks?.[p.code] || { monthly: '', annual: '' };
          return {
            id: p.id,
            code: p.code as 'BASIC' | 'MEDIUM' | 'PRO',
            name: p.name,
            description: p.description || '',
            priceDop: Number(p.priceDop),
            priceUsd: Number(p.priceUsd),
            monthlyInvoiceLimit: p.monthlyInvoiceLimit,
            maxUsers: p.maxUsers,
            maxBranches: p.maxBranches,
            allowedEcfTypes: p.allowedEcfTypes,
            apiAccess: p.apiAccess,
            isActive: p.isActive,
            paymentLinkMonthly: links.monthly || '',
            paymentLinkAnnual: links.annual || '',
          };
        });
        this.plansCache = { data: mapped, expiresAt: Date.now() + 60_000 };
        return mapped;
      }
    } catch {}

    return DEFAULT_PLANS.map((p) => ({
      ...p,
      paymentLinkMonthly: settings.planLinks?.[p.code]?.monthly || '',
      paymentLinkAnnual: settings.planLinks?.[p.code]?.annual || '',
    }));
  }

  public async updatePlan(
    code: string,
    data: {
      name?: string;
      description?: string;
      priceDop?: number;
      priceUsd?: number;
      monthlyInvoiceLimit?: number;
      maxUsers?: number;
      maxBranches?: number;
      allowedEcfTypes?: number[];
      apiAccess?: boolean;
      isActive?: boolean;
      paymentLinkMonthly?: string;
      paymentLinkAnnual?: string;
    },
    adminUserId?: string
  ): Promise<PlanConfig> {
    await this.ensureDefaultPlans();
    const upperCode = code.toUpperCase();
    const existing = await prisma.plan.findUnique({ where: { code: upperCode } });
    if (!existing) {
      throw new NotFoundException(`El plan ${upperCode} no existe.`);
    }

    const updated = await prisma.plan.update({
      where: { code: upperCode },
      data: {
        name: data.name !== undefined ? String(data.name).trim() : existing.name,
        description: data.description !== undefined ? String(data.description).trim() : existing.description,
        priceDop: data.priceDop !== undefined ? Number(data.priceDop) : existing.priceDop,
        priceUsd: data.priceUsd !== undefined ? Number(data.priceUsd) : existing.priceUsd,
        monthlyInvoiceLimit:
          data.monthlyInvoiceLimit !== undefined
            ? Number(data.monthlyInvoiceLimit)
            : existing.monthlyInvoiceLimit,
        maxUsers: data.maxUsers !== undefined ? Number(data.maxUsers) : existing.maxUsers,
        maxBranches: data.maxBranches !== undefined ? Number(data.maxBranches) : existing.maxBranches,
        allowedEcfTypes: Array.isArray(data.allowedEcfTypes)
          ? data.allowedEcfTypes.map(Number)
          : existing.allowedEcfTypes,
        apiAccess: data.apiAccess !== undefined ? Boolean(data.apiAccess) : existing.apiAccess,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : existing.isActive,
      },
    });

    const settings = await this.getPaymentSettings();
    const currentLinks = settings.planLinks?.[upperCode] || { monthly: '', annual: '' };
    const nextMonthly =
      data.paymentLinkMonthly !== undefined ? String(data.paymentLinkMonthly).trim() : currentLinks.monthly;
    const nextAnnual =
      data.paymentLinkAnnual !== undefined ? String(data.paymentLinkAnnual).trim() : currentLinks.annual;

    if (data.paymentLinkMonthly !== undefined || data.paymentLinkAnnual !== undefined) {
      await this.updatePaymentSettings(
        {
          planLinks: {
            ...settings.planLinks,
            [upperCode]: {
              monthly: nextMonthly,
              annual: nextAnnual,
            },
          },
        },
        adminUserId
      );
    }

    await prisma.auditLog.create({
      data: {
        tenantId: null,
        userId: adminUserId || 'SUPERADMIN',
        action: 'PLAN_UPDATED_BY_ADMIN',
        entity: 'Plan',
        entityId: updated.id,
        oldPayload: {
          name: existing.name,
          priceDop: Number(existing.priceDop),
          monthlyInvoiceLimit: existing.monthlyInvoiceLimit,
        },
        newPayload: {
          name: updated.name,
          priceDop: Number(updated.priceDop),
          monthlyInvoiceLimit: updated.monthlyInvoiceLimit,
          paymentLinkMonthly: nextMonthly,
          paymentLinkAnnual: nextAnnual,
        },
      },
    });

    this.plansCache = null;

    return {
      id: updated.id,
      code: updated.code as 'BASIC' | 'MEDIUM' | 'PRO',
      name: updated.name,
      description: updated.description || '',
      priceDop: Number(updated.priceDop),
      priceUsd: Number(updated.priceUsd),
      monthlyInvoiceLimit: updated.monthlyInvoiceLimit,
      maxUsers: updated.maxUsers,
      maxBranches: updated.maxBranches,
      allowedEcfTypes: updated.allowedEcfTypes,
      apiAccess: updated.apiAccess,
      isActive: updated.isActive,
      paymentLinkMonthly: nextMonthly,
      paymentLinkAnnual: nextAnnual,
    };
  }

  public async getSubscription(tenantId: string = 'tenant-principal'): Promise<SubscriptionState> {
    await this.ensureDefaultPlans();
    const settings = await this.getPaymentSettings();

    try {
      let dbSub = await prisma.subscription.findUnique({
        where: { tenantId },
        include: { plan: true },
      });

      if (!dbSub) {
        const tenantExists = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true },
        });
        if (tenantExists) {
          const defaultPlan =
            (await prisma.plan.findUnique({ where: { code: 'MEDIUM' } })) ||
            (await prisma.plan.findFirst());
          if (defaultPlan) {
            const now = new Date();
            const fiveDaysEnd = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
            dbSub = await prisma.subscription.create({
              data: {
                tenantId,
                planId: defaultPlan.id,
                status: 'PAST_DUE',
                currentPeriodStart: now,
                currentPeriodEnd: fiveDaysEnd,
                gracePeriodEndsAt: fiveDaysEnd,
                invoicesUsedCurrentPeriod: 0,
              },
              include: { plan: true },
            });
          }
        }
      }

      if (dbSub && dbSub.plan) {
        const hasPaid =
          (await prisma.subscriptionPayment.count({
            where: { subscriptionId: dbSub.id, status: 'PAID' },
          })) > 0;

        const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
        const maxTrialEnd = new Date(dbSub.currentPeriodStart.getTime() + fiveDaysMs);

        // Corregir suscripciones en prueba/gracia cuyo plazo exceda los 5 días
        if (!hasPaid && dbSub.status !== 'SUSPENDED') {
          const needsEndFix =
            dbSub.currentPeriodEnd.getTime() > Date.now() + fiveDaysMs ||
            !dbSub.gracePeriodEndsAt ||
            dbSub.gracePeriodEndsAt.getTime() > Date.now() + fiveDaysMs;
          if (needsEndFix) {
            const targetEnd =
              maxTrialEnd.getTime() >= Date.now()
                ? maxTrialEnd
                : new Date(Date.now() + fiveDaysMs);
            dbSub = await prisma.subscription.update({
              where: { id: dbSub.id },
              data: {
                status: 'PAST_DUE',
                currentPeriodEnd: targetEnd,
                gracePeriodEndsAt: targetEnd,
              },
              include: { plan: true },
            });
          }
        } else if (dbSub.status === 'PAST_DUE') {
          const graceTarget =
            dbSub.gracePeriodEndsAt && dbSub.gracePeriodEndsAt.getTime() <= Date.now() + fiveDaysMs
              ? dbSub.gracePeriodEndsAt
              : new Date(Date.now() + fiveDaysMs);
          if (!dbSub.gracePeriodEndsAt || dbSub.gracePeriodEndsAt.getTime() !== graceTarget.getTime()) {
            dbSub = await prisma.subscription.update({
              where: { id: dbSub.id },
              data: { gracePeriodEndsAt: graceTarget, currentPeriodEnd: graceTarget },
              include: { plan: true },
            });
          }
        }

        let graceDaysRemaining: number | undefined;
        const effectiveGraceEnd = dbSub.gracePeriodEndsAt || dbSub.currentPeriodEnd;
        if ((dbSub.status === 'PAST_DUE' || !hasPaid) && effectiveGraceEnd) {
          const msLeft = effectiveGraceEnd.getTime() - Date.now();
          graceDaysRemaining = Math.min(5, Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000))));
        }

        const pendingRaw = await prisma.subscriptionPayment.findFirst({
          where: { subscriptionId: dbSub.id, status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        });

        let pendingPayment: PaymentRecord | null = null;
        if (pendingRaw) {
          const meta = parseGatewayMeta(pendingRaw.gateway, dbSub.plan.code);
          const noteLog = await prisma.auditLog.findFirst({
            where: { entity: 'SubscriptionPayment', entityId: pendingRaw.id },
            orderBy: { createdAt: 'desc' },
          });
          const notePayload = (noteLog?.newPayload || {}) as any;

          pendingPayment = {
            id: pendingRaw.id,
            subscriptionId: pendingRaw.subscriptionId,
            tenantId,
            invoiceNumber:
              pendingRaw.gatewayTransactionId || pendingRaw.id.slice(0, 12).toUpperCase(),
            planCode: meta.planCode,
            amount: Number(pendingRaw.amount),
            currency: pendingRaw.currency,
            billingCycle: meta.billingCycle,
            gateway: meta.gateway,
            gatewayTransactionId: pendingRaw.gatewayTransactionId,
            status: pendingRaw.status,
            checkoutUrl: pendingRaw.checkoutUrl,
            adminNote: notePayload?.adminNote || null,
            paidAt: pendingRaw.paidAt,
            createdAt: pendingRaw.createdAt,
          };
        }

        let requestedPlanChange: { planCode: string; billingCycle: string } | null = null;
        if (dbSub.externalCustomerId?.startsWith('REQ:')) {
          const [, reqPlan, reqCycle] = dbSub.externalCustomerId.split(':');
          if (reqPlan) {
            requestedPlanChange = {
              planCode: reqPlan,
              billingCycle: reqCycle || 'MONTHLY',
            };
          }
        }

        return {
          id: dbSub.id,
          tenantId: dbSub.tenantId,
          planId: dbSub.planId,
          planCode: dbSub.plan.code,
          plan: {
            id: dbSub.plan.id,
            code: dbSub.plan.code as 'BASIC' | 'MEDIUM' | 'PRO',
            name: dbSub.plan.name,
            description: dbSub.plan.description || '',
            priceDop: Number(dbSub.plan.priceDop),
            priceUsd: Number(dbSub.plan.priceUsd),
            monthlyInvoiceLimit: dbSub.plan.monthlyInvoiceLimit,
            maxUsers: dbSub.plan.maxUsers,
            maxBranches: dbSub.plan.maxBranches,
            allowedEcfTypes: dbSub.plan.allowedEcfTypes,
            apiAccess: dbSub.plan.apiAccess,
            isActive: dbSub.plan.isActive,
          },
          status: dbSub.status,
          currentPeriodStart: dbSub.currentPeriodStart,
          currentPeriodEnd: dbSub.currentPeriodEnd,
          gracePeriodEndsAt: dbSub.gracePeriodEndsAt,
          graceDaysRemaining,
          invoicesUsedCurrentPeriod: dbSub.invoicesUsedCurrentPeriod,
          monthlyInvoiceLimit: dbSub.plan.monthlyInvoiceLimit,
          lastPaymentLinkUrl: dbSub.lastPaymentLinkUrl,
          externalCustomerId: dbSub.externalCustomerId,
          requestedPlanChange,
          pendingPayment,
          paymentSettings: settings,
          createdAt: dbSub.createdAt,
          updatedAt: dbSub.updatedAt,
        };
      }
    } catch (err: any) {
      this.logger.warn(`[Billing] Fallback en getSubscription(${tenantId}): ${err?.message || err}`);
    }

    const cached = this.subscriptionsFallback.get(tenantId);
    if (cached) {
      return { ...cached, paymentSettings: settings };
    }

    const fallbackPlan = DEFAULT_PLANS[1];
    const now = new Date();
    const created: SubscriptionState = {
      id: `sub_${tenantId}`,
      tenantId,
      planId: fallbackPlan.id,
      planCode: fallbackPlan.code,
      plan: fallbackPlan,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      gracePeriodEndsAt: null,
      invoicesUsedCurrentPeriod: 0,
      monthlyInvoiceLimit: fallbackPlan.monthlyInvoiceLimit,
      lastPaymentLinkUrl: null,
      externalCustomerId: null,
      requestedPlanChange: null,
      pendingPayment: null,
      paymentSettings: settings,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptionsFallback.set(tenantId, created);
    return created;
  }

  public async getPaymentHistory(tenantId: string = 'tenant-principal'): Promise<PaymentRecord[]> {
    try {
      const sub = await prisma.subscription.findUnique({
        where: { tenantId },
        include: { plan: true },
      });
      if (!sub) return [];

      const rows = await prisma.subscriptionPayment.findMany({
        where: { subscriptionId: sub.id },
        orderBy: { createdAt: 'desc' },
      });

      const logs = await prisma.auditLog.findMany({
        where: {
          tenantId,
          entity: 'SubscriptionPayment',
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const noteByPaymentId = new Map<string, string>();
      for (const l of logs) {
        if (l.entityId && !noteByPaymentId.has(l.entityId)) {
          const payload = (l.newPayload || {}) as any;
          if (payload?.adminNote) {
            noteByPaymentId.set(l.entityId, String(payload.adminNote));
          }
        }
      }

      return rows.map((p) => {
        const meta = parseGatewayMeta(p.gateway, sub.plan?.code || 'MEDIUM');
        return {
          id: p.id,
          subscriptionId: p.subscriptionId,
          tenantId,
          invoiceNumber: p.gatewayTransactionId || p.id.slice(0, 12).toUpperCase(),
          planCode: meta.planCode,
          amount: Number(p.amount),
          currency: p.currency,
          billingCycle: meta.billingCycle,
          gateway: meta.gateway,
          gatewayTransactionId: p.gatewayTransactionId,
          status: p.status,
          checkoutUrl: p.checkoutUrl,
          adminNote: noteByPaymentId.get(p.id) || null,
          paidAt: p.paidAt,
          createdAt: p.createdAt,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Generación de orden de pago / solicitud de cambio de plan persistida en Supabase PostgreSQL
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
    invoiceNumber: string;
    checkoutUrl: string;
    amount: number;
    currency: string;
    planCode: string;
    planName: string;
    billingCycle: 'MONTHLY' | 'ANNUAL';
    gateway: string;
    isExternalLink: boolean;
    paymentSettings: PlatformPaymentConfig;
  }> {
    await this.ensureDefaultPlans();
    const sub = await this.getSubscription(tenantId);
    const settings = await this.getPaymentSettings();

    const requestedCode = String(dto.planCode || 'MEDIUM').toUpperCase();
    const targetPlan = await prisma.plan.findUnique({ where: { code: requestedCode } });
    if (!targetPlan) {
      throw new BadRequestException(`Plan inválido: ${dto.planCode}. Opciones: BASIC, MEDIUM, PRO.`);
    }

    const billingCycle: 'MONTHLY' | 'ANNUAL' = dto.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';
    const basePrice = Number(targetPlan.priceDop);
    const amount = billingCycle === 'ANNUAL' ? Math.round(basePrice * 10.2) : basePrice;
    const currency = 'DOP';

    const planLink =
      billingCycle === 'ANNUAL'
        ? settings.planLinks?.[targetPlan.code]?.annual
        : settings.planLinks?.[targetPlan.code]?.monthly;
    const configuredExternalLink = (planLink || settings.generalPaymentLink || '').trim();

    const invoiceNumber = `FAC-ANTEK-${Date.now().toString().slice(-6)}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;
    const host = process.env.WEB_BASE_URL || 'https://antek-factura.vercel.app';
    const checkoutUrl =
      configuredExternalLink || `${host}/app/settings/billing?order=${encodeURIComponent(invoiceNumber)}`;

    const selectedGateway = (dto.gateway || settings.activeGateway || 'CARDNET').toUpperCase();
    const encodedGateway = `${selectedGateway}|${targetPlan.code}|${billingCycle}`;

    const createdPayment = await prisma.subscriptionPayment.create({
      data: {
        subscriptionId: sub.id,
        amount,
        currency,
        gateway: encodedGateway,
        gatewayTransactionId: invoiceNumber,
        status: 'PENDING',
        checkoutUrl,
      },
    });

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        lastPaymentLinkUrl: checkoutUrl,
        externalCustomerId: `REQ:${targetPlan.code}:${billingCycle}`,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        action: 'CLIENT_PLAN_CHANGE_REQUEST',
        entity: 'Subscription',
        entityId: sub.id,
        newPayload: {
          planCode: targetPlan.code,
          billingCycle,
          amount,
          paymentId: createdPayment.id,
          invoiceNumber,
          gateway: selectedGateway,
          checkoutUrl,
        },
      },
    });

    this.logger.log(
      `[Billing] Solicitud de cambio de plan / orden ${invoiceNumber} (${createdPayment.id}) para ${tenantId}: ${targetPlan.code} ${billingCycle} DOP ${amount}`
    );

    const miniPcWebhook = process.env.MINI_PC_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;
    if (miniPcWebhook) {
      fetch(miniPcWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'plan_change_request',
          source: 'factura.antek.com.do',
          tenantId,
          customerEmail: dto.customerEmail || '',
          planCode: targetPlan.code,
          planName: targetPlan.name,
          billingCycle,
          amountDop: amount,
          invoiceNumber,
          checkoutUrl,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(4000),
      }).catch(() => {});
    }

    return {
      paymentId: createdPayment.id,
      invoiceNumber,
      checkoutUrl,
      amount,
      currency,
      planCode: targetPlan.code,
      planName: targetPlan.name,
      billingCycle,
      gateway: selectedGateway,
      isExternalLink: Boolean(configuredExternalLink),
      paymentSettings: settings,
    };
  }

  /**
   * Comprobante / Orden de Factura imprimible para un pago de suscripción
   */
  public async getPaymentReceiptHtml(
    tenantId: string,
    paymentId: string,
    isSuperAdmin: boolean = false
  ): Promise<string> {
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: {
        subscription: {
          include: {
            tenant: true,
            plan: true,
          },
        },
      },
    });

    if (!payment || (!isSuperAdmin && payment.subscription.tenantId !== tenantId)) {
      throw new NotFoundException('Factura o comprobante de suscripción no encontrado.');
    }

    const meta = parseGatewayMeta(payment.gateway, payment.subscription.plan.code);
    const settings = await this.getPaymentSettings();
    const noteLog = await prisma.auditLog.findFirst({
      where: { entity: 'SubscriptionPayment', entityId: payment.id },
      orderBy: { createdAt: 'desc' },
    });
    const adminNote = (noteLog?.newPayload as any)?.adminNote || '';

    const tenant = payment.subscription.tenant;
    const amount = Number(payment.amount);
    const subtotal = amount / 1.18;
    const itbis = amount - subtotal;
    const invoiceNum = payment.gatewayTransactionId || payment.id.slice(0, 12).toUpperCase();
    const isPaid = payment.status === 'PAID';

    const banksHtml = settings.bankAccounts
      .map(
        (b) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:600;">${escapeHtml(b.bankName)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(b.accountNumber)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(b.accountType)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(b.holderName)} (RNC ${escapeHtml(b.rnc)})</td>
        </tr>`
      )
      .join('');

    const hasExternalPayUrl =
      !isPaid && payment.checkoutUrl && payment.checkoutUrl.startsWith('http');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Factura ${escapeHtml(invoiceNum)} - ANTEK Factura</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:#f1f5f9; color:#0f172a; margin:0; padding:24px; }
    .card { max-width:780px; margin:0 auto; background:#fff; border-radius:18px; border:1px solid #cbd5e1; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08); }
    .header { background:#020617; color:#fff; padding:24px 28px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }
    .badge { padding:6px 12px; border-radius:999px; font-size:12px; font-weight:800; }
    .paid { background:#065f46; color:#d1fae5; }
    .pending { background:#78350f; color:#fef3c7; }
    .body { padding:28px; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px; }
    .box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; font-size:13px; }
    table { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:20px; }
    th { text-align:left; background:#f8fafc; padding:10px; border-bottom:2px solid #e2e8f0; color:#475569; font-size:11px; text-transform:uppercase; }
    .totals { max-width:280px; margin-left:auto; font-size:13px; }
    .totals div { display:flex; justify-content:space-between; padding:6px 0; }
    .totals .grand { font-size:17px; font-weight:900; border-top:2px solid #0f172a; padding-top:10px; margin-top:6px; }
    .actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:20px; }
    .btn { display:inline-block; padding:10px 18px; border-radius:10px; font-size:13px; font-weight:700; text-decoration:none; cursor:pointer; border:none; }
    .btn-primary { background:#0284c7; color:#fff; }
    .btn-dark { background:#0f172a; color:#fff; }
    @media print { body { background:#fff; padding:0; } .no-print { display:none !important; } .card { border:none; box-shadow:none; } }
    @media (max-width:600px) { .grid { grid-template-columns:1fr; } body { padding:12px; } .body { padding:18px; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div style="font-size:20px;font-weight:900;letter-spacing:0.04em;">ANTEK FACTURA</div>
        <div style="font-size:12px;color:#94a3b8;">ANTEK Dominicana SRL · RNC 131880738</div>
      </div>
      <div style="text-align:right;">
        <span class="badge ${isPaid ? 'paid' : 'pending'}">${isPaid ? 'PAGADO' : 'PENDIENTE DE PAGO'}</span>
        <div style="font-family:monospace;font-size:13px;margin-top:6px;color:#38bdf8;">${escapeHtml(invoiceNum)}</div>
      </div>
    </div>

    <div class="body">
      <div class="grid">
        <div class="box">
          <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Facturado a (Cliente)</div>
          <div style="font-weight:800;font-size:14px;">${escapeHtml(tenant.razonSocial)}</div>
          <div>RNC / Cédula: <span style="font-family:monospace;">${escapeHtml(tenant.rnc)}</span></div>
          <div>Correo: ${escapeHtml(tenant.correo)}</div>
        </div>
        <div class="box">
          <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Detalles del Documento</div>
          <div>Fecha Emisión: <strong>${new Date(payment.createdAt).toLocaleDateString('es-DO')}</strong></div>
          <div>Método / Pasarela: <strong>${escapeHtml(meta.gateway)}</strong></div>
          ${payment.paidAt ? `<div>Fecha Pago: <strong>${new Date(payment.paidAt).toLocaleDateString('es-DO')}</strong></div>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Descripción de Suscripción</th>
            <th>Ciclo</th>
            <th style="text-align:right;">Total (DOP)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">
              <strong>Suscripción ANTEK Factura — Plan ${escapeHtml(meta.planCode)}</strong>
              <div style="font-size:12px;color:#64748b;">Plataforma SaaS de Facturación Electrónica e-CF (Ley 32-23 DGII)</div>
            </td>
            <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">${meta.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensual'}</td>
            <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;font-weight:700;">RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div><span>Subtotal gravado:</span><span style="font-family:monospace;">RD$ ${subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
        <div><span>ITBIS (18% incluido):</span><span style="font-family:monospace;">RD$ ${itbis.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
        <div class="grand"><span>Total DOP:</span><span style="font-family:monospace;">RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
      </div>

      ${adminNote ? `<div style="margin-top:18px;padding:12px 14px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;font-size:13px;color:#1e3a8a;"><strong>Nota de Administración:</strong> ${escapeHtml(adminNote)}</div>` : ''}

      ${!isPaid && settings.bankAccounts.length > 0 ? `
      <div style="margin-top:22px;">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;color:#475569;margin-bottom:8px;">Cuentas Bancarias Autorizadas</div>
        <table>
          <thead><tr><th>Banco</th><th>No. Cuenta</th><th>Tipo</th><th>Titular</th></tr></thead>
          <tbody>${banksHtml}</tbody>
        </table>
      </div>` : ''}

      <div class="actions no-print">
        <button class="btn btn-dark" onclick="window.print()">Imprimir / Guardar PDF</button>
        ${hasExternalPayUrl ? `<a class="btn btn-primary" href="${escapeHtml(payment.checkoutUrl)}" target="_blank" rel="noreferrer">Abrir Link de Pago</a>` : ''}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Webhook de Confirmación (POST /v1/webhooks/payments)
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
    const gatewayName = payload?.gateway || 'CARDNET';
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
    let payment = paymentId
      ? await prisma.subscriptionPayment.findUnique({
          where: { id: paymentId },
          include: { subscription: { include: { plan: true } } },
        })
      : null;

    if (!payment && verification.gatewayTransactionId) {
      payment = await prisma.subscriptionPayment.findFirst({
        where: { gatewayTransactionId: verification.gatewayTransactionId },
        include: { subscription: { include: { plan: true } } },
      });
    }

    if (!payment) {
      throw new NotFoundException(`Transacción de pago no encontrada.`);
    }

    if (payment.status === 'PAID') {
      return {
        success: true,
        paymentId: payment.id,
        subscriptionId: payment.subscriptionId,
        status: payment.subscription.status,
        planCode: payment.subscription.plan.code,
        currentPeriodEnd: payment.subscription.currentPeriodEnd,
      };
    }

    const now = new Date();
    const meta = parseGatewayMeta(payment.gateway, payment.subscription.plan.code);
    const periodDays = meta.billingCycle === 'ANNUAL' ? 365 : 30;
    const newPeriodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        paidAt: now,
      },
    });

    const targetPlan = await prisma.plan.findUnique({ where: { code: meta.planCode } });
    const updatedSub = await prisma.subscription.update({
      where: { id: payment.subscriptionId },
      data: {
        planId: targetPlan?.id || payment.subscription.planId,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        gracePeriodEndsAt: null,
        invoicesUsedCurrentPeriod: 0,
        lastPaymentLinkUrl: null,
        externalCustomerId: null,
      },
      include: { plan: true },
    });

    return {
      success: true,
      paymentId: payment.id,
      subscriptionId: updatedSub.id,
      status: updatedSub.status,
      planCode: updatedSub.plan.code,
      currentPeriodEnd: updatedSub.currentPeriodEnd,
    };
  }

  /**
   * Cron Job de Control de Vencimientos y Días de Gracia en PostgreSQL
   */
  public async evaluateSubscriptionsExpiration(): Promise<{
    evaluatedAt: Date;
    movedToPastDue: number;
    movedToSuspended: number;
    totalActive: number;
  }> {
    const now = new Date();
    let movedToPastDue = 0;
    let movedToSuspended = 0;
    let totalActive = 0;

    try {
      const subs = await prisma.subscription.findMany({
        where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
      });

      for (const sub of subs) {
        if (sub.status === 'ACTIVE') {
          if (sub.currentPeriodEnd.getTime() < now.getTime()) {
            const graceEnds = new Date(sub.currentPeriodEnd.getTime() + 5 * 24 * 60 * 60 * 1000);
            await prisma.subscription.update({
              where: { id: sub.id },
              data: {
                status: 'PAST_DUE',
                gracePeriodEndsAt: graceEnds,
              },
            });
            movedToPastDue++;
          } else {
            totalActive++;
          }
        } else if (sub.status === 'PAST_DUE') {
          if (sub.gracePeriodEndsAt && sub.gracePeriodEndsAt.getTime() < now.getTime()) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'SUSPENDED' },
            });
            movedToSuspended++;
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`[BillingCron] Aviso evaluando expiraciones: ${err?.message || err}`);
    }

    return {
      evaluatedAt: now,
      movedToPastDue,
      movedToSuspended,
      totalActive,
    };
  }

  /**
   * Valida restricciones del plan antes de emitir e-CF
   */
  public async checkEmissionAllowed(
    tenantId: string = 'tenant-principal',
    tipoEcf: number,
    isApiKeyRequest: boolean = false
  ): Promise<void> {
    const sub = await this.getSubscription(tenantId);
    const plan = sub.plan;

    if (sub.status === 'SUSPENDED') {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          error: 'PaymentRequired',
          code: 'SUBSCRIPTION_SUSPENDED',
          message:
            'Tu suscripción está suspendida por falta de pago tras vencer los 5 días de gracia. Genera o abre tu Link de Pago para reactivar el servicio.',
          plan: plan.name,
          paymentLink: sub.lastPaymentLinkUrl,
        },
        HttpStatus.PAYMENT_REQUIRED
      );
    }

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

    const defaultSpec = DEFAULT_PLANS.find((p) => p.code === plan.code);
    const effectiveAllowed = Array.from(
      new Set([...(Array.isArray(plan.allowedEcfTypes) ? plan.allowedEcfTypes : []), ...(defaultSpec?.allowedEcfTypes || [])])
    );

    if (tipoEcf && effectiveAllowed.length > 0 && !effectiveAllowed.includes(tipoEcf)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          code: 'PLAN_UPGRADE_REQUIRED',
          message: `El tipo de comprobante e-CF ${tipoEcf} no está habilitado en el ${plan.name}. Actualiza tu plan para continuar.`,
          allowedTypes: effectiveAllowed,
          requestedType: tipoEcf,
        },
        HttpStatus.FORBIDDEN
      );
    }

    if (isApiKeyRequest && !plan.apiAccess) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          code: 'PLAN_UPGRADE_REQUIRED',
          message:
            'El acceso mediante X-API-Key requiere Plan Medio o Plan Pro. Actualiza tu plan para habilitar integración API.',
        },
        HttpStatus.FORBIDDEN
      );
    }
  }

  public async incrementUsage(tenantId: string = 'tenant-principal'): Promise<number> {
    try {
      const updated = await prisma.subscription.update({
        where: { tenantId },
        data: { invoicesUsedCurrentPeriod: { increment: 1 } },
      });
      return updated.invoicesUsedCurrentPeriod;
    } catch {
      return 1;
    }
  }

  public async simulateSubscriptionStatus(
    tenantId: string = 'tenant-principal',
    status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED',
    graceDaysRemaining: number = 3
  ): Promise<SubscriptionState> {
    const sub = await this.getSubscription(tenantId);
    const now = new Date();
    let currentPeriodStart = sub.currentPeriodStart;
    let currentPeriodEnd = sub.currentPeriodEnd;
    let gracePeriodEndsAt: Date | null = null;

    if (status === 'PAST_DUE') {
      currentPeriodEnd = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      gracePeriodEndsAt = new Date(now.getTime() + graceDaysRemaining * 24 * 60 * 60 * 1000);
    } else if (status === 'SUSPENDED') {
      currentPeriodEnd = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      gracePeriodEndsAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    } else {
      currentPeriodStart = now;
      currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: status as SubscriptionStatus,
        currentPeriodStart,
        currentPeriodEnd,
        gracePeriodEndsAt,
      },
    });

    return this.getSubscription(tenantId);
  }
}
