'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '../../../context/AppContext';
import { API_BASE_URL, apiFetch, formatDOP } from '../../../lib/api';
import {
  DollarSign,
  Receipt,
  ShieldCheck,
  TrendingUp,
  FilePlus2,
  FileSpreadsheet,
  QrCode,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Sparkles,
  Package,
  Users,
} from 'lucide-react';

export default function DashboardPage() {
  const { tenant } = useApp();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [subData, setSubData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [invData, purData, subRes] = await Promise.all([
          apiFetch<any[]>('/v1/invoices').catch(() => []),
          apiFetch<any>('/v1/purchases').catch(() => ({ purchases: [] })),
          apiFetch<any>('/v1/billing/subscription').catch(() => null),
        ]);

        if (Array.isArray(invData)) setInvoices(invData);
        if (Array.isArray(purData?.purchases)) setPurchases(purData.purchases);
        else if (Array.isArray(purData)) setPurchases(purData);
        if (subRes) setSubData(subRes);
      } catch (err) {
        console.warn('Error loading dashboard', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  // Métricas reales calculadas de comprobantes emitidos
  const totalInvoices = invoices.length;
  const totalVentas = invoices.reduce((sum, inv) => sum + (Number(inv.totales?.montoTotal) || 0), 0);
  const totalItbis = invoices.reduce((sum, inv) => sum + (Number(inv.totales?.totalItbis) || 0), 0);

  // Métricas reales calculadas de gastos 606 QR
  const expenses606Count = purchases.length;
  const expenses606Total = purchases.reduce((sum, p) => sum + (Number(p.montoTotal) || 0), 0);

  const step1Done = totalInvoices > 0;
  const step2Done = Boolean(tenant?.logoBase64);
  const step3Done = expenses606Count > 0;
  const onboardingDoneCount = [step1Done, step2Done, step3Done].filter(Boolean).length;

  const daysLeft = (() => {
    const endIso = subData?.graceEndsAt || subData?.trialEndsAt || subData?.currentPeriodEnd;
    if (!endIso) return 5;
    const diff = Math.ceil((new Date(endIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  })();

  const MiniSparkline = ({ active }: { active: boolean }) => (
    <svg viewBox="0 0 120 26" className="w-full h-6 overflow-visible" aria-hidden="true">
      <path
        d={
          active
            ? 'M2 22 C 20 20, 32 14, 48 16 C 64 18, 78 8, 95 10 C 106 11, 114 5, 118 4'
            : 'M2 20 L 26 20 L 44 17 L 64 20 L 88 18 L 118 20'
        }
        fill="none"
        stroke={active ? '#0ea5e9' : '#cbd5e1'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={active ? undefined : '4 4'}
      />
    </svg>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Resumen Ejecutivo</h1>
          <p className="text-xs text-slate-500">
            {tenant?.razonSocial || 'Tu Empresa'} · RNC: <span className="font-mono font-semibold">{tenant?.rnc || 'Pendiente'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/app/purchases?scan=1"
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition btn-fx"
          >
            <QrCode className="w-4 h-4 text-sky-400" />
            <span>Escanear Factura 606</span>
          </Link>
          <Link
            href="/app/reports"
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 shadow-xs flex items-center gap-1.5 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Libro Contable 606 & 607</span>
          </Link>
        </div>
      </div>

      {/* Banner de Estado DGII & Suscripción */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-sky-300">Conexión DGII Activa (Ley 32-23)</span>
          </div>
          <p className="text-xs text-slate-300">
            Tu emisor fiscal electrónico está listo para operar sin datos demo ficticios.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              {subData?.plan?.name || 'Prueba Activa'}
            </div>
            <div className="text-xs font-bold text-white">
              Te quedan {daysLeft} {daysLeft === 1 ? 'día' : 'días'}
            </div>
          </div>
          <Link
            href="/app/settings/billing"
            className="px-3.5 py-2 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs hover:bg-sky-400 transition btn-fx"
          >
            Elegir plan
          </Link>
        </div>
      </div>

      {/* Cards de Métricas Reales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Facturado */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Ventas del Mes (e-CF)</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatDOP(totalVentas)}
          </div>
          <MiniSparkline active={totalVentas > 0} />
          <div className="text-[11px] text-slate-500 font-medium">
            {totalInvoices === 0 ? 'Sin facturas en el período' : `${totalInvoices} comprobante(s) timbrado(s)`}
          </div>
        </div>

        {/* Total ITBIS */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total ITBIS Recaudado</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatDOP(totalItbis)}
          </div>
          <MiniSparkline active={totalItbis > 0} />
          <div className="text-[11px] text-slate-500">
            {totalInvoices === 0 ? 'Listo para Formato 607' : 'Acumulado para Formato 607'}
          </div>
        </div>

        {/* Comprobantes Emitidos */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Comprobantes Emitidos</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {totalInvoices}
          </div>
          <MiniSparkline active={totalInvoices > 0} />
          <div className="text-[11px] text-slate-500">
            {totalInvoices === 0 ? '0 e-CF emitidos' : 'Comprobantes timbrados OK'}
          </div>
        </div>

        {/* Gastos 606 QR */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Compras & Gastos (606)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <QrCode className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatDOP(expenses606Total)}
          </div>
          <MiniSparkline active={expenses606Total > 0} />
          <div className="text-[11px] text-slate-500">
            {expenses606Count === 0 ? '0 gastos leídos por QR' : `${expenses606Count} facturas leídas por QR`}
          </div>
        </div>
      </div>

      {/* Checklist de onboarding con barra de progreso */}
      {onboardingDoneCount < 3 && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Primeros Pasos en tu Portal e-CF</h2>
                <p className="text-xs text-slate-500">
                  Completa estos pasos para dejar tu empresa operando al 100%.
                </p>
              </div>
            </div>
            <div className="min-w-[160px]">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Progreso</span>
                <span className="text-sky-600">{onboardingDoneCount}/3</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.round((onboardingDoneCount / 3) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <Link
              href="/app/invoices/new"
              className={`p-3.5 rounded-xl border transition flex items-center gap-3 text-left ${
                step1Done
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-slate-200 hover:border-sky-500 hover:bg-sky-50/40'
              }`}
            >
              {step1Done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <FilePlus2 className="w-5 h-5 text-sky-600 shrink-0" />
              )}
              <div>
                <div className={`text-xs font-bold ${step1Done ? 'text-emerald-800 line-through' : 'text-slate-800'}`}>
                  1. Emitir Primera Factura
                </div>
                <div className="text-[11px] text-slate-500">Crea un e-CF 31 o 32 oficial</div>
              </div>
            </Link>

            <Link
              href="/app/settings/company"
              className={`p-3.5 rounded-xl border transition flex items-center gap-3 text-left ${
                step2Done
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-slate-200 hover:border-sky-500 hover:bg-sky-50/40'
              }`}
            >
              {step2Done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <Building2 className="w-5 h-5 text-indigo-600 shrink-0" />
              )}
              <div>
                <div className={`text-xs font-bold ${step2Done ? 'text-emerald-800 line-through' : 'text-slate-800'}`}>
                  2. Subir tu Logo Real
                </div>
                <div className="text-[11px] text-slate-500">Personaliza tus impresiones</div>
              </div>
            </Link>

            <Link
              href="/app/purchases?scan=1"
              className={`p-3.5 rounded-xl border transition flex items-center gap-3 text-left ${
                step3Done
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-slate-200 hover:border-sky-500 hover:bg-sky-50/40'
              }`}
            >
              {step3Done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <QrCode className="w-5 h-5 text-emerald-600 shrink-0" />
              )}
              <div>
                <div className={`text-xs font-bold ${step3Done ? 'text-emerald-800 line-through' : 'text-slate-800'}`}>
                  3. Escanear Factura 606
                </div>
                <div className="text-[11px] text-slate-500">Registra gastos con QR</div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Acciones Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/app/invoices/new"
          className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-sky-500 shadow-xs transition group space-y-2"
        >
          <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
            <span>Factura de Crédito Fiscal (E31)</span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-500 group-hover:translate-x-1 transition" />
          </div>
          <p className="text-xs text-slate-500">
            Emite con validación automática de RNC del receptor y deducción de ITBIS para empresas.
          </p>
        </Link>

        <Link
          href="/app/reports"
          className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-500 shadow-xs transition group space-y-2"
        >
          <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
            <span>Escáner QR & Libro 606</span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition" />
          </div>
          <p className="text-xs text-slate-500">
            Escanea facturas recibidas de suplidores y descarga el archivo Excel para tu contable.
          </p>
        </Link>

        <Link
          href="/app/settings/company"
          className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-500 shadow-xs transition group space-y-2"
        >
          <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
            <span>Logo Propio & Co-Branding</span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition" />
          </div>
          <p className="text-xs text-slate-500">
            Personaliza el logo de tu negocio con auto-compresión para imprimir en tirilla 80mm y carta.
          </p>
        </Link>
      </div>
    </div>
  );
}
