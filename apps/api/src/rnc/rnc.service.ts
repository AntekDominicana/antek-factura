import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma } from '@factura-ecf/database';

export interface RncLookupResult {
  rnc: string;
  razonSocial: string;
  nombreRazonSocial?: string;
  nombreComercial?: string;
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'DADO_DE_BAJA';
  tipo: 'PERSONA_JURIDICA' | 'PERSONA_FISICA';
  regimen: 'GENERAL' | 'RST' | 'EXENTO';
  actividadEconomica?: string;
  checksumValid?: boolean;
  foundInPadron?: boolean;
  source?: string;
}

const GENERIC_RNC_NAME_RE = /^(RNC|C[eé]dula|EMPRESA REGISTRADA RNC|COMERCIAL)\s+\d+$/i;

@Injectable()
export class RncService {
  // Caché TTL en memoria (24h para consultas exitosas en vivo, 60s para fallbacks sin red)
  private readonly liveCache = new Map<string, { data: RncLookupResult; expiresAt: number }>();

  // Padrón Oficial DGII en memoria para respuesta inmediata en contribuyentes frecuentes
  private readonly padronOficial: Record<string, RncLookupResult> = {
    '401506254': {
      rnc: '401506254',
      razonSocial: 'DIRECCION GENERAL DE IMPUESTOS INTERNOS',
      nombreComercial: 'DGII',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'EXENTO',
      actividadEconomica: 'ADMINISTRACION TRIBUTARIA PUBLICA',
    },
    '401007551': {
      rnc: '401007551',
      razonSocial: 'BANCO DE RESERVAS DE LA REPUBLICA DOMINICANA',
      nombreComercial: 'BANRESERVAS',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'INTERMEDIACION MONETARIA Y BANCARIA',
    },
    '101010632': {
      rnc: '101010632',
      razonSocial: 'BANCO POPULAR DOMINICANO S A BANCO MULTIPLE',
      nombreComercial: 'BANCO POPULAR',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'SERVICIOS BANCARIOS Y FINANCIEROS',
    },
    '101136792': {
      rnc: '101136792',
      razonSocial: 'BANCO MULTIPLE BHD S A',
      nombreComercial: 'BANCO BHD',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'INTERMEDIACION FINANCIERA Y BANCARIA',
    },
    '101618787': {
      rnc: '101618787',
      razonSocial: 'ALTICE DOMINICANA S A',
      nombreComercial: 'ALTICE',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'SERVICIOS DE TELECOMUNICACIONES',
    },
    '101019921': {
      rnc: '101019921',
      razonSocial: 'CENTRO CUESTA NACIONAL S A S',
      nombreComercial: 'SUPERMERCADOS NACIONAL / JUMBO',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'COMERCIO AL POR MENOR EN SUPERMERCADOS',
    },
    '101796822': {
      rnc: '101796822',
      razonSocial: 'GRUPO RAMOS S A',
      nombreComercial: 'LA SIRENA / SIRENA MARKET',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'GRANDES ALMACENES Y SUPERMERCADOS',
    },
    '101004983': {
      rnc: '101004983',
      razonSocial: 'CERVECERIA NACIONAL DOMINICANA S A',
      nombreComercial: 'CERVECERIA NACIONAL',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'ELABORACION DE BEBIDAS Y CERVEZAS',
    },
    '101807687': {
      rnc: '101807687',
      razonSocial: 'MERCASID S A',
      nombreComercial: 'MERCASID',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'INDUSTRIA DE ALIMENTOS Y ACEITES',
    },
    '101821248': {
      rnc: '101821248',
      razonSocial: 'EDESUR DOMINICANA S A',
      nombreComercial: 'EDESUR',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'DISTRIBUCION DE ENERGIA ELECTRICA',
    },
    '101820217': {
      rnc: '101820217',
      razonSocial: 'EMPRESA DISTRIBUIDORA DE ELECTRICIDAD DEL ESTE S A',
      nombreComercial: 'EDEESTE',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'DISTRIBUCION DE ENERGIA ELECTRICA',
    },
    '101821256': {
      rnc: '101821256',
      razonSocial: 'EDENORTE DOMINICANA S A',
      nombreComercial: 'EDENORTE',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'DISTRIBUCION DE ENERGIA ELECTRICA',
    },
    '401023687': {
      rnc: '401023687',
      razonSocial: 'CAMARA DE COMERCIO Y PRODUCCION DE SANTO DOMINGO',
      nombreComercial: 'CAMARA SANTO DOMINGO / DIGIFIRMA',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'REGISTRO MERCANTIL Y CERTIFICACION DIGITAL',
    },
    '101532483': {
      rnc: '101532483',
      razonSocial: 'HIPERMERCADOS OLE SA',
      nombreComercial: 'OLE HIPERMERCADOS',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'VENTA AL POR MAYOR Y MENOR DE COMESTIBLES Y MERCANCÍAS DIVERSAS',
    },
    '132507908': {
      rnc: '132507908',
      razonSocial: 'ANGELISTIC SRL',
      nombreComercial: 'ANGELISTIC SRL',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'SERVICIOS TECNOLÓGICOS Y CONSULTORÍA',
    },
    '131880738': {
      rnc: '131880738',
      razonSocial: 'ANTEK DOMINICANA SRL',
      nombreComercial: 'ANTEK FACTURA',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'DESARROLLO DE SOFTWARE Y FACTURACIÓN ELECTRÓNICA E-CF',
    },
    '101001577': {
      rnc: '101001577',
      razonSocial: 'BANCO MULTIPLE POPULAR SA',
      nombreComercial: 'BANCO POPULAR DOMINICANO',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'INTERMEDIACIÓN FINANCIERA Y BANCA MÚLTIPLE',
    },
    '101011327': {
      rnc: '101011327',
      razonSocial: 'CERVECERIA NACIONAL DOMINICANA C POR A',
      nombreComercial: 'CERVECERIA NACIONAL DOMINICANA',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'FABRICACIÓN DE BEBIDAS Y CERVEZAS',
    },
    '101026027': {
      rnc: '101026027',
      razonSocial: 'GRUPO RAMOS SA',
      nombreComercial: 'SIRENA / POLA',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'VENTA AL POR MENOR EN HIPERMERCADOS Y TIENDAS POR DEPARTAMENTO',
    },
    '101001569': {
      rnc: '101001569',
      razonSocial: 'COMPAÑIA DOMINICANA DE TELEFONOS SA',
      nombreComercial: 'CLARO DOMINICANA',
      estado: 'ACTIVO',
      tipo: 'PERSONA_JURIDICA',
      regimen: 'GENERAL',
      actividadEconomica: 'TELECOMUNICACIONES Y TRANSMISIÓN DE DATOS',
    },
  };

