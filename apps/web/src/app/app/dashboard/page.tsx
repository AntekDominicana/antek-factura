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
          apiFetch<any[]>('/v1/dgii/purchases').catch(() => []),
          apiFetch<any>('/v1/billing/subscription').catch(() => null),
        ]);

        if (Array.isArray(invData)) setInvoices(invData);
        if (Array.isArray(purData)) setPurchases(purData);
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
            href="/app/invoices/new"
            className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 flex items-center gap-1.5 transition"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Emitir e-CF Nuevo</span>
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
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Plan Contratado</div>
            <div className="text-xs font-bold text-white">
              {subData?.plan?.name || 'Plan Activo'} (5 días gracia)
            </div>
          </div>
          <Link
            href="/app/settings/billing"
            className="px-3 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs hover:bg-sky-400"
          >
            Facturación
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
          <div className="text-[11px] text-slate-500">
            {expenses606Count === 0 ? '0 gastos leídos por QR' : `${expenses606Count} facturas leídas por QR`}
          </div>
        </div>
      </div>

      {/* Si aún no hay facturas, mostrar tarjeta orientadora inicial limpia */}
      {totalInvoices === 0 && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Tu Sistema Está Listo y Limpio para Comenzar</h2>
              <p className="text-xs text-slate-500">
                No hay datos demo ficticios. Todos los totales reflejan exclusivamente los comprobantes que tú emitas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <Link
              href="/app/invoices/new"
              className="p-3.5 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50/40 transition flex items-center gap-3 text-left"
            >
              <FilePlus2 className="w-5 h-5 text-sky-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-800">1. Emitir Primera Factura</div>
                <div className="text-[10px] text-slate-500">Crea un e-CF 31 o 32 oficial</div>
              </div>
            </Link>

            <Link
              href="/app/settings/company"
              className="p-3.5 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50/40 transition flex items-center gap-3 text-left"
            >
              <Building2 className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-800">2. Subir tu Logo Real</div>
                <div className="text-[10px] text-slate-500">Personaliza tus impresiones</div>
              </div>
            </Link>

            <Link
              href="/app/products"
              className="p-3.5 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50/40 transition flex items-center gap-3 text-left"
            >
              <Package className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-800">3. Registrar tus Productos</div>
                <div className="text-[10px] text-slate-500">Arma tu catálogo con ITBIS</div>
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
