'use client';

import React, { useEffect, useState } from 'react';
import { Layers, ShieldCheck, Plus, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { apiFetch, ECF_TYPE_LABELS } from '../../../lib/api';

function formatEncfCode(tipoEcf: number, num: number) {
  return `E${tipoEcf}${String(Math.max(0, num)).padStart(10, '0')}`;
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipoEcf: 31,
    idRangoSecuencia: 1,
    consecutivoDesde: 1,
    consecutivoHasta: 50000,
    ultimoConsecutivo: 0,
    vencimiento: '2027-12-31',
    environment: 'SANDBOX' as 'SANDBOX' | 'PRODUCTION',
  });

  const loadSequences = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<any[]>('/v1/sequences');
      setSequences(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar las secuencias e-NCF autorizadas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSequences();
  }, []);

  const handleSaveSequence = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/v1/sequences', {
        method: 'POST',
        body: JSON.stringify({
          IdTipoDocumento: Number(form.tipoEcf),
          IdRangoSecuencia: Number(form.idRangoSecuencia || 1),
          ConsecutivoDesde: Number(form.consecutivoDesde),
          ConsecutivoHasta: Number(form.consecutivoHasta),
          UltimoConsecutivo: Number(form.ultimoConsecutivo || 0),
          Vencimiento: form.vencimiento || undefined,
          environment: form.environment,
        }),
      });
      setShowModal(false);
      await loadSequences();
    } catch (err: any) {
      setError(err?.message || 'Error al registrar rango e-NCF.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Secuencias e-NCF Autorizadas</h1>
          <p className="text-xs text-slate-500">
            Control real de rangos y números de comprobantes fiscales electrónicos registrados para tu RNC
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Registrar Rango e-NCF
        </button>
      </div>

      {/* Info Card */}
      <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-950 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0" />
          <span>
            Las secuencias electrónicas e-NCF se asignan directamente por la DGII. El sistema incrementa automáticamente cada número de forma atómica en PostgreSQL para evitar colisiones.
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{/failed to fetch/i.test(error) ? 'No pudimos cargar las secuencias. Reintenta en un momento.' : error}</span>
          </div>
          <button
            type="button"
            onClick={loadSequences}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-xs cursor-pointer disabled:opacity-50"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Tabla de Secuencias */}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <tr>
                <th className="py-3 px-4">Tipo de Comprobante</th>
                <th className="py-3 px-4">Entorno</th>
                <th className="py-3 px-4 font-mono">Último Emitido</th>
                <th className="py-3 px-4 font-mono">Rango Autorizado</th>
                <th className="py-3 px-4 text-right">Disponibles</th>
                <th className="py-3 px-4">Vence</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Cargando secuencias reales de la empresa...
                  </td>
                </tr>
              ) : sequences.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No hay secuencias registradas todavía. Haz clic en &quot;Registrar Rango e-NCF&quot;.
                  </td>
                </tr>
              ) : (
                sequences.map((s) => {
                  const vencimientoStr = s.fechaVencimiento
                    ? new Date(s.fechaVencimiento).toLocaleDateString('es-DO')
                    : 'Sin vencimiento';
                  const disponibles = Number(s.remaining ?? Math.max(0, s.consecutivoHasta - s.ultimoConsecutivo));
                  return (
                    <tr key={`${s.id || s.tipoEcf}-${s.idRangoSecuencia}-${s.environment}`} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {ECF_TYPE_LABELS[s.tipoEcf] || s.nombreTipo || `e-CF ${s.tipoEcf}`}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                          {s.environment || 'SANDBOX'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-sky-700">
                        {formatEncfCode(s.tipoEcf, s.ultimoConsecutivo || 0)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {formatEncfCode(s.tipoEcf, s.consecutivoDesde)} ➔ {formatEncfCode(s.tipoEcf, s.consecutivoHasta)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {disponibles.toLocaleString('es-DO')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{vencimientoStr}</td>
                      <td className="py-3.5 px-4 text-center">
                        {s.isActive !== false ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> ACTIVO
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                            INACTIVO
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registrar Rango */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-600" /> Registrar Rango e-NCF DGII
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSequence} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo e-CF</label>
                  <select
                    value={form.tipoEcf}
                    onChange={(e) => setForm({ ...form, tipoEcf: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  >
                    {Object.entries(ECF_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={Number(k)}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Entorno</label>
                  <select
                    value={form.environment}
                    onChange={(e) => setForm({ ...form, environment: e.target.value as 'SANDBOX' | 'PRODUCTION' })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  >
                    <option value="SANDBOX">SANDBOX (TesteCF)</option>
                    <option value="PRODUCTION">PRODUCTION (Prod eCF)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Desde</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.consecutivoDesde}
                    onChange={(e) => setForm({ ...form, consecutivoDesde: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hasta</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.consecutivoHasta}
                    onChange={(e) => setForm({ ...form, consecutivoHasta: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Último usado</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.ultimoConsecutivo}
                    onChange={(e) => setForm({ ...form, ultimoConsecutivo: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ID Rango Secuencia</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.idRangoSecuencia}
                    onChange={(e) => setForm({ ...form, idRangoSecuencia: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fecha Vencimiento</label>
                  <input
                    type="date"
                    value={form.vencimiento}
                    onChange={(e) => setForm({ ...form, vencimiento: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar Rango
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
