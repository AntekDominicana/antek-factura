'use client';

import React from 'react';
import Link from 'next/link';
import { PublicNavbar } from '../../../components/PublicNavbar';
import { PublicFooter } from '../../../components/PublicFooter';
import { ShieldCheck, Lock, ArrowLeft } from 'lucide-react';

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-white">
      <PublicNavbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Inicio
        </Link>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
            <Lock className="w-3.5 h-3.5" /> Protección de Datos Personales · Ley 172-13
          </div>
          <h1 className="text-3xl font-black text-white">
            Política de Privacidad y Seguridad
          </h1>
          <p className="text-xs text-slate-400">
            Última actualización: Noviembre 2026 · ANTEK Factura (antek.com.do)
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 text-sm text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">1. Recopilación y Finalidad de los Datos</h2>
            <p className="text-xs text-slate-400">
              ANTEK Factura recopila única y exclusivamente los datos tributarios requeridos para la emisión y validación electrónica de comprobantes fiscales e-CF ante la DGII conforme a las leyes 32-23 y 172-13: RNC o Cédula, Razón Social, domicilio fiscal, certificados digitales .p12 y registros contables 606 y 607.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">2. Aislamiento Criptográfico y Row-Level Security (RLS)</h2>
            <p className="text-xs text-slate-400">
              Cada cliente cuenta con un aislamiento estricto en la base de datos mediante políticas de Row-Level Security (RLS) por identificador único de empresa (<code>tenantId</code>). Es técnicamente imposible que un usuario, asistente de IA o tercero consulte, filtre o modifique datos pertenecientes a otra entidad.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">3. Cifrado de Certificados y Claves en Reposo</h2>
            <p className="text-xs text-slate-400">
              Los certificados digitales .p12 y contraseñas fiscales se cifran en reposo utilizando el algoritmo estándar militar <strong>AES-256-GCM</strong> con claves de alta entropía. Las API Keys públicas nunca se almacenan en texto plano (se procesan mediante digests irreversibles SHA-256 de una sola vía).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">4. Comunicaciones Comerciales Opcionales</h2>
            <p className="text-xs text-slate-400">
              El envío de notificaciones comerciales, boletines o promociones requiere la autorización expresa y opcional del usuario al momento de registrarse, pudiendo ser revocada en cualquier momento desde la configuración de su cuenta sin afectar la operativa de facturación electrónica.
            </p>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
