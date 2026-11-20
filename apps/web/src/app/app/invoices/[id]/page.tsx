'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE_URL, apiFetch, apiDownload, formatDOP, ECF_TYPE_LABELS } from '../../../../lib/api';
import { downloadRawQrPng, downloadSignedQrStampPng } from '../../../../lib/qr-stamp';
import {
  ArrowLeft,
  Receipt,
  Download,
  Code2,
  ShieldCheck,
  CheckCircle2,
  Printer,
  Copy,
  ExternalLink,
  QrCode,
} from 'lucide-react';

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [xmlData, setXmlData] = useState<string | null>(null);
  const [xmlModal, setXmlModal] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState<'stamp' | 'raw' | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadDetail() {
      setError(null);
      try {
        const inv = await apiFetch(`/v1/invoices/${id}`);
        setInvoice(inv);
      } catch (err: any) {
        setInvoice(null);
        setError(err?.message || 'No se encontró este comprobante fiscal electrónico.');
      } finally {
        setLoading(false);
      }
    }
    if (id) loadDetail();
  }, [id]);

  const handleFetchXml = async () => {
    try {
      const txt = await apiFetch<string>(`/v1/invoices/${id}/xml`);
      setXmlData(typeof txt === 'string' ? txt : JSON.stringify(txt, null, 2));
      setXmlModal(true);
    } catch (err: any) {
      alert(err?.message || 'No se pudo descargar el XML');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Cargando comprobante...</div>;
  }

  if (error || !invoice) {
    return (
      <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
        <Receipt className="w-8 h-8 text-slate-400 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Comprobante no disponible</h2>
        <p className="text-xs text-slate-500">{error || 'El e-CF solicitado no existe o no pertenece a tu empresa.'}</p>
        <Link
          href="/app/invoices"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Listado
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top action */}
      <div className="flex items-center justify-between">
        <Link
          href="/app/invoices"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Listado
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleFetchXml}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Code2 className="w-4 h-4 text-emerald-600" />
            <span>Ver XML Firmado</span>
          </button>
          <button
            type="button"
            onClick={() =>
              apiDownload(`/v1/invoices/${id}/xml`, `${invoice.encf || id}.xml`).catch((err) =>
                alert(err?.message || 'No se pudo descargar el XML'),
              )
            }
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Descargar XML</span>
          </button>
          <button
            type="button"
            onClick={() =>
              apiDownload(`/v1/invoices/${id}/pdf`, `${invoice.encf || id}.pdf`).catch((err) =>
                alert(err?.message || 'No se pudo descargar el PDF')
              )
            }
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir PDF</span>
          </button>
        </div>
      </div>

      {/* Tarjeta de Ficha Oficial DGII */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold border border-sky-200">
                {ECF_TYPE_LABELS[invoice.tipoEcf] || `e-CF ${invoice.tipoEcf}`}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Estado: Aceptado DGII
              </span>
            </div>
            <h1 className="text-2xl font-black font-mono text-slate-900 mt-2">{invoice.encf}</h1>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500">Monto Total:</span>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {formatDOP(invoice.montoTotal)}
            </div>
          </div>
        </div>

        {/* Timbre Fiscal Oficial */}
        <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div
              ref={qrContainerRef}
              className="bg-white p-2 rounded-xl border border-slate-200 shrink-0 shadow-xs"
            >
              <QRCodeSVG value={invoice.urlQr || 'https://ecf.dgii.gov.do'} size={116} level="M" />
            </div>
            <div className="space-y-1.5 text-xs text-slate-600 flex-1 min-w-0">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Timbre Fiscal Electrónico DGII Oficial
              </div>
              <p>
                Código de Seguridad: <strong className="font-mono text-slate-900">{invoice.codigoSeguridad || 'N/A'}</strong>
              </p>
              <p>
                Fecha de Emisión: <strong className="font-mono text-slate-900">{invoice.fechaEmision || '—'}</strong>
              </p>
              <p>
                Fecha / Hora Firma Digital:{' '}
                <strong className="font-mono text-slate-900">
                  {invoice.fechaHoraFirma
                    ? new Date(invoice.fechaHoraFirma).toLocaleString('es-DO')
                    : invoice.createdAt
                      ? new Date(invoice.createdAt).toLocaleString('es-DO')
                      : invoice.fechaEmision || '—'}
                </strong>
              </p>
              <p className="text-[11px] text-slate-400 break-all">
                URL Consulta Timbre:{' '}
                <a href={invoice.urlQr} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">
                  {invoice.urlQr}
                </a>
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/80 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={downloadingQr !== null}
              onClick={async () => {
                try {
                  setDownloadingQr('stamp');
                  await downloadSignedQrStampPng(qrContainerRef.current, {
                    encf: invoice.encf || id,
                    tipoEcf: Number(invoice.tipoEcf) || undefined,
                    rncEmisor: invoice.rncEmisor,
                    razonSocialEmisor: invoice.razonSocialEmisor,
                    codigoSeguridad: invoice.codigoSeguridad,
                    fechaEmision: invoice.fechaEmision,
                    fechaFirma: invoice.fechaHoraFirma || invoice.createdAt || invoice.fechaEmision,
                    montoTotal: invoice.montoTotal,
                    rncComprador: invoice.rncComprador,
                    razonSocialComprador: invoice.razonSocialComprador,
                  });
                } catch (err: any) {
                  alert(err?.message || 'No se pudo descargar el QR con firma');
                } finally {
                  setDownloadingQr(null);
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 transition cursor-pointer"
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
                  await downloadRawQrPng(qrContainerRef.current, invoice.encf || id);
                } catch (err: any) {
                  alert(err?.message || 'No se pudo descargar el QR');
                } finally {
                  setDownloadingQr(null);
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadingQr === 'raw' ? 'Descargando...' : 'Solo QR (.png)'}</span>
            </button>
          </div>
        </div>

        {/* Tabla Datos Emisor y Receptor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
            <div className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Emisor</div>
            <div className="font-bold text-slate-900 text-sm">{invoice.razonSocialEmisor}</div>
            <div className="font-mono text-slate-600">RNC: {invoice.rncEmisor}</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
            <div className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Receptor / Comprador</div>
            <div className="font-bold text-slate-900 text-sm">{invoice.razonSocialComprador || 'Consumidor Final'}</div>
            <div className="font-mono text-slate-600">RNC / Cédula: {invoice.rncComprador || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Modal XML Firmado */}
      {xmlModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-400" /> XMLDSig Firmado Inmutable ({invoice.encf})
              </h3>
              <button
                type="button"
                onClick={() => setXmlModal(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs"
              >
                Cerrar
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 text-emerald-300 font-mono text-xs overflow-auto max-h-[400px]">
              {xmlData || 'Cargando XML...'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
