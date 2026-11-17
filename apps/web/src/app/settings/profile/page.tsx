'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Shield,
  CreditCard,
  Building2,
  Mail,
  CheckCircle2,
  ArrowRight,
  LogOut,
  Sparkles,
  Key,
  Calendar,
  Lock,
  Layers,
} from 'lucide-react';
import { apiFetch } from '../../../lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('antek_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {}
    }

    apiFetch<any>('/v1/billing/subscription')
      .then((data) => {
        if (data) setSubscription(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('antek_user');
    localStorage.removeItem('antek_token');
    router.push('/login');
  };

  const planName = subscription?.plan?.name || user?.plan || 'Plan Pro';
  const planLimit = subscription?.plan?.monthlyInvoiceLimit || 3000;
  const invoicesUsed = subscription?.invoicesUsedCurrentPeriod || 0;
  const percentUsed = Math.min(100, Math.round((invoicesUsed / planLimit) * 100));

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-sky-400" />
            Mi Perfil & Cuenta
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Administra tus credenciales en Supabase, roles en la empresa y el plan de suscripción contratado.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          Cerrar Sesión
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tarjeta de Datos Personales & Rol */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-sky-500/20">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-sm truncate">
                {user?.fullName || 'Usuario'}
              </h3>
              <p className="text-xs text-slate-400 truncate">{user?.email || '—'}</p>
              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Shield className="w-3 h-3" />
                Rol: {user?.role || 'ADMIN'}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 space-y-3 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                Empresa Contribuyente:
              </span>
              <span className="font-semibold text-white">{user?.tenantName || 'No configurada'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                RNC Fiscal:
              </span>
              <span className="font-mono font-semibold text-sky-400">{user?.rnc || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Estado en Supabase:
              </span>
              <span className="text-emerald-400 font-semibold">Activo y Verificado</span>
            </div>
          </div>
        </div>

        {/* Tarjeta de Plan Actual y Cambio de Plan */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/40 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-sky-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Suscripción Activa en Plataforma
              </span>
              <h2 className="text-2xl font-black text-white mt-0.5">{planName}</h2>
              <p className="text-xs text-slate-400">
                Facturación electrónica ilimitada y acceso total a la API DGII.
              </p>
            </div>
            <Link
              href="/app/settings/billing"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition self-start sm:self-auto"
            >
              <CreditCard className="w-4 h-4" />
              Cambiar de Plan
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Barra de progreso de consumo de facturas */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Consumo de comprobantes e-CF este mes:</span>
              <span className="font-mono font-bold text-sky-400">
                {invoicesUsed} / {planLimit} e-CF ({percentUsed}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-sky-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Renovación automática cada 30 días con 5 días de gracia garantizados ante demoras de pago.
            </p>
          </div>

          {/* Planes Disponibles para Migrar */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-400" />
              Planes Disponibles para tu Empresa:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
                <div>
                  <h5 className="font-bold text-white text-xs">Plan Básico</h5>
                  <p className="text-[11px] text-slate-400">100 e-CF/mes · 2 Cajeros</p>
                  <p className="font-mono text-sm font-bold text-slate-200 mt-1">RD$990 / mes</p>
                </div>
                <Link
                  href="/app/settings/billing"
                  className="w-full text-center py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 text-[11px] font-semibold border border-slate-800 transition"
                >
                  Elegir Básico
                </Link>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
                <div>
                  <h5 className="font-bold text-white text-xs">Plan Medio</h5>
                  <p className="text-[11px] text-slate-400">600 e-CF/mes · API & 5 Cajeros</p>
                  <p className="font-mono text-sm font-bold text-slate-200 mt-1">RD$2,450 / mes</p>
                </div>
                <Link
                  href="/app/settings/billing"
                  className="w-full text-center py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 text-[11px] font-semibold border border-slate-800 transition"
                >
                  Elegir Medio
                </Link>
              </div>

              <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-500/40 flex flex-col justify-between gap-3 relative overflow-hidden">
                <div className="absolute -top-1 -right-1 px-2 py-0.5 rounded-bl-lg bg-sky-500 text-[9px] font-bold text-white uppercase">
                  Actual
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs">Plan Pro</h5>
                  <p className="text-[11px] text-slate-400">3,000 e-CF/mes · 25 Cajeros</p>
                  <p className="font-mono text-sm font-bold text-sky-400 mt-1">RD$4,900 / mes</p>
                </div>
                <div className="w-full text-center py-1.5 px-2 rounded-lg bg-sky-500/20 text-sky-300 text-[11px] font-semibold border border-sky-500/30">
                  Plan Activo
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
