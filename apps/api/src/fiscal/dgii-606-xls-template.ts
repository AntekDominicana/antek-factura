import * as fs from 'fs';
import * as path from 'path';

export interface OfficialDgii606Row {
  rncCedula: string;
  tipoId: number;
  tipoGasto: string;
  ncf: string;
  ncfModificado?: string;
  fechaComprobante: string;
  fechaPago?: string;
  montoServicios: string | number;
  montoBienes: string | number;
  montoFacturado: string | number;
  itbisFacturado: string | number;
  itbisRetenido: string | number;
  itbisProporcionalidad: string | number;
  itbisLlevadoAlCosto: string | number;
  itbisPorAdelantar: string | number;
  itbisPercibido: string | number;
  tipoRetencionIsr?: string;
  isrRetenido: string | number;
  isrPercibido: string | number;
  isc: string | number;
  otrosImpuestos: string | number;
  propinaLegal: string | number;
  formaPagoCode?: string;
  formaPago?: number | string;
}

export interface OfficialDgii606Input {
  rnc: string;
  period: string;
  rows: OfficialDgii606Row[];
}

const TEMPLATE_FILENAME = 'Formato-de-Envio-606-(NG-07-2018-y-05-2019).xls';

const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;
const FATSECT = 0xfffffffd;
const DIFSECT = 0xfffffffc;

const BIFF_EOF = 0x000a;
const BIFF_BOUNDSHEET = 0x0085;
const BIFF_XF = 0x00e0;
const BIFF_XFCRC = 0x087c;
const BIFF_SST = 0x00fc;
const BIFF_CONTINUE = 0x003c;
const BIFF_EXTSST = 0x00ff;
const BIFF_INDEX = 0x020b;
const BIFF_ROW = 0x0208;
const BIFF_DBCELL = 0x00d7;
const BIFF_LABELSST = 0x00fd;
const BIFF_NUMBER = 0x0203;
const BIFF_RK = 0x027e;
const BIFF_BLANK = 0x0201;
const BIFF_MULBLANK = 0x00be;
const BIFF_MULRK = 0x00bd;
const BIFF_FORMULA = 0x0006;
const BIFF_LABEL = 0x0204;

// Valores exactos de las listas desplegables del archivo oficial DGII 606 (SST 0..85)
const TIPO_BIENES_OFFICIAL: Record<string, string> = {
  '01': '01-GASTOS DE PERSONAL ',
  '02': '02-GASTOS POR TRABAJOS, SUMINISTROS Y SERVICIOS ',
  '03': '03-ARRENDAMIENTOS ',
  '04': '04-GASTOS DE ACTIVOS FIJO ',
  '05': '05 -GASTOS DE REPRESENTACIÓN ',
  '06': '06 -OTRAS DEDUCCIONES ADMITIDAS ',
  '07': '07 -GASTOS FINANCIEROS ',
  '08': '08 -GASTOS EXTRAORDINARIOS ',
  '09': '09 -COMPRAS Y GASTOS QUE FORMARAN PARTE DEL COSTO DE VENTA ',
  '10': '10 -ADQUISICIONES DE ACTIVOS ',
  '11': '11- GASTOS DE SEGUROS',
};

const FORMA_PAGO_OFFICIAL: Record<string, string> = {
  '01': '01 - EFECTIVO',
  '02': '02 - CHEQUES/TRANSFERENCIAS/DEPÓSITO',
  '03': '03 - TARJETA CRÉDITO/DÉBITO',
  '04': '04 - COMPRA A CREDITO',
  '05': '05 -\u00a0 PERMUTA',
  '06': '06 - NOTA DE CREDITO',
  '07': '07 - MIXTO',
};

const TIPO_RETENCION_OFFICIAL: Record<string, string> = {
  '01': '01 - ALQUILERES',
  '02': '02 - HONORARIOS POR SERVICIOS',
  '03': '03 - OTRAS RENTAS',
  '04': '04 - OTRAS RENTAS (Rentas Presuntas)',
  '05': '05 - INTERESES PAGADOS A PERSONAS JURIDICAS RESIDENTES',
  '06': '06 - INTERESES PAGADOS A PERSONAS FISICAS RESIDENTES',
  '07': '07 - RETENCION POR PROVEEDORES DEL ESTADO',
  '08': '08 - JUEGOS TELEFONICOS',
  '09': '09 - RETENCIONES SUBSECTOR DE GANADERÍA DE CARNE BOVINA',
};

// Los 11 XF únicos de la fila 12 bloqueada (color gris 48), clonados a blanco desbloqueado (pat=0, locked=false)
const SOURCE_XF_FOR_WHITE = [104, 105, 106, 144, 145, 108, 109, 110, 111, 143, 117] as const;

let cachedTemplateBuf: Buffer | null = null;

/**
 * Carga y cachea en memoria la plantilla oficial en blanco DGII Formato 606 (.xls).
 */
export function loadOfficialDgii606Template(): Buffer {
  if (cachedTemplateBuf) return cachedTemplateBuf;

  const candidates = [
    path.resolve(__dirname, '../../assets/templates', TEMPLATE_FILENAME),
    path.resolve(process.cwd(), 'apps/api/assets/templates', TEMPLATE_FILENAME),
    path.resolve(process.cwd(), 'assets/templates', TEMPLATE_FILENAME),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      cachedTemplateBuf = fs.readFileSync(candidate);
      return cachedTemplateBuf;
    }
  }

  throw new Error(
    `No se encontró la plantilla oficial DGII Formato 606 (${TEMPLATE_FILENAME}). Rutas buscadas: ${candidates.join(', ')}`
  );
}

