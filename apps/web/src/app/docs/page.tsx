'use client';

import React from 'react';
import Link from 'next/link';
import { PublicNavbar } from '../../components/PublicNavbar';
import { PublicFooter } from '../../components/PublicFooter';
import { API_BASE_URL } from '../../lib/api';
import {
  Code2,
  KeyRound,
  FileCode2,
  Terminal,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Copy,
} from 'lucide-react';

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-white">
      <PublicNavbar />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <div className="space-y-4 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-bold border border-sky-500/20">
            <BookOpen className="w-3.5 h-3.5" /> Documentación Oficial & API REST
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white">
            Integración de ANTEK Factura
          </h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Aprende cómo conectar tus sistemas POS para restaurantes, páginas web hechas a medida, Uber Eats, PedidosYa y ERPs a la facturación electrónica oficial de República Dominicana.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/docs/api"
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 transition"
            >
              <Code2 className="w-4 h-4" /> Ver Referencia API Pública v1 & Webhooks Delivery
            </Link>
          </div>
        </div>

        {/* Sección llms-full.txt para IAs */}
        <div id="llms" className="p-6 rounded-2xl bg-gradient-to-r from-sky-950/60 to-slate-900 border border-sky-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <h3 className="font-bold text-white text-base">¿Integras con Cursor, Claude o ChatGPT?</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold">
              AI-First
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Toda la documentación técnica del API, especificaciones de campos e-CF de la DGII y ejemplos de código JSON se encuentran unificados en un solo endpoint para alimentar a tu asistente de IA.
          </p>
          <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-xs text-sky-400">
            <code className="flex-1 truncate">{`${API_BASE_URL}/v1/docs/llms-full.txt`}</code>
            <a
              href={`${API_BASE_URL}/v1/docs/llms-full.txt`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center gap-1 transition"
            >
              Abrir <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Pasos de Integración */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 font-black flex items-center justify-center text-sm">
              1
            </div>
            <h4 className="font-bold text-white text-base">Genera tu API Key</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              En tu panel de <Link href="/app/settings/developers" className="text-sky-400 hover:underline">Configuración → Desarrolladores</Link>, crea una API Key de 192-bits. Esta clave te autentica en el entorno de pruebas (TesteCF) o producción.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 font-black flex items-center justify-center text-sm">
              2
            </div>
            <h4 className="font-bold text-white text-base">Emite tu e-CF en JSON</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Envía un <code className="text-sky-300">POST /v1/invoices</code> con el RNC emisor, comprador, montos de ITBIS y líneas de producto. El motor firma en XMLDSig y envía a DGII.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 font-black flex items-center justify-center text-sm">
              3
            </div>
            <h4 className="font-bold text-white text-base">Imprime el Ticket con QR</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Recibe de vuelta el e-NCF generado, el código de seguridad y la URL del Timbre Fiscal DGII para imprimir en impresoras térmicas de 80mm o enviar por correo en PDF.
            </p>
          </div>
        </div>

        {/* Ejemplo de Código cURL */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-400" /> Ejemplo de Emisión e-CF (cURL)
            </h3>
            <span className="text-[11px] text-slate-500">POST /v1/invoices</span>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
{`curl -X POST ${API_BASE_URL}/v1/invoices \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: sec_live_antek_YOUR_API_KEY_HERE" \\
  -d '{
    "tipoEcf": 31,
    "comprador": {
      "rncComprador": "132507908",
      "razonSocialComprador": "CLIENTE EJEMPLO SRL"
    },
    "tipoPago": 1,
    "items": [
      {
        "nombreItem": "Servicio de Consultoría de Software",
        "cantidadItem": 1,
        "precioUnitarioItem": 15000,
        "indicadorFacturacion": 1
      }
    ]
  }'`}
          </pre>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
