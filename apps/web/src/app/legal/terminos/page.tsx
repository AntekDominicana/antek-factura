'use client';

import React from 'react';
import Link from 'next/link';
import { PublicNavbar } from '../../../components/PublicNavbar';
import { PublicFooter } from '../../../components/PublicFooter';
import { ShieldCheck, FileText, ArrowLeft } from 'lucide-react';

export default function TerminosPage() {
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-bold border border-sky-500/20">
            <ShieldCheck className="w-3.5 h-3.5" /> Cumplimiento Ley 32-23 DGII
          </div>
          <h1 className="text-3xl font-black text-white">
            Términos y Condiciones del Servicio
          </h1>
          <p className="text-xs text-slate-400">
            Última actualización: Noviembre 2026 · ANTEK Factura (antek.com.do)
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 text-sm text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">1. Alcance del Servicio e-CF</h2>
            <p className="text-xs text-slate-400">
              ANTEK Factura (propiedad de ANTEK Dominicana, antek.com.do) actúa como software proveedor de emisión, firma digital XMLDSig y reportería electrónica ante la Dirección General de Impuestos Internos (DGII) de conformidad con la Ley 32-23. El contribuyente emisor es el único responsable legal y tributario de la veracidad de los montos facturados, las secuencias e-NCF autorizadas y la vigencia de su certificado digital .p12.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">2. Suscripción, Pagos y Plazo de Gracia de 5 Días</h2>
            <p className="text-xs text-slate-400">
              Todos los planes contratados se cobran periódicamente mediante Link de Pago seguro con verificación criptográfica en servidor (HMAC-SHA256). Al vencer un ciclo de facturación mensual sin pago confirmado, se otorga un <strong>plazo de gracia automático de cinco (5) días continuos</strong> bajo el estado <code>PAST_DUE_GRACE_5D</code>.
            </p>
            <p className="text-xs text-slate-400">
              Cumplido el quinto día de gracia sin regularización, el sistema suspende de forma automática la capacidad de emitir nuevos comprobantes fiscales electrónicos (<code>SUSPENDED_LOCKED</code>), manteniendo en todo momento acceso de solo lectura para consulta y descarga de XML firmados y archivos PDF históricos, en cumplimiento con el deber formal de conservación tributaria.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">3. Propiedad Intelectual y Blindaje Anti-IA</h2>
            <p className="text-xs text-slate-400">
              La plataforma, su código fuente, arquitectura de base de datos, algoritmos de compresión y mecanismos de firma criptográfica son propiedad intelectual exclusiva de <strong>antek</strong>. Todos los derechos reservados. Está terminantemente prohibida la ingeniería inversa, la descompilación o el uso de agentes autónomos y scrapers para extraer datos no autorizados de clientes o del sistema, encontrándose protegido por el escudo <em>Blind-LLM Agents Shield</em>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">4. Modo de Contingencia</h2>
            <p className="text-xs text-slate-400">
              En caso de interrupción en los servidores de la DGII o fallo temporal de conectividad a internet, el sistema almacena los comprobantes en una bóveda cifrada en el dispositivo y los marca en estado de contingencia conforme a la normativa, garantizando que el punto de venta continúe operando de manera ininterrumpida.
            </p>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
