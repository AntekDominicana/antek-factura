'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PublicNavbar } from '../../../components/PublicNavbar';
import { PublicFooter } from '../../../components/PublicFooter';
import {
  BookOpen,
  Check,
  Code2,
  Copy,
  KeyRound,
  ShieldCheck,
  Terminal,
  Webhook,
} from 'lucide-react';

const PUBLIC_ORIGIN = 'https://factura.antek.com.do';

const CURL_POS_32 = `curl -X POST ${PUBLIC_ORIGIN}/api/v1/invoices \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ak_live_REEMPLAZA_CON_TU_API_KEY" \\
  -d '{
    "external_id": "ORD-POS-00481",
    "tipo_ecf": 32,
    "items": [
      {
        "descripcion": "Combo Hamburguesa Clásica + Papas",
        "cantidad": 2,
        "precio_unitario": 450,
        "itbis_tasa": 18,
        "descuento": 0
      },
      {
        "descripcion": "Botella de Agua 500ml",
        "cantidad": 1,
        "precio_unitario": 60,
        "itbis_tasa": 0
      }
    ],
    "forma_pago": "tarjeta",
    "canal": "salon",
    "notas": "Mesa 4 - Restaurante"
  }'`;

const CURL_CREDITO_31 = `curl -X POST ${PUBLIC_ORIGIN}/api/v1/invoices \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ak_live_REEMPLAZA_CON_TU_API_KEY" \\
  -d '{
    "external_id": "WEB-CARRITO-9921",
    "tipo_ecf": 31,
    "comprador": {
      "rnc": "131880738",
      "nombre": "ANTEK DOMINICANA SRL"
    },
    "items": [
      {
        "descripcion": "Suscripción Software POS Mensual",
        "cantidad": 1,
        "precio_unitario": 2500,
        "itbis_tasa": 18
      }
    ],
    "forma_pago": "transferencia",
    "canal": "para_llevar"
  }'`;

const CURL_QUERY = `# Consultar por ID interno o e-NCF
curl -X GET "${PUBLIC_ORIGIN}/api/v1/invoices/E320000000001" \\
  -H "Authorization: Bearer ak_live_REEMPLAZA_CON_TU_API_KEY"

# Consultar por external_id del POS / sitio web
curl -X GET "${PUBLIC_ORIGIN}/api/v1/invoices?external_id=ORD-POS-00481" \\
  -H "Authorization: Bearer ak_live_REEMPLAZA_CON_TU_API_KEY"`;

const VERIFY_WEBHOOK_NODE = `import crypto from 'crypto';

export function verifyAntekWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !webhookSecret) return false;
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(signatureHeader.trim(), 'utf8');
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}`;

