'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AntekLogo } from '../../components/AntekLogo';
import {
  Building2,
  KeyRound,
  Upload,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Sparkles,
} from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    rnc: '',
    razonSocial: 'Juan Pérez SRL',
    nombreComercial: '',
    direccion: 'Av. Winston Churchill #109, Santo Domingo',
    telefono: '(809) 555-0199',
    provider: 'DGII_DIRECT',
    logoBase64: '',
    plan: 'business-pro',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pending = localStorage.getItem('antek_pending_onboarding');
      if (pending) {
        try {
          const parsed = JSON.parse(pending);
          setForm((prev) => ({
            ...prev,
            rnc: parsed.rnc || prev.rnc,
            razonSocial: parsed.razonSocial || prev.razonSocial,
            plan: parsed.plan || prev.plan,
          }));
        } catch {}
      }
    }
  }, []);

  const handleFinish = async () => {
    setLoading(true);
    // Guardar en localStorage / API
    if (typeof window !== 'undefined') {
      localStorage.setItem('antek_tenant_cache', JSON.stringify({ ...form, isConfigured: true }));
    }
    await new Promise((r) => setTimeout(r, 800));
    router.push('/app/dashboard');
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
                  Ingresa tu RNC y nombre legal registrado ante la DGII
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">RNC Empresa</label>
                  <input
                    type="text"
                    value={form.rnc}
                    onChange={(e) => setForm({ ...form, rnc: e.target.value })}
                    placeholder="101532483"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Razón Social</label>
                  <input
                    type="text"
                    value={form.razonSocial}
                    onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                    placeholder="Juan Pérez SRL"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">Dirección Comercial</label>
                  <input
                    type="text"
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    placeholder="Av. Principal #100, Santo Domingo"
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
                <h2 className="text-xl font-bold text-white">3. Logo de Tu Negocio (Estilo Alegra)</h2>
                <p className="text-xs text-slate-400">
                  Tu logo aparecerá como marca principal en tus facturas, con el sello oficial de ANTEK Factura
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto text-sky-400">
                  <Upload className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-bold text-white">Sube el Logo de Tu Negocio</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  El sistema comprime automáticamente cualquier tamaño de foto de tu celular o computadora para que nunca pese de más.
                </p>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-sky-500/20 text-sky-300 font-bold text-xs border border-sky-500/30 hover:bg-sky-500/30"
                >
                  Seleccionar Imagen (PNG/JPG)
                </button>
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
                  Tu cuenta ha sido creada bajo el plan seleccionado con 5 días de gracia garantizados
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-xs space-y-2">
                <div className="flex justify-between items-center text-white font-bold">
                  <span>Plan Seleccionado:</span>
                  <span className="text-sky-300 font-black">Plan Negocio Pro (RD$ 2,450/mes)</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Podrás activar tu Link de Pago en cualquier momento desde <strong className="text-white">Ajustes → Facturación</strong>. Tienes 5 días de gracia para emitir tus primeros comprobantes sin interrupción.
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
                  <span>{loading ? 'Accediendo a la app...' : 'Ir al Panel de Facturación →'}</span>
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
