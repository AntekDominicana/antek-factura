'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL, apiFetch, formatDOP } from '../../../lib/api';
import {
  FileSpreadsheet,
  QrCode,
  Download,
  Calendar,
  Building2,
  CheckCircle2,
  Search,
  Filter,
  FilePlus2,
  Receipt,
} from 'lucide-react';

export default function ReportsPage() {
  const [period, setPeriod] = useState('2026-11');
  const [tab, setTab] = useState<'606' | '607'>('606');
  const [purchases606, setPurchases606] = useState<any[]>([]);
  const [invoices607, setInvoices607] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      try {
        const [pur, inv] = await Promise.all([
          apiFetch<any[]>('/v1/dgii/purchases').catch(() => []),
          apiFetch<any[]>('/v1/invoices').catch(() => []),
        ]);

        if (Array.isArray(pur)) setPurchases606(pur);
        if (Array.isArray(inv)) {
          const mapped607 = inv.map((item: any) => ({
            rnc: item.rncComprador || 'Consumidor Final',
            razonSocial: item.razonSocialComprador || 'Cliente Sin RNC',
            encf: item.encf,
            fecha: item.fechaEmision,
            totalItbis: Number(item.totales?.totalItbis) || 0,
            montoTotal: Number(item.totales?.montoTotal) || 0,
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

  const activeRows = tab === '606' ? purchases606 : invoices607;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Libro Contable Digital (606 & 607)</h1>
          <p className="text-xs text-slate-500">
            Exporta tus declaraciones de compras y ventas directamente a Excel para tu contable
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-hidden"
            />
          </div>

          <a
            href={`${API_BASE_URL}/v1/dgii/reports/${period}/excel`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 inline-flex items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Excel Oficial</span>
          </a>
        </div>
      </div>

      {/* Switcher de Libros */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setTab('606')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            tab === '606'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <QrCode className="w-4 h-4 text-amber-400" />
          <span>Libro 606 (Compras & Gastos QR) — {purchases606.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('607')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
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
                        <p className="font-semibold text-slate-600">No hay compras ni gastos registrados en el 606</p>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          Usa la app móvil o el lector QR para escanear facturas recibidas de tus proveedores y agregarlas aquí.
                        </p>
                      </>
                    ) : (
                      <>
                        <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="font-semibold text-slate-600">No hay comprobantes de ventas emitidos en el 607</p>
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
                        {row.tipoGasto || '02 - Gastos por Trabajos y Servicios'}
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
