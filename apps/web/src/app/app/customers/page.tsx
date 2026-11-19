'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../../lib/api';
import { useApp } from '../../../context/AppContext';
import {
  Users,
  Search,
  Building2,
  CheckCircle2,
  Plus,
  ShieldCheck,
  AlertCircle,
  Edit3,
  Trash2,
  X,
  Phone,
  Mail,
} from 'lucide-react';

interface CustomerRecord {
  rnc: string;
  razonSocial: string;
  nombreComercial?: string;
  telefono?: string;
  correo?: string;
  estado: string;
  regimen?: string;
  facturasEmitidas?: number;
}

export default function CustomersPage() {
  const { tenant } = useApp();
  const storageKey = tenant?.id ? `antek_customers_${tenant.id}` : 'antek_customers_anon';
  const [rncInput, setRncInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);

  // Modal manual para agregar o editar cliente
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOriginalRnc, setEditingOriginalRnc] = useState<string | null>(null);
  const [formState, setFormState] = useState<CustomerRecord>({
    rnc: '',
    razonSocial: '',
    nombreComercial: '',
    telefono: '',
    correo: '',
    estado: 'ACTIVO',
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setCustomers(JSON.parse(saved));
      } else {
        setCustomers([]);
      }
    } catch {
      setCustomers([]);
    }
  }, [storageKey]);

  const saveCustomers = (newList: CustomerRecord[]) => {
    setCustomers(newList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newList));
    } catch {}
  };

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        String(c.rnc || '').toLowerCase().includes(q) ||
        String(c.razonSocial || '').toLowerCase().includes(q) ||
        String(c.nombreComercial || '').toLowerCase().includes(q) ||
        String(c.correo || '').toLowerCase().includes(q) ||
        String(c.telefono || '').toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const handleVerifyRnc = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const clean = rncInput.trim().replace(/\D/g, '');
    if (![9, 11].includes(clean.length)) {
      setErrorMsg('El RNC debe tener 9 dígitos o la Cédula 11 dígitos numéricos.');
      return;
    }

    setVerifying(true);
    try {
      let res: any = null;
      try {
        res = await apiFetch<any>(`/v1/dgii/verify-rnc/${clean}`);
      } catch {
        const lookup = await apiFetch<any>(`/v1/rnc/lookup?rnc=${clean}`);
        if (lookup) {
          res = {
            rnc: clean,
            nombreRazonSocial: lookup.razonSocial,
            nombreComercial: lookup.nombreComercial || lookup.razonSocial,
            estado: lookup.estado || 'ACTIVO',
            regimenPagos: lookup.regimen || 'NORMAL',
            actividadEconomica: lookup.actividadEconomica || 'Comercial',
          };
        }
      }

      if (!res?.nombreRazonSocial) {
        throw new Error('No se encontró ese RNC o Cédula.');
      }

      setVerifyResult(res);
      if (!customers.some((c) => c.rnc === clean)) {
        const updated: CustomerRecord[] = [
          {
            rnc: clean,
            razonSocial: res.nombreRazonSocial,
            nombreComercial: res.nombreComercial || res.nombreRazonSocial,
            estado: res.estado || 'ACTIVO',
            regimen: res.regimenPagos || 'GENERAL',
            facturasEmitidas: 0,
          },
          ...customers,
        ];
        saveCustomers(updated);
        setSuccessMsg(`Cliente "${res.nombreRazonSocial}" agregado a tu directorio.`);
      } else {
        setSuccessMsg(`Cliente "${res.nombreRazonSocial}" verificado.`);
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          'No se pudo consultar en línea en este momento. Puedes agregarlo manualmente con "+ Agregar Cliente".'
      );
    } finally {
      setVerifying(false);
    }
  };

  const openAddModal = () => {
    setEditingOriginalRnc(null);
    setFormState({
      rnc: rncInput.replace(/\D/g, ''),
      razonSocial: '',
      nombreComercial: '',
      telefono: '',
      correo: '',
      estado: 'ACTIVO',
    });
    setModalOpen(true);
  };

  const openEditModal = (c: CustomerRecord) => {
    setEditingOriginalRnc(c.rnc);
    setFormState({
      rnc: c.rnc,
      razonSocial: c.razonSocial || '',
      nombreComercial: c.nombreComercial || '',
      telefono: c.telefono || '',
      correo: c.correo || '',
      estado: c.estado || 'ACTIVO',
    });
    setModalOpen(true);
  };

  const handleSaveManualCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanRnc = formState.rnc.replace(/\D/g, '');
    if (![9, 11].includes(cleanRnc.length)) {
      setErrorMsg('El RNC o Cédula debe tener exactamente 9 u 11 dígitos.');
      return;
    }
    if (!formState.razonSocial.trim()) {
      setErrorMsg('La Razón Social o Nombre del cliente es obligatoria.');
      return;
    }

    const record: CustomerRecord = {
      ...formState,
      rnc: cleanRnc,
      razonSocial: formState.razonSocial.trim(),
      nombreComercial: formState.nombreComercial?.trim() || formState.razonSocial.trim(),
      telefono: formState.telefono?.trim() || '',
      correo: formState.correo?.trim() || '',
    };

    let updated: CustomerRecord[];
    if (editingOriginalRnc) {
      updated = customers.map((c) => (c.rnc === editingOriginalRnc ? { ...c, ...record } : c));
      setSuccessMsg(`Datos de "${record.razonSocial}" actualizados.`);
    } else if (customers.some((c) => c.rnc === cleanRnc)) {
      updated = customers.map((c) => (c.rnc === cleanRnc ? { ...c, ...record } : c));
      setSuccessMsg(`Cliente "${record.razonSocial}" actualizado.`);
    } else {
      updated = [record, ...customers];
      setSuccessMsg(`Cliente "${record.razonSocial}" agregado al directorio.`);
    }

    saveCustomers(updated);
    setModalOpen(false);
  };

  const handleDeleteCustomer = (rnc: string) => {
    const updated = customers.filter((c) => c.rnc !== rnc);
    saveCustomers(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Directorio de Clientes</h1>
          <p className="text-xs text-slate-500">
            Busca tus clientes guardados o valida nuevos RNCs y Cédulas en la DGII
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar Cliente Manual</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Verificador RNC en Vivo */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
          <ShieldCheck className="w-4 h-4 text-sky-600" />
          <span>Consultar &amp; Registrar RNC o Cédula en DGII</span>
        </div>

        <form onSubmit={handleVerifyRnc} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={rncInput}
              onChange={(e) => setRncInput(e.target.value)}
              placeholder="Ingresa RNC (9 dígitos) o Cédula (11 dígitos)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:outline-hidden focus:border-sky-500"
            />
          </div>
          <button
            type="submit"
            disabled={verifying}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 inline-flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {verifying ? (
              <span>Consultando DGII...</span>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Validar &amp; Agregar Cliente</span>
              </>
            )}
          </button>
        </form>

        {verifyResult && (
          <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 text-xs text-sky-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-sky-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{verifyResult.nombreRazonSocial}</span>
            </div>
            <div className="text-[11px] text-sky-800">
              RNC: <strong className="font-mono">{verifyResult.rnc}</strong> · Estado:{' '}
              <span className="font-semibold">{verifyResult.estado}</span> · Régimen:{' '}
              <span>{verifyResult.regimenPagos || 'Normal'}</span> · Actividad:{' '}
              <span>{verifyResult.actividadEconomica || 'Comercial'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabla de Clientes con Buscador Local en Vivo */}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-800">
              Clientes Registrados ({filteredCustomers.length})
            </span>
            <span className="text-[11px] text-slate-500 block sm:inline sm:ml-2">
              Busca por nombre, RNC, correo o teléfono
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente por nombre, RNC..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:outline-hidden focus:border-sky-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <tr>
                <th className="py-3 px-4">RNC / Cédula</th>
                <th className="py-3 px-4">Razón Social / Nombre</th>
                <th className="py-3 px-4">Contacto</th>
                <th className="py-3 px-4 text-center">Estado DGII</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 space-y-2">
                    <Users className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-600">
                      {customers.length === 0
                        ? 'No hay clientes registrados aún'
                        : 'Ningún cliente coincide con tu búsqueda'}
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      {customers.length === 0
                        ? 'Consulta un RNC o Cédula arriba o usa "Agregar Cliente Manual".'
                        : 'Prueba con otro RNC, nombre o limpia el buscador.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.rnc} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{c.rnc}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{c.razonSocial}</div>
                      {c.nombreComercial && c.nombreComercial !== c.razonSocial && (
                        <div className="text-[11px] text-slate-400">{c.nombreComercial}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500 space-y-0.5">
                      {c.correo && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{c.correo}</span>
                        </div>
                      )}
                      {c.telefono && (
                        <div className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{c.telefono}</span>
                        </div>
                      )}
                      {!c.correo && !c.telefono && <span>—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {c.estado || 'ACTIVO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(c)}
                        className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                        title="Editar datos del cliente"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomer(c.rnc)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Eliminar de lista"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Agregar / Editar Cliente */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveManualCustomer}
            className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">
                {editingOriginalRnc ? 'Editar Cliente' : 'Agregar Cliente al Directorio'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">RNC o Cédula *</label>
                <input
                  type="text"
                  required
                  value={formState.rnc}
                  onChange={(e) => setFormState({ ...formState, rnc: e.target.value })}
                  placeholder="9 u 11 dígitos"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Estado</label>
                <select
                  value={formState.estado}
                  onChange={(e) => setFormState({ ...formState, estado: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="ACTIVO">ACTIVO</option>
                  <option value="INACTIVO">INACTIVO</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Razón Social o Nombre *</label>
              <input
                type="text"
                required
                value={formState.razonSocial}
                onChange={(e) => setFormState({ ...formState, razonSocial: e.target.value })}
                placeholder="Ej. Comercial Dominicana SRL"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Nombre Comercial</label>
              <input
                type="text"
                value={formState.nombreComercial || ''}
                onChange={(e) => setFormState({ ...formState, nombreComercial: e.target.value })}
                placeholder="Opcional"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
                <input
                  type="text"
                  value={formState.telefono || ''}
                  onChange={(e) => setFormState({ ...formState, telefono: e.target.value })}
                  placeholder="809-000-0000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={formState.correo || ''}
                  onChange={(e) => setFormState({ ...formState, correo: e.target.value })}
                  placeholder="cliente@empresa.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer"
              >
                Guardar Cliente
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
