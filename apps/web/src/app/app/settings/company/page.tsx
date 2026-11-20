'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useApp } from '../../../../context/AppContext';
import { lookupRncClient } from '../../../../lib/api';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Printer,
  Search,
  Save,
  Loader2,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

export default function CompanySettingsPage() {
  const { tenant, updateTenant } = useApp();

  const [form, setForm] = useState({
    rnc: tenant?.rnc || '',
    razonSocial: tenant?.razonSocial || '',
    nombreComercial: tenant?.nombreComercial || '',
    direccion: tenant?.direccion || '',
    telefono: tenant?.telefono || '',
    brandColor: tenant?.brandColor || '#0284c7',
    invoiceFooter:
      tenant?.invoiceFooter ||
      'Gracias por preferirnos — Comprobante Fiscal Electrónico válido ante la DGII',
    logoBase64: tenant?.logoBase64 || '',
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [rncLookingUp, setRncLookingUp] = useState(false);
  const [rncStatus, setRncStatus] = useState<string | null>(null);
  const [rncError, setRncError] = useState<string | null>(null);
  const [rncValid, setRncValid] = useState<boolean | null>(null);

  // Sincronizar cuando tenant termina de hidratar desde contexto
  useEffect(() => {
    if (!tenant?.id) return;
    setForm((prev) => ({
      ...prev,
      rnc: prev.rnc || tenant.rnc || '',
      razonSocial: prev.razonSocial || tenant.razonSocial || '',
      nombreComercial: prev.nombreComercial || tenant.nombreComercial || '',
      direccion: prev.direccion || tenant.direccion || '',
      telefono: prev.telefono || tenant.telefono || '',
      brandColor: tenant.brandColor || prev.brandColor,
      invoiceFooter: tenant.invoiceFooter || prev.invoiceFooter,
      logoBase64: tenant.logoBase64 ?? prev.logoBase64,
    }));
  }, [tenant?.id]);

  const runRncLookup = useCallback(async (rawRnc: string, overwriteNames = true) => {
    const clean = rawRnc.replace(/\D/g, '');
    if (clean.length !== 9 && clean.length !== 11) {
      setRncValid(false);
      setRncStatus(null);
      setRncError('El RNC debe tener 9 dígitos o la Cédula 11 dígitos numéricos.');
      return;
    }

    setRncLookingUp(true);
    setRncStatus(null);
    setRncError(null);

    const res = await lookupRncClient(clean);
    setRncLookingUp(false);

    if (!res.ok || !res.data) {
      setRncValid(false);
      setRncError(
        res.error || 'El RNC o Cédula ingresado no tiene un dígito verificador válido en DGII.'
      );
      return;
    }

    const data = res.data;
    setRncValid(true);
    const isGeneric =
      data.foundInPadron === false ||
      /^(RNC|C[eé]dula|EMPRESA REGISTRADA RNC)\s+\d+$/i.test(data.razonSocial);

    if (!isGeneric && data.razonSocial) {
      if (overwriteNames) {
        setForm((prev) => ({
          ...prev,
          razonSocial: data.razonSocial,
          nombreComercial: data.nombreComercial || data.razonSocial,
        }));
      }
      setRncStatus(`Validado DGII (${data.estado || 'ACTIVO'}): ${data.razonSocial}`);
    } else {
      setRncStatus('Dígito verificador válido · Puedes editar o confirmar tu Razón Social');
    }
  }, []);

  // Autocompletar al escribir 9 u 11 dígitos en RNC (sin sobreescribir si ya coincide con tenant inicial al montar)
  useEffect(() => {
    const clean = form.rnc.replace(/\D/g, '');
    const initialRnc = String(tenant?.rnc || '').replace(/\D/g, '');
    if (clean.length !== 9 && clean.length !== 11) {
      setRncStatus(null);
      setRncError(null);
      setRncValid(null);
      return;
    }
    const isInitialUntouched = Boolean(initialRnc && clean === initialRnc && form.razonSocial);
    const timer = setTimeout(() => {
      runRncLookup(clean, !isInitialUntouched);
    }, 350);
    return () => clearTimeout(timer);
  }, [form.rnc]);

  // Compresor automático en el navegador con HTML5 Canvas (sin límite de MB)
  const compressImage = (
    file: File
  ): Promise<{ dataUrl: string; origSize: number; compSize: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Imagen inválida'));
        img.onload = () => {
          const maxDim = 800;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx)
            return resolve({
              dataUrl: String(reader.result || ''),
              origSize: file.size,
              compSize: file.size,
            });

          const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
          if (!isPng) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(img, 0, 0, width, height);

          let dataUrl = '';
          try {
            dataUrl = isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.84);
            if (dataUrl.length > 350_000) {
              dataUrl = canvas.toDataURL('image/webp', 0.82);
            }
          } catch {
            dataUrl = String(reader.result || '');
          }

          resolve({
            dataUrl,
            origSize: file.size,
            compSize: Math.round((dataUrl.length * 3) / 4),
          });
        };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const { dataUrl, origSize, compSize } = await compressImage(file);
      const origMb = (origSize / (1024 * 1024)).toFixed(2);
      const compKb = Math.round(compSize / 1024);

      setForm((prev) => ({ ...prev, logoBase64: dataUrl }));
      await updateTenant({ logoBase64: dataUrl });
      setSuccessMsg(
        `Logo optimizado y guardado con éxito (${
          origSize > 1024 * 1024 ? `${origMb} MB` : `${Math.round(origSize / 1024)} KB`
        } ➔ ${compKb} KB) ✓`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch {
      alert('Error procesando imagen');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rncValid === false) {
      setRncError(rncError || 'Corrige el RNC antes de guardar los cambios.');
      return;
    }
    setSaving(true);
    await updateTenant({
      ...form,
      rnc: form.rnc.replace(/\D/g, ''),
    });
    setSaving(false);
    setSuccessMsg('Datos de la empresa actualizados correctamente ✓');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Configuración de Empresa & Marca</h1>
          <p className="text-xs text-slate-500">
            Personaliza los datos tributarios, logo 100% marca blanca y estilo de tus comprobantes e-CF
          </p>
        </div>
        <Link
          href="/app/settings/fiscal"
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-2 shrink-0 transition"
        >
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          <span>Firma Digital (.p12) y Proveedor GTI</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Card Logo y Personalización */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Printer className="w-4 h-4 text-sky-600" />
            <span>Logo de Tu Empresa e Impresión</span>
          </div>
          {form.logoBase64 && (
            <button
              type="button"
              onClick={async () => {
                setForm((prev) => ({ ...prev, logoBase64: '' }));
                await updateTenant({ logoBase64: '' });
              }}
              className="text-xs text-rose-600 hover:underline font-semibold"
            >
              Quitar Logo
            </button>
          )}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Sube el logo de tu negocio. Tu imagen y datos fiscales aparecerán como la marca exclusiva (100% marca blanca, sin logos de terceros) en todas las facturas, representaciones impresas y tirillas de 80mm.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          {form.logoBase64 ? (
            <div className="p-2 rounded-xl border border-slate-200 bg-white shrink-0 shadow-xs">
              <img src={form.logoBase64} alt="Logo de empresa" className="h-14 max-w-[180px] object-contain" />
            </div>
          ) : (
            <div className="h-14 w-32 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-semibold bg-slate-50">
              Sin logo
            </div>
          )}

          <label className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 cursor-pointer inline-flex items-center gap-1.5 transition">
            <Upload className="w-4 h-4" />
            <span>Subir Logo (Auto-comprime cualquier peso/MB)</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </label>
        </div>
      </div>

      {/* Formulario de Datos */}
      <form onSubmit={handleSave} className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4 text-xs">
        <h3 className="font-bold text-slate-900 text-sm">Información Fiscal Registrada ante DGII</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">RNC Empresa (9 u 11 dígitos)</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                required
                value={form.rnc}
                onChange={(e) => setForm({ ...form, rnc: e.target.value })}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-bold"
              />
              <button
                type="button"
                disabled={rncLookingUp}
                onClick={() => runRncLookup(form.rnc, true)}
                className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs inline-flex items-center gap-1 shrink-0 transition cursor-pointer"
                title="Validar y autocompletar nombre desde padrón DGII"
              >
                {rncLookingUp ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Validar DGII</span>
              </button>
            </div>
            {rncStatus && !rncLookingUp && (
              <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{rncStatus}</span>
              </p>
            )}
            {rncError && !rncLookingUp && (
              <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-semibold">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{rncError}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Razón Social</label>
            <input
              type="text"
              required
              value={form.razonSocial}
              onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Nombre Comercial</label>
            <input
              type="text"
              value={form.nombreComercial}
              onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Teléfono</label>
            <input
              type="text"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-700 font-semibold mb-1">Dirección Fiscal</label>
            <input
              type="text"
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-700 font-semibold mb-1">Mensaje Pie de Factura</label>
            <input
              type="text"
              value={form.invoiceFooter}
              onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            disabled={saving || rncValid === false}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
