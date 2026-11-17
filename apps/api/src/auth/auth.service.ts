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
   * Registro inicial de Tenant + Usuario Administrador + Sucursal Principal
   */
  async register(dto: {
    rnc: string;
    razonSocial: string;
    nombreComercial?: string;
    direccion: string;
    correo: string;
    fullName: string;
    password: string;
    planCode?: string;
  }) {
    const cleanRnc = dto.rnc.replace(/\D/g, '');
    if (cleanRnc.length !== 9 && cleanRnc.length !== 11) {
      throw new BadRequestException('El RNC debe tener 9 dígitos y la Cédula 11 dígitos numéricos.');
    }

    if (dto.password.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
    }

    const existingTenant = await prisma.tenant.findUnique({ where: { rnc: cleanRnc } });
    if (existingTenant) {
      throw new BadRequestException(`El RNC ${cleanRnc} ya se encuentra registrado en la plataforma.`);
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // Buscar plan solicitado o BASIC por defecto
    const plan = await prisma.plan.findUnique({
      where: { code: dto.planCode || 'BASIC' },
    });

    const tenant = await prisma.tenant.create({
      data: {
        rnc: cleanRnc,
        razonSocial: dto.razonSocial.trim(),
        nombreComercial: dto.nombreComercial?.trim(),
        direccion: dto.direccion.trim(),
        correo: dto.correo.toLowerCase().trim(),
        branches: {
          create: {
            numeroSucursal: 1,
            nombre: 'Sede Principal',
            direccion: dto.direccion.trim(),
            isDefault: true,
          },
        },
        users: {
          create: {
            email: dto.correo.toLowerCase().trim(),
            fullName: dto.fullName.trim(),
            passwordHash,
            role: UserRole.ADMIN,
            isActive: true,
            emailVerified: false,
          },
        },
        subscription: {
          create: {
            planId: plan?.id || 'default-plan',
            status: 'TRIAL',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días de prueba
            invoicesUsedCurrentPeriod: 0,
          },
        },
      },
      include: {
        users: true,
        branches: true,
        subscription: { include: { plan: true } },
      },
    });

    const user = tenant.users[0];

    // Token de verificación de correo
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.cryptoService.hashSha256(rawToken);

    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: VerificationTokenType.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return {
      success: true,
      message: 'Empresa y usuario administrador registrados exitosamente.',
      tenantId: tenant.id,
      userId: user.id,
      email: user.email,
      verificationTokenSimulated: rawToken,
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

    // 3. Generar Access Token (15 min) y Refresh Token (7 días)
    const accessToken = this.jwtService.sign(
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
        rnc: user.tenant.rnc,
        plan: user.tenant.subscription?.plan?.name || 'BÁSICO',
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
}
