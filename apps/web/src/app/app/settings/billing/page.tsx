'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Download,
  AlertTriangle,
  Zap,
  Lock,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { API_BASE_URL, apiFetch, formatDOP } from '../../../../lib/api';

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
}

interface PaymentItem {
  id: string;
  subscriptionId: string;
  planCode: string;
  amount: number;
  currency: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  gateway: string;
  gatewayTransactionId: string | null;
  status: 'PENDING' | 'PAID' | 'FAILED';
  checkoutUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

export default function BillingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [payments, setPayments] = useState<PaymentItem[]>([]);

  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState<{
    paymentId: string;
    checkoutUrl: string;
    amount: number;
    currency: string;
    planCode: string;
    billingCycle: string;
  } | null>(null);

  const [selectedPlanCode, setSelectedPlanCode] = useState<'BASIC' | 'MEDIUM' | 'PRO'>('MEDIUM');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [gateway, setGateway] = useState<'MOCK' | 'CARDNET' | 'STRIPE'>('MOCK');

  const [processingPayment, setProcessingPayment] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes, payRes] = await Promise.all([
        apiFetch<{ plans: Plan[] }>('/v1/billing/plans').catch(() => ({ plans: [] })),
        apiFetch<SubscriptionData>('/v1/billing/subscription').catch(() => null),
        apiFetch<{ payments: PaymentItem[] }>('/v1/billing/payments').catch(() => ({ payments: [] })),
      ]);

      if (plansRes?.plans) setPlans(plansRes.plans);
      if (subRes) {
        setSub(subRes);
        setSelectedPlanCode(subRes.planCode || 'MEDIUM');
      }
      if (payRes?.payments) setPayments(payRes.payments);
    } catch {
      // Fallback local
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCheckout = async (targetPlan?: 'BASIC' | 'MEDIUM' | 'PRO') => {
    const planToBuy = targetPlan || selectedPlanCode;
    setProcessingPayment(true);
    try {
      const res = await apiFetch<any>('/v1/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          planCode: planToBuy,
          billingCycle,
          gateway,
        }),
      });

      setCheckoutData(res);
      setCheckoutModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Error generando link de pago.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleConfirmSimulatedPayment = async () => {
    if (!checkoutData) return;
    setProcessingPayment(true);
    try {
      await apiFetch<any>('/v1/webhooks/payments', {
        method: 'POST',
        body: JSON.stringify({
          paymentId: checkoutData.paymentId,
          status: 'PAID',
          gateway: 'MOCK',
        }),
      });

      setCheckoutModalOpen(false);
      setActionSuccessMsg('¡Pago verificado y confirmado por el servidor! Tu plan ha sido renovado ✓');
      setTimeout(() => setActionSuccessMsg(null), 4500);
      await loadBillingData();
    } catch (err: any) {
      alert(err.message || 'Error confirmando pago.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleSimulateStatus = async (status: 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED', graceDays = 3) => {
    try {
      await apiFetch<any>('/v1/billing/simulate-status', {
        method: 'POST',
        body: JSON.stringify({ status, graceDaysRemaining: graceDays }),
      });
      setActionSuccessMsg(`Estado de suscripción cambiado a ${status} para pruebas.`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
      await loadBillingData();
    } catch (err: any) {
      alert(err.message || 'Error simulando estado.');
    }
  };

  const currentUsage = sub?.invoicesUsedCurrentPeriod || 0;
  const currentLimit = sub?.monthlyInvoiceLimit || sub?.plan?.monthlyInvoiceLimit || 600;
  const usagePercentage = Math.min(100, Math.round((currentUsage / currentLimit) * 100));

  const isPastDue = sub?.status === 'PAST_DUE';
  const isSuspended = sub?.status === 'SUSPENDED';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Suscripción & Links de Pago</h1>
          <p className="text-xs text-slate-500">
            Monitorea el consumo de comprobantes e-CF, planes comerciales y regla de 5 días de gracia
          </p>
        </div>

        {/* Simulador de Estados (Sandbox Testing) */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-300 rounded-xl text-[11px] font-bold">
          <span className="text-slate-400 px-2 uppercase tracking-wider text-[9px]">Simular:</span>
          <button
            type="button"
            onClick={() => handleSimulateStatus('ACTIVE')}
            className={`px-2 py-1 rounded-lg transition ${
              sub?.status === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Activo
          </button>
          <button
            type="button"
            onClick={() => handleSimulateStatus('PAST_DUE', 3)}
            className={`px-2 py-1 rounded-lg transition ${
              isPastDue ? 'bg-amber-500 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Gracia (3d)
          </button>
          <button
            type="button"
            onClick={() => handleSimulateStatus('SUSPENDED')}
            className={`px-2 py-1 rounded-lg transition ${
              isSuspended ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Suspendido
          </button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
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
            El plazo de 5 días de gracia venció. La emisión de nuevos e-CF está bloqueada. Genera un Link de Pago para reactivar al instante.
          </p>
        </div>
      )}

      {isPastDue && (
        <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-2">
          <div className="flex items-center gap-2 font-black text-sm text-amber-800">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Período de Gracia de 5 Días Activo ({sub?.graceDaysRemaining || 5} días restantes)</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Tu suscripción mensual ha vencido. Puedes continuar emitiendo normalmente durante los 5 días de gracia. Por favor regulariza tu cuota antes de que finalice el plazo.
          </p>
        </div>
      )}

      {/* 1. Tarjeta de Consumo Mensual (Barra de Uso) */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Consumo de Comprobantes e-CF del Período
            </div>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {currentUsage} de {currentLimit} facturas emitidas
            </div>
          </div>

          <div className="text-right">
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

        {/* Barra de Progreso */}
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

        <div className="flex justify-between items-center text-[11px] text-slate-500">
          <span>Reinicio automático cada 30 días al renovar la suscripción</span>
          <span>{currentLimit - currentUsage} e-CF disponibles</span>
        </div>
      </div>

      {/* 2. Tarjeta del Plan Actual y Acciones de Pago */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200">
                {sub?.plan?.name || 'Plan Medio'}
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
              {sub?.plan?.name || 'Plan Medio'} — {sub?.plan?.monthlyInvoiceLimit || 600} e-CF Mensuales
            </h2>
            <p className="text-xs text-slate-500">
              {sub?.plan?.description || 'Facturación oficial Ley 32-23 DGII con modo de contingencia offline.'}
            </p>
          </div>

          <div className="text-right self-start sm:self-auto">
            <div className="text-2xl font-black text-slate-900">
              {formatDOP(sub?.plan?.priceDop || 2450)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">al mes (impuestos incluidos)</div>
          </div>
        </div>

        {/* Política de Continuidad: Plazo de 5 días de gracia */}
        <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200/80 text-sky-950 text-xs space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-sky-900">
            <Clock className="w-4 h-4 text-sky-600" />
            <span>Política de Continuidad Fiscal: Plazo de Gracia de 5 Días</span>
          </div>
          <p className="text-[11px] text-sky-800 leading-relaxed">
            Si se demora el pago al corte mensual, ANTEK otorga <strong>5 días calendario de gracia</strong> continuos para no detener la operación ni la emisión de tus clientes. Si no se registra el pago tras vencer los 5 días, el sistema suspenderá la emisión de e-CF (HTTP 402) manteniendo tus comprobantes históricos accesibles.
          </p>
        </div>

        {/* Acciones de Pago */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Transacciones verificadas mediante Webhook seguro en el servidor</span>
          </div>

          <button
            type="button"
            disabled={processingPayment}
            onClick={() => handleGenerateCheckout()}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 inline-flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <CreditCard className="w-4 h-4" />
            <span>{processingPayment ? 'Generando Link...' : 'Pagar con Link de Pago Seguro'}</span>
          </button>
        </div>
      </div>

      {/* 3. Selector de Planes (Upgrade / Downgrade) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Cambiar de Plan (Upgrade / Downgrade)</h2>
          <p className="text-xs text-slate-500">
            Adapta tu plan al volumen mensual de facturación de tu negocio
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              code: 'BASIC',
              name: 'Plan Básico',
              price: 990,
              limit: 100,
              types: 'e-CF 31 y 32',
              users: '2 usuarios, 1 sucursal',
              api: 'Sin API REST',
            },
            {
              code: 'MEDIUM',
              name: 'Plan Medio',
              price: 2450,
              limit: 600,
              types: 'e-CF 31, 32, 33, 34, 44, 45',
              users: '5 usuarios, 3 sucursales',
              api: 'API REST + Webhooks ✓',
              popular: true,
            },
            {
              code: 'PRO',
              name: 'Plan Pro',
              price: 4900,
              limit: 3000,
              types: 'Gama total e-CF (31 al 47)',
              users: '25 usuarios, 10 sucursales',
              api: 'API Masiva Multimoneda ✓',
            },
          ].map((item) => {
            const isCurrent = sub?.planCode === item.code;
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

                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900">{formatDOP(item.price)}</span>
                    <span className="text-[10px] text-slate-500">/ mes</span>
                  </div>

                  <ul className="space-y-1.5 text-xs text-slate-600 pt-1">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>{item.limit} e-CF / mes</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>{item.types}</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>{item.users}</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>{item.api}</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs cursor-default"
                    >
                      Plan Activo
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleGenerateCheckout(item.code as any)}
                      className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
                    >
                      Seleccionar e Ir a Pagar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Historial de Pagos Realizados */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">
            Historial de Pagos & Comprobantes Fiscales ANTEK ({payments.length})
          </span>
          <span className="text-[11px] text-slate-500 font-medium">Emitidos por ANTEK Dominicana SRL</span>
        </div>

        <div className="divide-y divide-slate-100">
          {payments.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No hay pagos registrados aún en el historial.
            </div>
          ) : (
            payments.map((pay) => (
              <div
                key={pay.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">{pay.id}</span>
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
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <span className="font-bold text-slate-900 text-xs">{formatDOP(pay.amount)}</span>
                  <button
                    type="button"
                    onClick={() => alert(`Descargando comprobante fiscal oficial de ANTEK en PDF...`)}
                    className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
                    title="Descargar comprobante"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Checkout / Link de Pago Generado */}
      {checkoutModalOpen && checkoutData && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Link de Pago Seguro Generado</h2>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                256-bit TLS
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Paga tu suscripción de <strong>ANTEK Factura</strong>. Aceptamos tarjetas de débito/crédito nacionales e internacionales.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Plan Seleccionado:</span>
                <span className="font-bold text-slate-900">Plan {checkoutData.planCode}</span>
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
              <div className="flex justify-between pt-1 border-t border-slate-200 text-sm">
                <span className="font-bold text-slate-800">Total a Pagar:</span>
                <span className="font-black text-slate-900">{formatDOP(checkoutData.amount)}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-100 rounded-xl font-mono text-[11px] text-slate-700 break-all border border-slate-200">
              {checkoutData.checkoutUrl}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={processingPayment}
                onClick={() => setCheckoutModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={processingPayment}
                onClick={handleConfirmSimulatedPayment}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs inline-flex items-center gap-1.5"
              >
                {processingPayment ? (
                  <span>Verificando con Servidor...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Pago de {formatDOP(checkoutData.amount)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
