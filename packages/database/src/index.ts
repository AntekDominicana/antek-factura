export * from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { withTenant, allocateNextConsecutivePessimistic } from './tenant-extension';

export * from './tenant-extension';

export const createPrismaClient = (databaseUrl?: string) => {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl || process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

export const defaultPrisma = createPrismaClient();
export const prisma = defaultPrisma;

/**
 * Retorna una instancia de Prisma extendida para un tenant específico
 * asegurando aislamiento estricto contra ataques IDOR.
 */
export const getTenantPrisma = (tenantId: string, client: PrismaClient = defaultPrisma) => {
  return withTenant(client, tenantId);
};

export default defaultPrisma;