// Tabla precomputada CRC-32 MS-XLS (no reflejada, polinomio 0x000000AF) para validar XFCRC
const MS_XLS_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  const poly = 0x000000af;
  for (let i = 0; i < 256; i++) {
    let c = (i << 24) >>> 0;
    for (let k = 0; k < 8; k++) {
      c = (c & 0x80000000) !== 0 ? (((c << 1) ^ poly) >>> 0) : ((c << 1) >>> 0);
    }
    table[i] = c;
  }
  return table;
})();

function computeXfCrc32(xfPayloads: Buffer[]): number {
  let crc = 0;
  for (const buf of xfPayloads) {
    for (let i = 0; i < buf.length; i++) {
      crc = (MS_XLS_CRC_TABLE[((crc >>> 24) ^ buf[i]) & 0xff] ^ ((crc << 8) >>> 0)) >>> 0;
    }
  }
  return crc >>> 0;
}

function makeBiffRecord(recId: number, payload: Buffer): Buffer {
  const out = Buffer.allocUnsafe(4 + payload.length);
  out.writeUInt16LE(recId, 0);
  out.writeUInt16LE(payload.length, 2);
  payload.copy(out, 4);
  return out;
}

function makeLabelSst(rw: number, col: number, ixfe: number, isst: number): Buffer {
  const p = Buffer.allocUnsafe(10);
  p.writeUInt16LE(rw, 0);
  p.writeUInt16LE(col, 2);
  p.writeUInt16LE(ixfe, 4);
  p.writeUInt32LE(isst, 6);
  return makeBiffRecord(BIFF_LABELSST, p);
}

function makeNumber(rw: number, col: number, ixfe: number, value: number): Buffer {
  const p = Buffer.allocUnsafe(14);
  p.writeUInt16LE(rw, 0);
  p.writeUInt16LE(col, 2);
  p.writeUInt16LE(ixfe, 4);
  p.writeDoubleLE(value, 6);
  return makeBiffRecord(BIFF_NUMBER, p);
}

function makeBlank(rw: number, col: number, ixfe: number): Buffer {
  const p = Buffer.allocUnsafe(6);
  p.writeUInt16LE(rw, 0);
  p.writeUInt16LE(col, 2);
  p.writeUInt16LE(ixfe, 4);
  return makeBiffRecord(BIFF_BLANK, p);
}

function cloneXfAsWhiteUnlocked(origPayload: Buffer): Buffer {
  const clone = Buffer.from(origPayload);
  // typeProt (bytes 4..5): limpiar bit 0 (locked = false)
  const typeProt = clone.readUInt16LE(4) & ~0x0001;
  clone.writeUInt16LE(typeProt, 4);
  // fillPattern (bits 26..31 de UInt32 en bytes 14..17): pattern = 0 (sin relleno gris)
  const usedFill = clone.readUInt32LE(14) & 0x03ffffff;
  clone.writeUInt32LE(usedFill >>> 0, 14);
  // colors (bytes 18..19): fg=64 (default), bg=65 (default window background)
  clone.writeUInt16LE((65 << 7) | 64, 18);
  return clone;
}

function parseSstStrings(sstDataBlocks: Buffer[]): { totalStrings: number; strings: string[] } {
  const combined = Buffer.concat(sstDataBlocks);
  const totalStrings = combined.readUInt32LE(0);
  const uniqueStrings = combined.readUInt32LE(4);
  const strings: string[] = [];

  let globalOffset = 8;
  for (let i = 0; i < uniqueStrings && globalOffset + 3 <= combined.length; i++) {
    const cch = combined.readUInt16LE(globalOffset);
    const flags = combined[globalOffset + 2];
    globalOffset += 3;
    const isUtf16 = (flags & 1) !== 0;
    const hasExt = (flags & 4) !== 0;
    const hasRich = (flags & 8) !== 0;
    const rt = hasRich ? (globalOffset += 2, combined.readUInt16LE(globalOffset - 2)) : 0;
    const extLen = hasExt ? (globalOffset += 4, combined.readUInt32LE(globalOffset - 4)) : 0;
    const byteLen = isUtf16 ? cch * 2 : cch;
    const str = isUtf16
      ? combined.subarray(globalOffset, globalOffset + byteLen).toString('utf16le')
      : combined.subarray(globalOffset, globalOffset + byteLen).toString('latin1');
    globalOffset += byteLen + rt * 4 + extLen;
    strings.push(str);
  }

  return { totalStrings, strings };
}

function encodeBiff8String(str: string): Buffer {
  let needsUtf16 = false;
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 0xff) {
      needsUtf16 = true;
      break;
    }
  }
  const cch = str.length;
  const charBuf = Buffer.from(str, needsUtf16 ? 'utf16le' : 'latin1');
  const out = Buffer.allocUnsafe(3 + charBuf.length);
  out.writeUInt16LE(cch, 0);
  out[2] = needsUtf16 ? 1 : 0;
  charBuf.copy(out, 3);
  return out;
}

