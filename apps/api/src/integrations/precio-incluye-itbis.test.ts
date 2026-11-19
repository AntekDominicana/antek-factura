import * as assert from 'assert';
import {
  DgiiDirectAdapter,
  FiscalValidator,
  GtiMapper,
  TaxCalculator,
} from '@factura-ecf/fiscal-engine';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test?schema=public';
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('@factura-ecf/database');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { IntegrationsService } = require('./integrations.service');

async function runTests() {
  const emittedMockCalls: number[] = [];

  const mockFiscalService: any = {
    async emitInvoice(domainInvoice: any) {
      emittedMockCalls.push(1);
      // Simular latencia real de firma/envío DGII para provocar carrera concurrente
      await new Promise((r) => setTimeout(r, 220));
      const { totales } = TaxCalculator.calculateInvoice(domainInvoice);
      return {
        id: 'inv-concurrent-test-001',
        encf: 'E320000000999',
        status: 'ACCEPTED',
        urlQr: 'https://fc.dgii.gov.do/test-qr',
        invoice: {
          id: 'inv-concurrent-test-001',
          encf: 'E320000000999',
          status: 'ACCEPTED',
          totales,
          urlQr: 'https://fc.dgii.gov.do/test-qr',
          fechaEmision: '2026-11-19',
        },
      };
    },
    async getInvoiceById(id: string) {
      return {
        id,
        encf: 'E320000000999',
        status: 'ACCEPTED',
        totales: { montoTotal: 3232.5, totalItbis: 493.1 },
        urlQr: 'https://fc.dgii.gov.do/test-qr',
        fechaEmision: '2026-11-19',
      };
    },
  };

  const mockBillingService: any = {
    async checkEmissionAllowed() {
      return true;
    },
    async incrementUsage() {
      return 1;
    },
  };

  const mockCryptoService: any = {
    hashSha256: (s: string) => s,
    encrypt: (s: string) => s,
    decrypt: (s: string) => s,
  };

  const mockCacheService: any = {
    get: async () => null,
    set: async () => undefined,
    del: async () => undefined,
  };

  const mockSecurityShield: any = {
    async withSequenceLock(_key: string, fn: () => Promise<any>) {
      return fn();
    },
  };

  const service = new IntegrationsService(
    mockFiscalService,
    mockBillingService,
    mockCryptoService,
    mockCacheService,
    mockSecurityShield
  );

  // Evitar DDL real contra red en test unitario
  (service as any).ddlReady = true;

  // ---------------------------------------------------------------------------
  // 1. Casos individuales con precio_incluye_itbis = true (ITBIS 18%)
  // ---------------------------------------------------------------------------
  const line1 = service.calculateTaxInclusiveLine({
    descripcion: 'Artículo A (10 x 85.00)',
    cantidad: 10,
    precio_unitario: 85,
    itbis_tasa: 18,
  });
  assert.strictEqual(line1.total_linea, 850.0);
  assert.strictEqual(line1.base_linea, 720.34);
  assert.strictEqual(line1.itbis_linea, 129.66);
  assert.strictEqual(
    Math.round((line1.base_linea + line1.itbis_linea) * 100) / 100,
    line1.total_linea
  );
  assert.strictEqual(line1.precio_unitario_sin_itbis, 72.03);
  assert.strictEqual(line1.recargoMonto, 0.04);
  assert.strictEqual(line1.descuentoMonto, 0);
  assert.strictEqual(line1.montoItem, 720.34);

  const line2 = service.calculateTaxInclusiveLine({
    descripcion: 'Artículo B (3 x 625.00)',
    cantidad: 3,
    precio_unitario: 625,
    itbis_tasa: 18,
  });
  assert.strictEqual(line2.total_linea, 1875.0);
  assert.strictEqual(line2.base_linea, 1588.98);
  assert.strictEqual(line2.itbis_linea, 286.02);
  assert.strictEqual(
    Math.round((line2.base_linea + line2.itbis_linea) * 100) / 100,
    line2.total_linea
  );
  assert.strictEqual(line2.precio_unitario_sin_itbis, 529.66);
  assert.strictEqual(line2.montoItem, 1588.98);

  const line3 = service.calculateTaxInclusiveLine({
    descripcion: 'Artículo C (7 x 72.50)',
    cantidad: 7,
    precio_unitario: 72.5,
    itbis_tasa: 18,
  });
  assert.strictEqual(line3.total_linea, 507.5);
  assert.strictEqual(line3.base_linea, 430.08);
  assert.strictEqual(line3.itbis_linea, 77.42);
  assert.strictEqual(
    Math.round((line3.base_linea + line3.itbis_linea) * 100) / 100,
    line3.total_linea
  );
  assert.strictEqual(line3.precio_unitario_sin_itbis, 61.44);
  assert.strictEqual(line3.montoItem, 430.08);

  // ---------------------------------------------------------------------------
  // 2. Comprobante combinado, validación DGII e XML firmado
  // ---------------------------------------------------------------------------
  const payloadInclusive = service.validatePublicInvoiceInput({
    external_id: 'POS-TEST-INCLUSIVE-001',
    tipo_ecf: 32,
    precio_incluye_itbis: true,
    items: [
      { descripcion: 'Producto 10x85', cantidad: 10, precio_unitario: 85, itbis_tasa: 18 },
      { descripcion: 'Producto 3x625', cantidad: 3, precio_unitario: 625, itbis_tasa: 18 },
      { descripcion: 'Producto 7x72.50', cantidad: 7, precio_unitario: 72.5, itbis_tasa: 18 },
    ],
    forma_pago: 'tarjeta',
  });

  const domainInclusive = service.toDomainInvoice(payloadInclusive);
  const { items: calcItems, totales } = TaxCalculator.calculateInvoice(domainInclusive);
  domainInclusive.totalesCalculados = totales;

  assert.strictEqual(totales.montoGravadoTotal, 2739.4);
  assert.strictEqual(totales.totalItbis, 493.1);
  assert.strictEqual(totales.montoTotal, 3232.5); // 850 + 1875 + 507.50 exacto
  assert.strictEqual(calcItems[0].montoItem, 720.34);
  assert.strictEqual(calcItems[1].montoItem, 1588.98);
  assert.strictEqual(calcItems[2].montoItem, 430.08);

  FiscalValidator.validate(domainInclusive);

  const gtiPayload = GtiMapper.toGtiPayload(domainInclusive);
  assert.strictEqual(gtiPayload.DetallesItems[0].RecargoMonto, 0.04);
  assert.strictEqual(gtiPayload.DetallesItems[0].MontoItem, 720.34);
  assert.strictEqual(gtiPayload.Encabezado.Totales.MontoTotal, 3232.5);
  assert.strictEqual(gtiPayload.Encabezado.Totales.TotalITBIS, 493.1);

  const adapter = new DgiiDirectAdapter({ liveDgiiTransmission: false });
  domainInclusive.encf = 'E320000000001';
  domainInclusive.emisor = {
    rnc: '131880738',
    razonSocial: 'ANTEK DOMINICANA SRL',
    direccion: 'Santo Domingo, RD',
  };
  const built = adapter.buildEcfXml(
    { rnc: '131880738', environment: 'SANDBOX' },
    domainInclusive
  );
  assert.ok(built.xml.includes('<RecargoMonto>0.04</RecargoMonto>'));
  assert.ok(built.xml.includes('<MontoItem>720.34</MontoItem>'));
  assert.ok(built.xml.includes('<TotalITBIS>493.10</TotalITBIS>'));
  assert.ok(built.xml.includes('<MontoTotal>3232.50</MontoTotal>'));

  // Verificar descuento porcentual cuando precio_incluye_itbis = true
  const lineWithDiscount = service.calculateTaxInclusiveLine({
    descripcion: 'Combo 10% desc',
    cantidad: 2,
    precio_unitario: 100,
    itbis_tasa: 18,
    descuento: 10,
  });
  assert.strictEqual(lineWithDiscount.total_linea, 180.0);
  assert.strictEqual(lineWithDiscount.base_linea, 152.54);
  assert.strictEqual(lineWithDiscount.itbis_linea, 27.46);
  assert.strictEqual(
    Math.round((lineWithDiscount.base_linea + lineWithDiscount.itbis_linea) * 100) / 100,
    180.0
  );

  // ---------------------------------------------------------------------------
  // 3. Caso default precio_incluye_itbis = false no altera comportamiento actual
  // ---------------------------------------------------------------------------
  const payloadExclusive = service.validatePublicInvoiceInput({
    external_id: 'POS-TEST-EXCLUSIVE-001',
    tipo_ecf: 32,
    items: [{ descripcion: 'Producto Base', cantidad: 10, precio_unitario: 85, itbis_tasa: 18 }],
    forma_pago: 'efectivo',
  });
  assert.strictEqual(payloadExclusive.precio_incluye_itbis, false);
  const domainExclusive = service.toDomainInvoice(payloadExclusive);
  const resExclusive = TaxCalculator.calculateInvoice(domainExclusive);
  assert.strictEqual(resExclusive.totales.montoGravadoTotal, 850.0);
  assert.strictEqual(resExclusive.totales.totalItbis, 153.0);
  assert.strictEqual(resExclusive.totales.montoTotal, 1003.0);

  // ---------------------------------------------------------------------------
  // 4. Idempotencia concurrente vía llave única (empresa_id, origen, external_id)
  // ---------------------------------------------------------------------------
  const store = new Map<string, any>();
  const externalSaleAny = prisma.externalSale as any;
  const origCreate = externalSaleAny.create;
  const origFindUnique = externalSaleAny.findUnique;
  const origUpdate = externalSaleAny.update;
  const origUpdateMany = externalSaleAny.updateMany;

  externalSaleAny.create = async ({ data }: any) => {
    const k = `${data.tenantId}:${data.origen}:${data.externalId}`;
    if (store.has(k)) {
      const dupErr: any = new Error('Unique constraint failed on the constraint');
      dupErr.code = 'P2002';
      throw dupErr;
    }
    const row = { id: 'sale-1', ...data };
    store.set(k, row);
    return row;
  };
  externalSaleAny.findUnique = async ({ where }: any) => {
    const u = where.empresa_origen_external_unique;
    return store.get(`${u.tenantId}:${u.origen}:${u.externalId}`) || null;
  };
  externalSaleAny.update = async ({ where, data }: any) => {
    for (const [k, v] of store.entries()) {
      if (v.id === where.id) {
        const next = { ...v, ...data };
        store.set(k, next);
        return next;
      }
    }
    return null;
  };
  externalSaleAny.updateMany = async ({ where, data }: any) => {
    for (const [k, v] of store.entries()) {
      if (v.id === where.id && v.estado === where.estado) {
        store.set(k, { ...v, ...data });
        return { count: 1 };
      }
    }
    return { count: 0 };
  };

  try {
    const concurrentBody = {
      external_id: 'RACE-ORDER-777',
      tipo_ecf: 32,
      precio_incluye_itbis: true,
      items: [
        { descripcion: 'Item 10x85', cantidad: 10, precio_unitario: 85, itbis_tasa: 18 },
        { descripcion: 'Item 3x625', cantidad: 3, precio_unitario: 625, itbis_tasa: 18 },
        { descripcion: 'Item 7x72.50', cantidad: 7, precio_unitario: 72.5, itbis_tasa: 18 },
      ],
      forma_pago: 'efectivo',
    };

    const [r1, r2] = await Promise.all([
      service.emitExternalInvoice('tenant-race', 'pos', concurrentBody, true),
      service.emitExternalInvoice('tenant-race', 'pos', concurrentBody, true),
    ]);

    const codes = [r1.statusCode, r2.statusCode].sort();
    assert.deepStrictEqual(codes, [200, 201]);
    assert.strictEqual(emittedMockCalls.length, 1);
    assert.strictEqual(r1.data.encf, r2.data.encf);
    assert.strictEqual(r1.data.id, r2.data.id);
    assert.strictEqual(r1.data.total, 3232.5);
  } finally {
    externalSaleAny.create = origCreate;
    externalSaleAny.findUnique = origFindUnique;
    externalSaleAny.update = origUpdate;
    externalSaleAny.updateMany = origUpdateMany;
  }

  console.log('✓ Todos los tests de precio_incluye_itbis e idempotencia concurrente pasaron.');
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('✗ Error en test:', err);
    process.exit(1);
  });
}
