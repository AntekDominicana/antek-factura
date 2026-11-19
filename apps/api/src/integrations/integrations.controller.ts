import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { IntegrationsService } from './integrations.service';
import { ApiKeyAuthGuard, RequireApiKeyScope } from './api-key-auth.guard';
import { TenantAuthGuard } from '../common/guards/tenant-auth.guard';

@ApiTags('API Pública v1 (POS & Comercio)')
@ApiBearerAuth()
@Controller(['api/v1/invoices', 'v1/public/invoices'])
export class PublicInvoicesV1Controller {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post()
  @UseGuards(ApiKeyAuthGuard)
  @RequireApiKeyScope('invoices:write')
  @ApiOperation({
    summary: 'Emitir e-CF desde sistema POS o web propia con idempotencia',
  })
  @ApiResponse({ status: 201, description: 'Comprobante e-CF emitido correctamente.' })
  @ApiResponse({ status: 200, description: 'Venta idempotente: devuelve e-CF existente sin duplicar.' })
  async createInvoice(
    @Body() body: any,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.integrationsService.emitExternalInvoice(
      req.tenantId,
      'pos',
      body,
      true
    );
    res.status(result.statusCode);
    return result.data;
  }

  @Get(':id')
  @UseGuards(ApiKeyAuthGuard)
  @RequireApiKeyScope('invoices:read')
  @ApiOperation({ summary: 'Consultar estado y URLs de un e-CF por ID o e-NCF' })
  async getInvoiceById(@Param('id') id: string, @Req() req: any) {
    return this.integrationsService.getPublicInvoiceById(req.tenantId, id);
  }

  @Get()
  @UseGuards(ApiKeyAuthGuard)
  @RequireApiKeyScope('invoices:read')
  @ApiOperation({ summary: 'Consultar comprobante o estado de trazabilidad por external_id' })
  async getByExternalId(
    @Query('external_id') externalId: string,
    @Query('origen') origen: string | undefined,
    @Req() req: any
  ) {
    return this.integrationsService.getPublicInvoiceByExternalId(
      req.tenantId,
      externalId,
      origen
    );
  }
}

@ApiTags('Webhooks Delivery (Uber Eats & PedidosYa)')
@Controller(['api/webhooks', 'v1/webhooks'])
export class DeliveryWebhooksController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('ubereats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook receptor de Uber Eats (verifica X-Uber-Signature y procesa en segundo plano)',
  })
  async receiveUberEatsWebhook(
    @Body() body: any,
    @Req() req: any,
    @Headers('x-uber-signature') uberSignature?: string
  ) {
    const rawBody: Buffer = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(JSON.stringify(body || {}), 'utf8');
    this.integrationsService.verifyUberWebhookSignature(rawBody, uberSignature);
    this.integrationsService.queueUberEatsWebhookProcessing(body);
    return { received: true, status: 'queued' };
  }

  @Post('pedidosya')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook receptor de PedidosYa (verifica secret y emite e-CF al estar DELIVERED)',
  })
  async receivePedidosYaWebhook(@Body() body: any, @Req() req: any) {
    this.integrationsService.verifyPedidosYaWebhookSecret(req.headers || {});
    return this.integrationsService.processPedidosYaWebhook(body);
  }
}

@ApiTags('Integraciones del Cliente (Panel SaaS)')
@Controller('v1/integrations')
@UseGuards(TenantAuthGuard)
export class TenantIntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  private requireTenantId(req: any): string {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Sesión de empresa no identificada.');
    }
    return tenantId;
  }

  @Get('summary')
  getSummary(@Req() req: any) {
    return this.integrationsService.getTenantIntegrationsSummary(this.requireTenantId(req));
  }

  @Post('api-keys')
  createApiKey(@Req() req: any, @Body() body: any) {
    return this.integrationsService.createCompanyApiKey(this.requireTenantId(req), body);
  }

  @Delete('api-keys/:id')
  revokeApiKey(@Req() req: any, @Param('id') id: string) {
    return this.integrationsService.revokeCompanyApiKey(this.requireTenantId(req), id);
  }

  @Post('delivery')
  upsertDelivery(@Req() req: any, @Body() body: any) {
    return this.integrationsService.upsertDeliveryConnection(this.requireTenantId(req), body);
  }

  @Delete('delivery/:id')
  deleteDelivery(@Req() req: any, @Param('id') id: string) {
    return this.integrationsService.deleteDeliveryConnection(this.requireTenantId(req), id);
  }

  @Post('outgoing-webhook')
  saveOutgoingWebhook(@Req() req: any, @Body() body: any) {
    return this.integrationsService.saveOutgoingWebhook(this.requireTenantId(req), body);
  }
}
