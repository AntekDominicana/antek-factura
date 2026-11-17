import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { prisma, UserRole, VerificationTokenType } from '@factura-ecf/database';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CryptoService } from '../common/crypto.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly cryptoService: CryptoService
  ) {}

  /**
   * Registro inicial de Tenant + Usuario Administrador + Sucursal Principal + Secuencias iniciales
   */
  async register(
    dto: {
      rnc: string;
      razonSocial: string;
      nombreComercial?: string;
      direccion?: string;
      correo: string;
      fullName: string;
      password: string;
      planCode?: string;
    },
    meta: { userAgent?: string; ipAddress?: string } = {}
  ) {
    const cleanRnc = dto.rnc.replace(/\D/g, '');
    if (cleanRnc.length !== 9 && cleanRnc.length !== 11) {
      throw new BadRequestException('El RNC debe tener 9 dígitos y la Cédula 11 dígitos numéricos.');
    }

    if (dto.password.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
    }

    const cleanEmail = dto.correo.toLowerCase().trim();
    const direccionFiscal = (dto.direccion || 'República Dominicana').trim();

    const existingTenant = await prisma.tenant.findUnique({ where: { rnc: cleanRnc } });
    if (existingTenant) {
      throw new BadRequestException(`El RNC ${cleanRnc} ya se encuentra registrado en la plataforma.`);
    }

    const existingUser = await prisma.tenantUser.findFirst({ where: { email: cleanEmail } });
    if (existingUser) {
      throw new BadRequestException(`El correo ${cleanEmail} ya se encuentra registrado.`);
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const requestedCode = (dto.planCode || 'MEDIUM').toUpperCase();
    const planSpecs: Record<string, any> = {
      BASIC: {
        name: 'Plan Básico',
        description: 'Ideal para profesionales independientes y pymes',
        priceDop: 990,
        priceUsd: 18,
        monthlyInvoiceLimit: 100,
        maxUsers: 2,
        maxBranches: 1,
        allowedEcfTypes: [31, 32, 33, 34, 41, 43],
        apiAccess: false,
      },
      MEDIUM: {
        name: 'Plan Medio',
        description: 'Para empresas en crecimiento con acceso API',
        priceDop: 2450,
        priceUsd: 45,
        monthlyInvoiceLimit: 600,
        maxUsers: 5,
        maxBranches: 3,
        allowedEcfTypes: [31, 32, 33, 34, 41, 43, 44, 45],
        apiAccess: true,
      },
      PRO: {
        name: 'Plan Pro',
        description: 'Gama completa e-CF DGII y alta concurrencia',
        priceDop: 4900,
        priceUsd: 89,
        monthlyInvoiceLimit: 3000,
        maxUsers: 25,
        maxBranches: 10,
        allowedEcfTypes: [31, 32, 33, 34, 41, 43, 44, 45, 46, 47],
        apiAccess: true,
      },
    };
    const spec = planSpecs[requestedCode] || planSpecs.MEDIUM;
    const planCode = planSpecs[requestedCode] ? requestedCode : 'MEDIUM';

    const plan = await prisma.plan.upsert({
      where: { code: planCode },
      update: {},
      create: {
        code: planCode,
        ...spec,
        isActive: true,
      },
    });

    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);

    const tenant = await prisma.tenant.create({
      data: {
        rnc: cleanRnc,
        razonSocial: dto.razonSocial.trim(),
        nombreComercial: dto.nombreComercial?.trim() || dto.razonSocial.trim(),
        direccion: direccionFiscal,
        correo: cleanEmail,
        dataCollectionConsent: true,
        termsAcceptedVersion: 'v1.0-2026',
        termsAcceptedAt: new Date(),
        branches: {
          create: {
            numeroSucursal: 1,
            nombre: 'Sede Principal',
            direccion: direccionFiscal,
            isDefault: true,
          },
        },
        users: {
          create: {
            email: cleanEmail,
            fullName: dto.fullName.trim(),
            passwordHash,
            role: UserRole.ADMIN,
            isActive: true,
            emailVerified: true,
          },
        },
        subscription: {
          create: {
            planId: plan.id,
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gracePeriodEndsAt: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
            invoicesUsedCurrentPeriod: 0,
          },
        },
        sequences: {
          create: [31, 32, 33, 34, 41, 43].map((tipoEcf) => ({
            environment: 'SANDBOX',
            tipoEcf,
            idRangoSecuencia: 1,
            consecutivoDesde: 1,
            consecutivoHasta: 50000,
            ultimoConsecutivo: 0,
            fechaVencimiento: expirationDate,
            isActive: true,
          })),
        },
      },
      include: {
        users: true,
        branches: true,
        subscription: { include: { plan: true } },
      },
    });

    const user = tenant.users[0];

    // Emitir Access Token y Refresh Token inmediatamente para iniciar sesión tras el registro
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tenantId: tenant.id,
        rnc: tenant.rnc,
        environment: tenant.environment,
      },
      { expiresIn: '7d' }
    );

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = this.cryptoService.hashSha256(rawRefreshToken);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      success: true,
      message: 'Empresa y usuario administrador registrados exitosamente.',
      tenantId: tenant.id,
      userId: user.id,
      email: user.email,
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        tenantId: tenant.id,
        tenantName: tenant.razonSocial,
        rnc: tenant.rnc,
        direccion: tenant.direccion,
        nombreComercial: tenant.nombreComercial,
        plan: plan.name,
        subscriptionStatus: 'ACTIVE',
      },
    };
  }

  /**
   * Inicio de sesión seguro con protección contra fuerza bruta y cookies HttpOnly
   */
  async login(
    dto: { email: string; password: string; totpCode?: string },
    meta: { userAgent?: string; ipAddress?: string }
  ) {
    let email = dto.email.toLowerCase().trim();
    // Soporte para alias de administrador raíz 'rootfacturas'
    if (email === 'rootfacturas' || email === 'root' || email === 'admin') {
      email = 'rootfacturas@antek.com.do';
    }

    const user = await prisma.tenantUser.findFirst({
      where: {
        OR: [
          { email },
          { email: `${email}@antek.com.do` },
        ],
      },
      include: { tenant: { include: { subscription: { include: { plan: true } } } } },
    });

    if (!user) {
      throw new UnauthorizedException('El correo o usuario no está registrado en la base de datos de Supabase.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Esta cuenta de usuario ha sido desactivada por el administrador.');
    }

    // 1. Verificar bloqueo por fuerza bruta
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000));
      throw new HttpException(
        `Cuenta bloqueada temporalmente por intentos fallidos. Intente de nuevo en ${remainingMinutes} minuto(s).`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // 2. Verificar contraseña
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      const attempts = user.failedLoginAttempts + 1;
      let lockedUntil: Date | null = null;
      if (attempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Bloqueo 15 min
      }

      await prisma.tenantUser.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil,
        },
      });

      throw new UnauthorizedException('Credenciales inválidas.');
    }

    // Si tiene 2FA habilitado y no envió el código
    if (user.twoFactorEnabled && !dto.totpCode) {
      const tempToken = this.jwtService.sign(
        { userId: user.id, stage: '2FA_PENDING' },
        { expiresIn: '5m' }
      );
      return {
        requires2fa: true,
        tempToken,
      };
    }

    // Resetear contador de fallos y actualizar última fecha de login
    await prisma.tenantUser.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // 3. Generar Access Token (7 días para uso continuo sin cortes) y Refresh Token (7 días)
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        rnc: user.tenant.rnc,
        environment: user.tenant.environment,
      },
      { expiresIn: '7d' }
    );

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = this.cryptoService.hashSha256(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Guardar sesión en base de datos
    await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt,
      },
    });

    return {
      success: true,
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: user.tenant.razonSocial,
        nombreComercial: user.tenant.nombreComercial,
        direccion: user.tenant.direccion,
        telefono: user.tenant.telefono,
        rnc: user.tenant.rnc,
        plan: user.tenant.subscription?.plan?.name || 'Plan Medio',
        subscriptionStatus: user.tenant.subscription?.status || 'ACTIVE',
      },
    };
  }

  /**
   * Rotación estricta de Refresh Token (Anti-robo de sesión)
   */
  async refreshToken(rawRefreshToken: string, meta: { userAgent?: string; ipAddress?: string }) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token no provisto.');
    }

    const tokenHash = this.cryptoService.hashSha256(rawRefreshToken);
    const session = await prisma.userSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: { include: { tenant: true } } },
    });

    // Detección de reuso de token: si fue revocado o expiró, revocar todas las sesiones del usuario
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      if (session?.userId) {
        await prisma.userSession.updateMany({
          where: { userId: session.userId },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Token de actualización inválido o revocado.');
    }

    // Invalidar sesión anterior
    await prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const user = session.user;

    // Emitir nuevo par de tokens
    const newAccessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        rnc: user.tenant.rnc,
        environment: user.tenant.environment,
      },
      { expiresIn: '15m' }
    );

    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newRefreshTokenHash = this.cryptoService.hashSha256(newRawRefreshToken);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: newRefreshTokenHash,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  /**
   * Cierre de sesión (Revocación)
   */
  async logout(rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = this.cryptoService.hashSha256(rawRefreshToken);
      await prisma.userSession
        .update({
          where: { refreshTokenHash: tokenHash },
          data: { revokedAt: new Date() },
        })
        .catch(() => {});
    }
    return { success: true, message: 'Sesión cerrada exitosamente.' };
  }

  /**
   * Cierre de sesión en todos los dispositivos
   */
  async logoutAll(userId: string) {
    await prisma.userSession.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
    return { success: true, message: 'Todas las sesiones activas han sido revocadas.' };
  }

  /**
   * Cambio de contraseña seguro
   */
  async changePassword(userId: string, dto: { currentPassword: string; newPassword: string }) {
    const user = await prisma.tenantUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('La contraseña actual es incorrecta.');

    if (dto.newPassword.length < 8) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres.');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.newPassword, salt);

    await prisma.tenantUser.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revocar todas las sesiones anteriores
    await prisma.userSession.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    return { success: true, message: 'Contraseña actualizada y demás sesiones revocadas.' };
  }

  /**
   * Listar sesiones activas del usuario
   */
  async getActiveSessions(userId: string): Promise<any[]> {
    return prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  }

  /**
   * Listar usuarios registrados en Supabase para el tenant actual
   */
  async getUsers(tenantId: string): Promise<any[]> {
    return prisma.tenantUser.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Obtener perfil completo del usuario con información de tenant y plan
   */
  async getUserProfile(userId: string): Promise<any> {
    const user = await prisma.tenantUser.findUnique({
      where: { id: userId },
      include: {
        tenant: {
          include: {
            subscription: {
              include: {
                plan: true,
              },
            },
            branches: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      twoFactorEnabled: user.twoFactorEnabled,
      tenant: {
        id: user.tenant.id,
        rnc: user.tenant.rnc,
        razonSocial: user.tenant.razonSocial,
        nombreComercial: user.tenant.nombreComercial,
        correo: user.tenant.correo,
        direccion: user.tenant.direccion,
        environment: user.tenant.environment,
        subscription: user.tenant.subscription,
      },
    };
  }

  /**
   * Crear o invitar un colaborador real en Supabase PostgreSQL para el tenant actual
   */
  async createTeamUser(
    tenantId: string,
    dto: { fullName: string; email: string; password?: string; role?: string }
  ): Promise<any> {
    const cleanEmail = dto.email.toLowerCase().trim();
    const existing = await prisma.tenantUser.findFirst({ where: { email: cleanEmail } });
    if (existing) {
      throw new BadRequestException(`El correo ${cleanEmail} ya pertenece a un usuario registrado.`);
    }

    const rawPassword = dto.password && dto.password.length >= 8 ? dto.password : crypto.randomBytes(12).toString('hex');
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    const roleUpper = (dto.role || 'BILLER').toUpperCase();
    let userRole: UserRole = UserRole.BILLER;
    if (roleUpper === 'ADMIN') userRole = UserRole.ADMIN;
    else if (roleUpper === 'ACCOUNTANT') userRole = UserRole.ACCOUNTANT;

    const created = await prisma.tenantUser.create({
      data: {
        tenantId,
        email: cleanEmail,
        fullName: dto.fullName.trim(),
        passwordHash,
        role: userRole,
        isActive: true,
        emailVerified: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      user: created,
    };
  }

  /**
   * Revocar acceso a un colaborador del tenant
   */
  async deleteTeamUser(tenantId: string, targetUserId: string, requestingUserId: string): Promise<any> {
    if (targetUserId === requestingUserId) {
      throw new BadRequestException('No puedes revocar tu propia cuenta de usuario.');
    }

    const target = await prisma.tenantUser.findFirst({
      where: { id: targetUserId, tenantId },
    });
    if (!target) {
      throw new NotFoundException('Usuario no encontrado en esta empresa.');
    }

    await prisma.tenantUser.delete({ where: { id: target.id } });
    return { success: true, message: 'Acceso revocado correctamente.' };
  }
}
