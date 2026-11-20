'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '../../../../context/AppContext';
import { apiFetch } from '../../../../lib/api';
import {
  ShieldCheck,
  FileKey2,
  Server,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
  Loader2,
  FlaskConical,
  ArrowRight,
  Lock,
} from 'lucide-react';

type FiscalProvider = 'DGII_DIRECT' | 'GTI' | 'SIMULATOR';
type FallbackProvider = 'NONE' | 'GTI' | 'SIMULATOR';
type DgiiEnv = 'DEV' | 'CERT' | 'PROD';

interface DgiiConfigResponse {
  tenant: {
    id?: string;
    rnc?: string;
    razonSocial?: string;
    fiscalProvider?: FiscalProvider;
    fiscalProviderFallback?: FallbackProvider;
    dgiiLiveMode?: boolean;
    contingencyMode?: boolean;
    environment?: string;
    hasCertificate?: boolean;
    certSubject?: string | null;
    certExpiresAt?: string | null;
    hasGtiCredentials?: boolean;
    medioEmision?: string;
  };
  dgiiConfig?: {
    dgiiEnv?: DgiiEnv;
    liveMode?: boolean;
    hasP12?: boolean;
    subject?: string | null;
    validTo?: string | null;
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo .p12'));
    reader.readAsDataURL(file);
  });
}

