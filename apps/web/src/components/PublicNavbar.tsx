'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AntekLogo } from './AntekLogo';
import { Menu, X, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <AntekLogo theme="dark" size="md" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
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
            Documentación & API
          </Link>
        </nav>

        {/* Action Buttons */}
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
            <span>Crear Cuenta Gratis</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden px-4 pt-2 pb-6 bg-slate-950 border-b border-slate-800 space-y-3">
          <Link
            href="/#caracteristicas"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-900"
          >
            Características
          </Link>
          <Link
            href="/#planes"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-900"
          >
            Planes y Precios
          </Link>
          <Link
            href="/#comparativa"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-900"
          >
            Comparativa DGII
          </Link>
          <Link
            href="/docs"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-900"
          >
            Documentación & API
          </Link>
          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="w-full text-center px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-200 bg-slate-900 border border-slate-800"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="w-full text-center px-4 py-2.5 rounded-xl text-sm font-bold bg-sky-500 text-white"
            >
              Crear Cuenta Gratis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
