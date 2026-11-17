import { PrismaClient, Prisma } from '@prisma/client';

export const DIRECT_TENANT_MODELS = [
  'Invoice',
  'Customer',
  'Product',
  'EcfSequence',
  'Branch',
  'ApiKey',
  'Webhook',
  'ReceivedPurchase',
  'FiscalEventLog',
  'TenantUser',
] as const;

export type DirectTenantModelName = (typeof DIRECT_TENANT_MODELS)[number];

/**
 * Extensión de Prisma Client que inyecta y valida obligatoriamente el tenantId
 * en todas las operaciones CRUD para impedir cualquier acceso cruzado (Anti-IDOR).
 */
export function withTenant(prismaClient: PrismaClient, tenantId: string) {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('TenantIsolationError: tenantId obligatorio no provisto o inválido.');
  }

  const cleanTenantId = tenantId.trim();

  return prismaClient.$extends({
    name: 'multiTenantIsolation',
    query: {
      $allModels: {
        async findFirst({ model, args, query }) {
          if (DIRECT_TENANT_MODELS.includes(model as DirectTenantModelName)) {
            args.where = { ...(args.where || {}), tenantId: cleanTenantId } as any;
          }
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }) {
          if (DIRECT_TENANT_MODELS.includes(model as DirectTenantModelName)) {
            args.where = { ...(args.where || {}), tenantId: cleanTenantId } as any;
          }
          return query(args);
        },
        async findMany({ model, args, query }) {
          if (DIRECT_TENANT_MODELS.includes(model as DirectTenantModelName)) {
            args.where = { ...(args.where || {}), tenantId: cleanTenantId } as any;
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (DIRECT_TENANT_MODELS.includes(model as DirectTenantModelName)) {
            args.where = { ...(args.where || {}), tenantId: cleanTenantId } as any;
          }
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (DIRECT_TENANT_MODELS.includes(model as DirectTenantModelName)) {
            args.where = { ...(args.where || {}), tenantId: cleanTenantId } as any;
          }
          return query(args);
        },
        async groupBy({ model, args, query }) {
          if (DIRECT_TENANT_MODELS.includes(model as DirectTenantModelName)) {
            args.where = { ...(args.where || {}), tenantId: cleanTenantId } as any;
          }
          return query(args as any);
        },
        async create({ model, args, query }) {
          if (DIRECT_TENANT_MODELS.includes(model as DirectTenantModelName)) {
            args.data = { ...(args.data as any), tenantId: cleanTenantId } as any;
          }
          return query(args);
        },
        async createMany({ model, args, query }) {
          if (DIRECT_TENANT_MODELS.includes(model as DirectTenantModelName)) {
            if (Array.isArray(args.data)) {
              args.data = args.data.map((item: any) => ({ ...item, tenantId: cleanTenantId })) as any;
            } else {
              args.data = { ...(args.data as any), tenantId: cleanTenantId } as any;
            }
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (DIRECT_TENANT_MODELS.includes(model as DirectTenantModelName)) {
            args.where = { ...(args.where || {}), tenantId: cleanTenantId } as any;
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (DIRECT_TENANT_MODELS.includes(model as DirectTenantModelName)) {
            args.where = { ...(args.where || {}), tenantId: cleanTenantId } as any;
          }
          return query(args);
        },
        async upsert({ model, args, query }) {
          if (DIRECT_TENANT_MODELS.includes(model as DirectTenantModelName)) {
            args.where = { ...(args.where || {}), tenantId: cleanTenantId } as any;
            args.create = { ...(args.create as any), tenantId: cleanTenantId } as any;
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (DIRECT_TENANT_MODELS.includes(model as DirectTenantModelName)) {
            args.where = { ...(args.where || {}), tenantId: cleanTenantId } as any;
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (DIRECT_TENANT_MODELS.includes(model as DirectTenantModelName)) {
            args.where = { ...(args.where || {}), tenantId: cleanTenantId } as any;
          }
          return query(args);
        },
      },
    },
  });
}

/**
 * Asigna el siguiente e-NCF disponible bajo alta concurrencia (200+ usuarios)
 * usando transacciones con bloqueo pesimista en PostgreSQL ('SELECT ... FOR UPDATE')
 * evitando saltos, duplicados o carreras de condición.
 */
export async function allocateNextConsecutivePessimistic(
  prismaClient: PrismaClient,
  tenantId: string,
  tipoEcf: number,
  environment: 'SANDBOX' | 'PRODUCTION' = 'SANDBOX'
): Promise<{ encf: string; sequenceId: string; consecutive: number }> {
  return prismaClient.$transaction(async (tx) => {
    // 1. Bloqueo pesimista de fila en PostgreSQL para serializar la asignación
    const rows: any[] = await tx.$queryRaw`
      SELECT id, "tipoEcf", "serie", "secuencialInicial", "secuencialFinal", "ultimoConsecutivo", "fechaVencimiento"
      FROM "EcfSequence"
      WHERE "tenantId" = ${tenantId}
        AND "tipoEcf" = ${tipoEcf}
        AND "environment" = ${environment}::"SystemEnvironment"
        AND "isActive" = true
      LIMIT 1
      FOR UPDATE;
    `;

    if (!rows || rows.length === 0) {
      throw new Error(
        `No hay secuencias e-NCF activas configuradas para tipo ${tipoEcf} en entorno ${environment}.`
      );
    }

    const seq = rows[0];

    // 2. Verificar vencimiento de la autorización DGII
    if (seq.fechaVencimiento && new Date(seq.fechaVencimiento) < new Date()) {
      throw new Error(
        `La autorización DGII para la secuencia de tipo ${tipoEcf} venció el ${new Date(seq.fechaVencimiento).toLocaleDateString()}.`
      );
    }

    const nextConsecutive = Number(seq.ultimoConsecutivo) + 1;

    // 3. Verificar agotamiento del rango autorizado
    if (nextConsecutive > Number(seq.secuencialFinal)) {
      throw new Error(
        `Rango de e-NCF agotado para tipo ${tipoEcf} (límite autorizado: ${seq.secuencialFinal}). Solicite un nuevo rango en DGII.`
      );
    }

    // 4. Actualizar el último consecutivo atómicamente
    await tx.$executeRaw`
      UPDATE "EcfSequence"
      SET "ultimoConsecutivo" = ${nextConsecutive},
          "updatedAt" = NOW()
      WHERE id = ${seq.id};
    `;

    // 5. Formatear e-NCF Oficial DGII (Ejemplo: E310000000001)
    const tipoStr = String(tipoEcf).padStart(2, '0');
    const seqStr = String(nextConsecutive).padStart(10, '0');
    const encf = `E${tipoStr}${seqStr}`;

    return {
      encf,
      sequenceId: seq.id,
      consecutive: nextConsecutive,
    };
  });
}
