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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';

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
  @ApiOperation({ summary: 'Registro de nuevo contribuyente y usuario administrador' })
  async register(
    @Body()
    body: {
      rnc: string;
      razonSocial: string;
      nombreComercial?: string;
      direccion: string;
      correo: string;
      fullName: string;
      password: string;
      planCode?: string;
    }
  ) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicio de sesión seguro con emisión de cookies HttpOnly' })
  async login(
    @Body() body: { email: string; password: string; totpCode?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

    const result = await this.authService.login(body, { userAgent, ipAddress });

    if (result.requires2fa) {
      return result;
    }

    const isProd = process.env.NODE_ENV === 'production';
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const sameSitePolicy = cookieDomain ? ('none' as const) : ('lax' as const);

    // Cookies seguras HttpOnly con soporte cross-domain (.antek.com.do)
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: isProd || Boolean(cookieDomain),
      sameSite: sameSitePolicy,
      domain: cookieDomain,
      maxAge: 15 * 60 * 1000, // 15 minutos
      path: '/',
    });

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: isProd || Boolean(cookieDomain),
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
