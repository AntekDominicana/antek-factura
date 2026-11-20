'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  FileText,
  Download,
  CheckCircle2,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { API_BASE_URL, apiFetch, ECF_TYPE_LABELS, formatDOP } from '../../../../lib/api';
import { downloadRawQrPng, downloadSignedQrStampPng } from '../../../../lib/qr-stamp';

function PublicInvoiceViewContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const encfParam = searchParams.get('encf');

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingQr, setDownloadingQr] = useState<'stamp' | 'raw' | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiFetch<any>(`/v1/invoices/${id}/status`)
      .then((data) => {
        setInvoice(data);
      })
      .catch((err: any) => {
        setInvoice(null);
        setError(err?.message || 'No se encontró este comprobante fiscal electrónico.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const encfDisplay = invoice?.encf || encfParam || id;
  const tipoEcfLabel =
    ECF_TYPE_LABELS[Number(invoice?.tipoEcf)] || 'Comprobante Fiscal Electrónico (e-CF)';
  const qrUrl =
    invoice?.urlQr ||
    `https://ecf.dgii.gov.do/ecf/consultatimbre?rncemisor=${invoice?.rncEmisor || ''}&encf=${encfDisplay}&montototal=${invoice?.montoTotal || 0}`;
  const fechaFirmaDisplay = invoice?.fechaHoraFirma
    ? new Date(invoice.fechaHoraFirma).toLocaleString('es-DO')
    : invoice?.createdAt
      ? new Date(invoice.createdAt).toLocaleString('es-DO')
      : invoice?.fechaEmision || '—';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between text-slate-800 selection:bg-sky-500 selection:text-white">
      {/* Top Banner 100% marca blanca del emisor */}
      <header className="bg-slate-950 text-white border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="text-sm font-black tracking-tight text-white truncate">
              {invoice?.razonSocialEmisor || 'Comprobante Fiscal Electrónico'}
            </div>
            {invoice?.rncEmisor && (
              <div className="text-[11px] font-mono text-slate-400">RNC {invoice.rncEmisor}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-emerald-400">Comprobante Fiscal Válido DGII</span>
        </div>
      </header>

      {/* Card Principal de la Factura */}
      <main className="max-w-2xl w-full mx-auto p-4 sm:p-6 my-auto">
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-10 text-center text-sm text-slate-500">
            Consultando comprobante fiscal en DGII...
          </div>
        ) : error || !invoice ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center space-y-2">
            <h1 className="text-lg font-black text-slate-900">Comprobante no encontrado</h1>
            <p className="text-xs text-slate-500">
              {error || 'No fue posible localizar este comprobante fiscal electrónico.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            {/* Cabecera del Documento */}
            <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-850 text-white border-b border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                    {tipoEcfLabel}
                  </span>
                  <h1 className="text-2xl font-black font-mono tracking-tight text-white mt-0.5">
                    {encfDisplay}
                  </h1>
                </div>

                <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-extrabold flex items-center gap-1.5 w-fit">
                  <CheckCircle2 className="w-4 h-4" />
                  {invoice?.status || 'Aceptado por DGII'}
                </div>
              </div>
            </div>

            {/* Detalles */}
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-xs text-slate-400 font-semibold">Fecha de Emisión</div>
                  <div className="font-bold text-slate-900 mt-1">
                    {invoice?.createdAt
                      ? new Date(invoice.createdAt).toLocaleDateString('es-DO')
                      : invoice?.fechaEmision || '—'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-xs text-slate-400 font-semibold">RNC Emisor</div>
                  <div className="font-mono font-bold text-slate-900 mt-1">
                    {invoice?.rncEmisor || '—'}
                  </div>
                </div>
              </div>

              {(invoice?.rncComprador || invoice?.razonSocialComprador) && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-400 font-semibold block">Receptor / Comprador</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {invoice?.razonSocialComprador || 'Contribuyente'}
                    </span>
                  </div>
                  {invoice?.rncComprador && (
                    <span className="font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      RNC: {invoice.rncComprador}
                    </span>
                  )}
                </div>
              )}

              {/* Total e ITBIS */}
              <div className="p-5 rounded-2xl bg-sky-50/60 border border-sky-100 flex items-center justify-between">
                <div>
                  <div className="text-xs text-sky-800 font-bold uppercase tracking-wider">
                    ITBIS Facturado
                  </div>
                  <div className="text-base font-bold text-slate-700 font-mono mt-0.5">
                    {formatDOP(Number(invoice?.totalItbis || 0))}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-sky-800 font-bold uppercase tracking-wider">
                    Monto Total a Pagar
                  </div>
                  <div className="text-2xl font-black text-slate-950 font-mono mt-0.5">
                    {formatDOP(Number(invoice?.montoTotal || 0))}
                  </div>
                </div>
              </div>

              {/* Timbre QR y Firma Digital */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div
                    ref={qrContainerRef}
                    className="bg-white p-2 rounded-xl border border-slate-200 shrink-0 shadow-xs"
                  >
                    <QRCodeSVG value={qrUrl} size={96} level="M" />
                  </div>
                  <div className="text-xs text-slate-600 space-y-1 flex-1 min-w-0">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Timbre Fiscal y Firma Digital DGII
                    </div>
                    <p>
                      Código de Seguridad:{' '}
                      <strong className="font-mono text-slate-900">
                        {invoice?.codigoSeguridad || 'N/A'}
                      </strong>
                    </p>
                    <p>
                      Fecha / Hora Firma:{' '}
                      <strong className="font-mono text-slate-900">{fechaFirmaDisplay}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/80">
                  <button
                    type="button"
                    disabled={downloadingQr !== null}
                    onClick={async () => {
                      try {
                        setDownloadingQr('stamp');
                        await downloadSignedQrStampPng(qrContainerRef.current, {
                          encf: encfDisplay,
                          tipoEcf: Number(invoice?.tipoEcf) || undefined,
                          rncEmisor: invoice?.rncEmisor,
                          razonSocialEmisor: invoice?.razonSocialEmisor,
                          codigoSeguridad: invoice?.codigoSeguridad,
                          fechaEmision: invoice?.fechaEmision || invoice?.createdAt,
                          fechaFirma: invoice?.fechaHoraFirma || invoice?.createdAt,
                          montoTotal: Number(invoice?.montoTotal ?? 0),
                          rncComprador: invoice?.rncComprador,
                          razonSocialComprador: invoice?.razonSocialComprador,
                        });
                      } catch (err: any) {
                        alert(err?.message || 'No se pudo descargar el QR con firma');
                      } finally {
                        setDownloadingQr(null);
                      }
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold disabled:opacity-50 transition cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>{downloadingQr === 'stamp' ? 'Generando PNG...' : 'Descargar QR + Firma (.png)'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={downloadingQr !== null}
                    onClick={async () => {
                      try {
                        setDownloadingQr('raw');
                        await downloadRawQrPng(qrContainerRef.current, encfDisplay);
                      } catch (err: any) {
                        alert(err?.message || 'No se pudo descargar el código QR');
                      } finally {
                        setDownloadingQr(null);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold disabled:opacity-50 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{downloadingQr === 'raw' ? 'Descargando...' : 'Solo QR (.png)'}</span>
                  </button>
                </div>
              </div>

              {/* Botones de Descarga PDF y XML */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <a
                  href={`${API_BASE_URL}/v1/invoices/${id}/pdf?template=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-md shadow-sky-500/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descargar Factura PDF
                </a>

                <a
                  href={`${API_BASE_URL}/v1/invoices/${id}/xml`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-sm border border-slate-700 transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-sky-400" />
                  Descargar XML e-CF Firmado
                </a>
              </div>
            </div>

            {/* Footer del card */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Comprobante fiscal con valor tributario según Ley 32-23 de Facturación Electrónica en RD.
            </div>
          </div>
        )}
      </main>

      {/* Footer General sin branding de terceros */}
      <footer className="p-4 text-center text-xs text-slate-500">
        Comprobante Fiscal Electrónico emitido conforme a la Ley 32-23 de la Dirección General de Impuestos Internos (DGII) · República Dominicana
      </footer>
    </div>
  );
}

export default function PublicInvoiceViewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm text-slate-500">
          Cargando comprobante fiscal...
        </div>
      }
    >
      <PublicInvoiceViewContent />
    </Suspense>
  );
}
