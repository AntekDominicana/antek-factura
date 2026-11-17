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

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cargar usuario desde localStorage o cookie
    const stored = localStorage.getItem('antek_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {}
    }

    // Consultar estado de suscripción y perfil al día
    fetch('http://localhost:4000/v1/billing/subscription')
      .then((res) => (res.ok ? res.json() : null))
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <User className="w-6 h-6 text-sky-600" />
            Mi Perfil de Usuario
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Credenciales activas en Supabase, roles en la empresa y gestión del plan de suscripción.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition self-start sm:self-auto"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tarjeta de Datos Personales & Rol */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-sky-500/20">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm truncate">
                {user?.fullName || 'Usuario ANTEK'}
              </h3>
              <p className="text-xs text-slate-500 truncate">{user?.email || 'usuario@antek.com.do'}</p>
              <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase tracking-wider">
                <Shield className="w-3 h-3" />
                Rol: {user?.role || 'ADMIN'}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />
                Empresa:
              </span>
              <span className="font-semibold text-slate-800">{user?.tenantName || 'ANTEK DOMINICANA SRL'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-slate-400" />
                RNC Fiscal:
              </span>
              <span className="font-mono font-semibold text-sky-700">{user?.rnc || '131880738'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Base de Datos:
              </span>
              <span className="text-emerald-700 font-semibold">Supabase PostgreSQL</span>
            </div>
          </div>
        </div>

        {/* Tarjeta de Plan Actual y Cambio de Plan */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-sky-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Suscripción Activa en Plataforma
              </span>
              <h2 className="text-2xl font-black text-white mt-0.5">{planName}</h2>
              <p className="text-xs text-slate-300">
                Facturación electrónica autorizada ante la DGII (Ley 32-23) con contingencia y almacenamiento firmado.
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
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Consumo mensual de comprobantes e-CF:</span>
              <span className="font-mono font-bold text-sky-400">
                {invoicesUsed} / {planLimit} e-CF ({percentUsed}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-sky-400 to-blue-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              5 días de gracia automáticos al vencer el período antes de suspender la emisión.
            </p>
          </div>

          {/* Selector Rápido de Planes */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-400" />
              Planes Disponibles para Mejorar o Cambiar:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between gap-3">
                <div>
                  <h5 className="font-bold text-white text-xs">Plan Básico</h5>
                  <p className="text-[11px] text-slate-400">100 e-CF/mes · 2 Usuarios</p>
                  <p className="font-mono text-sm font-bold text-slate-200 mt-1">RD$990 / mes</p>
                </div>
                <Link
                  href="/app/settings/billing"
                  className="w-full text-center py-2 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 text-xs font-semibold border border-slate-800 transition"
                >
                  Cambiar a Básico
                </Link>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between gap-3">
                <div>
                  <h5 className="font-bold text-white text-xs">Plan Medio</h5>
                  <p className="text-[11px] text-slate-400">600 e-CF/mes · API & 5 Usuarios</p>
                  <p className="font-mono text-sm font-bold text-slate-200 mt-1">RD$2,450 / mes</p>
                </div>
                <Link
                  href="/app/settings/billing"
                  className="w-full text-center py-2 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 text-xs font-semibold border border-slate-800 transition"
                >
                  Cambiar a Medio
                </Link>
              </div>

              <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-500/50 flex flex-col justify-between gap-3 relative overflow-hidden shadow-inner">
                <div className="absolute -top-1 -right-1 px-2.5 py-0.5 rounded-bl-lg bg-sky-500 text-[9px] font-bold text-white uppercase tracking-wider">
                  Plan Activo
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs">Plan Pro</h5>
                  <p className="text-[11px] text-slate-300">3,000 e-CF/mes · 25 Usuarios</p>
                  <p className="font-mono text-sm font-bold text-sky-400 mt-1">RD$4,900 / mes</p>
                </div>
                <div className="w-full text-center py-2 px-2 rounded-lg bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-500/30">
                  Plan Contratado ✓
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
