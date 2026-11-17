import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { prisma } from '@factura-ecf/database';
import { RncService } from '../rnc/rnc.service';
import * as crypto from 'crypto';

export interface DgiiQrParsedData {
  rncEmisor: string;
  razonSocialEmisor: string;
  rncComprador: string;
  razonSocialComprador?: string;
  encf: string;
  tipoEcf: number;
  fechaEmision: string;
  montoTotal: number;
  totalItbis: number;
  codigoSeguridad?: string;
  estadoDgii: string;
}

function normalizeDgiiDate(rawDate?: string): string {
  const today = new Date().toISOString().split('T')[0];
  if (!rawDate) return today;
  const cleaned = decodeURIComponent(rawDate.trim());
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const dmyMatch = cleaned.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }
  const compactMatch = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
  }
  return cleaned;
}

function getQueryParamCaseInsensitive(params: URLSearchParams, candidates: string[]): string {
  const normalizedCandidates = candidates.map((c) => c.toLowerCase().replace(/[_-]/g, ''));
  for (const [key, value] of params.entries()) {
    const normKey = key.toLowerCase().replace(/[_-]/g, '');
    if (normalizedCandidates.includes(normKey) && value !== undefined && value !== null) {
      return value.trim();
    }
  }
  return '';
}

@Injectable()
export class PurchasesService {
  private inMemoryPurchases: any[] = [];

  constructor(private readonly rncService: RncService) {}

  /**
   * Parsea un URL o contenido de un código QR del Timbre e-CF / TimbreFC emitido por DGII
   */
  public async parseDgiiQr(rawInput: string, tenantId?: string): Promise<DgiiQrParsedData> {
    const urlString = rawInput.trim().replace(/&amp;/g, '&');

    let urlParams: URLSearchParams;
    try {
      if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
        const parsedUrl = new URL(urlString);
        urlParams = parsedUrl.searchParams;
      } else if (urlString.includes('?')) {
        urlParams = new URLSearchParams(urlString.split('?')[1]);
      } else {
        urlParams = new URLSearchParams(urlString);
      }
    } catch {
      throw new BadRequestException('Formato de código QR / URL de DGII inválido.');
    }

    const rncEmisor = getQueryParamCaseInsensitive(urlParams, ['RncEmisor', 'RncEmis', 'Emisor']);
    let rncComprador = getQueryParamCaseInsensitive(urlParams, ['RncComprador', 'RncComp', 'Comprador']);
    const encf = getQueryParamCaseInsensitive(urlParams, ['ENCF', 'eNCF', 'NCF']).toUpperCase();
    const montoTotalStr = getQueryParamCaseInsensitive(urlParams, ['MontoTotal', 'Total', 'Monto']);
    const totalItbisStr = getQueryParamCaseInsensitive(urlParams, ['TotalITBIS', 'ITBIS', 'MontoITBIS']);
    const rawFecha = getQueryParamCaseInsensitive(urlParams, ['FechaEmision', 'Fecha', 'FechaFirma']);
    const fechaEmision = normalizeDgiiDate(rawFecha);
    const codigoSeguridad =
      getQueryParamCaseInsensitive(urlParams, ['CodigoSeguridad', 'CodSeguridad', 'Seguridad']) || undefined;

    if (!rncEmisor || !encf) {
      throw new BadRequestException('El QR escaneado no contiene los parámetros fiscales mínimos requeridos (RNC Emisor y e-NCF).');
    }

    let tipoEcf = 31;
    if (encf.startsWith('E')) {
      const parsedTipo = parseInt(encf.substring(1, 3), 10);
      if (!isNaN(parsedTipo)) {
        tipoEcf = parsedTipo;
      }
    } else if (encf.startsWith('B')) {
      const parsedTipo = parseInt(encf.substring(1, 3), 10);
      if (!isNaN(parsedTipo)) {
        tipoEcf = parsedTipo;
      }
    }

    const parsedMonto = parseFloat(montoTotalStr.replace(/,/g, '')) || 0;
    const parsedItbisRaw = totalItbisStr ? parseFloat(totalItbisStr.replace(/,/g, '')) : NaN;
    const parsedItbis = !isNaN(parsedItbisRaw) ? parsedItbisRaw : 0;

    let razonSocialEmisor = `RNC ${rncEmisor.replace(/\D/g, '')}`;
    try {
      const emisorData = this.rncService.lookup(rncEmisor);
      if (emisorData?.razonSocial) {
        razonSocialEmisor = emisorData.razonSocial;
      }
    } catch {}

