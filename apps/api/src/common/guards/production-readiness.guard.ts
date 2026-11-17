import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  PreconditionFailedException,
} from '@nestjs/common';
import { prisma } from '@factura-ecf/database';
import * as crypto from 'crypto';

@Injectable()
export class ProductionReadinessGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Determinar el ambiente de destino
    const environment = req.headers['x-environment'] || req.body?.environment || 'SANDBOX';

    // En SANDBOX se permite operar para pruebas de homologación DGII
    if (environment !== 'PRODUCTION') {
      return true;
    }

    // Resolver tenant
    const apiKey = req.headers['x-api-key'];
    let tenant: any = null;

    if (apiKey) {
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      tenant = await prisma.tenant.findFirst({
        where: { apiKeys: { some: { keyHash } } },
        include: {
          subscription: true,
          sequences: { where: { environment: 'PRODUCTION', isActive: true } },
        },
      });
    }

    if (!tenant) {
      tenant = await prisma.tenant.findFirst({
        include: {
          subscription: true,
          sequences: { where: { environment: 'PRODUCTION', isActive: true } },
        },
      });
    }

    if (!tenant) {
      throw new ForbiddenException('Tenant no identificado para emisión en PRODUCCIÓN.');
    }

    // 1. Validar suscripción activa
    if (!tenant.subscription || tenant.subscription.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Para emitir comprobantes fiscales en PRODUCCIÓN (validez tributaria DGII) se requiere una suscripción ACTIVA en la plataforma.'
      );
    }

    // 2. Validar que exista certificado digital de producción (.p12)
    if (!tenant.certificadoP12Enc) {
      throw new PreconditionFailedException(
        'Falta configurar el Certificado Digital de Persona Jurídica (.p12) emitido por una CA autorizada (Avansi / Optic / Digi-Sign) para PRODUCCIÓN.'
      );
    }

    // 3. Validar secuencias fiscales asignadas por DGII
    if (!tenant.sequences || tenant.sequences.length === 0) {
      throw new PreconditionFailedException(
        'No existen rangos de secuencias e-NCF activas asignadas por la DGII para el entorno de PRODUCCIÓN.'
      );
    }

    return true;
  }
}
