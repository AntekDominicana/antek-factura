import {
  Controller,
  Delete,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import * as crypto from 'crypto';
import { FiscalService } from '../fiscal/fiscal.service';
import { SecurityShieldService } from '../security/security-shield.service';
import { BillingService } from '../billing/billing.service';
import { SubscriptionGuard } from '../billing/subscription.guard';
import { ProductionReadinessGuard } from '../common/guards/production-readiness.guard';
import { TenantAuthGuard } from '../common/guards/tenant-auth.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { DomainInvoice, GtiSecuenciaItem } from '@factura-ecf/fiscal-engine';

@ApiTags('Facturación Electrónica (e-CF) v1')
@Controller('v1')
export class InvoicesController {
  constructor(
    private readonly fiscalService: FiscalService,
    private readonly securityShield: SecurityShieldService,
    private readonly billingService: BillingService,
    private readonly notificationsService: NotificationsService
  ) {}

  private verifyOwnerKey(ownerKey?: string) {
    const expected = process.env.OWNER_AUDIT_KEY || 'owner_internal_key_2026';
    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(String(ownerKey || ''), 'utf8');
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new HttpException(
        {
          statusCode: 403,
          error: 'OwnerAccessOnly',
          message: 'Acceso interno restringido exclusivamente al propietario de la plataforma.',
        },
        HttpStatus.FORBIDDEN
      );
    }
  }

  @Post('invoices')
  @UseGuards(TenantAuthGuard, SubscriptionGuard, ProductionReadinessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Emitir Comprobante Fiscal Electrónico (e-CF)',
    description:
      'Valida normativa DGII (Ley 32-23), calcula totales, aplica idempotencia 24h, mapea payload GTI con omisión de campos en cero y firma vía el proveedor fiscal configurado.',
  })
  @ApiHeader({ name: 'X-API-Key', required: false, description: 'API Key del tenant (determina el ambiente SANDBOX/PRODUCTION)' })
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Clave única por factura para evitar duplicidad (24h TTL)' })
  @ApiQuery({ name: 'async', required: false, type: Boolean, description: 'Si true, retorna QUEUED de inmediato' })
  @ApiQuery({ name: 'simulateError', required: false, type: Number, description: 'Código de error GTI simulado (solo en modo SIMULATOR)' })
  @ApiResponse({ status: 200, description: 'Comprobante procesado o respuesta idempotente.' })
  @ApiResponse({ status: 400, description: 'Error de validación fiscal DGII.' })
  @ApiResponse({ status: 402, description: 'Suscripción suspendida o cuota del plan SaaS excedida.' })
  @ApiResponse({ status: 403, description: 'Tipo de e-CF o acceso API no permitido en el plan actual.' })
  @ApiResponse({ status: 422, description: 'Conflicto de Idempotency-Key (payload distinto).' })
  @ApiResponse({ status: 429, description: 'Rate limit excedido.' })
  async emitInvoice(
    @Body() payload: DomainInvoice,
    @Req() req: any,
    @Headers('x-api-key') apiKey?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Query('async') isAsync?: string,
    @Query('simulateError') simulateError?: string
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const result = await this.fiscalService.emitInvoice(payload, {
      tenantId,
      apiKey,
      idempotencyKey,
      isAsync: isAsync === 'true',
      simulateErrorCode: simulateError ? Number(simulateError) : undefined,
    });

    // Incremento atómico del uso de facturas en el plan mensual
    await this.billingService.incrementUsage(tenantId);

    return result;
  }

  @Get('invoices')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Listar comprobantes electrónicos emitidos' })
  @ApiQuery({ name: 'tipoEcf', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'environment', required: false, type: String })
  getInvoices(
    @Req() req: any,
    @Query('tipoEcf') tipoEcf?: string,
    @Query('status') status?: string,
    @Query('environment') environment?: string
  ) {
    return this.fiscalService.getInvoices(
      {
        tipoEcf: tipoEcf ? Number(tipoEcf) : undefined,
        status,
        environment,
      },
      req.user?.tenantId || req.tenantId
    );
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Obtener detalle de un comprobante por ID o e-NCF' })
  getInvoiceById(@Param('id') id: string, @Req() req: any): Promise<any> {
    return this.fiscalService.getInvoiceById(id, req.user?.tenantId);
  }

  @Get('invoices/:id/status')
  @ApiOperation({ summary: 'Consultar estado en vivo ante la DGII' })
  async checkInvoiceStatus(@Param('id') id: string, @Req() req: any): Promise<any> {
    return this.fiscalService.checkInvoiceStatus(id, req.user?.tenantId);
  }

  @Get('invoices/:id/pdf')
  @ApiOperation({ summary: 'Descargar PDF del comprobante (Plantillas 1..6 incluyendo Tirilla 3" y 4")' })
  @ApiQuery({ name: 'template', required: false, type: Number, description: '1: Defecto, 2: Publicidad, 3: Exportación, 4: Avanzado, 5: Tiquete 3", 6: Tiquete 4"' })
  async downloadPdf(
    @Param('id') id: string,
    @Query('template') template: string,
    @Res() res: Response,
    @Req() req: any
  ) {
    const templateNum = template ? Number(template) : 1;
    const buffer = await this.fiscalService.getInvoicePdf(id, templateNum, req.user?.tenantId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${id}-t${templateNum}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('invoices/:id/xml')
  @ApiOperation({ summary: 'Descargar XML firmado inmutable (retención legal 5 años)' })
  async downloadXml(@Param('id') id: string, @Res() res: Response, @Req() req: any) {
    const { encf, xml, sha256 } = await this.fiscalService.getInvoiceXml(id, req.user?.tenantId);
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encf}.xml"`,
      'X-XML-SHA256': sha256,
    });
    res.send(xml);
  }

  @Get('invoices/:id/share-whatsapp')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Generar enlace público firmado (72h) y URL directa de WhatsApp' })
  async getWhatsAppShareUrl(@Param('id') id: string, @Req() req: any) {
    const invoice = await this.fiscalService.getInvoiceById(id, req.user?.tenantId);
    return this.notificationsService.generateWhatsAppShareUrl({
      id: invoice.id,
      encf: invoice.encf,
      rncEmisor: (invoice as any).rncEmisor || '131880738',
      montoTotal: invoice.totales?.montoTotal || 0,
    });
  }

  @Get('sequences')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Listar secuencias autorizadas e-NCF con alertas de agotamiento y vencimiento' })
  getSequences(@Req() req: any) {
    return this.fiscalService.getSequences(req.user?.tenantId || req.tenantId);
  }

  @Post('sequences')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Registrar y sincronizar rango de secuencias e-NCF autorizado por DGII' })
  registerSequence(
    @Body() body: GtiSecuenciaItem & { environment?: 'SANDBOX' | 'PRODUCTION' },
    @Req() req: any
  ) {
    return this.fiscalService.registerSequence(body, req.user?.tenantId || req.tenantId);
  }

  @Get('catalogs/:type')
  @ApiOperation({
    summary: 'Consultar catálogos oficiales de la DGII',
    description: 'Tipos soportados: provinces, municipalities, units, taxes, currencies, error-codes, plans, customers, products',
  })
  getCatalog(@Param('type') type: string) {
    return this.fiscalService.getCatalog(type);
  }

  @Get('dashboard')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Resumen integral del Dashboard SaaS multi-tenant' })
  getDashboard(@Req() req: any) {
    return this.fiscalService.getDashboardSummary(req.user?.tenantId || req.tenantId);
  }

  @Post('tenant/settings')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Actualizar configuración del tenant, proveedor fiscal, contingencia y credenciales cifradas' })
  updateTenantSettings(@Body() body: any, @Req() req: any) {
    return this.fiscalService.updateTenantSettings(body, req.user?.tenantId || req.tenantId);
  }

  @Get('dgii/config')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Obtener configuración fiscal y datos del Tenant autenticado' })
  getDgiiConfig(@Req() req: any) {
    return this.fiscalService.getDgiiConfig(req.user?.tenantId || req.tenantId);
  }

  @Get('dgii/purchases')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Obtener compras registradas para el Libro Contable 606' })
  getDgiiPurchases(@Req() req: any) {
    return this.fiscalService.getDgiiPurchases(req.user?.tenantId || req.tenantId);
  }

  @Post('tenant/contingency/reconcile')
  @ApiOperation({ summary: 'Reconciliar facturas emitidas en modo contingencia ante la DGII (<48h)' })
  reconcileContingency() {
    return this.fiscalService.reconcileContingencyInvoices();
  }

  @Post('apikeys')
  @ApiOperation({ summary: 'Crear nueva API Key (TESTECF, CERTECF, ECF, SANDBOX o PRODUCTION)' })
  createApiKey(
    @Body()
    body: {
      name: string;
      environment: 'TESTECF' | 'CERTECF' | 'ECF' | 'SANDBOX' | 'PRODUCTION';
    }
  ) {
    return this.fiscalService.createApiKey(body.name, body.environment);
  }

  @Post('webhooks')
  @ApiOperation({ summary: 'Registrar endpoint de Webhook firmado con HMAC-SHA256' })
  createWebhook(@Body() body: { url: string; events: string[] }) {
    return this.fiscalService.createWebhook(body.url, body.events || []);
  }

  @Post('dgii/auto-report/run')
  @ApiOperation({ summary: 'Ejecutar ciclo inmediato de Reporte Automático DGII (RFCE, TrackId y Contingencia)' })
  runAutoReport() {
    return this.fiscalService.runAutoReportCycle();
  }

  @Get('dgii/auto-report/status')
  @ApiOperation({ summary: 'Consultar estado y cola de Reportes Automáticos DGII' })
  getAutoReportStatus() {
    return this.fiscalService.getAutoReportStatus();
  }

  @Get('dgii/reports/:period')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Generar reportes oficiales DGII (Formatos 606, 607, 608 y Pre-Declaración IT-1)' })
  getDgiiReports(@Param('period') period: string, @Req() req: any) {
    return this.fiscalService.generateDgiiReports(period, req.user?.tenantId || req.tenantId);
  }

  @Get('dgii/reports/:period/download/:format')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Descargar archivo TXT oficial DGII (606, 607, 608 o 609) para Oficina Virtual' })
  async downloadDgiiReportTxt(
    @Param('period') period: string,
    @Param('format') format: string,
    @Res() res: Response,
    @Req() req: any
  ) {
    const reports = await this.fiscalService.generateDgiiReports(
      period,
      req.user?.tenantId || req.tenantId
    );
    const fmt = format.toUpperCase();
    const content =
      fmt === '606'
        ? reports.formato606.txt
        : fmt === '608'
        ? reports.formato608.txt
        : fmt === '609'
        ? reports.formato609.txt
        : reports.formato607.txt;

    res.set({
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="DGII_F_${fmt}_${reports.rnc}_${period}.txt"`,
    });
    res.send(content);
  }

  @Get('dgii/reports/:period/excel')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({
    summary: 'Descargar Formato de Envío 606 Oficial DGII (.xls Versión 2025 con macros, rellenado en memoria por cuenta)',
  })
  async downloadAccountantExcel(
    @Param('period') period: string,
    @Res() res: Response,
    @Req() req: any
  ) {
    const excel = await this.fiscalService.generateAccountantExcelReport(
      period,
      req.user?.tenantId || req.tenantId
    );
    res.set({
      'Content-Type': 'application/vnd.ms-excel',
      'Content-Disposition': `attachment; filename="${excel.filename}"`,
      'Content-Length': String(excel.buffer.length),
    });
    res.send(excel.buffer);
  }

  @Get('dgii/verify-rnc/:rnc')
  @ApiOperation({
    summary: 'Verificar RNC (Módulo 11 DGII) o Cédula (Módulo 10 JCE) y resolver datos completos de la empresa',
  })
  verifyRnc(
    @Param('rnc') rnc: string,
    @Query('name') name?: string,
    @Query('nombreComercial') nombreComercial?: string,
    @Query('actividad') actividad?: string
  ) {
    return this.fiscalService.verifyRnc(rnc, name, {
      nombreComercial,
      actividadEconomica: actividad,
    });
  }

  @Post('dgii/padron/import')
  @ApiOperation({
    summary: 'Importar líneas del padrón oficial DGII_RNC.TXT al directorio interno de consultas',
  })
  importDgiiPadron(@Body() body: { rawLines: string }) {
    return this.fiscalService.importDgiiPadronTxt(body?.rawLines || '');
  }

  @Get('dgii/padron/search')
  @ApiOperation({
    summary: 'Buscar empresas por RNC o Razón Social en el directorio DGII del sistema',
  })
  searchRncDirectory(@Query('q') q?: string) {
    return this.fiscalService.searchRncDirectory(q);
  }

  @Post('dgii/verify-encf')
  @ApiOperation({
    summary: 'Verificar Comprobante Fiscal (e-NCF, NCF o URL del QR DGII), nombres y efecto contable',
  })
  verifyComprobante(
    @Body()
    body: {
      urlQr?: string;
      encf?: string;
      rncEmisor?: string;
      rncComprador?: string;
      montoTotal?: number;
      totalItbis?: number;
      fechaEmision?: string;
      razonSocialEmisor?: string;
      razonSocialComprador?: string;
      codigoSeguridad?: string;
    }
  ) {
    return this.fiscalService.verifyComprobante(body);
  }

  @Get('accounting/purchases')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Listar compras y gastos recibidos para Formato 606' })
  getReceivedPurchases() {
    return this.fiscalService.getReceivedPurchases();
  }

  @Post('accounting/purchases')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Registrar factura de proveedor recibido para Formato 606 / IT-1 / IR-17' })
  registerReceivedPurchase(@Body() body: any) {
    return this.fiscalService.registerReceivedPurchase(body);
  }

  @Post('accounting/purchases/from-qr')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({
    summary: 'Registrar automáticamente factura de gasto en Formato 606 escaneando URL QR o texto Verificación e-NCF DGII',
  })
  registerPurchaseFromQr(@Body() body: any) {
    return this.fiscalService.registerPurchaseFromQr(body);
  }

  @Get('customers')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Listar clientes guardados de la empresa autenticada' })
  getCustomers(@Req() req: any) {
    return this.fiscalService.getCustomers(req.user?.tenantId || req.tenantId);
  }

  @Get('products')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Listar productos o servicios de la empresa autenticada' })
  getProducts(@Req() req: any) {
    return this.fiscalService.getProducts(req.user?.tenantId || req.tenantId);
  }

  @Post('catalogs/customers')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Registrar un cliente real en el directorio del tenant' })
  addCustomer(@Body() body: any, @Req() req: any) {
    return this.fiscalService.addCustomer(body, req.user?.tenantId || req.tenantId);
  }

  @Post('catalogs/products')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Registrar un producto o servicio real en el catálogo del tenant' })
  addProduct(@Body() body: any) {
    return this.fiscalService.addProduct(body);
  }

  @Post('security/stress-test')
  @ApiHeader({ name: 'X-Owner-Key', required: true, description: 'Llave privada interna del propietario' })
  @ApiOperation({ summary: '[INTERNO] Prueba de estrés de alta concurrencia multi-usuario con Mutex Atómico' })
  runConcurrencyStressTest(
    @Headers('x-owner-key') ownerKey: string | undefined,
    @Body() body: { concurrency?: number }
  ) {
    this.verifyOwnerKey(ownerKey);
    return this.fiscalService.runConcurrencyStressTest(body?.concurrency || 25);
  }

  @Get('security/telemetry')
  @ApiHeader({ name: 'X-Owner-Key', required: true, description: 'Llave privada interna del propietario' })
  @ApiOperation({ summary: '[INTERNO] Telemetría de Seguridad Perimetral, WAF Anti-Scraping y Hash-Chain' })
  getSecurityTelemetry(@Headers('x-owner-key') ownerKey: string | undefined) {
    this.verifyOwnerKey(ownerKey);
    return this.securityShield.getSecurityTelemetry();
  }

  @Post('certificate/upload')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Cargar certificado digital .p12 con P12Reader de dgii-ecf y cifrado AES-256-GCM en PostgreSQL' })
  uploadCertificate(
    @Body()
    body: {
      p12Base64: string;
      passphrase: string;
      dgiiEnv?: 'DEV' | 'CERT' | 'PROD';
      liveMode?: boolean;
      switchToDirect?: boolean;
    },
    @Req() req: any
  ) {
    return this.fiscalService.uploadP12Certificate(body, req.user?.tenantId || req.tenantId);
  }

  @Delete('certificate')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Eliminar certificado digital .p12 guardado de la empresa autenticada' })
  removeCertificate(@Req() req: any) {
    return this.fiscalService.removeP12Certificate(req.user?.tenantId || req.tenantId);
  }

  @Post('dgii/config')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Configurar ambiente DGII (TesteCF/CerteCF/eCF) y modo de transmisión en vivo' })
  updateDgiiConfig(
    @Body() body: { dgiiEnv?: 'DEV' | 'CERT' | 'PROD'; liveMode?: boolean },
    @Req() req: any
  ) {
    return this.fiscalService.updateDgiiRuntimeConfig(body, req.user?.tenantId || req.tenantId);
  }

  @Post('dgii/validate-xml')
  @ApiOperation({ summary: 'Validar firma XMLDSig y certificado X.509 con validateXMLCertificate de dgii-ecf' })
  validateXml(@Body() body: { xml: string }) {
    return this.fiscalService.validateSignedXmlWithDgiiEcf(body.xml);
  }

  @Post('dgii/check-document-status')
  @ApiOperation({ summary: 'Verificar estado seguro anti-duplicado antes de reintento (checkDocumentStatus)' })
  checkDocumentStatus(@Body() body: any) {
    return this.fiscalService.checkDocumentStatusBeforeRetry(body);
  }

  @Post('dgii/acecf')
  @ApiOperation({ summary: 'Firmar y emitir Aprobación Comercial (<ACECF>) usando dgii-ecf' })
  createCommercialApproval(@Body() body: any) {
    return this.fiscalService.createCommercialApproval(body);
  }

  @Post('dgii/anecf')
  @ApiOperation({ summary: 'Firmar Anulación de Secuencias e-NCF no utilizadas (<ANECF>) usando dgii-ecf' })
  voidUnusedSequence(@Body() body: { tipoEcf: number; desde: string; hasta: string }) {
    return this.fiscalService.voidUnusedSequence(body);
  }

  @Post('dgii/receptor/test-handshake')
  @UseGuards(TenantAuthGuard)
  @ApiOperation({ summary: 'Verificar ciclo completo Emisor-Receptor (Semilla -> JWT -> ARECF) con dgii-ecf' })
  testReceptorHandshake(@Body() body?: { rnc?: string }, @Req() req?: any) {
    return this.fiscalService.testReceptorHandshake(body?.rnc, req?.user?.tenantId || req?.tenantId);
  }

  @Get('provider/tenants')
  @ApiOperation({ summary: 'Listar empresas clientes administradas en la consola Multi-Tenant' })
  listManagedTenants() {
    return this.fiscalService.listManagedTenants();
  }

  @Post('provider/tenants')
  @ApiOperation({ summary: 'Registrar nueva empresa cliente en modo Proveedor Multi-Tenant' })
  createManagedTenant(
    @Body()
    body: {
      rnc: string;
      razonSocial: string;
      nombreComercial?: string;
      direccion?: string;
      planSlug?: string;
      fiscalProvider?: 'DGII_DIRECT' | 'GTI';
    }
  ) {
    return this.fiscalService.createManagedTenant(body);
  }

  @Post('provider/tenants/:id/activate')
  @ApiOperation({ summary: 'Cambiar el contexto activo hacia otra empresa cliente multi-tenant' })
  switchActiveTenant(@Param('id') id: string) {
    return this.fiscalService.switchActiveTenant(id);
  }

  @Post('dgii/sign-arbitrary-xml')
  @ApiOperation({ summary: 'Firmar XML arbitrario de Postulación (Paso 1) o Declaración Jurada (Paso 13) con dgii-ecf' })
  signArbitraryXml(@Body() body: { xml: string; rootTag?: string }) {
    return this.fiscalService.signArbitraryXmlForDgii(body.xml, body.rootTag);
  }

  @Post('dgii/certification/run-set')
  @ApiOperation({ summary: 'Generar y firmar el Set completo de 11 comprobantes de Certificación DGII (Pasos 1-4)' })
  runCertificationSet() {
    return this.fiscalService.runDgiiCertificationSimulationSet();
  }

  @Post('accounting/purchases/bulk-import')
  @ApiOperation({ summary: 'Importar lote masivo CSV/TXT de facturas de proveedores para Formato 606 e IT-1' })
  bulkImportPurchases(@Body() body: { rawLines: string }) {
    return this.fiscalService.bulkImportPurchases606(body.rawLines);
  }

  @Post('security/audit')
  @ApiHeader({ name: 'X-Owner-Key', required: true, description: 'Llave privada interna del propietario' })
  @ApiOperation({ summary: '[INTERNO] Ejecutar auditoría criptográfica y de blindaje Blind-LLM / DLP en vivo' })
  runSecurityAudit(@Headers('x-owner-key') ownerKey: string | undefined) {
    this.verifyOwnerKey(ownerKey);
    return this.fiscalService.runCodeAndSecurityAudit();
  }

  @Post('legal/consent')
  @ApiOperation({ summary: 'Registrar consentimiento de recopilación de datos, Términos y promociones (Ley 172-13)' })
  recordLegalConsent(
    @Body()
    body: {
      dataCollectionAccepted: boolean;
      marketingPromotionsOptIn?: boolean;
      termsVersion?: string;
    }
  ) {
    return this.fiscalService.recordLegalConsent(body);
  }

  @Post('billing/payment-link')
  @ApiOperation({ summary: 'Generar Link de Pago firmado con HMAC-SHA256 (Azul WebPay / CardNET / Stripe)' })
  createPaymentLink(
    @Body()
    body: {
      planSlug: string;
      gateway: 'AZUL_WEBPAY' | 'CARDNET_RD' | 'STRIPE_CHECKOUT';
    }
  ) {
    return this.fiscalService.createPaymentLink(body);
  }

  @Post('billing/verify-payment')
  @ApiOperation({ summary: 'Verificar el pago criptográficamente en el servidor (HMAC-SHA256) y reactivar plan' })
  verifyPaymentOnServer(@Body() body: { paymentId: string; serverVerificationToken?: string }) {
    return this.fiscalService.verifyPaymentOnServer(body);
  }

  @Post('billing/subscription-state')
  @ApiHeader({ name: 'X-Owner-Key', required: true, description: 'Llave privada interna del propietario' })
  @ApiOperation({ summary: '[INTERNO] Actualizar estado de cobranza y gracia de 5 días del tenant' })
  updateSubscriptionGraceState(
    @Headers('x-owner-key') ownerKey: string | undefined,
    @Body() body: { status: 'ACTIVE' | 'PAST_DUE_GRACE_5D' | 'SUSPENDED_LOCKED'; daysPastDue?: number }
  ) {
    this.verifyOwnerKey(ownerKey);
    return this.fiscalService.updateSubscriptionGraceState(body);
  }

  @Post('ai/ask-tenant')
  @ApiOperation({ summary: 'Asistente IA Gemini aislado por RLS estrictamente a la empresa en sesión' })
  askTenantGeminiAssistant(@Body() body: { question: string }) {
    return this.fiscalService.askTenantGeminiAssistant(body);
  }

  @Get('docs/llms-full.txt')
  @ApiOperation({ summary: 'Documentación técnica autenticada (protegida por Blind LLM Shield)' })
  getLlmsFullTxt(@Res() res: Response, @Headers('x-api-key') apiKey?: string) {
    if (!apiKey) {
      throw new HttpException(
        {
          statusCode: 403,
          error: 'BlindLlmAgentShield',
          message: 'Blind LLM Shield Active: se requiere header X-API-Key válido.',
        },
        HttpStatus.FORBIDDEN
      );
    }
    this.fiscalService.resolveApiKeyAndRateLimit(apiKey);
    res.set({ 'Content-Type': 'text/plain; charset=utf-8' });
    res.send(this.fiscalService.getLlmsFullTxt());
  }
}
