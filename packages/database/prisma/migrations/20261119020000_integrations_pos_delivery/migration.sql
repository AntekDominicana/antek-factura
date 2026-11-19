-- Migración aditiva: Centro de Integración POS, Uber Eats, PedidosYa y API Pública v1
-- Segura e idempotente para bases de datos ya en producción.

-- 1. Ampliar tabla ApiKey con scopes y revocación sin romper keys existentes
ALTER TABLE "ApiKey"
  ADD COLUMN IF NOT EXISTS "scopes" TEXT[] NOT NULL DEFAULT ARRAY['invoices:write', 'invoices:read']::TEXT[];

ALTER TABLE "ApiKey"
  ADD COLUMN IF NOT EXISTS "revoked" BOOLEAN NOT NULL DEFAULT false;

-- Vista compatible api_keys con nomenclatura en español solicitada
CREATE OR REPLACE VIEW "api_keys" AS
SELECT
  "id",
  "tenantId" AS "empresa_id",
  "name" AS "nombre",
  "keyHash" AS "key_hash",
  "keyPrefix" AS "prefijo_visible",
  "scopes",
  ("revoked" OR NOT "isActive") AS "revocada",
  "lastUsedAt" AS "ultimo_uso",
  "createdAt" AS "creada_en"
FROM "ApiKey";

-- 2. Tabla de trazabilidad de ventas externas (idempotencia por empresa_id + origen + external_id)
CREATE TABLE IF NOT EXISTS "ventas_externas" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "origen" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "payload_original" JSONB NOT NULL,
  "ecf_id" TEXT,
  "encf" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'pendiente',
  "error_detalle" TEXT,
  "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ventas_externas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ventas_externas_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ventas_externas_empresa_id_origen_external_id_key"
  ON "ventas_externas"("empresa_id", "origen", "external_id");

CREATE INDEX IF NOT EXISTS "ventas_externas_empresa_id_creada_en_idx"
  ON "ventas_externas"("empresa_id", "creada_en");

-- 3. Tabla de conexiones de plataformas de delivery (Uber Eats / PedidosYa)
CREATE TABLE IF NOT EXISTS "conexiones_delivery" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "plataforma" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "entorno" TEXT NOT NULL DEFAULT 'sandbox',
  "client_id_enc" TEXT,
  "client_secret_enc" TEXT,
  "webhook_secret_enc" TEXT,
  "emitir_en_estado" TEXT NOT NULL DEFAULT 'DELIVERED',
  "incluir_envio" BOOLEAN NOT NULL DEFAULT true,
  "incluir_propina" BOOLEAN NOT NULL DEFAULT true,
  "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conexiones_delivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conexiones_delivery_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "conexiones_delivery"
  ADD COLUMN IF NOT EXISTS "entorno" TEXT NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS "client_id_enc" TEXT,
  ADD COLUMN IF NOT EXISTS "client_secret_enc" TEXT,
  ADD COLUMN IF NOT EXISTS "webhook_secret_enc" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "conexiones_delivery_plataforma_store_id_key"
  ON "conexiones_delivery"("plataforma", "store_id");

CREATE INDEX IF NOT EXISTS "conexiones_delivery_empresa_id_plataforma_idx"
  ON "conexiones_delivery"("empresa_id", "plataforma");
