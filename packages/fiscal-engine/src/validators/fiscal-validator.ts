import {
  DomainInvoice,
  EcfType,
  IndicadorBienServicio,
  IndicadorFacturacion,
  TipoPago,
  FormaPago,
  IndicadorNotaCredito,
} from '../types/fiscal.types';
import { FiscalValidationException } from '../constants/gti-error-codes';
import { round2 } from '../calculators/tax-calculator';

export class FiscalValidator {
  private static readonly VALID_ECF_TYPES: number[] = [31, 32, 33, 34, 41, 43, 44, 45, 46, 47];

  public static validate(invoice: DomainInvoice): void {
    // 1. Validar Tipo e-CF
    if (!this.VALID_ECF_TYPES.includes(invoice.tipoEcf)) {
      throw new FiscalValidationException(
        1101,
        `Tipo de e-CF ${invoice.tipoEcf} no es válido según la normativa DGII.`
      );
    }

    // 2. Validar que existan líneas de detalle
    if (!invoice.items || invoice.items.length === 0) {
      throw new FiscalValidationException(
        1803,
        'El comprobante debe contener al menos una línea de detalle.'
      );
    }

    // 3. Validar límites de líneas (1000 para tipo 32; 100 para los demás)
    const maxItems = invoice.tipoEcf === EcfType.CONSUMO ? 1000 : 100;
    if (invoice.items.length > maxItems) {
      throw new FiscalValidationException(
        1803,
        `La cantidad de líneas (${invoice.items.length}) excede el límite máximo permitido (${maxItems}) para el tipo de e-CF ${invoice.tipoEcf}.`
      );
    }

    // 4. Validar numeración secuencial de líneas 1..N
    invoice.items.forEach((item, index) => {
      const expectedNumber = index + 1;
      const actualNumber = item.numeroLinea || expectedNumber;
      if (actualNumber !== expectedNumber) {
        throw new FiscalValidationException(
          1820,
          `La línea en posición ${expectedNumber} tiene NumeroLinea = ${actualNumber}. Debe ser estrictamente secuencial.`
        );
      }

      // Validar monto de línea: MontoItem = (Cantidad * Precio) - Descuento + Recargo
      const expectedMonto = round2(
        item.cantidadItem * item.precioUnitarioItem - (item.descuentoMonto || 0) + (item.recargoMonto || 0)
      );
      if (item.montoItem !== undefined && Math.abs(item.montoItem - expectedMonto) > 0.05) {
        throw new FiscalValidationException(
          1817,
          `MontoItem inválido en línea ${expectedNumber}. Esperado: ${expectedMonto}, recibido: ${item.montoItem}.`
        );
      }
    });

    const montoTotal = invoice.totalesCalculados?.montoTotal || 0;

    // 5. REGLA CRÍTICA >= 250,000 DOP para TipoeCF = 32, 33, 34
    if (montoTotal >= 250_000 && [EcfType.CONSUMO, EcfType.NOTA_DEBITO, EcfType.NOTA_CREDITO].includes(invoice.tipoEcf)) {
      if (!invoice.comprador?.rncComprador) {
        throw new FiscalValidationException(
          1306,
          `RNCComprador es obligatorio cuando el tipo de documento es ${invoice.tipoEcf} y el monto es >= DOP $250,000.00.`
        );
      }
      if (!invoice.comprador?.razonSocialComprador) {
        throw new FiscalValidationException(
          1307,
          `RazonSocialComprador es obligatorio cuando el tipo de documento es ${invoice.tipoEcf} y el monto es >= DOP $250,000.00.`
        );
      }
    }

    // 6. Reglas específicas por Tipo de e-CF:
    switch (invoice.tipoEcf) {
      case EcfType.CREDITO_FISCAL: {
        // 31: Exige RNCComprador y RazonSocialComprador
        if (!invoice.comprador?.rncComprador) {
          throw new FiscalValidationException(1301, 'RNCComprador es obligatorio para Factura de Crédito Fiscal (31).');
        }
        if (!invoice.comprador?.razonSocialComprador) {
          throw new FiscalValidationException(1302, 'RazonSocialComprador es obligatorio para Factura de Crédito Fiscal (31).');
        }
        break;
      }

      case EcfType.GASTOS_MENORES: {
        // 43: Todos los ítems deben ser exentos (IndicadorFacturacion = 4)
        const hasNonExempt = invoice.items.some((i) => i.indicadorFacturacion !== IndicadorFacturacion.EXENTO);
        if (hasNonExempt) {
          throw new FiscalValidationException(
            1804,
            'Para Factura de Gastos Menores (43), todos los ítems deben tener IndicadorFacturacion = 4 (Exento).'
          );
        }
        break;
      }

      case EcfType.REGIMENES_ESPECIALES: {
        // 44: Todos los ítems deben ser exentos (IndicadorFacturacion = 4)
        const hasNonExempt = invoice.items.some((i) => i.indicadorFacturacion !== IndicadorFacturacion.EXENTO);
        if (hasNonExempt) {
          throw new FiscalValidationException(
            1804,
            'Para Factura de Regímenes Especiales (44), todos los ítems deben tener IndicadorFacturacion = 4 (Exento).'
          );
        }
        break;
      }

      case EcfType.EXPORTACION: {
        // 46: Todos los ítems deben tener ITBIS 0% (IndicadorFacturacion = 3)
        const hasNonZeroTax = invoice.items.some((i) => i.indicadorFacturacion !== IndicadorFacturacion.ITBIS_0);
        if (hasNonZeroTax) {
          throw new FiscalValidationException(
            1805,
            'Para Factura de Exportación (46), todos los ítems deben tener IndicadorFacturacion = 3 (ITBIS Tasa Cero).'
          );
        }

        // Exige RNCComprador O IdentificadorExtranjero, NUNCA ambos
        const hasRnc = Boolean(invoice.comprador?.rncComprador);
        const hasExt = Boolean(invoice.comprador?.identificadorExtranjero);

        if (!hasRnc && !hasExt) {
          throw new FiscalValidationException(
            1308,
            'Factura de Exportación (46) requiere RNCComprador o IdentificadorExtranjero.'
          );
        }
        if (hasRnc && hasExt) {
          throw new FiscalValidationException(
            1305,
            'No debe existir RNCComprador si ya existe IdentificadorExtranjero en Factura de Exportación (46).'
          );
        }
        break;
      }

      case EcfType.PAGOS_AL_EXTERIOR: {
        // 47: Ítems exentos (4), servicios (2) y retención ISR obligatoria
        const hasNonExempt = invoice.items.some((i) => i.indicadorFacturacion !== IndicadorFacturacion.EXENTO);
        if (hasNonExempt) {
          throw new FiscalValidationException(
            1804,
            'Para Comprobante de Pagos al Exterior (47), todos los ítems deben ser Exentos (IndicadorFacturacion = 4).'
          );
        }
        const hasNonService = invoice.items.some((i) => i.indicadorBienServicio !== IndicadorBienServicio.SERVICIO);
        if (hasNonService) {
          throw new FiscalValidationException(
            1806,
            'Para Comprobante de Pagos al Exterior (47), IndicadorBienoServicio debe ser 2 (Servicio).'
          );
        }
        if (invoice.totalesCalculados?.totalIsrRetencion === undefined) {
          throw new FiscalValidationException(
            1445,
            'TotalISRRetencion es obligatorio para Comprobante de Pagos al Exterior (47).'
          );
        }
        break;
      }

      case EcfType.NOTA_CREDITO: {
        // 34: Exige InformacionReferencia
        if (!invoice.references || invoice.references.length === 0) {
          throw new FiscalValidationException(
            1504,
            'Para Notas de Crédito (34) es obligatoria la Información de Referencia del documento original.'
          );
        }
        this.validateReferences(invoice.references, invoice.fechaEmision);
        break;
      }

      case EcfType.NOTA_DEBITO: {
        // 33: Exige InformacionReferencia
        if (!invoice.references || invoice.references.length === 0) {
          throw new FiscalValidationException(
            1504,
            'Para Notas de Débito (33) es obligatoria la Información de Referencia del documento original.'
          );
        }
        this.validateReferences(invoice.references, invoice.fechaEmision);
        break;
      }

      case EcfType.COMPRAS: {
        // 41: Exige retenciones informadas
        if (
          invoice.totalesCalculados?.totalItbisRetenido === undefined ||
          invoice.totalesCalculados?.totalIsrRetencion === undefined
        ) {
          throw new FiscalValidationException(
            1444,
            'Para Comprobante de Compras (41) deben informarse TotalITBISRetenido y TotalISRRetencion (mínimo 0.00).'
          );
        }
        break;
      }
    }

    // 7. Validar Forma de Pago 5 (Bonos)
    if (invoice.formaPago === FormaPago.BONOS_CERTIFICADOS_REGALO && invoice.tipoEcf !== EcfType.CONSUMO) {
      throw new FiscalValidationException(
        1106,
        'La FormaPago 5 (Bonos o Certificados de regalo) solo está permitida en TipoeCF = 32 (Factura Consumo).'
      );
    }

    // 8. Validar FechaLimitePago si TipoPago = 2 (Crédito)
    if (invoice.tipoPago === TipoPago.CREDITO) {
      if (!invoice.fechaLimitePago) {
        throw new FiscalValidationException(
          1104,
          'FechaLimitePago es obligatorio para facturas con TipoPago = 2 (Crédito).'
        );
      }

      const emision = this.parseDate(invoice.fechaEmision || new Date());
      const limite = this.parseDate(invoice.fechaLimitePago);
      if (limite <= emision) {
        throw new FiscalValidationException(
          1105,
          'FechaLimitePago debe ser estrictamente posterior a FechaEmision en ventas a crédito.'
        );
      }
    }

    // 9. Validar consistencia matemática en totales
    if (invoice.totalesCalculados) {
      const t = invoice.totalesCalculados;
      const expectedTotal = round2(
        (t.montoGravadoTotal || 0) + (t.montoExento || 0) + (t.totalItbis || 0) + (t.montoImpuestoAdicional || 0)
      );
      if (Math.abs(t.montoTotal - expectedTotal) > 0.02) {
        throw new FiscalValidationException(
          1450,
          `MontoTotal inválido (${t.montoTotal}). La sumatoria esperada es ${expectedTotal}.`
        );
      }
    }
  }

