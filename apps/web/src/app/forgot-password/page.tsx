'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AntekLogo } from '../../components/AntekLogo';
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      <header className="p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link href="/">
          <AntekLogo theme="dark" size="md" />
        </Link>
        <Link
          href="/login"
          className="text-xs font-semibold text-slate-400 hover:text-white transition flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a Iniciar Sesión
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-black text-white">Recuperar Contraseña</h1>
            <p className="text-xs text-slate-400">
              Te enviaremos un enlace seguro para restablecer el acceso a tu cuenta
            </p>
          </div>

          {sent ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="font-bold text-white text-sm">Enlace Enviado con Éxito</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Hemos enviado las instrucciones para restablecer tu contraseña a <strong>{email}</strong>. Revisa tu bandeja de entrada o carpeta de spam.
              </p>
              <Link
                href="/reset-password?token=demo_token_antek_recovery"
                className="inline-block mt-2 px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs"
              >
                Simular Clic en Enlace de Recuperación →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Correo Electrónico Registrado
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@empresa.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                <span>{loading ? 'Enviando enlace...' : 'Enviar Enlace de Recuperación'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="p-6 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} ANTEK Factura · <a href="https://antek.com.do" className="hover:underline">antek.com.do</a>
      </footer>
    </div>
  );
}
