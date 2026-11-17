'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AntekLogo } from '../../components/AntekLogo';
import { AppProvider, useApp } from '../../context/AppContext';
import { apiFetch } from '../../lib/api';
import {
  User,
  LayoutDashboard,
  FilePlus2,
  Receipt,
  QrCode,
  Users,
  Package,
  Layers,
  FileSpreadsheet,
  Settings,
  Building2,
  Users2,
  Code2,
  CreditCard,
  ShieldCheck,
  Menu,
  X,
  ChevronRight,
  LogOut,
  ExternalLink,
  Clock,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tenant } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subState, setSubState] = useState<{
    status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';
    graceDaysRemaining?: number;
    plan?: { name: string; priceDop: number };
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiFetch<any>('/v1/billing/subscription')
      .then((data) => {
        if (isMounted && data) {
          setSubState(data);
          // Si está suspendido y no está en páginas permitidas de consulta/pago, redirigir
          if (
            data.status === 'SUSPENDED' &&
            pathname !== '/app/suspended' &&
            pathname !== '/app/invoices' &&
            pathname !== '/app/reports' &&
            pathname !== '/app/settings/billing'
          ) {
            router.push('/app/suspended');
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('antek_user');
    localStorage.removeItem('antek_token');
    router.push('/login');
  };

  const mainNav = [
    { href: '/app/dashboard', label: 'Resumen Ejecutivo', icon: LayoutDashboard },
    { href: '/app/invoices/new', label: 'Nueva Factura e-CF', icon: FilePlus2, highlight: true },
    { href: '/app/invoices', label: 'Comprobantes Emitidos', icon: Receipt },
    { href: '/app/purchases', label: 'Bandeja Compras & QR', icon: QrCode },
    { href: '/app/customers', label: 'Clientes & RNC', icon: Users },
    { href: '/app/products', label: 'Productos & Catálogo', icon: Package },
    { href: '/app/sequences', label: 'Secuencias e-NCF', icon: Layers },
    { href: '/app/reports', label: 'Libro 606 & Excel', icon: FileSpreadsheet },
  ];

  const settingsNav = [
    { href: '/app/settings/profile', label: 'Mi Perfil & Plan', icon: User },
    { href: '/app/settings/company', label: 'Mi Empresa & Logo', icon: Building2 },
    { href: '/app/settings/team', label: 'Equipo & Cajeros', icon: Users2 },
    { href: '/app/settings/security', label: 'Seguridad & 2FA', icon: ShieldCheck },
    { href: '/app/settings/developers', label: 'API & Copilot IA', icon: Code2 },
    { href: '/app/settings/billing', label: 'Planes & Link Pago', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row text-slate-800 selection:bg-sky-500 selection:text-white">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-72 flex-col bg-slate-950 text-slate-200 border-r border-slate-800 shrink-0 sticky top-0 h-screen">
        {/* Header con AntekLogo */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <Link href="/app/dashboard">
            <AntekLogo theme="dark" size="md" />
          </Link>
        </div>

        {/* Tenant selector / quick badge */}
        <div className="p-3.5 m-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          {tenant?.logoBase64 ? (
            <img
              src={tenant.logoBase64}
              alt="Logo"
              className="w-8 h-8 rounded-lg object-contain bg-white p-0.5"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-xs border border-sky-500/30">
              {tenant?.razonSocial ? tenant.razonSocial.slice(0, 2).toUpperCase() : 'EC'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate">
              {tenant?.razonSocial || 'Tu Empresa'}
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate">
              RNC: {tenant?.rnc || 'Pendiente'}
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto text-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1.5">
            Operaciones
          </div>
          {mainNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== '/app/dashboard' && pathname.startsWith(item.href) && item.href !== '/app/invoices');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition ${
                  active
                    ? 'bg-sky-500 text-slate-950 shadow-md font-bold'
                    : item.highlight
                    ? 'bg-sky-950/60 text-sky-300 border border-sky-500/30 hover:bg-sky-900/60'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 pt-4 pb-1.5">
            Configuración & Ajustes
          </div>
          {settingsNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition ${
                  active
                    ? 'bg-slate-800 text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Sidebar */}
        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[10px]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Blind-LLM Shield ✓</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="hover:text-rose-400 text-slate-400 transition flex items-center gap-1 text-[11px]"
          >
            <LogOut className="w-3 h-3" /> Salir
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-slate-950 text-white p-4 border-b border-slate-800 flex items-center justify-between">
          <AntekLogo variant="mark" size="sm" />
          <div className="text-xs font-bold truncate max-w-[160px]">
            {tenant?.razonSocial || 'ANTEK Factura'}
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg bg-slate-900 text-slate-300"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-950 border-b border-slate-800 p-4 space-y-2 text-xs">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-900"
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-slate-800 text-slate-500 text-[10px] uppercase font-bold">
              Configuración
            </div>
            {settingsNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-1.5 rounded-lg text-slate-400 hover:bg-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}

        {/* Content body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {/* Banner Global de Gracia (Si la suscripción está PAST_DUE) */}
          {subState?.status === 'PAST_DUE' && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/20 shrink-0 shadow-inner">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-black text-xs uppercase tracking-wider text-amber-100 flex items-center gap-2">
                    <span>Plazo de Gracia Activo</span>
                    <span className="px-2 py-0.5 rounded-full bg-white text-amber-950 font-black text-[10px] shadow-xs">
                      {subState.graceDaysRemaining !== undefined ? subState.graceDaysRemaining : 5} días restantes
                    </span>
                  </div>
                  <p className="text-xs text-white/95 leading-relaxed mt-0.5">
                    Tu suscripción mensual venció. Dispones de un plazo de 5 días para pagar antes del bloqueo automático de emisión.
                  </p>
                </div>
              </div>

              <Link
                href="/app/settings/billing"
                className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs shadow-md shrink-0 flex items-center justify-center gap-1.5 transition text-center"
              >
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span>Generar Link de Pago</span>
              </Link>
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </AppProvider>
  );
}