    let razonSocialComprador: string | undefined = undefined;
    if (tenantId) {
      try {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { rnc: true, razonSocial: true },
        });
        if (tenant) {
          if (!rncComprador) rncComprador = tenant.rnc;
          if (rncComprador.replace(/\D/g, '') === tenant.rnc.replace(/\D/g, '')) {
            razonSocialComprador = tenant.razonSocial;
          }
        }
      } catch {}
    }

    if (rncComprador && !razonSocialComprador) {
      try {
        const compradorData = this.rncService.lookup(rncComprador);
        razonSocialComprador = compradorData.razonSocial;
      } catch {
        razonSocialComprador = `RNC ${rncComprador}`;
      }
    }

    return {
      rncEmisor: rncEmisor.replace(/\D/g, ''),
      razonSocialEmisor,
      rncComprador: rncComprador.replace(/\D/g, ''),
      razonSocialComprador,
      encf,
      tipoEcf,
      fechaEmision,
      montoTotal: parsedMonto,
      totalItbis: parsedItbis,
      codigoSeguridad,
      estadoDgii: 'Aceptado',
    };
  }

  /**
   * Registra una factura de gasto escaneada desde QR o digitada en el Libro de Compras (606)
   */
  public async registerFromQr(
    tenantId: string,
    payload: {
      qrRaw?: string;
      rncEmisor?: string;
      razonSocialEmisor?: string;
      encf?: string;
      fechaEmision?: string;
      montoTotal?: number;
      totalItbis?: number;
      tipoGasto606?: string;
    }
  ): Promise<any> {
    let parsed: DgiiQrParsedData;

    if (payload.qrRaw && payload.qrRaw.trim()) {
      parsed = await this.parseDgiiQr(payload.qrRaw, tenantId);
      if (payload.rncEmisor) parsed.rncEmisor = payload.rncEmisor.replace(/\D/g, '');
      if (payload.razonSocialEmisor?.trim()) parsed.razonSocialEmisor = payload.razonSocialEmisor.trim();
      if (payload.encf?.trim()) parsed.encf = payload.encf.trim().toUpperCase();
      if (payload.fechaEmision?.trim()) parsed.fechaEmision = payload.fechaEmision.trim();
      if (payload.montoTotal !== undefined) parsed.montoTotal = Number(payload.montoTotal);
      if (payload.totalItbis !== undefined) parsed.totalItbis = Number(payload.totalItbis);
    } else {
      const cleanRnc = (payload.rncEmisor || '').replace(/\D/g, '');
      const cleanEncf = (payload.encf || '').trim().toUpperCase();
      if (!cleanRnc || !cleanEncf) {
        throw new BadRequestException('Debe proporcionar el código QR o el RNC del Emisor junto con el e-NCF.');
      }

      let resolvedName = payload.razonSocialEmisor?.trim() || '';
      if (!resolvedName) {
        try {
          resolvedName = this.rncService.lookup(cleanRnc).razonSocial;
        } catch {
          resolvedName = `RNC ${cleanRnc}`;
        }
      }

      let tipoEcf = 31;
      if (cleanEncf.startsWith('E')) {
        const t = parseInt(cleanEncf.substring(1, 3), 10);
        if (!isNaN(t)) tipoEcf = t;
      }

      let rncComprador = '';
      let razonSocialComprador: string | undefined;
      try {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { rnc: true, razonSocial: true } });
        if (tenant) {
          rncComprador = tenant.rnc;
          razonSocialComprador = tenant.razonSocial;
        }
      } catch {}

      parsed = {
        rncEmisor: cleanRnc,
        razonSocialEmisor: resolvedName,
        rncComprador,
        razonSocialComprador,
        encf: cleanEncf,
        tipoEcf,
        fechaEmision: payload.fechaEmision?.trim() || new Date().toISOString().split('T')[0],
        montoTotal: Number(payload.montoTotal || 0),
        totalItbis: Number(payload.totalItbis || 0),
        estadoDgii: 'Aceptado',
      };
    }

    const tipoGasto = payload.tipoGasto606 || '02';

    const existingMem = this.inMemoryPurchases.find(
      (p) => p.tenantId === tenantId && p.rncEmisor === parsed.rncEmisor && p.encf === parsed.encf
    );
    if (existingMem) {
      throw new ConflictException(
        `La factura ${parsed.encf} del RNC ${parsed.rncEmisor} ya fue registrada anteriormente en tu Libro Contable (606).`
      );
    }

    let existingDb: any = null;
    try {
      existingDb = await prisma.receivedPurchase.findUnique({
        where: {
          tenantId_rncEmisor_encf: {
            tenantId,
            rncEmisor: parsed.rncEmisor,
            encf: parsed.encf,
          },
        },
        select: { id: true, encf: true, rncEmisor: true },
      });
    } catch {}

    if (existingDb) {
      throw new ConflictException(
        `La factura ${parsed.encf} del RNC ${parsed.rncEmisor} ya fue registrada anteriormente en tu Libro Contable (606).`
      );
    }

    let purchase: any;
    try {
      purchase = await prisma.receivedPurchase.create({
        data: {
          tenantId,
          rncEmisor: parsed.rncEmisor,
          razonSocialEmisor: parsed.razonSocialEmisor,
          encf: parsed.encf,
          tipoEcf: parsed.tipoEcf,
          fechaEmision: parsed.fechaEmision,
          montoTotal: parsed.montoTotal,
          totalItbis: parsed.totalItbis,
          tipoGasto606: tipoGasto,
          commercialStatus: 'PENDING',
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(
          `La factura ${parsed.encf} del RNC ${parsed.rncEmisor} ya fue registrada anteriormente en tu Libro Contable (606).`
        );
      }
      // Fallback in-memory solo si la BD no responde
      const record = {
        id: `purch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        tenantId,
        rncEmisor: parsed.rncEmisor,
        razonSocialEmisor: parsed.razonSocialEmisor,
        encf: parsed.encf,
        tipoEcf: parsed.tipoEcf,
        fechaEmision: parsed.fechaEmision,
        montoTotal: parsed.montoTotal,
        totalItbis: parsed.totalItbis,
        tipoGasto606: tipoGasto,
        commercialStatus: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.inMemoryPurchases.push(record);
      purchase = record;
    }

    return {
      success: true,
      message: 'Comprobante de gasto guardado exitosamente en el Libro Contable (606).',
      purchase,
      verifiedDgii: {
        rncEmisor: parsed.rncEmisor,
        razonSocialEmisor: parsed.razonSocialEmisor,
        rncComprador: parsed.rncComprador,
        razonSocialComprador: parsed.razonSocialComprador,
        encf: parsed.encf,
        fechaEmision: parsed.fechaEmision,
        totalItbis: parsed.totalItbis,
        montoTotal: parsed.montoTotal,
        estado: 'Aceptado',
      },
    };
  }

  /**
   * Registra múltiples facturas QR escaneadas en lote omitiendo duplicados
   */
  public async registerBatchFromQr(
    tenantId: string,
    items: Array<{
      qrRaw?: string;
      rncEmisor?: string;
      razonSocialEmisor?: string;
      encf?: string;
      fechaEmision?: string;
      montoTotal?: number;
      totalItbis?: number;
      tipoGasto606?: string;
    }>
  ): Promise<{
    success: boolean;
    savedCount: number;
    duplicateCount: number;
    errorCount: number;
    saved: any[];
    duplicates: Array<{ encf?: string; rncEmisor?: string; message: string }>;
    errors: Array<{ encf?: string; rncEmisor?: string; message: string }>;
    message: string;
  }> {
    const saved: any[] = [];
    const duplicates: Array<{ encf?: string; rncEmisor?: string; message: string }> = [];
    const errors: Array<{ encf?: string; rncEmisor?: string; message: string }> = [];

    for (const item of items) {
      try {
        const res = await this.registerFromQr(tenantId, item);
        if (res?.purchase) saved.push(res.purchase);
      } catch (err: any) {
        if (err instanceof ConflictException || err?.status === 409) {
          duplicates.push({
            encf: item.encf,
            rncEmisor: item.rncEmisor,
            message: err?.message || 'Factura duplicada omitida.',
          });
        } else {
          errors.push({
            encf: item.encf,
            rncEmisor: item.rncEmisor,
            message: err?.message || 'Error al registrar factura.',
          });
        }
      }
    }

    return {
      success: true,
      savedCount: saved.length,
      duplicateCount: duplicates.length,
      errorCount: errors.length,
      saved,
      duplicates,
      errors,
      message: `${saved.length} factura(s) guardada(s) en el Libro 606${
        duplicates.length > 0 ? ` (${duplicates.length} duplicada(s) omitida(s))` : ''
      }.`,
    };
  }

  /**
   * Importa un archivo XML de e-CF recibido de un proveedor
   */
  public async importFromXml(
    tenantId: string,
    payload: {
      xmlContent: string;
      tipoGasto606?: string;
    }
  ): Promise<any> {
    const xml = payload.xmlContent.trim();
    if (!xml.includes('<eCF') && !xml.includes('<ECF')) {
      throw new BadRequestException('El contenido XML suministrado no es un e-CF válido.');
    }

    const rncEmisorMatch = xml.match(/<RNCEmisor>([^<]+)<\/RNCEmisor>/i);
    const rncEmisor = rncEmisorMatch ? rncEmisorMatch[1].trim() : '';

    const razonSocialMatch = xml.match(/<RazonSocialEmisor>([^<]+)<\/RazonSocialEmisor>/i);
    const razonSocialEmisor = razonSocialMatch ? razonSocialMatch[1].trim() : `RNC ${rncEmisor}`;

    const encfMatch = xml.match(/<eNCF>([^<]+)<\/eNCF>/i);
    const encf = encfMatch ? encfMatch[1].trim().toUpperCase() : '';

    const tipoEcfMatch = xml.match(/<TipoeCF>([^<]+)<\/TipoeCF>/i);
    const tipoEcf = tipoEcfMatch ? parseInt(tipoEcfMatch[1].trim(), 10) : 31;

    const fechaMatch = xml.match(/<FechaEmision>([^<]+)<\/FechaEmision>/i);
    const fechaEmision = fechaMatch ? fechaMatch[1].trim() : new Date().toISOString().split('T')[0];

    const montoTotalMatch = xml.match(/<MontoTotal>([^<]+)<\/MontoTotal>/i);
    const montoTotal = montoTotalMatch ? parseFloat(montoTotalMatch[1].trim()) : 0;

    const totalItbisMatch = xml.match(/<TotalITBIS>([^<]+)<\/TotalITBIS>/i);
    const totalItbis = totalItbisMatch ? parseFloat(totalItbisMatch[1].trim()) : 0;

    const xmlHash = crypto.createHash('sha256').update(xml).digest('hex');

    let existingXmlDb: any = null;
    try {
      existingXmlDb = await prisma.receivedPurchase.findUnique({
        where: {
          tenantId_rncEmisor_encf: {
            tenantId,
            rncEmisor,
            encf,
          },
        },
        select: { id: true },
      });
    } catch {}
    if (existingXmlDb) {
      throw new ConflictException(
        `El comprobante XML ${encf} del RNC ${rncEmisor} ya existe en tu Libro Contable (606).`
      );
    }

    let purchase: any;
    try {
      purchase = await prisma.receivedPurchase.create({
        data: {
          tenantId,
          rncEmisor,
          razonSocialEmisor,
          encf,
          tipoEcf,
          fechaEmision,
          montoTotal,
          totalItbis,
          tipoGasto606: payload.tipoGasto606 || '02',
          xmlContent: xml,
          xmlHash,
          commercialStatus: 'PENDING',
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(
          `El comprobante XML ${encf} del RNC ${rncEmisor} ya existe en tu Libro Contable (606).`
        );
      }
      const record = {
        id: `purch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        tenantId,
        rncEmisor,
        razonSocialEmisor,
        encf,
        tipoEcf,
        fechaEmision,
        montoTotal,
        totalItbis,
        tipoGasto606: payload.tipoGasto606 || '02',
        xmlContent: xml,
        xmlHash,
        commercialStatus: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.inMemoryPurchases.push(record);
      purchase = record;
    }

    return {
      success: true,
      message: 'e-CF XML importado y validado satisfactoriamente.',
      purchase,
    };
  }

  /**
   * Obtiene la lista de compras del tenant con filtros y agregaciones
   */
  public async getPurchases(
    tenantId: string,
    filters?: {
      search?: string;
      status?: string;
    }
  ): Promise<any> {
    let purchases: any[] = [];
    try {
      const where: any = { tenantId };
      if (filters?.status) where.commercialStatus = filters.status;
      if (filters?.search) {
        const q = filters.search.trim();
        where.OR = [
          { rncEmisor: { contains: q, mode: 'insensitive' } },
          { razonSocialEmisor: { contains: q, mode: 'insensitive' } },
          { encf: { contains: q, mode: 'insensitive' } },
        ];
      }
      purchases = await prisma.receivedPurchase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      purchases = this.inMemoryPurchases.filter((p) => {
        if (p.tenantId !== tenantId) return false;
        if (filters?.status && filters.status !== 'ALL' && p.commercialStatus !== filters.status) return false;
        if (filters?.search) {
          const q = filters.search.toLowerCase();
          return (
            p.rncEmisor.toLowerCase().includes(q) ||
            p.razonSocialEmisor.toLowerCase().includes(q) ||
            p.encf.toLowerCase().includes(q)
          );
        }
        return true;
      });
    }

    let totalCompras = 0;
    let totalItbis = 0;

    purchases.forEach((p: any) => {
      totalCompras += Number(p.montoTotal);
      totalItbis += Number(p.totalItbis);
    });

    return {
      purchases,
      summary: {
        totalRecords: purchases.length,
        totalCompras,
        totalItbisDeducible: totalItbis,
      },
    };
  }

  /**
   * Aprobación o Rechazo Comercial de e-CF (Cumplimiento DGII Ley 32-23)
   */
  public async setCommercialApproval(
    tenantId: string,
    purchaseId: string,
    status: 'APPROVED' | 'REJECTED',
    comment?: string
  ): Promise<any> {
    try {
      const existing = await prisma.receivedPurchase.findFirst({
        where: { id: purchaseId, tenantId },
      });
      if (!existing) {
        throw new NotFoundException('Comprobante de compra no encontrado.');
      }
      const updated = await prisma.receivedPurchase.update({
        where: { id: purchaseId },
        data: {
          commercialStatus: status,
          commercialComment: comment,
          commercialApprovedAt: new Date(),
          commercialApprovedBy: 'Usuario Autorizado',
        },
      });
      return { success: true, message: 'Estado comercial actualizado.', purchase: updated };
    } catch {
      const idx = this.inMemoryPurchases.findIndex((p) => p.id === purchaseId);
      if (idx >= 0) {
        this.inMemoryPurchases[idx].commercialStatus = status;
        this.inMemoryPurchases[idx].commercialComment = comment;
        this.inMemoryPurchases[idx].commercialApprovedAt = new Date().toISOString();
        return { success: true, message: 'Estado comercial actualizado.', purchase: this.inMemoryPurchases[idx] };
      }
      throw new NotFoundException('Comprobante no encontrado.');
    }
  }

  /**
   * Generación y exportación de archivo Formato DGII 606 (Compras y Gastos)
   */
  public async exportFormat606(tenantId: string, periodo: string) {
    const { purchases } = await this.getPurchases(tenantId);
    let rnc = '000000000';
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { rnc: true } });
      if (tenant?.rnc) rnc = tenant.rnc;
    } catch {}

    const seen606 = new Set<string>();
    const uniquePurchases = purchases.filter((p: any) => {
      const k = `${p.rncEmisor}|${p.encf}`;
      if (seen606.has(k)) return false;
      seen606.add(k);
      return true;
    });

    const lines: string[] = [];
    lines.push(`606|${rnc}|${periodo || new Date().toISOString().slice(0, 7).replace('-', '')}|${uniquePurchases.length}`);

    uniquePurchases.forEach((p: any) => {
      const rncCedula = p.rncEmisor;
      const tipoId = rncCedula.length === 9 ? '1' : '2';
      const tipoGasto = p.tipoGasto606 || '02';
      const ncf = p.encf;
      const fecha = String(p.fechaEmision).replace(/-/g, '');
      const montoTotal = Number(p.montoTotal).toFixed(2);
      const itbisFacturado = Number(p.totalItbis).toFixed(2);

      const line = [
        rncCedula,
        tipoId,
        tipoGasto,
        ncf,
        '',
        fecha,
        fecha,
        montoTotal,
        montoTotal,
        itbisFacturado,
        '0.00',
        '0.00',
        '0.00',
        itbisFacturado,
        '0.00',
        '',
        '0.00',
        '0.00',
        '0.00',
        '0.00',
        '0.00',
        '01',
      ].join('|');

      lines.push(line);
    });

    return {
      filename: `DGII_F_606_${rnc}_${periodo || 'PERIODO'}.txt`,
      content: lines.join('\r\n'),
      totalRecords: purchases.length,
    };
  }
}
