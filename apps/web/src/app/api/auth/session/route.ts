import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const token =
    request.cookies.get('access_token')?.value ||
    request.cookies.get('antek_client_token')?.value ||
    null;

  return NextResponse.json({
    authenticated: Boolean(token),
    accessToken: token,
  });
}
