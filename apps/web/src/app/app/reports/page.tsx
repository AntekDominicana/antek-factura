'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch, apiDownload, formatDOP } from '../../../lib/api';
import {
  FileSpreadsheet,
  QrCode,
  Download,
  Calendar,
  FilePlus2,
  Receipt,
  Camera,
  TrendingUp,
  TrendingDown,
  Calculator,
} from 'lucide-react';

const TIPO_GASTO_LABELS: Record<string, string> = {
  '01': '01 - Gastos de Personal',
  '02': '02 - Trabajos, Suministros y Servicios',
  '03': '03 - Arrendamientos',
  '04': '04 - Gastos de Activos Fijos',
  '05': '05 - Gastos de Representación',
  '06': '06 - Otras Deducciones Admitidas',
  '07': '07 - Gastos Financieros',
  '08': '08 - Gastos Extraordinarios',
  '09': '09 - Compras Costo de Venta',
  '10': '10 - Adquisiciones de Activos',
  '11': '11 - Gastos de Seguros',
};

export default function ReportsPage() {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [tab, setTab] = useState<'606' | '607'>('606');
  const [purchases606, setPurchases606] = useState<any[]>([]);
  const [invoices607, setInvoices607] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      try {
        const [purRes, invRes] = await Promise.all([
          apiFetch<any>('/v1/purchases').catch(() => ({ purchases: [] })),
          apiFetch<any[]>('/v1/invoices').catch(() => []),
        ]);

        const rawPurchases = Array.isArray(purRes?.purchases) ? purRes.purchases : [];
        setPurchases606(
          rawPurchases.map((p: any) => ({
            rnc: p.rncEmisor || p.rnc,
            razonSocial: p.razonSocialEmisor || p.razonSocial,
            encf: p.encf,
            fecha: p.fechaEmision || p.fecha,
            tipoGasto: TIPO_GASTO_LABELS[p.tipoGasto606] || p.tipoGasto606 || '02 - Trabajos y Servicios',
            totalItbis: Number(p.totalItbis || 0),
            montoTotal: Number(p.montoTotal || 0),
          }))
        );

        if (Array.isArray(invRes)) {
          const mapped607 = invRes.map((item: any) => ({
            rnc: item.rncComprador || 'Consumidor Final',
            razonSocial: item.razonSocialComprador || 'Consumidor Final',
            encf: item.encf,
            fecha: item.fechaEmision,
            totalItbis: Number(item.totales?.totalItbis ?? item.totalItbis ?? 0),
            montoTotal: Number(item.totales?.montoTotal ?? item.montoTotal ?? 0),
          }));
          setInvoices607(mapped607);
        }
      } catch (err) {
        console.warn('Error loading reports', err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, []);

  const periodCompact = period.replace('-', '');

  const handleDownload = async (kind: 'excel' | '606' | '607') => {
    try {
      setDownloading(kind);
      if (kind === 'excel') {
        await apiDownload(
          `/v1/dgii/reports/${periodCompact}/excel`,
          `Formato-de-Envio-606-${periodCompact}.xls`
        );
      } else {
        await apiDownload(
          `/v1/dgii/reports/${periodCompact}/download/${kind}`,
          `DGII_F_${kind}_${periodCompact}.txt`
        );
      }
    } catch (err: any) {
      alert(err?.message || 'Error al descargar el reporte.');
    } finally {
      setDownloading(null);
    }
  };

  const totalCompras = purchases606.reduce((sum, p) => sum + Number(p.montoTotal || 0), 0);
  const totalItbisCompras = purchases606.reduce((sum, p) => sum + Number(p.totalItbis || 0), 0);
  const totalVentas = invoices607.reduce((sum, v) => sum + Number(v.montoTotal || 0), 0);
  const totalItbisVentas = invoices607.reduce((sum, v) => sum + Number(v.totalItbis || 0), 0);
  const itbisNetoAPagar = Math.max(0, totalItbisVentas - totalItbisCompras);

  const activeRows = tab === '606' ? purchases606 : invoices607;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Libro Contable Digital (606 &amp; 607)</h1>
          <p className="text-xs text-slate-500">
            Todas tus facturas escaneadas (compras) y comprobantes emitidos (ventas) sincronizados en Supabase para tu contable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-hidden"
            />
          </div>

          <Link
            href="/app/purchases?scan=1"
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 inline-flex items-center gap-1.5 transition"
          >
            <Camera className="w-4 h-4" />
            <span>Escanear Factura e-CF</span>
          </Link>

          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => handleDownload('excel')}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{downloading === 'excel' ? 'Descargando...' : 'Descargar Excel 606 Oficial'}</span>
          </button>

          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => handleDownload(tab)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-sky-400" />
            <span>{downloading === tab ? 'Generando...' : `TXT ${tab}`}</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Resumen Contable IT-1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Compras Reportadas (606)</span>
            <TrendingDown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-slate-900">{formatDOP(totalCompras)}</div>
          <div className="text-xs font-semibold text-emerald-700">
            ITBIS Deducible: {formatDOP(totalItbisCompras)}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Ventas Facturadas (607)</span>
            <TrendingUp className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-xl font-black text-slate-900">{formatDOP(totalVentas)}</div>
          <div className="text-xs font-semibold text-sky-700">
            ITBIS Cobrado: {formatDOP(totalItbisVentas)}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-md space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>ITBIS Neto Estimado (IT-1)</span>
            <Calculator className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400">{formatDOP(itbisNetoAPagar)}</div>
          <div className="text-[11px] text-slate-400">
            ITBIS Cobrado ({formatDOP(totalItbisVentas)}) − Adelantado ({formatDOP(totalItbisCompras)})
          </div>
        </div>
      </div>

      {/* Switcher de Libros */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setTab('606')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            tab === '606'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <QrCode className="w-4 h-4 text-amber-400" />
          <span>Libro 606 (Compras &amp; Gastos QR) — {purchases606.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('607')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            tab === '607'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-sky-400" />
          <span>Libro 607 (Ventas e-CF) — {invoices607.length}</span>
        </button>
      </div>

      {/* Tabla del Libro Activo */}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-900">
            {tab === '606' ? 'Compras Reportadas (Formato 606 DGII)' : 'Ventas Emitidas (Formato 607 DGII)'}
          </span>
          <span className="text-slate-500 font-mono">Período: {period}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3 px-4">RNC / Cédula</th>
                <th className="py-3 px-4">Razón Social</th>
                <th className="py-3 px-4 font-mono">e-NCF</th>
                <th className="py-3 px-4">Fecha</th>
                {tab === '606' && <th className="py-3 px-4">Tipo de Gasto DGII</th>}
                <th className="py-3 px-4 text-right">ITBIS</th>
                <th className="py-3 px-4 text-right">Monto Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Cargando registros contables...
                  </td>
                </tr>
              ) : activeRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 space-y-2">
                    {tab === '606' ? (
                      <>
                        <QrCode className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="font-semibold text-slate-600">No hay compras ni gastos registrados en el Libro 606</p>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          Escanea el código QR de cualquier factura electrónica de tus proveedores o sube su foto/XML para guardarla aquí automáticamente.
                        </p>
                        <div className="pt-2">
                          <Link
                            href="/app/purchases?scan=1"
                            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition"
                          >
                            <Camera className="w-4 h-4" />
                            <span>Escanear Factura e-CF</span>
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="font-semibold text-slate-600">No hay comprobantes de ventas emitidos en el Libro 607</p>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          Las facturas electrónicas que emitas aparecerán automáticamente en tu libro de ventas 607.
                        </p>
                        <div className="pt-2">
                          <Link
                            href="/app/invoices/new"
                            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition"
                          >
                            <FilePlus2 className="w-4 h-4" />
                            <span>Emitir Primera Factura</span>
                          </Link>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                activeRows.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{row.rnc}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{row.razonSocial}</td>
                    <td className="py-3 px-4 font-mono text-sky-700 font-semibold">{row.encf}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{row.fecha}</td>
                    {tab === '606' && (
                      <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                        {row.tipoGasto}
                      </td>
                    )}
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">
                      {formatDOP(row.totalItbis)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatDOP(row.montoTotal)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