function serializeSstAndExtSst(
  sstStreamStartOffset: number,
  totalStrings: number,
  strings: string[]
): { sstRecords: Buffer; extSstRecord: Buffer } {
  const MAX_REC_PAYLOAD = 8220;
  const DSST = 8;

  const chunks: Array<{ recId: number; buf: Buffer; used: number }> = [
    { recId: BIFF_SST, buf: Buffer.allocUnsafe(MAX_REC_PAYLOAD), used: 8 },
  ];
  chunks[0].buf.writeUInt32LE(totalStrings >>> 0, 0);
  chunks[0].buf.writeUInt32LE(strings.length >>> 0, 4);

  const extEntries: Array<{ streamOff: number; recOff: number }> = [];
  let runningStreamPos = sstStreamStartOffset;

  for (let i = 0; i < strings.length; i++) {
    const encoded = encodeBiff8String(strings[i]);
    let cur = chunks[chunks.length - 1];
    if (cur.used + encoded.length > MAX_REC_PAYLOAD) {
      runningStreamPos += 4 + cur.used;
      cur = { recId: BIFF_CONTINUE, buf: Buffer.allocUnsafe(MAX_REC_PAYLOAD), used: 0 };
      chunks.push(cur);
    }
    if (i % DSST === 0) {
      extEntries.push({
        streamOff: runningStreamPos + 4 + cur.used,
        recOff: 4 + cur.used,
      });
    }
    encoded.copy(cur.buf, cur.used);
    cur.used += encoded.length;
  }

  const sstRecords = Buffer.concat(
    chunks.map((c) => makeBiffRecord(c.recId, c.buf.subarray(0, c.used)))
  );

  const extPayload = Buffer.alloc(2 + extEntries.length * 8);
  extPayload.writeUInt16LE(DSST, 0);
  extEntries.forEach((e, idx) => {
    const base = 2 + idx * 8;
    extPayload.writeUInt32LE(e.streamOff >>> 0, base);
    extPayload.writeUInt16LE(e.recOff, base + 4);
    extPayload.writeUInt16LE(0, base + 6);
  });

  return { sstRecords, extSstRecord: makeBiffRecord(BIFF_EXTSST, extPayload) };
}

interface Ole2WorkbookContext {
  sectorSize: number;
  header: Buffer;
  sectors: Buffer[];
  fat: number[];
  difatSectors: number[];
  dirSectors: number[];
  wbDirEntryOffsetInDirStream: number;
  wbSectorChain: number[];
  wbStream: Buffer;
}

function parseOle2Workbook(templateBuf: Buffer): Ole2WorkbookContext {
  const sectorSize = 1 << templateBuf.readUInt16LE(30);
  const header = Buffer.from(templateBuf.subarray(0, sectorSize));
  const totalSectors = Math.floor((templateBuf.length - sectorSize) / sectorSize);
  const sectors: Buffer[] = new Array(totalSectors);
  for (let i = 0; i < totalSectors; i++) {
    const start = (i + 1) * sectorSize;
    sectors[i] = Buffer.from(templateBuf.subarray(start, start + sectorSize));
  }

  const difatSectors: number[] = [];
  for (let i = 0; i < 109; i++) {
    const s = header.readUInt32LE(76 + i * 4);
    if (s < DIFSECT) difatSectors.push(s);
  }
  // Soporte DIFAT extendido si un libro creciera más de 109 sectores FAT
  let difatSec = header.readUInt32LE(68);
  while (difatSec < DIFSECT && difatSec !== ENDOFCHAIN) {
    const sb = sectors[difatSec];
    const entriesPerDifat = sectorSize / 4 - 1;
    for (let i = 0; i < entriesPerDifat; i++) {
      const s = sb.readUInt32LE(i * 4);
      if (s < DIFSECT) difatSectors.push(s);
    }
    difatSec = sb.readUInt32LE(entriesPerDifat * 4);
  }

  const fat: number[] = [];
  for (const s of difatSectors) {
    const sb = sectors[s];
    for (let i = 0; i < sectorSize / 4; i++) {
      fat.push(sb.readUInt32LE(i * 4));
    }
  }

  const getChain = (startSec: number): number[] => {
    const chain: number[] = [];
    let s = startSec;
    const seen = new Set<number>();
    while (s < DIFSECT && s !== ENDOFCHAIN && !seen.has(s)) {
      seen.add(s);
      chain.push(s);
      s = fat[s];
    }
    return chain;
  };

  const firstDirSector = header.readUInt32LE(48);
  const dirSectors = getChain(firstDirSector);
  const dirStream = Buffer.concat(dirSectors.map((s) => sectors[s]));

  let wbDirEntryOffsetInDirStream = -1;
  let wbStart = 0;
  let wbSize = 0;
  for (let off = 0; off < dirStream.length; off += 128) {
    const nl = dirStream.readUInt16LE(off + 64);
    if (nl <= 2) continue;
    const name = dirStream.subarray(off, off + nl - 2).toString('utf16le');
    if (name === 'Workbook' || name === 'Book') {
      wbDirEntryOffsetInDirStream = off;
      wbStart = dirStream.readUInt32LE(off + 116);
      wbSize = dirStream.readUInt32LE(off + 120);
      break;
    }
  }

  if (wbDirEntryOffsetInDirStream < 0) {
    throw new Error('La plantilla DGII 606 no contiene el flujo BIFF Workbook.');
  }

  const wbSectorChain = getChain(wbStart);
  const wbStream = Buffer.concat(wbSectorChain.map((s) => sectors[s])).subarray(0, wbSize);

  return {
    sectorSize,
    header,
    sectors,
    fat,
    difatSectors,
    dirSectors,
    wbDirEntryOffsetInDirStream,
    wbSectorChain,
    wbStream,
  };
}

