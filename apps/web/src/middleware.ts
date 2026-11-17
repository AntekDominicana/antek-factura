import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
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

  // 2. Si ya está autenticado y visita /login o /register, redirigir al Dashboard
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/app/dashboard', request.url));
  }

  // Cabeceras de seguridad estrictas (Anti-Fuga y Blind-LLM Shield)
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  response.headers.set('X-Developer', 'antek');
  response.headers.set('X-Brand-System', 'ANTEK Factura');
  response.headers.set('X-Security-Policy', 'blind-llm-agents-active; no-data-scraping; rls-enforced');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');

  return response;
}

export const config = {
  matcher: ['/app/:path*', '/superadmin/:path*', '/login', '/register'],
};
