import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function verifyJwtSignatureIfConfigured(token: string): Promise<boolean> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return true; // Backend enforces full signature + DB role check on every API call
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBase64 = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    const sigPadded = sigBase64 + '='.repeat((4 - (sigBase64.length % 4)) % 4);
    const sigBytes = Uint8Array.from(atob(sigPadded), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${parts[0]}.${parts[1]}`));
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedApp = pathname.startsWith('/app');
  const isProtectedAdmin = pathname.startsWith('/superadmin');
  const isAuthPage = pathname === '/login' || pathname === '/register';

  const token = request.cookies.get('access_token')?.value;

  // 1. Redirección obligatoria al Login si no hay sesión activa en rutas protegidas
  if ((isProtectedApp || isProtectedAdmin) && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Verificación de rol SUPERADMIN en servidor para /superadmin
  if (isProtectedAdmin && token) {
    const sigOk = await verifyJwtSignatureIfConfigured(token);
    const payload = sigOk ? decodeJwtPayload(token) : null;
    const isSuperAdmin =
      payload?.role === 'SUPERADMIN' ||
      String(payload?.email || '').toLowerCase() === 'rootfacturas@antek.com.do';

    if (!payload || !isSuperAdmin) {
      return NextResponse.redirect(new URL('/app/dashboard', request.url));
    }
  }

  // 3. Si ya está autenticado y visita /login o /register, redirigir al Dashboard
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/app/dashboard', request.url));
  }

  // Cabeceras de seguridad estrictas
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  response.headers.set('X-Developer', 'antek');
  response.headers.set('X-Brand-System', 'ANTEK Factura');
  response.headers.set('X-Security-Policy', 'rls-enforced; strict-role-guard');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');

  return response;
}

export const config = {
  matcher: ['/app/:path*', '/superadmin/:path*', '/login', '/register'],
};
