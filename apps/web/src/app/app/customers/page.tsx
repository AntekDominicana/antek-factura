'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/api';
import {
  Users,
  Search,
  Building2,
  CheckCircle2,
  Plus,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Trash2,
} from 'lucide-react';

export default function CustomersPage() {
  const [rncInput, setRncInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  // Inicializar vacío sin datos demo ficticios
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('antek_customers');
      if (saved) {
        setCustomers(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const saveCustomers = (newList: any[]) => {
    setCustomers(newList);
    try {
      localStorage.setItem('antek_customers', JSON.stringify(newList));
    } catch {}
  };

  const handleVerifyRnc = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = rncInput.trim().replace(/\D/g, '');
    if (![9, 11].includes(clean.length)) {
      alert('El RNC o Cédula debe contener 9 u 11 dígitos.');
      return;
    }

    setVerifying(true);
    try {
      const res = await apiFetch<any>(`/v1/dgii/verify-rnc/${clean}`);
      setVerifyResult(res);
      if (res.nombreRazonSocial && !customers.some((c) => c.rnc === clean)) {
        const updated = [
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
      }
    } catch {
      alert('No se pudo verificar el RNC con el servicio DGII');
    } finally {
      setVerifying(false);
    }
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
            Valida RNCs y Cédulas oficiales en la base de datos de la DGII en tiempo real
          </p>
        </div>
      </div>

      {/* Verificador RNC en Vivo */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
          <ShieldCheck className="w-4 h-4 text-sky-600" />
          <span>Consultar & Registrar RNC o Cédula</span>
        </div>

        <form onSubmit={handleVerifyRnc} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={rncInput}
              onChange={(e) => setRncInput(e.target.value)}
              placeholder="Ingresa 9 u 11 dígitos (ej. 101010632, 101001577, 101532483...)"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:outline-hidden focus:border-sky-500"
            />
          </div>
          <button
            type="submit"
            disabled={verifying}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 inline-flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {verifying ? (
              <span>Consultando DGII...</span>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Validar & Agregar Cliente</span>
              </>
            )}
          </button>
        </form>

        {verifyResult && (
          <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 text-xs text-sky-950 space-y-1 animate-in fade-in">
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

      {/* Tabla de Clientes */}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">Clientes Registrados ({customers.length})</span>
          <span className="text-[11px] text-slate-500">Validados contra el padrón DGII</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <tr>
                <th className="py-3 px-4">RNC / Cédula</th>
                <th className="py-3 px-4">Razón Social Oficial</th>
                <th className="py-3 px-4">Nombre Comercial</th>
                <th className="py-3 px-4 text-center">Estado DGII</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 space-y-2">
                    <Users className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-600">No hay clientes registrados aún</p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Consulta cualquier RNC o Cédula en el buscador superior para validarlo y agregarlo automáticamente a tu directorio.
                    </p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.rnc} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{c.rnc}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{c.razonSocial}</td>
                    <td className="py-3 px-4 text-slate-500">{c.nombreComercial || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {c.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomer(c.rnc)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
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
    </div>
  );
}