function replaceWorkbookStreamInOle2(ctx: Ole2WorkbookContext, newWbStream: Buffer): Buffer {
  const { sectorSize, header, sectors, fat, difatSectors, dirSectors, wbSectorChain } = ctx;
  const entriesPerFat = sectorSize / 4;
  const neededSectors = Math.ceil(newWbStream.length / sectorSize);

  const allocateSector = (fatValue: number): number => {
    const newIdx = sectors.length;
    sectors.push(Buffer.alloc(sectorSize));
    while (newIdx >= fat.length) {
      // Crear un nuevo sector FAT y registrarlo en header DIFAT (soporta hasta 109 FAT = ~7 MB)
      const newFatSectorIdx = sectors.length;
      sectors.push(Buffer.alloc(sectorSize, 0xff));
      const newFatIndex = difatSectors.length;
      if (newFatIndex >= 109) {
        throw new Error('El libro Excel excede la capacidad DIFAT de cabecera.');
      }
      difatSectors.push(newFatSectorIdx);
      header.writeUInt32LE(newFatSectorIdx >>> 0, 76 + newFatIndex * 4);
      header.writeUInt32LE(difatSectors.length >>> 0, 44);
      for (let i = 0; i < entriesPerFat; i++) {
        fat.push(FREESECT);
      }
      fat[newFatSectorIdx] = FATSECT;
    }
    fat[newIdx] = fatValue;
    return newIdx;
  };

  const newChain = wbSectorChain.slice(0, neededSectors);
  while (newChain.length < neededSectors) {
    const nextSec = allocateSector(ENDOFCHAIN);
    if (newChain.length > 0) {
      fat[newChain[newChain.length - 1]] = nextSec;
    }
    newChain.push(nextSec);
  }

  // Enlazar la cadena exacta y liberar sectores sobrantes si existieran
  for (let i = 0; i < newChain.length; i++) {
    fat[newChain[i]] = i + 1 < newChain.length ? newChain[i + 1] : ENDOFCHAIN;
  }
  for (let i = neededSectors; i < wbSectorChain.length; i++) {
    fat[wbSectorChain[i]] = FREESECT;
  }

  // Escribir el contenido completo del flujo Workbook en sus sectores
  for (let i = 0; i < newChain.length; i++) {
    const secBuf = Buffer.alloc(sectorSize);
    const sliceStart = i * sectorSize;
    const sliceEnd = Math.min(newWbStream.length, sliceStart + sectorSize);
    if (sliceEnd > sliceStart) {
      newWbStream.copy(secBuf, 0, sliceStart, sliceEnd);
    }
    sectors[newChain[i]] = secBuf;
  }

  // Actualizar el tamaño del Workbook en la entrada correspondiente del directorio OLE2
  const dirEntrySecIdx = Math.floor(ctx.wbDirEntryOffsetInDirStream / sectorSize);
  const dirEntryOffInSec = ctx.wbDirEntryOffsetInDirStream % sectorSize;
  const dirTargetSec = dirSectors[dirEntrySecIdx];
  const updatedDirSec = Buffer.from(sectors[dirTargetSec]);
  updatedDirSec.writeUInt32LE(newChain[0] >>> 0, dirEntryOffInSec + 116);
  updatedDirSec.writeUInt32LE(newWbStream.length >>> 0, dirEntryOffInSec + 120);
  sectors[dirTargetSec] = updatedDirSec;

  // Volcar FAT actualizada a los sectores FAT
  for (let fIdx = 0; fIdx < difatSectors.length; fIdx++) {
    const fatSecBuf = Buffer.allocUnsafe(sectorSize);
    const base = fIdx * entriesPerFat;
    for (let j = 0; j < entriesPerFat; j++) {
      const val = base + j < fat.length ? fat[base + j] : FREESECT;
      fatSecBuf.writeUInt32LE(val >>> 0, j * 4);
    }
    sectors[difatSectors[fIdx]] = fatSecBuf;
  }

  return Buffer.concat([header, ...sectors]);
}

function toTwoDigit(val: string | undefined, fallback = ''): string {
  const digits = String(val || '').replace(/\D/g, '');
  if (!digits) return fallback;
  return digits.padStart(2, '0').slice(-2);
}

function parseYmd(rawDate: string | undefined, fallbackPeriod: string): { ym: string; day: string } {
  const digits = String(rawDate || '').replace(/\D/g, '');
  if (digits.length >= 8) {
    return { ym: digits.slice(0, 6), day: digits.slice(6, 8) };
  }
  if (digits.length === 6) {
    return { ym: digits, day: '' };
  }
  return { ym: fallbackPeriod, day: '' };
}

