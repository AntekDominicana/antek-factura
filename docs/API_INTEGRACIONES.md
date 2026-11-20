# Documentación API Pública v1 & Conectores Delivery — ANTEK Factura

Base URL en producción: `https://factura.antek.com.do`  
Página web interactiva: `https://factura.antek.com.do/docs/api`

---

## 1. Autenticación

Todas las llamadas desde POS o páginas web propias requieren una API Key generada en **Configuración → Integraciones & API** usando el header estándar Bearer o `X-API-Key`:

```http
Authorization: Bearer sk_live_<64_caracteres_hex>
# o alternativamente:
X-API-Key: sk_live_<64_caracteres_hex>
```

- Formato de la clave: `sk_live_` + 64 caracteres hexadecimales criptográficos (`crypto.randomBytes(32)`). (Compatibilidad retroactiva mantenida con claves `ak_live_`).
- La clave completa se muestra **una sola vez** al crearla. En base de datos nunca se almacena en texto plano: únicamente guardamos su hash **`HMAC-SHA256` con `API_KEY_PEPPER`** y validamos en cada petición usando comparación en tiempo constante (`crypto.timingSafeEqual`).
- Rate Limit por API Key: **60 peticiones por minuto**. Al superar este límite responde HTTP `429`.

---

## 2. Endpoints Públicos v1

### `POST /api/v1/invoices` — Emitir e-CF con Idempotencia

Envía una venta desde cualquier POS o tienda web hecha en código. ANTEK Factura calcula totales/ITBIS, asigna el e-NCF, firma en XMLDSig y transmite a la DGII.

- **Idempotencia:** La combinación `(empresa_id, origen, external_id)` es única. Si vuelves a enviar la misma venta con el mismo `external_id`, devuelve HTTP **`200`** con la factura ya emitida y **NO** emite otro e-CF.
- **Emisión nueva:** Devuelve HTTP **`201`**.
- **`precio_incluye_itbis` (boolean, opcional, por defecto `false`):** Si tu POS cobra con impuestos ya incluidos en el precio unitario, envía `"precio_incluye_itbis": true` (y `"descuento"` en `%`). Extraemos base imponible e ITBIS por resta exacta y cuadramos centavos de redondeo con `<RecargoMonto>` / `<DescuentoMonto>` en el XML de la DGII para que el total coincida exacto con tu POS.

#### Ejemplo e-CF 32 (Consumo / POS)
```bash
curl -X POST https://factura.antek.com.do/api/v1/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_TU_API_KEY" \
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
    "notas": "Mesa 4"
  }'
```

#### Ejemplo e-CF 31 (Crédito Fiscal con RNC)
```bash
curl -X POST https://factura.antek.com.do/api/v1/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_TU_API_KEY" \
  -d '{
    "external_id": "WEB-CARRITO-9921",
    "tipo_ecf": 31,
    "comprador": {
      "rnc": "131880738",
      "nombre": "ANTEK DOMINICANA SRL"
    },
    "items": [
      {
        "descripcion": "Servicio de Catering Empresarial",
        "cantidad": 1,
        "precio_unitario": 10000,
        "itbis_tasa": 18
      }
    ],
    "forma_pago": "transferencia",
    "canal": "para_llevar"
  }'
```

#### Respuesta (201 Created / 200 Idempotente)
```json
{
  "id": "inv-9b34a8...",
  "external_id": "ORD-POS-00481",
  "origen": "pos",
  "encf": "E320000000001",
  "estado": "ACCEPTED",
  "total": 1122,
  "itbis_total": 162,
  "qr_url": "https://ecf.dgii.gov.do/...",
  "pdf_url": "https://factura.antek.com.do/v1/invoices/inv-9b34a8.../pdf",
  "fecha_emision": "2026-11-19"
}
```

### `GET /api/v1/invoices/{id}`
Consulta por ID interno o por `encf`:
```bash
curl -X GET https://factura.antek.com.do/api/v1/invoices/E320000000001 \
  -H "Authorization: Bearer sk_live_TU_API_KEY"
```

### `GET /api/v1/invoices?external_id=...`
Consulta la trazabilidad y comprobante emitido usando el ID de la venta en tu POS o plataforma:
```bash
curl -X GET "https://factura.antek.com.do/api/v1/invoices?external_id=ORD-POS-00481" \
  -H "Authorization: Bearer sk_live_TU_API_KEY"
```

---

## 3. Webhooks de Plataformas Delivery

El POS **nunca** se conecta directo a Uber Eats o PedidosYa; las plataformas envían eventos directamente a ANTEK Factura y se mapean al total pagado por el cliente (excluyendo comisiones de la plataforma):

### Uber Eats: `POST /api/webhooks/ubereats`
- Verifica el header `X-Uber-Signature` (HMAC-SHA256 sobre el body crudo usando `UBER_CLIENT_SECRET`).
- Responde HTTP `200` de inmediato y procesa el pedido en segundo plano obteniendo el detalle en la Order API (`UBER_ENV=sandbox|production`) si no viene en el webhook.
- Si el pedido es cancelado, marca el estado en `ventas_externas` sin emitir (o crea `alerta_nota_credito` si ya había sido emitido).

### PedidosYa: `POST /api/webhooks/pedidosya`
- Valida el secreto `PEDIDOSYA_WEBHOOK_SECRET` (enviado en `X-PedidosYa-Signature`, `X-Webhook-Secret` o `Authorization: Bearer <secret>`).
- Emite el e-CF 32 cuando el pedido alcanza el estado configurado (`DELIVERED` por defecto) y lo omite si está `CANCELLED`.

---

## 4. Códigos de Error

Todos los errores retornan JSON claro en español: `{ "error": "...", "campo": "..." }`:

- `400 Bad Request`: Campo inválido o faltante (ej. `comprador.rnc` faltante en `tipo_ecf: 31`, `items`, `forma_pago`).
- `401 Unauthorized`: API Key faltante/inválida/revocada o firma de webhook inválida.
- `402 Payment Required`: Suscripción suspendida o límite mensual de comprobantes alcanzado.
- `403 Forbidden`: El plan actual no incluye acceso API o el tipo de e-CF no está habilitado.
- `404 Not Found`: Comprobante o `external_id` no encontrado.
- `429 Too Many Requests`: Superaste el límite de 60 peticiones por minuto por API Key.

---

## 5. Verificación de Firma Webhook Saliente (`X-Antek-Signature`)

ANTEK Factura envía `POST` a la URL configurada con `{ evento: "invoice.emitted" | "invoice.failed", timestamp, data }` (con hasta 3 reintentos y backoff exponencial) firmado en el header `X-Antek-Signature: sha256=<hex>`.

```ts
import crypto from 'crypto';

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
}
```
