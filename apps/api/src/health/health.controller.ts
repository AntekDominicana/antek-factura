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
      securityShield: 'blind-llm-agents-active',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      dgiiReceptor: 'operational',
    };
  }
}
