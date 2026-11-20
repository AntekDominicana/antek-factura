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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  fillOfficialDgii606Xls,
  loadOfficialDgii606Template,
} = require('../fiscal/dgii-606-xls-template');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  DgiiDirectAdapter,
  EcfType,
  FiscalValidator,
  TaxCalculator,
} = require('@factura-ecf/fiscal-engine');

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
    const inspectGenerated606Xls = (xlsBuf: Buffer) => {
      assert.strictEqual(
        xlsBuf.subarray(0, 8).toString('hex').toUpperCase(),
        'D0CF11E0A1B11AE1'
      );
      const secSize = 1 << xlsBuf.readUInt16LE(30);
      const numFat = xlsBuf.readUInt32LE(44);
      const firstDir = xlsBuf.readUInt32LE(48);
      const fat: number[] = [];
      for (let i = 0; i < numFat; i++) {
        const fatSec = xlsBuf.readUInt32LE(76 + i * 4);
        const off = (fatSec + 1) * secSize;
        for (let j = 0; j < secSize / 4; j++) fat.push(xlsBuf.readUInt32LE(off + j * 4));
      }
      const readStream = (start: number, limit?: number) => {
        const parts: Buffer[] = [];
        let s = start;
        const seen = new Set<number>();
        while (s < 0xfffffffc && s !== 0xfffffffe) {
          assert.ok(!seen.has(s), 'Ciclo detectado en cadena FAT');
          seen.add(s);
          parts.push(xlsBuf.subarray((s + 1) * secSize, (s + 2) * secSize));
          s = fat[s];
        }
        const full = Buffer.concat(parts);
        return limit !== undefined ? full.subarray(0, limit) : full;
      };
      const dirBuf = readStream(firstDir);
      const dirNames: string[] = [];
      let wbStart = -1;
      let wbSize = 0;
      for (let off = 0; off < dirBuf.length; off += 128) {
        const nl = dirBuf.readUInt16LE(off + 64);
        if (nl <= 2) continue;
        const nm = dirBuf.subarray(off, off + nl - 2).toString('utf16le');
        dirNames.push(nm);
        if (nm === 'Workbook') {
          wbStart = dirBuf.readUInt32LE(off + 116);
          wbSize = dirBuf.readUInt32LE(off + 120);
        }
      }
      assert.ok(dirNames.includes('_VBA_PROJECT_CUR'), 'Debe preservar proyecto VBA');
      assert.ok(dirNames.includes('Ctls'), 'Debe preservar controles ActiveX/MSForms');
      assert.ok(wbStart >= 0 && wbSize > 0, 'Debe contener flujo Workbook');
      const wb = readStream(wbStart, wbSize);

      // Parse Globals
      const xfs: Buffer[] = [];
      let xfCrcRec: { cxfs: number; crc: number } | null = null;
      const boundSheets: Array<{ bof: number; name: string }> = [];
      const sstDataBlocks: Buffer[] = [];
      const sstChunkAbsStarts: number[] = [];
      let extSstBuf: Buffer | null = null;
      let pos = 0;
      let inSst = false;
      while (pos + 4 <= wb.length) {
        const id = wb.readUInt16LE(pos);
        const len = wb.readUInt16LE(pos + 2);
        const data = wb.subarray(pos + 4, pos + 4 + len);
        if (id === 0x00e0) xfs.push(data);
        if (id === 0x087c) xfCrcRec = { cxfs: data.readUInt16LE(14), crc: data.readUInt32LE(16) };
        if (id === 0x0085) {
          const bof = data.readUInt32LE(0);
          const cch = data[6];
          const nm =
            (data[7] & 1) !== 0
              ? data.subarray(8, 8 + cch * 2).toString('utf16le')
              : data.subarray(8, 8 + cch).toString('latin1');
          boundSheets.push({ bof, name: nm });
        }
        if (id === 0x00fc) {
          inSst = true;
          sstChunkAbsStarts.push(pos);
          sstDataBlocks.push(data);
        } else if (id === 0x003c && inSst) {
          sstChunkAbsStarts.push(pos);
          sstDataBlocks.push(data);
        } else {
          inSst = false;
        }
        if (id === 0x00ff) extSstBuf = data;
        pos += 4 + len;
        if (id === 0x000a) break;
      }

      assert.strictEqual(xfs.length, 188, 'Deben existir 177 XFs + 11 XFs blancos desbloqueados');
      for (let xi = 177; xi < 188; xi++) {
        assert.strictEqual(xfs[xi].readUInt16LE(4) & 1, 0, `XF ${xi} debe estar desbloqueado`);
        assert.strictEqual(
          (xfs[xi].readUInt32LE(14) >>> 26) & 0x3f,
          0,
          `XF ${xi} debe tener pattern=0`
        );
      }

      // Verificar XFCRC (MS-XLS CRC-32 poly 0xAF)
      const tbl = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = (i << 24) >>> 0;
        for (let k = 0; k < 8; k++) c = c & 0x80000000 ? ((c << 1) ^ 0x000000af) >>> 0 : (c << 1) >>> 0;
        tbl[i] = c;
      }
      let crc = 0;
      for (const xf of xfs) {
        for (let i = 0; i < xf.length; i++) crc = (tbl[((crc >>> 24) ^ xf[i]) & 0xff] ^ ((crc << 8) >>> 0)) >>> 0;
      }
      assert.strictEqual(xfCrcRec?.cxfs, 188);
      assert.strictEqual(xfCrcRec?.crc, crc, 'XFCRC debe coincidir exactamente');

      // Reconstruir SST strings y verificar EXTSST
      const sstJoined = Buffer.concat(sstDataBlocks);
      const uniqueStrCount = sstJoined.readUInt32LE(4);
      const sst: string[] = [];
      let sp = 8;
      for (let i = 0; i < uniqueStrCount; i++) {
        const cch = sstJoined.readUInt16LE(sp);
        const f = sstJoined[sp + 2];
        sp += 3;
        const bl = (f & 1) !== 0 ? cch * 2 : cch;
        sst.push(
          (f & 1) !== 0
            ? sstJoined.subarray(sp, sp + bl).toString('utf16le')
            : sstJoined.subarray(sp, sp + bl).toString('latin1')
        );
        sp += bl;
      }
      assert.ok(extSstBuf);
      assert.strictEqual(extSstBuf!.readUInt16LE(0), 8);
      assert.strictEqual((extSstBuf!.length - 2) / 8, Math.ceil(sst.length / 8));
      assert.strictEqual(extSstBuf!.readUInt32LE(2), sstChunkAbsStarts[0] + 12);

      // Verificar BOUNDSHEET -> BOF, INDEX -> DBCELL y celdas de Sheet 1
      assert.strictEqual(boundSheets.length, 2);
      boundSheets.forEach((bs) => {
        assert.strictEqual(wb.readUInt16LE(bs.bof), 0x0809, `${bs.name} debe iniciar en BOF`);
      });

      // Verificar INDEX y DBCELL exactos de Sheet 0 y Sheet 1 y extraer celdas de Sheet 1
      const s1Cells = new Map<string, { val: string | number; xf: number }>();
      boundSheets.forEach((bs, si) => {
        let p = bs.bof;
        let idxOffsets: number[] = [];
        let blockRows: number[] = [];
        const firstCellByRow = new Map<number, number>();
        let dbCounter = 0;
        while (p + 4 <= wb.length) {
          const id = wb.readUInt16LE(p);
          const len = wb.readUInt16LE(p + 2);
          const data = wb.subarray(p + 4, p + 4 + len);
          if (id === 0x020b) {
            idxOffsets = [];
            for (let k = 16; k + 4 <= len; k += 4) idxOffsets.push(data.readUInt32LE(k));
          } else if (id === 0x0208) {
            blockRows.push(p);
          } else if ([0x00fd, 0x027e, 0x0203, 0x0006, 0x0201, 0x00be, 0x00bd, 0x0204].includes(id)) {
            const r = data.readUInt16LE(0);
            const c = data.readUInt16LE(2);
            const xf = data.readUInt16LE(4);
            if (!firstCellByRow.has(r)) firstCellByRow.set(r, p);
            if (si === 1 && (r <= 6 || r === 11 || r === 510)) {
              if (id === 0x00fd) s1Cells.set(`${r},${c}`, { val: sst[data.readUInt32LE(6)], xf });
              else if (id === 0x0203) s1Cells.set(`${r},${c}`, { val: data.readDoubleLE(6), xf });
            }
          } else if (id === 0x00d7) {
            assert.strictEqual(idxOffsets[dbCounter], p, `Sheet ${si} INDEX[${dbCounter}] debe apuntar a DBCELL`);
            assert.strictEqual(data.readUInt32LE(0), p - blockRows[0], `Sheet ${si} dbRtrw exacto`);
            const rks = [...firstCellByRow.keys()].sort((a, b) => a - b);
            assert.strictEqual((len - 4) / 2, rks.length);
            let prev = blockRows.length > 1 ? blockRows[1] : blockRows[0] + 20;
            rks.forEach((rk, ri) => {
              const co = firstCellByRow.get(rk)!;
              assert.strictEqual(data.readUInt16LE(4 + ri * 2), co - prev);
              prev = co;
            });
            dbCounter++;
            blockRows = [];
            firstCellByRow.clear();
          }
          p += 4 + len;
          if (id === 0x000a) break;
        }
        assert.strictEqual(dbCounter, idxOffsets.length);
      });

      return { s1Cells, dirNames, wbSize };
    };

    const excel = await fiscalSvc.generateAccountantExcelReport('202611', 'tenant-1');
    assert.ok(excel.filename.startsWith('Formato-de-Envio-606-'));
    const parsed1 = inspectGenerated606Xls(excel.buffer);
    assert.strictEqual(parsed1.s1Cells.get('3,2')?.val, '131880738');
    assert.strictEqual(parsed1.s1Cells.get('4,2')?.val, '202611');
    assert.strictEqual(parsed1.s1Cells.get('5,2')?.val, 1);
    assert.strictEqual(parsed1.s1Cells.get('11,1')?.val, '101532483');
    assert.strictEqual(parsed1.s1Cells.get('11,1')?.xf, 177);
    assert.strictEqual(parsed1.s1Cells.get('11,2')?.val, 1);
    assert.strictEqual(
      parsed1.s1Cells.get('11,3')?.val,
      '09 -COMPRAS Y GASTOS QUE FORMARAN PARTE DEL COSTO DE VENTA '
    );
    assert.strictEqual(parsed1.s1Cells.get('11,4')?.val, 'E310000000045');
    assert.strictEqual(parsed1.s1Cells.get('11,6')?.val, '202611');
    assert.strictEqual(parsed1.s1Cells.get('11,7')?.val, '18');
    assert.strictEqual(parsed1.s1Cells.get('11,11')?.val, 1000);
    assert.strictEqual(parsed1.s1Cells.get('11,12')?.val, 1000);
    assert.strictEqual(parsed1.s1Cells.get('11,13')?.val, 180);
    assert.strictEqual(parsed1.s1Cells.get('11,17')?.val, 180);
    assert.strictEqual(parsed1.s1Cells.get('11,25')?.val, '01 - EFECTIVO');

    // Probar también con 0 filas y con 500 filas (forzando expansión FAT > 3328 sectores)
    const tplBuf = loadOfficialDgii606Template();
    const emptyXls = fillOfficialDgii606Xls(tplBuf, { rnc: '131880738', period: '202611', rows: [] });
    const parsed0 = inspectGenerated606Xls(emptyXls);
    assert.strictEqual(parsed0.s1Cells.get('5,2')?.val, 0);

    const manyRows = Array.from({ length: 500 }, (_, i) => ({
      rncCedula: '101532483',
      tipoId: 1,
      tipoGasto: '02',
      ncf: `E31${String(i + 1).padStart(10, '0')}`,
      fechaComprobante: '20261118',
      montoServicios: 250.5,
      montoBienes: 0,
      montoFacturado: 250.5,
      itbisFacturado: 45.09,
      itbisRetenido: 0,
      itbisProporcionalidad: 0,
      itbisLlevadoAlCosto: 0,
      itbisPorAdelantar: 45.09,
      itbisPercibido: 0,
      isrRetenido: 0,
      isrPercibido: 0,
      isc: 0,
      otrosImpuestos: 0,
      propinaLegal: 0,
      formaPagoCode: '02',
    }));
    const bigXls = fillOfficialDgii606Xls(tplBuf, { rnc: '131880738', period: '202611', rows: manyRows });
    const parsed500 = inspectGenerated606Xls(bigXls);
    assert.strictEqual(parsed500.s1Cells.get('5,2')?.val, 500);
    assert.strictEqual(parsed500.s1Cells.get('510,4')?.val, 'E310000000500');
    assert.strictEqual(parsed500.s1Cells.get('510,10')?.val, 250.5);
    assert.strictEqual(parsed500.s1Cells.get('510,25')?.val, '02 - CHEQUES/TRANSFERENCIAS/DEPÓSITO');

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

  // =========================================================================
  // 5. Validación y Firma XMLDSig de e-CF 45 (Gubernamental Electrónico)
  // =========================================================================
  const draft45: any = {
    rncEmisor: '131880738',
    razonSocialEmisor: 'ANTEK DOMINICANA SRL',
    tipoEcf: EcfType.GUBERNAMENTAL,
    encf: 'E450000000001',
    fechaEmision: new Date(),
    indicadorMontoGravado: 0,
    tipoIngresos: '01',
    tipoPago: 1,
    formaPago: 1,
    comprador: {
      rncComprador: '401506254',
      razonSocialComprador: 'MINISTERIO DE HACIENDA',
    },
    items: [
      {
        numeroLinea: 1,
        indicadorBienServicio: 2,
        indicadorFacturacion: 1,
        nombreItem: 'Servicios tecnológicos institucionales',
        cantidadItem: 1,
        precioUnitarioItem: 1000,
      },
    ],
  };

  const calc45 = TaxCalculator.calculateInvoice(draft45);
  const enriched45 = {
    ...draft45,
    items: calc45.items,
    totalesCalculados: calc45.totales,
  };
  FiscalValidator.validate(enriched45);
  assert.strictEqual(calc45.totales.montoTotal, 1180);

  const dgiiAdapter = new DgiiDirectAdapter();
  dgiiAdapter.setLiveTransmission(false);
  const emitted45 = await dgiiAdapter.emitInvoice(
    {
      rnc: '131880738',
      environment: 'SANDBOX',
      legalName: 'ANTEK DOMINICANA SRL',
    },
    enriched45,
    { returnXml: 1 }
  );
  assert.ok(emitted45.xmlSigned && emitted45.xmlSigned.includes('<TipoeCF>45</TipoeCF>'));
  assert.ok(emitted45.xmlSigned && emitted45.xmlSigned.includes('<eNCF>E450000000001</eNCF>'));
  assert.strictEqual(String(emitted45.codigoSeguridad || '').length, 6);
  assert.ok(String(emitted45.urlQr || '').includes('E450000000001'));

  console.log(
    '✓ Todos los tests de API Keys (HMAC-SHA256 + Pepper + timingSafeEqual), RNC DGII, Formato 606 oficial y e-CF 45 Gubernamental pasaron.'
  );
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('✗ Error en suite de tests:', err);
    process.exit(1);
  });
}
