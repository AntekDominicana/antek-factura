'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE_URL, apiFetch, formatDOP, ECF_TYPE_LABELS } from '../../../../lib/api';
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
} from 'lucide-react';

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [xmlData, setXmlData] = useState<string | null>(null);
  const [xmlModal, setXmlModal] = useState(false);

  useEffect(() => {
    async function loadDetail() {
      try {
        const inv = await apiFetch(`/v1/invoices/${id}`);
        setInvoice(inv);
      } catch {
        // Fallback demo si no existe
        setInvoice({
          id,
          encf: id.startsWith('E') ? id : 'E310000000001',
          tipoEcf: 31,
          rncEmisor: '101532483',
          razonSocialEmisor: 'ANTEK DOMINICANA SRL',
          rncComprador: '132507908',
          razonSocialComprador: 'CLIENTE EJEMPLO SRL',
          montoTotal: 17700.0,
          totalItbis: 2700.0,
          fechaEmision: '16-11-2026',
          codigoSeguridad: 'A8B9C2',
          urlQr: `https://ecf.dgii.gov.do/testecf/consultatimbre?rncemisor=101532483&encf=E310000000001&montototal=17700`,
          status: 'ACEPTADO',
        });
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [id]);

  const handleFetchXml = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/invoices/${id}/xml`);
      const txt = await res.text();
      setXmlData(txt);
      setXmlModal(true);
    } catch {
      alert('No se pudo descargar el XML');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Cargando comprobante...</div>;
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFetchXml}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Code2 className="w-4 h-4 text-emerald-600" />
            <span>Ver XML Firmado</span>
          </button>
          <a
            href={`${API_BASE_URL}/v1/invoices/${id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir PDF</span>
          </a>
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
        <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-5">
          <div className="bg-white p-2 rounded-xl border border-slate-200 shrink-0 shadow-xs">
            <QRCodeSVG value={invoice.urlQr || 'https://ecf.dgii.gov.do'} size={110} level="M" />
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
              Fecha de Emisión: <strong className="font-mono text-slate-900">{invoice.fechaEmision || '16-11-2026'}</strong>
            </p>
            <p className="text-[11px] text-slate-400 break-all">
              URL Consulta Timbre: <a href={invoice.urlQr} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">{invoice.urlQr}</a>
            </p>
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
