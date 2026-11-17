'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '../../../../context/AppContext';
import { InvoicePreview } from '../../../../components/InvoicePreview';
import {
  TaxCalculator,
  GtiMapper,
  EcfType,
  TipoPago,
  FormaPago,
} from '@factura-ecf/fiscal-engine/client';
import { API_BASE_URL, ECF_TYPE_LABELS, apiFetch, formatDOP } from '../../../../lib/api';
import {
  FilePlus2,
  Trash2,
  Plus,
  Send,
  ArrowLeft,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Search,
} from 'lucide-react';

export default function NewInvoicePage() {
  const router = useRouter();
  const { tenant } = useApp();

  const [tipoEcf, setTipoEcf] = useState<EcfType>(31);
  const [rncComprador, setRncComprador] = useState('');
  const [razonSocialComprador, setRazonSocialComprador] = useState('');
  const [tipoPago, setTipoPago] = useState<TipoPago>(1);
  const [formaPago, setFormaPago] = useState<FormaPago>(1);
  const [fechaLimitePago, setFechaLimitePago] = useState('');
  const [verifyingRnc, setVerifyingRnc] = useState(false);
  const [rncChecked, setRncChecked] = useState<any>(null);

  const [items, setItems] = useState<any[]>([
    {
      nombreItem: 'Servicio de Consultoría de Software',
      cantidadItem: 1,
      precioUnitarioItem: 15000,
      indicadorFacturacion: 1, // 18%
    },
  ]);

  const [emitting, setEmitting] = useState(false);
  const [emittedResult, setEmittedResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Draft invoice for preview
  const draftInvoice = useMemo(() => {
    return {
      rncEmisor: tenant?.rnc || '101532483',
      razonSocialEmisor: tenant?.razonSocial || 'Tu Empresa',
      tipoEcf,
      encf: emittedResult?.encf || `E${tipoEcf}0000000001`,
      fechaEmision: new Date(),
      tipoIngresos: '01',
      tipoPago,
      fechaLimitePago: tipoPago === 2 ? fechaLimitePago : undefined,
      formaPago,
      comprador: {
        rncComprador: rncComprador.trim() || undefined,
        razonSocialComprador: razonSocialComprador.trim() || undefined,
      },
      items,
    };
  }, [tenant, tipoEcf, emittedResult, tipoPago, fechaLimitePago, formaPago, rncComprador, razonSocialComprador, items]);

  const calculated = useMemo(() => TaxCalculator.calculateInvoice(draftInvoice as any), [draftInvoice]);
  const gtiPayload = useMemo(() => GtiMapper.toGtiPayload(draftInvoice as any), [draftInvoice]);

  const handleVerifyBuyerRnc = async (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (![9, 11].includes(clean.length)) {
      setRncChecked(null);
      return;
    }
    setVerifyingRnc(true);
    try {
      const res = await apiFetch(`/v1/dgii/verify-rnc/${clean}`);
      setRncChecked(res);
      if (res.nombreRazonSocial) {
        setRazonSocialComprador(res.nombreRazonSocial);
      }
    } catch {
      setRncChecked(null);
    } finally {
      setVerifyingRnc(false);
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        nombreItem: '',
        cantidadItem: 1,
        precioUnitarioItem: 0,
        indicadorFacturacion: 1,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    setItems(next);
  };

  const handleEmit = async () => {
    setError(null);
    if (tipoEcf === 31 && (!rncComprador || !razonSocialComprador)) {
      setError('La Factura de Crédito Fiscal (e-CF 31) requiere RNC y Razón Social del receptor.');
      return;
    }

    setEmitting(true);
    try {
      const payload = {
        tipoEcf,
        rncComprador: rncComprador.trim() || undefined,
        razonSocialComprador: razonSocialComprador.trim() || undefined,
        tipoPago,
        formaPago,
        fechaLimitePago: tipoPago === 2 ? fechaLimitePago : undefined,
        items,
      };
      const res = await apiFetch('/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setEmittedResult(res);
    } catch (err: any) {
      setError(err?.message || 'Error al emitir comprobante fiscal ante la DGII');
    } finally {
      setEmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/app/invoices"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Comprobantes
        </Link>
        <div className="text-xs text-slate-500 font-mono">
          Proveedor: <strong className="text-slate-800">{tenant?.fiscalProvider === 'GTI' ? 'GTI Partner' : 'DGII Directo'}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulario Izquierda (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-6">
          <div>
            <h1 className="text-xl font-black text-slate-900">Emisor de Factura Electrónica (e-CF)</h1>
            <p className="text-xs text-slate-500">
              Timbrado oficial DGII Ley 32-23 con firma digital XMLDSig y validación RNC
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {emittedResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ¡Comprobante Timbrado Exitosamente! e-NCF: {emittedResult.encf}
              </div>
              <p className="text-emerald-700">
                El comprobante fue firmado digitalmente y aceptado por la DGII. Puedes imprimirlo o descargar su XML.
              </p>
              <div className="pt-1 flex gap-2">
                <Link
                  href={`/app/invoices/${emittedResult.id}`}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs"
                >
                  Ver Ficha Oficial con QR →
                </Link>
              </div>
            </div>
          )}

          {/* Tipo de e-CF */}
          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-700 block">Tipo de Comprobante e-CF</label>
            <select
              value={tipoEcf}
              onChange={(e) => setTipoEcf(Number(e.target.value) as EcfType)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold"
            >
              <option value={31}>e-CF 31 - Factura de Crédito Fiscal Electrónica</option>
              <option value={32}>e-CF 32 - Factura de Consumo Electrónica</option>
              <option value={33}>e-CF 33 - Nota de Débito Electrónica</option>
              <option value={34}>e-CF 34 - Nota de Crédito Electrónica</option>
              <option value={41}>e-CF 41 - Compras Electrónicas (606)</option>
            </select>
          </div>

          {/* Datos del Receptor / Cliente */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">Datos del Receptor / Cliente</span>
              {verifyingRnc && <span className="text-[10px] text-sky-600 animate-pulse font-semibold">Consultando DGII...</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">RNC o Cédula Receptor</label>
                <input
                  type="text"
                  value={rncComprador}
                  onChange={(e) => {
                    setRncComprador(e.target.value);
                    handleVerifyBuyerRnc(e.target.value);
                  }}
                  placeholder="9 u 11 dígitos"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Razón Social Receptor</label>
                <input
                  type="text"
                  value={razonSocialComprador}
                  onChange={(e) => setRazonSocialComprador(e.target.value)}
                  placeholder="Nombre de empresa o cliente"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            {rncChecked && (
              <div className="p-2 rounded-lg bg-emerald-100/70 border border-emerald-300 text-[11px] text-emerald-950 flex items-center justify-between">
                <span>RNC Verificado en DGII: <strong>{rncChecked.nombreRazonSocial}</strong></span>
                <span className="font-bold text-emerald-700">Estado: {rncChecked.estado || 'Activo'}</span>
              </div>
            )}
          </div>

          {/* Items de la Factura */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Líneas de Factura / Productos</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-bold flex items-center gap-1 border border-sky-200 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Ítem
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((item, index) => (
                <div key={index} className="p-3 rounded-xl border border-slate-200 bg-white grid grid-cols-12 gap-2 text-xs items-center">
                  <div className="col-span-5">
                    <input
                      type="text"
                      placeholder="Descripción del bien o servicio"
                      value={item.nombreItem}
                      onChange={(e) => handleItemChange(index, 'nombreItem', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={1}
                      placeholder="Cant."
                      value={item.cantidadItem}
                      onChange={(e) => handleItemChange(index, 'cantidadItem', Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-right font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Precio"
                      value={item.precioUnitarioItem}
                      onChange={(e) => handleItemChange(index, 'precioUnitarioItem', Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-right font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <select
                      value={item.indicadorFacturacion}
                      onChange={(e) => handleItemChange(index, 'indicadorFacturacion', Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[11px]"
                    >
                      <option value={1}>18% ITBIS</option>
                      <option value={2}>16% ITBIS</option>
                      <option value={3}>0% ITBIS</option>
                      <option value={4}>Exento</option>
                    </select>
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => handleRemoveItem(index)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Botón de Timbrado */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs">
              <span className="text-slate-500">Monto Total a Timbrar:</span>
              <div className="text-lg font-black text-slate-900">{formatDOP(calculated.totales.montoTotal)}</div>
            </div>

            <button
              type="button"
              disabled={emitting}
              onClick={handleEmit}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 flex items-center gap-2 transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{emitting ? 'Firmando y Timbrando...' : 'Firmar y Emitir e-CF ante DGII'}</span>
            </button>
          </div>
        </div>

        {/* Vista Previa Derecha (5 cols) con Logo del Cliente + Co-Branding ANTEK */}
        <div className="lg:col-span-5 sticky top-6">
          <InvoicePreview
            tenant={tenant}
            draftInvoice={draftInvoice}
            calculated={calculated}
            gtiPayload={gtiPayload}
            emittedResult={emittedResult}
          />
        </div>
      </div>
    </div>
  );
}
