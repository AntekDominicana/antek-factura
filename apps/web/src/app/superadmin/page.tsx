'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  CreditCard,
  Receipt,
  Server,
  Lock,
  CheckCircle2,
  RefreshCw,
  Search,
  ExternalLink,
  Landmark,
  Send,
  Settings2,
  FileText,
  Sliders,
  Plus,
  Trash2,
  AlertTriangle,
  LayoutDashboard,
  Clock,
} from 'lucide-react';
import { AntekLogo } from '../../components/AntekLogo';
import { apiFetch, formatDOP } from '../../lib/api';

interface PlanConfig {
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

export default function SuperAdminPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tenants' | 'plans' | 'payments' | 'audit'>('tenants');
  const [searchTenant, setSearchTenant] = useState('');

  // Modal Enviar Factura / Link de Pago
  const [invoiceModalTenant, setInvoiceModalTenant] = useState<any | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    planCode: 'MEDIUM',
    billingCycle: 'MONTHLY' as 'MONTHLY' | 'ANNUAL',
    amount: 2450,
    invoiceNumber: '',
    checkoutUrl: '',
    status: 'PENDING' as 'PENDING' | 'PAID',
    months: 1,
    adminNote: '',
  });

  // Modal Activación / Estado / Cuota
  const [activateModalTenant, setActivateModalTenant] = useState<any | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('MEDIUM');
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<'ACTIVE' | 'PAST_DUE' | 'SUSPENDED'>('ACTIVE');
  const [extraQuota, setExtraQuota] = useState(0);

  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [metricsRes, tenantsRes, plansRes, settingsRes, auditRes] = await Promise.all([
        apiFetch<any>('/v1/superadmin/metrics'),
        apiFetch<any>('/v1/superadmin/tenants'),
        apiFetch<any>('/v1/superadmin/plans'),
        apiFetch<any>('/v1/superadmin/payment-settings'),
        apiFetch<any>('/v1/superadmin/audit-logs'),
      ]);

      setMetrics(metricsRes);
      setTenants(Array.isArray(tenantsRes) ? tenantsRes : []);
      setPlans(Array.isArray(plansRes?.plans) ? plansRes.plans : []);
      setPaymentSettings(settingsRes || null);
      setAuditLogs(Array.isArray(auditRes) ? auditRes : []);
    } catch (err: any) {
      const raw = String(err?.message || '');
      const isNetwork = /failed to fetch|network|timeout|abort/i.test(raw);
      setErrorMsg(
        isNetwork
          ? 'No pudimos cargar los datos. Verifica tu conexión o sesión e inténtalo de nuevo.'
          : raw || 'No pudimos cargar los datos de la consola Super-Admin.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openInvoiceLinkModal = (t: any) => {
    const sub = t.subscription;
    const reqPlan =
      sub?.externalCustomerId?.startsWith('REQ:') ? sub.externalCustomerId.split(':')[1] : null;
    const reqCycle =
      sub?.externalCustomerId?.startsWith('REQ:') && sub.externalCustomerId.split(':')[2] === 'ANNUAL'
        ? 'ANNUAL'
        : 'MONTHLY';
    const targetCode = reqPlan || sub?.plan?.code || 'MEDIUM';
    const matchingPlan = plans.find((p) => p.code === targetCode) || plans[0];
    const basePrice = Number(matchingPlan?.priceDop || 2450);
    const defaultAmount = reqCycle === 'ANNUAL' ? Math.round(basePrice * 10.2) : basePrice;
    const defaultUrl =
      (reqCycle === 'ANNUAL' ? matchingPlan?.paymentLinkAnnual : matchingPlan?.paymentLinkMonthly) ||
      paymentSettings?.generalPaymentLink ||
      '';

    setInvoiceModalTenant(t);
    setInvoiceForm({
      planCode: targetCode,
      billingCycle: reqCycle,
      amount: defaultAmount,
      invoiceNumber: `FAC-ANTEK-${Date.now().toString().slice(-6)}`,
      checkoutUrl: defaultUrl,
      status: 'PENDING',
      months: reqCycle === 'ANNUAL' ? 12 : 1,
      adminNote: '',
    });
  };

  const handlePlanOrCycleChangeInInvoiceModal = (planCode: string, billingCycle: 'MONTHLY' | 'ANNUAL') => {
    const matchingPlan = plans.find((p) => p.code === planCode);
    const basePrice = Number(matchingPlan?.priceDop || 2450);
    const calcAmount = billingCycle === 'ANNUAL' ? Math.round(basePrice * 10.2) : basePrice;
    const presetLink =
      (billingCycle === 'ANNUAL' ? matchingPlan?.paymentLinkAnnual : matchingPlan?.paymentLinkMonthly) ||
      paymentSettings?.generalPaymentLink ||
      invoiceForm.checkoutUrl;

    setInvoiceForm((prev) => ({
      ...prev,
      planCode,
      billingCycle,
      amount: calcAmount,
      months: billingCycle === 'ANNUAL' ? 12 : 1,
      checkoutUrl: presetLink,
    }));
  };

  const handleSendInvoiceLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceModalTenant) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await apiFetch<any>(
        `/v1/superadmin/tenants/${invoiceModalTenant.id}/send-invoice-link`,
        {
          method: 'POST',
          body: JSON.stringify({
            planCode: invoiceForm.planCode,
            billingCycle: invoiceForm.billingCycle,
            amount: Number(invoiceForm.amount),
            invoiceNumber: invoiceForm.invoiceNumber.trim() || undefined,
            checkoutUrl: invoiceForm.checkoutUrl.trim() || undefined,
            status: invoiceForm.status,
            months: Number(invoiceForm.months),
            adminNote: invoiceForm.adminNote.trim() || undefined,
          }),
        }
      );

      setInvoiceModalTenant(null);
      showToast(res?.message || 'Factura y link de pago enviados al cliente ✓');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al enviar la factura y el link de pago.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualActivation = async () => {
    if (!activateModalTenant) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await apiFetch<any>(`/v1/superadmin/tenants/${activateModalTenant.id}/activate-plan`, {
        method: 'POST',
        body: JSON.stringify({
          planCode: selectedPlan,
          months: Number(selectedMonths),
          status: selectedStatus,
        }),
      });

      if (extraQuota > 0) {
        await apiFetch<any>(`/v1/superadmin/tenants/${activateModalTenant.id}/adjust-quota`, {
          method: 'POST',
          body: JSON.stringify({ additionalQuota: Number(extraQuota) }),
        });
      }

      setActivateModalTenant(null);
      setExtraQuota(0);
      showToast('Suscripción y estado del cliente actualizados en Supabase ✓');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al actualizar la suscripción.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSavePlan = async (plan: PlanConfig) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await apiFetch<any>(`/v1/superadmin/plans/${plan.code}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: plan.name,
          description: plan.description,
          priceDop: Number(plan.priceDop),
          priceUsd: Number(plan.priceUsd),
          monthlyInvoiceLimit: Number(plan.monthlyInvoiceLimit),
          maxUsers: Number(plan.maxUsers),
          maxBranches: Number(plan.maxBranches),
          apiAccess: Boolean(plan.apiAccess),
          paymentLinkMonthly: plan.paymentLinkMonthly || '',
          paymentLinkAnnual: plan.paymentLinkAnnual || '',
        }),
      });
      showToast(`Plan ${plan.name} actualizado en vivo para toda la plataforma ✓`);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || `Error al actualizar el plan ${plan.code}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSettings) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await apiFetch<any>('/v1/superadmin/payment-settings', {
        method: 'PUT',
        body: JSON.stringify(paymentSettings),
      });
      showToast('Métodos de pago, links y cuentas bancarias actualizados ✓');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar la configuración de pagos.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddBankAccount = () => {
    setPaymentSettings((prev: any) => ({
      ...prev,
      bankAccounts: [
        ...(prev?.bankAccounts || []),
        {
          bankName: '',
          accountNumber: '',
          accountType: 'Corriente DOP',
          holderName: 'ANTEK Dominicana SRL',
          rnc: '131880738',
        },
      ],
    }));
  };

  const handleRemoveBankAccount = (idx: number) => {
    setPaymentSettings((prev: any) => ({
      ...prev,
      bankAccounts: (prev?.bankAccounts || []).filter((_: any, i: number) => i !== idx),
    }));
  };

  const filteredTenants = tenants.filter((t) => {
    const q = searchTenant.trim().toLowerCase();
    if (!q) return true;
    return (
      String(t.razonSocial || '').toLowerCase().includes(q) ||
      String(t.rnc || '').toLowerCase().includes(q) ||
      String(t.correo || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white">
      {/* Navbar Responsiva Root Admin */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-40 px-3.5 sm:px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <Link href="/superadmin" className="shrink-0">
            <div className="sm:hidden">
              <AntekLogo theme="dark" size="sm" variant="mark" />
            </div>
            <div className="hidden sm:block">
              <AntekLogo theme="dark" size="md" />
            </div>
          </Link>
          <div className="h-5 w-px bg-slate-700 hidden sm:block" />
          <div className="min-w-0">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-block truncate">
              Consola Root Admin
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {tenants.length > 0 && (
            <button
              type="button"
              onClick={() => openInvoiceLinkModal(tenants[0])}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enviar Link de Pago</span>
            </button>
          )}
          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
          <Link
            href="/app/dashboard"
            className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden xs:inline sm:inline">Portal App</span>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-semibold flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-100 font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Reintentar
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Banner MRR */}
        <div className="rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/50 border border-slate-800 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-bold mb-2">
                <Lock className="w-3.5 h-3.5" /> Control Maestro Root · Precios, Pagos y Clientes
              </div>
              <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                Administración Central de ANTEK Factura
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mt-1">
                Gestiona precios de planes, links y métodos de pago, y envía nuevas facturas o links de cobro directamente a tus clientes.
              </p>
            </div>

            <div className="text-left md:text-right shrink-0">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Ingresos Mensuales Activos (MRR)
              </div>
              <div className="text-2xl sm:text-3xl font-black text-sky-400 font-mono mt-0.5">
                {loading && !metrics ? (
                  <span className="inline-block w-36 h-8 skeleton align-middle" />
                ) : (
                  formatDOP(metrics?.mrrDop)
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tarjetas Métricas Reales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20 shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase">Empresas</div>
              <div className="text-xl sm:text-2xl font-black text-white">{metrics?.totalTenants ?? tenants.length}</div>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase">Activas / Pend.</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400">
                {metrics?.activeSubscriptions ?? 0}
                <span className="text-xs text-amber-400 font-mono ml-1.5">
                  ({metrics?.pendingPaymentsCount ?? 0} pend.)
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
              <Receipt className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase">e-CF Emitidos</div>
              <div className="text-xl sm:text-2xl font-black text-white">{metrics?.totalInvoices ?? 0}</div>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
              <Server className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase">Compras 606</div>
              <div className="text-xl sm:text-2xl font-black text-white">{metrics?.totalPurchases606 ?? 0}</div>
            </div>
          </div>
        </div>

        {/* Pestañas Responsivas */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
          {[
            { id: 'tenants', label: 'Clientes & Facturas/Links', icon: Users },
            { id: 'plans', label: 'Planes y Precios', icon: Sliders },
            { id: 'payments', label: 'Métodos y Links de Pago', icon: Landmark },
            { id: 'audit', label: `Auditoría (${auditLogs.length})`, icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: CLIENTES Y ENVÍO DE FACTURAS / LINKS */}
        {activeTab === 'tenants' && (
          <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-white text-base">Empresas Registradas ({filteredTenants.length})</h3>
                <p className="text-xs text-slate-400">
                  Envía facturas o links de pago a clientes, aprueba transferencias y monitorea solicitudes de cambio de plan.
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por empresa, RNC o correo..."
                  value={searchTenant}
                  onChange={(e) => setSearchTenant(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-sky-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Empresa / RNC / Correo</th>
                    <th className="py-3 px-4">Plan &amp; Solicitud</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-center">Consumo</th>
                    <th className="py-3 px-4 text-right">Acciones Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredTenants.map((t) => {
                    const sub = t.subscription;
                    const plan = sub?.plan;
                    const limit = plan?.monthlyInvoiceLimit || 100;
                    const used = sub?.invoicesUsedCurrentPeriod || 0;
                    const pendingPayments = (sub?.payments || []).filter((p: any) => p.status === 'PENDING');
                    const requestedChange = sub?.externalCustomerId?.startsWith('REQ:')
                      ? sub.externalCustomerId.replace('REQ:', '').replace(':', ' ')
                      : null;

                    return (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-bold text-white leading-tight">{t.razonSocial}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            RNC: {t.rnc} · {t.correo}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-bold text-sky-400">{plan?.name || 'Sin Plan'}</span>
                          <div className="text-[11px] text-slate-400">
                            {formatDOP(Number(plan?.priceDop || 0))}/mes
                          </div>
                          {(requestedChange || pendingPayments.length > 0) && (
                            <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              <Clock className="w-3 h-3" />
                              {requestedChange ? `Solicitó: ${requestedChange}` : 'Pago pendiente'}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {sub?.status === 'ACTIVE' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              ACTIVO
                            </span>
                          ) : sub?.status === 'PAST_DUE' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              EN GRACIA
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              {sub?.status || 'SUSPENDIDO'}
                            </span>
                          )}
                          <div className="text-[10px] text-slate-500 font-mono mt-1">
                            Vence:{' '}
                            {sub?.currentPeriodEnd
                              ? new Date(sub.currentPeriodEnd).toLocaleDateString('es-DO')
                              : '—'}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center font-mono text-xs">
                          <span className="font-bold text-white">{used}</span>
                          <span className="text-slate-500"> / {limit}</span>
                          <div className="text-[10px] text-slate-500">
                            {t._count?.invoices || 0} fac · {t._count?.receivedPurchases || 0} 606
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openInvoiceLinkModal(t)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Enviar Factura / Link</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActivateModalTenant(t);
                                setSelectedPlan(plan?.code || 'MEDIUM');
                                setSelectedStatus(
                                  sub?.status === 'PAST_DUE' || sub?.status === 'SUSPENDED'
                                    ? sub.status
                                    : 'ACTIVE'
                                );
                              }}
                              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                              <span>Activar / Estado</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: GESTOR DE PLANES Y PRECIOS */}
        {activeTab === 'plans' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {plans.map((plan) => (
              <div
                key={plan.code}
                className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30 font-mono font-bold">
                      {plan.code}
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-slate-300 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={plan.apiAccess}
                        onChange={(e) =>
                          setPlans((prev) =>
                            prev.map((p) => (p.code === plan.code ? { ...p, apiAccess: e.target.checked } : p))
                          )
                        }
                      />
                      API REST
                    </label>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Nombre del Plan</label>
                    <input
                      type="text"
                      value={plan.name}
                      onChange={(e) =>
                        setPlans((prev) =>
                          prev.map((p) => (p.code === plan.code ? { ...p, name: e.target.value } : p))
                        )
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Descripción</label>
                    <textarea
                      rows={2}
                      value={plan.description}
                      onChange={(e) =>
                        setPlans((prev) =>
                          prev.map((p) => (p.code === plan.code ? { ...p, description: e.target.value } : p))
                        )
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Precio DOP</label>
                      <input
                        type="number"
                        value={plan.priceDop}
                        onChange={(e) =>
                          setPlans((prev) =>
                            prev.map((p) =>
                              p.code === plan.code ? { ...p, priceDop: Number(e.target.value) } : p
                            )
                          )
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Precio USD</label>
                      <input
                        type="number"
                        value={plan.priceUsd}
                        onChange={(e) =>
                          setPlans((prev) =>
                            prev.map((p) =>
                              p.code === plan.code ? { ...p, priceUsd: Number(e.target.value) } : p
                            )
                          )
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">e-CF/mes</label>
                      <input
                        type="number"
                        value={plan.monthlyInvoiceLimit}
                        onChange={(e) =>
                          setPlans((prev) =>
                            prev.map((p) =>
                              p.code === plan.code
                                ? { ...p, monthlyInvoiceLimit: Number(e.target.value) }
                                : p
                            )
                          )
                        }
                        className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Usuarios</label>
                      <input
                        type="number"
                        value={plan.maxUsers}
                        onChange={(e) =>
                          setPlans((prev) =>
                            prev.map((p) =>
                              p.code === plan.code ? { ...p, maxUsers: Number(e.target.value) } : p
                            )
                          )
                        }
                        className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Sucursales</label>
                      <input
                        type="number"
                        value={plan.maxBranches}
                        onChange={(e) =>
                          setPlans((prev) =>
                            prev.map((p) =>
                              p.code === plan.code ? { ...p, maxBranches: Number(e.target.value) } : p
                            )
                          )
                        }
                        className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Link de Pago Mensual</label>
                    <input
                      type="url"
                      placeholder="https://checkout.cardnet.com.do/..."
                      value={plan.paymentLinkMonthly || ''}
                      onChange={(e) =>
                        setPlans((prev) =>
                          prev.map((p) =>
                            p.code === plan.code ? { ...p, paymentLinkMonthly: e.target.value } : p
                          )
                        )
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sky-300 font-mono text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Link de Pago Anual</label>
                    <input
                      type="url"
                      placeholder="https://checkout.cardnet.com.do/..."
                      value={plan.paymentLinkAnnual || ''}
                      onChange={(e) =>
                        setPlans((prev) =>
                          prev.map((p) =>
                            p.code === plan.code ? { ...p, paymentLinkAnnual: e.target.value } : p
                          )
                        )
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sky-300 font-mono text-[11px]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleSavePlan(plan)}
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  Guardar Cambios de {plan.name}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: MÉTODOS DE PAGO, LINKS Y CUENTAS BANCARIAS */}
        {activeTab === 'payments' && paymentSettings && (
          <form
            onSubmit={handleSavePaymentSettings}
            className="bg-slate-900 rounded-3xl border border-slate-800 p-5 sm:p-6 space-y-6 text-xs"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Pasarela Principal Activa</label>
                <select
                  value={paymentSettings.activeGateway || 'CARDNET'}
                  onChange={(e) =>
                    setPaymentSettings({ ...paymentSettings, activeGateway: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold"
                >
                  <option value="CARDNET">CardNet República Dominicana</option>
                  <option value="AZUL">Azul (Banco Popular)</option>
                  <option value="STRIPE">Stripe Internacional</option>
                  <option value="PAYPAL">PayPal</option>
                  <option value="TRANSFERENCIA">Transferencia Bancaria Directa</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Link de Pago General (Respaldo / Checkout Principal)
                </label>
                <input
                  type="url"
                  value={paymentSettings.generalPaymentLink || ''}
                  onChange={(e) =>
                    setPaymentSettings({ ...paymentSettings, generalPaymentLink: e.target.value })
                  }
                  placeholder="https://pagos.tudominio.com/checkout"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sky-300 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">WhatsApp de Cobros / Soporte</label>
                <input
                  type="text"
                  value={paymentSettings.supportWhatsapp || ''}
                  onChange={(e) =>
                    setPaymentSettings({ ...paymentSettings, supportWhatsapp: e.target.value })
                  }
                  placeholder="18095550199"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Correo de Facturación</label>
                <input
                  type="email"
                  value={paymentSettings.supportEmail || ''}
                  onChange={(e) =>
                    setPaymentSettings({ ...paymentSettings, supportEmail: e.target.value })
                  }
                  placeholder="facturacion@antek.com.do"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-bold text-slate-300 mb-1">Instrucciones visibles al cliente</label>
                <textarea
                  rows={2}
                  value={paymentSettings.instructions || ''}
                  onChange={(e) =>
                    setPaymentSettings({ ...paymentSettings, instructions: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-sky-400" />
                  Cuentas Bancarias Oficiales
                </h3>
                <button
                  type="button"
                  onClick={handleAddBankAccount}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Cuenta
                </button>
              </div>

              <div className="space-y-3">
                {(paymentSettings.bankAccounts || []).map((acc: BankAccount, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end"
                  >
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Banco</label>
                      <input
                        type="text"
                        value={acc.bankName}
                        onChange={(e) => {
                          const next = [...paymentSettings.bankAccounts];
                          next[idx] = { ...next[idx], bankName: e.target.value };
                          setPaymentSettings({ ...paymentSettings, bankAccounts: next });
                        }}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">No. Cuenta</label>
                      <input
                        type="text"
                        value={acc.accountNumber}
                        onChange={(e) => {
                          const next = [...paymentSettings.bankAccounts];
                          next[idx] = { ...next[idx], accountNumber: e.target.value };
                          setPaymentSettings({ ...paymentSettings, bankAccounts: next });
                        }}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sky-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Tipo</label>
                      <input
                        type="text"
                        value={acc.accountType}
                        onChange={(e) => {
                          const next = [...paymentSettings.bankAccounts];
                          next[idx] = { ...next[idx], accountType: e.target.value };
                          setPaymentSettings({ ...paymentSettings, bankAccounts: next });
                        }}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Titular / RNC</label>
                      <input
                        type="text"
                        value={acc.holderName}
                        onChange={(e) => {
                          const next = [...paymentSettings.bankAccounts];
                          next[idx] = { ...next[idx], holderName: e.target.value };
                          setPaymentSettings({ ...paymentSettings, bankAccounts: next });
                        }}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={acc.rnc}
                        onChange={(e) => {
                          const next = [...paymentSettings.bankAccounts];
                          next[idx] = { ...next[idx], rnc: e.target.value };
                          setPaymentSettings({ ...paymentSettings, bankAccounts: next });
                        }}
                        placeholder="RNC"
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveBankAccount(idx)}
                        className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg cursor-pointer disabled:opacity-50"
              >
                Guardar Configuración Global de Pagos
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: AUDITORÍA */}
        {activeTab === 'audit' && (
          <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800">
              <h3 className="font-extrabold text-white text-base">Bitácora Inmutable de Auditoría</h3>
              <p className="text-xs text-slate-400">
                Eventos de cambios de plan, emisión de facturas y configuración administrativa.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Acción</th>
                    <th className="py-3 px-4">Entidad</th>
                    <th className="py-3 px-4">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        No hay eventos registrados aún.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(log.createdAt).toLocaleString('es-DO')}
                        </td>
                        <td className="py-3 px-4 font-bold text-sky-400">{log.action}</td>
                        <td className="py-3 px-4 text-white">{log.entity}</td>
                        <td className="py-3 px-4 text-amber-300">{log.userId || log.tenantId || 'SYSTEM'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL ENVIAR FACTURA Y LINK DE PAGO AL CLIENTE */}
      {invoiceModalTenant && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSendInvoiceLink}
            className="bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-800 shadow-2xl p-6 space-y-4 my-auto text-xs"
          >
            <div>
              <h3 className="font-black text-white text-lg">Enviar Factura / Link de Pago al Cliente</h3>
              <div className="mt-2">
                <label className="block font-bold text-slate-300 mb-1">Seleccionar Cliente / Empresa</label>
                <select
                  value={invoiceModalTenant.id}
                  onChange={(e) => {
                    const found = tenants.find((item) => item.id === e.target.value);
                    if (found) openInvoiceLinkModal(found);
                  }}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold"
                >
                  {tenants.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.razonSocial} (RNC {item.rnc}) — {item.correo}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Plan</label>
                <select
                  value={invoiceForm.planCode}
                  onChange={(e) =>
                    handlePlanOrCycleChangeInInvoiceModal(e.target.value, invoiceForm.billingCycle)
                  }
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold"
                >
                  {plans.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name} ({formatDOP(p.priceDop)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Ciclo</label>
                <select
                  value={invoiceForm.billingCycle}
                  onChange={(e) =>
                    handlePlanOrCycleChangeInInvoiceModal(
                      invoiceForm.planCode,
                      e.target.value as 'MONTHLY' | 'ANNUAL'
                    )
                  }
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold"
                >
                  <option value="MONTHLY">Mensual</option>
                  <option value="ANNUAL">Anual (12 meses)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Monto DOP</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">N° Factura / Orden</label>
                <input
                  type="text"
                  value={invoiceForm.invoiceNumber}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Estado</label>
                <select
                  value={invoiceForm.status}
                  onChange={(e) =>
                    setInvoiceForm({ ...invoiceForm, status: e.target.value as 'PENDING' | 'PAID' })
                  }
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold"
                >
                  <option value="PENDING">Pendiente (Cobrar)</option>
                  <option value="PAID">Pagada (Activar Ya)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Link de Pago Directo para este Cliente
              </label>
              <input
                type="url"
                value={invoiceForm.checkoutUrl}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, checkoutUrl: e.target.value })}
                placeholder="https://checkout.cardnet.com.do/..."
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sky-300 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Nota para el Cliente (opcional)</label>
              <textarea
                rows={2}
                value={invoiceForm.adminNote}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, adminNote: e.target.value })}
                placeholder="Ej. Link de pago para actualización a Plan Pro con vencimiento en 5 días."
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setInvoiceModalTenant(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{actionLoading ? 'Enviando...' : 'Enviar al Cliente'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL ACTIVACIÓN / ESTADO / CUOTA */}
      {activateModalTenant && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full border border-slate-800 shadow-2xl p-6 space-y-4 text-xs">
            <div>
              <h3 className="font-extrabold text-white text-lg">Gestionar Suscripción y Cuota</h3>
              <p className="text-slate-400 mt-1">
                Empresa: <strong className="text-white">{activateModalTenant.razonSocial}</strong> (RNC{' '}
                {activateModalTenant.rnc})
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Plan Asignado</label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold"
              >
                {plans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} ({p.monthlyInvoiceLimit} fac/mes - {formatDOP(p.priceDop)})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Estado</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold"
                >
                  <option value="ACTIVE">ACTIVO</option>
                  <option value="PAST_DUE">EN GRACIA (5d)</option>
                  <option value="SUSPENDED">SUSPENDIDO</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Vigencia (Meses)</label>
                <select
                  value={selectedMonths}
                  onChange={(e) => setSelectedMonths(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold"
                >
                  <option value={1}>1 Mes</option>
                  <option value={3}>3 Meses</option>
                  <option value={6}>6 Meses</option>
                  <option value={12}>12 Meses</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Bonificación adicional de e-CF este mes (opcional)
              </label>
              <input
                type="number"
                min={0}
                value={extraQuota}
                onChange={(e) => setExtraQuota(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActivateModalTenant(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleManualActivation}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Guardando...' : 'Aplicar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
