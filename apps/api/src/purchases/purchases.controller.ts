import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  BadRequestException,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Response } from 'express';
import { PurchasesService } from './purchases.service';
import { TenantAuthGuard } from '../common/guards/tenant-auth.guard';
import {
  CommercialApprovalDto,
  ImportXmlPurchaseDto,
  ParseQrDto,
  RegisterQrPurchaseDto,
} from './dto/purchase.dto';

@ApiTags('Bandeja de Compras & QR e-CF (Gastos 606)')
@Controller(['purchases', 'v1/purchases'])
@UseGuards(TenantAuthGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  private getEffectiveTenantId(req: any): string {
    return req.user?.tenantId || req.tenantId;
  }

  @Post('parse-qr')
  @ApiOperation({ summary: 'Parsea y valida parámetros fiscales de un QR / URL de timbre DGII' })
  async parseQr(@Body() body: ParseQrDto, @Req() req: any) {
    if (!body?.qrRaw) {
      throw new BadRequestException('El campo qrRaw es requerido.');
    }
    const tenantId = this.getEffectiveTenantId(req);
    return this.purchasesService.parseDgiiQr(body.qrRaw, tenantId);
  }

  @Post('register-qr')
  @ApiOperation({ summary: 'Registra un gasto escaneando el código QR o ingresándolo en el Libro Contable 606' })
  @ApiHeader({ name: 'X-API-Key', required: false })
  async registerQr(
    @Body() body: RegisterQrPurchaseDto,
    @Req() req: any
  ): Promise<any> {
    const tenantId = this.getEffectiveTenantId(req);
    return this.purchasesService.registerFromQr(tenantId, body);
  }

  @Post('import-xml')
  @ApiOperation({ summary: 'Carga e importa un archivo XML de e-CF recibido de un proveedor' })
  @ApiHeader({ name: 'X-API-Key', required: false })
  async importXml(
    @Body() body: ImportXmlPurchaseDto,
    @Req() req: any
  ): Promise<any> {
    const tenantId = this.getEffectiveTenantId(req);
    return this.purchasesService.importFromXml(tenantId, body);
  }

  @Get()
  @ApiOperation({ summary: 'Obtiene el listado del Libro Digital de Compras y Gastos (606)' })
  @ApiHeader({ name: 'X-API-Key', required: false })
  async getPurchases(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('status') status?: string
  ): Promise<any> {
    const tenantId = this.getEffectiveTenantId(req);
    return this.purchasesService.getPurchases(tenantId, { search, status });
  }

  @Post(':id/commercial-approval')
  @ApiOperation({ summary: 'Emite Aprobación o Rechazo Comercial DGII para un comprobante de compra' })
  @ApiHeader({ name: 'X-API-Key', required: false })
  async commercialApproval(
    @Param('id') id: string,
    @Body() body: CommercialApprovalDto,
    @Req() req: any
  ): Promise<any> {
    const tenantId = this.getEffectiveTenantId(req);
    return this.purchasesService.setCommercialApproval(tenantId, id, body.status, body.comment);
  }

  @Get('export/606')
  @ApiOperation({ summary: 'Descarga el archivo estructurado oficial Formato DGII 606' })
  @ApiHeader({ name: 'X-API-Key', required: false })
  async export606(
    @Req() req: any,
    @Query('periodo') periodo: string,
    @Res() res: Response
  ): Promise<any> {
    const tenantId = this.getEffectiveTenantId(req);
    const result = await this.purchasesService.exportFormat606(tenantId, periodo);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.content);
  }
}
