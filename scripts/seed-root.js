const { PrismaClient, UserRole } = require('../packages/database/dist');
const bcrypt = require('../apps/api/node_modules/bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Sembrando Tenant Principal y Usuario Admin Root en Supabase ---');
  
  // 1. Obtener Plan PRO
  const planPro = await prisma.plan.findUnique({ where: { code: 'PRO' } });
  if (!planPro) throw new Error('Plan PRO no encontrado.');

  // 2. Crear o actualizar Tenant Principal ANTEK
  const tenant = await prisma.tenant.upsert({
    where: { rnc: '131880738' },
    update: {
      razonSocial: 'ANTEK DOMINICANA SRL',
      nombreComercial: 'ANTEK Software & Facturación Electrónica',
      correo: 'info@antek.com.do',
      telefono: '809-555-0199',
      direccion: 'Av. Winston Churchill #1099, Torre Empresarial, Santo Domingo, D.N.',
      actividadEconomica: '6201 - Desarrollo de software y sistemas fiscales electrónicos',
      fiscalProvider: 'DGII_DIRECT',
      environment: 'SANDBOX',
    },
    create: {
      rnc: '131880738',
      razonSocial: 'ANTEK DOMINICANA SRL',
      nombreComercial: 'ANTEK Software & Facturación Electrónica',
      correo: 'info@antek.com.do',
      telefono: '809-555-0199',
      direccion: 'Av. Winston Churchill #1099, Torre Empresarial, Santo Domingo, D.N.',
      provinciaCodigo: '10000',
      municipioCodigo: '10100',
      actividadEconomica: '6201 - Desarrollo de software y sistemas fiscales electrónicos',
      fiscalProvider: 'DGII_DIRECT',
      environment: 'SANDBOX',
    }
  });

  console.log('✓ Tenant Principal:', tenant.id, tenant.razonSocial);

  // 3. Crear Sucursal Principal
  await prisma.branch.upsert({
    where: { id: 'branch-antek-principal' },
    update: { tenantId: tenant.id },
    create: {
      id: 'branch-antek-principal',
      tenantId: tenant.id,
      numeroSucursal: 1,
      nombre: 'Sede Principal Santo Domingo',
      direccion: 'Av. Winston Churchill #1099, Torre Empresarial',
      isDefault: true,
    }
  });

  // 4. Crear Suscripción Activa PRO
  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {
      planId: planPro.id,
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      invoicesUsedCurrentPeriod: 0
    },
    create: {
      tenantId: tenant.id,
      planId: planPro.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      invoicesUsedCurrentPeriod: 0
    }
  });
  console.log('✓ Suscripción PRO vinculada.');

  // 5. Crear usuario rootfacturas
  const rootPasswordHash = await bcrypt.hash('RootFacturas2026!', 12);
  const rootUser = await prisma.tenantUser.upsert({
    where: { id: 'user-rootfacturas' },
    update: {
      email: 'rootfacturas@antek.com.do',
      passwordHash: rootPasswordHash,
      fullName: 'Administrador Root (rootfacturas)',
      role: UserRole.SUPERADMIN,
      isActive: true,
      emailVerified: true
    },
    create: {
      id: 'user-rootfacturas',
      tenantId: tenant.id,
      email: 'rootfacturas@antek.com.do',
      passwordHash: rootPasswordHash,
      fullName: 'Administrador Root (rootfacturas)',
      role: UserRole.SUPERADMIN,
      isActive: true,
      emailVerified: true
    }
  });
  console.log('✓ Usuario Root creado:', rootUser.email);

  // 6. Crear usuario Juan Pérez (Cliente / Admin)
  const juanPasswordHash = await bcrypt.hash('JuanPerez2026!', 12);
  const juanUser = await prisma.tenantUser.upsert({
    where: { id: 'user-juanperez' },
    update: {
      email: 'juanperez@antek.com.do',
      passwordHash: juanPasswordHash,
      fullName: 'Juan Pérez (Gerente Financiero)',
      role: UserRole.ADMIN,
      isActive: true,
      emailVerified: true
    },
    create: {
      id: 'user-juanperez',
      tenantId: tenant.id,
      email: 'juanperez@antek.com.do',
      passwordHash: juanPasswordHash,
      fullName: 'Juan Pérez (Gerente Financiero)',
      role: UserRole.ADMIN,
      isActive: true,
      emailVerified: true
    }
  });
  console.log('✓ Usuario Juan Pérez creado:', juanUser.email);

  // 7. Secuencias e-NCF en Supabase
  const sampleSequences = [
    { tipoEcf: 31, idRangoSecuencia: 1031, consecutivoDesde: 1, consecutivoHasta: 500000, ultimoConsecutivo: 0 },
    { tipoEcf: 32, idRangoSecuencia: 1032, consecutivoDesde: 1, consecutivoHasta: 100000, ultimoConsecutivo: 0 },
    { tipoEcf: 33, idRangoSecuencia: 1033, consecutivoDesde: 1, consecutivoHasta: 50000, ultimoConsecutivo: 0 },
    { tipoEcf: 34, idRangoSecuencia: 1034, consecutivoDesde: 1, consecutivoHasta: 50000, ultimoConsecutivo: 0 },
    { tipoEcf: 44, idRangoSecuencia: 1044, consecutivoDesde: 1, consecutivoHasta: 100000, ultimoConsecutivo: 0 },
    { tipoEcf: 45, idRangoSecuencia: 1045, consecutivoDesde: 1, consecutivoHasta: 100000, ultimoConsecutivo: 0 },
  ];

  for (const s of sampleSequences) {
    const seqId = `seq-${tenant.id}-${s.tipoEcf}-SANDBOX`;
    await prisma.ecfSequence.upsert({
      where: { id: seqId },
      update: { tenantId: tenant.id },
      create: {
        id: seqId,
        tenantId: tenant.id,
        idRangoSecuencia: s.idRangoSecuencia,
        tipoEcf: s.tipoEcf,
        consecutivoDesde: s.consecutivoDesde,
        consecutivoHasta: s.consecutivoHasta,
        ultimoConsecutivo: s.ultimoConsecutivo,
        environment: 'SANDBOX',
        isActive: true,
        fechaVencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    });
  }
  console.log('✓ Secuencias fiscales e-NCF creadas en Supabase.');
}

main().then(() => {
  console.log('*** Inicialización de Supabase Finalizada con Éxito ***');
  process.exit(0);
}).catch(e => {
  console.error('Error sembrando datos:', e);
  process.exit(1);
});
