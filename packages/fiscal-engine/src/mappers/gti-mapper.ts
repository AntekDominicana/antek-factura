import {
  DomainInvoice,
  GtiInvoicePayload,
  GtiTotales,
  GtiDetalleItem,
  GtiTotalesOtraMoneda,
} from '../types/fiscal.types';
import { TaxCalculator } from '../calculators/tax-calculator';

export class GtiMapper {
  /**
   * Convierte una fecha a formato estándar GTI: dd-MM-yyyy
   */
  public static formatDate(dateInput?: Date | string): string {
    if (!dateInput) {
      dateInput = new Date();
    }
    if (typeof dateInput === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(dateInput)) {
      return dateInput;
    }
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Mapea un DomainInvoice al payload exacto esperado por la API de GTI,
   * respetando rigurosamente la regla de omisión de campos cero en Totales.
   */
  public static toGtiPayload(domainInvoice: DomainInvoice): GtiInvoicePayload {
    // 1. Calcular totales matemáticos
    const { items: calculatedItems, totales } = TaxCalculator.calculateInvoice(domainInvoice);

    // 2. Construir IdDoc
    const idDoc: GtiInvoicePayload['Encabezado']['IdDoc'] = {
      TipoeCF: domainInvoice.tipoEcf,
    };

    if (domainInvoice.encf) {
      idDoc.eNCF = domainInvoice.encf;
    }

    if (domainInvoice.fechaVencimientoSecuencia) {
      idDoc.FechaVencimientoSecuencia = this.formatDate(domainInvoice.fechaVencimientoSecuencia);
    }

    if (domainInvoice.indicadorMontoGravado !== undefined) {
      idDoc.IndicadorMontoGravado = domainInvoice.indicadorMontoGravado;
    }

    if (domainInvoice.tipoIngresos) {
      idDoc.TipoIngresos = domainInvoice.tipoIngresos;
    }

    if (domainInvoice.tipoPago !== undefined) {
      idDoc.TipoPago = domainInvoice.tipoPago;
    }

    if (domainInvoice.fechaLimitePago) {
      idDoc.FechaLimitePago = this.formatDate(domainInvoice.fechaLimitePago);
    }

    if (domainInvoice.terminoPago) {
      idDoc.TerminoPago = domainInvoice.terminoPago;
    }

    if (domainInvoice.formaPago) {
      idDoc.TablaFormasPago = [
        {
          FormaPago: domainInvoice.formaPago,
          MontoPago: domainInvoice.montoPago !== undefined ? domainInvoice.montoPago : totales.montoTotal,
        },
      ];
    }

    // 3. Construir Emisor
    const emisor: GtiInvoicePayload['Encabezado']['Emisor'] = {
      FechaEmision: this.formatDate(domainInvoice.fechaEmision),
      EmisorPorDefecto: domainInvoice.emisor?.emisorPorDefecto ?? true,
    };

    if (domainInvoice.emisor?.rnc) {
      emisor.RNCEmisor = domainInvoice.emisor.rnc;
    }
    if (domainInvoice.emisor?.razonSocial) {
      emisor.RazonSocialEmisor = domainInvoice.emisor.razonSocial;
    }
    if (domainInvoice.emisor?.nombreComercial) {
      emisor.NombreComercial = domainInvoice.emisor.nombreComercial;
    }
    if (domainInvoice.emisor?.direccion) {
      emisor.DireccionEmisor = domainInvoice.emisor.direccion;
    }
    if (domainInvoice.emisor?.numeroSucursal !== undefined) {
      emisor.NumeroSucursal = domainInvoice.emisor.numeroSucursal;
    }
    if (domainInvoice.externalDocId) {
      emisor.NumeroFacturaInterna = domainInvoice.externalDocId;
    }

    // 4. Construir Comprador
    let comprador: GtiInvoicePayload['Encabezado']['Comprador'] | undefined = undefined;
    if (domainInvoice.comprador) {
      comprador = {};
      if (domainInvoice.comprador.rncComprador) {
        comprador.RNCComprador = domainInvoice.comprador.rncComprador;
      }
      if (domainInvoice.comprador.identificadorExtranjero) {
        comprador.IdentificadorExtranjero = domainInvoice.comprador.identificadorExtranjero;
      }
      if (domainInvoice.comprador.razonSocialComprador) {
        comprador.RazonSocialComprador = domainInvoice.comprador.razonSocialComprador;
      }
      if (domainInvoice.comprador.contactoComprador) {
        comprador.ContactoComprador = domainInvoice.comprador.contactoComprador;
      }
      if (domainInvoice.comprador.correoComprador) {
        comprador.CorreoComprador = domainInvoice.comprador.correoComprador;
      }
      if (domainInvoice.comprador.direccionComprador) {
        comprador.DireccionComprador = domainInvoice.comprador.direccionComprador;
      }
      if (domainInvoice.comprador.municipioComprador) {
        comprador.MunicipioComprador = domainInvoice.comprador.municipioComprador;
      }
      if (domainInvoice.comprador.provinciaComprador) {
        comprador.ProvinciaComprador = domainInvoice.comprador.provinciaComprador;
      }
      if (domainInvoice.comprador.paisComprador) {
        comprador.PaisComprador = domainInvoice.comprador.paisComprador;
      }
    }

    // 5. Construir Totales aplicando OMISIÓN ESTRICTA DE CAMPOS CERO
    const gtiTotales: GtiTotales = {
      MontoTotal: totales.montoTotal,
    };

    if (totales.montoGravadoTotal !== undefined) {
      gtiTotales.MontoGravadoTotal = totales.montoGravadoTotal;
    }

    // Tasa 1 (18%)
    if (totales.montoGravadoI1 !== undefined) {
      gtiTotales.MontoGravadoI1 = totales.montoGravadoI1;
      gtiTotales.ITBIS1 = totales.itbis1 ?? 18;
      gtiTotales.TotalITBIS1 = totales.totalItbis1;
    }

    // Tasa 2 (16%)
    if (totales.montoGravadoI2 !== undefined) {
      gtiTotales.MontoGravadoI2 = totales.montoGravadoI2;
      gtiTotales.ITBIS2 = totales.itbis2 ?? 16;
      gtiTotales.TotalITBIS2 = totales.totalItbis2;
    }

    // Tasa 3 (0%)
    if (totales.montoGravadoI3 !== undefined) {
      gtiTotales.MontoGravadoI3 = totales.montoGravadoI3;
      gtiTotales.ITBIS3 = totales.itbis3 ?? 0;
      gtiTotales.TotalITBIS3 = totales.totalItbis3;
    }

    // Total ITBIS general
    if (totales.totalItbis !== undefined) {
      gtiTotales.TotalITBIS = totales.totalItbis;
    }

    // Monto Exento
    if (totales.montoExento !== undefined) {
      gtiTotales.MontoExento = totales.montoExento;
    }

    // Monto No Facturable
    if (totales.montoNoFacturable !== undefined) {
      gtiTotales.MontoNoFacturable = totales.montoNoFacturable;
    }

    // Retenciones
    if (totales.totalItbisRetenido !== undefined) {
      gtiTotales.TotalITBISRetenido = totales.totalItbisRetenido;
    }
    if (totales.totalIsrRetencion !== undefined) {
      gtiTotales.TotalISRRetencion = totales.totalIsrRetencion;
    }

    // 6. Totales Otra Moneda
    let gtiOtraMoneda: GtiTotalesOtraMoneda | undefined = undefined;
    if (domainInvoice.otraMoneda && domainInvoice.otraMoneda.tipoCambio > 0) {
      gtiOtraMoneda = {
        TipoMoneda: domainInvoice.otraMoneda.tipoMoneda,
        TipoCambio: domainInvoice.otraMoneda.tipoCambio,
        MontoTotalOtraMoneda: totales.montoTotalOtraMoneda || 0,
      };

      if (totales.montoGravadoTotalOtraMoneda !== undefined) {
        gtiOtraMoneda.MontoGravadoTotalOtraMoneda = totales.montoGravadoTotalOtraMoneda;
      }
      if (totales.montoGravado1OtraMoneda !== undefined) {
        gtiOtraMoneda.MontoGravado1OtraMoneda = totales.montoGravado1OtraMoneda;
      }
      if (totales.montoGravado2OtraMoneda !== undefined) {
        gtiOtraMoneda.MontoGravado2OtraMoneda = totales.montoGravado2OtraMoneda;
      }
      if (totales.montoGravado3OtraMoneda !== undefined) {
        gtiOtraMoneda.MontoGravado3OtraMoneda = totales.montoGravado3OtraMoneda;
      }
      if (totales.montoExentoOtraMoneda !== undefined) {
        gtiOtraMoneda.MontoExentoOtraMoneda = totales.montoExentoOtraMoneda;
      }
      if (totales.totalItbisOtraMoneda !== undefined) {
        gtiOtraMoneda.TotalITBISOtraMoneda = totales.totalItbisOtraMoneda;
      }
      if (totales.totalItbis1OtraMoneda !== undefined) {
        gtiOtraMoneda.TotalITBIS1OtraMoneda = totales.totalItbis1OtraMoneda;
      }
      if (totales.totalItbis2OtraMoneda !== undefined) {
        gtiOtraMoneda.TotalITBIS2OtraMoneda = totales.totalItbis2OtraMoneda;
      }
      if (totales.totalItbis3OtraMoneda !== undefined) {
        gtiOtraMoneda.TotalITBIS3OtraMoneda = totales.totalItbis3OtraMoneda;
      }
    }

    // 7. Detalles Items
    const gtiItems: GtiDetalleItem[] = calculatedItems.map((item) => {
      const gtiItem: GtiDetalleItem = {
        NumeroLinea: item.numeroLinea,
        IndicadorFacturacion: item.indicadorFacturacion,
        NombreItem: item.nombreItem,
        IndicadorBienoServicio: item.indicadorBienServicio,
        CantidadItem: item.cantidadItem,
        PrecioUnitarioItem: item.precioUnitarioItem,
        MontoItem: item.montoItem!,
      };

      if (item.descripcionItem) {
        gtiItem.DescripcionItem = item.descripcionItem;
      }
      if (item.unidadMedida !== undefined) {
        gtiItem.UnidadMedida = item.unidadMedida;
      }
      if (item.descuentoMonto && item.descuentoMonto > 0) {
        gtiItem.DescuentoMonto = item.descuentoMonto;
      }
      if (item.recargoMonto && item.recargoMonto > 0) {
        gtiItem.RecargoMonto = item.recargoMonto;
      }
      if (item.codigoItem) {
        gtiItem.TablaCodigosItem = [
          {
            TipoCodigo: item.tipoCodigo || 'Interna',
            CodigoItem: item.codigoItem,
          },
        ];
      }

      if (item.montoItbisRetenido !== undefined || item.montoIsrRetenido !== undefined) {
        gtiItem.Retencion = {
          IndicadorAgenteRetencionoPercepcion: item.indicadorAgenteRetencion || 1,
          MontoITBISRetenido: item.montoItbisRetenido || 0.0,
          MontoISRRetenido: item.montoIsrRetenido || 0.0,
        };
      }

      if (item.precioOtraMoneda !== undefined && item.montoItemOtraMoneda !== undefined) {
        gtiItem.OtraMonedaDetalle = {
          PrecioOtraMoneda: item.precioOtraMoneda,
          MontoItemOtraMoneda: item.montoItemOtraMoneda,
        };
      }

      return gtiItem;
    });

    // 8. Información de Referencia
    let gtiReferencia: GtiInvoicePayload['InformacionReferencia'] | undefined = undefined;
    if (domainInvoice.references && domainInvoice.references.length > 0) {
      const ref = domainInvoice.references[0];
      gtiReferencia = {
        NCFModificado: ref.ncfModificado,
        FechaNCFModificado: this.formatDate(ref.fechaNcfModificado),
        CodigoModificacion: ref.codigoModificacion,
      };
      if (ref.razonModificacion) {
        gtiReferencia.RazonModificacion = ref.razonModificacion;
      }
    }

    const payload: GtiInvoicePayload = {
      Encabezado: {
        IdDoc: idDoc,
        Emisor: emisor,
        Comprador: comprador,
        Totales: gtiTotales,
      },
      DetallesItems: gtiItems,
    };

    if (gtiOtraMoneda) {
      payload.Encabezado.TotalesOtraMoneda = gtiOtraMoneda;
    }

    if (gtiReferencia) {
      payload.InformacionReferencia = gtiReferencia;
    }

    return payload;
  }
}
