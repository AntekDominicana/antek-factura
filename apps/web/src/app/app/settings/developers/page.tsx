'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Key,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  Webhook,
  AlertTriangle,
  Plus,
  Trash2,
  Store,
  Activity,
  ExternalLink,
  PlugZap,
} from 'lucide-react';
import { apiFetch } from '../../../../lib/api';

interface CompanyApiKey {
  id: string;
  nombre: string;
  prefijo_visible: string;
  scopes: string[];
  revocada: boolean;
  ultimo_uso: string | null;
  creada_en: string;
}

interface DeliveryConnectionItem {
  id: string;
  plataforma: 'ubereats' | 'pedidosya';
  store_id: string;
  activo: boolean;
  emitir_en_estado: string;
  incluir_envio: boolean;
  incluir_propina: boolean;
  creada_en: string;
}

interface ExternalSaleItem {
  id: string;
  origen: string;
  external_id: string;
  ecf_id: string | null;
  encf: string | null;
  estado: string;
  error_detalle: string | null;
  creada_en: string;
}

interface OutgoingWebhookInfo {
  id: string;
  url: string;
  events: string[];
  secretPrefix: string;
  isActive: boolean;
  recentDeliveries: Array<{
    id: string;
    event: string;
    status: string;
    attempts: number;
    responseCode: number | null;
    createdAt: string;
  }>;
}

