import {
  EcfType,
  IndicadorFacturacion,
  IndicadorBienServicio,
  IndicadorMontoGravado,
  TipoPago,
  FormaPago,
  CodigoModificacion,
  IndicadorNotaCredito,
  DomainInvoice,
  TaxCalculator,
  FiscalValidator,
  GtiMapper,
  FiscalSimulatorAdapter,
  DgiiDirectAdapter,
  FiscalValidationException,
} from '../src';

describe('Fiscal Engine - Dominican Republic e-CF Compliance (DGII & GTI)', () => {
  describe('TaxCalculator & Zero-Field Omission', () => {
    it('debe calcular correctamente ITBIS 18% y omitir campos en cero en Totales', () => {
      const invoice: DomainInvoice = {
        tipoEcf: EcfType.CREDITO_FISCAL,
        indicadorMontoGravado: IndicadorMontoGravado.SIN_ITBIS_INCLUIDO,
        tipoIngresos: '01',
        tipoPago: TipoPago.CONTADO,
        emisor: { rnc: '132794001', emisorPorDefecto: true },
        comprador: {
          rncComprador: '123456789',
          razonSocialComprador: 'COMPRADOR DE PRUEBA SRL',
        },
        items: [
          {
            numeroLinea: 1,
            indicadorFacturacion: IndicadorFacturacion.ITBIS_18,
            indicadorBienServicio: IndicadorBienServicio.SERVICIO,
            nombreItem: 'Servicio de Consultoría',
            cantidadItem: 2,
            precioUnitarioItem: 500, // 1000 DOP subtotal
          },
        ],
      };

      const { totales } = TaxCalculator.calculateInvoice(invoice);
      expect(totales.montoGravadoTotal).toBe(1000);
      expect(totales.montoGravadoI1).toBe(1000);
      expect(totales.itbis1).toBe(18);
      expect(totales.totalItbis1).toBe(180);
      expect(totales.totalItbis).toBe(180);
      expect(totales.montoTotal).toBe(1180);

      // No debe tener valores para 16%, 0% ni Exento
      expect(totales.montoGravadoI2).toBeUndefined();
      expect(totales.montoGravadoI3).toBeUndefined();
      expect(totales.montoExento).toBeUndefined();

      // Mapeo hacia GTI
      const gtiPayload = GtiMapper.toGtiPayload(invoice);
      expect(gtiPayload.Encabezado.Totales.MontoGravadoI1).toBe(1000);
      expect(gtiPayload.Encabezado.Totales.TotalITBIS1).toBe(180);
      expect(gtiPayload.Encabezado.Totales.MontoTotal).toBe(1180);

      // Regla de omisión crítica de GTI: campos no deben existir en el JSON
      expect(gtiPayload.Encabezado.Totales.MontoGravadoI2).toBeUndefined();
      expect(gtiPayload.Encabezado.Totales.ITBIS2).toBeUndefined();
      expect(gtiPayload.Encabezado.Totales.MontoExento).toBeUndefined();
    });
  });

  describe('Regla de Monto >= RD$250,000 (Tipos 32, 33 y 34)', () => {
    it('debe permitir Factura Consumo (32) < 250,000 sin RNCComprador', () => {
      const invoice: DomainInvoice = {
        tipoEcf: EcfType.CONSUMO,
        tipoPago: TipoPago.CONTADO,
        items: [
          {
            numeroLinea: 1,
            indicadorFacturacion: IndicadorFacturacion.ITBIS_18,
            indicadorBienServicio: IndicadorBienServicio.BIEN,
            nombreItem: 'Laptop',
            cantidadItem: 1,
            precioUnitarioItem: 50000,
          },
        ],
      };

      const { totales } = TaxCalculator.calculateInvoice(invoice);
      invoice.totalesCalculados = totales;
      expect(() => FiscalValidator.validate(invoice)).not.toThrow();
    });

    it('debe RECHAZAR Factura Consumo (32) >= 250,000 sin RNCComprador (Error 1306/1303)', () => {
      const invoice: DomainInvoice = {
        tipoEcf: EcfType.CONSUMO,
        tipoPago: TipoPago.CONTADO,
        items: [
          {
            numeroLinea: 1,
            indicadorFacturacion: IndicadorFacturacion.EXENTO,
            indicadorBienServicio: IndicadorBienServicio.BIEN,
            nombreItem: 'Maquinaria Pesada',
            cantidadItem: 1,
            precioUnitarioItem: 250000,
          },
        ],
      };

      const { totales } = TaxCalculator.calculateInvoice(invoice);
      invoice.totalesCalculados = totales;

      expect(() => FiscalValidator.validate(invoice)).toThrow(FiscalValidationException);
      try {
        FiscalValidator.validate(invoice);
      } catch (e: any) {
        expect(e.code).toBe(1306);
      }
    });

    it('debe RECHAZAR Nota de Crédito (34) >= 250,000 sin RNCComprador', () => {
      const invoice: DomainInvoice = {
        tipoEcf: EcfType.NOTA_CREDITO,
        tipoPago: TipoPago.CONTADO,
        references: [
          {
            ncfModificado: 'E310000000001',
            fechaNcfModificado: '01-11-2026',
            codigoModificacion: CodigoModificacion.CORRIGE_MONTOS,
            indicadorNotaCredito: IndicadorNotaCredito.MENOR_IGUAL_30_DIAS,
          },
        ],
        items: [
          {
            numeroLinea: 1,
            indicadorFacturacion: IndicadorFacturacion.EXENTO,
            indicadorBienServicio: IndicadorBienServicio.BIEN,
            nombreItem: 'Ajuste inventario',
            cantidadItem: 1,
            precioUnitarioItem: 300000,
          },
        ],
      };

      const { totales } = TaxCalculator.calculateInvoice(invoice);
      invoice.totalesCalculados = totales;

      expect(() => FiscalValidator.validate(invoice)).toThrow(FiscalValidationException);
      try {
        FiscalValidator.validate(invoice);
      } catch (e: any) {
        expect(e.code).toBe(1306);
      }
    });
  });

  describe('Validación de Tipos Especiales (43, 44, 46, 47)', () => {
    it('e-CF 43 (Gastos Menores) debe fallar si contiene ítems gravados (Error 1804)', () => {
      const invoice: DomainInvoice = {
        tipoEcf: EcfType.GASTOS_MENORES,
        tipoPago: TipoPago.CONTADO,
        items: [
          {
            numeroLinea: 1,
            indicadorFacturacion: IndicadorFacturacion.ITBIS_18, // Inválido para 43
            indicadorBienServicio: IndicadorBienServicio.BIEN,
            nombreItem: 'Materiales varios',
            cantidadItem: 1,
            precioUnitarioItem: 1000,
          },
        ],
      };

      expect(() => FiscalValidator.validate(invoice)).toThrow(FiscalValidationException);
      try {
        FiscalValidator.validate(invoice);
      } catch (e: any) {
        expect(e.code).toBe(1804);
      }
    });

    it('e-CF 46 (Exportación) debe tener ITBIS 0% y rechazar tener RNC y Extranjero juntos (Error 1305)', () => {
      const invoice: DomainInvoice = {
        tipoEcf: EcfType.EXPORTACION,
        tipoPago: TipoPago.CONTADO,
        comprador: {
          rncComprador: '123456789',
          identificadorExtranjero: 'US987654321', // Ambos a la vez no permitido
          razonSocialComprador: 'Foreign Corp',
        },
        items: [
          {
            numeroLinea: 1,
            indicadorFacturacion: IndicadorFacturacion.ITBIS_0,
            indicadorBienServicio: IndicadorBienServicio.BIEN,
            nombreItem: 'Cacao Orgánico Dominicano',
            cantidadItem: 100,
            precioUnitarioItem: 50,
          },
        ],
      };

      expect(() => FiscalValidator.validate(invoice)).toThrow(FiscalValidationException);
      try {
        FiscalValidator.validate(invoice);
      } catch (e: any) {
        expect(e.code).toBe(1305);
      }
    });

    it('e-CF 47 (Pagos al Exterior) debe ser servicio y exento', () => {
      const invoice: DomainInvoice = {
        tipoEcf: EcfType.PAGOS_AL_EXTERIOR,
        tipoPago: TipoPago.CONTADO,
        comprador: {
          identificadorExtranjero: 'AWS-123456',
          razonSocialComprador: 'Amazon Web Services Inc',
        },
        items: [
          {
            numeroLinea: 1,
            indicadorFacturacion: IndicadorFacturacion.EXENTO,
            indicadorBienServicio: IndicadorBienServicio.SERVICIO,
            nombreItem: 'Cloud Hosting Services',
            cantidadItem: 1,
            precioUnitarioItem: 15000,
            montoIsrRetenido: 4050,
          },
        ],
      };

      const { totales } = TaxCalculator.calculateInvoice(invoice);
      invoice.totalesCalculados = totales;
      expect(() => FiscalValidator.validate(invoice)).not.toThrow();
      expect(totales.totalIsrRetencion).toBe(4050);
    });
  });

  describe('FiscalSimulatorAdapter', () => {
    it('debe simular emisión exitosa y devolver e-NCF, QR y código de seguridad', async () => {
      const simulator = new FiscalSimulatorAdapter();
      const invoice: DomainInvoice = {
        tipoEcf: EcfType.CREDITO_FISCAL,
        tipoPago: TipoPago.CONTADO,
        externalDocId: 'INV-2026-001',
        comprador: {
          rncComprador: '123456789',
          razonSocialComprador: 'ACME DOMINICANA SRL',
        },
        items: [
          {
            numeroLinea: 1,
            indicadorFacturacion: IndicadorFacturacion.ITBIS_18,
            indicadorBienServicio: IndicadorBienServicio.BIEN,
            nombreItem: 'Licencia Software',
            cantidadItem: 1,
            precioUnitarioItem: 2000,
          },
        ],
      };

      const result = await simulator.emitInvoice(
        { rnc: '132794001', environment: 'SANDBOX' },
        invoice,
        { returnXml: 1 }
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('ACCEPTED');
      expect(result.encf).toMatch(/^E31/);
      expect(result.codigoSeguridad).toHaveLength(6);
      expect(result.urlQr).toContain('rncemisor=132794001');
      expect(result.xmlSigned).toContain('<?xml');

      // Test status check
      const statusRes = await simulator.checkStatus(
        { rnc: '132794001', environment: 'SANDBOX' },
        result.encf
      );
      expect(statusRes.datos?.estado).toBe('Aceptado');

      // Test PDF download
      const pdfBuffer = await simulator.downloadPdf(
        { rnc: '132794001', environment: 'SANDBOX' },
        result.encf,
        1
      );
      expect(pdfBuffer.toString()).toContain('%PDF');
    });
  });

  describe('DgiiDirectAdapter (Motor oficial dgii-ecf: XMLDSig, RFCE, ARECF y Semilla)', () => {
    it('debe firmar <ECF> con Signature de dgii-ecf y aprobar validateXMLCertificate', async () => {
      const adapter = new DgiiDirectAdapter();
      const invoice: DomainInvoice = {
        tipoEcf: EcfType.CREDITO_FISCAL,
        encf: 'E310000000777',
        tipoPago: TipoPago.CONTADO,
        comprador: {
          rncComprador: '101001577',
          razonSocialComprador: 'BANCO POPULAR DOMINICANO SA',
        },
        items: [
          {
            numeroLinea: 1,
            indicadorFacturacion: IndicadorFacturacion.ITBIS_18,
            indicadorBienServicio: IndicadorBienServicio.SERVICIO,
            nombreItem: 'Servicio Directo DGII',
            cantidadItem: 1,
            precioUnitarioItem: 5000,
          },
        ],
      };

      const result = await adapter.emitInvoice(
        { rnc: '132794001', environment: 'SANDBOX' },
        invoice,
        { returnXml: 1 }
      );

      expect(result.success).toBe(true);
      expect(result.encf).toBe('E310000000777');
      expect(result.codigoSeguridad).toHaveLength(6);
      expect(result.urlQr?.toLowerCase()).toContain('https://ecf.dgii.gov.do/testecf/consultatimbre');
      expect(result.xmlSigned).toContain('<ECF>');
      expect(result.xmlSigned).toContain('<SignatureValue>');
      expect(result.rawResponse.xmlCertificateValid).toBe(true);

      const validation = adapter.validateSignedXml(result.xmlSigned!);
      expect(validation.isValid).toBe(true);
      expect(validation.securityCode).toBe(result.codigoSeguridad);
    });

    it('debe convertir e-CF 32 < RD$250,000 a resumen <RFCE> firmado con dgii-ecf', async () => {
      const adapter = new DgiiDirectAdapter();
      const invoice: DomainInvoice = {
        tipoEcf: EcfType.CONSUMO,
        encf: 'E320000000888',
        tipoPago: TipoPago.CONTADO,
        items: [
          {
            numeroLinea: 1,
            indicadorFacturacion: IndicadorFacturacion.ITBIS_18,
            indicadorBienServicio: IndicadorBienServicio.BIEN,
            nombreItem: 'Teclado USB',
            cantidadItem: 1,
            precioUnitarioItem: 1200,
          },
        ],
      };

      const result = await adapter.emitInvoice(
        { rnc: '132794001', environment: 'SANDBOX' },
        invoice,
        { returnXml: 1 }
      );

      expect(result.success).toBe(true);
      expect(result.urlQr?.toLowerCase()).toContain('https://fc.dgii.gov.do/testecf/consultatimbrefc');
      expect(result.xmlSigned).toContain('<ECF>');
      expect(result.rawResponse.isSummaryRFCE).toBe(true);
      expect(result.rawResponse.signedRfceXml).toContain('<RFCE>');
      expect(result.rawResponse.signedRfceXml).toContain('<CodigoSeguridadeCF>');
    });

    it('debe generar Semilla DGII y procesar e-CF entrante generando acuse <ARECF> firmado', async () => {
      const adapter = new DgiiDirectAdapter();
      const seedXml = adapter.generateAuthSeed('101001577');
      expect(seedXml).toContain('<SemillaModel');

      const sampleIncoming = await adapter.emitInvoice(
        { rnc: '132794001', environment: 'SANDBOX' },
        {
          tipoEcf: EcfType.CREDITO_FISCAL,
          encf: 'E310000000999',
          tipoPago: TipoPago.CONTADO,
          comprador: {
            rncComprador: '101001577',
            razonSocialComprador: 'RECEPTOR PRUEBA SRL',
          },
          items: [
            {
              numeroLinea: 1,
              indicadorFacturacion: IndicadorFacturacion.ITBIS_18,
              indicadorBienServicio: IndicadorBienServicio.BIEN,
              nombreItem: 'Equipo Red',
              cantidadItem: 1,
              precioUnitarioItem: 1000,
            },
          ],
        },
        { returnXml: 1 }
      );

      const arecf = adapter.processIncomingEcfXml(sampleIncoming.xmlSigned!, '101001577', true);
      expect(arecf.signedArecfXml).toContain('<ARECF>');
      expect(arecf.signedArecfXml).toContain('<SignatureValue>');
    });
  });
});
