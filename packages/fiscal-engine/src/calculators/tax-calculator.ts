import {
  DomainInvoice,
  DomainInvoiceItem,
  IndicadorFacturacion,
  IndicadorMontoGravado,
} from '../types/fiscal.types';

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export interface CalculatedTotals {
  montoGravadoTotal?: number;
  montoGravadoI1?: number;
  montoGravadoI2?: number;
  montoGravadoI3?: number;
  itbis1?: number;
  itbis2?: number;
  itbis3?: number;
  totalItbis?: number;
  totalItbis1?: number;
  totalItbis2?: number;
  totalItbis3?: number;
  montoExento?: number;
  montoNoFacturable?: number;
  montoImpuestoAdicional?: number;
  totalItbisRetenido?: number;
  totalIsrRetencion?: number;
  montoTotal: number;

  // Otra Moneda
  montoGravadoTotalOtraMoneda?: number;
  montoGravado1OtraMoneda?: number;
  montoGravado2OtraMoneda?: number;
  montoGravado3OtraMoneda?: number;
  montoExentoOtraMoneda?: number;
  totalItbisOtraMoneda?: number;
  totalItbis1OtraMoneda?: number;
  totalItbis2OtraMoneda?: number;
  totalItbis3OtraMoneda?: number;
  montoTotalOtraMoneda?: number;
}

