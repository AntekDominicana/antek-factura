'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PublicNavbar } from '../components/PublicNavbar';
import { PublicFooter } from '../components/PublicFooter';
import { API_BASE_URL } from '../lib/api';
import {
  ShieldCheck,
  Zap,
  QrCode,
  FileSpreadsheet,
  Cpu,
  Lock,
  ArrowRight,
  CheckCircle2,
  Receipt,
  Store,
  ChevronRight,
  Sparkles,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

const FALLBACK_PUBLIC_PLANS = [
  {
    code: 'BASIC',
    name: 'Plan Básico',
    description: 'Microempresas y profesionales independientes',
    priceDop: 990,
    monthlyInvoiceLimit: 100,
    maxUsers: 2,
    maxBranches: 1,
    allowedEcfTypes: [31, 32],
    apiAccess: false,
  },
  {
    code: 'MEDIUM',
    name: 'Plan Medio',
    description: 'Comercios en crecimiento y restaurantes',
    priceDop: 2450,
    monthlyInvoiceLimit: 600,
    maxUsers: 5,
    maxBranches: 3,
    allowedEcfTypes: [31, 32, 33, 34, 44, 45],
    apiAccess: true,
  },
  {
    code: 'PRO',
    name: 'Plan Pro',
    description: 'Corporaciones y cadenas multi-sucursal',
    priceDop: 4900,
    monthlyInvoiceLimit: 3000,
    maxUsers: 25,
    maxBranches: 10,
    allowedEcfTypes: [31, 32, 33, 34, 41, 43, 44, 45, 46, 47],
    apiAccess: true,
  },
];

export default function HomePage() {
  const [plans, setPlans] = useState<any[]>(FALLBACK_PUBLIC_PLANS);

  useEffect(() => {
    fetch(`${API_BASE_URL}/v1/billing/plans`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.plans && Array.isArray(data.plans) && data.plans.length > 0) {
          setPlans(data.plans);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-white">
      <PublicNavbar />

      <main className="flex-1">
        {/* ==================== HERO SECTION ==================== */}
        <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32">
          {/* Background Glows */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/10 blur-[140px] pointer-events-none rounded-full" />
          <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-indigo-600/15 blur-[120px] pointer-events-none rounded-full" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-xs font-semibold text-sky-300 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Certificación DGII República Dominicana · Ley 32-23</span>
            </div>

            <div className="max-w-4xl mx-auto space-y-4">
              <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
                Facturación Electrónica e-CF Inteligente con{' '}
                <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
                  ANTEK Factura
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
                <em>Creamos soluciones tecnológicas que impulsan el futuro.</em> Emite facturas electrónicas oficiales con código QR, sincroniza tu punto de venta táctil y automatiza los reportes 606 y 607 para tu contable.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link
                href="/register"
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-base shadow-xl shadow-sky-500/25 flex items-center gap-2 transition"
              >
                <span>Comenzar Prueba Gratis</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="px-6 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-base border border-slate-800 transition flex items-center gap-2"
              >
                <span>Iniciar Sesión en el Portal</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>

            {/* Proof Badges */}
            <div className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
              {[
                { title: 'Firma XMLDSig RSA', desc: 'Validación de certificado .p12 con DGII' },
                { title: 'Escáner QR 606', desc: 'Lectura de gastos en tiempo real' },
                { title: 'Respaldo Offline', desc: 'Modo de contingencia ante caídas' },
                { title: 'Blindaje Anti-IA', desc: 'Protección criptográfica antek' },
              ].map((badge, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                    {badge.title}
                  </div>
                  <p className="text-[11px] text-slate-400">{badge.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== CARACTERÍSTICAS PRINCIPALES ==================== */}
        <section id="caracteristicas" className="py-20 bg-slate-900/40 border-y border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Todo en Una Sola Plataforma
              </h2>
              <h3 className="text-3xl font-black text-white">
                Diseñado para Negocios y Contables en RD
              </h3>
              <p className="text-sm text-slate-400">
                Sin configuraciones complicadas. Todo lo que tu negocio necesita para cumplir con la DGII de manera rápida y elegante.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 hover:border-sky-500/50 transition">
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
                  <Receipt className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-white">Emisión e-CF con Tu Logo</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Genera comprobantes oficiales (E31, E32, E33, E34, E41) con el logo de tu empresa y el aval de <strong>ANTEK Factura</strong> en formato Hoja Carta o Tirilla 80mm.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 hover:border-sky-500/50 transition">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                  <QrCode className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-white">Escáner Móvil QR de Gastos (606)</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Apunta tu celular al código QR de cualquier factura con impuestos. El sistema extrae el RNC del suplidor, monto e ITBIS directamente a tu libro contable 606 y genera el archivo Excel para tu contable.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 hover:border-sky-500/50 transition">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                  <Store className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-white">Punto de Venta (POS) Táctil</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ideal para restaurantes, cafeterías y comercios minoristas. Cobra rápido, imprime tickets térmicos y factura sin interrupciones incluso si se pierde la conexión a internet.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 hover:border-sky-500/50 transition">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-white">Excel Oficial para Contables</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Descarga tus reportes 606 de compras y 607 de ventas en formatos Excel limpios con pestañas separadas y codificación oficial DGII para declarar tus impuestos sin estrés.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 hover:border-sky-500/50 transition">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
                  <Cpu className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-white">API REST Pública & IA Copilot</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Conecta cualquier ERP, software de terceros o agente autónomo mediante API Keys de alta entropía (192-bit) cifradas con AES-256-GCM y soporte para preguntas fiscales vía Gemini.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 hover:border-sky-500/50 transition">
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold">
                  <Lock className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-white">Blind-LLM Shield & RLS</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Tus datos fiscales están protegidos con Row-Level Security y un escudo perimetral anti-scraping desarrollado por <strong>antek</strong> para impedir la copia de datos o ingeniería inversa.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== COMPARATIVA CON FACTURADOR GRATUITO ==================== */}
        <section id="comparativa" className="py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="text-center space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                ¿Por Qué Elegir ANTEK Factura?
              </h2>
              <h3 className="text-3xl font-black text-white">
                Facturador Gratuito DGII vs. ANTEK Factura
              </h3>
              <p className="text-sm text-slate-400">
                Ahorra horas de trabajo manual y ofrece una experiencia profesional a tus clientes.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 font-bold text-slate-300">Característica</th>
                      <th className="py-3.5 px-4 font-semibold text-slate-400">Facturador Gratuito DGII</th>
                      <th className="py-3.5 px-4 font-bold text-sky-400 bg-sky-950/30">ANTEK Factura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-white">Velocidad de Facturación</td>
                      <td className="py-3 px-4 text-slate-400">Manual, 1 por 1 en formulario web lento</td>
                      <td className="py-3 px-4 font-bold text-emerald-400 bg-sky-950/20">Instantánea con 1 clic y POS</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-white">Escáner Móvil QR Gastos (606)</td>
                      <td className="py-3 px-4 text-rose-400">❌ No disponible</td>
                      <td className="py-3 px-4 font-bold text-emerald-400 bg-sky-950/20">✅ Extrae RNC e ITBIS con tu cámara</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-white">Logo Personalizado de Empresa</td>
                      <td className="py-3 px-4 text-rose-400">❌ Formato estricto estándar</td>
                      <td className="py-3 px-4 font-bold text-emerald-400 bg-sky-950/20">✅ Tu logo con co-branding elegante</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-white">Punto de Venta (POS) & Impresora Térmica</td>
                      <td className="py-3 px-4 text-rose-400">❌ Incompatible</td>
                      <td className="py-3 px-4 font-bold text-emerald-400 bg-sky-950/20">✅ Soporta Tirilla 80mm y Hoja Carta</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-white">Respaldo Offline en Contingencia</td>
                      <td className="py-3 px-4 text-rose-400">❌ Se detiene si no hay internet</td>
                      <td className="py-3 px-4 font-bold text-emerald-400 bg-sky-950/20">✅ Sigue facturando sin internet</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-white">Excel para el Contable</td>
                      <td className="py-3 px-4 text-slate-400">Descarga manual básica</td>
                      <td className="py-3 px-4 font-bold text-emerald-400 bg-sky-950/20">✅ Libro Digital 606/607 exportable</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== PLANES Y PRECIOS ==================== */}
        <section id="planes" className="py-20 bg-slate-900/30 border-t border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Precios Transparentes
              </h2>
              <h3 className="text-3xl font-black text-white">
                Elige el Plan que se Adapta a Tu Negocio
              </h3>
              <p className="text-sm text-slate-400">
                Paga de forma segura con Link de Pago (tarjeta de crédito/débito). Todos los planes incluyen 5 días de gracia para que tu negocio nunca se detenga.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {plans.map((p: any) => {
                const isPopular = p.code === 'MEDIUM';
                return (
                  <div
                    key={p.code}
                    className={`p-8 rounded-3xl space-y-6 flex flex-col justify-between relative ${
                      isPopular
                        ? 'bg-slate-900 border-2 border-sky-500 shadow-2xl shadow-sky-500/10'
                        : 'bg-slate-950 border border-slate-800'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                        Más Popular
                      </div>
                    )}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-bold text-white">{p.name}</h4>
                        <p className="text-xs text-slate-400">{p.description}</p>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white">
                          RD$ {Number(p.priceDop || 0).toLocaleString('es-DO')}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold">/ mes</span>
                      </div>
                      <ul className="space-y-2.5 text-xs text-slate-300">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          Hasta {Number(p.monthlyInvoiceLimit || 100).toLocaleString('es-DO')} comprobantes e-CF / mes
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          e-CF habilitados: {Array.isArray(p.allowedEcfTypes) ? p.allowedEcfTypes.join(', ') : '31, 32'}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          Hasta {p.maxUsers || 2} usuarios y {p.maxBranches || 1} sucursales
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          {p.apiAccess ? 'Acceso a API REST y Webhooks en vivo' : 'Emisión desde Portal Web + QR'}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          5 días calendario de gracia garantizados
                        </li>
                      </ul>
                    </div>
                    <Link
                      href={`/register?plan=${p.code}`}
                      className={`w-full py-3 rounded-xl font-bold text-xs text-center block transition ${
                        isPopular
                          ? 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/25'
                          : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-700'
                      }`}
                    >
                      Seleccionar {p.name}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
