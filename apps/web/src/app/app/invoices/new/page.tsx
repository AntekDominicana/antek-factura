'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
      nombreItem: '',
      cantidadItem: 1,
      precioUnitarioItem: 0,
      indicadorFacturacion: 1, // 18%
    },
  ]);

  const [emitting, setEmitting] = useState(false);
  const [emittedResult, setEmittedResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [catalogCustomers, setCatalogCustomers] = useState<any[]>([]);

  useEffect(() => {
    apiFetch<any>('/v1/products')
      .then((res) => setCatalogProducts(Array.isArray(res) ? res : res?.products || []))
      .catch(() => {});
    apiFetch<any>('/v1/customers')
      .then((res) => setCatalogCustomers(Array.isArray(res) ? res : res?.customers || []))
      .catch(() => {});
  }, []);

  // Draft invoice for preview
  const draftInvoice = useMemo(() => {
    return {
      rncEmisor: tenant?.rnc || '',
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

  const cleanBuyerRnc = rncComprador.replace(/\D/g, '');
  const isBuyerRncValidForE31 =
    tipoEcf !== 31 || ([9, 11].includes(cleanBuyerRnc.length) && razonSocialComprador.trim().length > 0);
  const hasValidItems = items.some(
    (it) =>
      String(it?.nombreItem || '').trim().length > 0 &&
      Number(it?.precioUnitarioItem) > 0 &&
      Number(it?.cantidadItem) > 0
  );
  const canEmit = !emitting && isBuyerRncValidForE31 && hasValidItems;

  const handleEmit = useCallback(async () => {
    setError(null);
    if (tipoEcf === 31 && (![9, 11].includes(cleanBuyerRnc.length) || !razonSocialComprador.trim())) {
      setError('La Factura de Crédito Fiscal (e-CF 31) exige un RNC/Cédula válido (9 u 11 dígitos) y Razón Social del receptor.');
      return;
    }

    const validItems = items.filter(
      (it) => String(it?.nombreItem || '').trim().length > 0 && Number(it?.precioUnitarioItem) > 0 && Number(it?.cantidadItem) > 0
    );
    if (validItems.length === 0) {
      setError('Agrega al menos un producto o servicio con descripción, cantidad y precio mayor a 0.');
      return;
    }

    setEmitting(true);
    try {
      const payload = {
        tipoEcf,
        comprador:
          rncComprador.trim() || razonSocialComprador.trim()
            ? {
                rncComprador: rncComprador.trim() || undefined,
                razonSocialComprador: razonSocialComprador.trim() || undefined,
              }
            : undefined,
        rncComprador: rncComprador.trim() || undefined,
        razonSocialComprador: razonSocialComprador.trim() || undefined,
        tipoPago,
        formaPago,
        fechaLimitePago: tipoPago === 2 ? fechaLimitePago : undefined,
        items: validItems,
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
  }, [tipoEcf, cleanBuyerRnc, rncComprador, razonSocialComprador, items, tipoPago, formaPago, fechaLimitePago]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canEmit) handleEmit();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setItems((prev) => [
          ...prev,
          { nombreItem: '', cantidadItem: 1, precioUnitarioItem: 0, indicadorFacturacion: 1 },
        ]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEmit, handleEmit]);

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
            <h2 className="text-base font-black text-slate-900">Datos del Comprobante</h2>
            <p className="text-xs text-slate-500">
              Timbrado compatible con e-CF Ley 32-23, firma digital XMLDSig y validación RNC
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
                <label className="block text-slate-600 font-semibold mb-1">
                  RNC o Cédula Receptor {tipoEcf === 31 && <span className="text-rose-600">*</span>}
                </label>
                <input
                  type="text"
                  list="customers-rnc-list"
                  value={rncComprador}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRncComprador(val);
                    const matchedCustomer = catalogCustomers.find(
                      (c) => String(c.rnc || '').replace(/\D/g, '') === val.replace(/\D/g, '')
                    );
                    if (matchedCustomer?.razonSocial) {
                      setRazonSocialComprador(matchedCustomer.razonSocial);
                    }
                    handleVerifyBuyerRnc(val);
                  }}
                  placeholder={tipoEcf === 31 ? 'Obligatorio (9 u 11 dígitos)' : 'Opcional (Consumidor Final)'}
                  className={`w-full bg-white border rounded-xl px-3 py-2 text-xs font-mono ${
                    tipoEcf === 31 && ![9, 11].includes(cleanBuyerRnc.length)
                      ? 'border-amber-400 focus:border-amber-500'
                      : 'border-slate-300'
                  }`}
                />
                <datalist id="customers-rnc-list">
                  {catalogCustomers.map((c) => (
                    <option key={c.id || c.rnc} value={c.rnc}>
                      {c.razonSocial}
                    </option>
                  ))}
                </datalist>
                {tipoEcf === 31 && ![9, 11].includes(cleanBuyerRnc.length) && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">
                    Ingresa un RNC o Cédula válido (9 u 11 dígitos numéricos).
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Razón Social Receptor {tipoEcf === 31 && <span className="text-rose-600">*</span>}
                </label>
                <input
                  type="text"
                  value={razonSocialComprador}
                  onChange={(e) => setRazonSocialComprador(e.target.value)}
                  placeholder={tipoEcf === 31 ? 'Nombre o Razón Social obligatoria' : 'Consumidor Final'}
                  className={`w-full bg-white border rounded-xl px-3 py-2 text-xs ${
                    tipoEcf === 31 && !razonSocialComprador.trim()
                      ? 'border-rose-300 focus:border-rose-500'
                      : 'border-slate-300'
                  }`}
                />
                {tipoEcf === 31 && !razonSocialComprador.trim() && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">
                    La Razón Social es obligatoria para e-CF 31.
                  </p>
                )}
              </div>
            </div>

            {tipoEcf === 31 && !isBuyerRncValidForE31 && (
              <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                El e-CF 31 (Crédito Fiscal) exige RNC válido (9 u 11 dígitos) y Razón Social del receptor. Para ventas sin RNC cambia a e-CF 32 (Consumo).
              </p>
            )}

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

            <datalist id="products-catalog-list">
              {catalogProducts.map((prod) => (
                <option key={prod.id || prod.name} value={prod.name || prod.nombre}>
                  {formatDOP(Number(prod.unitPrice || prod.precio || 0))}
                </option>
              ))}
            </datalist>

            <div className="hidden sm:grid grid-cols-12 gap-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <div className="col-span-4">Descripción</div>
              <div className="col-span-2 text-right">Cant.</div>
              <div className="col-span-2 text-right">Precio</div>
              <div className="col-span-2">ITBIS</div>
              <div className="col-span-2 text-right">Total</div>
            </div>

            <div className="space-y-2.5">
              {items.map((item, index) => {
                const rate =
                  item.indicadorFacturacion === 1 ? 0.18 : item.indicadorFacturacion === 2 ? 0.16 : 0;
                const lineTotal =
                  (Number(item.cantidadItem) || 0) *
                  (Number(item.precioUnitarioItem) || 0) *
                  (1 + rate);

                return (
                  <div key={index} className="p-3 rounded-xl border border-slate-200 bg-white grid grid-cols-12 gap-2 text-xs items-center">
                    <div className="col-span-12 sm:col-span-4">
                      <input
                        type="text"
                        list="products-catalog-list"
                        placeholder="Descripción del bien o servicio"
                        value={item.nombreItem}
                        onChange={(e) => {
                          const val = e.target.value;
                          const matchedProd = catalogProducts.find(
                            (p) => (p.name || p.nombre || '').toLowerCase() === val.trim().toLowerCase()
                          );
                          if (matchedProd) {
                            const next = [...items];
                            next[index] = {
                              ...next[index],
                              nombreItem: val,
                              precioUnitarioItem: Number(matchedProd.unitPrice ?? matchedProd.precio ?? next[index].precioUnitarioItem),
                              indicadorFacturacion: Number(matchedProd.taxRate ?? matchedProd.indicadorFacturacion ?? 1),
                            };
                            setItems(next);
                          } else {
                            handleItemChange(index, 'nombreItem', val);
                          }
                        }}
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="Cant."
                        value={item.cantidadItem}
                        onChange={(e) => handleItemChange(index, 'cantidadItem', Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-right font-mono"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Precio"
                        value={item.precioUnitarioItem}
                        onChange={(e) => handleItemChange(index, 'precioUnitarioItem', Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-right font-mono"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <select
                        value={item.indicadorFacturacion}
                        onChange={(e) => handleItemChange(index, 'indicadorFacturacion', Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 px-1.5 py-1.5 text-[11px]"
                      >
                        <option value={1}>18%</option>
                        <option value={2}>16%</option>
                        <option value={3}>0%</option>
                        <option value={4}>Exento</option>
                      </select>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <span className="font-mono font-bold text-slate-800 text-[11px] truncate">
                        {formatDOP(lineTotal)}
                      </span>
                      <button
                        type="button"
                        disabled={items.length <= 1}
                        onClick={() => handleRemoveItem(index)}
                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 shrink-0"
                        title="Eliminar línea"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Barra inferior sticky con Total y Botón */}
          <div className="sticky bottom-0 z-20 -mx-5 sm:-mx-6 px-5 sm:px-6 py-4 bg-white/95 backdrop-blur-md border-t border-slate-200 rounded-b-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              <span className="text-slate-500 block">Monto Total a Timbrar:</span>
              <div className="text-lg font-black text-slate-900">{formatDOP(calculated.totales.montoTotal)}</div>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                Atajos: <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 font-mono">Ctrl+Enter</kbd> emitir ·{' '}
                <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 font-mono">Ctrl+Shift+A</kbd> línea
              </span>
            </div>

            <button
              type="button"
              disabled={!canEmit}
              onClick={handleEmit}
              title={!isBuyerRncValidForE31 ? 'Completa el RNC y Razón Social para emitir e-CF 31' : undefined}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 flex items-center gap-2 transition disabled:opacity-45 disabled:cursor-not-allowed btn-fx cursor-pointer"
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
