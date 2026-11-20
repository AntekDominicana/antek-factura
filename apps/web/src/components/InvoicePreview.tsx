'use client';

import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { FileText, Code2, Receipt, Download, ShieldCheck, CheckCircle2, Printer, QrCode } from 'lucide-react';
import { API_BASE_URL, ECF_TYPE_LABELS, formatDOP } from '../lib/api';
import { downloadRawQrPng, downloadSignedQrStampPng } from '../lib/qr-stamp';

interface InvoicePreviewProps {
  tenant: any;
  draftInvoice: any;
  calculated: { items: any[]; totales: any };
  gtiPayload: any;
  emittedResult: any;
}

function formatDateDGII(val: any): string {
  if (!val) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}-${m}-${y}`;
  }
  if (val instanceof Date) {
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const y = val.getFullYear();
    return `${d}-${m}-${y}`;
  }
  const str = String(val);
  if (/^\d{2}-\d{2}-\d{4}/.test(str)) return str.slice(0, 10);
  try {
    const dObj = new Date(str);
    if (!isNaN(dObj.getTime())) {
      const d = String(dObj.getDate()).padStart(2, '0');
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const y = dObj.getFullYear();
      return `${d}-${m}-${y}`;
    }
  } catch {}
  return str;
}

export function InvoicePreview({
  tenant,
  draftInvoice,
  calculated,
  gtiPayload,
  emittedResult,
}: InvoicePreviewProps) {
  const [viewMode, setViewMode] = useState<'carta' | 'tirilla' | 'json'>('carta');
  const [downloadingQr, setDownloadingQr] = useState<'stamp' | 'raw' | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  const encf = emittedResult?.encf || `E${draftInvoice.tipoEcf}0000000001`;
  const fechaEmisionStr = formatDateDGII(draftInvoice?.fechaEmision || emittedResult?.fechaEmision);
  const qrUrl =
    emittedResult?.urlQr ||
    `https://ecf.dgii.gov.do/testecf/consultatimbre?rncemisor=${tenant?.rnc || '000000000'}&encf=${encf}&montototal=${calculated.totales.montoTotal}`;
  const secCode = emittedResult?.codigoSeguridad || '------';
  const fechaFirma = emittedResult?.fechaHoraFirma || 'Pendiente de firma XMLDSig';
  const brandColor = tenant?.brandColor || '#4f46e5';
  const cleanFooter = (tenant?.invoiceFooter || '')
    .replace(/emitido con\s+ANTEK\s+Factura/gi, 'válido ante la DGII')
    .replace(/ANTEK\s*Factura/gi, 'Sistema e-CF')
    .trim();

  const handleDownloadQrStamp = async () => {
    try {
      setDownloadingQr('stamp');
      await downloadSignedQrStampPng(qrContainerRef.current, {
        encf,
        tipoEcf: Number(draftInvoice?.tipoEcf) || undefined,
        rncEmisor: tenant?.rnc,
        razonSocialEmisor: tenant?.razonSocial || tenant?.nombreComercial,
        codigoSeguridad: emittedResult?.codigoSeguridad || null,
        fechaEmision: emittedResult?.fechaEmision || draftInvoice?.fechaEmision || null,
        fechaFirma: emittedResult?.fechaHoraFirma || null,
        montoTotal: calculated?.totales?.montoTotal ?? null,
        rncComprador:
          draftInvoice?.comprador?.rncComprador ||
          draftInvoice?.comprador?.rnc ||
          emittedResult?.rncComprador ||
          null,
        razonSocialComprador:
          draftInvoice?.comprador?.razonSocialComprador ||
          draftInvoice?.comprador?.razonSocial ||
          emittedResult?.razonSocialComprador ||
          null,
        brandColor,
      });
    } catch (err: any) {
      alert(err?.message || 'No se pudo generar la imagen QR + Firma.');
    } finally {
      setDownloadingQr(null);
    }
  };

  const handleDownloadRawQr = async () => {
    try {
      setDownloadingQr('raw');
      await downloadRawQrPng(qrContainerRef.current, encf);
    } catch (err: any) {
      alert(err?.message || 'No se pudo descargar el código QR.');
    } finally {
      setDownloadingQr(null);
    }
  };

  const handlePrintCustomInvoice = () => {
    if (typeof window === 'undefined' || !printAreaRef.current) return;
    const isTicket = viewMode === 'tirilla';
    const contentHtml = printAreaRef.current.innerHTML;
    const printWin = window.open('', '_blank', 'width=860,height=920');
    if (!printWin) return;
    printWin.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Factura ${encf} — ${tenant?.razonSocial || 'Comprobante Fiscal e-CF'}</title>
  <style>
    @page { ${isTicket ? 'size: 80mm auto; margin: 4mm;' : 'size: letter; margin: 14mm;'} }
    body { font-family: ${isTicket ? 'ui-monospace, monospace' : 'system-ui, -apple-system, sans-serif'}; color: #0f172a; margin: 0; padding: ${isTicket ? '4px' : '16px'}; }
    .invoice-sheet { max-width: ${isTicket ? '76mm' : '740px'}; margin: 0 auto; font-size: ${isTicket ? '11px' : '13px'}; }
    img { max-height: 70px; max-width: 210px; object-fit: contain; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { padding: 5px 4px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th:last-child, td:last-child, th:nth-child(2), td:nth-child(2) { text-align: right; }
    .no-print { display: none !important; }
  </style>
</head>
<body>
  <div class="invoice-sheet">
    ${contentHtml}
    <div style="margin-top: 18px; border-top: 1px dashed #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b; font-family: sans-serif;">
      <div>
        Emisor: <strong>${tenant?.razonSocial || 'Empresa Emisora'}</strong> (RNC: ${tenant?.rnc || '-'})
      </div>
      <div style="text-align: right;">
        Representación impresa de Comprobante Fiscal Electrónico (e-CF)<br/>
        <span style="font-size: 9px; color: #94a3b8;">Ley 32-23 DGII • Documento firmado digitalmente (.p12 / SHA-256)</span>
      </div>
    </div>
  </div>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
</body>
</html>`);
    printWin.document.close();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      {/* Header Switcher */}
      <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Vista Previa de tu Factura
          </span>
          {emittedResult && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3 h-3" />
              {emittedResult.status}
            </span>
          )}
        </div>

        <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setViewMode('carta')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition ${
              viewMode === 'carta'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Hoja Carta
          </button>
          <button
            type="button"
            onClick={() => setViewMode('tirilla')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition ${
              viewMode === 'tirilla'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Ticket 80mm
          </button>
          <button
            type="button"
            onClick={() => setViewMode('json')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition ${
              viewMode === 'json'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Datos Técnicos
          </button>
        </div>

        {viewMode !== 'json' && (
          <button
            type="button"
            onClick={handlePrintCustomInvoice}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir Personalizado (Con Logo)
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex-1 bg-slate-50/40">
        {viewMode === 'json' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] bg-slate-900 text-slate-300 px-3 py-2 rounded-lg">
              <span>
                Header <strong className="text-emerald-400">RetornarXml: 1</strong> (int)
              </span>
              <span className="text-amber-300 font-medium">Campos Cero Omitidos ✓</span>
            </div>
            <pre className="bg-slate-950 text-emerald-300 p-4 rounded-xl text-xs overflow-auto max-h-[520px] font-mono leading-relaxed">
              {JSON.stringify(gtiPayload, null, 2)}
            </pre>
          </div>
        ) : (
          <div
            ref={printAreaRef}
            style={{ borderTop: `4px solid ${brandColor}` }}
            className={`mx-auto border border-slate-200 rounded-xl bg-white p-6 shadow-sm transition-all ${
              viewMode === 'tirilla' ? 'max-w-[330px] font-mono text-xs' : 'w-full text-sm'
            }`}
          >
            {/* Top Bar Oficial de Documento Tributario */}
            <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-slate-200/80 text-[10px] text-slate-500 gap-2">
              <span className="font-bold tracking-wider text-slate-700 uppercase">
                {viewMode === 'tirilla'
                  ? 'Comprobante Fiscal e-CF Oficial'
                  : 'Documento Tributario Electrónico (Ley 32-23 DGII)'}
              </span>
              <span className="text-[10px] font-mono text-slate-500 uppercase">
                DGII · Rep. Dominicana
              </span>
            </div>

            {/* Header Emisor: Logo del Cliente (ej. Juan Pérez SRL) + Datos Fiscales */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                {tenant?.logoBase64 ? (
                  <div className="mb-2">
                    <img
                      src={tenant.logoBase64}
                      alt={tenant?.razonSocial || 'Logo del cliente'}
                      className={
                        viewMode === 'tirilla'
                          ? 'h-12 max-w-[170px] object-contain'
                          : 'h-14 max-w-[230px] object-contain'
                      }
                    />
                  </div>
                ) : (
                  <div className="mb-2 inline-flex items-center gap-2 p-2 rounded-xl bg-slate-100 border border-slate-200">
                    <span className="text-xs font-semibold text-slate-700">
                      {tenant?.razonSocial || 'Tu Empresa'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium no-print print:hidden">
                      (Sube tu logo en Configuración)
                    </span>
                  </div>
                )}
                <h3 className="font-bold text-slate-900 text-base">
                  {tenant?.razonSocial || 'Empresa sin configurar'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  RNC: <span className="font-mono font-semibold text-slate-700">{tenant?.rnc || 'Pendiente'}</span>
                </p>
                {tenant?.direccion && <p className="text-xs text-slate-500 mt-0.5">{tenant.direccion}</p>}
              </div>
              <div className={viewMode === 'tirilla' ? 'text-left' : 'text-right'}>
                <span
                  style={{
                    color: brandColor,
                    borderColor: `${brandColor}40`,
                    backgroundColor: `${brandColor}12`,
                  }}
                  className="inline-block px-2.5 py-1 rounded-md font-semibold text-[11px] border"
                >
                  e-CF {draftInvoice.tipoEcf} • {ECF_TYPE_LABELS[draftInvoice.tipoEcf]?.split(' - ')[1] || 'Comprobante e-CF'}
                </span>
                <div className="mt-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">e-CF / e-NCF:</span>
                  {emittedResult ? (
                    <p className="font-mono font-bold text-slate-900 text-base tracking-tight leading-none mt-0.5">{encf}</p>
                  ) : (
                    <p className="font-mono font-bold text-amber-600 text-xs tracking-tight leading-snug mt-0.5">
                      Pendiente de asignar
                    </p>
                  )}
                </div>
                <div className="mt-1.5 text-xs text-slate-600">
                  <span className="font-semibold text-slate-500">Fecha de Emisión: </span>
                  <strong className="font-mono font-bold text-slate-900">{fechaEmisionStr}</strong>
                </div>
                {draftInvoice.references?.[0]?.ncfModificado && (
                  <div className="text-[11px] text-indigo-700 font-medium mt-1 space-y-0.5">
                    <p>
                      NCF Modificado: <span className="font-mono">{draftInvoice.references[0].ncfModificado}</span>
                    </p>
                    <p>
                      {draftInvoice.references[0].codigoModificacion === 1
                        ? 'Anula el NCF modificado'
                        : draftInvoice.references[0].codigoModificacion === 2
                        ? 'Corrige Texto del Comprobante Fiscal modificado'
                        : draftInvoice.references[0].codigoModificacion === 3
                        ? 'Corrige montos del NCF modificado'
                        : 'Reemplazo NCF emitido en contingencia'}
                    </p>
                  </div>
                )}
                {draftInvoice.externalDocId && (
                  <p className="text-[11px] text-slate-500 mt-1">Ref: {draftInvoice.externalDocId}</p>
                )}
              </div>
            </div>

            {/* Comprador */}
            <div className="py-3.5 border-b border-slate-100 text-xs space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Receptor:</span>
                <span className={`font-semibold text-right ${!draftInvoice.comprador?.razonSocialComprador && draftInvoice.tipoEcf === 31 ? 'text-amber-600' : 'text-slate-800'}`}>
                  {draftInvoice.comprador?.razonSocialComprador ||
                    (draftInvoice.tipoEcf === 31
                      ? 'Receptor obligatorio (RNC requerido)'
                      : 'Consumidor Final')}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">RNC / ID:</span>
                <span className="font-mono text-slate-800">
                  {draftInvoice.comprador?.rncComprador ||
                    draftInvoice.comprador?.identificadorExtranjero ||
                    'N/A'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Condición:</span>
                <span className="text-slate-800">
                  {draftInvoice.tipoPago === 2
                    ? `Crédito (Vence ${draftInvoice.fechaLimitePago || '-'})`
                    : draftInvoice.tipoPago === 3
                    ? 'Gratuito'
                    : 'Contado'}
                </span>
              </div>
            </div>

            {/* Items */}
            <div className="py-3.5 border-b border-slate-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-200 text-[11px]">
                    <th className="text-left pb-2 font-semibold">Detalle</th>
                    <th className="text-right pb-2 font-semibold">Cant.</th>
                    <th className="text-right pb-2 font-semibold">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculated.items.map((item, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-2 text-slate-800">
                        <div className="font-medium">{item.nombreItem || 'Descripción pendiente'}</div>
                        <div className="text-[10px] text-slate-400">
                          ITBIS:{' '}
                          {item.indicadorFacturacion === 1
                            ? '18%'
                            : item.indicadorFacturacion === 2
                            ? '16%'
                            : item.indicadorFacturacion === 3
                            ? '0%'
                            : 'Exento'}
                        </div>
                      </td>
                      <td className="py-2 text-right text-slate-600">{item.cantidadItem}</td>
                      <td className="py-2 text-right font-semibold text-slate-900">
                        {formatDOP(item.montoItem)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="py-3.5 space-y-1.5 text-xs">
              {calculated.totales.montoGravadoI1 !== undefined && (
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Gravado 18%:</span>
                  <span>{formatDOP(calculated.totales.montoGravadoI1)}</span>
                </div>
              )}
              {calculated.totales.montoGravadoI2 !== undefined && (
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Gravado 16%:</span>
                  <span>{formatDOP(calculated.totales.montoGravadoI2)}</span>
                </div>
              )}
              {calculated.totales.montoExento !== undefined && (
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Exento:</span>
                  <span>{formatDOP(calculated.totales.montoExento)}</span>
                </div>
              )}
              {calculated.totales.totalItbis !== undefined && (
                <div className="flex justify-between text-slate-600">
                  <span>Total ITBIS:</span>
                  <span>{formatDOP(calculated.totales.totalItbis)}</span>
                </div>
              )}
              {calculated.totales.montoImpuestoAdicional > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Propina Legal (10%) / Otros Impuestos:</span>
                  <span>{formatDOP(calculated.totales.montoImpuestoAdicional)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 text-base pt-2.5 border-t border-slate-200">
                <span>TOTAL DOP:</span>
                <span>{formatDOP(calculated.totales.montoTotal)}</span>
              </div>
              {calculated.totales.montoTotalOtraMoneda !== undefined && draftInvoice.otraMoneda && (
                <div className="flex justify-between text-indigo-700 font-semibold text-xs">
                  <span>
                    Equivalente {draftInvoice.otraMoneda.tipoMoneda} (TC {draftInvoice.otraMoneda.tipoCambio}):
                  </span>
                  <span>
                    {draftInvoice.otraMoneda.tipoMoneda} {calculated.totales.montoTotalOtraMoneda.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Timbre QR DGII */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-4 bg-slate-50 p-3.5 rounded-xl">
              <div
                ref={qrContainerRef}
                className="bg-white p-1.5 rounded-lg border border-slate-200 shrink-0 shadow-xs"
              >
                <QRCodeSVG value={qrUrl} size={76} level="M" />
              </div>
              <div className="text-[11px] space-y-1 text-slate-600 min-w-0 flex-1">
                <div className="flex items-center gap-1 font-bold text-slate-900">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Timbre Fiscal Electrónico DGII
                </div>
                <p>
                  Código de Seguridad: <strong className="font-mono text-slate-900">{secCode}</strong>
                </p>
                <p>Fecha Firma: {fechaFirma}</p>
                <p className="truncate text-[10px] text-slate-400">Representación Impresa Ley 32-23</p>
              </div>
            </div>

            {cleanFooter && (
              <p className="mt-3 text-center text-[11px] text-slate-500 italic">
                {cleanFooter}
              </p>
            )}

            {(tenant?.contingencyMode || emittedResult?.status === 'CONTINGENCY_PENDING') && (
              <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-[11px] text-amber-950 font-semibold leading-snug">
                e-CF emitido en modalidad de Contingencia, el cual podrá ser consultado para su validez fiscal, a partir de las setenta y dos (72) horas.
              </div>
            )}

            {/* Descargas si ya está emitido */}
            {emittedResult && (
              <div className="mt-4 space-y-2 no-print">
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`${API_BASE_URL}/v1/invoices/${emittedResult.id}/pdf?template=1`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PDF Carta
                  </a>
                  <a
                    href={`${API_BASE_URL}/v1/invoices/${emittedResult.id}/pdf?template=5`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 transition"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    Tirilla 3&quot;
                  </a>
                  <a
                    href={`${API_BASE_URL}/v1/invoices/${emittedResult.id}/xml`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    XML Firmado
                  </a>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={downloadingQr !== null}
                    onClick={handleDownloadQrStamp}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-500 disabled:opacity-50 transition cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    {downloadingQr === 'stamp' ? 'Generando PNG...' : 'Descargar QR + Firma (.png)'}
                  </button>
                  <button
                    type="button"
                    disabled={downloadingQr !== null}
                    onClick={handleDownloadRawQr}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold hover:bg-slate-200 disabled:opacity-50 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloadingQr === 'raw' ? 'Descargando...' : 'Solo QR (.png)'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
