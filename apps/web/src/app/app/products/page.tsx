'use client';

import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Tag, Trash2, CheckCircle2 } from 'lucide-react';
import { formatDOP } from '../../../lib/api';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newProd, setNewProd] = useState({
    codigo: '',
    nombre: '',
    precio: '',
    indicador: '18% ITBIS (Gravado)',
    categoria: 'General',
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('antek_products');
      if (saved) {
        setProducts(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const saveProducts = (newList: any[]) => {
    setProducts(newList);
    try {
      localStorage.setItem('antek_products', JSON.stringify(newList));
    } catch {}
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.nombre || !newProd.precio) return;

    const item = {
      id: Date.now().toString(),
      codigo: newProd.codigo || `ITEM-${products.length + 1}`,
      nombre: newProd.nombre,
      precio: parseFloat(newProd.precio) || 0,
      indicador: newProd.indicador,
      categoria: newProd.categoria,
    };

    const updated = [item, ...products];
    saveProducts(updated);
    setNewProd({
      codigo: '',
      nombre: '',
      precio: '',
      indicador: '18% ITBIS (Gravado)',
      categoria: 'General',
    });
    setModalOpen(false);
  };

  const handleDeleteProduct = (id: string) => {
    const updated = products.filter((p) => p.id !== id);
    saveProducts(updated);
  };

  const filtered = products.filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Catálogo de Productos & Servicios</h1>
          <p className="text-xs text-slate-500">
            Administra tus ítems con tasa de ITBIS asignada para facturación rápida
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 inline-flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Producto / Servicio</span>
        </button>
      </div>

      {/* Buscador */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o código de producto..."
          className="bg-transparent text-xs w-full focus:outline-hidden"
        />
      </div>

      {/* Tabla de Productos */}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">Productos Registrados ({products.length})</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <tr>
                <th className="py-3 px-4">Código / SKU</th>
                <th className="py-3 px-4">Nombre / Descripción</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Tasa de ITBIS</th>
                <th className="py-3 px-4 text-right">Precio Unitario</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 space-y-2">
                    <Package className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-600">No hay productos en el catálogo</p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Haz clic en &quot;Nuevo Producto / Servicio&quot; para registrar tus artículos reales y agilizar la emisión de tus e-CF.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.codigo}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{p.nombre}</td>
                    <td className="py-3 px-4 text-slate-500">{p.categoria}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                        {p.indicador}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      {formatDOP(p.precio)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Eliminar"
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

      {/* Modal de Creación */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <h2 className="text-lg font-black text-slate-900">Agregar Producto o Servicio</h2>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Ítem</label>
                <input
                  type="text"
                  required
                  value={newProd.nombre}
                  onChange={(e) => setNewProd({ ...newProd, nombre: e.target.value })}
                  placeholder="ej. Mantenimiento Preventivo / Licencia"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Código / SKU</label>
                  <input
                    type="text"
                    value={newProd.codigo}
                    onChange={(e) => setNewProd({ ...newProd, codigo: e.target.value })}
                    placeholder="ej. SERV-01"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:border-sky-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Precio Unitario (DOP)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProd.precio}
                    onChange={(e) => setNewProd({ ...newProd, precio: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:border-sky-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tratamiento de ITBIS</label>
                <select
                  value={newProd.indicador}
                  onChange={(e) => setNewProd({ ...newProd, indicador: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:border-sky-500"
                >
                  <option value="18% ITBIS (Gravado)">18% ITBIS (Tasa Estándar)</option>
                  <option value="16% ITBIS (Gravado)">16% ITBIS (Tasa Reducida)</option>
                  <option value="Exento de ITBIS">Exento de ITBIS (Educación, Salud, etc.)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-xs"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
