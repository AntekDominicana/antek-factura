import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { SuperAdminService } from './superadmin.service';

@ApiTags('SuperAdmin Platform Panel')
@Controller(['superadmin', 'v1/superadmin'])
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  private verifySuperAdmin(secret?: string) {
    const validSecret = process.env.SUPERADMIN_SECRET || 'antek-superadmin-secret-rd-2026';
    if (!secret || secret !== validSecret) {
      if (process.env.NODE_ENV !== 'production') return;
      throw new UnauthorizedException('Acceso restringido únicamente al equipo Super-Admin de ANTEK.');
    }
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Métricas maestras de la plataforma (MRR, Clientes, Facturas)' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  getMetrics(@Headers('X-SuperAdmin-Secret') secret?: string): Promise<any> {
    this.verifySuperAdmin(secret);
    return this.superAdminService.getMetrics();
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Listado completo de empresas registradas y estado de suscripción' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  getTenants(@Headers('X-SuperAdmin-Secret') secret?: string): Promise<any> {
    this.verifySuperAdmin(secret);
    return this.superAdminService.getAllTenants();
  }

  @Post('tenants/:id/activate-plan')
  @ApiOperation({ summary: 'Activación manual de suscripción por transferencia bancaria' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  activatePlan(
    @Param('id') tenantId: string,
    @Body() body: { planCode: string; months?: number },
    @Headers('X-SuperAdmin-Secret') secret?: string
  ): Promise<any> {
    this.verifySuperAdmin(secret);
    return this.superAdminService.manuallyActivateSubscription(tenantId, body.planCode, body.months || 1);
  }

  @Post('tenants/:id/adjust-quota')
  @ApiOperation({ summary: 'Ajuste de cuota de e-CF adicional para un cliente' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  adjustQuota(
    @Param('id') tenantId: string,
    @Body() body: { additionalQuota: number },
    @Headers('X-SuperAdmin-Secret') secret?: string
  ): Promise<any> {
    this.verifySuperAdmin(secret);
    return this.superAdminService.adjustInvoiceQuota(tenantId, body.additionalQuota);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Visor de auditoría inmutable de eventos sensibles del sistema' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  getAuditLogs(
    @Query('limit') limit?: string,
    @Headers('X-SuperAdmin-Secret') secret?: string
  ): Promise<any> {
    this.verifySuperAdmin(secret);
    return this.superAdminService.getAuditLogs(limit ? parseInt(limit, 10) : 100);
  }
}
