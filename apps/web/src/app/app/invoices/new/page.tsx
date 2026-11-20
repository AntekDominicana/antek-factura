'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../../../../context/AppContext';
import { InvoicePreview } from '../../../../components/InvoicePreview';
import {
  TaxCalculator,
  GtiMapper,
  EcfType,
  TipoPago,
  FormaPago,
} from '@factura-ecf/fiscal-engine/client';
import {
  ECF_TYPE_LABELS,
  apiDownload,
  apiFetch,
  formatDOP,
  lookupRncClient,
} from '../../../../lib/api';
import { downloadRawQrPng, downloadSignedQrStampPng } from '../../../../lib/qr-stamp';
import {
  Trash2,
  Plus,
  Send,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Search,
  Loader2,
  UserPlus,
  Layers,
  X,
  QrCode,
  Download,
  Code2,
  Settings2,
} from 'lucide-react';

const ALL_ECF_TYPES: EcfType[] = [31, 32, 33, 34, 41, 43, 44, 45, 46, 47];

const QUICK_ECF_PILLS: Array<{ type: EcfType; short: string }> = [
  { type: 31, short: '31 Crédito Fiscal' },
  { type: 32, short: '32 Consumo' },
  { type: 45, short: '45 Gubernamental' },
  { type: 34, short: '34 Nota Crédito' },
  { type: 33, short: '33 Nota Débito' },
];

function formatEncfCode(tipoEcf: number, num: number) {
  return `E${tipoEcf}${String(Math.max(0, num)).padStart(10, '0')}`;
}

function getDefaultFutureDateIso(daysAhead = 30) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function formatYmdToDgiiDate(ymd: string): string {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return ymd;
}

