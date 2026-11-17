import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Sesión cerrada.' });
  response.cookies.delete('access_token');
  response.cookies.delete('antek_client_token');
  return response;
}
