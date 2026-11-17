import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BillingService } from './billing.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly billingService: BillingService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] || request.headers['authorization'];
    const isApiKeyRequest = Boolean(apiKey);
    // Extracción inviolable: solo desde el contexto autenticado, nunca de headers no seguros
    const tenantId = request.user?.tenantId || request.tenantId || 'tenant-principal';

    const body = request.body || {};
    let tipoEcf = Number(body.tipoEcf);

    // Si tipoEcf no viene explícito, inferir del e-NCF (ej. E310000000001 -> 31)
    if (!tipoEcf && body.encf && typeof body.encf === 'string' && body.encf.startsWith('E')) {
      const parsedType = parseInt(body.encf.slice(1, 3), 10);
      if (!isNaN(parsedType)) {
        tipoEcf = parsedType;
      }
    }

    // Default a 31 si no se provee
    if (!tipoEcf) {
      tipoEcf = 31;
    }

    // Ejecuta las 4 reglas del negocio
    this.billingService.checkEmissionAllowed(tenantId, tipoEcf, isApiKeyRequest);

    // Guardar referencia en el request para uso posterior
    request.subscription = this.billingService.getSubscription(tenantId);

    return true;
  }
}