function round2(n: unknown): number {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Rellena en memoria (RAM) el libro oficial Excel DGII Formato 606 (.xls Versión 2025)
 * conservando íntegramente el logo de la DGII, listas desplegables, botones y macros VBA.
 * No guarda ningún archivo por usuario en disco.
 */
export function fillOfficialDgii606Xls(
  templateBuf: Buffer,
  input: OfficialDgii606Input
): Buffer {
  const ctx = parseOle2Workbook(templateBuf);
  const wb = ctx.wbStream;

  const cleanRnc = String(input.rnc || '').replace(/\D/g, '');
  const cleanPeriod = String(input.period || '').replace(/\D/g, '').slice(0, 6);
  const activeRows = (input.rows || []).slice(0, 10000);

  // 1. Inspeccionar Globals para ubicar BoundSheet offsets, XFs, SST y ExtSST
  let pos = 0;
  const boundSheetBofs: number[] = [];
  const origXfPayloads: Buffer[] = [];
  const sstBlocks: Buffer[] = [];
  let inSst = false;
  let globalsEnd = 0;

  while (pos + 4 <= wb.length) {
    const id = wb.readUInt16LE(pos);
    const len = wb.readUInt16LE(pos + 2);
    const data = wb.subarray(pos + 4, pos + 4 + len);

    if (id === BIFF_SST) {
      inSst = true;
      sstBlocks.push(data);
    } else if (id === BIFF_CONTINUE && inSst) {
      sstBlocks.push(data);
    } else {
      inSst = false;
    }

    if (id === BIFF_XF) origXfPayloads.push(data);
    if (id === BIFF_BOUNDSHEET) boundSheetBofs.push(data.readUInt32LE(0));

    pos += 4 + len;
    if (id === BIFF_EOF) {
      globalsEnd = pos;
      break;
    }
  }

  if (boundSheetBofs.length < 2) {
    throw new Error('Estructura inesperada en la plantilla oficial DGII 606 (hojas faltantes).');
  }

  const sheet0Start = boundSheetBofs[0];
  const sheet1Start = boundSheetBofs[1];

  // Clonar los 11 estilos grises/bloqueados de la fila 12 hacia estilos blancos/desbloqueados (indices 177..187)
  const whiteXfMap = new Map<number, number>();
  const allXfPayloads = [...origXfPayloads];
  const clonedXfRecords: Buffer[] = [];
  SOURCE_XF_FOR_WHITE.forEach((origIdx) => {
    const clonedPayload = cloneXfAsWhiteUnlocked(origXfPayloads[origIdx]);
    const newIdx = allXfPayloads.length;
    allXfPayloads.push(clonedPayload);
    whiteXfMap.set(origIdx, newIdx);
    clonedXfRecords.push(makeBiffRecord(BIFF_XF, clonedPayload));
  });
  const totalXfCount = allXfPayloads.length;
  const newXfCrc32 = computeXfCrc32(allXfPayloads);

  // Preparar SST manteniendo índices originales 0..85 intactos
  const parsedSst = parseSstStrings(sstBlocks);
  const sstStrings = [...parsedSst.strings];
  const sstMap = new Map<string, number>();
  sstStrings.forEach((s, i) => {
    if (!sstMap.has(s)) sstMap.set(s, i);
  });
  let totalStringRefsDelta = -2; // R3C2 y R4C2 reemplazan 2 LABELSST preexistentes

  const internString = (text: string): number => {
    totalStringRefsDelta += 1;
    const existing = sstMap.get(text);
    if (existing !== undefined) return existing;
    const idx = sstStrings.length;
    sstStrings.push(text);
    sstMap.set(text, idx);
    return idx;
  };

  // Internar valores de cabecera y todas las celdas de texto antes de serializar SST en Globals
  const rncSstIdx = internString(cleanRnc);
  const periodSstIdx = internString(cleanPeriod);

  interface PreparedCellRow {
    c1RncSst: number;
    c2TipoId: number;
    c3TipoBienesSst: number;
    c4NcfSst: number;
    c5NcfModSst: number | null;
    c6FcYmSst: number;
    c7FcDaySst: number;
    c8FpYmSst: number | null;
    c9FpDaySst: number | null;
    c10Servicios: number;
    c11Bienes: number;
    c12Facturado: number;
    c13ItbisFact: number;
    c14ItbisRet: number;
    c15ItbisProp: number;
    c16ItbisCosto: number;
    c17ItbisAdel: number;
    c18ItbisPerc: number;
    c19TipoRetSst: number | null;
    c20IsrRet: number;
    c21IsrPerc: number;
    c22Isc: number;
    c23OtrosImp: number;
    c24Propina: number;
    c25FormaPagoSst: number;
  }

  const preparedRows: PreparedCellRow[] = activeRows.map((row) => {
    const rncDigits = String(row.rncCedula || '').replace(/\D/g, '');
    const tipoId = Number(row.tipoId || (rncDigits.length === 9 ? 1 : 2));
    const tipoCode = toTwoDigit(row.tipoGasto, '02');
    const tipoBienesLabel = TIPO_BIENES_OFFICIAL[tipoCode] || TIPO_BIENES_OFFICIAL['02'];
    const ncfClean = String(row.ncf || '').trim().toUpperCase();
    const ncfModClean = String(row.ncfModificado || '').trim().toUpperCase();
    const fc = parseYmd(row.fechaComprobante, cleanPeriod);

    const fpDigits = String(row.fechaPago || '').replace(/\D/g, '');
    const fp = fpDigits.length >= 8 ? { ym: fpDigits.slice(0, 6), day: fpDigits.slice(6, 8) } : null;

    const montoServ = round2(row.montoServicios);
    const montoBienes = round2(row.montoBienes);
    const montoFactRaw = round2(row.montoFacturado);
    const montoFact = montoServ + montoBienes > 0 ? round2(montoServ + montoBienes) : montoFactRaw;

    const itbisFact = round2(row.itbisFacturado);
    const itbisRet = round2(row.itbisRetenido);
    const itbisProp = round2(row.itbisProporcionalidad);
    const itbisCosto = round2(row.itbisLlevadoAlCosto);
    const itbisAdelRaw = round2(row.itbisPorAdelantar);
    const itbisAdel =
      itbisFact > 0 ? round2(Math.max(0, itbisFact - itbisCosto)) : itbisAdelRaw;
    const itbisPerc = round2(row.itbisPercibido);

    const retCode = String(row.tipoRetencionIsr || '').replace(/\D/g, '');
    const retLabel = retCode ? TIPO_RETENCION_OFFICIAL[toTwoDigit(retCode)] || '' : '';

    const isrRet = round2(row.isrRetenido);
    const isrPerc = round2(row.isrPercibido);
    const isc = round2(row.isc);
    const otrosImp = round2(row.otrosImpuestos);
    const propina = round2(row.propinaLegal);

    const fpCodeRaw = String(row.formaPagoCode || row.formaPago || '01').replace(/\D/g, '');
    const fpCode = toTwoDigit(fpCodeRaw || '01', '01');
    const formaPagoLabel = FORMA_PAGO_OFFICIAL[fpCode] || FORMA_PAGO_OFFICIAL['01'];

    return {
      c1RncSst: internString(rncDigits),
      c2TipoId: tipoId,
      c3TipoBienesSst: internString(tipoBienesLabel),
      c4NcfSst: internString(ncfClean),
      c5NcfModSst: ncfModClean ? internString(ncfModClean) : null,
      c6FcYmSst: internString(fc.ym),
      c7FcDaySst: internString(fc.day || '01'),
      c8FpYmSst: fp ? internString(fp.ym) : null,
      c9FpDaySst: fp ? internString(fp.day) : null,
      c10Servicios: montoServ,
      c11Bienes: montoBienes,
      c12Facturado: montoFact,
      c13ItbisFact: itbisFact,
      c14ItbisRet: itbisRet,
      c15ItbisProp: itbisProp,
      c16ItbisCosto: itbisCosto,
      c17ItbisAdel: itbisAdel,
      c18ItbisPerc: itbisPerc,
      c19TipoRetSst: retLabel ? internString(retLabel) : null,
      c20IsrRet: isrRet,
      c21IsrPerc: isrPerc,
      c22Isc: isc,
      c23OtrosImp: otrosImp,
      c24Propina: propina,
      c25FormaPagoSst: internString(formaPagoLabel),
    };
  });

  // 2. Reconstruir Globals actualizando XFs, XFCRC, SST, ExtSST y BoundSheets
  const globalsChunks: Buffer[] = [];
  const boundSheetChunkIndices: number[] = [];
  let newGlobalsOffset = 0;
  pos = 0;
  let xfSeenCount = 0;
  inSst = false;

  while (pos < globalsEnd) {
    const id = wb.readUInt16LE(pos);
    const len = wb.readUInt16LE(pos + 2);
    const fullRec = Buffer.from(wb.subarray(pos, pos + 4 + len));

    if (id === BIFF_SST) {
      inSst = true;
      const { sstRecords, extSstRecord } = serializeSstAndExtSst(
        newGlobalsOffset,
        Math.max(sstStrings.length, parsedSst.totalStrings + totalStringRefsDelta),
        sstStrings
      );
      globalsChunks.push(sstRecords);
      newGlobalsOffset += sstRecords.length;
      // Saltar CONTINUEs de SST y el EXTSST original siguiente para emitir el EXTSST actualizado
      pos += 4 + len;
      while (pos < globalsEnd && wb.readUInt16LE(pos) === BIFF_CONTINUE) {
        pos += 4 + wb.readUInt16LE(pos + 2);
      }
      if (pos < globalsEnd && wb.readUInt16LE(pos) === BIFF_EXTSST) {
        pos += 4 + wb.readUInt16LE(pos + 2);
      }
      globalsChunks.push(extSstRecord);
      newGlobalsOffset += extSstRecord.length;
      inSst = false;
      continue;
    }

    if (id === BIFF_XF) {
      xfSeenCount++;
      globalsChunks.push(fullRec);
      newGlobalsOffset += fullRec.length;
      if (xfSeenCount === origXfPayloads.length) {
        for (const clonedRec of clonedXfRecords) {
          globalsChunks.push(clonedRec);
          newGlobalsOffset += clonedRec.length;
        }
      }
      pos += 4 + len;
      continue;
    }

    if (id === BIFF_XFCRC) {
      fullRec.writeUInt16LE(totalXfCount, 4 + 14);
      fullRec.writeUInt32LE(newXfCrc32 >>> 0, 4 + 16);
      globalsChunks.push(fullRec);
      newGlobalsOffset += fullRec.length;
      pos += 4 + len;
      continue;
    }

    if (id === BIFF_BOUNDSHEET) {
      boundSheetChunkIndices.push(globalsChunks.length);
      globalsChunks.push(fullRec);
      newGlobalsOffset += fullRec.length;
      pos += 4 + len;
      continue;
    }

    globalsChunks.push(fullRec);
    newGlobalsOffset += fullRec.length;
    pos += 4 + len;
  }

  const deltaGlobals = newGlobalsOffset - globalsEnd;
  const newSheet0Start = sheet0Start + deltaGlobals;
  const newSheet1Start = sheet1Start + deltaGlobals;

  boundSheetChunkIndices.forEach((chunkIdx, i) => {
    const oldOff = boundSheetBofs[i];
    globalsChunks[chunkIdx].writeUInt32LE((oldOff + deltaGlobals) >>> 0, 4);
  });

  // 3. Ajustar offsets de DBCELL en INDEX de Sheet 0 (UtilitarioP) manteniendo su contenido exacto
  const sheet0Buf = Buffer.from(wb.subarray(sheet0Start, sheet1Start));
  if (deltaGlobals !== 0) {
    let s0Pos = 0;
    while (s0Pos + 4 <= sheet0Buf.length) {
      const id = sheet0Buf.readUInt16LE(s0Pos);
      const len = sheet0Buf.readUInt16LE(s0Pos + 2);
      if (id === BIFF_INDEX && len > 16) {
        for (let k = 16; k + 4 <= len; k += 4) {
          const oldDbOff = sheet0Buf.readUInt32LE(s0Pos + 4 + k);
          sheet0Buf.writeUInt32LE((oldDbOff + deltaGlobals) >>> 0, s0Pos + 4 + k);
        }
        break;
      }
      s0Pos += 4 + len;
      if (id === BIFF_EOF) break;
    }
  }

  // 4. Reconstruir Sheet 1 (Herramienta Formato 606) inyectando cabecera, filas y recalculando DBCELL + INDEX
  const whiteXf = (origIdx: number) => whiteXfMap.get(origIdx) ?? origIdx;
  const buildDataRowCells = (biffRow: number, pr: PreparedCellRow): Buffer[] => {
    const numOrBlank = (col: number, xf: number, val: number) =>
      val !== 0 ? makeNumber(biffRow, col, xf, val) : makeBlank(biffRow, col, xf);
    const sstOrBlank = (col: number, xf: number, sstIdx: number | null) =>
      sstIdx !== null ? makeLabelSst(biffRow, col, xf, sstIdx) : makeBlank(biffRow, col, xf);

    return [
      makeLabelSst(biffRow, 1, whiteXf(104), pr.c1RncSst),
      makeNumber(biffRow, 2, whiteXf(105), pr.c2TipoId),
      makeLabelSst(biffRow, 3, whiteXf(106), pr.c3TipoBienesSst),
      makeLabelSst(biffRow, 4, whiteXf(144), pr.c4NcfSst),
      sstOrBlank(5, whiteXf(145), pr.c5NcfModSst),
      makeLabelSst(biffRow, 6, whiteXf(108), pr.c6FcYmSst),
      makeLabelSst(biffRow, 7, whiteXf(109), pr.c7FcDaySst),
      sstOrBlank(8, whiteXf(108), pr.c8FpYmSst),
      sstOrBlank(9, whiteXf(109), pr.c9FpDaySst),
      numOrBlank(10, whiteXf(110), pr.c10Servicios),
      numOrBlank(11, whiteXf(110), pr.c11Bienes),
      makeNumber(biffRow, 12, whiteXf(111), pr.c12Facturado),
      makeNumber(biffRow, 13, whiteXf(111), pr.c13ItbisFact),
      numOrBlank(14, whiteXf(111), pr.c14ItbisRet),
      numOrBlank(15, whiteXf(111), pr.c15ItbisProp),
      numOrBlank(16, whiteXf(111), pr.c16ItbisCosto),
      makeNumber(biffRow, 17, whiteXf(111), pr.c17ItbisAdel),
      numOrBlank(18, whiteXf(111), pr.c18ItbisPerc),
      sstOrBlank(19, whiteXf(111), pr.c19TipoRetSst),
      numOrBlank(20, whiteXf(143), pr.c20IsrRet),
      numOrBlank(21, whiteXf(117), pr.c21IsrPerc),
      numOrBlank(22, whiteXf(117), pr.c22Isc),
      numOrBlank(23, whiteXf(117), pr.c23OtrosImp),
      numOrBlank(24, whiteXf(117), pr.c24Propina),
      makeLabelSst(biffRow, 25, whiteXf(117), pr.c25FormaPagoSst),
      makeBlank(biffRow, 26, 164),
    ];
  };

  const sheet1Chunks: Buffer[] = [];
  let sheet1RunningPos = newSheet1Start;
  let sheet1IndexChunkIdx = -1;
  const sheet1DbCellAbsOffsets: number[] = [];

  let blockRowOffs: number[] = [];
  const blockFirstCellByRow = new Map<number, number>();

  const appendSheet1Chunk = (chunk: Buffer) => {
    sheet1Chunks.push(chunk);
    sheet1RunningPos += chunk.length;
  };

  const recordCellPos = (rw: number, cellAbsPos: number) => {
    if (!blockFirstCellByRow.has(rw)) {
      blockFirstCellByRow.set(rw, cellAbsPos);
    }
  };

  const CELL_REC_IDS = new Set([
    BIFF_LABELSST,
    BIFF_RK,
    BIFF_NUMBER,
    BIFF_FORMULA,
    BIFF_BLANK,
    BIFF_MULBLANK,
    BIFF_MULRK,
    BIFF_LABEL,
  ]);

  pos = sheet1Start;
  while (pos + 4 <= wb.length) {
    const id = wb.readUInt16LE(pos);
    const len = wb.readUInt16LE(pos + 2);
    const fullRec = Buffer.from(wb.subarray(pos, pos + 4 + len));

    if (id === BIFF_INDEX) {
      sheet1IndexChunkIdx = sheet1Chunks.length;
      appendSheet1Chunk(fullRec);
      pos += 4 + len;
      continue;
    }

    if (id === BIFF_ROW) {
      blockRowOffs.push(sheet1RunningPos);
      appendSheet1Chunk(fullRec);
      pos += 4 + len;
      continue;
    }

    if (id === BIFF_DBCELL) {
      const dbAbsPos = sheet1RunningPos;
      sheet1DbCellAbsOffsets.push(dbAbsPos);

      const dbRtrw = blockRowOffs.length > 0 ? dbAbsPos - blockRowOffs[0] : 0;
      const rowsWithCells = [...blockFirstCellByRow.keys()].sort((a, b) => a - b);
      const rgdb: number[] = [];
      let prevAnchor =
        blockRowOffs.length > 1
          ? blockRowOffs[1]
          : blockRowOffs.length === 1
            ? blockRowOffs[0] + 20
            : dbAbsPos;
      for (const r of rowsWithCells) {
        const cellOff = blockFirstCellByRow.get(r)!;
        rgdb.push(cellOff - prevAnchor);
        prevAnchor = cellOff;
      }

      const dbPayload = Buffer.allocUnsafe(4 + rgdb.length * 2);
      dbPayload.writeUInt32LE(dbRtrw >>> 0, 0);
      rgdb.forEach((v, idx) => dbPayload.writeUInt16LE(v & 0xffff, 4 + idx * 2));
      appendSheet1Chunk(makeBiffRecord(BIFF_DBCELL, dbPayload));

      blockRowOffs = [];
      blockFirstCellByRow.clear();
      pos += 4 + len;
      continue;
    }

    if (CELL_REC_IDS.has(id)) {
      const rw = fullRec.readUInt16LE(4);
      const col = fullRec.readUInt16LE(6);

      // Cabecera del Formulario 606 oficial
      if (rw === 3 && col === 2) {
        recordCellPos(rw, sheet1RunningPos);
        appendSheet1Chunk(makeLabelSst(3, 2, 87, rncSstIdx));
        pos += 4 + len;
        continue;
      }
      if (rw === 4 && col === 2) {
        recordCellPos(rw, sheet1RunningPos);
        appendSheet1Chunk(makeLabelSst(4, 2, 77, periodSstIdx));
        pos += 4 + len;
        continue;
      }
      if (rw === 5 && col === 2) {
        recordCellPos(rw, sheet1RunningPos);
        appendSheet1Chunk(makeNumber(5, 2, 82, preparedRows.length));
        pos += 4 + len;
        continue;
      }

      // Fila 10 (SUBTOTAL): forzar recálculo automático al abrir en Excel
      if (rw === 9 && id === BIFF_FORMULA && len >= 16) {
        const grbit = fullRec.readUInt16LE(4 + 14) | 0x0003;
        fullRec.writeUInt16LE(grbit, 4 + 14);
        recordCellPos(rw, sheet1RunningPos);
        appendSheet1Chunk(fullRec);
        pos += 4 + len;
        continue;
      }

      // Filas de detalle (biffRow 11 .. 11 + preparedRows.length - 1): reemplazar MULBLANK(1..26) por celdas reales
      const rowDataIdx = rw - 11;
      if (
        id === BIFF_MULBLANK &&
        col === 1 &&
        rowDataIdx >= 0 &&
        rowDataIdx < preparedRows.length
      ) {
        const cellRecs = buildDataRowCells(rw, preparedRows[rowDataIdx]);
        for (const cr of cellRecs) {
          recordCellPos(rw, sheet1RunningPos);
          appendSheet1Chunk(cr);
        }
        pos += 4 + len;
        continue;
      }

      recordCellPos(rw, sheet1RunningPos);
      appendSheet1Chunk(fullRec);
      pos += 4 + len;
      continue;
    }

    appendSheet1Chunk(fullRec);
    pos += 4 + len;
    if (id === BIFF_EOF) break;
  }

  // Actualizar los offsets absolutos de DBCELL dentro del registro INDEX de Sheet 1
  if (sheet1IndexChunkIdx >= 0) {
    const idxRec = sheet1Chunks[sheet1IndexChunkIdx];
    const maxSlots = Math.floor((idxRec.length - 20) / 4);
    for (let k = 0; k < Math.min(maxSlots, sheet1DbCellAbsOffsets.length); k++) {
      idxRec.writeUInt32LE(sheet1DbCellAbsOffsets[k] >>> 0, 20 + k * 4);
    }
  }

  const newGlobalsBuf = Buffer.concat(globalsChunks);
  if (newGlobalsBuf.length !== globalsEnd + deltaGlobals || newSheet0Start !== newGlobalsBuf.length) {
    throw new Error('Desalineación interna construyendo las cabeceras BIFF del Formato 606.');
  }

  const newWbBuf = Buffer.concat([newGlobalsBuf, sheet0Buf, ...sheet1Chunks]);
  return replaceWorkbookStreamInOle2(ctx, newWbBuf);
}
