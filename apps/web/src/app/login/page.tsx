'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AntekLogo } from '../../components/AntekLogo';
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, KeyRound, UserCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: identifier.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Credenciales inválidas en Supabase.');
      }

      // Guardar datos de usuario en localStorage
      if (data.user) {
        localStorage.setItem('antek_user', JSON.stringify(data.user));
        if (data.accessToken) {
          localStorage.setItem('antek_token', data.accessToken);
        }
      }

      // Redirigir al dashboard protegido
      router.push('/app/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al autenticar contra Supabase.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillCredentials = (user: string, pass: string) => {
    setIdentifier(user);
    setPassword(pass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      {/* Header */}
      <header className="p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link href="/">
          <AntekLogo theme="dark" size="md" />
        </Link>
        <Link
          href="/register"
          className="text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          ¿No tienes cuenta? <span className="text-sky-400">Regístrate</span>
        </Link>
      </header>

      {/* Main card */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-black text-white">Iniciar Sesión</h1>
            <p className="text-xs text-slate-400">
              Autenticación real cifrada con base de datos en Supabase
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-semibold block">Acceso denegado:</span>
                {error}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Correo Electrónico o Usuario
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="rootfacturas o juanperez@antek.com.do"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold">Contraseña</label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-sky-400 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <span>{loading ? 'Verificando en Supabase...' : 'Entrar a ANTEK Factura'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Cuentas Configuradas en Supabase */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
            <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-sky-400" />
              Cuentas autorizadas registradas en Supabase:
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleFillCredentials('rootfacturas', 'RootFacturas2026!')}
                className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 text-left transition flex flex-col gap-0.5 group"
              >
                <span className="font-bold text-sky-400 group-hover:text-sky-300 flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  Admin Root
                </span>
                <span className="text-[10px] text-slate-400 truncate">rootfacturas</span>
                <span className="text-[9px] text-slate-500">Pass: RootFacturas2026!</span>
              </button>

              <button
                type="button"
                onClick={() => handleFillCredentials('juanperez@antek.com.do', 'JuanPerez2026!')}
                className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 text-left transition flex flex-col gap-0.5 group"
              >
                <span className="font-bold text-emerald-400 group-hover:text-emerald-300 flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  Cliente / Admin
                </span>
                <span className="text-[10px] text-slate-400 truncate">juanperez@antek.com.do</span>
                <span className="text-[9px] text-slate-500">Pass: JuanPerez2026!</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Validación criptográfica bcrypt + Supabase PostgreSQL RLS</span>
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
