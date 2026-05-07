import { NextRequest, NextResponse } from 'next/server';
import { verifyBackofficeToken, BACKOFFICE_COOKIE } from '@/lib/backoffice-auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(BACKOFFICE_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });
  const data = verifyBackofficeToken(token);
  if (!data) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, email: data.email });
}
