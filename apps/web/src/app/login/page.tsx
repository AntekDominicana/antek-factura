'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AntekLogo } from '../../components/AntekLogo';
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

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
        throw new Error(data.message || 'Credenciales inválidas.');
      }

      if (data.user) {
        localStorage.setItem('antek_user', JSON.stringify(data.user));
        localStorage.removeItem('antek_tenant_cache');
        if (data.accessToken) {
          localStorage.setItem('antek_token', data.accessToken);
        }
      }

      const params =
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const redirectParam = params?.get('redirect');
      const isSafeRedirect =
        redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//');

      const isRootAdmin =
        data.user?.role === 'SUPERADMIN' ||
        String(data.user?.email || '').toLowerCase() === 'rootfacturas@antek.com.do';

      if (isSafeRedirect && (redirectParam !== '/superadmin' || isRootAdmin)) {
        router.push(redirectParam);
      } else {
        router.push(isRootAdmin ? '/superadmin' : '/app/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión. Verifica tus credenciales.');
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
              Accede a tu portal de facturación electrónica e-CF (DGII Ley 32-23)
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
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="correo@tuempresa.com.do"
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
                  autoComplete="current-password"
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
              <span>{loading ? 'Verificando acceso...' : 'Entrar a ANTEK Factura'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Conexión cifrada TLS + Autenticación bcrypt &amp; PostgreSQL RLS</span>
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
