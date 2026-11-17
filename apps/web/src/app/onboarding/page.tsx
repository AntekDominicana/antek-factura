'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AntekLogo } from '../../components/AntekLogo';
import { apiFetch } from '../../lib/api';
import {
  Upload,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    rnc: '',
    razonSocial: '',
    nombreComercial: '',
    direccion: '',
    telefono: '',
    provider: 'DGII_DIRECT',
    logoBase64: '',
    plan: 'MEDIUM',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pending = localStorage.getItem('antek_pending_onboarding');
      const storedUser = localStorage.getItem('antek_user');
      let parsedUser: any = null;
      if (storedUser) {
        try {
          parsedUser = JSON.parse(storedUser);
        } catch {}
      }

      if (pending) {
        try {
          const parsed = JSON.parse(pending);
          setForm((prev) => ({
            ...prev,
            rnc: parsed.rnc || parsedUser?.rnc || prev.rnc,
            razonSocial: parsed.razonSocial || parsedUser?.tenantName || prev.razonSocial,
            plan: parsed.plan || prev.plan,
          }));
        } catch {}
      } else if (parsedUser) {
        setForm((prev) => ({
          ...prev,
          rnc: parsedUser.rnc || '',
          razonSocial: parsedUser.tenantName || '',
          direccion: parsedUser.direccion || '',
          telefono: parsedUser.telefono || '',
          plan: parsedUser.plan || 'MEDIUM',
        }));
      }
    }
  }, []);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 600;
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
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          setForm((prev) => ({ ...prev, logoBase64: dataUrl }));
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await apiFetch('/v1/tenant/settings', {
        method: 'POST',
        body: JSON.stringify({
          rnc: form.rnc.trim(),
          razonSocial: form.razonSocial.trim(),
          nombreComercial: form.nombreComercial.trim() || form.razonSocial.trim(),
          direccion: form.direccion.trim() || 'República Dominicana',
          telefono: form.telefono.trim(),
          fiscalProvider: form.provider,
          logoBase64: form.logoBase64 || undefined,
        }),
      });
    } catch {
      // Continuar al panel aunque falte algún ajuste opcional
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('antek_tenant_cache', JSON.stringify({ ...form, isConfigured: true }));
      localStorage.removeItem('antek_pending_onboarding');
    }

    router.push('/app/dashboard');
  };

  const planDisplay: Record<string, string> = {
    BASIC: 'Plan Básico (RD$ 990/mes · 100 e-CF)',
    MEDIUM: 'Plan Medio (RD$ 2,450/mes · 600 e-CF)',
    PRO: 'Plan Pro (RD$ 4,900/mes · 3,000 e-CF)',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      <header className="p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link href="/">
          <AntekLogo theme="dark" size="md" />
        </Link>
        <span className="text-xs text-slate-400 font-medium">
          Paso <strong className="text-sky-400">{step}</strong> de 4
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          {/* Progress bar */}
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-sky-500 to-indigo-600 h-full transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>

          {/* Step 1: Datos de Negocio */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">1. Datos Fiscales de Tu Negocio</h2>
                <p className="text-xs text-slate-400">
                  Verifica tu RNC y nombre legal registrado ante la DGII
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">RNC o Cédula Empresa</label>
                  <input
                    type="text"
                    value={form.rnc}
                    onChange={(e) => setForm({ ...form, rnc: e.target.value })}
                    placeholder="9 u 11 dígitos numéricos"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Razón Social</label>
                  <input
                    type="text"
                    value={form.razonSocial}
                    onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                    placeholder="Nombre legal de tu empresa"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">Dirección Comercial</label>
                  <input
                    type="text"
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    placeholder="Dirección física del domicilio fiscal"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  Siguiente: Conexión Fiscal <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Proveedor Fiscal */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">2. Conexión y Timbrado DGII</h2>
                <p className="text-xs text-slate-400">
                  Selecciona cómo emitirás tus comprobantes electrónicos
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div
                  onClick={() => setForm({ ...form, provider: 'DGII_DIRECT' })}
                  className={`p-4 rounded-2xl border cursor-pointer transition ${
                    form.provider === 'DGII_DIRECT'
                      ? 'bg-sky-500/10 border-sky-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="font-bold text-white text-sm">Directo con DGII (.p12)</div>
                  <p className="text-[11px] mt-1 text-slate-400">
                    Sube tu certificado digital de DigiFirma o Cámara de Comercio para firmar directamente en el servidor.
                  </p>
                </div>

                <div
                  onClick={() => setForm({ ...form, provider: 'GTI' })}
                  className={`p-4 rounded-2xl border cursor-pointer transition ${
                    form.provider === 'GTI'
                      ? 'bg-sky-500/10 border-sky-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="font-bold text-white text-sm">Vía Partner GTI</div>
                  <p className="text-[11px] mt-1 text-slate-400">
                    Utiliza tus credenciales GTI autorizadas sin necesidad de subir tu certificado .p12 localmente.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  Siguiente: Personalizar Logo <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Logo Corporativo */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">3. Logo de Tu Negocio</h2>
                <p className="text-xs text-slate-400">
                  Tu logo aparecerá como marca principal en tus facturas y tirillas de 80mm
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
                {form.logoBase64 ? (
                  <div className="flex flex-col items-center gap-2">
                    <img src={form.logoBase64} alt="Logo" className="h-20 object-contain bg-white rounded-xl p-2" />
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Logo cargado correctamente
                    </span>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto text-sky-400">
                    <Upload className="w-8 h-8" />
                  </div>
                )}
                <h4 className="text-sm font-bold text-white">Sube el Logo de Tu Negocio</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  El sistema comprime automáticamente cualquier tamaño de imagen (PNG/JPG). También puedes hacerlo más tarde en Configuración.
                </p>
                <label className="inline-block px-4 py-2 rounded-xl bg-sky-500/20 text-sky-300 font-bold text-xs border border-sky-500/30 hover:bg-sky-500/30 cursor-pointer">
                  Seleccionar Imagen (PNG/JPG)
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                </label>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  Siguiente: Confirmar Plan <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Plan & Finalizar */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-1 text-center">
                <h2 className="text-xl font-bold text-white">¡Todo Listo para Facturar!</h2>
                <p className="text-xs text-slate-400">
                  Tu cuenta fue registrada en Supabase con 5 días de gracia garantizados
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-xs space-y-2">
                <div className="flex justify-between items-center text-white font-bold">
                  <span>Plan Seleccionado:</span>
                  <span className="text-sky-300 font-black">
                    {planDisplay[form.plan.toUpperCase()] || form.plan}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Podrás gestionar tus pagos desde <strong className="text-white">Ajustes → Planes &amp; Link Pago</strong>. Ya tienes secuencias e-NCF habilitadas para comenzar.
                </p>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleFinish}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/25 flex items-center gap-2 transition"
                >
                  <span>{loading ? 'Guardando configuración...' : 'Ir al Panel de Facturación →'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="p-6 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} ANTEK Factura · <a href="https://antek.com.do" className="hover:underline">antek.com.do</a>
      </footer>
    </div>
  );
}
