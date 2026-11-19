import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { prisma } from '@factura-ecf/database';
import {
  DomainInvoice,
  EcfType,
  FormaPago,
  IndicadorBienServicio,
  IndicadorFacturacion,
  TipoPago,
} from '@factura-ecf/fiscal-engine';
import { FiscalService } from '../fiscal/fiscal.service';
import { BillingService } from '../billing/billing.service';
import { CryptoService } from '../common/crypto.service';
import { CacheService } from '../common/cache.service';
import { SecurityShieldService } from '../security/security-shield.service';
import {
  ExternalSaleOrigin,
  ItbisRate,
  PublicInvoiceCreateInput,
  PublicInvoiceItemInput,
  PublicInvoiceResponse,
  PublicPaymentMethod,
  TaxInclusiveLineBreakdown,
} from './integrations.types';
import { mapUberEatsOrderToInvoiceInput } from './mappers/ubereats.mapper';
import { mapPedidosYaOrderToInvoiceInput } from './mappers/pedidosya.mapper';

@Injectable()
export class IntegrationsService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationsService.name);
  private ddlReady = false;

  constructor(
    private readonly fiscalService: FiscalService,
    private readonly billingService: BillingService,
    private readonly cryptoService: CryptoService,
    private readonly cacheService: CacheService,
    private readonly securityShield: SecurityShieldService
  ) {}

  async onModuleInit() {
    await this.ensureIntegrationSchema();
  }

  private async ensureIntegrationSchema() {
    if (this.ddlReady) return;
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ApiKey"
          ADD COLUMN IF NOT EXISTS "scopes" TEXT[] NOT NULL DEFAULT ARRAY['invoices:write', 'invoices:read']::TEXT[];
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ApiKey"
          ADD COLUMN IF NOT EXISTS "revoked" BOOLEAN NOT NULL DEFAULT false;
      `);
      await prisma.$executeRawUnsafe(`
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
      `);
      await prisma.$executeRawUnsafe(`
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
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ventas_externas_empresa_id_origen_external_id_key"
          ON "ventas_externas"("empresa_id", "origen", "external_id");
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ventas_externas_empresa_id_creada_en_idx"
          ON "ventas_externas"("empresa_id", "creada_en");
      `);
      await prisma.$executeRawUnsafe(`
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
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "conexiones_delivery"
          ADD COLUMN IF NOT EXISTS "entorno" TEXT NOT NULL DEFAULT 'sandbox',
          ADD COLUMN IF NOT EXISTS "client_id_enc" TEXT,
          ADD COLUMN IF NOT EXISTS "client_secret_enc" TEXT,
          ADD COLUMN IF NOT EXISTS "webhook_secret_enc" TEXT;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "conexiones_delivery_plataforma_store_id_key"
          ON "conexiones_delivery"("plataforma", "store_id");
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "conexiones_delivery_empresa_id_plataforma_idx"
          ON "conexiones_delivery"("empresa_id", "plataforma");
      `);
      this.ddlReady = true;
    } catch (err: any) {
      this.logger.warn(
        `[Integrations] Aviso inicializando tablas de integraciones: ${err?.message || err}`
      );
    }
  }

  // ============================================================================
  // 1. GESTIÓN DE API KEYS POR EMPRESA ("ak_live_" + 48 hex)
  // ============================================================================

  public async createCompanyApiKey(
    tenantId: string,
    dto: { nombre?: string; name?: string; scopes?: string[] }
  ) {
    await this.ensureIntegrationSchema();
    const nombre = String(dto?.nombre || dto?.name || '').trim();
    if (!nombre) {
      throw new HttpException(
        { error: 'El nombre descriptivo de la API Key es obligatorio.', campo: 'nombre' },
        HttpStatus.BAD_REQUEST
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, environment: true },
    });
    if (!tenant) {
      throw new NotFoundException({ error: 'Empresa no encontrada.', campo: 'empresa_id' });
    }

    const allowedScopes = new Set(['invoices:write', 'invoices:read']);
    const scopes =
      Array.isArray(dto.scopes) && dto.scopes.length > 0
        ? dto.scopes.filter((s) => allowedScopes.has(String(s)))
        : ['invoices:write', 'invoices:read'];
    if (scopes.length === 0) {
      scopes.push('invoices:write', 'invoices:read');
    }

    // Formato requerido: "ak_live_" + 48 caracteres hexadecimales criptográficos
    const randomHex = crypto.randomBytes(24).toString('hex');
    const rawKey = `ak_live_${randomHex}`;
    const keyHash = this.cryptoService.hashSha256(rawKey);
    const prefijoVisible = rawKey.slice(0, 12); // ej. "ak_live_3f9a"

    const created = await prisma.apiKey.create({
      data: {
        tenantId,
        name: nombre.slice(0, 80),
        keyPrefix: prefijoVisible,
        keyHash,
        encryptedKeyVault: null, // Nunca guardar clave en texto plano ni reversible
        scopes,
        environment: tenant.environment,
        isActive: true,
        revoked: false,
      },
    });

    await prisma.auditLog
      .create({
        data: {
          tenantId,
          action: 'API_KEY_CREATED',
          entity: 'ApiKey',
          entityId: created.id,
          newPayload: {
            name: created.name,
            keyPrefix: created.keyPrefix,
            scopes: created.scopes,
          },
        },
      })
      .catch(() => undefined);

    return {
      id: created.id,
      nombre: created.name,
      prefijo_visible: created.keyPrefix,
      scopes: created.scopes,
      key: rawKey,
      creada_en: created.createdAt.toISOString(),
      advertencia: 'Copia esta API Key ahora. Por seguridad no se volverá a mostrar.',
    };
  }

  public async listCompanyApiKeys(tenantId: string) {
    await this.ensureIntegrationSchema();
    const rows = await prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        isActive: true,
        revoked: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return rows.map((k) => ({
      id: k.id,
      nombre: k.name,
      prefijo_visible: k.keyPrefix,
      scopes:
        Array.isArray(k.scopes) && k.scopes.length > 0
          ? k.scopes
          : ['invoices:write', 'invoices:read'],
      revocada: Boolean(k.revoked || !k.isActive),
      ultimo_uso: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
      creada_en: k.createdAt.toISOString(),
    }));
  }

  public async revokeCompanyApiKey(tenantId: string, keyId: string) {
    await this.ensureIntegrationSchema();
    const existing = await prisma.apiKey.findFirst({
      where: { id: keyId, tenantId },
      select: { id: true, name: true, keyPrefix: true, keyHash: true },
    });

    if (!existing) {
      throw new NotFoundException({ error: 'API Key no encontrada en esta empresa.', campo: 'id' });
    }

    await prisma.apiKey.update({
      where: { id: existing.id },
      data: { revoked: true, isActive: false },
    });

    await this.cacheService.del(`pub_apikey:${existing.keyHash.slice(0, 24)}`);
    await this.cacheService.del(`apikey:${existing.keyHash.slice(0, 16)}`);

    await prisma.auditLog
      .create({
        data: {
          tenantId,
          action: 'API_KEY_REVOKED',
          entity: 'ApiKey',
          entityId: existing.id,
          newPayload: { name: existing.name, keyPrefix: existing.keyPrefix, revoked: true },
        },
      })
      .catch(() => undefined);

    return {
      success: true,
      id: existing.id,
      revocada: true,
    };
  }

  // ============================================================================
  // 2. VALIDACIÓN ESTRICTA & CONVERSIÓN AL MOTOR FISCAL EXISTENTE
  // ============================================================================

  public validatePublicInvoiceInput(body: any): PublicInvoiceCreateInput {
    const fail = (error: string, campo: string): never => {
      throw new HttpException({ error, campo }, HttpStatus.BAD_REQUEST);
    };

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      fail('El cuerpo de la petición debe ser un objeto JSON válido.', 'body');
    }

    const externalId = typeof body.external_id === 'string' ? body.external_id.trim() : '';
    if (!externalId) {
      fail('El identificador de venta del POS (external_id) es obligatorio.', 'external_id');
    }
    if (externalId.length > 120) {
      fail('external_id no puede superar 120 caracteres.', 'external_id');
    }

    let buyerRncClean: string | undefined;
    let buyerNombre: string | undefined;
    if (body.comprador !== undefined) {
      if (!body.comprador || typeof body.comprador !== 'object' || Array.isArray(body.comprador)) {
        fail('comprador debe ser un objeto con { rnc?, nombre? }.', 'comprador');
      }
      if (body.comprador.rnc !== undefined && String(body.comprador.rnc).trim() !== '') {
        buyerRncClean = String(body.comprador.rnc).replace(/[\s-]/g, '').trim();
        if (!/^\d{9}$|^\d{11}$/.test(buyerRncClean)) {
          fail(
            'El RNC o Cédula del comprador debe contener 9 u 11 dígitos numéricos.',
            'comprador.rnc'
          );
        }
      }
      if (body.comprador.nombre !== undefined) {
        buyerNombre = String(body.comprador.nombre).trim();
      }
    }

    let tipoEcf: 31 | 32;
    if (body.tipo_ecf === undefined || body.tipo_ecf === null) {
      tipoEcf = buyerRncClean ? 31 : 32;
    } else {
      const parsedType = Number(body.tipo_ecf);
      if (parsedType !== 31 && parsedType !== 32) {
        fail('tipo_ecf solo acepta 31 (Crédito Fiscal) o 32 (Consumo).', 'tipo_ecf');
      }
      tipoEcf = parsedType as 31 | 32;
    }

    if (tipoEcf === 31) {
      if (!buyerRncClean) {
        fail(
          'Para e-CF 31 (Crédito Fiscal), el RNC del comprador (9 u 11 dígitos) es obligatorio.',
          'comprador.rnc'
        );
      }
      if (!buyerNombre) {
        fail(
          'Para e-CF 31 (Crédito Fiscal), el nombre o razón social del comprador es obligatorio.',
          'comprador.nombre'
        );
      }
    }

    let precioIncluyeItbis = false;
    if (body.precio_incluye_itbis !== undefined && body.precio_incluye_itbis !== null) {
      if (typeof body.precio_incluye_itbis !== 'boolean') {
        fail(
          'precio_incluye_itbis debe ser un valor booleano (true o false).',
          'precio_incluye_itbis'
        );
      }
      precioIncluyeItbis = body.precio_incluye_itbis;
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      fail('items debe contener al menos una línea de producto o servicio.', 'items');
    }

    let netSubtotal = 0;
    const validatedItems = body.items.map((item: any, idx: number) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        fail(`La línea ${idx + 1} debe ser un objeto válido.`, `items[${idx}]`);
      }

      const descripcion = typeof item.descripcion === 'string' ? item.descripcion.trim() : '';
      if (!descripcion) {
        fail(
          `La descripción es obligatoria en la línea ${idx + 1}.`,
          `items[${idx}].descripcion`
        );
      }

      const cantidad = Number(item.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        fail(
          `La cantidad debe ser un número mayor a 0 en la línea ${idx + 1}.`,
          `items[${idx}].cantidad`
        );
      }

      const precioUnitario = Number(item.precio_unitario);
      if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
        fail(
          `precio_unitario debe ser un número mayor o igual a 0 en la línea ${idx + 1}.`,
          `items[${idx}].precio_unitario`
        );
      }

      const tasa = Number(item.itbis_tasa);
      if (![0, 16, 18].includes(tasa)) {
        fail(
          `itbis_tasa debe ser 0, 16 o 18 en la línea ${idx + 1}.`,
          `items[${idx}].itbis_tasa`
        );
      }

      let descuento = 0;
      if (item.descuento !== undefined && item.descuento !== null) {
        descuento = Number(item.descuento);
        if (precioIncluyeItbis) {
          if (!Number.isFinite(descuento) || descuento < 0 || descuento > 100) {
            fail(
              `Cuando precio_incluye_itbis es true, descuento representa porcentaje (0 a 100) en la línea ${idx + 1}.`,
              `items[${idx}].descuento`
            );
          }
        } else {
          const lineGross = cantidad * precioUnitario;
          if (!Number.isFinite(descuento) || descuento < 0 || descuento > lineGross + 0.01) {
            fail(
              `El descuento es inválido en la línea ${idx + 1} (debe estar entre 0 y el subtotal de la línea).`,
              `items[${idx}].descuento`
            );
          }
        }
      }

      if (precioIncluyeItbis) {
        netSubtotal += this.round2(precioUnitario * cantidad * (1 - descuento / 100));
      } else {
        netSubtotal += cantidad * precioUnitario - descuento;
      }

      return {
        descripcion: descripcion.slice(0, 200),
        cantidad,
        precio_unitario: precioUnitario,
        itbis_tasa: tasa as ItbisRate,
        ...(descuento > 0 ? { descuento } : {}),
      };
    });

    if (netSubtotal <= 0) {
      fail('El monto total de los ítems debe ser mayor a 0.', 'items');
    }

    const validPaymentMethods: PublicPaymentMethod[] = [
      'efectivo',
      'tarjeta',
      'transferencia',
      'mixto',
    ];
    const formaPago = String(body.forma_pago || '').toLowerCase() as PublicPaymentMethod;
    if (!validPaymentMethods.includes(formaPago)) {
      fail(
        'forma_pago es obligatorio y debe ser: efectivo, tarjeta, transferencia o mixto.',
        'forma_pago'
      );
    }

    let canal: PublicInvoiceCreateInput['canal'];
    if (body.canal !== undefined && body.canal !== null && body.canal !== '') {
      const c = String(body.canal).toLowerCase();
      if (!['salon', 'para_llevar', 'kiosko'].includes(c)) {
        fail('canal solo permite: salon, para_llevar o kiosko.', 'canal');
      }
      canal = c as PublicInvoiceCreateInput['canal'];
    }

    const notas = typeof body.notas === 'string' ? body.notas.trim().slice(0, 500) : undefined;

    return {
      external_id: externalId,
      tipo_ecf: tipoEcf,
      precio_incluye_itbis: precioIncluyeItbis,
      ...(buyerRncClean || buyerNombre
        ? { comprador: { rnc: buyerRncClean, nombre: buyerNombre } }
        : {}),
      items: validatedItems,
      forma_pago: formaPago,
      ...(canal ? { canal } : {}),
      ...(notas ? { notas } : {}),
    };
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  /**
   * Extrae base imponible e ITBIS desde precio unitario con impuesto incluido.
   * Calcula itbis_linea por resta exacta (total_linea - base_linea) y ajusta
   * centavos de redondeo unitario usando RecargoMonto / DescuentoMonto para que
   * MontoItem == base_linea exactamente en el XML XSD de DGII (31 y 32).
   */
  public calculateTaxInclusiveLine(item: PublicInvoiceItemInput): TaxInclusiveLineBreakdown {
    const descuentoPct = Number(item.descuento || 0);
    const total_linea = this.round2(
      item.precio_unitario * item.cantidad * (1 - descuentoPct / 100)
    );
    const divisor = 1 + item.itbis_tasa / 100;
    const base_linea = this.round2(total_linea / divisor);
    const itbis_linea = this.round2(total_linea - base_linea);

    const precio_unitario_sin_itbis = this.round2(base_linea / item.cantidad);
    const subtotal_xml = this.round2(precio_unitario_sin_itbis * item.cantidad);
    const delta = this.round2(base_linea - subtotal_xml);

    const recargoMonto = delta > 0 ? delta : 0;
    const descuentoMonto = delta < 0 ? Math.abs(delta) : 0;

    return {
      total_linea,
      base_linea,
      itbis_linea,
      precio_unitario_sin_itbis,
      recargoMonto,
      descuentoMonto,
      montoItem: base_linea,
    };
  }

  private mapItbisRateToDgiiIndicator(rate: ItbisRate): IndicadorFacturacion {
    if (rate === 16) return IndicadorFacturacion.ITBIS_16;
    if (rate === 0) return IndicadorFacturacion.EXENTO;
    return IndicadorFacturacion.ITBIS_18;
  }

  private mapPaymentMethodToDgii(formaPago: PublicPaymentMethod): FormaPago {
    switch (formaPago) {
      case 'transferencia':
        return FormaPago.CHEQUE_TRANSFERENCIA_DEPOSITO;
      case 'tarjeta':
        return FormaPago.TARJETA_DEBITO_CREDITO;
      case 'efectivo':
      case 'mixto':
      default:
        return FormaPago.EFECTIVO;
    }
  }

  public toDomainInvoice(input: PublicInvoiceCreateInput): DomainInvoice {
    const tipoEcf = input.tipo_ecf === 31 ? EcfType.CREDITO_FISCAL : EcfType.CONSUMO;
    const precioIncluyeItbis = Boolean(input.precio_incluye_itbis);

    return {
      tipoEcf,
      externalDocId: input.external_id,
      indicadorMontoGravado: 0, // El XML se expresa siempre en base sin ITBIS + ajuste de línea
      precioIncluyeItbis,
      tipoIngresos: '01',
      tipoPago: TipoPago.CONTADO,
      formaPago: this.mapPaymentMethodToDgii(input.forma_pago),
      fechaEmision: new Date(),
      comprador:
        tipoEcf === EcfType.CREDITO_FISCAL || input.comprador?.rnc || input.comprador?.nombre
          ? {
              ...(input.comprador?.rnc ? { rncComprador: input.comprador.rnc } : {}),
              razonSocialComprador: input.comprador?.nombre || 'Consumidor Final',
            }
          : {
              razonSocialComprador: 'Consumidor Final',
            },
      items: input.items.map((item, idx) => {
        if (!precioIncluyeItbis) {
          return {
            numeroLinea: idx + 1,
            indicadorFacturacion: this.mapItbisRateToDgiiIndicator(item.itbis_tasa),
            indicadorBienServicio: IndicadorBienServicio.BIEN,
            nombreItem: item.descripcion.slice(0, 80),
            descripcionItem: item.descripcion,
            cantidadItem: item.cantidad,
            precioUnitarioItem: item.precio_unitario,
            descuentoMonto: item.descuento || 0,
          };
        }

        const calc = this.calculateTaxInclusiveLine(item);
        return {
          numeroLinea: idx + 1,
          indicadorFacturacion: this.mapItbisRateToDgiiIndicator(item.itbis_tasa),
          indicadorBienServicio: IndicadorBienServicio.BIEN,
          nombreItem: item.descripcion.slice(0, 80),
          descripcionItem: item.descripcion,
          cantidadItem: item.cantidad,
          precioUnitarioItem: calc.precio_unitario_sin_itbis,
          descuentoMonto: calc.descuentoMonto,
          recargoMonto: calc.recargoMonto,
          montoItem: calc.base_linea,
          itbisLinea: calc.itbis_linea,
          totalLinea: calc.total_linea,
        };
      }),
    };
  }

  private getPublicBaseUrl(): string {
    return (
      process.env.PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      'https://factura.antek.com.do'
    ).replace(/\/$/, '');
  }

  private formatPublicInvoiceResponse(
    inv: any,
    trace?: { externalId?: string; origen?: ExternalSaleOrigin | string }
  ): PublicInvoiceResponse {
    const id = String(inv.id);
    const total = Number(inv?.totales?.montoTotal ?? inv?.montoTotal ?? 0);
    const itbisTotal = Number(inv?.totales?.totalItbis ?? inv?.totalItbis ?? 0);
    const fechaRaw = inv?.fechaEmision || inv?.createdAt || new Date().toISOString();
    const fechaEmision =
      typeof fechaRaw === 'string'
        ? fechaRaw.split('T')[0]
        : new Date(fechaRaw).toISOString().split('T')[0];

    return {
      id,
      ...(trace?.externalId ? { external_id: trace.externalId } : {}),
      ...(trace?.origen ? { origen: trace.origen as ExternalSaleOrigin } : {}),
      encf: inv?.encf || null,
      estado: String(inv?.status || 'ACCEPTED'),
      total: Math.round(total * 100) / 100,
      itbis_total: Math.round(itbisTotal * 100) / 100,
      qr_url: inv?.urlQr || null,
      pdf_url: `${this.getPublicBaseUrl()}/v1/invoices/${encodeURIComponent(id)}/pdf`,
      fecha_emision: fechaEmision,
    };
  }

  // ============================================================================
  // 3. EMISIÓN UNIFICADA CON IDEMPOTENCIA CONCURRENTE Y TRAZABILIDAD EN ventas_externas
  // ============================================================================

  private isUniqueConstraintError(err: any): boolean {
    if (err?.code === 'P2002') return true;
    const msg = String(err?.message || '').toLowerCase();
    return msg.includes('unique constraint') || msg.includes('duplicate key');
  }

  private async resolveExistingEmittedSale(
    tenantId: string,
    origen: ExternalSaleOrigin,
    sale: { externalId: string; ecfId: string | null; encf: string | null }
  ): Promise<{
    statusCode: 200;
    idempotent: true;
    data: PublicInvoiceResponse;
  } | null> {
    if (sale.ecfId) {
      try {
        const existingInvoice = await this.fiscalService.getInvoiceById(sale.ecfId, tenantId);
        return {
          statusCode: 200 as const,
          idempotent: true,
          data: this.formatPublicInvoiceResponse(existingInvoice, {
            externalId: sale.externalId,
            origen,
          }),
        };
      } catch {}
    }

    if (sale.encf) {
      try {
        const byEncf = await this.fiscalService.getInvoiceById(sale.encf, tenantId);
        return {
          statusCode: 200 as const,
          idempotent: true,
          data: this.formatPublicInvoiceResponse(byEncf, {
            externalId: sale.externalId,
            origen,
          }),
        };
      } catch {}
    }

    return null;
  }

  private async waitForInFlightSale(
    tenantId: string,
    origen: ExternalSaleOrigin,
    externalId: string
  ) {
    for (let i = 0; i < 40; i++) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const latest = await prisma.externalSale.findUnique({
        where: {
          empresa_origen_external_unique: {
            tenantId,
            origen,
            externalId,
          },
        },
      });
      if (!latest) break;
      if (latest.estado === 'emitido') {
        const resolved = await this.resolveExistingEmittedSale(tenantId, origen, latest);
        if (resolved) return resolved;
      }
      if (latest.estado === 'error') {
        throw new BadRequestException({
          error: latest.errorDetalle || 'La emisión concurrente previa falló.',
          campo: 'external_id',
        });
      }
    }

    const fallback = await prisma.externalSale.findUnique({
      where: {
        empresa_origen_external_unique: {
          tenantId,
          origen,
          externalId,
        },
      },
    });
    if (fallback && fallback.estado === 'emitido') {
      const resolved = await this.resolveExistingEmittedSale(tenantId, origen, fallback);
      if (resolved) return resolved;
    }

    throw new HttpException(
      {
        error: 'Venta en proceso por otra petición concurrente. Consulta nuevamente con external_id.',
        campo: 'external_id',
      },
      HttpStatus.CONFLICT
    );
  }

  public async emitExternalInvoice(
    tenantId: string,
    origen: ExternalSaleOrigin,
    rawPayload: any,
    isApiKeyRequest = true
  ): Promise<{
    statusCode: 200 | 201;
    idempotent: boolean;
    data: PublicInvoiceResponse;
  }> {
    await this.ensureIntegrationSchema();
    const validated = this.validatePublicInvoiceInput(rawPayload);

    // 1. Intento de reserva atómica mediante llave única (empresa_id, origen, external_id)
    let saleRecord: any = null;
    try {
      saleRecord = await prisma.externalSale.create({
        data: {
          tenantId,
          origen,
          externalId: validated.external_id,
          payloadOriginal: rawPayload as any,
          estado: 'pendiente',
        },
      });
    } catch (createErr: any) {
      if (!this.isUniqueConstraintError(createErr)) {
        throw createErr;
      }

      const existing = await prisma.externalSale.findUnique({
        where: {
          empresa_origen_external_unique: {
            tenantId,
            origen,
            externalId: validated.external_id,
          },
        },
      });

      if (existing?.estado === 'emitido') {
        const resolved = await this.resolveExistingEmittedSale(tenantId, origen, existing);
        if (resolved) return resolved;
      }

      if (existing?.estado === 'pendiente') {
        return this.waitForInFlightSale(tenantId, origen, validated.external_id);
      }

      if (existing && existing.estado === 'error') {
        const claimed = await prisma.externalSale.updateMany({
          where: { id: existing.id, estado: 'error' },
          data: {
            payloadOriginal: rawPayload as any,
            estado: 'pendiente',
            errorDetalle: null,
          },
        });
        if (claimed.count === 0) {
          return this.waitForInFlightSale(tenantId, origen, validated.external_id);
        }
        saleRecord = existing;
      } else {
        return this.waitForInFlightSale(tenantId, origen, validated.external_id);
      }
    }

    const lockKey = `ext:${tenantId}:${origen}:${validated.external_id}`;
    return this.securityShield.withSequenceLock(lockKey, async () => {
      // 2. Validar plan activo, acceso API y límite de comprobantes (402 o 403 claro)
      try {
        await this.billingService.checkEmissionAllowed(
          tenantId,
          validated.tipo_ecf || 32,
          isApiKeyRequest
        );
      } catch (err: any) {
        const status = err instanceof HttpException ? err.getStatus() : 403;
        const resp = err instanceof HttpException ? (err.getResponse() as any) : null;
        const msg = resp?.message || 'Tu plan actual no permite emitir este comprobante vía API.';
        await prisma.externalSale
          .update({
            where: { id: saleRecord.id },
            data: { estado: 'error', errorDetalle: String(msg).slice(0, 1000) },
          })
          .catch(() => undefined);

        if (err instanceof HttpException) {
          throw new HttpException(
            {
              error: msg,
              codigo: resp?.code || 'PLAN_RESTRICTION',
              campo: 'plan',
            },
            status
          );
        }
        throw err;
      }

      // 3. Reutilizar función central FiscalService.emitInvoice (sin duplicar lógica fiscal)
      try {
        const domainInvoice = this.toDomainInvoice(validated);
        const emitted = await this.fiscalService.emitInvoice(domainInvoice, {
          tenantId,
          idempotencyKey: `ext:${origen}:${validated.external_id}`,
        });

        await this.billingService.incrementUsage(tenantId);

        await prisma.externalSale.update({
          where: { id: saleRecord.id },
          data: {
            estado: 'emitido',
            ecfId: emitted.id,
            encf: emitted.encf,
            errorDetalle: null,
          },
        });

        const formatted = this.formatPublicInvoiceResponse(emitted.invoice || emitted, {
          externalId: validated.external_id,
          origen,
        });

        // 4. Webhook saliente en segundo plano con 3 reintentos
        this.scheduleOutgoingWebhook(tenantId, 'invoice.emitted', formatted);

        return {
          statusCode: 201 as const,
          idempotent: false,
          data: formatted,
        };
      } catch (err: any) {
        const errResp = err instanceof HttpException ? (err.getResponse() as any) : null;
        const errMsg =
          errResp?.message || errResp?.error || err?.message || 'Error al emitir el comprobante e-CF.';

        await prisma.externalSale
          .update({
            where: { id: saleRecord.id },
            data: {
              estado: 'error',
              errorDetalle: String(errMsg).slice(0, 1000),
            },
          })
          .catch(() => undefined);

        this.scheduleOutgoingWebhook(tenantId, 'invoice.failed', {
          external_id: validated.external_id,
          origen,
          error: errMsg,
        });

        if (err instanceof HttpException) {
          throw new HttpException(
            {
              error: errMsg,
              campo: errResp?.campo || 'invoice',
            },
            err.getStatus()
          );
        }
        throw new BadRequestException({ error: errMsg, campo: 'invoice' });
      }
    });
  }

  public async getPublicInvoiceById(tenantId: string, idOrEncf: string) {
    await this.ensureIntegrationSchema();
    let inv: any;
    try {
      inv = await this.fiscalService.getInvoiceById(idOrEncf, tenantId);
    } catch {
      throw new NotFoundException({
        error: `No se encontró el comprobante '${idOrEncf}' en esta empresa.`,
        campo: 'id',
      });
    }

    const trace = await prisma.externalSale.findFirst({
      where: {
        tenantId,
        OR: [{ ecfId: inv.id }, { encf: inv.encf }],
      },
      select: { externalId: true, origen: true },
    });

    return this.formatPublicInvoiceResponse(inv, {
      externalId: trace?.externalId || inv.externalDocId,
      origen: trace?.origen || 'pos',
    });
  }

  public async getPublicInvoiceByExternalId(
    tenantId: string,
    externalId: string,
    origen?: string
  ) {
    await this.ensureIntegrationSchema();
    const cleanExtId = String(externalId || '').trim();
    if (!cleanExtId) {
      throw new HttpException(
        { error: 'Debe indicar el parámetro external_id.', campo: 'external_id' },
        HttpStatus.BAD_REQUEST
      );
    }

    const trace = await prisma.externalSale.findFirst({
      where: {
        tenantId,
        externalId: cleanExtId,
        ...(origen ? { origen: String(origen).toLowerCase() } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!trace) {
      throw new NotFoundException({
        error: `No existe ninguna venta externa con external_id '${cleanExtId}'.`,
        campo: 'external_id',
      });
    }

    if (trace.ecfId) {
      try {
        const inv = await this.fiscalService.getInvoiceById(trace.ecfId, tenantId);
        return {
          ...this.formatPublicInvoiceResponse(inv, {
            externalId: trace.externalId,
            origen: trace.origen,
          }),
          estado_trazabilidad: trace.estado,
        };
      } catch {}
    }

    return {
      id: trace.ecfId || null,
      external_id: trace.externalId,
      origen: trace.origen,
      encf: trace.encf || null,
      estado: trace.estado,
      error_detalle: trace.errorDetalle || null,
      creada_en: trace.createdAt.toISOString(),
    };
  }

  // ============================================================================
  // 4. CONECTORES DELIVERY: UBER EATS Y PEDIDOSYA
  // ============================================================================

  private safeDecrypt(encVal?: string | null): string | undefined {
    if (!encVal) return undefined;
    try {
      return this.cryptoService.decrypt(encVal);
    } catch {
      return undefined;
    }
  }

  private extractUberStoreId(payload: any): string {
    return String(
      payload?.meta?.user_id ||
        payload?.store_id ||
        payload?.store?.id ||
        payload?.order?.store?.id ||
        ''
    ).trim();
  }

  private extractPedidosYaStoreId(payload: any): string {
    const order = payload?.order || payload?.data || payload;
    return String(
      order?.storeId ||
        order?.store_id ||
        order?.restaurant?.id ||
        order?.shop?.id ||
        order?.vendor?.id ||
        payload?.storeId ||
        ''
    ).trim();
  }

  public async verifyUberWebhookSignature(
    rawBody: Buffer | undefined,
    signatureHeader?: string,
    payload?: any
  ): Promise<void> {
    await this.ensureIntegrationSchema();
    const storeId = this.extractUberStoreId(payload);
    let tenantSecret: string | undefined;

    if (storeId) {
      const conn = await prisma.deliveryConnection.findUnique({
        where: { plataforma_store_unique: { plataforma: 'ubereats', storeId } },
        select: { clientSecretEnc: true, webhookSecretEnc: true, activo: true },
      });
      if (conn?.activo) {
        tenantSecret =
          this.safeDecrypt(conn.webhookSecretEnc) || this.safeDecrypt(conn.clientSecretEnc);
      }
    }

    const secret = tenantSecret || process.env.UBER_CLIENT_SECRET;
    if (!secret) {
      throw new HttpException(
        {
          error:
            'UBER_CLIENT_SECRET no está configurado ni en la tienda conectada ni en el servidor.',
          campo: 'X-Uber-Signature',
        },
        HttpStatus.UNAUTHORIZED
      );
    }
    const provided = String(signatureHeader || '').trim().toLowerCase();
    if (!provided || !rawBody) {
      throw new HttpException(
        { error: 'Firma X-Uber-Signature ausente o body inválido.', campo: 'X-Uber-Signature' },
        HttpStatus.UNAUTHORIZED
      );
    }

    const expectedHex = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')
      .toLowerCase();

    const expectedBuf = Buffer.from(expectedHex, 'utf8');
    const providedBuf = Buffer.from(provided.replace(/^sha256=/, ''), 'utf8');
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new HttpException(
        { error: 'Firma X-Uber-Signature inválida.', campo: 'X-Uber-Signature' },
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  public queueUberEatsWebhookProcessing(payload: any): void {
    setImmediate(() => {
      this.processUberEatsWebhook(payload).catch((err: any) => {
        this.logger.error(`[UberEats] Error procesando pedido en background: ${err?.message || err}`);
      });
    });
  }

  private async fetchUberOrderDetailsIfNeeded(
    orderId: string,
    payload: any,
    connection?: { clientIdEnc?: string | null; clientSecretEnc?: string | null; entorno?: string }
  ): Promise<any> {
    if (
      Array.isArray(payload?.cart?.items) ||
      Array.isArray(payload?.order?.cart?.items) ||
      Array.isArray(payload?.items)
    ) {
      return payload;
    }

    const clientId = this.safeDecrypt(connection?.clientIdEnc) || process.env.UBER_CLIENT_ID;
    const clientSecret =
      this.safeDecrypt(connection?.clientSecretEnc) || process.env.UBER_CLIENT_SECRET;
    if (!clientId || !clientSecret || !orderId) {
      return payload;
    }

    const envName = String(connection?.entorno || process.env.UBER_ENV || 'sandbox').toLowerCase();
    const isProd = envName === 'production';
    const loginUrl = isProd
      ? 'https://login.uber.com/oauth/v2/token'
      : 'https://sandbox-login.uber.com/oauth/v2/token';
    const apiBase = isProd ? 'https://api.uber.com' : 'https://test-api.uber.com';

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'eats.order eats.store.orders.read',
    });

    const tokenRes = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!tokenRes.ok) {
      throw new Error(`No se pudo autenticar contra Uber OAuth (${tokenRes.status}).`);
    }
    const tokenJson: any = await tokenRes.json();
    const accessToken = tokenJson?.access_token;
    if (!accessToken) {
      throw new Error('Uber OAuth no retornó access_token.');
    }

    const orderRes = await fetch(`${apiBase}/v1/eats/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!orderRes.ok) {
      throw new Error(`Error consultando Uber Order API (${orderRes.status}).`);
    }
    return await orderRes.json();
  }

  public async processUberEatsWebhook(payload: any) {
    await this.ensureIntegrationSchema();
    const orderId = String(
      payload?.meta?.resource_id ||
        payload?.resource_id ||
        payload?.order?.id ||
        payload?.order_id ||
        payload?.id ||
        ''
    ).trim();
    const storeId = this.extractUberStoreId(payload);

    if (!storeId || !orderId) {
      this.logger.warn('[UberEats] Webhook recibido sin store_id u order_id identificable.');
      return { ignored: true, reason: 'missing_store_or_order_id' };
    }

    const connection = await prisma.deliveryConnection.findUnique({
      where: {
        plataforma_store_unique: { plataforma: 'ubereats', storeId },
      },
    });
    if (!connection || !connection.activo) {
      this.logger.warn(`[UberEats] No hay conexión activa para store_id=${storeId}.`);
      return { ignored: true, reason: 'store_not_connected' };
    }

    const eventType = String(payload?.event_type || payload?.event || '').toLowerCase();
    const statusStr = String(payload?.current_state || payload?.status || '').toUpperCase();
    const isCancel =
      eventType.includes('cancel') ||
      statusStr === 'CANCELLED' ||
      statusStr === 'CANCELED';

    if (isCancel) {
      return this.handleDeliveryCancellation(connection.tenantId, 'ubereats', orderId, payload);
    }

    const orderData = await this.fetchUberOrderDetailsIfNeeded(orderId, payload, connection);
    const orderStatus = String(
      orderData?.current_state || orderData?.status || statusStr || ''
    ).toUpperCase();
    if (orderStatus === 'CANCELLED' || orderStatus === 'CANCELED') {
      return this.handleDeliveryCancellation(connection.tenantId, 'ubereats', orderId, orderData);
    }

    const mapped = mapUberEatsOrderToInvoiceInput(orderData, {
      incluirEnvio: connection.incluirEnvio,
      incluirPropina: connection.incluirPropina,
    });

    if (!mapped.items || mapped.items.length === 0) {
      await prisma.externalSale.upsert({
        where: {
          empresa_origen_external_unique: {
            tenantId: connection.tenantId,
            origen: 'ubereats',
            externalId: orderId,
          },
        },
        update: {
          payloadOriginal: orderData as any,
          estado: 'error',
          errorDetalle: 'Pedido Uber Eats recibido sin ítems facturables.',
        },
        create: {
          tenantId: connection.tenantId,
          origen: 'ubereats',
          externalId: orderId,
          payloadOriginal: orderData as any,
          estado: 'error',
          errorDetalle: 'Pedido Uber Eats recibido sin ítems facturables.',
        },
      });
      return { status: 'error', reason: 'empty_items' };
    }

    return this.emitExternalInvoice(connection.tenantId, 'ubereats', mapped, false);
  }

  public async verifyPedidosYaWebhookSecret(
    headers: Record<string, any>,
    payload?: any
  ): Promise<void> {
    await this.ensureIntegrationSchema();
    const storeId = this.extractPedidosYaStoreId(payload);
    let tenantSecret: string | undefined;

    if (storeId) {
      const conn = await prisma.deliveryConnection.findUnique({
        where: { plataforma_store_unique: { plataforma: 'pedidosya', storeId } },
        select: { webhookSecretEnc: true, clientSecretEnc: true, activo: true },
      });
      if (conn?.activo) {
        tenantSecret =
          this.safeDecrypt(conn.webhookSecretEnc) || this.safeDecrypt(conn.clientSecretEnc);
      }
    }

    const expected = tenantSecret || process.env.PEDIDOSYA_WEBHOOK_SECRET;
    if (!expected) {
      throw new HttpException(
        {
          error:
            'PEDIDOSYA_WEBHOOK_SECRET no está configurado ni en la tienda conectada ni en el servidor.',
          campo: 'X-PedidosYa-Signature',
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const authRaw = String(headers['authorization'] || '');
    const bearer = authRaw.toLowerCase().startsWith('bearer ') ? authRaw.slice(7).trim() : '';
    const candidate = String(
      headers['x-pedidosya-signature'] ||
        headers['x-webhook-secret'] ||
        headers['x-pedidosya-secret'] ||
        bearer ||
        ''
    ).trim();

    if (!candidate) {
      throw new HttpException(
        { error: 'Falta secreto/firma de PedidosYa.', campo: 'X-PedidosYa-Signature' },
        HttpStatus.UNAUTHORIZED
      );
    }

    const expectedBuf = Buffer.from(expected, 'utf8');
    const candidateBuf = Buffer.from(candidate, 'utf8');
    if (
      expectedBuf.length !== candidateBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, candidateBuf)
    ) {
      throw new HttpException(
        { error: 'Secreto de webhook PedidosYa inválido.', campo: 'X-PedidosYa-Signature' },
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  public async processPedidosYaWebhook(payload: any) {
    await this.ensureIntegrationSchema();
    const order = payload?.order || payload?.data || payload;
    const orderId = String(order?.id || order?.orderId || order?.code || '').trim();
    const storeId = this.extractPedidosYaStoreId(payload);

    if (!storeId || !orderId) {
      throw new HttpException(
        { error: 'Payload de PedidosYa sin store_id u order_id.', campo: 'store_id' },
        HttpStatus.BAD_REQUEST
      );
    }

    const connection = await prisma.deliveryConnection.findUnique({
      where: {
        plataforma_store_unique: { plataforma: 'pedidosya', storeId },
      },
    });
    if (!connection || !connection.activo) {
      return { ignored: true, reason: 'store_not_connected', store_id: storeId };
    }

    const status = String(order?.status || payload?.status || '').toUpperCase();
    if (status === 'CANCELLED' || status === 'CANCELED' || status === 'REJECTED') {
      return this.handleDeliveryCancellation(connection.tenantId, 'pedidosya', orderId, payload);
    }

    const targetStatus = String(connection.emitirEnEstado || 'DELIVERED').toUpperCase();
    if (status && status !== targetStatus) {
      await prisma.externalSale.upsert({
        where: {
          empresa_origen_external_unique: {
            tenantId: connection.tenantId,
            origen: 'pedidosya',
            externalId: orderId,
          },
        },
        update: {
          payloadOriginal: payload as any,
        },
        create: {
          tenantId: connection.tenantId,
          origen: 'pedidosya',
          externalId: orderId,
          payloadOriginal: payload as any,
          estado: 'pendiente',
        },
      });
      return {
        received: true,
        emitted: false,
        reason: `Estado '${status}' registrado; emisión configurada al estado '${targetStatus}'.`,
      };
    }

    const mapped = mapPedidosYaOrderToInvoiceInput(payload, {
      incluirEnvio: connection.incluirEnvio,
      incluirPropina: connection.incluirPropina,
    });
    const emitted = await this.emitExternalInvoice(connection.tenantId, 'pedidosya', mapped, false);
    return {
      received: true,
      emitted: true,
      ...emitted.data,
    };
  }

  private async handleDeliveryCancellation(
    tenantId: string,
    origen: ExternalSaleOrigin,
    externalId: string,
    payload: any
  ) {
    const existing = await prisma.externalSale.findUnique({
      where: {
        empresa_origen_external_unique: { tenantId, origen, externalId },
      },
    });

    if (existing && existing.estado === 'emitido') {
      const detalle =
        `Pedido ${externalId} cancelado en ${origen} después de emitir ${existing.encf || 'e-CF'}. Emitir Nota de Crédito (e-CF 34).`;
      await prisma.externalSale.update({
        where: { id: existing.id },
        data: {
          estado: 'alerta_nota_credito',
          errorDetalle: detalle,
        },
      });
      this.scheduleOutgoingWebhook(tenantId, 'invoice.failed', {
        external_id: externalId,
        origen,
        encf: existing.encf,
        requiere_nota_credito: true,
        error: detalle,
      });
      return {
        received: true,
        emitted: false,
        estado: 'alerta_nota_credito',
        detalle,
      };
    }

    await prisma.externalSale.upsert({
      where: {
        empresa_origen_external_unique: { tenantId, origen, externalId },
      },
      update: {
        payloadOriginal: payload as any,
        estado: 'cancelado',
        errorDetalle: `Pedido cancelado en ${origen}; no se emitió e-CF.`,
      },
      create: {
        tenantId,
        origen,
        externalId,
        payloadOriginal: payload as any,
        estado: 'cancelado',
        errorDetalle: `Pedido cancelado en ${origen}; no se emitió e-CF.`,
      },
    });

    return {
      received: true,
      emitted: false,
      estado: 'cancelado',
    };
  }

  // ============================================================================
  // 5. WEBHOOK SALIENTE CON FIRMA X-Antek-Signature Y 3 REINTENTOS CON BACKOFF
  // ============================================================================

  public scheduleOutgoingWebhook(
    tenantId: string,
    evento: 'invoice.emitted' | 'invoice.failed',
    data: any
  ) {
    setImmediate(() => {
      this.dispatchOutgoingWebhook(tenantId, evento, data).catch((err: any) => {
        this.logger.warn(`[Webhook] Fallo enviando webhook saliente: ${err?.message || err}`);
      });
    });
  }

  private async dispatchOutgoingWebhook(
    tenantId: string,
    evento: 'invoice.emitted' | 'invoice.failed',
    data: any
  ) {
    const webhooks = await prisma.webhook.findMany({
      where: { tenantId, isActive: true },
    });
    if (!webhooks || webhooks.length === 0) return;

    const timestamp = Math.floor(Date.now() / 1000);
    const bodyObj = { evento, timestamp, data };
    const bodyJson = JSON.stringify(bodyObj);

    const retryDelaysMs = [1000, 3000, 9000];

    for (const wh of webhooks) {
      const subscribed =
        !Array.isArray(wh.events) ||
        wh.events.length === 0 ||
        wh.events.includes(evento) ||
        wh.events.includes('*');
      if (!subscribed) continue;

      const signatureHex = crypto
        .createHmac('sha256', wh.secret)
        .update(bodyJson, 'utf8')
        .digest('hex');
      const signatureHeader = `sha256=${signatureHex}`;

      let delivered = false;
      let attempts = 0;
      let lastStatus: number | null = null;
      let lastResponseBody = '';

      for (let i = 0; i < 3; i++) {
        attempts += 1;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(wh.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'ANTEK-Factura-Webhooks/1.0',
              'X-Antek-Event': evento,
              'X-Antek-Timestamp': String(timestamp),
              'X-Antek-Signature': signatureHeader,
            },
            body: bodyJson,
            signal: controller.signal,
          });
          clearTimeout(timer);

          lastStatus = res.status;
          lastResponseBody = (await res.text()).slice(0, 500);
          if (res.ok) {
            delivered = true;
            break;
          }
        } catch (err: any) {
          lastResponseBody = String(err?.message || 'Error de conexión').slice(0, 500);
        }

        if (i < 2) {
          await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[i]));
        }
      }

      await prisma.webhookDelivery
        .create({
          data: {
            webhookId: wh.id,
            event: evento,
            payload: bodyObj as any,
            signature: signatureHeader,
            status: delivered ? 'SUCCESS' : 'FAILED',
            attempts,
            maxAttempts: 3,
            responseCode: lastStatus,
            responseBody: lastResponseBody,
          },
        })
        .catch(() => undefined);
    }
  }

  // ============================================================================
  // 6. ENDPOINTS DEL PANEL DEL CLIENTE (/v1/integrations/*)
  // ============================================================================

  public async getTenantIntegrationsSummary(tenantId: string) {
    await this.ensureIntegrationSchema();
    const [apiKeys, deliveryConnections, webhooks, externalSales] = await Promise.all([
      this.listCompanyApiKeys(tenantId),
      prisma.deliveryConnection.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.webhook.findMany({
        where: { tenantId, isActive: true },
        orderBy: { updatedAt: 'desc' },
        include: {
          deliveries: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.externalSale.findMany({
        where: { tenantId },
        take: 25,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          origen: true,
          externalId: true,
          ecfId: true,
          encf: true,
          estado: true,
          errorDetalle: true,
          createdAt: true,
        },
      }),
    ]);

    const activeWebhook = webhooks[0] || null;

    return {
      apiKeys,
      deliveryConnections: deliveryConnections.map((c) => ({
        id: c.id,
        plataforma: c.plataforma,
        store_id: c.storeId,
        activo: c.activo,
        entorno: c.entorno || 'sandbox',
        emitir_en_estado: c.emitirEnEstado,
        incluir_envio: c.incluirEnvio,
        incluir_propina: c.incluirPropina,
        has_client_id: Boolean(c.clientIdEnc),
        has_client_secret: Boolean(c.clientSecretEnc),
        has_webhook_secret: Boolean(c.webhookSecretEnc),
        credenciales_configuradas: Boolean(
          c.clientSecretEnc || c.webhookSecretEnc || c.clientIdEnc
        ),
        creada_en: c.createdAt.toISOString(),
      })),
      outgoingWebhook: activeWebhook
        ? {
            id: activeWebhook.id,
            url: activeWebhook.url,
            events: activeWebhook.events,
            secretPrefix: `${activeWebhook.secret.slice(0, 10)}••••••••`,
            isActive: activeWebhook.isActive,
            recentDeliveries: activeWebhook.deliveries.map((d) => ({
              id: d.id,
              event: d.event,
              status: d.status,
              attempts: d.attempts,
              responseCode: d.responseCode,
              createdAt: d.createdAt.toISOString(),
            })),
          }
        : null,
      externalSales: externalSales.map((s) => ({
        id: s.id,
        origen: s.origen,
        external_id: s.externalId,
        ecf_id: s.ecfId,
        encf: s.encf,
        estado: s.estado,
        error_detalle: s.errorDetalle,
        creada_en: s.createdAt.toISOString(),
      })),
    };
  }

  public async upsertDeliveryConnection(
    tenantId: string,
    body: {
      plataforma?: string;
      store_id?: string;
      activo?: boolean;
      entorno?: string;
      client_id?: string;
      client_secret?: string;
      webhook_secret?: string;
      emitir_en_estado?: string;
      incluir_envio?: boolean;
      incluir_propina?: boolean;
    }
  ) {
    await this.ensureIntegrationSchema();
    const plataforma = String(body?.plataforma || '').toLowerCase();
    if (!['ubereats', 'pedidosya'].includes(plataforma)) {
      throw new HttpException(
        { error: 'La plataforma debe ser ubereats o pedidosya.', campo: 'plataforma' },
        HttpStatus.BAD_REQUEST
      );
    }
    const storeId = String(body?.store_id || '').trim();
    if (!storeId) {
      throw new HttpException(
        { error: 'El Store ID de la tienda es obligatorio.', campo: 'store_id' },
        HttpStatus.BAD_REQUEST
      );
    }

    const entorno =
      String(body?.entorno || 'sandbox').toLowerCase() === 'production'
        ? 'production'
        : 'sandbox';

    const conflict = await prisma.deliveryConnection.findUnique({
      where: { plataforma_store_unique: { plataforma, storeId } },
    });
    if (conflict && conflict.tenantId !== tenantId) {
      throw new HttpException(
        {
          error: `El store_id '${storeId}' ya se encuentra vinculado a otra empresa.`,
          campo: 'store_id',
        },
        HttpStatus.CONFLICT
      );
    }

    const clientIdPlain = typeof body.client_id === 'string' ? body.client_id.trim() : '';
    const clientSecretPlain =
      typeof body.client_secret === 'string' ? body.client_secret.trim() : '';
    const webhookSecretPlain =
      typeof body.webhook_secret === 'string' ? body.webhook_secret.trim() : '';

    const clientIdEnc = clientIdPlain
      ? this.cryptoService.encrypt(clientIdPlain)
      : conflict?.clientIdEnc ?? null;
    const clientSecretEnc = clientSecretPlain
      ? this.cryptoService.encrypt(clientSecretPlain)
      : conflict?.clientSecretEnc ?? null;
    const webhookSecretEnc = webhookSecretPlain
      ? this.cryptoService.encrypt(webhookSecretPlain)
      : conflict?.webhookSecretEnc ?? null;

    const saved = await prisma.deliveryConnection.upsert({
      where: { plataforma_store_unique: { plataforma, storeId } },
      update: {
        activo: body.activo !== undefined ? Boolean(body.activo) : true,
        entorno,
        clientIdEnc,
        clientSecretEnc,
        webhookSecretEnc,
        emitirEnEstado: String(body.emitir_en_estado || 'DELIVERED').toUpperCase(),
        incluirEnvio: body.incluir_envio !== undefined ? Boolean(body.incluir_envio) : true,
        incluirPropina: body.incluir_propina !== undefined ? Boolean(body.incluir_propina) : true,
      },
      create: {
        tenantId,
        plataforma,
        storeId,
        activo: body.activo !== undefined ? Boolean(body.activo) : true,
        entorno,
        clientIdEnc,
        clientSecretEnc,
        webhookSecretEnc,
        emitirEnEstado: String(body.emitir_en_estado || 'DELIVERED').toUpperCase(),
        incluirEnvio: body.incluir_envio !== undefined ? Boolean(body.incluir_envio) : true,
        incluirPropina: body.incluir_propina !== undefined ? Boolean(body.incluir_propina) : true,
      },
    });

    return {
      id: saved.id,
      plataforma: saved.plataforma,
      store_id: saved.storeId,
      activo: saved.activo,
      entorno: saved.entorno,
      emitir_en_estado: saved.emitirEnEstado,
      incluir_envio: saved.incluirEnvio,
      incluir_propina: saved.incluirPropina,
      has_client_id: Boolean(saved.clientIdEnc),
      has_client_secret: Boolean(saved.clientSecretEnc),
      has_webhook_secret: Boolean(saved.webhookSecretEnc),
      credenciales_configuradas: Boolean(
        saved.clientSecretEnc || saved.webhookSecretEnc || saved.clientIdEnc
      ),
      creada_en: saved.createdAt.toISOString(),
    };
  }

  public async testDeliveryConnection(tenantId: string, connectionId: string) {
    await this.ensureIntegrationSchema();
    const conn = await prisma.deliveryConnection.findFirst({
      where: { id: connectionId, tenantId },
    });
    if (!conn) {
      throw new NotFoundException({ error: 'Conexión delivery no encontrada.', campo: 'id' });
    }

    const sampleOrderId = `TEST-${conn.plataforma.toUpperCase()}-${Date.now().toString().slice(-6)}`;
    let mapped;
    if (conn.plataforma === 'ubereats') {
      mapped = mapUberEatsOrderToInvoiceInput(
        {
          id: sampleOrderId,
          display_id: sampleOrderId.slice(-4),
          store: { id: conn.storeId },
          cart: {
            items: [
              { title: 'Menú Prueba Uber Eats', quantity: 1, price: { unit_price: 550 } },
            ],
          },
          payment: { charges: { delivery_fee: 100, tip: 50 }, method: 'tarjeta' },
        },
        { incluirEnvio: conn.incluirEnvio, incluirPropina: conn.incluirPropina }
      );
    } else {
      mapped = mapPedidosYaOrderToInvoiceInput(
        {
          id: sampleOrderId,
          code: sampleOrderId.slice(-4),
          storeId: conn.storeId,
          status: 'DELIVERED',
          products: [
            { name: 'Menú Prueba PedidosYa', quantity: 1, unitPrice: 550, taxRate: 18 },
          ],
          deliveryFee: 100,
          tip: 50,
          paymentMethod: 'tarjeta',
        },
        { incluirEnvio: conn.incluirEnvio, incluirPropina: conn.incluirPropina }
      );
    }

    const emitted = await this.emitExternalInvoice(
      tenantId,
      conn.plataforma as ExternalSaleOrigin,
      mapped,
      false
    );

    return {
      success: true,
      plataforma: conn.plataforma,
      store_id: conn.storeId,
      credenciales_configuradas: Boolean(
        conn.clientSecretEnc || conn.webhookSecretEnc || conn.clientIdEnc
      ),
      ...emitted.data,
    };
  }

  public async deleteDeliveryConnection(tenantId: string, connectionId: string) {
    await this.ensureIntegrationSchema();
    const existing = await prisma.deliveryConnection.findFirst({
      where: { id: connectionId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Conexión delivery no encontrada.', campo: 'id' });
    }
    await prisma.deliveryConnection.delete({ where: { id: existing.id } });
    return { success: true, id: existing.id };
  }

  public async saveOutgoingWebhook(
    tenantId: string,
    body: { url?: string; events?: string[]; rotateSecret?: boolean }
  ) {
    await this.ensureIntegrationSchema();
    const rawUrl = String(body?.url || '').trim();
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
      throw new HttpException(
        { error: 'Debes ingresar una URL válida con http:// o https://.', campo: 'url' },
        HttpStatus.BAD_REQUEST
      );
    }

    const existing = await prisma.webhook.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    const events =
      Array.isArray(body.events) && body.events.length > 0
        ? body.events
        : ['invoice.emitted', 'invoice.failed'];

    if (existing && !body.rotateSecret) {
      const updated = await prisma.webhook.update({
        where: { id: existing.id },
        data: { url: rawUrl, events, isActive: true },
      });
      return {
        id: updated.id,
        url: updated.url,
        events: updated.events,
        secretOnce: null,
        secretPrefix: `${updated.secret.slice(0, 10)}••••••••`,
      };
    }

    if (existing) {
      await prisma.webhook.updateMany({
        where: { tenantId, isActive: true },
        data: { isActive: false },
      });
    }

    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const created = await prisma.webhook.create({
      data: {
        tenantId,
        url: rawUrl,
        secret,
        events,
        isActive: true,
      },
    });

    return {
      id: created.id,
      url: created.url,
      events: created.events,
      secretOnce: secret,
      secretPrefix: `${secret.slice(0, 10)}••••••••`,
    };
  }
}
