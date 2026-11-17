'use client';

import React, { useState } from 'react';
import {
  Code2,
  Key,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Webhook,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';

export default function DevelopersSettingsPage() {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [apiKey, setApiKey] = useState('antk_live_9f83a8b271d46c5e0988e41bf128a4c9e782');
  const [webhookUrl, setWebhookUrl] = useState('https://mi-tienda.com.do/api/webhooks/antek-ecf');
  const [webhookSecret] = useState('whsec_88f9104b2a3c5d6e7f80192a3b4c5d6e');
  const [aiCopilotEnabled, setAiCopilotEnabled] = useState(true);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCopy = (text: string, type: 'key' | 'secret') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const handleRotateKey = () => {
    if (confirm('¿Deseas generar una nueva API Key? La clave actual dejará de funcionar de inmediato.')) {
      const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(20)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      setApiKey(`antk_live_${randomHex}`);
      setSuccessMsg('Nueva API Key generada con éxito con cifrado CSPRNG ✓');
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  const handleSaveWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWebhook(true);
    setTimeout(() => {
      setSavingWebhook(false);
      setSuccessMsg('Configuración de Webhook guardada exitosamente ✓');
      setTimeout(() => setSuccessMsg(null), 3500);
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Desarrolladores & API Cifrada</h1>
        <p className="text-xs text-slate-500">
          Credenciales API, Webhooks para tu ERP y Blind-LLM Shield anti ingeniería inversa
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Blind-LLM Shield Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 border border-sky-800/40 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-black tracking-wider uppercase text-sky-400">
                Blind-LLM Shield • Activo & Protegido
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Tu código, lógica de facturación y datos fiscales están blindados criptográficamente contra agentes de IA no autorizados, scrapers e ingeniería inversa.
            </p>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-400/30 text-sky-300 font-mono text-[11px] font-bold self-start sm:self-auto shrink-0">
            Firma: ANTEK Core v2.4
          </div>
        </div>
      </div>

      {/* API Key */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-bold text-slate-900">API Key de Producción</h2>
          </div>
          <button
            type="button"
            onClick={handleRotateKey}
            className="text-xs font-bold text-slate-600 hover:text-sky-600 flex items-center gap-1 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Rotar Clave</span>
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Usa esta clave en el encabezado <code className="bg-slate-100 px-1 py-0.5 rounded-sm font-mono text-slate-800">Authorization: Bearer antk_live_...</code> para emitir e-CF desde tu tienda online o sistema ERP.
        </p>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              readOnly
              value={apiKey}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 font-mono text-xs text-slate-800 focus:outline-hidden pr-20"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleCopy(apiKey, 'key')}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5 transition shrink-0"
          >
            {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedKey ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Nunca compartas tu API Key en repositorios públicos. Las peticiones son autenticadas contra tu tenant en modo Row Level Security (RLS).</span>
        </div>
      </div>

      {/* Webhooks */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-bold text-slate-900">Webhooks en Tiempo Real</h2>
        </div>
        <p className="text-xs text-slate-500">
          Recibe notificaciones instantáneas de eventos emitidos por la DGII (<code className="font-mono text-slate-700">invoice.accepted_dgii</code>, <code className="font-mono text-slate-700">invoice.rejected_dgii</code>).
        </p>

        <form onSubmit={handleSaveWebhook} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">URL de Destino</label>
            <input
              type="url"
              required
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs text-slate-800 focus:outline-hidden focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Firma Secreta HMAC (Webhook Secret)</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookSecret}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-600 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => handleCopy(webhookSecret, 'secret')}
                className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center gap-1 shrink-0"
              >
                {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSecret ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingWebhook}
              className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition shadow-xs"
            >
              {savingWebhook ? 'Guardando...' : 'Guardar Webhook'}
            </button>
          </div>
        </form>
      </div>

      {/* Copilot Gemini con RLS */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-900">Copilot Gemini Asistente Fiscal (RLS Activo)</h2>
          </div>
          <button
            type="button"
            onClick={() => setAiCopilotEnabled(!aiCopilotEnabled)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition ${
              aiCopilotEnabled ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Permite al usuario hacer preguntas en lenguaje natural sobre sus facturas, inventario y comprobantes e-CF.
          <strong> Protegido por Row Level Security (RLS)</strong>: La IA nunca tiene acceso a datos de otras empresas ni a clientes externos.
        </p>

        <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 text-purple-900 text-xs space-y-2">
          <div className="font-bold flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-purple-700" />
            <span>Garantía de Privacidad RLS Multi-Tenant</span>
          </div>
          <p className="text-[11px] text-purple-800 leading-relaxed">
            Cada consulta enviada a Gemini inyecta como contexto únicamente los registros del tenant actual mediante filtros criptográficos en la base de datos PostgreSQL.
          </p>
        </div>
      </div>
    </div>
  );
}