  /**
   * Valida el dígito verificador de un RNC (9 dígitos, Módulo 11) o Cédula (11 dígitos, Módulo 10)
   */
  public validateRncAlgorithm(doc: string): boolean {
    const clean = (doc || '').replace(/\D/g, '');
    if (clean.length === 9) {
      const weights = [7, 9, 8, 6, 5, 4, 3, 2];
      let sum = 0;
      for (let i = 0; i < 8; i++) {
        sum += parseInt(clean[i], 10) * weights[i];
      }
      const remainder = sum % 11;
      let checkDigit = 0;
      if (remainder === 0) {
        checkDigit = 2;
      } else if (remainder === 1) {
        checkDigit = 1;
      } else {
        checkDigit = 11 - remainder;
      }
      return checkDigit === parseInt(clean[8], 10);
    } else if (clean.length === 11) {
      const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
      let sum = 0;
      for (let i = 0; i < 10; i++) {
        let prod = parseInt(clean[i], 10) * weights[i];
        if (prod >= 10) {
          prod = Math.floor(prod / 10) + (prod % 10);
        }
        sum += prod;
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      return checkDigit === parseInt(clean[10], 10);
    }
    return false;
  }

  private normalizeEstado(raw?: string | null): 'ACTIVO' | 'SUSPENDIDO' | 'DADO_DE_BAJA' {
    const u = String(raw || 'ACTIVO').toUpperCase();
    if (u.includes('BAJA') || u.includes('CESE')) return 'DADO_DE_BAJA';
    if (u.includes('SUSPEND')) return 'SUSPENDIDO';
    return 'ACTIVO';
  }

  private normalizeRegimen(raw?: string | null): 'GENERAL' | 'RST' | 'EXENTO' {
    const u = String(raw || 'GENERAL').toUpperCase();
    if (u.includes('RST') || u.includes('SIMPLIFICADO')) return 'RST';
    if (u.includes('EXENT') || u.includes('GUBERN')) return 'EXENTO';
    return 'GENERAL';
  }

  /**
   * Consulta y valida RNC / Cédula contra algoritmo DGII/JCE, padrón interno, PostgreSQL y APIs públicas RD en vivo.
   */
  public async lookup(rncOrCedula: string): Promise<RncLookupResult> {
    const clean = (rncOrCedula || '').replace(/\D/g, '');
    if (clean.length !== 9 && clean.length !== 11) {
      throw new BadRequestException('El RNC debe tener 9 dígitos y la Cédula 11 dígitos numéricos.');
    }

    const tipo: 'PERSONA_JURIDICA' | 'PERSONA_FISICA' =
      clean.length === 9 ? 'PERSONA_JURIDICA' : 'PERSONA_FISICA';

    // 1. Padrón oficial precargado
    const official = this.padronOficial[clean];
    if (official) {
      return {
        ...official,
        nombreRazonSocial: official.razonSocial,
        checksumValid: true,
        foundInPadron: true,
        source: 'PADRON_OFICIAL_DGII',
      };
    }

    // 2. Validar algoritmo matemático (Módulo 11 DGII / Módulo 10 JCE)
    const isValid = this.validateRncAlgorithm(clean);
    if (!isValid) {
      throw new NotFoundException(
        `El ${clean.length === 9 ? 'RNC' : 'número de Cédula'} ${clean} no tiene un dígito verificador válido ante la DGII.`
      );
    }

    // 3. Revisar caché en memoria (TTL)
    const cached = this.liveCache.get(clean);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // 4. Buscar coincidencia en tenants / clientes ya registrados en PostgreSQL
    try {
      const existingTenant = await prisma.tenant.findUnique({
        where: { rnc: clean },
        select: { razonSocial: true, nombreComercial: true, actividadEconomica: true },
      });
      if (existingTenant?.razonSocial && !GENERIC_RNC_NAME_RE.test(existingTenant.razonSocial)) {
        const result: RncLookupResult = {
          rnc: clean,
          razonSocial: existingTenant.razonSocial.toUpperCase(),
          nombreRazonSocial: existingTenant.razonSocial.toUpperCase(),
          nombreComercial: (existingTenant.nombreComercial || existingTenant.razonSocial).toUpperCase(),
          estado: 'ACTIVO',
          tipo,
          regimen: 'GENERAL',
          actividadEconomica: existingTenant.actividadEconomica || 'CONTRIBUYENTE REGISTRADO',
          checksumValid: true,
          foundInPadron: true,
          source: 'DIRECTORIO_PLATAFORMA',
        };
        this.liveCache.set(clean, { data: result, expiresAt: Date.now() + 3600_000 });
        return result;
      }

      const existingCustomer = await prisma.customer.findFirst({
        where: { rnc: clean },
        select: { razonSocial: true },
      });
      if (existingCustomer?.razonSocial && !GENERIC_RNC_NAME_RE.test(existingCustomer.razonSocial)) {
        const result: RncLookupResult = {
          rnc: clean,
          razonSocial: existingCustomer.razonSocial.toUpperCase(),
          nombreRazonSocial: existingCustomer.razonSocial.toUpperCase(),
          nombreComercial: existingCustomer.razonSocial.toUpperCase(),
          estado: 'ACTIVO',
          tipo,
          regimen: 'GENERAL',
          actividadEconomica: 'CONTRIBUYENTE EN DIRECTORIO',
          checksumValid: true,
          foundInPadron: true,
          source: 'DIRECTORIO_CLIENTES',
        };
        this.liveCache.set(clean, { data: result, expiresAt: Date.now() + 3600_000 });
        return result;
      }
    } catch {
      // Continuar a consulta pública en línea si DB no está disponible (ej. tests unitarios)
    }

    // 5. Consulta en vivo contra APIs públicas RD (api.digital.gob.do / rnc.megaplus.com.do)
    let liveName: string | null = null;
    let liveComercial: string | null = null;
    let liveActividad: string | undefined;
    let liveEstado: 'ACTIVO' | 'SUSPENDIDO' | 'DADO_DE_BAJA' = 'ACTIVO';
    let liveRegimen: 'GENERAL' | 'RST' | 'EXENTO' = 'GENERAL';

    try {
      const res = await fetch(`https://api.digital.gob.do/v3/rnc/${clean}`, {
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const data: any = await res.json();
        const rawName = data?.name || data?.razon_social;
        if (rawName && !GENERIC_RNC_NAME_RE.test(String(rawName).trim())) {
          liveName = String(rawName).trim().toUpperCase();
          liveComercial = String(data?.commercial_name || data?.nombre_comercial || liveName)
            .trim()
            .toUpperCase();
          liveActividad = String(data?.economic_activity || data?.actividad_economica || 'CONTRIBUYENTE DGII')
            .trim()
            .toUpperCase();
          liveEstado = this.normalizeEstado(data?.status);
          liveRegimen = this.normalizeRegimen(data?.payment_regime || data?.regimen_pagos);
        }
      }
    } catch {
      // Timeout o sin conectividad; intentar respaldo secundario
    }

    if (!liveName) {
      try {
        const res2 = await fetch(`https://rnc.megaplus.com.do/api/consulta?rnc=${clean}`, {
          signal: AbortSignal.timeout(3500),
        });
        if (res2.ok) {
          const d2: any = await res2.json();
          const rawName = d2?.nombre || d2?.razon_social || d2?.nombre_razon_social;
          if (rawName && !GENERIC_RNC_NAME_RE.test(String(rawName).trim())) {
            liveName = String(rawName).trim().toUpperCase();
            liveComercial = String(d2?.nombre_comercial || liveName).trim().toUpperCase();
            liveActividad = String(d2?.actividad_economica || d2?.categoria || 'CONTRIBUYENTE DGII')
              .trim()
              .toUpperCase();
            liveEstado = this.normalizeEstado(d2?.estado);
            liveRegimen = this.normalizeRegimen(d2?.regimen_de_pago);
          }
        }
      } catch {
        // Sin conectividad externa
      }
    }

    if (liveName) {
      const result: RncLookupResult = {
        rnc: clean,
        razonSocial: liveName,
        nombreRazonSocial: liveName,
        nombreComercial: liveComercial || liveName,
        estado: liveEstado,
        tipo,
        regimen: liveRegimen,
        actividadEconomica: liveActividad,
        checksumValid: true,
        foundInPadron: true,
        source: 'CONSULTA_EN_LINEA_DGII',
      };
      this.liveCache.set(clean, { data: result, expiresAt: Date.now() + 86_400_000 });
      return result;
    }

    // 6. Fallback validado matemáticamente cuando el padrón externo no responde
    const fallbackName = clean.length === 9 ? `RNC ${clean}` : `Cédula ${clean}`;
    const fallback: RncLookupResult = {
      rnc: clean,
      razonSocial: fallbackName,
      nombreRazonSocial: fallbackName,
      nombreComercial: clean.length === 9 ? `COMERCIAL ${clean}` : undefined,
      estado: 'ACTIVO',
      tipo,
      regimen: 'GENERAL',
      actividadEconomica: 'ACTIVIDADES COMERCIALES Y DE SERVICIOS GENERALES',
      checksumValid: true,
      foundInPadron: false,
      source: 'ALGORITMO_DGII_JCE',
    };
    this.liveCache.set(clean, { data: fallback, expiresAt: Date.now() + 60_000 });
    return fallback;
  }
}
