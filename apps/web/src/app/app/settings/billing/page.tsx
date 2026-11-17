'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  ExternalLink,
  Download,
  AlertTriangle,
  Landmark,
  ShieldAlert,
  Copy,
  FileText,
  MessageCircle,
  Sparkles,
  Check,
} from 'lucide-react';
import { apiFetch, formatDOP } from '../../../../lib/api';

interface Plan {
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

interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountType: string;
  holderName: string;
  rnc: string;
}

interface PaymentSettings {
  activeGateway: string;
  enabledMethods: string[];
  generalPaymentLink: string;
  bankAccounts: BankAccount[];
  supportWhatsapp: string;
  supportEmail: string;
  instructions: string;
}

interface PaymentItem {
  id: string;
  subscriptionId: string;
  invoiceNumber?: string;
  planCode: string;
  amount: number;
  currency: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  gateway: string;
  gatewayTransactionId: string | null;
  status: 'PENDING' | 'PAID' | 'FAILED';
  checkoutUrl: string | null;
  adminNote?: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface SubscriptionData {
  id: string;
  tenantId: string;
  planId: string;
  planCode: 'BASIC' | 'MEDIUM' | 'PRO';
  plan: Plan;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodEndsAt: string | null;
  graceDaysRemaining?: number;
  invoicesUsedCurrentPeriod: number;
  monthlyInvoiceLimit: number;
  lastPaymentLinkUrl: string | null;
  requestedPlanChange?: { planCode: string; billingCycle: string } | null;
  pendingPayment?: PaymentItem | null;
  paymentSettings?: PaymentSettings;
}

export default function BillingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [preferredMethod, setPreferredMethod] = useState<'CARD_LINK' | 'BANK_TRANSFER'>('CARD_LINK');

  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState<{
    paymentId: string;
    invoiceNumber: string;
    checkoutUrl: string;
    amount: number;
    currency: string;
    planCode: string;
    planName: string;
    billingCycle: string;
    isExternalLink: boolean;
    paymentSettings?: PaymentSettings;
  } | null>(null);

  const [processingPayment, setProcessingPayment] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadBillingData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [plansRes, subRes, payRes] = await Promise.all([
        apiFetch<{ plans: Plan[] }>('/v1/billing/plans'),
        apiFetch<SubscriptionData>('/v1/billing/subscription'),
        apiFetch<{ payments: PaymentItem[] }>('/v1/billing/payments'),
      ]);

