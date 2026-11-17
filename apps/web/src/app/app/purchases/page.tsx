'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import jsQR from 'jsqr';
import {
  QrCode,
  Camera,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Search,
  Receipt,
  FileText,
  Clock,
  RefreshCw,
  Eye,
  Check,
  AlertTriangle,
  X,
  ImagePlus,
  Edit3,
  BookOpen,
} from 'lucide-react';
import { apiFetch, apiDownload } from '../../../lib/api';
import { useApp } from '../../../context/AppContext';

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

type ScanMode = 'camera' | 'image' | 'manual';

function normalizeDgiiDateLocal(rawDate?: string): string {
  const today = new Date().toISOString().split('T')[0];
  if (!rawDate) return today;
  const cleaned = decodeURIComponent(rawDate.trim());
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const dmy = cleaned.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return cleaned;
}

function getQueryParamCI(params: URLSearchParams, candidates: string[]): string {
  const normalized = candidates.map((c) => c.toLowerCase().replace(/[_-]/g, ''));
  for (const [k, v] of params.entries()) {
    const norm = k.toLowerCase().replace(/[_-]/g, '');
    if (normalized.includes(norm) && v) return v.trim();
  }
  return '';
}

function tryJsQrWithContrast(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): string | null {
  const imageData = ctx.getImageData(0, 0, width, height);
  const direct = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
  if (direct?.data) return direct.data;

  // Pase de alto contraste para recibos térmicos tenues
  const data = imageData.data;
  let sumLum = 0;
  const totalPixels = width * height;
  for (let i = 0; i < data.length; i += 4) {
    sumLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const threshold = Math.max(60, Math.min(200, (sumLum / Math.max(1, totalPixels)) * 0.88));
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const bin = lum < threshold ? 0 : 255;
    data[i] = bin;
    data[i + 1] = bin;
    data[i + 2] = bin;
  }
  const contrasted = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  return contrasted?.data || null;
}

async function decodeQrFromImageElement(img: HTMLImageElement): Promise<string | null> {
  // 1. Intentar BarcodeDetector nativo del navegador (móviles Android / Chrome / Edge)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const Detector = (window as any).BarcodeDetector;
      const detector = new Detector({ formats: ['qr_code'] });
      const results = await detector.detect(img);
      if (results?.length && results[0]?.rawValue) {
        return String(results[0].rawValue);
      }
    } catch {}
  }

  // 2. Fallback multi-escala y por cuadrantes (facturas completas con QR pequeño al pie)
  const regions: Array<[number, number, number, number]> = [
    [0, 0, 1, 1],
    [0, 0.45, 1, 0.55],
    [0, 0.45, 0.55, 0.55],
    [0.45, 0.45, 0.55, 0.55],
    [0.2, 0.2, 0.6, 0.6],
  ];
  const scales = [1600, 1000];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  for (const maxDim of scales) {
    for (const [rx, ry, rw, rh] of regions) {
      const sx = Math.floor(img.naturalWidth * rx);
      const sy = Math.floor(img.naturalHeight * ry);
      const sw = Math.max(1, Math.floor(img.naturalWidth * rw));
      const sh = Math.max(1, Math.floor(img.naturalHeight * rh));

      const scale = Math.min(1, maxDim / Math.max(sw, sh));
      const dw = Math.max(1, Math.round(sw * scale));
      const dh = Math.max(1, Math.round(sh * scale));

      canvas.width = dw;
      canvas.height = dh;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

      const decoded = tryJsQrWithContrast(ctx, dw, dh);
      if (decoded) return decoded;
    }
  }

  return null;
}

function PurchasesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenant } = useApp();
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modales
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [xmlModalOpen, setXmlModalOpen] = useState(false);
  const [verifModalData, setVerifModalData] = useState<DgiiVerificationData | null>(null);

  // Escáner QR / Manual
  const [scanMode, setScanMode] = useState<ScanMode>('camera');
  const [qrInput, setQrInput] = useState('');
  const [selectedGasto, setSelectedGasto] = useState('02');
  const [previewData, setPreviewData] = useState<DgiiVerificationData | null>(null);
  const [manualFields, setManualFields] = useState({
    rncEmisor: '',
    razonSocialEmisor: '',
    encf: '',
    fechaEmision: new Date().toISOString().split('T')[0],
    montoTotal: '',
    totalItbis: '',
  });
  const [lookingUpRnc, setLookingUpRnc] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Cámara en vivo
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [decodingImage, setDecodingImage] = useState(false);
  const detectingRef = useRef(false);

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
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, []);

  useEffect(() => {
    if (searchParams.get('scan') === '1') {
      setQrInput('');
      setPreviewData(null);
      setErrorMsg('');
      setSuccessMsg('');
      setScanMode('camera');
      setQrModalOpen(true);
      router.replace('/app/purchases', { scroll: false });
    }
  }, [searchParams, router]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const parseDecodedQr = useCallback(
    async (rawQrText: string) => {
      setQrInput(rawQrText);
      setErrorMsg('');
      try {
        const res = await apiFetch<any>('/v1/purchases/parse-qr', {
          method: 'POST',
          body: JSON.stringify({ qrRaw: rawQrText }),
        });
        setPreviewData({
          rncEmisor: res.rncEmisor,
          razonSocialEmisor: res.razonSocialEmisor,
          rncComprador: res.rncComprador || tenant?.rnc || '',
          razonSocialComprador: res.razonSocialComprador || tenant?.razonSocial || 'Tu Empresa',
          encf: res.encf,
          fechaEmision: res.fechaEmision,
          totalItbis: Number(res.totalItbis || 0),
          montoTotal: Number(res.montoTotal || 0),
          estado: res.estadoDgii || 'Aceptado',
        });
        setManualFields({
          rncEmisor: res.rncEmisor || '',
          razonSocialEmisor: res.razonSocialEmisor || '',
          encf: res.encf || '',
          fechaEmision: res.fechaEmision || new Date().toISOString().split('T')[0],
          montoTotal: String(res.montoTotal ?? ''),
          totalItbis: String(res.totalItbis ?? ''),
        });
      } catch (err: any) {
        // Fallback de parseo local si la URL tiene parámetros estándar DGII (ConsultaTimbre / ConsultaTimbreFC)
        try {
          const input = rawQrText.trim().replace(/&amp;/g, '&');
          const urlParams = input.startsWith('http')
            ? new URL(input).searchParams
            : new URLSearchParams(input.includes('?') ? input.split('?')[1] : input);
          const rncEmisor = getQueryParamCI(urlParams, ['RncEmisor', 'RncEmis', 'Emisor']).replace(/\D/g, '');
          const encf = getQueryParamCI(urlParams, ['ENCF', 'eNCF', 'NCF']).toUpperCase();
          const montoTotal = parseFloat(
            getQueryParamCI(urlParams, ['MontoTotal', 'Total', 'Monto']).replace(/,/g, '') || '0'
          );
          const totalItbis = parseFloat(
            getQueryParamCI(urlParams, ['TotalITBIS', 'ITBIS', 'MontoITBIS']).replace(/,/g, '') || '0'
          );
          const fechaEmision = normalizeDgiiDateLocal(
            getQueryParamCI(urlParams, ['FechaEmision', 'Fecha', 'FechaFirma'])
          );

          if (rncEmisor && encf) {
            setPreviewData({
              rncEmisor,
              razonSocialEmisor: `RNC ${rncEmisor}`,
              rncComprador: tenant?.rnc || '',
              razonSocialComprador: tenant?.razonSocial || 'Tu Empresa',
              encf,
              fechaEmision,
              totalItbis: isNaN(totalItbis) ? 0 : totalItbis,
              montoTotal: isNaN(montoTotal) ? 0 : montoTotal,
              estado: 'Aceptado',
            });
            setManualFields({
              rncEmisor,
              razonSocialEmisor: `RNC ${rncEmisor}`,
              encf,
              fechaEmision,
              montoTotal: String(isNaN(montoTotal) ? 0 : montoTotal),
              totalItbis: String(isNaN(totalItbis) ? 0 : totalItbis),
            });
          } else {
            setErrorMsg(err?.message || 'El QR leído no contiene parámetros DGII válidos (RncEmisor y ENCF).');
          }
        } catch {
          setErrorMsg(err?.message || 'Formato de código QR / URL de DGII inválido.');
        }
      }
    },
    [tenant?.rnc, tenant?.razonSocial]
  );

  const startCamera = useCallback(async () => {
    setCameraError('');
    setErrorMsg('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Este navegador o dispositivo no soporta acceso a cámara. Puedes subir una foto o pegar el QR.');
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const barcodeDetector =
        typeof window !== 'undefined' && 'BarcodeDetector' in window
          ? new (window as any).BarcodeDetector({ formats: ['qr_code'] })
          : null;

      const scanFrame = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !streamRef.current) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });
            if (code?.data) {
              stopCamera();
              parseDecodedQr(code.data);
              return;
            }
          }

          if (barcodeDetector && !detectingRef.current) {
            detectingRef.current = true;
            barcodeDetector
              .detect(video)
              .then((detected: any[]) => {
                if (detected?.length && detected[0]?.rawValue && streamRef.current) {
                  stopCamera();
                  parseDecodedQr(String(detected[0].rawValue));
                }
              })
              .catch(() => {})
              .finally(() => {
                detectingRef.current = false;
              });
          }
        }
        rafRef.current = requestAnimationFrame(scanFrame);
      };

      rafRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setCameraError('No se pudo activar la cámara en vivo. Usa el botón de Cámara Nativa o "Subir Foto".');
      setCameraActive(false);
    }
  }, [parseDecodedQr, stopCamera]);

  // Encender/apagar cámara automáticamente según modal y pestaña
  useEffect(() => {
    if (qrModalOpen && scanMode === 'camera' && !previewData) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [qrModalOpen, scanMode, previewData, startCamera, stopCamera]);

  // Subir imagen/foto o captura nativa del QR y decodificar con multi-escala (BarcodeDetector + jsQR)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setErrorMsg('');
    setDecodingImage(true);

    const reader = new FileReader();
    reader.onerror = () => {
      setDecodingImage(false);
      setErrorMsg('No se pudo cargar la imagen seleccionada.');
    };
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        try {
          const decodedText = await decodeQrFromImageElement(img);
          if (decodedText) {
            stopCamera();
            await parseDecodedQr(decodedText);
          } else {
            setErrorMsg(
              'No se detectó un código QR legible en la foto. Acerca más la cámara al cuadro QR con buena iluminación o usa "URL / Manual".'
            );
          }
        } finally {
          setDecodingImage(false);
        }
      };
      img.onerror = () => {
        setDecodingImage(false);
        setErrorMsg('No se pudo leer el archivo de imagen seleccionado.');
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  // Autocompletar Razón Social DGII al escribir RNC en modo manual
  const handleManualRncLookup = async (val: string) => {
    setManualFields((prev) => ({ ...prev, rncEmisor: val }));
    const clean = val.replace(/\D/g, '');
    if (clean.length === 9 || clean.length === 11) {
      setLookingUpRnc(true);
      try {
        const res = await apiFetch<any>(`/v1/dgii/verify-rnc/${clean}`);
        if (res?.nombreRazonSocial) {
          setManualFields((prev) => ({ ...prev, razonSocialEmisor: res.nombreRazonSocial }));
        }
      } catch {
      } finally {
        setLookingUpRnc(false);
      }
    }
  };

  // Parseo en vivo cuando el usuario pega URL en modo manual
  useEffect(() => {
    if (scanMode !== 'manual' || !qrInput.trim()) return;
    const timer = setTimeout(() => {
      parseDecodedQr(qrInput.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [qrInput, scanMode, parseDecodedQr]);

  const handleRegisterQr = async () => {
    const hasManual = manualFields.rncEmisor.trim() && manualFields.encf.trim();
    if (!qrInput.trim() && !hasManual) {
      setErrorMsg('Escanea un QR o completa el RNC Emisor y e-NCF de la factura.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const payload: any = {
        tipoGasto606: selectedGasto,
      };
      if (qrInput.trim()) payload.qrRaw = qrInput.trim();
      if (hasManual) {
        payload.rncEmisor = manualFields.rncEmisor.replace(/\D/g, '');
        payload.razonSocialEmisor = manualFields.razonSocialEmisor.trim();
        payload.encf = manualFields.encf.trim().toUpperCase();
        payload.fechaEmision = manualFields.fechaEmision;
        payload.montoTotal = parseFloat(manualFields.montoTotal || '0') || 0;
        payload.totalItbis = parseFloat(manualFields.totalItbis || '0') || 0;
      }

      const res = await apiFetch<any>('/v1/purchases/register-qr', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res?.success) {
        setSuccessMsg(`Factura ${res.purchase.encf} guardada exitosamente en tu Libro Contable (Formato 606).`);
        setQrInput('');
        setPreviewData(null);
        setManualFields({
          rncEmisor: '',
          razonSocialEmisor: '',
          encf: '',
          fechaEmision: new Date().toISOString().split('T')[0],
          montoTotal: '',
          totalItbis: '',
        });
        await loadPurchases();
        setTimeout(() => {
          setQrModalOpen(false);
          setSuccessMsg('');
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar la factura en el libro de contabilidad.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleXmlFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      setXmlText(String(reader.result || ''));
    };
    reader.readAsText(file);
  };

  const handleImportXml = async () => {
    if (!xmlText.trim()) {
      setErrorMsg('Por favor seleccione un archivo .xml o pegue el contenido XML del e-CF.');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg('');
      const res = await apiFetch<any>('/v1/purchases/import-xml', {
        method: 'POST',
        body: JSON.stringify({ xmlContent: xmlText.trim(), tipoGasto606: selectedGasto }),
      });

      if (res?.success) {
        setSuccessMsg('e-CF XML importado y guardado en tu Libro Contable (606).');
        setXmlText('');
        await loadPurchases();
        setTimeout(() => {
          setXmlModalOpen(false);
          setSuccessMsg('');
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
        body: JSON.stringify({ status }),
      });
      loadPurchases();
    } catch (err: any) {
      alert(err?.message || 'Error al procesar la aprobación comercial.');
    }
  };

  const handleExport606 = async () => {
    try {
      setExporting(true);
      const currentPeriod = new Date().toISOString().slice(0, 7).replace('-', '');
      await apiDownload(`/v1/purchases/export/606?periodo=${currentPeriod}`, `DGII_F_606_${currentPeriod}.txt`);
    } catch (err: any) {
      alert(err?.message || 'No se pudo descargar el archivo 606.');
    } finally {
      setExporting(false);
    }
  };

  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      p.rncEmisor.toLowerCase().includes(search.toLowerCase()) ||
      p.razonSocialEmisor.toLowerCase().includes(search.toLowerCase()) ||
      p.encf.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || p.commercialStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalGastos = purchases.reduce((acc, p) => acc + Number(p.montoTotal), 0);
  const totalItbisDeducible = purchases.reduce((acc, p) => acc + Number(p.totalItbis), 0);
  const pendingApprovals = purchases.filter((p) => p.commercialStatus === 'PENDING').length;

  const canConfirmScan =
    Boolean(previewData) || Boolean(manualFields.rncEmisor.trim() && manualFields.encf.trim());

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Escáner de Compras &amp; Libro Contable 606
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
              Ley 32-23 DGII
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Escanea el QR de cualquier factura electrónica con tu cámara, foto o XML para guardarla automáticamente en tu libro contable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setQrInput('');
              setPreviewData(null);
              setErrorMsg('');
              setSuccessMsg('');
              setScanMode('camera');
              setQrModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-bold text-sm shadow-md shadow-sky-500/20 transition-all cursor-pointer active:scale-95"
          >
            <Camera className="w-4 h-4" />
            Escanear Factura e-CF
          </button>

          <button
            onClick={() => {
              setXmlText('');
              setErrorMsg('');
              setSuccessMsg('');
              setXmlModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm border border-slate-700 transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-sky-400" />
            Importar XML
          </button>

          <Link
            href="/app/reports"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-300 transition-all"
          >
            <BookOpen className="w-4 h-4 text-indigo-600" />
            Ver Libro Contable
          </Link>

          <button
            type="button"
            disabled={exporting}
            onClick={handleExport606}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting ? 'Descargando...' : 'Exportar TXT 606'}
          </button>
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
            <span className="text-sm">Consultando Libro Digital de Gastos en Supabase...</span>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center mx-auto mb-3 border border-sky-100">
              <QrCode className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              No hay facturas de compras registradas en tu libro
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
              Usa el botón &quot;Escanear Factura e-CF&quot; para leer el código QR con la cámara, subir una foto del comprobante o importar su XML y deducir el ITBIS en el Formato 606.
            </p>
            <button
              onClick={() => {
                setScanMode('camera');
                setQrModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Escanear Primera Factura e-CF
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
                              rncComprador: tenant?.rnc || '—',
                              razonSocialComprador: tenant?.razonSocial || 'Tu Empresa',
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
      {/* MODAL 1: ESCANEAR FACTURA e-CF (CÁMARA / FOTO / MANUAL)  */}
      {/* ======================================================== */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">
                    Escanear Factura Electrónica e-CF
                  </h3>
                  <p className="text-xs text-slate-400">
                    Lee el QR de la factura y guárdala en tu Libro de Contabilidad 606
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopCamera();
                  setQrModalOpen(false);
                }}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de Modo de Escaneo */}
            <div className="px-6 pt-4">
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewData(null);
                    setErrorMsg('');
                    setScanMode('camera');
                  }}
                  className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    scanMode === 'camera'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Cámara QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setErrorMsg('');
                    setScanMode('image');
                  }}
                  className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    scanMode === 'image'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>Subir Foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setErrorMsg('');
                    setScanMode('manual');
                  }}
                  className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    scanMode === 'manual'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>URL / Manual</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              {/* Modo 1: Cámara en Vivo + Botón de Cámara Nativa para Móviles */}
              {scanMode === 'camera' && !previewData && (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-800">
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                    <canvas ref={canvasRef} className="hidden" />
                    {cameraActive && !decodingImage && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-44 h-44 border-2 border-sky-400 rounded-2xl shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]" />
                      </div>
                    )}
                    {decodingImage && (
                      <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white text-xs gap-2 font-bold">
                        <RefreshCw className="w-7 h-7 animate-spin text-sky-400" />
                        <span>Analizando código QR de la factura...</span>
                      </div>
                    )}
                    {!cameraActive && !decodingImage && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 text-slate-300 text-xs gap-2">
                        <Camera className="w-8 h-8 text-sky-400" />
                        <span>{cameraError || 'Iniciando cámara para detectar el QR...'}</span>
                      </div>
                    )}
                  </div>
                  <label className="w-full py-2.5 px-4 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition">
                    <Camera className="w-4 h-4" />
                    <span>{decodingImage ? 'Leyendo QR...' : 'Capturar con Cámara Nativa (Foto Rápida)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                  <p className="text-[11px] text-center text-slate-500">
                    Apunta al QR inferior de la factura e-CF o usa &quot;Capturar con Cámara Nativa&quot; en teléfonos con autofoco.
                  </p>
                </div>
              )}

              {/* Modo 2: Subir Imagen / Foto */}
              {scanMode === 'image' && !previewData && (
                <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center space-y-3">
                  <ImagePlus className="w-10 h-10 text-sky-600 mx-auto" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Selecciona o toma una foto del comprobante fiscal
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Extraemos automáticamente el RNC, e-NCF, fecha, ITBIS y total directamente del QR.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs cursor-pointer transition">
                    <UploadCloud className="w-4 h-4" />
                    {decodingImage ? 'Analizando Foto...' : 'Elegir Foto / Captura (PNG, JPG)'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
              )}

              {/* Modo 3: URL QR o Digitado Manual */}
              {scanMode === 'manual' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Pegar URL del QR DGII (opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      placeholder="https://ecf.dgii.gov.do/eCF/ConsultaTimbre?RncEmisor=...&ENCF=..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">
                        RNC Emisor / Proveedor {lookingUpRnc && <span className="text-sky-600">(Buscando...)</span>}
                      </label>
                      <input
                        type="text"
                        value={manualFields.rncEmisor}
                        onChange={(e) => handleManualRncLookup(e.target.value)}
                        placeholder="9 u 11 dígitos"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">e-NCF / NCF</label>
                      <input
                        type="text"
                        value={manualFields.encf}
                        onChange={(e) => setManualFields({ ...manualFields, encf: e.target.value.toUpperCase() })}
                        placeholder="E310000000001"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-600 font-bold mb-1">Razón Social Emisor</label>
                      <input
                        type="text"
                        value={manualFields.razonSocialEmisor}
                        onChange={(e) => setManualFields({ ...manualFields, razonSocialEmisor: e.target.value })}
                        placeholder="Nombre del proveedor o suplidor"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Fecha de Emisión</label>
                      <input
                        type="text"
                        value={manualFields.fechaEmision}
                        onChange={(e) => setManualFields({ ...manualFields, fechaEmision: e.target.value })}
                        placeholder="DD-MM-YYYY"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">ITBIS (RD$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={manualFields.totalItbis}
                          onChange={(e) => setManualFields({ ...manualFields, totalItbis: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Total (RD$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={manualFields.montoTotal}
                          onChange={(e) => setManualFields({ ...manualFields, montoTotal: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Selector de Clasificación 606 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Clasificación Contable Formato 606
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

              {/* Tarjeta de Verificación DGII tras leer el QR */}
              {previewData && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-extrabold text-slate-900 text-xs">
                        Comprobante Detectado del QR
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewData(null);
                        setQrInput('');
                      }}
                      className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                    >
                      Volver a escanear
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="grid grid-cols-2 p-2 px-4 bg-white">
                      <span className="font-bold text-slate-600">RNC Emisor</span>
                      <span className="font-mono text-slate-900 text-right">{previewData.rncEmisor}</span>
                    </div>
                    <div className="grid grid-cols-2 p-2 px-4 bg-slate-50/50">
                      <span className="font-bold text-slate-600">Razón social emisor</span>
                      <span className="font-semibold text-slate-900 text-right">{previewData.razonSocialEmisor}</span>
                    </div>
                    <div className="grid grid-cols-2 p-2 px-4 bg-white">
                      <span className="font-bold text-slate-600">e-NCF</span>
                      <span className="font-mono font-bold text-sky-700 text-right">{previewData.encf}</span>
                    </div>
                    <div className="grid grid-cols-2 p-2 px-4 bg-slate-50/50">
                      <span className="font-bold text-slate-600">Fecha de Emisión</span>
                      <span className="font-mono text-slate-900 text-right">{previewData.fechaEmision}</span>
                    </div>
                    <div className="grid grid-cols-2 p-2 px-4 bg-white">
                      <span className="font-bold text-slate-600">Total de ITBIS</span>
                      <span className="font-mono font-bold text-emerald-700 text-right">
                        DOP ${previewData.totalItbis.toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 p-2 px-4 bg-emerald-50/60 font-bold">
                      <span className="text-slate-800">Monto Total</span>
                      <span className="font-mono text-slate-950 text-right">
                        DOP ${previewData.montoTotal.toFixed(2)}
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
                onClick={() => {
                  stopCamera();
                  setQrModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold text-xs hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!canConfirmScan || submitting}
                onClick={handleRegisterQr}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-bold text-xs shadow-md shadow-sky-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {submitting ? 'Guardando en Libro 606...' : 'Guardar en Libro de Contabilidad (606)'}
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
                    Sube el archivo .xml firmado o pega su contenido para guardarlo en el Libro 606
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
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Archivo o Contenido XML del Comprobante
                </label>
                <label className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-bold cursor-pointer">
                  Seleccionar archivo .XML
                  <input type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={handleXmlFileUpload} />
                </label>
              </div>

              <textarea
                rows={7}
                value={xmlText}
                onChange={(e) => setXmlText(e.target.value)}
                placeholder="Pegue aquí el contenido de <eCF>...</eCF> o cargue el archivo XML desde su dispositivo"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all"
              />

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
                {submitting ? 'Importando XML...' : 'Importar y Guardar en Libro 606'}
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
                  <span className="font-semibold text-slate-900 text-right">{verifModalData.razonSocialComprador || 'Tu Empresa'}</span>
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
                    DOP ${verifModalData.totalItbis.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 p-2.5 px-4 bg-emerald-50/60 font-bold">
                  <span className="text-slate-800">Monto Total</span>
                  <span className="font-mono text-slate-950 text-right">
                    DOP ${verifModalData.montoTotal.toFixed(2)}
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

export default function PurchasesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center text-xs text-slate-500">
          Cargando escáner de comprobantes e-CF...
        </div>
      }
    >
      <PurchasesContent />
    </Suspense>
  );
}