export class TaxCalculator {
  /**
   * Calcula los montos individuales de cada línea y totales consolidados del comprobante.
   */
  public static calculateInvoice(invoice: DomainInvoice): {
    items: DomainInvoiceItem[];
    totales: CalculatedTotals;
  } {
    let hasGravadoI1 = false;
    let hasGravadoI2 = false;
    let hasGravadoI3 = false;
    let hasExento = false;
    let hasNoFacturable = false;
    let hasRetencionItbis = false;
    let hasRetencionIsr = false;

    let sumGravadoI1 = 0;
    let sumGravadoI2 = 0;
    let sumGravadoI3 = 0;
    let sumItbisI1 = 0;
    let sumItbisI2 = 0;
    let sumExento = 0;
    let sumNoFacturable = 0;
    let sumRetenidoItbis = 0;
    let sumRetenidoIsr = 0;

    const calculatedItems: DomainInvoiceItem[] = invoice.items.map((item, index) => {
      const cantidad = item.cantidadItem;
      const precio = item.precioUnitarioItem;
      const descuento = item.descuentoMonto ? round2(item.descuentoMonto) : 0;
      const recargo = item.recargoMonto ? round2(item.recargoMonto) : 0;

      // MontoItem = round2((Cantidad * Precio) - Descuento + Recargo)
      const subtotalBruto = cantidad * precio;
      const montoItem = round2(subtotalBruto - descuento + recargo);

      const itbisRetenido = item.montoItbisRetenido !== undefined ? round2(item.montoItbisRetenido) : undefined;
      const isrRetenido = item.montoIsrRetenido !== undefined ? round2(item.montoIsrRetenido) : undefined;

      if (itbisRetenido !== undefined && itbisRetenido >= 0) {
        hasRetencionItbis = true;
        sumRetenidoItbis += itbisRetenido;
      }

      if (isrRetenido !== undefined && isrRetenido >= 0) {
        hasRetencionIsr = true;
        sumRetenidoIsr += isrRetenido;
      }

      switch (item.indicadorFacturacion) {
        case IndicadorFacturacion.ITBIS_18:
          hasGravadoI1 = true;
          sumGravadoI1 += montoItem;
          if (invoice.precioIncluyeItbis) {
            const lineItbis =
              item.itbisLinea !== undefined
                ? round2(item.itbisLinea)
                : round2((item.totalLinea ?? round2(montoItem * 1.18)) - montoItem);
            sumItbisI1 += lineItbis;
          }
          break;
        case IndicadorFacturacion.ITBIS_16:
          hasGravadoI2 = true;
          sumGravadoI2 += montoItem;
          if (invoice.precioIncluyeItbis) {
            const lineItbis =
              item.itbisLinea !== undefined
                ? round2(item.itbisLinea)
                : round2((item.totalLinea ?? round2(montoItem * 1.16)) - montoItem);
            sumItbisI2 += lineItbis;
          }
          break;
        case IndicadorFacturacion.ITBIS_0:
          hasGravadoI3 = true;
          sumGravadoI3 += montoItem;
          break;
        case IndicadorFacturacion.EXENTO:
          hasExento = true;
          sumExento += montoItem;
          break;
        case IndicadorFacturacion.NO_FACTURABLE:
          hasNoFacturable = true;
          sumNoFacturable += montoItem;
          break;
      }

      let precioOtraMoneda = item.precioOtraMoneda;
      let montoItemOtraMoneda = item.montoItemOtraMoneda;

      if (invoice.otraMoneda && invoice.otraMoneda.tipoCambio > 0) {
        const tc = invoice.otraMoneda.tipoCambio;
        if (!precioOtraMoneda) {
          precioOtraMoneda = round4(precio / tc);
        }
        if (!montoItemOtraMoneda) {
          montoItemOtraMoneda = round2(montoItem / tc);
        }
      }

      return {
        ...item,
        numeroLinea: item.numeroLinea || index + 1,
        precioUnitarioItem: precio,
        descuentoMonto: descuento,
        recargoMonto: recargo,
        montoItem,
        montoItbisRetenido: itbisRetenido,
        montoIsrRetenido: isrRetenido,
        precioOtraMoneda,
        montoItemOtraMoneda,
      };
    });

    const totales: CalculatedTotals = {
      montoTotal: 0,
    };

    // 1. Montos Gravados
    if (hasGravadoI1) {
      totales.montoGravadoI1 = round2(sumGravadoI1);
      totales.itbis1 = 18;
      totales.totalItbis1 = invoice.precioIncluyeItbis
        ? round2(sumItbisI1)
        : round2(totales.montoGravadoI1 * 0.18);
    }

    if (hasGravadoI2) {
      totales.montoGravadoI2 = round2(sumGravadoI2);
      totales.itbis2 = 16;
      totales.totalItbis2 = invoice.precioIncluyeItbis
        ? round2(sumItbisI2)
        : round2(totales.montoGravadoI2 * 0.16);
    }

    if (hasGravadoI3) {
      totales.montoGravadoI3 = round2(sumGravadoI3);
      totales.itbis3 = 0;
      totales.totalItbis3 = 0.0;
    }

    if (hasGravadoI1 || hasGravadoI2 || hasGravadoI3) {
      totales.montoGravadoTotal = round2(
        (totales.montoGravadoI1 || 0) +
        (totales.montoGravadoI2 || 0) +
        (totales.montoGravadoI3 || 0)
      );

      totales.totalItbis = round2(
        (totales.totalItbis1 || 0) +
        (totales.totalItbis2 || 0) +
        (totales.totalItbis3 || 0)
      );
    }

    if (hasExento) {
      totales.montoExento = round2(sumExento);
    }

    if (hasNoFacturable) {
      totales.montoNoFacturable = round2(sumNoFacturable);
    }

    // Retenciones
    if (hasRetencionItbis) {
      totales.totalItbisRetenido = round2(sumRetenidoItbis);
    }

    if (hasRetencionIsr) {
      totales.totalIsrRetencion = round2(sumRetenidoIsr);
    }

    // Comprobante 41 exige reportar retenciones (al menos 0.00 si no aplica)
    if (invoice.tipoEcf === 41) {
      if (totales.totalItbisRetenido === undefined) totales.totalItbisRetenido = 0.0;
      if (totales.totalIsrRetencion === undefined) totales.totalIsrRetencion = 0.0;
    }

    // Comprobante 47 exige reportar TotalISRRetencion (0.00 si no aplica)
    if (invoice.tipoEcf === 47 && totales.totalIsrRetencion === undefined) {
      totales.totalIsrRetencion = 0.0;
    }

    // Monto Total = MontoGravadoTotal + MontoExento + TotalITBIS + MontoImpuestoAdicional
    const gravado = totales.montoGravadoTotal || 0;
    const exento = totales.montoExento || 0;
    const itbis = totales.totalItbis || 0;
    const impuestosAdicionales = totales.montoImpuestoAdicional || 0;

    totales.montoTotal = round2(gravado + exento + itbis + impuestosAdicionales);

    // Moneda extranjera
    if (invoice.otraMoneda && invoice.otraMoneda.tipoCambio > 0) {
      const tc = invoice.otraMoneda.tipoCambio;
      if (totales.montoGravadoTotal !== undefined) {
        totales.montoGravadoTotalOtraMoneda = round2(totales.montoGravadoTotal / tc);
      }
      if (totales.montoGravadoI1 !== undefined) {
        totales.montoGravado1OtraMoneda = round2(totales.montoGravadoI1 / tc);
      }
      if (totales.montoGravadoI2 !== undefined) {
        totales.montoGravado2OtraMoneda = round2(totales.montoGravadoI2 / tc);
      }
      if (totales.montoGravadoI3 !== undefined) {
        totales.montoGravado3OtraMoneda = round2(totales.montoGravadoI3 / tc);
      }
      if (totales.montoExento !== undefined) {
        totales.montoExentoOtraMoneda = round2(totales.montoExento / tc);
      }
      if (totales.totalItbis !== undefined) {
        totales.totalItbisOtraMoneda = round2(totales.totalItbis / tc);
      }
      if (totales.totalItbis1 !== undefined) {
        totales.totalItbis1OtraMoneda = round2(totales.totalItbis1 / tc);
      }
      if (totales.totalItbis2 !== undefined) {
        totales.totalItbis2OtraMoneda = round2(totales.totalItbis2 / tc);
      }
      if (totales.totalItbis3 !== undefined) {
        totales.totalItbis3OtraMoneda = round2(totales.totalItbis3 / tc);
      }
      totales.montoTotalOtraMoneda = round2(totales.montoTotal / tc);
    }

    return {
      items: calculatedItems,
      totales,
    };
  }
}
