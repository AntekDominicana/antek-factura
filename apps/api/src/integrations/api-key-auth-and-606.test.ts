import * as assert from 'assert';
import * as crypto from 'crypto';
import { BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test?schema=public';
}
process.env.API_KEY_PEPPER =
  'test_pepper_0123456789abcdef0123456789abcdef0123456789abcdef0123';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('@factura-ecf/database');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CryptoService } = require('../common/crypto.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ApiKeyAuthGuard } = require('./api-key-auth.guard');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RncService } = require('../rnc/rnc.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { FiscalService } = require('../fiscal/fiscal.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PurchasesService } = require('../purchases/purchases.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SecurityShieldService } = require('../security/security-shield.service');

async function runTests() {
  // =========================================================================
  // 1. CryptoService: Generación sk_live_, HMAC-SHA256 + API_KEY_PEPPER y timingSafeEqual
  // =========================================================================
  const cryptoSvc = new CryptoService();
  const generated = cryptoSvc.generateApiKey('sk_live_');

  assert.ok(generated.rawKey.startsWith('sk_live_'));
  assert.strictEqual(generated.rawKey.length, 8 + 64); // sk_live_ + 64 hex (256 bits)
  assert.strictEqual(generated.keyPrefix, generated.rawKey.slice(0, 12));
  assert.strictEqual(generated.keyHash.length, 64);
  assert.strictEqual(generated.keyHash, cryptoSvc.hashApiKey(generated.rawKey));
  assert.notStrictEqual(generated.keyHash, cryptoSvc.hashSha256(generated.rawKey));

  assert.strictEqual(cryptoSvc.verifyHashTimingSafe(generated.keyHash, generated.keyHash), true);
  const tamperedHash =
    (generated.keyHash[0] === '0' ? '1' : '0') + generated.keyHash.slice(1);
  assert.strictEqual(cryptoSvc.verifyHashTimingSafe(generated.keyHash, tamperedHash), false);
  assert.strictEqual(cryptoSvc.verifyHashTimingSafe(generated.keyHash, 'short'), false);
  assert.strictEqual(cryptoSvc.verifyHashTimingSafe('zzzz', generated.keyHash), false);

  // =========================================================================
  // 2. ApiKeyAuthGuard: Bearer + X-API-Key, timingSafeEqual, scopes, revocación y legacy
  // =========================================================================
  const legacyRaw = 'ak_live_' + crypto.randomBytes(24).toString('hex');
  const legacySha = cryptoSvc.hashSha256(legacyRaw);

  const dbApiKeys: any[] = [
    {
      id: 'key-hmac-1',
      tenantId: 'tenant-1',
      createdByUserId: 'user-99',
      keyPrefix: generated.keyPrefix,
      keyHash: generated.keyHash,
      scopes: ['invoices:write', 'invoices:read'],
      isActive: true,
      revoked: false,
      environment: 'PRODUCTION',
      tenant: { id: 'tenant-1', environment: 'PRODUCTION' },
    },
    {
      id: 'key-revoked-1',
      tenantId: 'tenant-1',
      createdByUserId: 'user-99',
      keyPrefix: 'sk_live_revo',
      keyHash: cryptoSvc.hashApiKey('sk_live_revoked_' + 'a'.repeat(56)),
      scopes: ['invoices:write'],
      isActive: false,
      revoked: true,
      environment: 'SANDBOX',
      tenant: { id: 'tenant-1', environment: 'SANDBOX' },
    },
    {
      id: 'key-readonly-1',
      tenantId: 'tenant-2',
      createdByUserId: 'user-55',
      keyPrefix: 'sk_live_read',
      keyHash: '', // se llenará abajo
      scopes: ['invoices:read'],
      isActive: true,
      revoked: false,
      environment: 'SANDBOX',
      tenant: { id: 'tenant-2', environment: 'SANDBOX' },
    },
    {
      id: 'key-legacy-1',
      tenantId: 'tenant-3',
      createdByUserId: null,
      keyPrefix: legacyRaw.slice(0, 12),
      keyHash: legacySha,
      scopes: ['invoices:write', 'invoices:read'],
      isActive: true,
      revoked: false,
      environment: 'SANDBOX',
      tenant: { id: 'tenant-3', environment: 'SANDBOX' },
    },
  ];
  const readOnlyRaw = 'sk_live_read' + crypto.randomBytes(30).toString('hex');
  dbApiKeys[2].keyPrefix = readOnlyRaw.slice(0, 12);
  dbApiKeys[2].keyHash = cryptoSvc.hashApiKey(readOnlyRaw);

  const apiKeyAny = prisma.apiKey as any;
  const origFindMany = apiKeyAny.findMany;
  const origUpdate = apiKeyAny.update;
  apiKeyAny.findMany = async ({ where }: any) =>
    dbApiKeys.filter((k) => k.keyPrefix === where.keyPrefix);
  apiKeyAny.update = async () => ({});

  try {
    const mockCache: any = {
      map: new Map(),
      async get(k: string) {
        return this.map.get(k) || null;
      },
      async set(k: string, v: any) {
        this.map.set(k, v);
      },
    };
    let requiredScope: 'invoices:write' | 'invoices:read' | undefined = 'invoices:write';
    const mockReflector: any = {
      getAllAndOverride: () => requiredScope,
    };

    const guard = new ApiKeyAuthGuard(mockReflector, mockCache, cryptoSvc);
    const makeCtx = (headers: Record<string, string>) => {
      const req: any = { headers };
      const resHeaders: Record<string, string> = {};
      const res: any = { setHeader: (k: string, v: string) => (resHeaders[k] = v) };
      return {
        req,
        resHeaders,
        ctx: {
          switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
          getHandler: () => ({}),
          getClass: () => ({}),
        },
      };
    };

    // Bearer HMAC válido
    const c1 = makeCtx({ authorization: `Bearer ${generated.rawKey}` });
    assert.strictEqual(await guard.canActivate(c1.ctx as any), true);
    assert.strictEqual(c1.req.tenantId, 'tenant-1');
    assert.strictEqual(c1.req.apiKeyUserId, 'user-99');

    // X-API-Key válido (viene desde caché + timingSafeEqual)
    const c2 = makeCtx({ 'x-api-key': generated.rawKey });
    assert.strictEqual(await guard.canActivate(c2.ctx as any), true);
    assert.strictEqual(c2.req.tenantId, 'tenant-1');

    // Clave legacy ak_live_ sigue funcionando sin romper clientes existentes
    const cLegacy = makeCtx({ authorization: `Bearer ${legacyRaw}` });
    assert.strictEqual(await guard.canActivate(cLegacy.ctx as any), true);
    assert.strictEqual(cLegacy.req.tenantId, 'tenant-3');

    // Clave incorrecta con mismo prefijo -> 401
    await assert.rejects(
      () => guard.canActivate(makeCtx({ authorization: `Bearer ${generated.keyPrefix}${'f'.repeat(60)}` }).ctx as any),
      (err: any) => err instanceof HttpException && err.getStatus() === HttpStatus.UNAUTHORIZED
    );

    // Clave revocada -> 401
    await assert.rejects(
      () =>
        guard.canActivate(
          makeCtx({ authorization: `Bearer sk_live_revoked_${'a'.repeat(56)}` }).ctx as any
        ),
      (err: any) => err instanceof HttpException && err.getStatus() === HttpStatus.UNAUTHORIZED
    );

    // Scope faltante -> 403
    requiredScope = 'invoices:write';
    await assert.rejects(
      () => guard.canActivate(makeCtx({ 'x-api-key': readOnlyRaw }).ctx as any),
      (err: any) => err instanceof HttpException && err.getStatus() === HttpStatus.FORBIDDEN
    );
  } finally {
    apiKeyAny.findMany = origFindMany;
    apiKeyAny.update = origUpdate;
  }

  // =========================================================================
  // 3. RncService: Validación Módulo 11 / 10 y lookup padrón DGII
  // =========================================================================
  const rncSvc = new RncService();
  assert.strictEqual(rncSvc.validateRncAlgorithm('131880738'), true);
  assert.strictEqual(rncSvc.validateRncAlgorithm('401506254'), true);
  assert.strictEqual(rncSvc.validateRncAlgorithm('131880739'), false);
  assert.strictEqual(rncSvc.validateRncAlgorithm('00112345670'), false);

  const antek = await rncSvc.lookup('131-88073-8');
  assert.strictEqual(antek.rnc, '131880738');
  assert.strictEqual(antek.razonSocial, 'ANTEK DOMINICANA SRL');
  assert.strictEqual(antek.foundInPadron, true);

  await assert.rejects(() => rncSvc.lookup('131880739'), (e: any) => e instanceof NotFoundException);
  await assert.rejects(() => rncSvc.lookup('12345'), (e: any) => e instanceof BadRequestException);

  // =========================================================================
  // 4. Formato 606 Excel Oficial DGII (Versión 2025) + TXT 23 columnas
  // =========================================================================
  const shield = new SecurityShieldService();
  const fiscalSvc = new FiscalService(cryptoSvc, shield);
  const purSvc = new PurchasesService(rncSvc);

  const tenantAny = prisma.tenant as any;
  const rpAny = prisma.receivedPurchase as any;
  const invAny = prisma.invoice as any;
  const origTenantFindUnique = tenantAny.findUnique;
  const origTenantFindFirst = tenantAny.findFirst;
  const origRpFindMany = rpAny.findMany;
  const origInvFindMany = invAny.findMany;

  const mockPurRow = {
    id: 'pur-1',
    tenantId: 'tenant-1',
    rncEmisor: '101532483',
    razonSocialEmisor: 'HIPERMERCADOS OLE SA',
    encf: 'E310000000045',
    tipoEcf: 31,
    fechaEmision: '2026-11-18',
    montoTotal: 1180.0,
    totalItbis: 180.0,
    tipoGasto606: '09',
    commercialStatus: 'APPROVED',
  };

  tenantAny.findUnique = async () => ({
    id: 'tenant-1',
    rnc: '131880738',
    razonSocial: 'ANTEK DOMINICANA SRL',
    nombreComercial: 'ANTEK FACTURA',
    direccion: 'Santo Domingo',
    correo: 'admin@antek.com.do',
    telefono: '8095550101',
    environment: 'PRODUCTION',
    fiscalProvider: 'DGII_DIRECT',
    sequences: [],
    subscription: null,
  });
  tenantAny.findFirst = tenantAny.findUnique;
  rpAny.findMany = async () => [mockPurRow];
  invAny.findMany = async () => [];

  try {
    const excel = await fiscalSvc.generateAccountantExcelReport('202611', 'tenant-1');
    assert.ok(excel.filename.startsWith('Formato_606_DGII_'));
    assert.ok(excel.xmlWorkbook.includes('<Worksheet ss:Name="Formato 606">'));
    assert.ok(excel.xmlWorkbook.includes('Versión 2025'));
    assert.ok(excel.xmlWorkbook.includes('Tipo Bienes y Servicios Comprados'));
    assert.ok(excel.xmlWorkbook.includes('09-COMPRAS Y GASTOS QUE FORMAN PARTE DEL COSTO DE VENTA'));
    assert.ok(excel.xmlWorkbook.includes('202611'));
    assert.ok(excel.xmlWorkbook.includes('>18<'));
    assert.ok(excel.xmlWorkbook.includes('ss:Formula="=RC[-2]+RC[-1]"'));
    assert.ok(excel.xmlWorkbook.includes('ss:Formula="=RC[-4]-RC[-1]"'));
    assert.ok(excel.xmlWorkbook.includes('ss:Formula="=SUM(R[-1]C:R[-1]C)"'));
    assert.ok(excel.xmlWorkbook.includes('01 - EFECTIVO'));

    // Validar que todas las filas de la hoja Formato 606 cuadren a 27 columnas (cols A..AA) sin solapes
    const sheetMatch = excel.xmlWorkbook.match(
      /<Worksheet ss:Name="Formato 606">[\s\S]*?<Table>([\s\S]*?)<\/Table>/
    );
    assert.ok(sheetMatch, 'Debe existir la tabla Formato 606');
    const rowMatches = [...sheetMatch![1].matchAll(/<Row\b[^/>]*(?:\/>|>([\s\S]*?)<\/Row>)/g)];
    assert.strictEqual(rowMatches.length, 13); // 11 cabecera + 1 data + 1 total
    const colSpansPerRow = rowMatches.map((m) => {
      const cells = [...(m[1] || '').matchAll(/<Cell\b([^>]*)>/g)];
      let colPos = 0;
      for (const c of cells) {
        const idxMatch = c[1].match(/ss:Index="(\d+)"/);
        if (idxMatch) colPos = Number(idxMatch[1]) - 1;
        const mergeAcross = c[1].match(/ss:MergeAcross="(\d+)"/);
        colPos += 1 + (mergeAcross ? Number(mergeAcross[1]) : 0);
      }
      return colPos;
    });
    assert.strictEqual(colSpansPerRow[0], 27); // Banner título
    assert.strictEqual(colSpansPerRow[1], 27); // Razón social / meta
    assert.strictEqual(colSpansPerRow[8], 27); // Números de columnas 1..23 + Estatus
    assert.strictEqual(colSpansPerRow[9], 27); // Nombres de columnas
    assert.strictEqual(colSpansPerRow[10], 10); // Subheader AAAAMM/DD en cols G..J (7..10)
    assert.strictEqual(colSpansPerRow[11], 27); // Fila de datos
    assert.strictEqual(colSpansPerRow[12], 27); // Fila de totales

    const txtRes = await purSvc.exportFormat606('tenant-1', '202611');
    const txtLines = txtRes.content.split(/\r?\n/);
    assert.strictEqual(txtLines[0], '606|131880738|202611|1');
    const fields = txtLines[1].split('|');
    assert.strictEqual(fields.length, 23, 'La línea 606 debe tener exactamente 23 campos oficiales');
    assert.strictEqual(fields[5], '20261118');
    assert.strictEqual(fields[6], ''); // Fecha pago vacía sin retención
    assert.strictEqual(fields[7], '0.00'); // Servicios
    assert.strictEqual(fields[8], '1000.00'); // Bienes (tipo 09 costo de venta, sin ITBIS)
    assert.strictEqual(fields[9], '1000.00'); // Total Monto Facturado sin ITBIS
    assert.strictEqual(fields[10], '180.00'); // ITBIS Facturado
    assert.strictEqual(fields[14], '180.00'); // ITBIS por Adelantar
    assert.strictEqual(fields[22], '01'); // Forma de pago
  } finally {
    tenantAny.findUnique = origTenantFindUnique;
    tenantAny.findFirst = origTenantFindFirst;
    rpAny.findMany = origRpFindMany;
    invAny.findMany = origInvFindMany;
  }

  console.log(
    '✓ Todos los tests de API Keys (HMAC-SHA256 + Pepper + timingSafeEqual), RNC DGII y Formato 606 oficial pasaron.'
  );
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('✗ Error en suite de tests:', err);
    process.exit(1);
  });
}
