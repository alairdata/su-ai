import { NextRequest, NextResponse } from 'next/server';
import { verifyBackofficeToken, BACKOFFICE_COOKIE } from '@/lib/backoffice-auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(BACKOFFICE_COOKIE)?.value;
  if (!token || !verifyBackofficeToken(token)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