  private static validateReferences(references: DomainInvoice['references'] = [], fechaEmision?: Date | string): void {
    const emisionDate = this.parseDate(fechaEmision || new Date());

    references.forEach((ref, idx) => {
      if (!ref.ncfModificado || !ref.fechaNcfModificado || !ref.codigoModificacion) {
        throw new FiscalValidationException(
          1510,
          `Referencia ${idx + 1}: NCFModificado, FechaNCFModificado y CodigoModificacion no pueden estar vacíos.`
        );
      }

      // NCF modificado longitud 11, 13 o 19
      const len = ref.ncfModificado.trim().length;
      if (![11, 13, 19].includes(len)) {
        throw new FiscalValidationException(
          1509,
          `NCFModificado "${ref.ncfModificado}" debe tener longitud de 11, 13 o 19 caracteres.`
        );
      }

      // Validar IndicadorNotaCredito según días transcurridos
      const ncfDate = this.parseDate(ref.fechaNcfModificado);
      const diffMs = emisionDate.getTime() - ncfDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (ref.indicadorNotaCredito !== undefined) {
        const expectedIndicador = diffDays <= 30 ? IndicadorNotaCredito.MENOR_IGUAL_30_DIAS : IndicadorNotaCredito.MAYOR_30_DIAS;
        if (ref.indicadorNotaCredito !== expectedIndicador) {
          throw new FiscalValidationException(
            1507,
            `IndicadorNotaCredito incorrecto (${ref.indicadorNotaCredito}). Han transcurrido ${diffDays} días; debe ser ${expectedIndicador}.`
          );
        }
      }
    });
  }

  private static parseDate(val: Date | string): Date {
    if (val instanceof Date) return val;
    if (val.includes('-')) {
      const parts = val.split('-');
      if (parts[0].length === 2) {
        // dd-MM-yyyy
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
    return new Date(val);
  }
}
