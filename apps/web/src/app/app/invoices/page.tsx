'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_BASE_URL, apiFetch, formatDOP, ECF_TYPE_LABELS } from '../../../lib/api';
import {
  FilePlus2,
  Search,
  Receipt,
  Download,
  Code2,
  ExternalLink,
  CheckCircle2,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    async function loadInvoices() {
      try {
        const data = await apiFetch('/v1/invoices');
        if (Array.isArray(data)) {
          setInvoices(data);
        }
      } catch (err) {
        console.warn('Error loading invoices', err);
      } finally {
        setLoading(false);
      }
    }
    loadInvoices();
  }, []);

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      (inv.encf || '').toLowerCase().includes(search.toLowerCase()) ||
      (inv.razonSocialComprador || '').toLowerCase().includes(search.toLowerCase()) ||
      (inv.rncComprador || '').includes(search);
    const matchesType =
      filterType === 'ALL' || String(inv.tipoEcf) === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Comprobantes Fiscales Emitidos</h1>
          <p className="text-xs text-slate-500">
            Historial de facturas electrónicas e-CF timbradas ante la DGII (Ley 32-23)
          </p>
        </div>

        <Link
          href="/app/invoices/new"
          className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 inline-flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <FilePlus2 className="w-4 h-4" />
          <span>Emitir Nuevo e-CF</span>
        </Link>
      </div>

      {/* Filtros & Buscador */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por e-NCF (ej. E310000000001), RNC o nombre de cliente..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium"
          >
            <option value="ALL">Todos los Comprobantes</option>
            <option value="31">e-CF 31 - Crédito Fiscal</option>
            <option value="32">e-CF 32 - Consumo</option>
            <option value="33">e-CF 33 - Nota de Débito</option>
            <option value="34">e-CF 34 - Nota de Crédito</option>
            <option value="41">e-CF 41 - Compras (606)</option>
          </select>
        </div>
      </div>

      {/* Tabla de Facturas */}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <tr>
                <th className="py-3 px-4">e-NCF / Tipo</th>
                <th className="py-3 px-4">Receptor / Cliente</th>
                <th className="py-3 px-4">Fecha Emisión</th>
                <th className="py-3 px-4 text-right">ITBIS</th>
                <th className="py-3 px-4 text-right">Monto Total</th>
                <th className="py-3 px-4 text-center">Estado DGII</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Cargando comprobantes emitidos...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 space-y-2">
                    <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-600">No hay comprobantes fiscales emitidos aún</p>
                    <p className="text-[11px] text-slate-400">
                      Haz clic en &quot;Emitir Nuevo e-CF&quot; para generar tu primera factura electrónica oficial.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      <Link href={`/app/invoices/${inv.id}`} className="hover:text-sky-600 hover:underline">
                        {inv.encf}
                      </Link>
                      <div className="text-[10px] text-slate-400 font-sans font-normal">
                        {ECF_TYPE_LABELS[inv.tipoEcf] || `Tipo ${inv.tipoEcf}`}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {inv.razonSocialComprador || 'Consumidor Final'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {inv.rncComprador || 'Sin RNC'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {inv.fechaEmision ? String(inv.fechaEmision).slice(0, 10) : '16-11-2026'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {formatDOP(inv.totalItbis || 0)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatDOP(inv.montoTotal || 0)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Aceptado
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/app/invoices/${inv.id}`}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                          title="Ver Ficha y Timbre QR"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        <a
                          href={`${API_BASE_URL}/v1/invoices/${inv.id}/xml`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                          title="Descargar XML Firmado"
                        >
                          <Code2 className="w-3.5 h-3.5" />
                        </a>
                      </div>
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