      if (plansRes?.plans) setPlans(plansRes.plans);
      if (subRes) setSub(subRes);
      if (payRes?.payments) setPayments(payRes.payments);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo cargar tu información de facturación y suscripción.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, []);

  const handleRequestPlanOrPay = async (targetPlanCode?: 'BASIC' | 'MEDIUM' | 'PRO') => {
    const planToRequest = targetPlanCode || sub?.planCode || 'MEDIUM';
    setProcessingPayment(true);
    setErrorMsg(null);
    try {
      const gateway =
        preferredMethod === 'BANK_TRANSFER'
          ? 'TRANSFERENCIA'
          : sub?.paymentSettings?.activeGateway || 'CARDNET';

      const res = await apiFetch<any>('/v1/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          planCode: planToRequest,
          billingCycle,
          gateway,
        }),
      });

      setCheckoutData(res);
      setCheckoutModalOpen(true);
      setActionSuccessMsg(
        `Orden ${res.invoiceNumber || ''} generada correctamente. Completa tu pago para activar el plan.`
      );
      await loadBillingData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al procesar el cambio de plan o generar el link de pago.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleOpenReceipt = async (paymentId: string) => {
    try {
      const html = await apiFetch<string>(`/v1/billing/payments/${paymentId}/receipt`);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `Factura-ANTEK-${paymentId.slice(0, 8)}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo abrir el comprobante de pago.');
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const currentUsage = sub?.invoicesUsedCurrentPeriod || 0;
  const currentLimit = sub?.monthlyInvoiceLimit || sub?.plan?.monthlyInvoiceLimit || 100;
  const usagePercentage = Math.min(100, Math.round((currentUsage / Math.max(1, currentLimit)) * 100));

  const isPastDue = sub?.status === 'PAST_DUE';
  const isSuspended = sub?.status === 'SUSPENDED';

  const pendingPayment = sub?.pendingPayment;
  const activePaymentLink = pendingPayment?.checkoutUrl || sub?.lastPaymentLinkUrl || '';
  const hasExternalPaymentUrl =
    Boolean(activePaymentLink) &&
    activePaymentLink.startsWith('http') &&
    !activePaymentLink.includes('/app/settings/billing?order=');

  const bankAccounts =
    checkoutData?.paymentSettings?.bankAccounts ||
    sub?.paymentSettings?.bankAccounts ||
    [];
  const supportWhatsapp =
    checkoutData?.paymentSettings?.supportWhatsapp ||
    sub?.paymentSettings?.supportWhatsapp ||
    '';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Suscripción, Planes &amp; Pagos</h1>
          <p className="text-xs text-slate-500">
            Administra tu plan mensual o anual, revisa las facturas emitidas por ANTEK y accede a tu Link de Pago oficial.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Banner de Nueva Factura / Link de Pago enviado por Administración */}
      {(pendingPayment || activePaymentLink) && (
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-sky-900 via-slate-900 to-indigo-950 text-white shadow-xl border border-sky-500/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[10px] font-black uppercase tracking-wider mb-1.5">
                <Sparkles className="w-3 h-3" />
                <span>Nueva Factura / Link de Pago Pendiente</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white">
                Orden {pendingPayment?.invoiceNumber || 'de Suscripción'} — Plan{' '}
                {pendingPayment?.planCode || sub?.requestedPlanChange?.planCode || sub?.planCode}
              </h2>
              {pendingPayment?.adminNote && (
                <p className="text-xs text-sky-100 mt-1 bg-white/10 px-3 py-1.5 rounded-lg inline-block">
                  Nota del Administrador: {pendingPayment.adminNote}
                </p>
              )}
            </div>

            {pendingPayment && (
              <div className="text-left sm:text-right shrink-0">
                <div className="text-[11px] text-slate-300 uppercase font-semibold">Total a Pagar</div>
                <div className="text-2xl font-black font-mono text-sky-300">
                  {formatDOP(pendingPayment.amount)}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {hasExternalPaymentUrl && (
              <a
                href={activePaymentLink}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg inline-flex items-center gap-2 transition"
              >
                <CreditCard className="w-4 h-4" />
                <span>Pagar Ahora (Abrir Link de Pago)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {pendingPayment && (
              <button
                type="button"
                onClick={() => handleOpenReceipt(pendingPayment.id)}
                className="px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs inline-flex items-center gap-2 transition cursor-pointer"
              >
                <FileText className="w-4 h-4 text-sky-600" />
                <span>Ver / Imprimir Factura</span>
              </button>
            )}

            {supportWhatsapp && (
              <a
                href={`https://wa.me/${supportWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Hola ANTEK, adjunto el comprobante de mi orden ${pendingPayment?.invoiceNumber || ''}.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 font-bold text-xs inline-flex items-center gap-2 transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Enviar Comprobante por WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Alerta de Estado Suspendido o En Gracia */}
      {isSuspended && (
        <div className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 space-y-2">
          <div className="flex items-center gap-2 font-black text-sm text-rose-700">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Cuenta Suspendida por Falta de Pago (HTTP 402)</span>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            El plazo de 5 días de gracia venció. La emisión de nuevos e-CF está bloqueada. Realiza tu pago mediante Link de Pago o transferencia bancaria y el administrador reactivará tu cuenta al instante.
          </p>
        </div>
      )}

      {isPastDue && (
        <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-2">
          <div className="flex items-center gap-2 font-black text-sm text-amber-800">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Período de Gracia de 5 Días Activo ({sub?.graceDaysRemaining ?? 5} días restantes)</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Tu suscripción mensual ha vencido. Puedes continuar emitiendo normalmente durante los 5 días de gracia. Por favor regulariza tu cuota antes de finalizar el plazo.
          </p>
        </div>
      )}

      {/* 1. Tarjeta de Consumo Mensual */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Consumo de Comprobantes e-CF del Período
            </div>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {loading ? 'Cargando consumo...' : `${currentUsage} de ${currentLimit} facturas emitidas`}
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                usagePercentage >= 90
                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                  : usagePercentage >= 70
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-sky-100 text-sky-700 border border-sky-200'
              }`}
            >
              {usagePercentage}% consumido
            </span>
          </div>
        </div>

        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              usagePercentage >= 90
                ? 'bg-rose-500'
                : usagePercentage >= 70
                ? 'bg-amber-500'
                : 'bg-gradient-to-r from-sky-500 to-indigo-600'
            }`}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>

        <div className="flex flex-wrap justify-between items-center gap-2 text-[11px] text-slate-500">
          <span>
            Vencimiento actual:{' '}
            <strong className="text-slate-700">
              {sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('es-DO') : '—'}
            </strong>
          </span>
          <span>{Math.max(0, currentLimit - currentUsage)} e-CF disponibles</span>
        </div>
      </div>

      {/* 2. Plan Actual & Preferencias de Pago */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200">
                {sub?.plan?.name || 'Plan Actual'}
              </span>
              <span className="text-xs text-slate-400 font-semibold">•</span>
              <span
                className={`text-xs font-bold flex items-center gap-1 ${
                  sub?.status === 'ACTIVE'
                    ? 'text-emerald-600'
                    : isPastDue
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {sub?.status === 'ACTIVE' ? 'Al día' : isPastDue ? 'En Plazo de Gracia' : 'Suspendido'}
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-1">
              {sub?.plan?.name || 'Suscripción'} — {currentLimit} e-CF Mensuales
            </h2>
            <p className="text-xs text-slate-500">
              {sub?.plan?.description || 'Facturación oficial Ley 32-23 DGII.'}
            </p>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <div className="text-2xl font-black text-slate-900">
              {formatDOP(sub?.plan?.priceDop || 0)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">al mes (ITBIS incluido)</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl font-bold">
              <button
                type="button"
                onClick={() => setBillingCycle('MONTHLY')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  billingCycle === 'MONTHLY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('ANNUAL')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  billingCycle === 'ANNUAL' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                Anual (15% dto.)
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl font-bold">
              <button
                type="button"
                onClick={() => setPreferredMethod('CARD_LINK')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  preferredMethod === 'CARD_LINK' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Tarjeta / Link Pago
              </button>
              <button
                type="button"
                onClick={() => setPreferredMethod('BANK_TRANSFER')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  preferredMethod === 'BANK_TRANSFER' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Transferencia
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={processingPayment}
            onClick={() => handleRequestPlanOrPay(sub?.planCode)}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 inline-flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            <span>{processingPayment ? 'Generando Orden...' : 'Renovar / Generar Link de Pago'}</span>
          </button>
        </div>
      </div>

      {/* 3. Selector Dinámico de Planes */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Cambiar de Plan (Upgrade / Downgrade)</h2>
          <p className="text-xs text-slate-500">
            Precios y límites actualizados en vivo desde administración. Selecciona un plan para generar tu factura y link de pago.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((item) => {
            const isCurrent = sub?.planCode === item.code;
            const displayPrice =
              billingCycle === 'ANNUAL' ? Math.round(Number(item.priceDop) * 10.2) : Number(item.priceDop);
            return (
              <div
                key={item.code}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-sky-50/50 border-sky-400 shadow-sm ring-2 ring-sky-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-900">{item.name}</span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-600 text-white">
                        Actual
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 min-h-[32px]">{item.description}</p>

                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900">{formatDOP(displayPrice)}</span>
                    <span className="text-[10px] text-slate-500">
                      / {billingCycle === 'ANNUAL' ? 'año' : 'mes'}
                    </span>
                  </div>

                  <ul className="space-y-1.5 text-xs text-slate-600 pt-1">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>{item.monthlyInvoiceLimit.toLocaleString('es-DO')} e-CF / mes</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>e-CF: {item.allowedEcfTypes.join(', ')}</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>
                        {item.maxUsers} usuarios, {item.maxBranches} sucursales
                      </span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>{item.apiAccess ? 'API REST + Webhooks ✓' : 'Emisión desde Portal Web'}</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs cursor-default"
                    >
                      Plan Activo
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={processingPayment}
                      onClick={() => handleRequestPlanOrPay(item.code)}
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                    >
                      Cambiar a {item.name}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Cuentas Bancarias Oficiales para Transferencia */}
      {bankAccounts.length > 0 && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-black text-sm text-slate-900">
            <Landmark className="w-4 h-4 text-sky-600" />
            <span>Cuentas Bancarias Oficiales para Transferencias</span>
          </div>
          <p className="text-xs text-slate-500">
            {sub?.paymentSettings?.instructions ||
              'Si realizas transferencia bancaria, envía tu comprobante para la activación inmediata de tu plan.'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {bankAccounts.map((acc, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-900">{acc.bankName}</div>
                <div className="font-mono font-bold text-sky-700 text-sm">{acc.accountNumber}</div>
                <div className="text-slate-600">{acc.accountType}</div>
                <div className="text-[11px] text-slate-500">
                  {acc.holderName} · RNC: {acc.rnc}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Historial de Pagos y Facturas */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">
            Historial de Facturas &amp; Pagos ANTEK ({payments.length})
          </span>
          <span className="text-[11px] text-slate-500 font-medium">ANTEK Dominicana SRL</span>
        </div>

        <div className="divide-y divide-slate-100">
          {payments.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No hay órdenes o facturas registradas aún en el historial.
            </div>
          ) : (
            payments.map((pay) => (
              <div
                key={pay.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold font-mono text-slate-900 text-xs">
                      {pay.invoiceNumber || pay.gatewayTransactionId || pay.id.slice(0, 10)}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-semibold">
                      {pay.gateway}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        pay.status === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : pay.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {pay.status === 'PAID' ? 'Pagado' : pay.status === 'PENDING' ? 'Pendiente' : 'Fallido'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    <span>Plan {pay.planCode}</span> •{' '}
                    <span>{new Date(pay.createdAt).toLocaleDateString('es-DO')}</span> •{' '}
                    <span>{pay.billingCycle === 'ANNUAL' ? 'Facturación Anual' : 'Facturación Mensual'}</span>
                  </div>
                  {pay.adminNote && (
                    <div className="text-[11px] text-sky-700 mt-1 font-medium">
                      Nota: {pay.adminNote}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="font-bold font-mono text-slate-900 text-xs">{formatDOP(pay.amount)}</span>
                  {pay.status === 'PENDING' &&
                    pay.checkoutUrl &&
                    pay.checkoutUrl.startsWith('http') &&
                    !pay.checkoutUrl.includes('/app/settings/billing?order=') && (
                      <a
                        href={pay.checkoutUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center gap-1"
                      >
                        Pagar <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  <button
                    type="button"
                    onClick={() => handleOpenReceipt(pay.id)}
                    className="p-2 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg border border-slate-200 transition cursor-pointer"
                    title="Ver o imprimir factura"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Orden Generada & Datos Reales de Pago */}
      {checkoutModalOpen && checkoutData && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Orden de Cambio de Plan Generada</h2>
              <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
                {checkoutData.invoiceNumber}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Plan Solicitado:</span>
                <span className="font-bold text-slate-900">{checkoutData.planName || `Plan ${checkoutData.planCode}`}</span>
              </div>
              <div className="flex justify-between">
                <span>Ciclo:</span>
                <span className="font-semibold text-slate-900">
                  {checkoutData.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensual'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Beneficiario:</span>
                <span className="font-semibold text-slate-900">ANTEK Dominicana SRL</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                <span className="font-bold text-slate-800">Total a Pagar:</span>
                <span className="font-black text-slate-900 font-mono">{formatDOP(checkoutData.amount)}</span>
              </div>
            </div>

            {checkoutData.isExternalLink && checkoutData.checkoutUrl?.startsWith('http') && (
              <div className="space-y-2">
                <a
                  href={checkoutData.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Ir a Pagar con Tarjeta (Link Oficial)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <div className="flex items-center gap-2 p-2.5 bg-slate-100 rounded-xl border border-slate-200">
                  <span className="font-mono text-[11px] text-slate-700 truncate flex-1">
                    {checkoutData.checkoutUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(checkoutData.checkoutUrl)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[11px] font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedLink ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}

            {bankAccounts.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-sky-600" />
                  <span>También puedes pagar por Transferencia Bancaria:</span>
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {bankAccounts.map((acc, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
                      <div className="font-bold text-slate-900">{acc.bankName}</div>
                      <div className="font-mono text-sky-700 font-bold">{acc.accountNumber}</div>
                      <div className="text-slate-500">
                        {acc.accountType} · {acc.holderName} (RNC {acc.rnc})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleOpenReceipt(checkoutData.paymentId)}
                className="px-3.5 py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Ver / Imprimir Factura</span>
              </button>

              <div className="flex items-center gap-2">
                {supportWhatsapp && (
                  <a
                    href={`https://wa.me/${supportWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Hola ANTEK, generé la orden ${checkoutData.invoiceNumber} por el Plan ${checkoutData.planCode} (${formatDOP(
                        checkoutData.amount
                      )}).`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl inline-flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setCheckoutModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
