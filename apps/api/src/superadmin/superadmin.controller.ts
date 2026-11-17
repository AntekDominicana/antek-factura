import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Headers,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { prisma, SubscriptionStatus } from '@factura-ecf/database';
import { SuperAdminService } from './superadmin.service';

@ApiTags('SuperAdmin Platform Panel')
@Controller(['superadmin', 'v1/superadmin'])
export class SuperAdminController {
  constructor(
    private readonly superAdminService: SuperAdminService,
    private readonly jwtService: JwtService
  ) {}

  private async verifySuperAdmin(req: any, secret?: string): Promise<string> {
    const validSecret = process.env.SUPERADMIN_SECRET || 'antek-superadmin-secret-rd-2026';
    if (secret && secret === validSecret) {
      return 'SUPERADMIN_SECRET';
    }

    const authHeader = req?.headers?.['authorization'];
    const cookieToken = req?.cookies?.['access_token'] || req?.cookies?.['token'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : cookieToken;

    if (token) {
      let decoded: any = null;
      try {
        decoded = this.jwtService.verify(token);
      } catch (verifyErr: any) {
        if (verifyErr?.name === 'TokenExpiredError') {
          try {
            const candidate: any = this.jwtService.verify(token, { ignoreExpiration: true });
            const issuedAt = Number(candidate?.iat || 0);
            if (issuedAt > 0 && Math.floor(Date.now() / 1000) - issuedAt <= 7 * 86400) {
              decoded = candidate;
            }
          } catch {}
        }
      }

      const userId = decoded?.sub || decoded?.userId;
      if (userId) {
        const liveUser = await prisma.tenantUser.findUnique({
          where: { id: userId },
          select: { id: true, email: true, role: true, isActive: true },
        });

        if (
          liveUser &&
          liveUser.isActive &&
          (liveUser.role === 'SUPERADMIN' ||
            liveUser.email.toLowerCase() === 'rootfacturas@antek.com.do')
        ) {
          return liveUser.email;
        }
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      return 'DEV_SUPERADMIN';
    }

    throw new ForbiddenException('Acceso restringido únicamente al Administrador Root de ANTEK.');
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Métricas maestras de la plataforma (MRR, Clientes, Facturas)' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  async getMetrics(@Req() req: any, @Headers('X-SuperAdmin-Secret') secret?: string): Promise<any> {
    await this.verifySuperAdmin(req, secret);
    return this.superAdminService.getMetrics();
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Listado completo de empresas registradas y estado de suscripción' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  async getTenants(@Req() req: any, @Headers('X-SuperAdmin-Secret') secret?: string): Promise<any> {
    await this.verifySuperAdmin(req, secret);
    return this.superAdminService.getAllTenants();
  }

  @Post('tenants/:id/activate-plan')
  @ApiOperation({ summary: 'Activación manual de suscripción o cambio de estado por administrador' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  async activatePlan(
    @Param('id') tenantId: string,
    @Body() body: { planCode: string; months?: number; status?: SubscriptionStatus },
    @Req() req: any,
    @Headers('X-SuperAdmin-Secret') secret?: string
  ): Promise<any> {
    await this.verifySuperAdmin(req, secret);
    return this.superAdminService.manuallyActivateSubscription(
      tenantId,
      body.planCode,
      body.months || 1,
      body.status || 'ACTIVE'
    );
  }

  @Post('tenants/:id/send-invoice-link')
  @ApiOperation({ summary: 'Enviar nueva factura y link de pago al cliente o registrar cobro' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  async sendInvoiceLink(
    @Param('id') tenantId: string,
    @Body()
    body: {
      planCode: string;
      billingCycle?: 'MONTHLY' | 'ANNUAL';
      amount?: number;
      checkoutUrl?: string;
      invoiceNumber?: string;
      status?: 'PENDING' | 'PAID';
      months?: number;
      adminNote?: string;
    },
    @Req() req: any,
    @Headers('X-SuperAdmin-Secret') secret?: string
  ): Promise<any> {
    const adminId = await this.verifySuperAdmin(req, secret);
    return this.superAdminService.sendInvoiceAndPaymentLink(tenantId, body, adminId);
  }

  @Post('tenants/:id/adjust-quota')
  @ApiOperation({ summary: 'Ajuste de cuota de e-CF adicional para un cliente' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  async adjustQuota(
    @Param('id') tenantId: string,
    @Body() body: { additionalQuota: number },
    @Req() req: any,
    @Headers('X-SuperAdmin-Secret') secret?: string
  ): Promise<any> {
    await this.verifySuperAdmin(req, secret);
    return this.superAdminService.adjustInvoiceQuota(tenantId, body.additionalQuota);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Listar planes editables y sus links de pago (Admin Root)' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  async getPlans(@Req() req: any, @Headers('X-SuperAdmin-Secret') secret?: string): Promise<any> {
    await this.verifySuperAdmin(req, secret);
    const plans = await this.superAdminService.getPlans();
    return { plans };
  }

  @Put('plans/:code')
  @ApiOperation({ summary: 'Actualizar precios, límites y links de pago de un plan (Admin Root)' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  async updatePlan(
    @Param('code') code: string,
    @Body() body: any,
    @Req() req: any,
    @Headers('X-SuperAdmin-Secret') secret?: string
  ): Promise<any> {
    const adminId = await this.verifySuperAdmin(req, secret);
    const plan = await this.superAdminService.updatePlan(code, body, adminId);
    return { success: true, plan };
  }

  @Get('payment-settings')
  @ApiOperation({ summary: 'Obtener configuración global de pasarelas, links y cuentas bancarias' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  async getPaymentSettings(
    @Req() req: any,
    @Headers('X-SuperAdmin-Secret') secret?: string
  ): Promise<any> {
    await this.verifySuperAdmin(req, secret);
    return this.superAdminService.getPaymentSettings();
  }

  @Put('payment-settings')
  @ApiOperation({ summary: 'Actualizar métodos de pago, links de pago y cuentas bancarias oficiales' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  async updatePaymentSettings(
    @Body() body: any,
    @Req() req: any,
    @Headers('X-SuperAdmin-Secret') secret?: string
  ): Promise<any> {
    const adminId = await this.verifySuperAdmin(req, secret);
    const settings = await this.superAdminService.updatePaymentSettings(body, adminId);
    return { success: true, settings };
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Visor de auditoría inmutable de eventos sensibles del sistema' })
  @ApiHeader({ name: 'X-SuperAdmin-Secret', required: false })
  async getAuditLogs(
    @Query('limit') limit?: string,
    @Req() req?: any,
    @Headers('X-SuperAdmin-Secret') secret?: string
  ): Promise<any> {
    await this.verifySuperAdmin(req, secret);
    return this.superAdminService.getAuditLogs(limit ? parseInt(limit, 10) : 100);
  }
}
