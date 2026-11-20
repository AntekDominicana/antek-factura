-- Migración aditiva: API Keys seguras con HMAC-SHA256 + API_KEY_PEPPER y trazabilidad user_id
-- Segura e idempotente para bases de datos en producción.

ALTER TABLE "ApiKey"
  ADD COLUMN IF NOT EXISTS "user_id" TEXT;

CREATE INDEX IF NOT EXISTS "ApiKey_keyPrefix_idx"
  ON "ApiKey"("keyPrefix");

CREATE INDEX IF NOT EXISTS "ApiKey_user_id_idx"
  ON "ApiKey"("user_id");

DROP VIEW IF EXISTS "api_keys";
CREATE OR REPLACE VIEW "api_keys" AS
SELECT
  "id",
  "tenantId" AS "empresa_id",
  "user_id",
  "name" AS "nombre",
  "keyHash" AS "key_hash",
  "keyPrefix" AS "prefijo_visible",
  "scopes",
  "isActive" AS "activa",
  ("revoked" OR NOT "isActive") AS "revocada",
  "lastUsedAt" AS "ultimo_uso",
  "createdAt" AS "creada_en"
FROM "ApiKey";