export default function DevelopersSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [apiKeys, setApiKeys] = useState<CompanyApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdKeyOnce, setCreatedKeyOnce] = useState<{
    nombre: string;
    key: string;
    prefijo_visible: string;
  } | null>(null);
  const [copiedKeyOnce, setCopiedKeyOnce] = useState(false);

  const [deliveryConnections, setDeliveryConnections] = useState<DeliveryConnectionItem[]>([]);
  const [plataforma, setPlataforma] = useState<'ubereats' | 'pedidosya'>('ubereats');
  const [storeId, setStoreId] = useState('');
  const [emitirEnEstado, setEmitirEnEstado] = useState('DELIVERED');
  const [incluirEnvio, setIncluirEnvio] = useState(true);
  const [incluirPropina, setIncluirPropina] = useState(true);
  const [savingDelivery, setSavingDelivery] = useState(false);

  const [outgoingWebhook, setOutgoingWebhook] = useState<OutgoingWebhookInfo | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [createdWebhookSecretOnce, setCreatedWebhookSecretOnce] = useState<string | null>(null);
  const [copiedWebhookSecret, setCopiedWebhookSecret] = useState(false);

  const [externalSales, setExternalSales] = useState<ExternalSaleItem[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const extractErr = (err: any, fallback: string) =>
    err?.payload?.error || err?.message || fallback;

  const loadSummary = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiFetch<any>('/v1/integrations/summary');
      setApiKeys(Array.isArray(data?.apiKeys) ? data.apiKeys : []);
      setDeliveryConnections(
        Array.isArray(data?.deliveryConnections) ? data.deliveryConnections : []
      );
      setExternalSales(Array.isArray(data?.externalSales) ? data.externalSales : []);
      setOutgoingWebhook(data?.outgoingWebhook || null);
      if (data?.outgoingWebhook?.url) {
        setWebhookUrl(data.outgoingWebhook.url);
      }
    } catch (err: any) {
      setErrorMsg(extractErr(err, 'No se pudo cargar el módulo de integraciones.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4500);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    if (id === 'once') {
      setCopiedKeyOnce(true);
      setTimeout(() => setCopiedKeyOnce(false), 2000);
    } else if (id === 'whsec') {
      setCopiedWebhookSecret(true);
      setTimeout(() => setCopiedWebhookSecret(false), 2000);
    } else {
      setCopiedUrl(id);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    setErrorMsg(null);
    try {
      const created = await apiFetch<any>('/v1/integrations/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          nombre: newKeyName.trim(),
          scopes: ['invoices:write', 'invoices:read'],
        }),
      });
      setCreatedKeyOnce({
        nombre: created.nombre,
        key: created.key,
        prefijo_visible: created.prefijo_visible,
      });
      setNewKeyName('');
      flashSuccess(`API Key "${created.nombre}" creada. Cópiala ahora; no volverá a mostrarse.`);
      await loadSummary();
    } catch (err: any) {
      setErrorMsg(extractErr(err, 'Error al generar la API Key.'));
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyItem: CompanyApiKey) => {
    if (
      !confirm(
        `¿Revocar la API Key "${keyItem.nombre}" (${keyItem.prefijo_visible}...)? El POS o sistema conectado dejará de emitir de inmediato.`
      )
    ) {
      return;
    }
    setErrorMsg(null);
    try {
      await apiFetch(`/v1/integrations/api-keys/${keyItem.id}`, { method: 'DELETE' });
      flashSuccess(`API Key "${keyItem.nombre}" revocada.`);
      await loadSummary();
    } catch (err: any) {
      setErrorMsg(extractErr(err, 'No se pudo revocar la API Key.'));
    }
  };

  const handleSaveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId.trim()) return;
    setSavingDelivery(true);
    setErrorMsg(null);
    try {
      await apiFetch('/v1/integrations/delivery', {
        method: 'POST',
        body: JSON.stringify({
          plataforma,
          store_id: storeId.trim(),
          activo: true,
          emitir_en_estado: emitirEnEstado,
          incluir_envio: incluirEnvio,
          incluir_propina: incluirPropina,
        }),
      });
      setStoreId('');
      flashSuccess(`Conexión ${plataforma === 'ubereats' ? 'Uber Eats' : 'PedidosYa'} guardada.`);
      await loadSummary();
    } catch (err: any) {
      setErrorMsg(extractErr(err, 'No se pudo guardar la conexión de delivery.'));
    } finally {
      setSavingDelivery(false);
    }
  };

  const handleToggleDelivery = async (conn: DeliveryConnectionItem) => {
    setErrorMsg(null);
    try {
      await apiFetch('/v1/integrations/delivery', {
        method: 'POST',
        body: JSON.stringify({
          plataforma: conn.plataforma,
          store_id: conn.store_id,
          activo: !conn.activo,
          emitir_en_estado: conn.emitir_en_estado,
          incluir_envio: conn.incluir_envio,
          incluir_propina: conn.incluir_propina,
        }),
      });
      await loadSummary();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error actualizando el estado de la tienda.');
    }
  };

  const handleDeleteDelivery = async (id: string) => {
    if (!confirm('¿Eliminar esta conexión de delivery?')) return;
    setErrorMsg(null);
    try {
      await apiFetch(`/v1/integrations/delivery/${id}`, { method: 'DELETE' });
      flashSuccess('Conexión eliminada.');
      await loadSummary();
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo eliminar la conexión.');
    }
  };

  const handleSaveWebhook = async (e: React.FormEvent, rotateSecret = false) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;
    setSavingWebhook(true);
    setErrorMsg(null);
    try {
      const saved = await apiFetch<any>('/v1/integrations/outgoing-webhook', {
        method: 'POST',
        body: JSON.stringify({
          url: webhookUrl.trim(),
          events: ['invoice.emitted', 'invoice.failed'],
          rotateSecret,
        }),
      });
      if (saved?.secretOnce) {
        setCreatedWebhookSecretOnce(saved.secretOnce);
      }
      flashSuccess('Webhook saliente configurado con firma HMAC-SHA256.');
      await loadSummary();
    } catch (err: any) {
      setErrorMsg(extractErr(err, 'No se pudo guardar el Webhook.'));
    } finally {
      setSavingWebhook(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Integraciones &amp; API Pública v1</h1>
          <p className="text-xs text-slate-500">
            Conecta tu sistema POS, página web hecha en código, Uber Eats y PedidosYa hacia ANTEK Factura
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/docs/api"
            target="_blank"
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
          >
            <span>Documentación API &amp; curl</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={loadSummary}
            className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. API KEYS POR EMPRESA */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-bold text-slate-900">1. API Keys para POS &amp; Sitios Web</h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Header: Authorization: Bearer ak_live_... (60 req/min)
          </span>
        </div>

        <form onSubmit={handleCreateApiKey} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            required
            placeholder='Nombre de la integración (ej. "POS Restaurante" o "Tienda Web")'
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-hidden focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={creatingKey || !newKeyName.trim()}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{creatingKey ? 'Generando...' : 'Generar API Key'}</span>
          </button>
        </form>

        {createdKeyOnce && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                ¡Guarda tu clave ahora! Por seguridad solo almacenamos el hash SHA-256 y no volverá a mostrarse ({createdKeyOnce.nombre}).
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-slate-950 text-emerald-400 font-mono text-xs break-all">
                {createdKeyOnce.key}
              </code>
              <button
                type="button"
                onClick={() => handleCopyText(createdKeyOnce.key, 'once')}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
              >
                {copiedKeyOnce ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedKeyOnce ? 'Copiada' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <th className="px-3.5 py-2.5">Nombre</th>
                <th className="px-3.5 py-2.5">Prefijo</th>
                <th className="px-3.5 py-2.5">Permisos</th>
                <th className="px-3.5 py-2.5">Último uso</th>
                <th className="px-3.5 py-2.5">Estado</th>
                <th className="px-3.5 py-2.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3.5 py-6 text-center text-slate-400">
                    No has creado API Keys todavía. Crea una para conectar tu POS o web.
                  </td>
                </tr>
              ) : (
                apiKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/70">
                    <td className="px-3.5 py-2.5 font-bold text-slate-800">{k.nombre}</td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-600">{k.prefijo_visible}••••</td>
                    <td className="px-3.5 py-2.5">
                      <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                        {k.scopes.join(', ')}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500">
                      {k.ultimo_uso ? new Date(k.ultimo_uso).toLocaleString('es-DO') : 'Nunca usada'}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {k.revocada ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-bold text-[11px]">
                          Revocada
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                          Activa
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      {!k.revocada && (
                        <button
                          type="button"
                          onClick={() => handleRevokeKey(k)}
                          className="text-red-600 hover:text-red-700 font-bold inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revocar</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. CONECTORES DELIVERY: UBER EATS Y PEDIDOSYA */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-bold text-slate-900">
            2. Conectores Automáticos Delivery (Uber Eats &amp; PedidosYa)
          </h2>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Registra el <code className="bg-slate-100 px-1 py-0.5 rounded-sm font-mono">store_id</code> de tu sucursal en Uber Eats o PedidosYa para emitir e-CF 32 automáticamente sin que tu POS se conecte directo a ellos. Las comisiones de la plataforma nunca se facturan al cliente.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              id: 'uber',
              label: 'Webhook URL para Uber Eats',
              url: 'https://factura.antek.com.do/api/webhooks/ubereats',
            },
            {
              id: 'peya',
              label: 'Webhook URL para PedidosYa',
              url: 'https://factura.antek.com.do/api/webhooks/pedidosya',
            },
          ].map((item) => (
            <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[11px] font-bold text-slate-600">{item.label}</div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-[11px] font-mono text-slate-800 truncate">{item.url}</code>
                <button
                  type="button"
                  onClick={() => handleCopyText(item.url, item.id)}
                  className="text-sky-600 hover:text-sky-700 text-[11px] font-bold inline-flex items-center gap-1 shrink-0"
                >
                  {copiedUrl === item.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl === item.id ? 'Copiada' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSaveDelivery} className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Plataforma</label>
            <select
              value={plataforma}
              onChange={(e) => setPlataforma(e.target.value as 'ubereats' | 'pedidosya')}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white"
            >
              <option value="ubereats">Uber Eats</option>
              <option value="pedidosya">PedidosYa</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Store ID en Plataforma</label>
            <input
              type="text"
              required
              placeholder="ej. ue_store_12345"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Estado disparador</label>
            <select
              value={emitirEnEstado}
              onChange={(e) => setEmitirEnEstado(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white"
            >
              <option value="DELIVERED">DELIVERED (Entregado)</option>
              <option value="CONFIRMED">CONFIRMED (Confirmado)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={savingDelivery || !storeId.trim()}
              className="w-full px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition"
            >
              <PlugZap className="w-3.5 h-3.5" />
              <span>{savingDelivery ? 'Guardando...' : 'Conectar Tienda'}</span>
            </button>
          </div>
        </form>

        <div className="flex flex-wrap gap-4 text-xs text-slate-700">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={incluirEnvio}
              onChange={(e) => setIncluirEnvio(e.target.checked)}
              className="rounded-sm border-slate-300 text-sky-600"
            />
            <span>Facturar envío como línea separada</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={incluirPropina}
              onChange={(e) => setIncluirPropina(e.target.checked)}
              className="rounded-sm border-slate-300 text-sky-600"
            />
            <span>Facturar propina como línea separada exenta</span>
          </label>
        </div>

        {deliveryConnections.length > 0 && (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <th className="px-3.5 py-2">Plataforma</th>
                  <th className="px-3.5 py-2">Store ID</th>
                  <th className="px-3.5 py-2">Opciones</th>
                  <th className="px-3.5 py-2">Estado</th>
                  <th className="px-3.5 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveryConnections.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3.5 py-2 font-bold uppercase text-slate-800">{c.plataforma}</td>
                    <td className="px-3.5 py-2 font-mono text-slate-700">{c.store_id}</td>
                    <td className="px-3.5 py-2 text-slate-500">
                      Estado: {c.emitir_en_estado} · Envío: {c.incluir_envio ? 'Sí' : 'No'} · Propina:{' '}
                      {c.incluir_propina ? 'Sí' : 'No'}
                    </td>
                    <td className="px-3.5 py-2">
                      <button
                        type="button"
                        onClick={() => handleToggleDelivery(c)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          c.activo
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {c.activo ? 'Activo' : 'Pausado'}
                      </button>
                    </td>
                    <td className="px-3.5 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteDelivery(c.id)}
                        className="text-red-600 hover:text-red-700 font-bold"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. WEBHOOK SALIENTE */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-bold text-slate-900">
            3. Webhook Saliente (Notificaciones en Tiempo Real)
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          Enviamos un <code className="font-mono text-slate-700">POST</code> firmado con HMAC-SHA256 en{' '}
          <code className="font-mono text-slate-700">X-Antek-Signature</code> para los eventos{' '}
          <code className="font-mono text-slate-700">invoice.emitted</code> e{' '}
          <code className="font-mono text-slate-700">invoice.failed</code> (hasta 3 reintentos con backoff).
        </p>

        <form onSubmit={(e) => handleSaveWebhook(e, false)} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="url"
              required
              placeholder="https://tu-sistema.com/webhooks/antek-factura"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs text-slate-800 focus:outline-hidden focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={savingWebhook}
              className="px-4 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition shrink-0"
            >
              {savingWebhook ? 'Guardando...' : 'Guardar URL'}
            </button>
            {outgoingWebhook && (
              <button
                type="button"
                disabled={savingWebhook}
                onClick={(e) => handleSaveWebhook(e, true)}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-xl transition shrink-0"
              >
                Rotar Secret
              </button>
            )}
          </div>
        </form>

        {createdWebhookSecretOnce && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
            <div className="text-xs font-bold text-amber-900">
              Secret de firma HMAC-SHA256 (guárdalo para verificar X-Antek-Signature):
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 text-emerald-400 font-mono text-xs break-all">
                {createdWebhookSecretOnce}
              </code>
              <button
                type="button"
                onClick={() => handleCopyText(createdWebhookSecretOnce, 'whsec')}
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1"
              >
                {copiedWebhookSecret ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedWebhookSecret ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        )}

        {outgoingWebhook && !createdWebhookSecretOnce && (
          <div className="text-xs text-slate-600">
            Secret activo: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded-sm">{outgoingWebhook.secretPrefix}</code>
          </div>
        )}
      </div>

      {/* 4. TRAZABILIDAD DE VENTAS EXTERNAS */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-bold text-slate-900">
            4. Bitácora de Ventas Externas (ventas_externas)
          </h2>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <th className="px-3.5 py-2.5">Origen</th>
                <th className="px-3.5 py-2.5">External ID</th>
                <th className="px-3.5 py-2.5">e-NCF</th>
                <th className="px-3.5 py-2.5">Estado</th>
                <th className="px-3.5 py-2.5">Detalle / Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {externalSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3.5 py-6 text-center text-slate-400">
                    Aún no se han recibido ventas por API Pública v1 ni conectores de delivery.
                  </td>
                </tr>
              ) : (
                externalSales.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3.5 py-2.5 font-bold uppercase text-slate-700">{s.origen}</td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-800">{s.external_id}</td>
                    <td className="px-3.5 py-2.5 font-mono font-bold text-sky-700">
                      {s.encf || '—'}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          s.estado === 'emitido'
                            ? 'bg-emerald-50 text-emerald-700'
                            : s.estado === 'error' || s.estado === 'alerta_nota_credito'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {s.estado}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500">
                      {s.error_detalle || new Date(s.creada_en).toLocaleString('es-DO')}
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
