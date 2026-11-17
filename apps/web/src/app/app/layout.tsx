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
  Building2,
  Users2,
  Code2,
  CreditCard,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  Clock,
  Crown,
} from 'lucide-react';

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tenant } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('ADMIN');
  const [subState, setSubState] = useState<{
    status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';
    graceDaysRemaining?: number;
    plan?: { name: string; priceDop: number };
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('antek_user');
      if (raw) {
        const u = JSON.parse(raw);
        setUserName(u.fullName || u.email || '');
        setUserRole(u.role || 'ADMIN');
        const emailLower = String(u.email || '').toLowerCase();
        setIsSuperAdmin(
          u.role === 'SUPERADMIN' ||
            emailLower === 'rootfacturas@antek.com.do' ||
            emailLower === 'rootfacturas'
        );
      }
    } catch {}
  }, []);

  useEffect(() => {
    let isMounted = true;
    apiFetch<any>('/v1/billing/subscription')
      .then((data) => {
        if (isMounted && data) {
          setSubState(data);
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
    localStorage.removeItem('antek_tenant_cache');
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

  const pageTitle =
    [...mainNav, ...settingsNav].find(
      (item) => pathname === item.href || (item.href !== '/app/dashboard' && pathname.startsWith(item.href))
    )?.label || 'Portal Fiscal e-CF';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row text-slate-800 selection:bg-sky-500 selection:text-white">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-72 flex-col bg-slate-950 text-slate-200 border-r border-slate-800 shrink-0 sticky top-0 h-screen">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <Link href="/app/dashboard">
            <AntekLogo theme="dark" size="md" />
          </Link>
        </div>

        {/* Botón Consola Root Admin */}
        {isSuperAdmin && (
          <div className="px-3 pt-3">
            <Link
              href="/superadmin"
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 font-bold text-xs transition"
            >
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Consola Admin Root</span>
            </Link>
          </div>
        )}

        {/* Tarjeta empresa */}
        <div className="p-3.5 m-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          {tenant?.logoBase64 ? (
            <img
              src={tenant.logoBase64}
              alt="Logo"
              className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-xs border border-sky-500/30 shrink-0">
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
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto text-xs pb-4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1.5">
            Operaciones
          </div>
          {mainNav.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== '/app/dashboard' &&
                pathname.startsWith(item.href) &&
                item.href !== '/app/invoices');
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
            Configuración &amp; Ajustes
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

        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[10px] truncate">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{userName || 'Sesión Segura ✓'}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="hover:text-rose-400 text-slate-400 transition flex items-center gap-1 text-[11px] shrink-0 cursor-pointer"
          >
            <LogOut className="w-3 h-3" /> Salir
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Action Bar */}
        <header className="hidden lg:flex sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-6 xl:px-8 h-16 items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-900 tracking-tight truncate">
                  {pageTitle}
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  DGII Ley 32-23
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 truncate">
                <span className="font-semibold text-slate-700 truncate max-w-[220px]">
                  {tenant?.razonSocial || 'Tu Empresa'}
                </span>
                <span>•</span>
                <span className="font-mono">RNC {tenant?.rnc || 'Pendiente'}</span>
                {subState?.plan?.name && (
                  <>
                    <span>•</span>
                    <span className="font-bold text-sky-700">{subState.plan.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href="/app/purchases?scan=1"
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition"
            >
              <QrCode className="w-3.5 h-3.5 text-sky-400" />
              <span>Escanear Lote QR</span>
            </Link>
            <Link
              href="/app/invoices/new"
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm shadow-sky-600/20 transition"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>Nueva Factura e-CF</span>
            </Link>
            {isSuperAdmin && (
              <Link
                href="/superadmin"
                className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs inline-flex items-center gap-1.5 transition"
              >
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span>Super-Admin</span>
              </Link>
            )}
            <Link
              href="/app/settings/profile"
              className="ml-1 pl-2 pr-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200 flex items-center gap-2 transition"
              title="Mi Perfil y Suscripción"
            >
              <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white text-[11px] font-black flex items-center justify-center uppercase">
                {(userName || 'U').slice(0, 2)}
              </span>
              <span className="text-left leading-tight hidden xl:block">
                <span className="block text-[11px] font-bold text-slate-900 max-w-[110px] truncate">
                  {userName || 'Usuario'}
                </span>
                <span className="block text-[9px] font-bold text-sky-700 uppercase">
                  {isSuperAdmin ? 'SUPERADMIN' : userRole}
                </span>
              </span>
            </Link>
          </div>
        </header>

        {/* Mobile Sticky Glassmorphic Header */}
        <header className="lg:hidden sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md text-white px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2 shadow-md">
          <Link href="/app/dashboard" className="flex items-center gap-2.5 min-w-0">
            <AntekLogo variant="mark" size="sm" />
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-white truncate max-w-[140px]">
                {tenant?.razonSocial || 'ANTEK Factura'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">
                {tenant?.rnc ? `RNC ${tenant.rnc}` : 'e-CF DGII'}
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href="/app/purchases?scan=1"
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-sm"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR</span>
            </Link>
            <Link
              href="/app/invoices/new"
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-[11px] inline-flex items-center gap-1 border border-slate-700"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>e-CF</span>
            </Link>
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white transition"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Slide-Over Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-[57px] z-50 flex flex-col">
            <div
              className="fixed inset-0 top-[57px] bg-slate-950/70 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-10 bg-slate-950 border-b border-slate-800 p-4 space-y-4 max-h-[82vh] overflow-y-auto shadow-2xl">
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {tenant?.razonSocial || 'Tu Empresa'}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    RNC: {tenant?.rnc || '—'} · {subState?.plan?.name || 'Plan Activo'}
                  </div>
                </div>
                {isSuperAdmin && (
                  <Link
                    href="/superadmin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold inline-flex items-center gap-1 shrink-0"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Root</span>
                  </Link>
                )}
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                  Operaciones Fiscales
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {mainNav.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold ${
                          active
                            ? 'bg-sky-500 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-200 border border-slate-800'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                  Configuración &amp; Cuenta
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {settingsNav.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold ${
                          active
                            ? 'bg-slate-800 text-white border border-slate-700'
                            : 'bg-slate-900/70 text-slate-300 border border-slate-800/80'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        )}

        {/* Content body */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-24 lg:pb-8 overflow-y-auto">
          {subState?.status === 'PAST_DUE' && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/20 shrink-0 shadow-inner">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-black text-xs uppercase tracking-wider text-amber-100 flex items-center gap-2">
                    <span>Plazo de Gracia Activo</span>
                    <span className="px-2 py-0.5 rounded-full bg-white text-amber-950 font-black text-[10px]">
                      {subState.graceDaysRemaining ?? 5} días restantes
                    </span>
                  </div>
                  <p className="text-xs text-white/95 leading-relaxed mt-0.5">
                    Tu suscripción mensual venció. Realiza tu pago antes de vencer el plazo de gracia.
                  </p>
                </div>
              </div>

              <Link
                href="/app/settings/billing"
                className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs shrink-0 flex items-center justify-center gap-1.5 transition"
              >
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span>Ver Planes y Pago</span>
              </Link>
            </div>
          )}

          {children}
        </main>

        {/* Mobile Bottom Tab Bar (5 acciones principales) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-1.5 py-1.5 grid grid-cols-5 items-center text-[10px] font-semibold text-slate-400 shadow-[0_-4px_20px_rgba(2,6,23,0.4)]">
          <Link
            href="/app/dashboard"
            className={`flex flex-col items-center justify-center py-1 rounded-lg ${
              pathname === '/app/dashboard' ? 'text-sky-400 font-bold' : 'text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span>Inicio</span>
          </Link>

          <Link
            href="/app/invoices/new"
            className={`flex flex-col items-center justify-center py-1 rounded-lg ${
              pathname === '/app/invoices/new' ? 'text-sky-400 font-bold' : 'text-slate-400'
            }`}
          >
            <FilePlus2 className="w-4 h-4 mb-0.5" />
            <span>Emitir</span>
          </Link>

          <Link
            href="/app/purchases?scan=1"
            className="flex flex-col items-center justify-center -mt-4"
          >
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/30 flex items-center justify-center border-2 border-slate-950">
              <QrCode className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-extrabold text-sky-300 mt-0.5">Escanear</span>
          </Link>

          <Link
            href="/app/reports"
            className={`flex flex-col items-center justify-center py-1 rounded-lg ${
              pathname === '/app/reports' ? 'text-sky-400 font-bold' : 'text-slate-400'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 mb-0.5" />
            <span>Libro 606</span>
          </Link>

          <Link
            href="/app/settings/billing"
            className={`flex flex-col items-center justify-center py-1 rounded-lg ${
              pathname === '/app/settings/billing' ? 'text-sky-400 font-bold' : 'text-slate-400'
            }`}
          >
            <CreditCard className="w-4 h-4 mb-0.5" />
            <span>Planes</span>
          </Link>
        </nav>
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