export default function FiscalSettingsPage() {
  const { tenant, refreshTenant } = useApp();

  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [deletingCert, setDeletingCert] = useState(false);
  const [savingGti, setSavingGti] = useState(false);
  const [testingHandshake, setTestingHandshake] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Estado del proveedor y entorno
  const [fiscalProvider, setFiscalProvider] = useState<FiscalProvider>('DGII_DIRECT');
  const [fiscalProviderFallback, setFiscalProviderFallback] = useState<FallbackProvider>('NONE');
  const [dgiiEnv, setDgiiEnv] = useState<DgiiEnv>('DEV');
  const [liveMode, setLiveMode] = useState(false);
  const [contingencyMode, setContingencyMode] = useState(false);
  const [medioEmision, setMedioEmision] = useState('DGII Directo XMLDSig');

  // Certificado .p12
  const [hasCertificate, setHasCertificate] = useState(false);
  const [certSubject, setCertSubject] = useState<string | null>(null);
  const [certExpiresAt, setCertExpiresAt] = useState<string | null>(null);
  const [p12File, setP12File] = useState<File | null>(null);
  const [p12Passphrase, setP12Passphrase] = useState('');
  const [showP12Pass, setShowP12Pass] = useState(false);
  const [switchToDirectOnUpload, setSwitchToDirectOnUpload] = useState(true);

  // Credenciales GTI Partner
  const [hasGtiCredentials, setHasGtiCredentials] = useState(false);
  const [gtiUsuario, setGtiUsuario] = useState('');
  const [gtiClave, setGtiClave] = useState('');
  const [showGtiPass, setShowGtiPass] = useState(false);

  // Resultado prueba handshake
  const [handshakeResult, setHandshakeResult] = useState<any>(null);

  const showToast = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    if (type === 'ok') {
      setTimeout(() => {
        setFeedback((curr) => (curr?.text === text ? null : curr));
      }, 5000);
    }
  };

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<DgiiConfigResponse>('/v1/dgii/config');
      const t = data?.tenant || {};
      const dc = data?.dgiiConfig || {};
      setFiscalProvider((t.fiscalProvider as FiscalProvider) || 'DGII_DIRECT');
      setFiscalProviderFallback((t.fiscalProviderFallback as FallbackProvider) || 'NONE');
      const envFromApi: DgiiEnv =
        dc.dgiiEnv || (t.environment === 'PRODUCTION' ? 'PROD' : 'DEV');
      setDgiiEnv(envFromApi);
      setLiveMode(Boolean(dc.liveMode ?? t.dgiiLiveMode));
      setContingencyMode(Boolean(t.contingencyMode));
      setMedioEmision(t.medioEmision || (t.fiscalProvider === 'GTI' ? 'GTI Partner API' : 'DGII Directo XMLDSig'));
      setHasCertificate(Boolean(t.hasCertificate || dc.hasP12));
      setCertSubject(t.certSubject || dc.subject || null);
      setCertExpiresAt(t.certExpiresAt || dc.validTo || null);
      setHasGtiCredentials(Boolean(t.hasGtiCredentials));
    } catch (err: any) {
      showToast('err', err?.message || 'No se pudo cargar la configuración fiscal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSaveProviderAndEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProvider(true);
    setFeedback(null);
    try {
      const mappedEnvironment = dgiiEnv === 'PROD' ? 'PRODUCTION' : 'SANDBOX';
      await apiFetch('/v1/tenant/settings', {
        method: 'POST',
        body: JSON.stringify({
          fiscalProvider,
          fiscalProviderFallback,
          environment: mappedEnvironment,
          contingencyMode,
          medioEmision,
        }),
      });
      await apiFetch('/v1/dgii/config', {
        method: 'POST',
        body: JSON.stringify({
          dgiiEnv,
          liveMode,
        }),
      });
      await Promise.all([loadConfig(), refreshTenant()]);
      showToast(
        'ok',
        `Proveedor actualizado a ${
          fiscalProvider === 'DGII_DIRECT'
            ? 'Firma Directa DGII (.p12)'
            : fiscalProvider === 'GTI'
              ? 'GTI Partner'
              : 'Simulador'
        } (${dgiiEnv}).`,
      );
    } catch (err: any) {
      showToast('err', err?.message || 'Error guardando proveedor y entorno DGII.');
    } finally {
      setSavingProvider(false);
    }
  };

  const handleUploadCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p12File) {
      showToast('err', 'Selecciona un archivo .p12 o .pfx antes de continuar.');
      return;
    }
    setUploadingCert(true);
    setFeedback(null);
    try {
      const p12Base64 = await fileToBase64(p12File);
      await apiFetch('/v1/certificate/upload', {
        method: 'POST',
        body: JSON.stringify({
          p12Base64,
          passphrase: p12Passphrase,
          dgiiEnv,
          liveMode,
          switchToDirect: switchToDirectOnUpload,
        }),
      });
      setP12File(null);
      setP12Passphrase('');
      await Promise.all([loadConfig(), refreshTenant()]);
      showToast(
        'ok',
        switchToDirectOnUpload
          ? 'Certificado .p12 validado, cifrado y activado como proveedor DGII Directo.'
          : 'Certificado .p12 validado y guardado de forma segura.',
      );
    } catch (err: any) {
      showToast(
        'err',
        err?.message || 'No se pudo cargar el certificado .p12. Verifica el archivo y la contraseña.',
      );
    } finally {
      setUploadingCert(false);
    }
  };

  const handleRemoveCertificate = async () => {
    if (!confirm('¿Seguro que deseas eliminar el certificado .p12 guardado de esta empresa?')) {
      return;
    }
    setDeletingCert(true);
    setFeedback(null);
    try {
      await apiFetch('/v1/certificate', { method: 'DELETE' });
      await Promise.all([loadConfig(), refreshTenant()]);
      showToast('ok', 'Certificado .p12 eliminado correctamente.');
    } catch (err: any) {
      showToast('err', err?.message || 'Error eliminando certificado .p12.');
    } finally {
      setDeletingCert(false);
    }
  };

  const handleSaveGtiCredentials = async (activateGti: boolean) => {
    if (!gtiUsuario.trim() || !gtiClave.trim()) {
      showToast('err', 'Ingresa usuario y clave de acceso GTI Partner para guardar.');
      return;
    }
    setSavingGti(true);
    setFeedback(null);
    try {
      await apiFetch('/v1/tenant/settings', {
        method: 'POST',
        body: JSON.stringify({
          gtiUsuario: gtiUsuario.trim(),
          gtiClave: gtiClave.trim(),
          ...(activateGti ? { fiscalProvider: 'GTI', medioEmision: 'GTI Partner API' } : {}),
        }),
      });
      setGtiUsuario('');
      setGtiClave('');
      await Promise.all([loadConfig(), refreshTenant()]);
      showToast(
        'ok',
        activateGti
          ? 'Credenciales GTI guardadas y GTI Partner activado como proveedor principal.'
          : 'Credenciales GTI guardadas y cifradas en la bóveda de tu empresa.',
      );
    } catch (err: any) {
      showToast('err', err?.message || 'Error guardando credenciales de GTI Partner.');
    } finally {
      setSavingGti(false);
    }
  };

  const handleClearGtiCredentials = async () => {
    if (!confirm('¿Deseas eliminar las credenciales de GTI Partner almacenadas?')) return;
    setSavingGti(true);
    setFeedback(null);
    try {
      await apiFetch('/v1/tenant/settings', {
        method: 'POST',
        body: JSON.stringify({ clearGtiCredentials: true }),
      });
      await Promise.all([loadConfig(), refreshTenant()]);
      showToast('ok', 'Credenciales GTI eliminadas.');
    } catch (err: any) {
      showToast('err', err?.message || 'No se pudieron eliminar las credenciales GTI.');
    } finally {
      setSavingGti(false);
    }
  };

  const handleTestHandshake = async () => {
    setTestingHandshake(true);
    setHandshakeResult(null);
    setFeedback(null);
    try {
      const res = await apiFetch<any>('/v1/dgii/receptor/test-handshake', {
        method: 'POST',
        body: JSON.stringify({ rnc: tenant?.rnc || undefined }),
      });
      setHandshakeResult(res);
      showToast('ok', 'Prueba de firma XMLDSig y handshake DGII completada con éxito.');
    } catch (err: any) {
      showToast('err', err?.message || 'Falló la prueba de firma electrónica / handshake.');
    } finally {
      setTestingHandshake(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Conexión Fiscal, Firma Electrónica (.p12) y GTI
          </h1>
          <p className="text-xs text-slate-500">
            Cambia en cualquier momento entre Firma Directa con tu Certificado Digital (.p12) ante la DGII o GTI Partner.
          </p>
        </div>
        <Link
          href="/app/invoices/new"
          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition"
        >
          <span>Ir a Emitir Factura e-CF</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Resumen de estado actual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase text-slate-400">Proveedor Activo</div>
          <div className="text-sm font-black text-slate-900">
            {fiscalProvider === 'DGII_DIRECT'
              ? 'DGII Directo (Firma .p12)'
              : fiscalProvider === 'GTI'
                ? 'GTI Partner'
                : 'Simulador Local'}
          </div>
          <div className="text-[11px] text-slate-500">
            Plan B:{' '}
            <strong>
              {fiscalProviderFallback === 'NONE' ? 'Desactivado' : fiscalProviderFallback}
            </strong>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase text-slate-400">
            Certificado Digital (.p12)
          </div>
          <div className="flex items-center gap-1.5">
            {hasCertificate ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm font-black text-emerald-800">Cargado y Cifrado</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-sm font-bold text-amber-700">No cargado</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {certSubject || (hasCertificate ? 'Certificado X.509 válido' : 'Sube tu .p12 para firma XMLDSig')}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase text-slate-400">Ambiente DGII</div>
          <div className="text-sm font-black text-slate-900">
            {dgiiEnv === 'PROD'
              ? 'Producción (e-CF Oficial)'
              : dgiiEnv === 'CERT'
                ? 'Certificación DGII (certecf)'
                : 'Pre-Certificación / Sandbox (testecf)'}
          </div>
          <div className="text-[11px] text-slate-500">
            Transmisión en vivo:{' '}
            <strong className={liveMode ? 'text-emerald-700' : 'text-slate-600'}>
              {liveMode ? 'Activada' : 'Firma local / Pruebas'}
            </strong>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
          Cargando configuración fiscal...
        </div>
      ) : (
        <>
          {/* 1. Selector de Proveedor y Entorno DGII */}
          <form
            onSubmit={handleSaveProviderAndEnv}
            className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-5 text-xs"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Server className="w-4 h-4 text-sky-600" />
                <span>1. Proveedor de Emisión e-CF y Entorno DGII</span>
              </div>
              <button
                type="button"
                onClick={loadConfig}
                className="text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Actualizar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  id: 'DGII_DIRECT' as FiscalProvider,
                  title: 'DGII Directo (Firma .p12)',
                  desc: 'Recomendado. Firma XML XMLDSig SHA-256 con el certificado .p12 de tu empresa y envía directo a la DGII.',
                  badge: hasCertificate ? 'Certificado listo' : 'Requiere .p12 en Producción',
                },
                {
                  id: 'GTI' as FiscalProvider,
                  title: 'GTI Partner',
                  desc: 'Envía tus comprobantes a través del integrador autorizado GTI usando tus credenciales Partner.',
                  badge: hasGtiCredentials ? 'Credenciales guardadas' : 'Requiere usuario/clave',
                },
                {
                  id: 'SIMULATOR' as FiscalProvider,
                  title: 'Simulador Interno',
                  desc: 'Modo de pruebas internas sin enviar documentos reales a los webservices externos.',
                  badge: 'Solo pruebas',
                },
              ].map((opt) => {
                const active = fiscalProvider === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setFiscalProvider(opt.id);
                      if (opt.id === 'DGII_DIRECT') setMedioEmision('DGII Directo XMLDSig');
                      if (opt.id === 'GTI') setMedioEmision('GTI Partner API');
                    }}
                    className={`text-left p-4 rounded-2xl border-2 transition cursor-pointer space-y-1.5 ${
                      active
                        ? 'border-sky-500 bg-sky-50/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-slate-900 text-xs">{opt.title}</span>
                      {active && (
                        <span className="px-2 py-0.5 rounded-full bg-sky-600 text-white text-[10px] font-bold">
                          Activo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{opt.desc}</p>
                    <div className="pt-1 text-[10px] font-bold text-slate-500">{opt.badge}</div>
                  </button>
                );
              })}
            </div>

            {fiscalProvider === 'DGII_DIRECT' && dgiiEnv === 'PROD' && liveMode && !hasCertificate && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2 text-[11px] font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  En Producción con DGII Directo y transmisión en vivo, debes subir primero el archivo <strong>.p12</strong> abajo.
                </span>
              </div>
            )}

            {fiscalProvider === 'GTI' && dgiiEnv === 'PROD' && !hasGtiCredentials && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2 text-[11px] font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Si seleccionas GTI Partner en Producción, recuerda guardar abajo tu usuario y clave GTI Partner.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Entorno DGII</label>
                <select
                  value={dgiiEnv}
                  onChange={(e) => setDgiiEnv(e.target.value as DgiiEnv)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white font-semibold"
                >
                  <option value="DEV">DEV — Pre-Certificación (testecf)</option>
                  <option value="CERT">CERT — Certificación DGII (certecf)</option>
                  <option value="PROD">PROD — Producción Oficial (ecf)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Proveedor de Respaldo (Plan B)
                </label>
                <select
                  value={fiscalProviderFallback}
                  onChange={(e) => setFiscalProviderFallback(e.target.value as FallbackProvider)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white font-semibold"
                >
                  <option value="NONE">Sin respaldo automático</option>
                  <option value="GTI">GTI Partner como respaldo</option>
                  <option value="SIMULATOR">Simulador si falla conexión</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Etiqueta / Medio de Emisión</label>
                <input
                  type="text"
                  value={medioEmision}
                  onChange={(e) => setMedioEmision(e.target.value)}
                  placeholder="Ej. DGII Directo XMLDSig"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={liveMode}
                  onChange={(e) => setLiveMode(e.target.checked)}
                  className="mt-0.5 accent-sky-600"
                />
                <div>
                  <span className="font-bold text-slate-900 block">
                    Transmisión en vivo hacia Webservices DGII
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Envía el XML firmado realmente al endpoint DGII ({dgiiEnv}). Desactívalo para firmar XMLDSig localmente sin conectar con DGII.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contingencyMode}
                  onChange={(e) => setContingencyMode(e.target.checked)}
                  className="mt-0.5 accent-amber-600"
                />
                <div>
                  <span className="font-bold text-slate-900 block">
                    Modo Contingencia (Regla 72 horas)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Emite el e-CF con sello de contingencia cuando no exista comunicación inmediata con DGII.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingProvider}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5 disabled:opacity-50 transition cursor-pointer"
              >
                {savingProvider ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{savingProvider ? 'Guardando...' : 'Guardar Proveedor y Parámetros'}</span>
              </button>
            </div>
          </form>

          {/* 2. Certificado Digital .p12 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <FileKey2 className="w-4 h-4 text-sky-600" />
                <span>2. Certificado Digital de Firma Electrónica (.p12 / .pfx)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={testingHandshake}
                  onClick={handleTestHandshake}
                  className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold text-[11px] inline-flex items-center gap-1.5 disabled:opacity-50 transition cursor-pointer"
                >
                  {testingHandshake ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FlaskConical className="w-3.5 h-3.5" />
                  )}
                  <span>Probar Firma y Semilla DGII</span>
                </button>
                {hasCertificate && (
                  <button
                    type="button"
                    disabled={deletingCert}
                    onClick={handleRemoveCertificate}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] inline-flex items-center gap-1 disabled:opacity-50 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar .p12</span>
                  </button>
                )}
              </div>
            </div>

            {hasCertificate && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Certificado .p12 activo para RNC {tenant?.rnc || 'empresa'}</span>
                </div>
                {certSubject && (
                  <div className="text-[11px] font-mono text-emerald-800">Titular: {certSubject}</div>
                )}
                {certExpiresAt && (
                  <div className="text-[11px] text-emerald-700">
                    Vence: {new Date(certExpiresAt).toLocaleDateString('es-DO')}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleUploadCertificate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Archivo de Firma Digital (.p12 o .pfx)
                  </label>
                  <input
                    type="file"
                    accept=".p12,.pfx"
                    onChange={(e) => setP12File(e.target.files?.[0] || null)}
                    className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white cursor-pointer"
                  />
                  {p12File && (
                    <p className="text-[11px] text-sky-700 font-semibold mt-1">
                      Seleccionado: {p12File.name} ({Math.round(p12File.size / 1024)} KB)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Contraseña del Certificado (.p12)
                  </label>
                  <div className="relative">
                    <input
                      type={showP12Pass ? 'text' : 'password'}
                      value={p12Passphrase}
                      onChange={(e) => setP12Passphrase(e.target.value)}
                      placeholder="Contraseña de apertura del .p12"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-9 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowP12Pass((s) => !s)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showP12Pass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={switchToDirectOnUpload}
                  onChange={(e) => setSwitchToDirectOnUpload(e.target.checked)}
                  className="accent-sky-600"
                />
                <span>
                  Cambiar proveedor principal automáticamente a <strong>DGII Directo (.p12)</strong> al subir este certificado
                </span>
              </label>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploadingCert || !p12File}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs inline-flex items-center gap-1.5 disabled:opacity-50 transition cursor-pointer"
                >
                  {uploadingCert ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{uploadingCert ? 'Validando y cifrando .p12...' : 'Subir y Activar Certificado .p12'}</span>
                </button>
              </div>
            </form>

            {handshakeResult && (
              <div className="p-4 rounded-xl bg-slate-900 text-slate-100 space-y-2 text-[11px]">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Resultado de Prueba XMLDSig &amp; Handshake Semilla/ARECF
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>Semilla XML: {handshakeResult?.steps?.seedGenerated ? '✓ OK' : '✗'}</div>
                  <div>Firma XMLDSig: {handshakeResult?.steps?.seedSignedAndVerified ? '✓ OK' : '✗'}</div>
                  <div>JWT Sesión: {handshakeResult?.steps?.jwtIssued ? '✓ OK' : '✗'}</div>
                  <div>ARECF Firmado: {handshakeResult?.steps?.arecfGeneratedAndSigned ? '✓ OK' : '✗'}</div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Credenciales GTI Partner */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>3. Credenciales de GTI Partner (Opcional / Proveedor Delegado)</span>
              </div>
              {hasGtiCredentials && (
                <button
                  type="button"
                  disabled={savingGti}
                  onClick={handleClearGtiCredentials}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Credenciales GTI</span>
                </button>
              )}
            </div>

            {hasGtiCredentials && (
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold flex items-center gap-2 text-[11px]">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Ya existen credenciales de GTI Partner cifradas en tu cuenta. Solo completa los campos abajo si deseas reemplazarlas.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Usuario GTI Partner</label>
                <input
                  type="text"
                  value={gtiUsuario}
                  onChange={(e) => setGtiUsuario(e.target.value)}
                  placeholder="Usuario API / Portal GTI"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Clave GTI Partner</label>
                <div className="relative">
                  <input
                    type={showGtiPass ? 'text' : 'password'}
                    value={gtiClave}
                    onChange={(e) => setGtiClave(e.target.value)}
                    placeholder="Contraseña / Token GTI"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-9 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGtiPass((s) => !s)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showGtiPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={savingGti || !gtiUsuario.trim() || !gtiClave.trim()}
                onClick={() => handleSaveGtiCredentials(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs disabled:opacity-50 transition cursor-pointer"
              >
                Solo Guardar Credenciales
              </button>
              <button
                type="button"
                disabled={savingGti || !gtiUsuario.trim() || !gtiClave.trim()}
                onClick={() => handleSaveGtiCredentials(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs disabled:opacity-50 transition cursor-pointer"
              >
                Guardar y Activar GTI Partner
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
