'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AntekLogo } from '../../components/AntekLogo';
import { Lock, Mail, Building2, User, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawPlan = (searchParams.get('plan') || 'MEDIUM').toUpperCase();
  const defaultPlan = rawPlan === 'BASIC' || rawPlan === 'PRO' ? rawPlan : 'MEDIUM';

  const [form, setForm] = useState({
    name: '',
    email: '',
    rnc: '',
    razonSocial: '',
    password: '',
    plan: defaultPlan,
    consentLegal: false,
    consentMarketing: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.consentLegal) {
      setError('Debes aceptar la política de privacidad y términos del servicio (Ley 32-23 y Ley 172-13) para continuar.');
      return;
    }

    setLoading(true);

    try {
      await new Promise((r) => setTimeout(r, 700));
      // Guardar datos preliminares en localStorage para el onboarding
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'antek_pending_onboarding',
          JSON.stringify({
            rnc: form.rnc,
            razonSocial: form.razonSocial,
            email: form.email,
            plan: form.plan,
          })
        );
      }
      // Ir al asistente de onboarding
      router.push('/onboarding');
    } catch {
      setError('No se pudo completar el registro. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      {/* Header */}
      <header className="p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link href="/">
          <AntekLogo theme="dark" size="md" />
        </Link>
        <Link
          href="/login"
          className="text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          ¿Ya tienes cuenta? <span className="text-sky-400">Iniciar Sesión</span>
        </Link>
      </header>

      {/* Main card */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-black text-white">Crear Cuenta en ANTEK Factura</h1>
            <p className="text-xs text-slate-400">
              Comienza a emitir comprobantes fiscales electrónicos (e-CF) oficiales en República Dominicana
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre Completo</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="ej. Juan Pérez"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="juan@empresa.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">RNC o Cédula de Empresa</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={form.rnc}
                    onChange={(e) => setForm({ ...form, rnc: e.target.value })}
                    placeholder="9 u 11 dígitos"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Razón Social</label>
                <input
                  type="text"
                  required
                  value={form.razonSocial}
                  onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                  placeholder="ej. Juan Pérez SRL"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Contraseña Segura</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
                />
              </div>
            </div>

            {/* Plan selection */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Plan a Contratar</label>
              <select
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-sky-500"
              >
                <option value="BASIC">Plan Básico (RD$ 990/mes - 100 comprobantes e-CF, 2 usuarios)</option>
                <option value="MEDIUM">Plan Medio (RD$ 2,450/mes - 600 comprobantes e-CF, 5 usuarios + API)</option>
                <option value="PRO">Plan Pro (RD$ 4,900/mes - 3,000 comprobantes e-CF, Gama total DGII)</option>
              </select>
            </div>

            {/* Casillas de confirmación legal */}
            <div className="pt-2 space-y-2 border-t border-slate-800 text-[11px] text-slate-400">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={form.consentLegal}
                  onChange={(e) => setForm({ ...form, consentLegal: e.target.checked })}
                  className="mt-0.5 rounded border-slate-700 text-sky-500 focus:ring-sky-500 bg-slate-950"
                />
                <span>
                  He leído y acepto los{' '}
                  <Link href="/legal/terminos" target="_blank" className="text-sky-400 hover:underline">
                    Términos y Condiciones
                  </Link>{' '}
                  y la{' '}
                  <Link href="/legal/privacidad" target="_blank" className="text-sky-400 hover:underline">
                    Política de Privacidad
                  </Link>{' '}
                  para la recopilación y timbrado de datos tributarios conforme a la Ley 32-23 y Ley 172-13.
                </span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.consentMarketing}
                  onChange={(e) => setForm({ ...form, consentMarketing: e.target.checked })}
                  className="mt-0.5 rounded border-slate-700 text-sky-500 focus:ring-sky-500 bg-slate-950"
                />
                <span>
                  (Opcional) Deseo recibir novedades, promociones y actualizaciones tributarias de la DGII por correo electrónico.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <span>{loading ? 'Creando cuenta...' : 'Continuar al Asistente de Configuración'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>5 días de gracia garantizados en todos los planes · Cero cargos ocultos</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} ANTEK Factura · <a href="https://antek.com.do" className="hover:underline">antek.com.do</a>
      </footer>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-xs font-mono">Cargando formulario seguro...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
