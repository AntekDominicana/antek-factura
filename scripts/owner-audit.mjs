#!/usr/bin/env node

const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const OWNER_KEY = process.env.OWNER_AUDIT_KEY || 'owner_internal_key_2026';

async function main() {
  console.log('=== AUDITORÍA INTERNA DEL PROPIETARIO (FacturaRD Cloud) ===');
  console.log(`API: ${API_BASE}\n`);

  // 1. Verificar que los clientes sin X-Owner-Key son rechazados con HTTP 403
  const noKeyRes = await fetch(`${API_BASE}/v1/security/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  console.log(`[Control 1] POST /v1/security/audit sin X-Owner-Key -> HTTP ${noKeyRes.status} (esperado: 403)`);
  if (noKeyRes.status !== 403) {
    console.error('ERROR CRÍTICO: El endpoint de auditoría no está bloqueado sin llave de propietario.');
    process.exit(1);
  }

  // 2. Verificar que agentes de IA (ej. GPTBot) son bloqueados silenciosamente en el WAF
  const botRes = await fetch(`${API_BASE}/v1/security/audit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'GPTBot/1.0',
      'X-Owner-Key': OWNER_KEY,
    },
    body: JSON.stringify({}),
  });
  console.log(`[Control 2] Petición simulada como agente GPTBot -> HTTP ${botRes.status} (esperado: 403)`);
  if (botRes.status !== 403) {
    console.error('ERROR CRÍTICO: BlindLlmAgentShield no bloqueó el agente IA simulado.');
    process.exit(1);
  }

  // 3. Verificar que llms-full.txt exige X-API-Key
  const docsRes = await fetch(`${API_BASE}/v1/docs/llms-full.txt`);
  console.log(`[Control 3] GET /v1/docs/llms-full.txt anónimo -> HTTP ${docsRes.status} (esperado: 403)`);
  if (docsRes.status !== 403) {
    console.error('ERROR CRÍTICO: /v1/docs/llms-full.txt accesible sin X-API-Key.');
    process.exit(1);
  }

  // 4. Ejecutar Auditoría Criptográfica y Blindaje Completa autenticada como Propietario
  const auditRes = await fetch(`${API_BASE}/v1/security/audit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Owner-Key': OWNER_KEY,
    },
    body: JSON.stringify({}),
  });

  if (!auditRes.ok) {
    const errText = await auditRes.text();
    console.error(`Error ejecutando auditoría autenticada (${auditRes.status}): ${errText}`);
    process.exit(1);
  }

  const audit = await auditRes.json();
  console.log(`\nResultado Auditoría: ${audit.passed ? 'APROBADA ✓' : 'CON FALLAS ✗'} (${audit.score})`);
  for (const chk of audit.checks || []) {
    console.log(`  - [${chk.passed ? 'OK' : 'FAIL'}] ${chk.name}: ${chk.detail}`);
  }

  // 5. Leer Telemetría Privada del Propietario
  const telRes = await fetch(`${API_BASE}/v1/security/telemetry`, {
    headers: { 'X-Owner-Key': OWNER_KEY },
  });
  const telemetry = await telRes.json();
  console.log('\nTelemetría Interna:');
  console.log(`  - Source Maps Expuestos: ${telemetry.sourceMapsExposed}`);
  console.log(`  - RLS Isolation Activo: ${telemetry.rlsIsolationActive}`);
  console.log(`  - API Keys Anti-Leak Vault: ${telemetry.apiKeyAntiLeakVaultActive}`);
  console.log(`  - Agentes IA Interceptados: ${telemetry.aiAgentsBlockedCount}`);
  console.log(`  - Colisiones e-NCF: ${telemetry.sequenceCollisionsDetected}`);

  if (!audit.passed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error ejecutando owner-audit:', err.message);
  process.exit(1);
});
