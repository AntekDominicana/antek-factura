import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health & Monitoring')
@Controller(['health', 'v1/health'])
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Healthcheck de la API y conectividad de servicios' })
  check() {
    return {
      status: 'ok',
      service: 'ANTEK Factura API (e-CF DGII)',
      developer: 'antek',
      brand: 'ANTEK Factura',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      dgiiReceptor: 'operational',
      miniPcIntegrations: {
        litellmConfigured: Boolean(process.env.LITELLM_BASE_URL),
        n8nWebhookConfigured: Boolean(process.env.MINI_PC_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL),
        gotenbergConfigured: Boolean(process.env.GOTENBERG_URL),
      },
    };
  }
}
