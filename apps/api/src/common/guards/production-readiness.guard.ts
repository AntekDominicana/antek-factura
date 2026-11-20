import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  PreconditionFailedException,
} from '@nestjs/common';
import { prisma } from '@factura-ecf/database';

@Injectable()
export class ProductionReadinessGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const tenantId = req.user?.tenantId || req.tenantId;
    let tenant: any = null;

    if (tenantId) {
      tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscription: true,
          sequences: { where: { environment: 'PRODUCTION', isActive: true } },
        },
      });
    }

    const headerEnv = req.headers['x-environment'] || req.body?.environment;
    const effectiveEnv = headerEnv || tenant?.environment || 'SANDBOX';

    // En SANDBOX / Certificación no se bloquea emisión por requisitos de producción
    if (effectiveEnv !== 'PRODUCTION') {
      return true;
    }

    if (!tenant) {
      throw new ForbiddenException('Tenant no identificado para emisión en PRODUCCIÓN.');
    }

    // 1. Validar suscripción (ACTIVA o TRIAL vigente)
    if (!tenant.subscription || ['SUSPENDED', 'CANCELED'].includes(String(tenant.subscription.status))) {
      throw new ForbiddenException(
        'Para emitir comprobantes fiscales en PRODUCCIÓN se requiere una suscripción activa en la plataforma.'
      );
    }

    // 2. Validar firma o credenciales según el proveedor fiscal elegido por el cliente
    if (tenant.fiscalProvider === 'GTI') {
      if (!tenant.gtiUsuarioEnc || !tenant.gtiClaveEnc) {
        throw new PreconditionFailedException(
          'Faltan configurar tus credenciales de GTI Partner (Usuario y Clave GTI) en Configuración → Conexión Fiscal & .p12.'
        );
      }
    } else if (tenant.fiscalProvider === 'DGII_DIRECT') {
      if (!tenant.certificadoP12Enc) {
        throw new PreconditionFailedException(
          'Falta cargar tu Certificado Digital (.p12) para firma XMLDSig en Configuración → Conexión Fiscal & .p12.'
        );
      }
    }

    // 3. Validar secuencias fiscales asignadas por DGII para ese tipo de e-CF
    if (!tenant.sequences || tenant.sequences.length === 0) {
      throw new PreconditionFailedException(
        'No existen rangos de secuencias e-NCF activas para PRODUCCIÓN. Regístralos en Secuencias e-NCF.'
      );
    }

    return true;
  }
}
