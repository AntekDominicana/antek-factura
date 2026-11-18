'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { PublicNavbar } from '../components/PublicNavbar';
import { PublicFooter } from '../components/PublicFooter';
import { API_BASE_URL, formatDOP } from '../lib/api';
import {
  ShieldCheck,
  QrCode,
  FileSpreadsheet,
  Cpu,
  Lock,
  ArrowRight,
  CheckCircle2,
  Receipt,
  Store,
  ChevronRight,
  MessageCircle,
  Sparkles,
  FileCheck2,
  Building2,
  HelpCircle,
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

const FAQS = [
  {
    q: '¿Cómo funciona la prueba gratis de 5 días?',
    a: 'Al crear tu cuenta recibes 5 días gratis para emitir e-CF de prueba, escanear facturas 606 con QR y generar tus reportes en Excel sin ingresar tarjeta de crédito.',
  },
  {
    q: '¿Puedo usar mi propio certificado digital .p12 de la DGII?',
    a: 'Sí. Sube tu certificado .p12 en Configuración y cada factura se firma digitalmente con XMLDSig RSA antes de enviarse.',
  },
  {
    q: '¿El escáner QR 606 funciona con cualquier factura electrónica de RD?',
    a: 'Sí. Al escanear el código QR del timbre DGII (e-CF o FC), extraemos RNC, razón social, e-NCF, ITBIS y total directo a tu Libro de Compras 606.',
  },
  {
    q: '¿Qué pasa si emito más comprobantes o necesito cambiar de plan?',
    a: 'Puedes cambiar de plan en cualquier momento desde tu panel de facturación o pasar al plan Empresarial si superas los 3,000 comprobantes mensuales.',
  },
  {
    q: '¿Los precios incluyen ITBIS?',
    a: 'Los precios mostrados son mensuales más ITBIS (18%), con opción de pago anual con 15% de descuento.',
  },
];

const COMPARISON_ROWS = [
  {
    feature: 'Velocidad de Facturación',
    dgii: 'Manual, 1 por 1 en formulario web lento',
    antek: 'Instantánea en 1 clic con catálogo y POS',
  },
  {
    feature: 'Escáner Móvil QR Gastos (606)',
    dgii: 'No disponible',
    antek: 'Extrae RNC, proveedor e ITBIS con cámara',
  },
  {
    feature: 'Logo Personalizado de Empresa',
    dgii: 'Formato estándar sin marca',
    antek: 'Tu logo en Hoja Carta y Tirilla 80mm',
  },
  {
    feature: 'Punto de Venta (POS) & Térmica',
    dgii: 'Incompatible',
    antek: 'Soporta impresora térmica 80mm y carta',
  },
  {
    feature: 'Respaldo Offline en Contingencia',
    dgii: 'Se detiene si falla internet',
    antek: 'Continúa operando y sincroniza al volver',
  },
  {
    feature: 'Excel Oficial para el Contable',
    dgii: 'Descarga manual básica',
    antek: 'Libro Digital 606 y 607 listo para DGII',
  },
];

export default function HomePage() {
  const [plans, setPlans] = useState<any[]>(FALLBACK_PUBLIC_PLANS);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [ecfCount, setEcfCount] = useState(10000);
  const counterStarted = useRef(false);

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

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

    if (!counterStarted.current) {
      counterStarted.current = true;
      const target = 12480;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / 1100, 1);
        setEcfCount(Math.floor(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#050a18] text-[#f1f5f9] flex flex-col selection:bg-sky-500 selection:text-white">
      <PublicNavbar />

      <main className="flex-1">
        {/* ==================== HERO SPLIT SECTION ==================== */}
        <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 hero-glow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left Column */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0d1426] border border-slate-700/80 text-xs sm:text-[13px] font-semibold text-sky-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Compatible con e-CF Ley 32-23 · República Dominicana</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1]">
                  Facturación Electrónica e-CF Inteligente con{' '}
                  <span className="grad-text">ANTEK Factura</span>
                </h1>

                <p className="text-base sm:text-lg text-[#a8b3c7] max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  Emite facturas electrónicas oficiales con código QR, valida receptores por RNC en segundos y automatiza los libros 606 y 607 para tu contable.
                </p>

                {/* CTAs: Primary button + clean text link */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-1">
                  <Link
                    href="/register"
                    className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-[#18a8f0] to-[#5b5bf0] text-white font-bold text-base shadow-xl shadow-sky-500/25 flex items-center justify-center gap-2 btn-fx"
                  >
                    <span>Comenzar Prueba Gratis (5 Días)</span>
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/login"
                    className="text-sm font-semibold text-slate-300 hover:text-sky-400 transition inline-flex items-center gap-1 py-2"
                  >
                    <span>¿Ya tienes cuenta? Iniciar Sesión</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* Live Social Proof Stats */}
                <div className="pt-4 grid grid-cols-3 gap-4 max-w-lg mx-auto lg:mx-0 border-t border-white/10">
                  <div>
                    <div className="text-xl sm:text-2xl font-black text-white font-mono">
                      +{ecfCount.toLocaleString('es-DO')}
                    </div>
                    <div className="text-[13px] text-[#a8b3c7]">e-CF procesados</div>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                      &lt; 2s
                    </div>
                    <div className="text-[13px] text-[#a8b3c7]">Lectura QR 606</div>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-black text-sky-400 font-mono">
                      99.9%
                    </div>
                    <div className="text-[13px] text-[#a8b3c7]">Disponibilidad</div>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Product Preview Card */}
              <div className="lg:col-span-5">
                <div className="rounded-3xl bg-[#0d1426] border border-slate-800/90 p-5 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span className="text-xs font-bold text-white">Vista Previa e-CF 31</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-[11px] font-bold text-sky-300">
                      XMLDSig Firmado
                    </span>
                  </div>

                  {/* Mock Invoice Sheet */}
                  <div className="rounded-2xl bg-white text-slate-900 p-4 space-y-3 shadow-inner">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <div className="text-xs font-black text-slate-900">COMERCIAL EJEMPLO SRL</div>
                        <div className="text-[11px] text-slate-500 font-mono">RNC: 131880738</div>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-bold text-[10px]">
                          e-CF 31 · Crédito Fiscal
                        </span>
                        <div className="text-[11px] font-mono font-bold text-slate-800 mt-0.5">
                          E310000004821
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Servicio Consultoría IT</span>
                        <span className="font-mono font-semibold text-slate-900">RD$ 15,000.00</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>ITBIS (18%)</span>
                        <span className="font-mono">RD$ 2,700.00</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-slate-100 font-black text-slate-900">
                        <span>Total Facturado</span>
                        <span className="font-mono text-sky-700">RD$ 17,700.00</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                          <QrCode className="w-6 h-6" />
                        </div>
                        <div className="text-[10px] text-slate-500 leading-tight">
                          Timbre e-CF DGII<br />
                          <span className="font-mono text-slate-700">Cód: 9fA4c2</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                        Aceptado ✓
                      </span>
                    </div>
                  </div>

                  {/* Quick Summary Pills */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-[#131c33] border border-white/10">
                      <div className="text-[#a8b3c7]">Libro 606 (QR)</div>
                      <div className="font-bold text-emerald-400 mt-0.5">Exportación Excel lista</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#131c33] border border-white/10">
                      <div className="text-[#a8b3c7]">Formato 607</div>
                      <div className="font-bold text-sky-400 mt-0.5">Sincronizado al día</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Proof Badges */}
            <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-left reveal">
              {[
                { title: 'Firma XMLDSig RSA', desc: 'Validación con tu certificado .p12' },
                { title: 'Escáner QR 606', desc: 'Lectura de gastos en tiempo real' },
                { title: 'Respaldo Offline', desc: 'Modo contingencia ante caídas' },
                { title: 'Cifrado y firma digital', desc: 'Seguridad bancaria por empresa' },
              ].map((badge, i) => (
                <div key={i} className="p-4 rounded-xl bg-[#0d1426] border border-white/10 space-y-1">
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                    {badge.title}
                  </div>
                  <p className="text-[13px] text-[#a8b3c7]">{badge.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== CÓMO FUNCIONA (3 PASOS) ==================== */}
        <section className="py-16 border-t border-white/10 bg-[#0d1426]/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 reveal">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Puesta en Marcha Rápida
              </h2>
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                Cómo Funciona en 3 Pasos
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  step: '01',
                  icon: Building2,
                  title: 'Registra tu Empresa',
                  desc: 'Ingresa tu RNC y validamos automáticamente tu Razón Social para crear tu espacio privado.',
                },
                {
                  step: '02',
                  icon: FileCheck2,
                  title: 'Personaliza Logo y .p12',
                  desc: 'Sube el logo de tu negocio para tus facturas e-CF y carga tu certificado digital para firmar.',
                },
                {
                  step: '03',
                  icon: QrCode,
                  title: 'Factura y Escanea 606',
                  desc: 'Emite e-CF 31/32 en 1 clic, escanea compras por QR con tu celular y descarga tu Excel 606/607.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.step}
                    className="p-6 rounded-2xl bg-[#0d1426] border border-white/10 space-y-3 card-fx"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-11 h-11 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-2xl font-black text-slate-700 font-mono">{item.step}</span>
                    </div>
                    <h4 className="text-lg font-bold text-white">{item.title}</h4>
                    <p className="text-sm text-[#a8b3c7] leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ==================== CARACTERÍSTICAS PRINCIPALES ==================== */}
        <section id="caracteristicas" className="py-20 bg-[#0d1426]/60 border-y border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 reveal">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Todo en Una Sola Plataforma
              </h2>
              <h3 className="text-3xl font-black text-white">
                Diseñado para Negocios y Contables en RD
              </h3>
              <p className="text-sm sm:text-base text-[#a8b3c7]">
                Sin configuraciones complicadas. Todo lo que tu negocio necesita para cumplir con la Ley 32-23.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Receipt,
                  color: 'bg-sky-500/10 text-sky-400',
                  title: 'Emisión e-CF con Tu Logo',
                  desc: 'Genera comprobantes (E31, E32, E33, E34, E41) con el logo de tu empresa en formato Hoja Carta o Tirilla 80mm.',
                },
                {
                  icon: QrCode,
                  color: 'bg-emerald-500/10 text-emerald-400',
                  title: 'Escáner Móvil QR de Gastos (606)',
                  desc: 'Apunta tu celular al QR de cualquier factura. Extrae RNC, suplidor, monto e ITBIS directo a tu libro 606 sin duplicados.',
                },
                {
                  icon: Store,
                  color: 'bg-indigo-500/10 text-indigo-400',
                  title: 'Punto de Venta (POS) Táctil',
                  desc: 'Ideal para comercios, restaurantes y ferreterías. Cobra rápido, imprime tickets térmicos y opera incluso en contingencia.',
                },
                {
                  icon: FileSpreadsheet,
                  color: 'bg-amber-500/10 text-amber-400',
                  title: 'Excel Oficial para Contables',
                  desc: 'Descarga tus reportes 606 de compras y 607 de ventas en Excel con codificación oficial DGII listos para declarar.',
                },
                {
                  icon: Cpu,
                  color: 'bg-purple-500/10 text-purple-400',
                  title: 'API REST Pública & Webhooks',
                  desc: 'Conecta tu ERP o tienda online mediante API Keys seguras cifradas con AES-256-GCM y notificaciones en vivo.',
                },
                {
                  icon: Lock,
                  color: 'bg-rose-500/10 text-rose-400',
                  title: 'Cifrado y Firma Digital',
                  desc: 'Tus datos fiscales están aislados por empresa con Row-Level Security en PostgreSQL, bcrypt y firma XMLDSig.',
                },
              ].map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={idx}
                    className="p-6 rounded-2xl bg-[#050a18] border border-white/10 space-y-3 card-fx"
                  >
                    <div className={`w-12 h-12 rounded-xl ${feat.color} flex items-center justify-center`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h4 className="text-lg font-bold text-white">{feat.title}</h4>
                    <p className="text-sm text-[#a8b3c7] leading-relaxed">{feat.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ==================== TESTIMONIOS & PRUEBA SOCIAL ==================== */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 reveal">
            <div className="text-center space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Confianza de Contadores y Empresas
              </h2>
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                Lo Que Dicen Nuestros Usuarios en RD
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  quote:
                    'Antes tardaba horas digitando el 606. Ahora escaneo 15 facturas seguidas con el celular y exporto el Excel sin errores.',
                  author: 'Lic. Carla Méndez',
                  role: 'Contadora Pública · Santo Domingo',
                },
                {
                  quote:
                    'La validación automática de RNC en el e-CF 31 evita devoluciones y nos permite facturar en caja en menos de 10 segundos.',
                  author: 'Roberto Jiménez',
                  role: 'Gerente de Operaciones · Santiago',
                },
                {
                  quote:
                    'Tener las facturas en formato carta y tirilla térmica 80mm con nuestro logo le dio otra imagen al negocio.',
                  author: 'Laura Castillo',
                  role: 'Administradora · Punta Cana',
                },
              ].map((t, i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-[#0d1426] border border-white/10 flex flex-col justify-between space-y-4"
                >
                  <p className="text-sm text-slate-200 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                  <div className="pt-3 border-t border-white/10">
                    <div className="text-sm font-bold text-white">{t.author}</div>
                    <div className="text-[13px] text-[#a8b3c7]">{t.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== COMPARATIVA CON FACTURADOR GRATUITO ==================== */}
        <section id="comparativa" className="py-16 border-t border-white/10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 reveal">
            <div className="text-center space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                ¿Por Qué Elegir ANTEK Factura?
              </h2>
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                Facturador Gratuito DGII vs. ANTEK Factura
              </h3>
              <p className="text-sm text-[#a8b3c7]">
                Ahorra horas de trabajo manual y ofrece una experiencia profesional a tus clientes.
              </p>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-3 sm:hidden">
              {COMPARISON_ROWS.map((row) => (
                <div key={row.feature} className="p-4 rounded-2xl bg-[#0d1426] border border-white/10 space-y-2">
                  <div className="text-sm font-bold text-white">{row.feature}</div>
                  <div className="text-[13px] text-slate-400">
                    <span className="font-semibold text-slate-300">Gratuito DGII:</span> {row.dgii}
                  </div>
                  <div className="text-[13px] text-emerald-400 font-semibold">
                    <span>ANTEK Factura:</span> {row.antek}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block rounded-2xl border border-white/10 bg-[#0d1426] overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#131c33] text-slate-300 border-b border-white/10">
                    <tr>
                      <th className="py-3.5 px-5 font-bold text-white">Característica</th>
                      <th className="py-3.5 px-5 font-semibold text-slate-300">Facturador Gratuito DGII</th>
                      <th className="py-3.5 px-5 font-bold text-sky-400 bg-sky-950/30">ANTEK Factura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-slate-300">
                    {COMPARISON_ROWS.map((row) => (
                      <tr key={row.feature}>
                        <td className="py-3.5 px-5 font-semibold text-white">{row.feature}</td>
                        <td className="py-3.5 px-5 text-[#a8b3c7]">{row.dgii}</td>
                        <td className="py-3.5 px-5 font-bold text-emerald-400 bg-sky-950/20">✓ {row.antek}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== PLANES Y PRECIOS ==================== */}
        <section id="planes" className="py-20 bg-[#0d1426]/50 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 reveal">
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Precios Transparentes
              </h2>
              <h3 className="text-3xl font-black text-white">
                Elige el Plan que se Adapta a Tu Negocio
              </h3>
              <p className="text-sm sm:text-base text-[#a8b3c7]">
                Prueba gratis durante 5 días en cualquier plan. Precios expresados en DOP + ITBIS.
              </p>

              {/* Toggle Mensual / Anual */}
              <div className="inline-flex items-center p-1 rounded-2xl bg-[#131c33] border border-white/10">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-sky-500 text-slate-950 shadow-md'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Mensual
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    billingCycle === 'annual'
                      ? 'bg-sky-500 text-slate-950 shadow-md'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span>Anual</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">
                    -15%
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans.map((p: any) => {
                const isPopular = p.code === 'MEDIUM';
                const monthlyBase = Number(p.priceDop || 0);
                const displayedMonthly =
                  billingCycle === 'annual' ? Math.round(monthlyBase * 0.85) : monthlyBase;

                return (
                  <div
                    key={p.code}
                    className={`p-7 rounded-3xl space-y-6 flex flex-col justify-between relative card-fx ${
                      isPopular
                        ? 'bg-[#0d1426] border-2 border-sky-500 shadow-2xl shadow-sky-500/10'
                        : 'bg-[#050a18] border border-white/10'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-[#18a8f0] to-[#5b5bf0] text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                        Más Popular
                      </div>
                    )}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-bold text-white">{p.name}</h4>
                        <p className="text-[13px] text-[#a8b3c7]">{p.description}</p>
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl sm:text-3xl font-black text-white">
                            {formatDOP(displayedMonthly)}
                          </span>
                          <span className="text-xs text-[#a8b3c7] font-semibold">/ mes</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          + ITBIS {billingCycle === 'annual' ? '· Facturado anual' : ''}
                        </p>
                      </div>
                      <ul className="space-y-2.5 text-[13px] text-slate-200">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          Hasta {Number(p.monthlyInvoiceLimit || 100).toLocaleString('es-DO')} e-CF / mes
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          e-CF: {Array.isArray(p.allowedEcfTypes) ? p.allowedEcfTypes.join(', ') : '31, 32'}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          {p.maxUsers || 2} usuarios · {p.maxBranches || 1} sucursales
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          {p.apiAccess ? 'API REST & Webhooks en vivo' : 'Portal Web + Escáner QR'}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          Prueba gratis 5 días
                        </li>
                      </ul>
                    </div>
                    <Link
                      href={`/register?plan=${p.code}`}
                      className={`w-full py-3 rounded-xl font-bold text-xs text-center block transition btn-fx ${
                        isPopular
                          ? 'bg-gradient-to-r from-[#18a8f0] to-[#5b5bf0] text-white shadow-lg shadow-sky-500/25'
                          : 'bg-[#131c33] hover:bg-slate-800 text-white border border-white/10'
                      }`}
                    >
                      Probar {p.name}
                    </Link>
                  </div>
                );
              })}

              {/* 4ta Tarjeta: Empresarial */}
              <div className="p-7 rounded-3xl space-y-6 flex flex-col justify-between bg-gradient-to-b from-[#131c33] to-[#050a18] border border-indigo-500/30 card-fx">
                <div className="space-y-4">
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase mb-2">
                      <Sparkles className="w-3 h-3" /> Alto Volumen
                    </span>
                    <h4 className="text-lg font-bold text-white">Plan Empresarial</h4>
                    <p className="text-[13px] text-[#a8b3c7]">
                      ¿Emiten más de 3,000 comprobantes al mes?
                    </p>
                  </div>
                  <div className="text-2xl font-black text-white">A la Medida</div>
                  <ul className="space-y-2.5 text-[13px] text-slate-200">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                      Volumen ilimitado de e-CF
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                      Integración ERP dedicada
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                      Soporte prioritario WhatsApp
                    </li>
                  </ul>
                </div>
                <a
                  href="https://wa.me/18095550199?text=Hola%20ANTEK%2C%20necesito%20el%20Plan%20Empresarial%20de%20Facturaci%C3%B3n%20e-CF"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 rounded-xl font-bold text-xs text-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-1.5 transition btn-fx"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Contáctanos</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== PREGUNTAS FRECUENTES (FAQ) ==================== */}
        <section className="py-16 border-t border-white/10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 reveal">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-400">
                <HelpCircle className="w-4 h-4" />
                <span>Preguntas Frecuentes</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                Resolvemos Tus Dudas
              </h3>
            </div>

            <div className="space-y-3">
              {FAQS.map((item, idx) => (
                <details
                  key={idx}
                  className="group rounded-2xl bg-[#0d1426] border border-white/10 p-5 open:border-sky-500/40 transition"
                >
                  <summary className="flex items-center justify-between gap-3 cursor-pointer list-none font-bold text-sm sm:text-base text-white">
                    <span>{item.q}</span>
                    <ChevronRight className="w-4 h-4 text-sky-400 transition-transform group-open:rotate-90 shrink-0" />
                  </summary>
                  <p className="mt-3 text-sm text-[#a8b3c7] leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Botón flotante de WhatsApp */}
      <a
        href="https://wa.me/18095550199?text=Hola%20ANTEK%20Factura%2C%20quiero%20informaci%C3%B3n%20sobre%20facturaci%C3%B3n%20e-CF"
        target="_blank"
        rel="noreferrer"
        aria-label="Soporte por WhatsApp"
        className="fixed bottom-5 right-5 z-40 px-4 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-2xl shadow-emerald-500/30 flex items-center gap-2 btn-fx"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="hidden sm:inline">WhatsApp Soporte</span>
      </a>

      <PublicFooter />
    </div>
  );
}
