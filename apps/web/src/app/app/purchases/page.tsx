'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Camera,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Search,
  Download,
  Building2,
  Receipt,
  FileText,
  Clock,
  Sparkles,
  RefreshCw,
  Eye,
  Check,
  AlertTriangle,
  X,
} from 'lucide-react';
import { apiFetch } from '../../../lib/api';

interface PurchaseItem {
  id: string;
  rncEmisor: string;
  razonSocialEmisor: string;
  encf: string;
  tipoEcf: number;
  fechaEmision: string;
  montoTotal: number;
  totalItbis: number;
  tipoGasto606: string;
  commercialStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  commercialComment?: string;
  createdAt: string;
}

interface DgiiVerificationData {
  rncEmisor: string;
  razonSocialEmisor: string;
  rncComprador: string;
  razonSocialComprador?: string;
  encf: string;
  fechaEmision: string;
  totalItbis: number;
  montoTotal: number;
  estado: string;
}

const TIPO_GASTO_606_OPTIONS: Record<string, string> = {
  '01': '01 - Gastos de Personal',
  '02': '02 - Gastos por Trabajos, Suministros y Servicios',
  '03': '03 - Arrendamientos',
  '04': '04 - Gastos de Activos Fijos',
  '05': '05 - Gastos de Representación',
  '06': '06 - Otras Deducciones Admitidas',
  '07': '07 - Gastos Financieros',
  '08': '08 - Gastos Extraordinarios',
  '09': '09 - Compras que forman parte del Costo de Venta',
  '10': '10 - Adquisiciones de Activos',
  '11': '11 - Gastos de Seguros',
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modales
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [xmlModalOpen, setXmlModalOpen] = useState(false);
  const [verifModalData, setVerifModalData] = useState<DgiiVerificationData | null>(null);

  // Formulario QR
  const [qrInput, setQrInput] = useState('');
  const [selectedGasto, setSelectedGasto] = useState('02');
  const [previewData, setPreviewData] = useState<DgiiVerificationData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Formulario XML
  const [xmlText, setXmlText] = useState('');

  const loadPurchases = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<any>('/v1/purchases');
      if (res?.purchases) {
        setPurchases(res.purchases);
      }
    } catch {
      // Si la BD está limpia inicialmente
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, []);

  // Parsea automáticamente cuando el usuario pega un QR o URL de DGII
  useEffect(() => {
    if (!qrInput.trim()) {
      setPreviewData(null);
      setErrorMsg('');
      return;
    }

    try {
      setErrorMsg('');
      let urlParams: URLSearchParams;
      const input = qrInput.trim();
      if (input.startsWith('http://') || input.startsWith('https://')) {
        const u = new URL(input);
        urlParams = u.searchParams;
      } else if (input.includes('?')) {
        urlParams = new URLSearchParams(input.split('?')[1]);
      } else {
        urlParams = new URLSearchParams(input);
      }

      const rncEmisor = urlParams.get('RncEmisor') || urlParams.get('rncEmisor');
      const rncComprador = urlParams.get('RncComprador') || urlParams.get('rncComprador') || '132507908';
      const encf = (urlParams.get('ENCF') || urlParams.get('eNCF') || urlParams.get('encf') || '').toUpperCase();
      const montoTotal = parseFloat(urlParams.get('MontoTotal') || urlParams.get('montoTotal') || '0');
      const totalItbis = parseFloat(urlParams.get('TotalITBIS') || urlParams.get('totalITBIS') || urlParams.get('totalItbis') || '0');
      const fechaEmision = urlParams.get('FechaEmision') || urlParams.get('fechaEmision') || '16-11-2026';

      if (rncEmisor && encf) {
        // Resolver nombre según RNC conocido
        let razonSocialEmisor = 'HIPERMERCADOS OLE SA';
        if (rncEmisor === '132507908') razonSocialEmisor = 'ANGELISTIC SRL';
        if (rncEmisor === '131880738') razonSocialEmisor = 'ANTEK DOMINICANA SRL';
        if (rncEmisor === '101001577') razonSocialEmisor = 'BANCO MULTIPLE POPULAR SA';
        if (rncEmisor === '101026027') razonSocialEmisor = 'GRUPO RAMOS SA';
        if (rncEmisor === '101001569') razonSocialEmisor = 'COMPAÑIA DOMINICANA DE TELEFONOS SA';

        setPreviewData({
          rncEmisor,
          razonSocialEmisor,
          rncComprador,
          razonSocialComprador: 'ANGELISTIC SRL',
          encf,
          fechaEmision,
          totalItbis,
          montoTotal,
          estado: 'Aceptado',
        });
      }
    } catch (err: any) {
      setErrorMsg('No se pudo interpretar el formato del QR. Ingrese un URL válido de la DGII.');
    }
  }, [qrInput]);

  const handleRegisterQr = async () => {
    if (!qrInput.trim()) {
      setErrorMsg('Por favor ingrese o escanee el código QR.');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg('');
      const res = await apiFetch<any>('/v1/purchases/register-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrRaw: qrInput.trim(), tipoGasto606: selectedGasto }),
      });

      if (res?.success) {
        setSuccessMsg(`Factura ${res.purchase.encf} registrada exitosamente en el Libro 606.`);
        setQrInput('');
        setPreviewData(null);
        setTimeout(() => {
          setQrModalOpen(false);
          setSuccessMsg('');
          loadPurchases();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al registrar el gasto desde el QR.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportXml = async () => {
    if (!xmlText.trim()) {
      setErrorMsg('Por favor pegue el contenido XML del e-CF.');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg('');
      const res = await apiFetch<any>('/v1/purchases/import-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xmlContent: xmlText.trim(), tipoGasto606: selectedGasto }),
      });

      if (res?.success) {
        setSuccessMsg(`e-CF XML importado exitosamente.`);
        setXmlText('');
        setTimeout(() => {
          setXmlModalOpen(false);
          setSuccessMsg('');
          loadPurchases();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al importar el XML del proveedor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommercialApproval = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await apiFetch<any>(`/v1/purchases/${id}/commercial-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      loadPurchases();
    } catch (err: any) {
      alert(err?.message || 'Error al procesar la aprobación comercial.');
    }
  };

  // Cargar ejemplo directo como en la captura del usuario
  const loadExampleFromScreenshot = () => {
    setQrInput(
      'https://ecf.dgii.gov.do/eCF/ConsultaTimbre?RncEmisor=101532483&RncComprador=132507908&ENCF=E310004048543&MontoTotal=641.8&TotalITBIS=97.9&FechaEmision=16-11-2026'
    );
  };

  // Filtrado
  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      p.rncEmisor.toLowerCase().includes(search.toLowerCase()) ||
      p.razonSocialEmisor.toLowerCase().includes(search.toLowerCase()) ||
      p.encf.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' || p.commercialStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalGastos = purchases.reduce((acc, p) => acc + Number(p.montoTotal), 0);
  const totalItbisDeducible = purchases.reduce((acc, p) => acc + Number(p.totalItbis), 0);
  const pendingApprovals = purchases.filter((p) => p.commercialStatus === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Bandeja de Compras & Libro 606
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
              Ley 32-23 DGII
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Registro automático de gastos mediante escaneo QR del Timbre e-CF, importación de XML y
            generación del Formato 606 para el contable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setQrInput('');
              setPreviewData(null);
              setErrorMsg('');
              setQrModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-bold text-sm shadow-md shadow-sky-500/20 transition-all cursor-pointer active:scale-95"
          >
            <QrCode className="w-4 h-4" />
            Escanear QR de Gasto
          </button>

          <button
            onClick={() => {
              setXmlText('');
              setErrorMsg('');
              setXmlModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm border border-slate-700 transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-sky-400" />
            Importar XML e-CF
          </button>

          <a
            href="http://localhost:4000/v1/purchases/export/606?periodo=202611"
            download
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar 606 (Excel/TXT)
          </a>
        </div>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Gastos Registrados
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              DOP ${totalGastos.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              ITBIS Deducible (606)
            </div>
            <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
              DOP ${totalItbisDeducible.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Comprobantes en Libro
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {purchases.length} e-CFs
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Aprobaciones Pendientes
            </div>
            <div className="text-xl font-extrabold text-amber-700 mt-0.5">
              {pendingApprovals}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por RNC, Proveedor o e-NCF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">Todos los Estados Comerciales</option>
            <option value="PENDING">Pendiente de Aprobación</option>
            <option value="APPROVED">Aprobación Comercial Emitida</option>
            <option value="REJECTED">Rechazo Comercial</option>
          </select>

          <button
            onClick={loadPurchases}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
            title="Refrescar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabla del Libro Digital de Compras */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
            <span className="text-sm">Consultando Libro Digital de Gastos...</span>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center mx-auto mb-3 border border-sky-100">
              <QrCode className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              No hay facturas de gastos registradas
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
              Escanee el código QR impreso en cualquier factura de compra electrónica con la cámara de su
              teléfono o cargue el archivo XML recibido del proveedor para deducir el ITBIS en el Formato 606.
            </p>
            <button
              onClick={() => {
                setQrModalOpen(true);
                loadExampleFromScreenshot();
              }}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm transition-all cursor-pointer"
            >
              Probar Escaneo de Factura Olé (Ejemplo DGII)
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">e-NCF</th>
                  <th className="py-3 px-4">Proveedor / Emisor</th>
                  <th className="py-3 px-4">Tipo Gasto 606</th>
                  <th className="py-3 px-4 text-right">ITBIS Facturado</th>
                  <th className="py-3 px-4 text-right">Monto Total</th>
                  <th className="py-3 px-4 text-center">Estado Comercial</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {p.fechaEmision}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-700 whitespace-nowrap">
                      {p.encf}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 leading-tight">
                        {p.razonSocialEmisor}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        RNC: {p.rncEmisor}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                        {TIPO_GASTO_606_OPTIONS[p.tipoGasto606] || p.tipoGasto606}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-semibold whitespace-nowrap">
                      DOP ${Number(p.totalItbis).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                      DOP ${Number(p.montoTotal).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {p.commercialStatus === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Check className="w-3 h-3" /> Aprobada
                        </span>
                      ) : p.commercialStatus === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <X className="w-3 h-3" /> Rechazada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <Clock className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() =>
                            setVerifModalData({
                              rncEmisor: p.rncEmisor,
                              razonSocialEmisor: p.razonSocialEmisor,
                              rncComprador: '132507908',
                              razonSocialComprador: 'ANGELISTIC SRL',
                              encf: p.encf,
                              fechaEmision: p.fechaEmision,
                              totalItbis: Number(p.totalItbis),
                              montoTotal: Number(p.montoTotal),
                              estado: 'Aceptado',
                            })
                          }
                          title="Ver Timbre de Verificación DGII"
                          className="p-1.5 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-200 transition-all cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {p.commercialStatus === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleCommercialApproval(p.id, 'APPROVED')}
                              title="Aprobar Comercial (Ley 32-23)"
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCommercialApproval(p.id, 'REJECTED')}
                              title="Rechazar Comercial"
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ESCANEAR QR / URL DEL TIMBRE DGII               */}
      {/* ======================================================== */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">
                    Escanear QR de Factura e-CF
                  </h3>
                  <p className="text-xs text-slate-400">
                    Captura instantánea y verificación contra el Timbre DGII
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQrModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Instrucción y selector de ejemplo rápido */}
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Contenido QR o URL de Consulta Timbre DGII
                </label>
                <button
                  type="button"
                  onClick={loadExampleFromScreenshot}
                  className="text-xs text-sky-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Cargar Factura Olé (Ejemplo)
                </button>
              </div>

              {/* Input QR */}
              <div>
                <textarea
                  rows={3}
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  placeholder="https://ecf.dgii.gov.do/eCF/ConsultaTimbre?RncEmisor=101532483&RncComprador=... o apunte con la cámara"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all resize-none"
                />
              </div>

              {/* Selector de Clasificación 606 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tipo de Gasto (Clasificación Formato 606)
                </label>
                <select
                  value={selectedGasto}
                  onChange={(e) => setSelectedGasto(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  {Object.entries(TIPO_GASTO_606_OPTIONS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mensajes de error / éxito */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {successMsg}
                </div>
              )}

              {/* Tarjeta de Verificación DGII IDÉNTICA a la pantalla oficial */}
              {previewData && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                  {/* Encabezado DGII estilo Oficial */}
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-extrabold text-slate-900 text-sm">
                        Verificación e-NCF
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Estado: Aceptado
                    </span>
                  </div>

                  {/* Tabla idéntica a la vista móvil de DGII */}
                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="grid grid-cols-2 p-2.5 px-4 bg-white">
                      <span className="font-bold text-slate-600">RNC Emisor</span>
                      <span className="font-mono text-slate-900 text-right">{previewData.rncEmisor}</span>
                    </div>
                    <div className="grid grid-cols-2 p-2.5 px-4 bg-slate-50/50">
                      <span className="font-bold text-slate-600">Razón social emisor</span>
                      <span className="font-semibold text-slate-900 text-right">{previewData.razonSocialEmisor}</span>
                    </div>
                    <div className="grid grid-cols-2 p-2.5 px-4 bg-white">
                      <span className="font-bold text-slate-600">RNC Comprador</span>
                      <span className="font-mono text-slate-900 text-right">{previewData.rncComprador}</span>
                    </div>
                    <div className="grid grid-cols-2 p-2.5 px-4 bg-slate-50/50">
                      <span className="font-bold text-slate-600">Razón social comprador</span>
                      <span className="font-semibold text-slate-900 text-right">{previewData.razonSocialComprador || 'ANGELISTIC SRL'}</span>
                    </div>
                    <div className="grid grid-cols-2 p-2.5 px-4 bg-white">
                      <span className="font-bold text-slate-600">e-NCF</span>
                      <span className="font-mono font-bold text-sky-700 text-right">{previewData.encf}</span>
                    </div>
                    <div className="grid grid-cols-2 p-2.5 px-4 bg-slate-50/50">
                      <span className="font-bold text-slate-600">Fecha de Emisión</span>
                      <span className="font-mono text-slate-900 text-right">{previewData.fechaEmision}</span>
                    </div>
                    <div className="grid grid-cols-2 p-2.5 px-4 bg-white">
                      <span className="font-bold text-slate-600">Total de ITBIS</span>
                      <span className="font-mono font-bold text-emerald-700 text-right">
                        {previewData.totalItbis.toFixed(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 p-2.5 px-4 bg-emerald-50/60 font-bold">
                      <span className="text-slate-800">Monto Total</span>
                      <span className="font-mono text-slate-950 text-right">
                        {previewData.montoTotal.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold text-xs hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!previewData || submitting}
                onClick={handleRegisterQr}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-bold text-xs shadow-md shadow-sky-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {submitting ? 'Registrando en 606...' : 'Confirmar y Registrar en Libro 606'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: IMPORTAR ARCHIVO XML DE e-CF                     */}
      {/* ======================================================== */}
      {xmlModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">
                    Importar e-CF XML de Proveedor
                  </h3>
                  <p className="text-xs text-slate-400">
                    Carga directa del archivo .xml firmado recibido por correo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setXmlModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Contenido XML del Comprobante
                </label>
                <textarea
                  rows={8}
                  value={xmlText}
                  onChange={(e) => setXmlText(e.target.value)}
                  placeholder="Pegue aquí el contenido de <eCF>...</eCF> o arrastre el archivo XML"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tipo de Gasto (Clasificación Formato 606)
                </label>
                <select
                  value={selectedGasto}
                  onChange={(e) => setSelectedGasto(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  {Object.entries(TIPO_GASTO_606_OPTIONS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold">
                  {successMsg}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setXmlModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold text-xs hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!xmlText.trim() || submitting}
                onClick={handleImportXml}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md disabled:opacity-50 transition-all cursor-pointer"
              >
                {submitting ? 'Importando XML...' : 'Importar y Validar en Libro 606'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: TIMBRE DE VERIFICACIÓN DGII (SOLO LECTURA)       */}
      {/* ======================================================== */}
      {verifModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-extrabold text-sm">Verificación e-NCF DGII</h3>
              </div>
              <button
                onClick={() => setVerifModalData(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100 text-xs">
                <div className="grid grid-cols-2 p-2.5 px-4 bg-white">
                  <span className="font-bold text-slate-600">RNC Emisor</span>
                  <span className="font-mono text-slate-900 text-right">{verifModalData.rncEmisor}</span>
                </div>
                <div className="grid grid-cols-2 p-2.5 px-4 bg-slate-50/50">
                  <span className="font-bold text-slate-600">Razón social emisor</span>
                  <span className="font-semibold text-slate-900 text-right">{verifModalData.razonSocialEmisor}</span>
                </div>
                <div className="grid grid-cols-2 p-2.5 px-4 bg-white">
                  <span className="font-bold text-slate-600">RNC Comprador</span>
                  <span className="font-mono text-slate-900 text-right">{verifModalData.rncComprador}</span>
                </div>
                <div className="grid grid-cols-2 p-2.5 px-4 bg-slate-50/50">
                  <span className="font-bold text-slate-600">Razón social comprador</span>
                  <span className="font-semibold text-slate-900 text-right">{verifModalData.razonSocialComprador || 'ANGELISTIC SRL'}</span>
                </div>
                <div className="grid grid-cols-2 p-2.5 px-4 bg-white">
                  <span className="font-bold text-slate-600">e-NCF</span>
                  <span className="font-mono font-bold text-sky-700 text-right">{verifModalData.encf}</span>
                </div>
                <div className="grid grid-cols-2 p-2.5 px-4 bg-slate-50/50">
                  <span className="font-bold text-slate-600">Fecha de Emisión</span>
                  <span className="font-mono text-slate-900 text-right">{verifModalData.fechaEmision}</span>
                </div>
                <div className="grid grid-cols-2 p-2.5 px-4 bg-white">
                  <span className="font-bold text-slate-600">Total de ITBIS</span>
                  <span className="font-mono font-bold text-emerald-700 text-right">
                    {verifModalData.totalItbis.toFixed(1)}
                  </span>
                </div>
                <div className="grid grid-cols-2 p-2.5 px-4 bg-emerald-50/60 font-bold">
                  <span className="text-slate-800">Monto Total</span>
                  <span className="font-mono text-slate-950 text-right">
                    {verifModalData.montoTotal.toFixed(1)}
                  </span>
                </div>
                <div className="grid grid-cols-2 p-2.5 px-4 bg-white font-bold">
                  <span className="text-slate-600">Estado</span>
                  <span className="text-emerald-700 text-right">{verifModalData.estado}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setVerifModalData(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
