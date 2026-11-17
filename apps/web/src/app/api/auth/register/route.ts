import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, rnc, razonSocial, direccion, password, plan } = body;

    if (!name || !email || !rnc || !razonSocial || !password) {
      return NextResponse.json(
        { message: 'Todos los campos fiscales y personales son obligatorios.' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://antek-factura-api.onrender.com';
    const apiRes = await fetch(`${apiUrl}/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rnc: String(rnc).trim(),
        razonSocial: String(razonSocial).trim(),
        direccion: String(direccion || 'República Dominicana').trim(),
        correo: String(email).trim(),
        fullName: String(name).trim(),
        password: String(password),
        planCode: String(plan || 'MEDIUM').toUpperCase(),
      }),
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      return NextResponse.json(
        { message: data.message || 'No se pudo completar el registro de la empresa.' },
        { status: apiRes.status }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: data.user,
      accessToken: data.accessToken,
    });

    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const sameSitePolicy = cookieDomain ? ('none' as const) : ('lax' as const);

    if (data.accessToken) {
      response.cookies.set('access_token', data.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || Boolean(cookieDomain),
        sameSite: sameSitePolicy,
        domain: cookieDomain,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
      response.cookies.set('antek_client_token', data.accessToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production' || Boolean(cookieDomain),
        sameSite: sameSitePolicy,
        domain: cookieDomain,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return response;
  } catch {
    return NextResponse.json(
      { message: 'Error de conexión con el servidor de registro.' },
      { status: 500 }
    );
  }
}
