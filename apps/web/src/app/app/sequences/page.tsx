'use client';

import React, { useState } from 'react';
import { Layers, ShieldCheck, Plus, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SequencesPage() {
  const [sequences, setSequences] = useState([
    {
      tipoEcf: 31,
      nombre: 'e-CF 31 - Factura de Crédito Fiscal',
      desde: 'E310000000001',
      hasta: 'E310000050000',
      actual: 'E310000000014',
      disponibles: 49986,
      vencimiento: '31-12-2027',
      estado: 'ACTIVO',
    },
    {
      tipoEcf: 32,
      nombre: 'e-CF 32 - Factura de Consumo',
      desde: 'E320000000001',
      hasta: 'E320000100000',
      actual: 'E320000000001',
      disponibles: 99999,
      vencimiento: '31-12-2027',
      estado: 'ACTIVO',
    },
    {
      tipoEcf: 34,
      nombre: 'e-CF 34 - Nota de Crédito',
      desde: 'E340000000001',
      hasta: 'E340000010000',
      actual: 'E340000000001',
      disponibles: 9999,
      vencimiento: '31-12-2027',
      estado: 'ACTIVO',
    },
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">Secuencias e-NCF Autorizadas</h1>
        <p className="text-xs text-slate-500">
          Control de rangos y números de comprobantes fiscales electrónicos autorizados por la DGII
        </p>
      </div>

      {/* Info Card */}
      <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-950 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0" />
          <span>
            Las secuencias electrónicas e-NCF se asignan directamente por la DGII. El sistema incrementa automáticamente cada número con un mutex atómico anti-colisiones.
          </span>
        </div>
      </div>

      {/* Tabla de Secuencias */}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <tr>
                <th className="py-3 px-4">Tipo de Comprobante</th>
                <th className="py-3 px-4 font-mono">Último Emitido</th>
                <th className="py-3 px-4 font-mono">Rango Autorizado</th>
                <th className="py-3 px-4 text-right">Disponibles</th>
                <th className="py-3 px-4">Vence</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sequences.map((s) => (
                <tr key={s.tipoEcf} className="hover:bg-slate-50 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{s.nombre}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-sky-700">{s.actual}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-500">
                    {s.desde} ➔ {s.hasta}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    {s.disponibles.toLocaleString('es-DO')}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-mono">{s.vencimiento}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      {s.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