function NewInvoiceContent() {
  const searchParams = useSearchParams();
  const { tenant } = useApp();

  const tipoFromUrl = Number(searchParams.get('tipo'));
  const initialTipo: EcfType = ALL_ECF_TYPES.includes(tipoFromUrl as EcfType)
    ? (tipoFromUrl as EcfType)
    : 31;

  const [tipoEcf, setTipoEcf] = useState<EcfType>(initialTipo);
  const [rncComprador, setRncComprador] = useState('');
  const [razonSocialComprador, setRazonSocialComprador] = useState('');
  const [identificadorExtranjero, setIdentificadorExtranjero] = useState('');
  const [tipoPago, setTipoPago] = useState<TipoPago>(1);
  const [formaPago, setFormaPago] = useState<FormaPago>(1);
  const [fechaLimitePago, setFechaLimitePago] = useState(() => getDefaultFutureDateIso(30));

  // Referencia para Notas de Débito (33) y Crédito (34)
  const [ncfModificado, setNcfModificado] = useState('');
  const [fechaNcfModificado, setFechaNcfModificado] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [codigoModificacion, setCodigoModificacion] = useState<number>(3);
  const [razonModificacion, setRazonModificacion] = useState('');

  // RNC Lookup & Clientes
  const [verifyingRnc, setVerifyingRnc] = useState(false);
  const [rncChecked, setRncChecked] = useState<any>(null);
  const [rncLookupError, setRncLookupError] = useState<string | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerSavedMsg, setCustomerSavedMsg] = useState<string | null>(null);

  const [items, setItems] = useState<any[]>([
    {
      nombreItem: '',
      cantidadItem: 1,
      precioUnitarioItem: 0,
      indicadorFacturacion: 1, // 18%
      indicadorBienServicio: 1,
    },
  ]);

  const [emitting, setEmitting] = useState(false);
  const [emittedResult, setEmittedResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingQr, setDownloadingQr] = useState<'stamp' | 'raw' | null>(null);
  const successQrRef = useRef<HTMLDivElement>(null);

  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [catalogCustomers, setCatalogCustomers] = useState<any[]>([]);
  const [sequences, setSequences] = useState<any[]>([]);
  const [loadingSequences, setLoadingSequences] = useState(true);

  // Modal inline para registrar secuencia 1-100 rápidamente sin salir
  const [showQuickSeqModal, setShowQuickSeqModal] = useState(false);
  const [quickSeqDesde, setQuickSeqDesde] = useState(1);
  const [quickSeqHasta, setQuickSeqHasta] = useState(100);
  const [quickSeqVencimiento, setQuickSeqVencimiento] = useState('2027-12-31');
  const [savingQuickSeq, setSavingQuickSeq] = useState(false);

  const loadSequences = useCallback(async () => {
    setLoadingSequences(true);
    try {
      const data = await apiFetch<any[]>('/v1/sequences');
      setSequences(Array.isArray(data) ? data : []);
    } catch {
      setSequences([]);
    } finally {
      setLoadingSequences(false);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    try {
      const res = await apiFetch<any>('/v1/customers');
      setCatalogCustomers(Array.isArray(res) ? res : res?.customers || []);
    } catch {}
  }, []);

  useEffect(() => {
    apiFetch<any>('/v1/products')
      .then((res) => setCatalogProducts(Array.isArray(res) ? res : res?.products || []))
      .catch(() => {});
    loadCustomers();
    loadSequences();
  }, [loadCustomers, loadSequences]);

  // Manejar cambio de tipo e-CF con reglas fiscales inteligentes
  const handleSelectTipoEcf = useCallback((nextTipo: EcfType) => {
    setTipoEcf(nextTipo);
    setError(null);
    if ([43, 44, 47].includes(nextTipo)) {
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          indicadorFacturacion: 4, // Exento obligatorio en 43, 44, 47
          indicadorBienServicio: nextTipo === 47 ? 2 : it.indicadorBienServicio || 1,
        })),
      );
    } else if (nextTipo === 46) {
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          indicadorFacturacion: 3, // Exportación 0%
        })),
      );
    } else {
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          indicadorFacturacion:
            it.indicadorFacturacion === 4 || it.indicadorFacturacion === 3
              ? 1
              : it.indicadorFacturacion || 1,
        })),
      );
    }
    if (nextTipo !== 32) {
      setFormaPago((prev) => (prev === 5 ? 1 : prev));
    }
  }, []);

  // Aplicar ?tipo=... si cambia en URL
  useEffect(() => {
    if (ALL_ECF_TYPES.includes(tipoFromUrl as EcfType)) {
      handleSelectTipoEcf(tipoFromUrl as EcfType);
    }
  }, [tipoFromUrl, handleSelectTipoEcf]);

  // Buscar RNC en DGII
  const handleVerifyBuyerRnc = useCallback(async (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (![9, 11].includes(clean.length)) {
      setRncChecked(null);
      setRncLookupError(null);
      return;
    }
    setVerifyingRnc(true);
    setRncLookupError(null);
    try {
      const res = await lookupRncClient(clean);
      if (res.ok && res.data) {
        setRncChecked(res.data);
        const resolvedName = res.data.razonSocial || res.data.nombreRazonSocial || '';
        if (resolvedName) {
          setRazonSocialComprador(resolvedName);
        }
      } else {
        setRncChecked(null);
        setRncLookupError(res.error || 'No se encontró ese RNC/Cédula en DGII.');
      }
    } catch {
      setRncChecked(null);
      setRncLookupError('Error consultando padrón DGII.');
    } finally {
      setVerifyingRnc(false);
    }
  }, []);

  // Debounce automático cuando el usuario digita un RNC de 9 u 11 dígitos
  useEffect(() => {
    const clean = rncComprador.replace(/\D/g, '');
    if (clean.length !== 9 && clean.length !== 11) {
      setRncChecked(null);
      setRncLookupError(null);
      return;
    }
    const timer = setTimeout(() => {
      handleVerifyBuyerRnc(clean);
    }, 350);
    return () => clearTimeout(timer);
  }, [rncComprador, handleVerifyBuyerRnc]);

  // Guardar cliente en catálogo PostgreSQL
  const cleanBuyerRnc = rncComprador.replace(/\D/g, '');
  const customerAlreadyExists = catalogCustomers.some(
    (c) => String(c.rnc || '').replace(/\D/g, '') === cleanBuyerRnc && cleanBuyerRnc.length > 0,
  );

  const handleSaveCustomerToCatalog = async () => {
    if (![9, 11].includes(cleanBuyerRnc.length) || !razonSocialComprador.trim()) return;
    setSavingCustomer(true);
    setCustomerSavedMsg(null);
    try {
      await apiFetch('/v1/catalogs/customers', {
        method: 'POST',
        body: JSON.stringify({
          rnc: cleanBuyerRnc,
          razonSocial: razonSocialComprador.trim(),
        }),
      });
      await loadCustomers();
      setCustomerSavedMsg('Cliente guardado en tu directorio.');
      setTimeout(() => setCustomerSavedMsg(null), 3500);
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar el cliente en tu catálogo.');
    } finally {
      setSavingCustomer(false);
    }
  };

  // Secuencia activa para el tipo de e-CF actual
  const activeSequenceForType = useMemo(() => {
    const tenantEnv = tenant?.environment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
    const matching = sequences.filter(
      (s) => Number(s.tipoEcf) === Number(tipoEcf) && s.isActive !== false,
    );
    const preferredEnv = matching.filter((s) => (s.environment || 'SANDBOX') === tenantEnv);
    const pool = preferredEnv.length > 0 ? preferredEnv : matching;
    return (
      pool.find((s) => {
        const desde = Number(s.consecutivoDesde || 1);
        const hasta = Number(s.consecutivoHasta || 0);
        const ultimo = Number(s.ultimoConsecutivo || 0);
        const effectivePos = Math.max(ultimo, desde - 1);
        const remaining = s.remaining !== undefined ? Number(s.remaining) : Math.max(0, hasta - effectivePos);
        return remaining > 0;
      }) || null
    );
  }, [sequences, tipoEcf, tenant?.environment]);

  const activeSequenceRemaining = useMemo(() => {
    if (!activeSequenceForType) return 0;
    const desde = Number(activeSequenceForType.consecutivoDesde || 1);
    const hasta = Number(activeSequenceForType.consecutivoHasta || 0);
    const ultimo = Number(activeSequenceForType.ultimoConsecutivo || 0);
    const effectivePos = Math.max(ultimo, desde - 1);
    return activeSequenceForType.remaining !== undefined
      ? Number(activeSequenceForType.remaining)
      : Math.max(0, hasta - effectivePos);
  }, [activeSequenceForType]);

  const nextPreviewEncf = useMemo(() => {
    if (emittedResult?.encf) return emittedResult.encf;
    if (activeSequenceForType?.nextEncf) return activeSequenceForType.nextEncf;
    if (activeSequenceForType) {
      const desde = Number(activeSequenceForType.consecutivoDesde || 1);
      const ultimo = Number(activeSequenceForType.ultimoConsecutivo || 0);
      return formatEncfCode(tipoEcf, Math.max(ultimo, desde - 1) + 1);
    }
    return formatEncfCode(tipoEcf, 1);
  }, [emittedResult?.encf, activeSequenceForType, tipoEcf]);

  const activeReferences = useMemo(() => {
    if (![33, 34].includes(tipoEcf)) return undefined;
    if (!ncfModificado.trim() || !fechaNcfModificado) return undefined;
    return [
      {
        ncfModificado: ncfModificado.trim().toUpperCase(),
        fechaNcfModificado: formatYmdToDgiiDate(fechaNcfModificado),
        codigoModificacion: Number(codigoModificacion) || 3,
        razonModificacion: razonModificacion.trim() || undefined,
      },
    ];
  }, [tipoEcf, ncfModificado, fechaNcfModificado, codigoModificacion, razonModificacion]);

  // Draft invoice for preview
  const draftInvoice = useMemo(() => {
    const useForeignId = tipoEcf === 46 && Boolean(identificadorExtranjero.trim());
    return {
      rncEmisor: tenant?.rnc || '',
      razonSocialEmisor: tenant?.razonSocial || 'Tu Empresa',
      tipoEcf,
      encf: nextPreviewEncf,
      fechaEmision: new Date(),
      tipoIngresos: '01',
      tipoPago,
      fechaLimitePago: tipoPago === 2 ? formatYmdToDgiiDate(fechaLimitePago) : undefined,
      formaPago,
      comprador: {
        rncComprador: useForeignId ? undefined : rncComprador.trim() || undefined,
        razonSocialComprador: razonSocialComprador.trim() || undefined,
        identificadorExtranjero: useForeignId ? identificadorExtranjero.trim() : undefined,
      },
      references: activeReferences,
      items: items.map((it) => ({
        ...it,
        indicadorBienServicio: tipoEcf === 47 ? 2 : it.indicadorBienServicio || 1,
      })),
    };
  }, [
    tenant,
    tipoEcf,
    nextPreviewEncf,
    tipoPago,
    fechaLimitePago,
    formaPago,
    rncComprador,
    razonSocialComprador,
    identificadorExtranjero,
    activeReferences,
    items,
  ]);

  const calculated = useMemo(
    () => TaxCalculator.calculateInvoice(draftInvoice as any),
    [draftInvoice],
  );
  const gtiPayload = useMemo(
    () => GtiMapper.toGtiPayload(draftInvoice as any),
    [draftInvoice],
  );

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        nombreItem: '',
        cantidadItem: 1,
        precioUnitarioItem: 0,
        indicadorFacturacion: [43, 44, 47].includes(tipoEcf) ? 4 : tipoEcf === 46 ? 3 : 1,
        indicadorBienServicio: tipoEcf === 47 ? 2 : 1,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const requiresRncAndName = tipoEcf === 31 || tipoEcf === 45;
  const requiresForeignOrRnc = tipoEcf === 46;
  const requiresReference = tipoEcf === 33 || tipoEcf === 34;

  const isBuyerValid = useMemo(() => {
    if (requiresRncAndName) {
      return [9, 11].includes(cleanBuyerRnc.length) && razonSocialComprador.trim().length > 0;
    }
    if (requiresForeignOrRnc) {
      const hasRnc = [9, 11].includes(cleanBuyerRnc.length);
      const hasExt = identificadorExtranjero.trim().length > 0;
      return (hasRnc !== hasExt) && razonSocialComprador.trim().length > 0;
    }
    return true;
  }, [
    requiresRncAndName,
    requiresForeignOrRnc,
    cleanBuyerRnc,
    razonSocialComprador,
    identificadorExtranjero,
  ]);

  const isReferenceValid = useMemo(() => {
    if (!requiresReference) return true;
    const len = ncfModificado.trim().length;
    return [11, 13, 19].includes(len) && Boolean(fechaNcfModificado);
  }, [requiresReference, ncfModificado, fechaNcfModificado]);

  const hasValidItems = items.some(
    (it) =>
      String(it?.nombreItem || '').trim().length > 0 &&
      Number(it?.precioUnitarioItem) > 0 &&
      Number(it?.cantidadItem) > 0,
  );

  const canEmit = !emitting && isBuyerValid && isReferenceValid && hasValidItems;

  const handleQuickRegisterSequence = async (e: React.FormEvent) => {
    e.preventDefault();
    const desde = Number(quickSeqDesde);
    const hasta = Number(quickSeqHasta);
    if (!Number.isFinite(desde) || desde < 1 || !Number.isFinite(hasta) || hasta < desde) {
      setError('El rango debe ser numérico válido (Desde >= 1 y Hasta >= Desde).');
      return;
    }
    setSavingQuickSeq(true);
    setError(null);
    try {
      await apiFetch('/v1/sequences', {
        method: 'POST',
        body: JSON.stringify({
          IdTipoDocumento: tipoEcf,
          autoNextRange: true,
          ConsecutivoDesde: desde,
          ConsecutivoHasta: hasta,
          Vencimiento: quickSeqVencimiento || undefined,
          environment: tenant?.environment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
        }),
      });
      setShowQuickSeqModal(false);
      await loadSequences();
    } catch (err: any) {
      setError(err?.message || 'No se pudo activar el rango e-NCF.');
    } finally {
      setSavingQuickSeq(false);
    }
  };

  const handleEmit = useCallback(async () => {
    setError(null);
    if (requiresRncAndName && (![9, 11].includes(cleanBuyerRnc.length) || !razonSocialComprador.trim())) {
      setError(
        `El comprobante e-CF ${tipoEcf} exige un RNC/Cédula válido (9 u 11 dígitos) y Razón Social del receptor.`,
      );
      return;
    }
    if (requiresForeignOrRnc && !isBuyerValid) {
      setError(
        'La Factura de Exportación (46) requiere RNC o Identificador Extranjero (no ambos) y Razón Social.',
      );
      return;
    }
    if (requiresReference && !isReferenceValid) {
      setError(
        'Para Notas de Débito (33) o Crédito (34) debes indicar el e-NCF/NCF modificado (11, 13 o 19 caracteres) y su fecha.',
      );
      return;
    }
    if (tipoPago === 2 && !fechaLimitePago) {
      setError('Las facturas a crédito (TipoPago = 2) requieren Fecha Límite de Pago posterior a hoy.');
      return;
    }

    const validItems = items
      .filter(
        (it) =>
          String(it?.nombreItem || '').trim().length > 0 &&
          Number(it?.precioUnitarioItem) > 0 &&
          Number(it?.cantidadItem) > 0,
      )
      .map((it) => ({
        ...it,
        indicadorBienServicio: tipoEcf === 47 ? 2 : it.indicadorBienServicio || 1,
      }));
    if (validItems.length === 0) {
      setError('Agrega al menos un producto o servicio con descripción, cantidad y precio mayor a 0.');
      return;
    }

    const useForeignId = tipoEcf === 46 && Boolean(identificadorExtranjero.trim());
    setEmitting(true);
    try {
      const payload = {
        tipoEcf,
        comprador:
          rncComprador.trim() || razonSocialComprador.trim() || useForeignId
            ? {
                rncComprador: useForeignId ? undefined : cleanBuyerRnc || undefined,
                razonSocialComprador: razonSocialComprador.trim() || undefined,
                identificadorExtranjero: useForeignId ? identificadorExtranjero.trim() : undefined,
              }
            : undefined,
        rncComprador: useForeignId ? undefined : cleanBuyerRnc || undefined,
        razonSocialComprador: razonSocialComprador.trim() || undefined,
        tipoPago,
        formaPago,
        fechaLimitePago: tipoPago === 2 ? formatYmdToDgiiDate(fechaLimitePago) : undefined,
        references: activeReferences,
        items: validItems,
      };
      const res = await apiFetch('/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setEmittedResult(res);
      loadSequences();
    } catch (err: any) {
      setError(err?.message || 'Error al emitir comprobante fiscal ante la DGII');
    } finally {
      setEmitting(false);
    }
  }, [
    requiresRncAndName,
    requiresForeignOrRnc,
    requiresReference,
    isBuyerValid,
    isReferenceValid,
    cleanBuyerRnc,
    razonSocialComprador,
    identificadorExtranjero,
    tipoEcf,
    tipoPago,
    formaPago,
    fechaLimitePago,
    activeReferences,
    items,
    rncComprador,
    loadSequences,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canEmit) handleEmit();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setItems((prev) => [
          ...prev,
          {
            nombreItem: '',
            cantidadItem: 1,
            precioUnitarioItem: 0,
            indicadorFacturacion: [43, 44, 47].includes(tipoEcf) ? 4 : tipoEcf === 46 ? 3 : 1,
            indicadorBienServicio: tipoEcf === 47 ? 2 : 1,
          },
        ]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEmit, handleEmit, tipoEcf]);

  const emittedQrUrl =
    emittedResult?.urlQr ||
    `https://ecf.dgii.gov.do/testecf/consultatimbre?rncemisor=${tenant?.rnc || '000000000'}&encf=${emittedResult?.encf || nextPreviewEncf}&montototal=${calculated.totales.montoTotal}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/app/invoices"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Comprobantes
        </Link>
        <Link
          href="/app/settings/fiscal"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-sky-300 text-xs text-slate-600 font-mono transition shadow-2xs"
          title="Cambiar entre DGII Directo (.p12) y GTI Partner"
        >
          <Settings2 className="w-3.5 h-3.5 text-sky-600" />
          <span>
            Proveedor:{' '}
            <strong className="text-slate-900">
              {tenant?.fiscalProvider === 'GTI'
                ? 'GTI Partner'
                : tenant?.fiscalProvider === 'SIMULATOR'
                  ? 'Simulador'
                  : 'DGII Directo (.p12)'}
            </strong>
          </span>
          <span className="text-sky-600 font-sans font-bold">Cambiar →</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulario Izquierda (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-6">
          <div>
            <h2 className="text-base font-black text-slate-900">Datos del Comprobante e-CF</h2>
            <p className="text-xs text-slate-500">
              Timbrado Ley 32-23 DGII (todos los comprobantes 31–47), firma digital XMLDSig y autocompletado RNC
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {emittedResult && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-black flex items-center gap-1.5 text-sm text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ¡Comprobante Timbrado! {emittedResult.encf}
                  </div>
                  <p className="text-emerald-800 text-[11px]">
                    Firmado digitalmente con Código de Seguridad{' '}
                    <strong className="font-mono">{emittedResult.codigoSeguridad || 'N/A'}</strong>. Descarga el PDF, XML o el timbre QR + Firma (.png).
                  </p>
                </div>
                <div
                  ref={successQrRef}
                  className="bg-white p-1.5 rounded-lg border border-emerald-200 shrink-0 self-start sm:self-center"
                >
                  <QRCodeSVG value={emittedQrUrl} size={64} level="M" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/app/invoices/${emittedResult.id}`}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  Ver Ficha Oficial →
                </Link>
                <button
                  type="button"
                  disabled={downloadingQr !== null}
                  onClick={async () => {
                    try {
                      setDownloadingQr('stamp');
                      await downloadSignedQrStampPng(successQrRef.current, {
                        encf: emittedResult.encf || nextPreviewEncf,
                        tipoEcf: Number(tipoEcf),
                        rncEmisor: tenant?.rnc,
                        razonSocialEmisor: tenant?.razonSocial || tenant?.nombreComercial,
                        codigoSeguridad: emittedResult.codigoSeguridad,
                        fechaEmision: emittedResult.fechaEmision,
                        fechaFirma: emittedResult.fechaHoraFirma || new Date().toISOString(),
                        montoTotal: calculated?.totales?.montoTotal ?? null,
                        rncComprador: cleanBuyerRnc || null,
                        razonSocialComprador: razonSocialComprador.trim() || null,
                        brandColor: tenant?.brandColor,
                      });
                    } catch (err: any) {
                      alert(err?.message || 'Error descargando QR + Firma');
                    } finally {
                      setDownloadingQr(null);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{downloadingQr === 'stamp' ? 'Generando PNG...' : 'Descargar QR + Firma (.png)'}</span>
                </button>
                <button
                  type="button"
                  disabled={downloadingQr !== null}
                  onClick={() => downloadRawQrPng(successQrRef.current, emittedResult.encf || nextPreviewEncf)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 font-semibold text-xs inline-flex items-center gap-1 hover:bg-emerald-100 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Solo QR</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    apiDownload(`/v1/invoices/${emittedResult.id}/xml`, `${emittedResult.encf}.xml`).catch(
                      (err) => alert(err?.message || 'Error descargando XML'),
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 font-semibold text-xs inline-flex items-center gap-1 hover:bg-emerald-100 cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>XML</span>
                </button>
              </div>
            </div>
          )}

          {/* Selector de Tipo de Documento e-CF (Todos los tipos DGII) */}
          <div className="space-y-2.5 text-xs">
            <label className="font-bold text-slate-700 block">
              Tipo de Comprobante Fiscal Electrónico (e-CF)
            </label>

            {/* Botones rápidos más usados */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ECF_PILLS.map((pill) => {
                const active = tipoEcf === pill.type;
                return (
                  <button
                    key={pill.type}
                    type="button"
                    onClick={() => handleSelectTipoEcf(pill.type)}
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] border transition cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {pill.short}
                  </button>
                );
              })}
            </div>

            <select
              value={tipoEcf}
              onChange={(e) => handleSelectTipoEcf(Number(e.target.value) as EcfType)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold"
            >
              <optgroup label="Ventas e Ingresos">
                <option value={31}>{ECF_TYPE_LABELS[31]}</option>
                <option value={32}>{ECF_TYPE_LABELS[32]}</option>
                <option value={45}>{ECF_TYPE_LABELS[45]} (Estado e Instituciones Públicas)</option>
                <option value={44}>{ECF_TYPE_LABELS[44]} (Exento ITBIS)</option>
                <option value={46}>{ECF_TYPE_LABELS[46]} (Tasa 0%)</option>
              </optgroup>
              <optgroup label="Notas de Ajuste y Referencia">
                <option value={34}>{ECF_TYPE_LABELS[34]}</option>
                <option value={33}>{ECF_TYPE_LABELS[33]}</option>
              </optgroup>
              <optgroup label="Compras y Gastos Autorizados">
                <option value={41}>{ECF_TYPE_LABELS[41]} (Formato 606)</option>
                <option value={43}>{ECF_TYPE_LABELS[43]} (Exento ITBIS)</option>
                <option value={47}>{ECF_TYPE_LABELS[47]} (Servicios Exentos + Ret. ISR)</option>
              </optgroup>
            </select>

            {/* Estado en vivo de la secuencia e-NCF para este tipo */}
            {!loadingSequences && (
              activeSequenceForType ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Secuencia activa ({activeSequenceForType.environment || 'SANDBOX'}): Próximo{' '}
                      <strong className="font-mono">{nextPreviewEncf}</strong> ·{' '}
                      <strong>{activeSequenceRemaining.toLocaleString('es-DO')}</strong> disponibles
                    </span>
                  </div>
                  <Link href="/app/sequences" className="text-emerald-700 font-bold hover:underline">
                    Ver rangos →
                  </Link>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      No tienes un rango activo registrado para <strong>e-CF {tipoEcf}</strong>.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickSeqDesde(1);
                      setQuickSeqHasta(100);
                      setShowQuickSeqModal(true);
                    }}
                    className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Layers className="w-3 h-3" />
                    + Activar rango 1–100 ahora
                  </button>
                </div>
              )
            )}

            {[43, 44, 47].includes(tipoEcf) && (
              <p className="text-[11px] text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5 font-medium">
                Regla DGII para <strong>e-CF {tipoEcf}</strong>: Todos los ítems se marcan automáticamente como{' '}
                <strong>Exentos de ITBIS</strong>{tipoEcf === 47 ? ' (Servicios del Exterior)' : ''}.
              </p>
            )}
            {tipoEcf === 46 && (
              <p className="text-[11px] text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5 font-medium">
                Regla DGII para <strong>e-CF 46 (Exportación)</strong>: Ítems con <strong>ITBIS 0%</strong>. Debes indicar RNC/Cédula o Identificador Extranjero (nunca ambos).
              </p>
            )}
          </div>

          {/* Información de Referencia para e-CF 33 o 34 */}
          {requiresReference && (
            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3 text-xs">
              <div className="font-bold text-indigo-950">
                Información de Referencia (Documento Original Modificado) *
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    e-NCF / NCF Modificado *
                  </label>
                  <input
                    type="text"
                    value={ncfModificado}
                    onChange={(e) => setNcfModificado(e.target.value.toUpperCase())}
                    placeholder="Ej. E310000000001"
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Fecha Documento Original *
                  </label>
                  <input
                    type="date"
                    value={fechaNcfModificado}
                    onChange={(e) => setFechaNcfModificado(e.target.value)}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Código Motivo DGII *</label>
                  <select
                    value={codigoModificacion}
                    onChange={(e) => setCodigoModificacion(Number(e.target.value))}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value={1}>1 — Anula el NCF modificado</option>
                    <option value={2}>2 — Corrige texto del comprobante</option>
                    <option value={3}>3 — Corrige montos del NCF</option>
                    <option value={4}>4 — Reemplazo NCF emitido en contingencia</option>
                    <option value={5}>5 — Referencia a Factura Consumo Electrónica</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Razón / Detalle de Modificación (opcional)
                </label>
                <input
                  type="text"
                  value={razonModificacion}
                  onChange={(e) => setRazonModificacion(e.target.value)}
                  placeholder="Ej. Devolución parcial de mercancía o ajuste de precio"
                  className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>
          )}

          {/* Datos del Receptor / Cliente */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-900">Datos del Receptor / Cliente</span>

              <div className="flex items-center gap-2">
                {catalogCustomers.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const picked = catalogCustomers.find(
                        (c) => String(c.rnc || '') === e.target.value,
                      );
                      if (picked) {
                        setIdentificadorExtranjero('');
                        setRncComprador(String(picked.rnc || ''));
                        setRazonSocialComprador(String(picked.razonSocial || ''));
                      }
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    <option value="">Elegir cliente guardado ({catalogCustomers.length})</option>
                    {catalogCustomers.map((c) => (
                      <option key={c.id || c.rnc} value={c.rnc}>
                        {c.rnc} — {c.razonSocial}
                      </option>
                    ))}
                  </select>
                )}
                {verifyingRnc && (
                  <span className="text-[11px] text-sky-600 font-semibold inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Buscando DGII...
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  RNC o Cédula Receptor{' '}
                  {requiresRncAndName && <span className="text-rose-600">*</span>}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    list="customers-rnc-list"
                    value={rncComprador}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRncComprador(val);
                      if (val.trim()) setIdentificadorExtranjero('');
                      const cleanVal = val.replace(/\D/g, '');
                      const matchedCustomer = catalogCustomers.find(
                        (c) => String(c.rnc || '').replace(/\D/g, '') === cleanVal,
                      );
                      if (matchedCustomer?.razonSocial) {
                        setRazonSocialComprador(matchedCustomer.razonSocial);
                      }
                    }}
                    placeholder={
                      requiresRncAndName
                        ? tipoEcf === 45
                          ? 'RNC Institución (9 dígitos)'
                          : 'Obligatorio (9 u 11 dígitos)'
                        : 'Opcional (Consumidor Final)'
                    }
                    className={`flex-1 bg-white border rounded-xl px-3 py-2 text-xs font-mono ${
                      requiresRncAndName && ![9, 11].includes(cleanBuyerRnc.length)
                        ? 'border-amber-400 focus:border-amber-500'
                        : 'border-slate-300'
                    }`}
                  />
                  <button
                    type="button"
                    disabled={verifyingRnc || ![9, 11].includes(cleanBuyerRnc.length)}
                    onClick={() => handleVerifyBuyerRnc(rncComprador)}
                    className="px-2.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-45 text-white font-bold text-[11px] inline-flex items-center gap-1 shrink-0 transition cursor-pointer"
                    title="Consultar padrón DGII y autocompletar nombre"
                  >
                    {verifyingRnc ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>DGII</span>
                  </button>
                </div>
                <datalist id="customers-rnc-list">
                  {catalogCustomers.map((c) => (
                    <option key={c.id || c.rnc} value={c.rnc}>
                      {c.razonSocial}
                    </option>
                  ))}
                </datalist>
                {requiresRncAndName && ![9, 11].includes(cleanBuyerRnc.length) && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">
                    Ingresa un RNC o Cédula válido (9 u 11 dígitos numéricos).
                  </p>
                )}
                {rncLookupError && (
                  <p className="text-[11px] text-amber-700 font-medium mt-1">{rncLookupError}</p>
                )}
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Razón Social / Nombre Receptor{' '}
                  {(requiresRncAndName || requiresForeignOrRnc) && (
                    <span className="text-rose-600">*</span>
                  )}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={razonSocialComprador}
                    onChange={(e) => setRazonSocialComprador(e.target.value)}
                    placeholder={
                      requiresRncAndName
                        ? 'Autocompletado desde DGII o escribe el nombre'
                        : 'Consumidor Final'
                    }
                    className={`flex-1 bg-white border rounded-xl px-3 py-2 text-xs ${
                      (requiresRncAndName || requiresForeignOrRnc) && !razonSocialComprador.trim()
                        ? 'border-rose-300 focus:border-rose-500'
                        : 'border-slate-300'
                    }`}
                  />
                  {[9, 11].includes(cleanBuyerRnc.length) &&
                    razonSocialComprador.trim().length > 0 &&
                    !customerAlreadyExists && (
                      <button
                        type="button"
                        disabled={savingCustomer}
                        onClick={handleSaveCustomerToCatalog}
                        className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] inline-flex items-center gap-1 shrink-0 transition cursor-pointer"
                        title="Guardar este cliente para futuras facturas"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{savingCustomer ? '...' : 'Guardar'}</span>
                      </button>
                    )}
                </div>
                {requiresRncAndName && !razonSocialComprador.trim() && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">
                    La Razón Social es obligatoria para e-CF {tipoEcf}.
                  </p>
                )}
              </div>
            </div>

            {tipoEcf === 46 && (
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Identificador Extranjero (si el comprador no tiene RNC dominicano)
                </label>
                <input
                  type="text"
                  value={identificadorExtranjero}
                  onChange={(e) => {
                    const v = e.target.value;
                    setIdentificadorExtranjero(v);
                    if (v.trim()) setRncComprador('');
                  }}
                  placeholder="Ej. TAX-ID o Pasaporte del receptor extranjero"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>
            )}

            {rncChecked && (
              <div className="p-2.5 rounded-lg bg-emerald-100/70 border border-emerald-300 text-[11px] text-emerald-950 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span>
                    RNC Verificado en DGII:{' '}
                    <strong>{rncChecked.razonSocial || rncChecked.nombreRazonSocial}</strong>
                  </span>
                  {rncChecked.actividadEconomica && (
                    <span className="block text-[10px] text-emerald-800">
                      Actividad: {rncChecked.actividadEconomica}
                    </span>
                  )}
                </div>
                <span className="font-bold text-emerald-700">
                  Estado: {rncChecked.estado || 'ACTIVO'}
                </span>
              </div>
            )}

            {customerSavedMsg && (
              <div className="p-2 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-semibold">
                {customerSavedMsg}
              </div>
            )}
          </div>

          {/* Condiciones y Forma de Pago */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Tipo de Pago</label>
              <select
                value={tipoPago}
                onChange={(e) => setTipoPago(Number(e.target.value) as TipoPago)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
              >
                <option value={1}>1 — Contado</option>
                <option value={2}>2 — Crédito</option>
                <option value={3}>3 — Gratuito</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Forma de Pago</label>
              <select
                value={formaPago}
                onChange={(e) => setFormaPago(Number(e.target.value) as FormaPago)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
              >
                <option value={1}>1 — Efectivo</option>
                <option value={2}>2 — Cheque / Transferencia / Depósito</option>
                <option value={3}>3 — Tarjeta de Débito / Crédito</option>
                <option value={4}>4 — Venta a Crédito</option>
                {tipoEcf === 32 && <option value={5}>5 — Bonos o Certificados de regalo</option>}
                <option value={6}>6 — Permuta</option>
                <option value={7}>7 — Nota de Crédito</option>
                <option value={8}>8 — Otras Formas de Pago / Mixto</option>
              </select>
            </div>
            {tipoPago === 2 && (
              <div>
                <label className="block text-slate-700 font-bold mb-1">Fecha Límite Pago *</label>
                <input
                  type="date"
                  value={fechaLimitePago}
                  onChange={(e) => setFechaLimitePago(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                />
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
                className="px-3 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-bold flex items-center gap-1 border border-sky-200 transition cursor-pointer"
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
                  <div
                    key={index}
                    className="p-3 rounded-xl border border-slate-200 bg-white grid grid-cols-12 gap-2 text-xs items-center"
                  >
                    <div className="col-span-12 sm:col-span-4">
                      <input
                        type="text"
                        list="products-catalog-list"
                        placeholder="Descripción del bien o servicio"
                        value={item.nombreItem}
                        onChange={(e) => {
                          const val = e.target.value;
                          const matchedProd = catalogProducts.find(
                            (p) => (p.name || p.nombre || '').toLowerCase() === val.trim().toLowerCase(),
                          );
                          if (matchedProd) {
                            const forcedTax = [43, 44, 47].includes(tipoEcf)
                              ? 4
                              : tipoEcf === 46
                                ? 3
                                : Number(matchedProd.taxRate ?? matchedProd.indicadorFacturacion ?? 1);
                            const next = [...items];
                            next[index] = {
                              ...next[index],
                              nombreItem: val,
                              precioUnitarioItem: Number(
                                matchedProd.unitPrice ?? matchedProd.precio ?? next[index].precioUnitarioItem,
                              ),
                              indicadorFacturacion: forcedTax,
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
                        onChange={(e) =>
                          handleItemChange(index, 'precioUnitarioItem', Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-right font-mono"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <select
                        value={item.indicadorFacturacion}
                        disabled={[43, 44, 46, 47].includes(tipoEcf)}
                        onChange={(e) =>
                          handleItemChange(index, 'indicadorFacturacion', Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-slate-300 px-1.5 py-1.5 text-[11px] disabled:bg-slate-100"
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
                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 shrink-0 cursor-pointer"
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
              <div className="text-lg font-black text-slate-900">
                {formatDOP(calculated.totales.montoTotal)}
              </div>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                Atajos:{' '}
                <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 font-mono">
                  Ctrl+Enter
                </kbd>{' '}
                emitir ·{' '}
                <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 font-mono">
                  Ctrl+Shift+A
                </kbd>{' '}
                línea
              </span>
            </div>

            <button
              type="button"
              disabled={!canEmit}
              onClick={handleEmit}
              title={
                !isBuyerValid
                  ? `Completa los datos requeridos del comprador para e-CF ${tipoEcf}`
                  : undefined
              }
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 flex items-center gap-2 transition disabled:opacity-45 disabled:cursor-not-allowed btn-fx cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{emitting ? 'Firmando y Timbrando...' : 'Firmar y Emitir e-CF ante DGII'}</span>
            </button>
          </div>
        </div>

        {/* Vista Previa Derecha (5 cols) 100% marca blanca de tu empresa */}
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

      {/* Modal Rápido Activar Rango 1-100 inline */}
      {showQuickSeqModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-600" />
                Activar Rango para e-CF {tipoEcf}
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickSeqModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickRegisterSequence} className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '1 al 100', d: 1, h: 100 },
                  { label: '1 al 500', d: 1, h: 500 },
                  { label: '1 al 1,000', d: 1, h: 1000 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setQuickSeqDesde(p.d);
                      setQuickSeqHasta(p.h);
                    }}
                    className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] cursor-pointer ${
                      quickSeqDesde === p.d && quickSeqHasta === p.h
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Desde</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quickSeqDesde}
                    onChange={(e) => setQuickSeqDesde(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hasta</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quickSeqHasta}
                    onChange={(e) => setQuickSeqHasta(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-800">
                {formatEncfCode(tipoEcf, Math.max(1, quickSeqDesde))} ➔{' '}
                {formatEncfCode(tipoEcf, Math.max(quickSeqDesde, quickSeqHasta))}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Vencimiento DGII</label>
                <input
                  type="date"
                  value={quickSeqVencimiento}
                  onChange={(e) => setQuickSeqVencimiento(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickSeqModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingQuickSeq}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {savingQuickSeq && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar y Habilitar Emisión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto p-10 text-center text-xs text-slate-500">
          Cargando emisor de comprobantes e-CF...
        </div>
      }
    >
      <NewInvoiceContent />
    </Suspense>
  );
}