function CodeBlock({ id, title, code }: { id: string; title: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-sky-400" />
          {title}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>
      <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PublicNavbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10 w-full">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-bold border border-sky-500/20">
            <BookOpen className="w-3.5 h-3.5" /> API Pública v1 &amp; Webhooks Delivery
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white">
            Conecta tu POS, Página Web o Delivery a ANTEK Factura
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
            Tu POS o web hecha en código solo necesita enviar un <code className="text-sky-300">POST /api/v1/invoices</code> a ANTEK Factura con su API Key. Nosotros asignamos el e-NCF, calculamos ITBIS, firmamos en XMLDSig ante la DGII (Ley 32-23) e garantizamos idempotencia automática.
          </p>
          <div className="pt-1 flex flex-wrap gap-3">
            <Link
              href="/app/settings/developers"
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <KeyRound className="w-3.5 h-3.5" /> Crear mi API Key en Integraciones
            </Link>
          </div>
        </div>

        {/* Autenticación */}
        <section className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400" /> 1. Autenticación &amp; Rate Limit
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Envía tu clave generada en <strong>Integraciones &amp; API</strong> usando el encabezado estándar Bearer:
          </p>
          <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-sky-300 overflow-x-auto">
            Authorization: Bearer ak_live_&lt;48_caracteres_hex&gt;
          </pre>
          <ul className="text-xs text-slate-400 list-disc pl-5 space-y-1">
            <li>La API Key completa se muestra una sola vez al crearla; almacenamos únicamente el hash SHA-256.</li>
            <li>Límite de velocidad por API Key: <strong>60 peticiones/minuto</strong> (headers <code className="text-slate-200">X-RateLimit-Remaining</code>).</li>
            <li>Idempotencia garantizada: si reenvías la misma venta con igual <code className="text-slate-200">external_id</code>, devolvemos HTTP <strong>200</strong> con el comprobante original sin duplicar secuencias.</li>
          </ul>
        </section>

        {/* Endpoints */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Code2 className="w-4 h-4 text-sky-400" /> 2. Endpoints Principales
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="font-mono font-bold text-emerald-400">POST /api/v1/invoices</div>
              <p className="text-slate-400">
                Emite un e-CF 32 (Consumo, por defecto) o 31 (Crédito Fiscal si envías RNC). Retorna HTTP 201 al emitir o 200 si ya existía ese <code className="text-slate-200">external_id</code>.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="font-mono font-bold text-sky-400">
                GET /api/v1/invoices/&#123;id&#125; &amp; ?external_id=...
              </div>
              <p className="text-slate-400">
                Consulta el estado ante DGII, e-NCF, totales, URL del QR y enlace de descarga del PDF.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="font-mono font-bold text-amber-400">POST /api/webhooks/ubereats</div>
              <p className="text-slate-400">
                Valida HMAC-SHA256 en <code className="text-slate-200">X-Uber-Signature</code> con <code className="text-slate-200">UBER_CLIENT_SECRET</code>, responde 200 de inmediato y emite e-CF 32 en segundo plano.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="font-mono font-bold text-rose-400">POST /api/webhooks/pedidosya</div>
              <p className="text-slate-400">
                Valida <code className="text-slate-200">PEDIDOSYA_WEBHOOK_SECRET</code> y emite e-CF 32 cuando el pedido alcanza el estado configurado (<code className="text-slate-200">DELIVERED</code>).
              </p>
            </div>
          </div>

          <CodeBlock id="pos32" title="Emitir Consumo e-CF 32 desde POS o Web Propia (curl)" code={CURL_POS_32} />
          <CodeBlock id="ecf31" title="Emitir Crédito Fiscal e-CF 31 con RNC (curl)" code={CURL_CREDITO_31} />
          <CodeBlock id="query" title="Consultar Factura por ID, e-NCF o external_id (curl)" code={CURL_QUERY} />
        </section>

        {/* Respuesta 201 */}
        <section className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h2 className="text-base font-bold text-white">Respuesta Exitosa (201 Created / 200 Idempotente)</h2>
          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-sky-300 overflow-x-auto">
{`{
  "id": "inv-9b34a8...",
  "external_id": "ORD-POS-00481",
  "origen": "pos",
  "encf": "E320000000001",
  "estado": "ACCEPTED",
  "total": 1122,
  "itbis_total": 162,
  "qr_url": "https://ecf.dgii.gov.do/...",
  "pdf_url": "${PUBLIC_ORIGIN}/v1/invoices/inv-9b34a8.../pdf",
  "fecha_emision": "2026-11-19"
}`}
          </pre>
        </section>

        {/* Códigos de error */}
        <section className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h2 className="text-lg font-bold text-white">3. Códigos de Error Estándar</h2>
          <p className="text-xs text-slate-400">
            Todos los errores devuelven estructura clara en español: <code className="text-slate-200">{`{ "error": "...", "campo": "..." }`}</code>.
          </p>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-3.5 py-2">Código HTTP</th>
                  <th className="px-3.5 py-2">Significado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                <tr>
                  <td className="px-3.5 py-2 font-mono font-bold text-amber-400">400 Bad Request</td>
                  <td className="px-3.5 py-2">Error de validación (RNC faltante en e-CF 31, ITBIS inválido, ítems vacíos, etc.).</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-mono font-bold text-red-400">401 Unauthorized</td>
                  <td className="px-3.5 py-2">API Key ausente, inválida o revocada, o firma de webhook inválida.</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-mono font-bold text-red-400">402 Payment Required</td>
                  <td className="px-3.5 py-2">Suscripción suspendida o límite mensual de comprobantes alcanzado.</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-mono font-bold text-red-400">403 Forbidden</td>
                  <td className="px-3.5 py-2">El plan actual no incluye acceso API o el tipo e-CF no está habilitado.</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-mono font-bold text-slate-300">404 Not Found</td>
                  <td className="px-3.5 py-2">Factura o <code className="text-slate-200">external_id</code> no encontrado para esta empresa.</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-mono font-bold text-amber-400">429 Too Many Requests</td>
                  <td className="px-3.5 py-2">Superaste el límite de 60 peticiones por minuto para esta API Key.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Verificación de firma Webhook Saliente */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Webhook className="w-4 h-4 text-sky-400" /> 4. Verificar Firma del Webhook Saliente (X-Antek-Signature)
          </h2>
          <p className="text-xs text-slate-400">
            Cuando configuras una URL en Integraciones, notificamos eventos <code className="text-sky-300">invoice.emitted</code> e <code className="text-rose-300">invoice.failed</code> con hasta 3 reintentos automáticos y firma HMAC-SHA256.
          </p>
          <CodeBlock
            id="verify"
            title="Verificación HMAC-SHA256 en Node.js / TypeScript"
            code={VERIFY_WEBHOOK_NODE}
          />
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
