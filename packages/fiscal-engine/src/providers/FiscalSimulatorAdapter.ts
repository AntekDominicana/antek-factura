import {
  FiscalProviderInterface,
  FiscalEmissionResult,
  TenantFiscalCredentials,
  DomainInvoice,
  GtiConsultaEstadoResponse,
  GtiSecuenciaItem,
  GtiSecuenciaResponse,
} from '../types/fiscal.types';
import { FiscalValidator } from '../validators/fiscal-validator';
import { TaxCalculator } from '../calculators/tax-calculator';

export class FiscalSimulatorAdapter implements FiscalProviderInterface {
  public readonly name = 'SIMULATOR';
  private simulateFailureCode?: number;

  constructor(simulateFailureCode?: number) {
    this.simulateFailureCode = simulateFailureCode;
  }

  public setFailureSimulation(code?: number) {
    this.simulateFailureCode = code;
  }

  public async emitInvoice(
    credentials: TenantFiscalCredentials,
    invoice: DomainInvoice,
    options?: { returnXml?: 0 | 1 }
  ): Promise<FiscalEmissionResult> {
    // Valida las reglas de negocio igual que el entorno real
    FiscalValidator.validate(invoice);
    const { totales } = TaxCalculator.calculateInvoice(invoice);

    if (this.simulateFailureCode) {
      return {
        success: false,
        status: 'REJECTED',
        encf: invoice.encf || `E${invoice.tipoEcf}0000000001`,
        errorCode: String(this.simulateFailureCode),
        errorMessage: `Simulación de fallo fiscal código ${this.simulateFailureCode}`,
      };
    }

    const fakeEncf = invoice.encf || `E${invoice.tipoEcf}0000000190`;
    const fakeDocId = Math.floor(Math.random() * 90000) + 10000;
    const fakeSecurityCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const fakeDate = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const buyerRnc = invoice.comprador?.rncComprador || invoice.comprador?.identificadorExtranjero || '000000000';
    const fakeQr = `https://ecf.dgii.gov.do/testecf/consultatimbre?rncemisor=${credentials.rnc}&rnccomprador=${buyerRnc}&encf=${fakeEncf}&fechainicio=${fakeDate}&montototal=${totales.montoTotal}&codigoseguridad=${fakeSecurityCode}`;

    const fakeXml = `<?xml version="1.0" encoding="utf-8"?><eCF><Encabezado><IdDoc><TipoeCF>${invoice.tipoEcf}</TipoeCF><eNCF>${fakeEncf}</eNCF></IdDoc><Emisor><RNCEmisor>${credentials.rnc}</RNCEmisor></Emisor><Totales><MontoTotal>${totales.montoTotal}</MontoTotal></Totales></Encabezado><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignatureValue>${fakeSecurityCode}SIMULATED_SIGNATURE</SignatureValue></Signature></eCF>`;

    return {
      success: true,
      status: 'ACCEPTED',
      encf: fakeEncf,
      externalDocId: invoice.externalDocId,
      externalDocumentId: fakeDocId,
      urlQr: fakeQr,
      codigoSeguridad: fakeSecurityCode,
      fechaHoraFirma: fakeDate,
      xmlSigned: options?.returnXml !== 0 ? fakeXml : undefined,
      rawResponse: {
        codigoEstado: 200,
        estado: true,
        datos: {
          idDocumento: fakeDocId,
          numeroFactura: fakeEncf,
          numeroFacturaInternaEmisor: invoice.externalDocId,
          urlqr: fakeQr,
          CodigoSeguridad: fakeSecurityCode,
          FechaHoraFirma: fakeDate,
        },
      },
    };
  }

  public async checkStatus(
    credentials: TenantFiscalCredentials,
    encf: string
  ): Promise<GtiConsultaEstadoResponse> {
    return {
      codigoEstado: 200,
      estado: true,
      fecha: new Date().toISOString(),
      datos: {
        eNCF: encf,
        codigo: 1,
        estado: 'Aceptado',
        RespuestaDGII: {
          Codigo: 0,
          Valor: 'Comprobante recibido y aceptado satisfactoriamente por la DGII.',
        },
      },
      respuesta: [
        {
          codigo: 400,
          mensaje: 'Consulta procesada correctamente.',
        },
      ],
    };
  }

  public async configureSequences(
    credentials: TenantFiscalCredentials,
    sequences: GtiSecuenciaItem[]
  ): Promise<GtiSecuenciaResponse> {
    return {
      codigoEstado: 200,
      estado: true,
      fecha: new Date().toISOString(),
      datos: {
        rnc: credentials.rnc,
      },
      respuesta: [
        {
          codigo: 1914,
          mensaje: 'Configuración de secuencia(s) realizada exitosamente.',
        },
      ],
    };
  }

  public async downloadPdf(
    credentials: TenantFiscalCredentials,
    encf: string,
    templateFormat = 1
  ): Promise<Buffer> {
    // Devuelve un PDF sintético de prueba
    const fakePdfContent = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Contents 4 0 R>>endobj\n4 0 obj<</Length 85>>stream\nBT /F1 14 Tf 50 750 Td (COMPROBANTE FISCAL ELECTRONICO: ${encf} - TEMPLATE ${templateFormat}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000108 00000 n \n0000000204 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n340\n%%EOF`;
    return Buffer.from(fakePdfContent, 'utf-8');
  }
}
