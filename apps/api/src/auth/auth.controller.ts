import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

// Limitador de intentos en memoria por IP/Usuario (Anti-Fuerza Bruta)
const loginAttemptTracker = new Map<string, { count: number; firstAttempt: number }>();

function checkRateLimit(key: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): void {
  const now = Date.now();
  const entry = loginAttemptTracker.get(key);

  if (!entry) {
    loginAttemptTracker.set(key, { count: 1, firstAttempt: now });
    return;
  }

  if (now - entry.firstAttempt > windowMs) {
    loginAttemptTracker.set(key, { count: 1, firstAttempt: now });
    return;
  }

  if (entry.count >= maxAttempts) {
    const remainingMin = Math.ceil((windowMs - (now - entry.firstAttempt)) / (60 * 1000));
    throw new HttpException(
      `Demasiados intentos fallidos. Su acceso ha sido bloqueado temporalmente por ${remainingMin} minuto(s) por seguridad.`,
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  entry.count++;
}

function resetRateLimit(key: string): void {
  loginAttemptTracker.delete(key);
}

@ApiTags('Autenticación, Sesiones & Seguridad')
@Controller(['auth', 'v1/auth'])
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService
  ) {}

  private extractUserFromToken(req: Request): any {
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if ((req as any).cookies?.access_token) {
      token = (req as any).cookies.access_token;
    }

    if (!token) {
      throw new UnauthorizedException('Token de sesión no encontrado.');
    }

    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Token de sesión expirado o inválido.');
    }
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registro de nuevo contribuyente y usuario administrador con validación estricta' })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicio de sesión seguro con protección contra fuerza bruta y cookies HttpOnly' })
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const rateLimitKey = `login:${ipAddress}:${body.email.toLowerCase()}`;

    // Validar límite de intentos antes de procesar
    checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);

    let result;
    try {
      result = await this.authService.login(body, { userAgent, ipAddress });
      // Si el login fue exitoso, resetear contador de intentos
      resetRateLimit(rateLimitKey);
    } catch (err) {
      throw err;
    }

    if (result.requires2fa) {
      return result;
    }

    const isProd = process.env.NODE_ENV === 'production';
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const sameSitePolicy = cookieDomain ? ('none' as const) : ('lax' as const);

    // Cookies blindadas HttpOnly y Secure
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: true, // Forzar Secure por HTTPS
      sameSite: sameSitePolicy,
      domain: cookieDomain,
      maxAge: 15 * 60 * 1000, // 15 minutos
      path: '/',
    });

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true, // Forzar Secure por HTTPS
      sameSite: sameSitePolicy,
      domain: cookieDomain,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      path: '/',
    });

    return {
      success: true,
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotación segura de Refresh Token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: { refreshToken?: string }
  ) {
    const rawToken = body?.refreshToken || (req as any).cookies?.refresh_token;
    const userAgent = req.headers['user-agent'];
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

    const result = await this.authService.refreshToken(rawToken, { userAgent, ipAddress });
    const isProd = process.env.NODE_ENV === 'production';
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const sameSitePolicy = cookieDomain ? ('none' as const) : ('lax' as const);

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: isProd || Boolean(cookieDomain),
      sameSite: sameSitePolicy,
      domain: cookieDomain,
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: isProd || Boolean(cookieDomain),
      sameSite: sameSitePolicy,
      domain: cookieDomain,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      success: true,
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cierre de sesión y revocación' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = (req as any).cookies?.refresh_token;
    await this.authService.logout(rawToken);

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    return { success: true, message: 'Sesión finalizada.' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cierre de sesión en todos los dispositivos' })
  async logoutAll(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = this.extractUserFromToken(req);
    await this.authService.logoutAll(user.sub);

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    return { success: true, message: 'Todas las sesiones activas han sido cerradas.' };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambio de contraseña seguro' })
  async changePassword(
    @Req() req: Request,
    @Body() body: { currentPassword: string; newPassword: string }
  ) {
    const user = this.extractUserFromToken(req);
    return this.authService.changePassword(user.sub, body);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Lista de sesiones activas en otros dispositivos' })
  async getSessions(@Req() req: Request) {
    const user = this.extractUserFromToken(req);
    return this.authService.getActiveSessions(user.sub);
  }

  @Get('me')
  @ApiOperation({ summary: 'Datos del perfil del usuario autenticado, empresa y plan SaaS' })
  async me(@Req() req: Request): Promise<any> {
    const user = this.extractUserFromToken(req);
    const profile = await this.authService.getUserProfile(user.sub || user.userId);
    return profile;
  }

  @Get('users')
  @ApiOperation({ summary: 'Listar usuarios registrados en Supabase para el tenant actual' })
  async getUsers(@Req() req: Request): Promise<any> {
    const user = this.extractUserFromToken(req);
    const users = await this.authService.getUsers(user.tenantId);
    return { users };
  }
}
