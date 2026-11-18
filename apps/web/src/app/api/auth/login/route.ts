import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { message: 'El correo/usuario y la contraseña son requeridos.' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://antek-factura-api.onrender.com';
    const apiRes = await fetch(`${apiUrl}/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      const msgMap: Record<string, string> = {
        'Invalid login credentials': 'Correo o contraseña incorrectos.',
      };
      return NextResponse.json(
        { message: msgMap[data.message] || data.message || 'Correo o contraseña incorrectos.' },
        { status: apiRes.status }
      );
    }

    // Respuesta exitosa: fijar cookie de sesión HttpOnly con soporte cross-domain
    const response = NextResponse.json({
      success: true,
      user: data.user,
      accessToken: data.accessToken,
    });

    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const sameSitePolicy = cookieDomain ? ('none' as const) : ('lax' as const);

    response.cookies.set('access_token', data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || Boolean(cookieDomain),
      sameSite: sameSitePolicy,
      domain: cookieDomain,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });

    response.cookies.set('antek_client_token', data.accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production' || Boolean(cookieDomain),
      sameSite: sameSitePolicy,
      domain: cookieDomain,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { message: 'No pudimos iniciar sesión. Inténtalo de nuevo.' },
      { status: 500 }
    );
  }
}
