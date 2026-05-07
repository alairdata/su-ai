import { NextRequest, NextResponse } from 'next/server';
import { signBackofficeToken, BACKOFFICE_COOKIE } from '@/lib/backoffice-auth';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const validEmail = process.env.BACKOFFICE_EMAIL;
  const validPassword = process.env.BACKOFFICE_PASSWORD;

  if (!validEmail || !validPassword) {
    return NextResponse.json({ error: 'Backoffice not configured' }, { status: 500 });
  }

  if (email !== validEmail || password !== validPassword) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = signBackofficeToken(email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(BACKOFFICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(BACKOFFICE_COOKIE);
  return res;
}
