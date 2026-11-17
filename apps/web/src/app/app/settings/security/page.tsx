'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Smartphone,
  Laptop,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../../../../lib/api';

export default function SecuritySettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokeSuccess, setRevokeSuccess] = useState('');

  const loadSessions = async () => {
    try {
      setSessionsLoading(true);
      const res = await apiFetch<any[]>('/v1/auth/sessions');
      if (Array.isArray(res)) setSessions(res);
    } catch {
      // Fallback
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword !== confirmPassword) {
      setPassError('Las nuevas contraseñas no coinciden.');
      return;
    }

    if (newPassword.length < 8) {
      setPassError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    try {
      setPassLoading(true);
      const res = await apiFetch<any>('/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res?.success) {
        setPassSuccess('Contraseña actualizada con éxito y demás sesiones revocadas.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        loadSessions();
      }
    } catch (err: any) {
      setPassError(err?.message || 'Error al actualizar contraseña.');
    } finally {
      setPassLoading(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!confirm('¿Desea cerrar la sesión en todos los demás dispositivos?')) return;
    try {
      await apiFetch<any>('/v1/auth/logout-all', { method: 'POST' });
      setRevokeSuccess('Todas las demás sesiones activas han sido cerradas.');
      loadSessions();
      setTimeout(() => setRevokeSuccess(''), 3000);
    } catch (err: any) {
      alert(err?.message || 'Error cerrando sesiones.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Encabezado */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Seguridad de Cuenta & Sesiones
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Administración de contraseñas, autenticación de dos factores (2FA) y control de sesiones activas.
        </p>
      </div>

      {/* Tarjeta 1: Cambio de Contraseña */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Actualizar Contraseña</h3>
            <p className="text-xs text-slate-400">
              Elija una contraseña fuerte con al menos 8 caracteres
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md pt-2">
          {passError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {passError}
            </div>
          )}
          {passSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {passSuccess}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Contraseña Actual
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nueva Contraseña
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Confirmar Nueva Contraseña
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <button
            type="submit"
            disabled={passLoading}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {passLoading ? 'Actualizando...' : 'Cambiar Contraseña'}
          </button>
        </form>
      </div>

      {/* Tarjeta 2: Autenticación de Dos Factores (2FA) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Autenticación de Dos Factores (2FA)</h3>
              <p className="text-xs text-slate-400">
                Protección adicional con código de Google Authenticator al iniciar sesión
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            Disponible
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Al habilitar el 2FA, se requerirá un código de 6 dígitos emitido por una aplicación TOTP
          (Google Authenticator, Authy o Microsoft Authenticator) para acceder a comprobantes fiscales y firma.
        </p>
      </div>

      {/* Tarjeta 3: Control de Sesiones Activas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Sesiones Activas</h3>
              <p className="text-xs text-slate-400">
                Dispositivos conectados con tokens de actualización válidos
              </p>
            </div>
          </div>

          <button
            onClick={handleLogoutAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar Otras Sesiones
          </button>
        </div>

        {revokeSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {revokeSuccess}
          </div>
        )}

        <div className="divide-y divide-slate-100">
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Navegador Actual (Sesión Activa)
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  IP: 127.0.0.1 &bull; Auto-logout: 20 min inactividad
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
              En Línea
            </span>
          </div>

          {sessions.map((s) => (
            <div key={s.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  {s.userAgent || 'Navegador Web'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  IP: {s.ipAddress || 'Desconocida'} &bull; Creada: {new Date(s.createdAt).toLocaleDateString('es-DO')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
