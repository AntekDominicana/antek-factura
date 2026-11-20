'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Layers,
  ShieldCheck,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiFetch, ECF_TYPE_LABELS } from '../../../lib/api';
import { useApp } from '../../../context/AppContext';

function formatEncfCode(tipoEcf: number, num: number) {
  return `E${tipoEcf}${String(Math.max(0, num)).padStart(10, '0')}`;
}

export default function SequencesPage() {
  const { tenant } = useApp();
  const defaultEnv: 'SANDBOX' | 'PRODUCTION' =
    tenant?.environment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';

  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipoEcf: 45,
    idRangoSecuencia: '',
    consecutivoDesde: 1,
    consecutivoHasta: 100,
    ultimoConsecutivo: '',
    vencimiento: '2027-12-31',
    environment: defaultEnv,
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      environment: tenant?.environment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
    }));
  }, [tenant?.environment]);

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

  const openModalWithTipo = (tipoEcf?: number) => {
    setForm({
      tipoEcf: tipoEcf ?? 31,
      idRangoSecuencia: '',
      consecutivoDesde: 1,
      consecutivoHasta: 100,
      ultimoConsecutivo: '',
      vencimiento: '2027-12-31',
      environment: tenant?.environment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
    });
    setShowAdvanced(false);
    setShowModal(true);
  };

  const applyPreset = (desde: number, hasta: number) => {
    setForm((prev) => ({
      ...prev,
      consecutivoDesde: desde,
      consecutivoHasta: hasta,
      ultimoConsecutivo: '',
    }));
  };

  const handleSaveSequence = async (e: React.FormEvent) => {
    e.preventDefault();
    const desde = Number(form.consecutivoDesde);
    const hasta = Number(form.consecutivoHasta);
    if (!Number.isFinite(desde) || desde < 1 || !Number.isFinite(hasta) || hasta < desde) {
      setError('El número "Hasta" debe ser mayor o igual que "Desde" (mínimo 1).');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const hasCustomLast = form.ultimoConsecutivo.trim() !== '';
      const hasCustomRangeId = form.idRangoSecuencia.trim() !== '';

      await apiFetch('/v1/sequences', {
        method: 'POST',
        body: JSON.stringify({
          IdTipoDocumento: Number(form.tipoEcf),
          ...(hasCustomRangeId ? { IdRangoSecuencia: Number(form.idRangoSecuencia) } : { autoNextRange: true }),
          ConsecutivoDesde: desde,
          ConsecutivoHasta: hasta,
          ...(hasCustomLast ? { UltimoConsecutivo: Number(form.ultimoConsecutivo) } : {}),
          Vencimiento: form.vencimiento || undefined,
          environment: form.environment,
        }),
      });
      setShowModal(false);
      setSuccessMsg(
        `Rango ${formatEncfCode(form.tipoEcf, desde)} → ${formatEncfCode(form.tipoEcf, hasta)} activado. Ya puedes emitir comprobantes.`,
      );
      await loadSequences();
    } catch (err: any) {
      setError(err?.message || 'Error al registrar rango e-NCF.');
    } finally {
      setSaving(false);
    }
  };

  const previewDesde = Math.max(1, Number(form.consecutivoDesde || 1));
  const previewHasta = Math.max(previewDesde, Number(form.consecutivoHasta || previewDesde));
  const previewCantidad = previewHasta - previewDesde + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Secuencias e-NCF Autorizadas</h1>
          <p className="text-xs text-slate-500">
            Ingresa solo el número inicial y final aprobado por DGII (ej. del 1 al 100) y comienza a emitir de inmediato.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openModalWithTipo(45)}
          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Registrar Rango e-NCF
        </button>
      </div>

      {/* Info Card */}
      <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0" />
          <span>
            Cuando solicites nuevos comprobantes en DGII (ej. del <strong>1 al 100</strong>), solo indica el rango numérico y el tipo (ej. 31, 32, 45 Gubernamental). El sistema asigna cada e-NCF de forma automática y atómica.
          </span>
        </div>
        <button
          type="button"
          onClick={() => openModalWithTipo(45)}
          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] shrink-0 transition cursor-pointer"
        >
          + Activar e-CF 45 (1–100)
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <Link
            href={`/app/invoices/new?tipo=${form.tipoEcf}`}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1 shrink-0"
          >
            Emitir Ahora <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

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
                <th className="py-3 px-4 font-mono">Próximo a Emitir</th>
                <th className="py-3 px-4 font-mono">Rango Autorizado</th>
                <th className="py-3 px-4 text-right">Disponibles</th>
                <th className="py-3 px-4">Vence</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Cargando secuencias reales de la empresa...
                  </td>
                </tr>
              ) : sequences.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No hay secuencias registradas todavía. Haz clic en &quot;Registrar Rango e-NCF&quot;.
                  </td>
                </tr>
              ) : (
                sequences.map((s) => {
                  const vencimientoStr = s.fechaVencimiento
                    ? new Date(s.fechaVencimiento).toLocaleDateString('es-DO')
                    : 'Sin vencimiento';
                  const desde = Number(s.consecutivoDesde || 1);
                  const hasta = Number(s.consecutivoHasta || 0);
                  const ultimo = Number(s.ultimoConsecutivo || 0);
                  const effectivePos = Math.max(ultimo, desde - 1);
                  const disponibles = Number(s.remaining ?? Math.max(0, hasta - effectivePos));
                  const proximoNumero = effectivePos + 1;
                  const exhausted = disponibles <= 0;

                  return (
                    <tr
                      key={`${s.id || s.tipoEcf}-${s.idRangoSecuencia}-${s.environment}`}
                      className="hover:bg-slate-50 transition"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {ECF_TYPE_LABELS[s.tipoEcf] || s.nombreTipo || `e-CF ${s.tipoEcf}`}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                          {s.environment || 'SANDBOX'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-sky-700">
                        {exhausted ? (
                          <span className="text-slate-400">Rango agotado</span>
                        ) : (
                          s.nextEncf || formatEncfCode(s.tipoEcf, proximoNumero)
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {formatEncfCode(s.tipoEcf, desde)} ➔ {formatEncfCode(s.tipoEcf, hasta)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {disponibles.toLocaleString('es-DO')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{vencimientoStr}</td>
                      <td className="py-3.5 px-4 text-center">
                        {s.isActive !== false && !exhausted ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> ACTIVO
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                            {exhausted ? 'AGOTADO' : 'INACTIVO'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!exhausted && s.isActive !== false ? (
                          <Link
                            href={`/app/invoices/new?tipo=${s.tipoEcf}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-[11px] border border-sky-200 transition"
                          >
                            Emitir <ArrowRight className="w-3 h-3" />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openModalWithTipo(s.tipoEcf)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition cursor-pointer"
                          >
                            + Nuevo rango
                          </button>
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

      {/* Modal Registrar Rango Simplificado */}
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
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSequence} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo de Documento e-CF</label>
                  <select
                    value={form.tipoEcf}
                    onChange={(e) => setForm({ ...form, tipoEcf: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
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
                    onChange={(e) =>
                      setForm({ ...form, environment: e.target.value as 'SANDBOX' | 'PRODUCTION' })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="SANDBOX">SANDBOX (TesteCF)</option>
                    <option value="PRODUCTION">PRODUCTION (Prod eCF)</option>
                  </select>
                </div>
              </div>

              {/* Atajos rápidos de rangos */}
              <div>
                <div className="text-[11px] font-bold text-slate-500 mb-1.5">
                  Atajos rápidos (solo números):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '1 al 100', d: 1, h: 100 },
                    { label: '1 al 500', d: 1, h: 500 },
                    { label: '1 al 1,000', d: 1, h: 1000 },
                    { label: '101 al 200', d: 101, h: 200 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPreset(p.d, p.h)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                        form.consecutivoDesde === p.d && form.consecutivoHasta === p.h
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Desde (número)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.consecutivoDesde}
                    onChange={(e) => setForm({ ...form, consecutivoDesde: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hasta (número)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.consecutivoHasta}
                    onChange={(e) => setForm({ ...form, consecutivoHasta: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Previsualización en vivo de los e-NCF generados */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Vista previa del rango DGII ({previewCantidad.toLocaleString('es-DO')} comprobantes)
                </div>
                <div className="font-mono font-bold text-slate-900 text-xs">
                  {formatEncfCode(form.tipoEcf, previewDesde)} ➔ {formatEncfCode(form.tipoEcf, previewHasta)}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Fecha Vencimiento (DGII)</label>
                <input
                  type="date"
                  value={form.vencimiento}
                  onChange={(e) => setForm({ ...form, vencimiento: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              {/* Opciones avanzadas colapsables */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Opciones avanzadas (si ya emitiste parte de este rango antes)
                </button>
                {showAdvanced && (
                  <div className="grid grid-cols-2 gap-3 mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Último emitido (opcional)
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder={`Ej. ${previewDesde - 1}`}
                        value={form.ultimoConsecutivo}
                        onChange={(e) => setForm({ ...form, ultimoConsecutivo: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">ID Rango (auto)</label>
                      <input
                        type="number"
                        min={1}
                        placeholder="Automático"
                        value={form.idRangoSecuencia}
                        onChange={(e) => setForm({ ...form, idRangoSecuencia: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Activar Rango y Listo para Emitir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
