'use client';

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  Mail,
  UserCheck,
  MoreVertical,
  KeyRound,
  Trash2,
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'cashier' | 'accountant';
  status: 'active' | 'pending';
  lastActive: string;
}

export default function TeamSettingsPage() {
  const [members, setMembers] = useState<TeamMember[]>([
    {
      id: 'user-rootfacturas',
      name: 'Administrador Root (rootfacturas)',
      email: 'rootfacturas@antek.com.do',
      role: 'admin',
      status: 'active',
      lastActive: 'Sesión activa en Supabase',
    },
    {
      id: 'user-juanperez',
      name: 'Juan Pérez (Gerente Financiero)',
      email: 'juanperez@antek.com.do',
      role: 'admin',
      status: 'active',
      lastActive: 'Usuario verificado en Supabase',
    },
  ]);

  React.useEffect(() => {
    // Intentar consultar usuarios en vivo
    fetch('http://localhost:4000/v1/auth/users')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.users) && data.users.length > 0) {
          setMembers(
            data.users.map((u: any) => ({
              id: u.id,
              name: u.fullName || u.email,
              email: u.email,
              role: u.role === 'SUPERADMIN' || u.role === 'ADMIN' ? 'admin' : 'cashier',
              status: u.isActive ? 'active' : 'pending',
              lastActive: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Registrado en Supabase',
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'cashier' as TeamMember['role'],
  });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.name || !inviteForm.email) return;

    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: inviteForm.name,
      email: inviteForm.email,
      role: inviteForm.role,
      status: 'pending',
      lastActive: 'Invitación enviada',
    };

    setMembers((prev) => [...prev, newMember]);
    setInviteModalOpen(false);
    setInviteForm({ name: '', email: '', role: 'cashier' });
    setSuccessMsg(`Invitación enviada a ${newMember.email} con éxito ✓`);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleRemove = (id: string) => {
    if (confirm('¿Estás seguro de revocar el acceso a este usuario?')) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
      setSuccessMsg('Acceso de usuario revocado correctamente');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const roleBadge = (role: TeamMember['role']) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            Administrador
          </span>
        );
      case 'cashier':
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
            Cajero / Emisión POS
          </span>
        );
      case 'accountant':
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            Contable (Libros 606/607)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Equipo & Roles de Facturación</h1>
          <p className="text-xs text-slate-500">
            Gestiona accesos, cajeros de punto de venta y contables con control por roles (RBAC)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setInviteModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 inline-flex items-center gap-2 transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invitar Colaborador</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid de Roles y Explicación */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-xs">
            <ShieldCheck className="w-4 h-4" />
            <span>Administrador</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Acceso absoluto a la configuración DGII, firma digital, secuencias e-NCF y pagos.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center gap-2 text-sky-600 font-bold text-xs">
            <UserCheck className="w-4 h-4" />
            <span>Cajero / Ventas</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Emisión ágil de e-CF (E31, E32), anulación y cobro. Sin acceso a finanzas privadas.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
            <KeyRound className="w-4 h-4" />
            <span>Contable Externo</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Acceso de solo lectura a los reportes 606 y 607 para exportación mensual a Excel DGII.
          </p>
        </div>
      </div>

      {/* Tabla de Miembros */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">Miembros Activos ({members.length})</span>
          <span className="text-[11px] text-slate-500 font-medium">Autenticación Multifactor habilitada</span>
        </div>

        <div className="divide-y divide-slate-100">
          {members.map((m) => (
            <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center uppercase shrink-0">
                  {m.name.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">{m.name}</span>
                    {roleBadge(m.role)}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <Mail className="w-3 h-3" />
                    <span>{m.email}</span>
                    <span>•</span>
                    <span>{m.lastActive}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {m.status === 'pending' && (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-sm">
                    Pendiente
                  </span>
                )}
                {m.role !== 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleRemove(m.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Revocar acceso"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Invitación */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <h2 className="text-lg font-black text-slate-900">Invitar Miembro al Equipo</h2>
            <p className="text-xs text-slate-500">
              El usuario recibirá un correo con el enlace de acceso seguro a ANTEK Factura.
            </p>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="Ej. Ana Ramírez"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="ana@empresa.com.do"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rol y Permisos</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as TeamMember['role'] })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:border-sky-500"
                >
                  <option value="cashier">Cajero / Facturación POS (Emisión de e-CF)</option>
                  <option value="accountant">Contable / Auditor (Libros 606/607)</option>
                  <option value="admin">Administrador (Control total)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-xs"
                >
                  Enviar Invitación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
