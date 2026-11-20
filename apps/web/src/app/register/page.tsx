'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AntekLogo } from '../../components/AntekLogo';
import { formatDOP, lookupRncClient } from '../../lib/api';
import {
  Lock,
  Mail,
  Building2,
  User,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Check,
} from 'lucide-react';

const PLAN_OPTIONS = [
  {
    code: 'BASIC',
    name: 'Básico',
    price: 990,
    desc: '100 e-CF/mes · 2 usuarios',
  },
  {
    code: 'MEDIUM',
    name: 'Medio',
    price: 2450,
    desc: '600 e-CF/mes · 5 usuarios + API',
    recommended: true,
  },
  {
    code: 'PRO',
    name: 'Pro',
    price: 4900,
    desc: '3,000 e-CF/mes · Gama total DGII',
  },
];

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: 'bg-slate-800' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: 'Débil', color: 'bg-rose-500' };
  if (score === 2) return { score: 2, label: 'Media', color: 'bg-amber-500' };
  if (score === 3) return { score: 3, label: 'Fuerte', color: 'bg-sky-500' };
  return { score: 4, label: 'Muy fuerte', color: 'bg-emerald-500' };
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawPlan = (searchParams.get('plan') || 'MEDIUM').toUpperCase();
  const defaultPlan = rawPlan === 'BASIC' || rawPlan === 'PRO' ? rawPlan : 'MEDIUM';

  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [rncLookingUp, setRncLookingUp] = useState(false);
  const [rncStatus, setRncStatus] = useState<string | null>(null);
  const [rncError, setRncError] = useState<string | null>(null);
  const [rncValid, setRncValid] = useState<boolean | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    rnc: '',
    razonSocial: '',
    nombreComercial: '',
    password: '',
    plan: defaultPlan,
    consentLegal: false,
    consentMarketing: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwStrength = getPasswordStrength(form.password);

  // Autocompletar Razón Social al escribir RNC (9 dígitos) o Cédula (11 dígitos)
  useEffect(() => {
    const clean = form.rnc.replace(/\D/g, '');
    if (clean.length !== 9 && clean.length !== 11) {
      setRncStatus(null);
      setRncError(
        clean.length > 0 && clean.length > 11
          ? 'Máximo 9 dígitos (RNC) u 11 dígitos (Cédula).'
          : null
      );
      setRncValid(clean.length === 0 ? null : null);
      setRncLookingUp(false);
      return;
    }

    let cancelled = false;
    setRncLookingUp(true);
    setRncStatus(null);
    setRncError(null);

    const timer = setTimeout(async () => {
      const res = await lookupRncClient(clean);
      if (cancelled) return;
      setRncLookingUp(false);

      if (!res.ok || !res.data) {
        setRncValid(false);
        setRncError(
          res.error || 'El RNC o Cédula ingresado no supera la validación oficial de la DGII.'
        );
        return;
      }

      const data = res.data;
      setRncValid(true);
      const isGeneric =
        data.foundInPadron === false ||
        /^(RNC|C[eé]dula|EMPRESA REGISTRADA RNC)\s+\d+$/i.test(data.razonSocial);

      if (!isGeneric && data.razonSocial) {
        setForm((prev) => ({
          ...prev,
          razonSocial: data.razonSocial,
          nombreComercial: data.nombreComercial || data.razonSocial,
        }));
        const badgeLabel =
          data.estado && data.estado !== 'ACTIVO'
            ? `DGII (${data.estado})`
            : 'Verificado en DGII ✓';
        setRncStatus(`${badgeLabel}: ${data.razonSocial}`);
      } else {
        setRncStatus('Dígito verificador válido · Completa tu Razón Social');
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.rnc]);

  const handleNextStep = () => {
    setError(null);
    if (!form.name.trim()) {
      setError('Ingresa tu nombre completo.');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanRnc = form.rnc.replace(/\D/g, '');
    if (cleanRnc.length !== 9 && cleanRnc.length !== 11) {
      setError('El RNC debe tener exactamente 9 dígitos o la Cédula 11 dígitos numéricos.');
      return;
    }
    if (rncValid === false) {
      setError(rncError || 'El RNC o Cédula ingresado no es válido ante la DGII.');
      return;
    }

    if (!form.consentLegal) {
      setError('Debes aceptar la política de privacidad y términos del servicio (Ley 32-23 y Ley 172-13) para continuar.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          rnc: cleanRnc,
          razonSocial: form.razonSocial.trim(),
          nombreComercial: (form.nombreComercial || form.razonSocial).trim(),
          password: form.password,
          plan: form.plan,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'No se pudo completar el registro en la plataforma.');
      }

      if (typeof window !== 'undefined') {
        if (data.user) {
          localStorage.setItem('antek_user', JSON.stringify(data.user));
          localStorage.setItem(
            'antek_tenant_cache',
            JSON.stringify({
              id: data.user.tenantId,
              rnc: data.user.rnc,
              razonSocial: data.user.tenantName,
              direccion: data.user.direccion,
              isConfigured: true,
              subscriptionPlan: form.plan,
              subscriptionStatus: 'ACTIVE',
            })
          );
        }
        if (data.accessToken) {
          localStorage.setItem('antek_token', data.accessToken);
        }
        localStorage.setItem(
          'antek_pending_onboarding',
          JSON.stringify({
            rnc: cleanRnc,
            razonSocial: form.razonSocial.trim(),
            nombreComercial: (form.nombreComercial || form.razonSocial).trim(),
            email: form.email.trim(),
            plan: form.plan,
          })
        );
      }

      router.push('/onboarding');
    } catch (err: any) {
      setError(err?.message || 'No se pudo completar el registro. Verifica tus datos e intenta nuevamente.');
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
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-black text-white">Crear Cuenta en ANTEK Factura</h1>
            <p className="text-xs text-slate-400">
              Comienza a emitir comprobantes fiscales electrónicos (e-CF) oficiales en República Dominicana
            </p>
            {/* Barra de progreso 2 pasos */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className={step === 1 ? 'text-sky-400' : 'text-emerald-400'}>
                  1. Tu Cuenta
                </span>
                <span className={step === 2 ? 'text-sky-400' : 'text-slate-500'}>
                  2. Empresa y Plan
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-300"
                  style={{ width: step === 1 ? '50%' : '100%' }}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs dark-form">
            {step === 1 ? (
              <>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">Nombre Completo</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="ej. Juan Pérez"
                      className="w-full bg-[#131c33] border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">Correo Electrónico</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="juan@empresa.com.do"
                      className="w-full bg-[#131c33] border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">Contraseña Segura</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full bg-[#131c33] border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="mt-2 space-y-1">
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map((lvl) => (
                          <div
                            key={lvl}
                            className={`h-1.5 rounded-full transition-colors ${
                              pwStrength.score >= lvl ? pwStrength.color : 'bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Fortaleza: <span className="font-semibold text-slate-200">{pwStrength.label}</span>
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/20 flex items-center justify-center gap-1.5 transition btn-fx cursor-pointer"
                >
                  <span>Siguiente: Datos de Empresa</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">RNC o Cédula</label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={form.rnc}
                        onChange={(e) => setForm({ ...form, rnc: e.target.value })}
                        placeholder="9 u 11 dígitos"
                        className="w-full bg-[#131c33] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                      />
                    </div>
                    {rncLookingUp && (
                      <p className="text-[11px] text-sky-400 mt-1 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Validando RNC en DGII...
                      </p>
                    )}
                    {rncStatus && !rncLookingUp && (
                      <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>{rncStatus}</span>
                      </p>
                    )}
                    {rncError && !rncLookingUp && (
                      <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{rncError}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">Razón Social</label>
                    <input
                      type="text"
                      required
                      value={form.razonSocial}
                      onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                      placeholder="ej. Tu Empresa SRL"
                      className="w-full bg-[#131c33] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* 3 tarjetas seleccionables de plan */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-2">Elige tu Plan</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {PLAN_OPTIONS.map((p) => {
                      const active = form.plan === p.code;
                      return (
                        <button
                          key={p.code}
                          type="button"
                          onClick={() => setForm({ ...form, plan: p.code })}
                          className={`relative text-left p-3 rounded-xl border transition cursor-pointer ${
                            active
                              ? 'bg-sky-500/15 border-sky-400 ring-1 ring-sky-400/50'
                              : 'bg-[#131c33] border-slate-700/80 hover:border-slate-600'
                          }`}
                        >
                          {p.recommended && (
                            <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full bg-sky-500 text-[9px] font-bold text-white uppercase">
                              Popular
                            </span>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs">{p.name}</span>
                            {active && <Check className="w-3.5 h-3.5 text-sky-400" />}
                          </div>
                          <div className="text-sm font-black text-sky-300 font-mono mt-1">
                            {formatDOP(p.price)}
                            <span className="text-[10px] font-normal text-slate-400">/mes</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 leading-snug">{p.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Casillas de confirmación legal */}
                <div className="pt-2 space-y-2.5 border-t border-slate-800 text-xs text-slate-400">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={form.consentLegal}
                      onChange={(e) => setForm({ ...form, consentLegal: e.target.checked })}
                      className="dark-checkbox mt-0.5"
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
                      conforme a la Ley 32-23 y Ley 172-13.
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.consentMarketing}
                      onChange={(e) => setForm({ ...form, consentMarketing: e.target.checked })}
                      className="dark-checkbox mt-0.5"
                    />
                    <span>
                      (Opcional) Deseo recibir novedades y actualizaciones tributarias de la DGII por correo.
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep(1);
                    }}
                    className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/20 flex items-center justify-center gap-1.5 transition disabled:opacity-50 btn-fx cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creando cuenta...</span>
                      </>
                    ) : (
                      <>
                        <span>Crear Cuenta y Continuar</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </form>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Probar 5 días sin pagar en todos los planes · Cero cargos ocultos</span>
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
