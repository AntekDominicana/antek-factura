'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AntekLogo } from './AntekLogo';
import { Menu, X, ArrowRight, Sparkles, QrCode, Layers, ShieldCheck, BookOpen } from 'lucide-react';

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <div className="sm:hidden">
            <AntekLogo theme="dark" size="sm" />
          </div>
          <div className="hidden sm:block">
            <AntekLogo theme="dark" size="md" />
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <Link href="/#caracteristicas" className="hover:text-sky-400 transition">
            Características
          </Link>
          <Link href="/#planes" className="hover:text-sky-400 transition">
            Planes y Precios
          </Link>
          <Link href="/#comparativa" className="hover:text-sky-400 transition">
            Comparativa DGII
          </Link>
          <Link href="/docs" className="hover:text-sky-400 transition">
            Documentación &amp; API
          </Link>
        </nav>

        {/* Desktop Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-200 hover:text-white hover:bg-slate-900 border border-slate-800 transition"
          >
            Iniciar Sesión
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/25 flex items-center gap-1.5 transition"
          >
            <span>Crear Cuenta</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Mobile Compact Actions + Hamburger */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          <Link
            href="/login"
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-100 bg-slate-900 hover:bg-slate-800 border border-slate-700 transition"
          >
            Entrar
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-xl text-slate-200 hover:text-white bg-slate-900/90 border border-slate-800 transition"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden px-4 pt-3 pb-6 bg-slate-950/98 backdrop-blur-xl border-b border-slate-800 space-y-2 shadow-2xl">
          <Link
            href="/#caracteristicas"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-200 hover:bg-slate-900"
          >
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>Características</span>
          </Link>
          <Link
            href="/#planes"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-200 hover:bg-slate-900"
          >
            <Layers className="w-4 h-4 text-sky-400" />
            <span>Planes y Precios</span>
          </Link>
          <Link
            href="/#comparativa"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-200 hover:bg-slate-900"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Comparativa DGII</span>
          </Link>
          <Link
            href="/app/purchases?scan=1"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-sky-300 bg-sky-950/50 border border-sky-500/20"
          >
            <QrCode className="w-4 h-4 text-sky-400" />
            <span>Escáner QR 606</span>
          </Link>
          <Link
            href="/docs"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-200 hover:bg-slate-900"
          >
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>Documentación &amp; API</span>
          </Link>
          <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2.5">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="w-full text-center px-3 py-2.5 rounded-xl text-xs font-bold text-slate-200 bg-slate-900 border border-slate-800"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="w-full text-center px-3 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md"
            >
              Crear Cuenta
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
