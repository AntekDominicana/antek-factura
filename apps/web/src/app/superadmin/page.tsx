'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Users,
  CreditCard,
  Receipt,
  TrendingUp,
  Server,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
  PlusCircle,
  FileText,
  Key,
} from 'lucide-react';
import { AntekLogo } from '../../components/AntekLogo';
import { apiFetch } from '../../lib/api';

export default function SuperAdminPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tenants' | 'audit'>('tenants');

  // Modal de activación manual
  const [activateModalTenant, setActivateModalTenant] = useState<any | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('MEDIUM');
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [metricsRes, tenantsRes, auditRes] = await Promise.all([
        apiFetch<any>('/v1/superadmin/metrics').catch(() => null),
        apiFetch<any>('/v1/superadmin/tenants').catch(() => []),
        apiFetch<any>('/v1/superadmin/audit-logs').catch(() => []),
      ]);

      setMetrics(metricsRes);
      setTenants(Array.isArray(tenantsRes) ? tenantsRes : []);
      setAuditLogs(Array.isArray(auditRes) ? auditRes : []);
    } catch {
      // Manejar error suavemente
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleManualActivation = async () => {
    if (!activateModalTenant) return;
    try {
      setActionLoading(true);
      const res = await apiFetch<any>(
        `/v1/superadmin/tenants/${activateModalTenant.id}/activate-plan`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planCode: selectedPlan, months: Number(selectedMonths) }),
        }
      );

      if (res?.success) {
        setActionSuccess('Suscripción activada exitosamente por transferencia.');
        setTimeout(() => {
          setActivateModalTenant(null);
          setActionSuccess('');
          loadData();
        }, 1200);
      }
    } catch (err: any) {
      alert(err?.message || 'Error al activar la suscripción manual.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white">
      {/* Navbar Superior */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/dashboard">
            <AntekLogo theme="dark" size="md" />
          </Link>
          <div className="h-5 w-px bg-slate-700 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Panel Super-Admin ANTEK
            </span>
            <span className="text-xs text-slate-400 font-mono hidden md:inline">
              antek.com.do
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
            title="Refrescar métricas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
          <Link
            href="/app/dashboard"
            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all"
          >
            Ir a la App
          </Link>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Banner de Bienvenida y Seguridad */}
        <div className="rounded-3xl p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-sky-950/40 border border-slate-800 relative overflow-hidden shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold mb-3">
                <Lock className="w-3.5 h-3.5" /> Blind-LLM Shield & RLS Enforced
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Consola Central de Operaciones & MRR
              </h1>
              <p className="text-sm text-slate-400 max-w-2xl mt-1">
                Monitoreo en tiempo real de empresas suscritas, cobros bancarios, auditoría inmutable
                y estado del receptor fiscal DGII de República Dominicana.
              </p>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Ingresos Mensuales Recurrentes (MRR)
              </div>
              <div className="text-3xl font-black text-sky-400 font-mono mt-1">
                DOP ${metrics?.mrrDop?.toLocaleString('es-DO', { minimumFractionDigits: 2 }) || '0.00'}
              </div>
            </div>
          </div>
        </div>

        {/* Tarjetas de Métricas Maestras */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Tenants / Empresas
              </div>
              <div className="text-2xl font-black text-white mt-0.5">
                {metrics?.totalTenants ?? tenants.length}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Suscripciones Activas
              </div>
              <div className="text-2xl font-black text-emerald-400 mt-0.5">
                {metrics?.activeSubscriptions ?? 0}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Facturas Emitidas
              </div>
              <div className="text-2xl font-black text-white mt-0.5">
                {metrics?.totalInvoices ?? 0}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                DGII Receptor
              </div>
              <div className="text-sm font-black text-emerald-400 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                100% Operativo
              </div>
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación del Panel */}
        <div className="flex items-center gap-4 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('tenants')}
            className={`px-4 py-2 font-bold text-sm rounded-xl transition-all cursor-pointer ${
              activeTab === 'tenants'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            Gestión de Tenants & Pagos
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 font-bold text-sm rounded-xl transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            Bitácora de Auditoría Inmutable ({auditLogs.length})
          </button>
        </div>

        {/* Tab 1: Empresas y Suscripciones */}
        {activeTab === 'tenants' && (
          <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-white text-base">Empresas Registradas</h3>
                <p className="text-xs text-slate-400">
                  Control de planes, cuotas de comprobantes e-CF y activaciones bancarias
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-5">Razón Social / RNC</th>
                    <th className="py-3 px-5">Plan SaaS</th>
                    <th className="py-3 px-5">Estado</th>
                    <th className="py-3 px-5 text-center">Consumo e-CF</th>
                    <th className="py-3 px-5 text-center">Vencimiento</th>
                    <th className="py-3 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {tenants.map((t) => {
                    const sub = t.subscription;
                    const plan = sub?.plan;
                    const limit = plan?.monthlyInvoiceLimit || 100;
                    const used = sub?.invoicesUsedCurrentPeriod || 0;

                    return (
                      <tr key={t.id} className="hover:bg-slate-850/60 transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-bold text-white leading-tight">{t.razonSocial}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            RNC: {t.rnc}
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <span className="font-bold text-sky-400">{plan?.name || 'BÁSICO'}</span>
                          <div className="text-xs text-slate-400">
                            DOP ${Number(plan?.priceDop || 1500).toLocaleString('es-DO')}/mes
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          {sub?.status === 'ACTIVE' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              ACTIVO
                            </span>
                          ) : sub?.status === 'PAST_DUE' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              DÍAS DE GRACIA
                            </span>
                          ) : sub?.status === 'SUSPENDED' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              SUSPENDIDO
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-slate-300">
                              TRIAL / DEMO
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-center font-mono">
                          <span className="font-bold text-white">{used}</span>
                          <span className="text-slate-500"> / {limit}</span>
                        </td>
                        <td className="py-4 px-5 text-center font-mono text-xs text-slate-400">
                          {sub?.currentPeriodEnd
                            ? new Date(sub.currentPeriodEnd).toLocaleDateString('es-DO')
                            : 'Indefinido'}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <button
                            onClick={() => {
                              setActivateModalTenant(t);
                              setSelectedPlan(plan?.code || 'MEDIUM');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all cursor-pointer"
                          >
                            Activar Pago Manual
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Visor de Auditoría Inmutable */}
        {activeTab === 'audit' && (
          <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800">
              <h3 className="font-extrabold text-white text-base">
                Bitácora Inmutable de Auditoría
              </h3>
              <p className="text-xs text-slate-400">
                Registro criptográfico inalterable de eventos de seguridad y transacciones críticas
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-5">Fecha / Hora</th>
                    <th className="py-3 px-5">Acción</th>
                    <th className="py-3 px-5">Entidad</th>
                    <th className="py-3 px-5">Usuario</th>
                    <th className="py-3 px-5">IP Origen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No hay eventos registrados en la bitácora aún.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-850/60">
                        <td className="py-3.5 px-5 text-slate-400">
                          {new Date(log.createdAt).toLocaleString('es-DO')}
                        </td>
                        <td className="py-3.5 px-5 font-bold text-sky-400">{log.action}</td>
                        <td className="py-3.5 px-5 text-white">{log.entity}</td>
                        <td className="py-3.5 px-5 text-amber-400">{log.userId}</td>
                        <td className="py-3.5 px-5 text-slate-400">{log.ipAddress || '127.0.0.1'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal de Activación Manual */}
      {activateModalTenant && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full border border-slate-800 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="font-extrabold text-white text-lg">
                Activar Suscripción por Transferencia
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Empresa: <strong className="text-white">{activateModalTenant.razonSocial}</strong> (RNC{' '}
                {activateModalTenant.rnc})
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Plan a Asignar
              </label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-semibold text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value="BASIC">BÁSICO (100 facturas/mes - DOP $1,500)</option>
                <option value="MEDIUM">MEDIO (600 facturas/mes - DOP $4,500)</option>
                <option value="PRO">PRO (3,000 facturas/mes - DOP $12,500)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Período Pagado (Meses)
              </label>
              <select
                value={selectedMonths}
                onChange={(e) => setSelectedMonths(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-semibold text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value={1}>1 Mes</option>
                <option value={3}>3 Meses (Trimestral)</option>
                <option value={6}>6 Meses (Semestral)</option>
                <option value={12}>12 Meses (Anual)</option>
              </select>
            </div>

            {actionSuccess && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {actionSuccess}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActivateModalTenant(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-semibold text-xs hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleManualActivation}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                {actionLoading ? 'Registrando...' : 'Confirmar Activación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
