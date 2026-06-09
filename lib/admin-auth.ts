import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { verifyBackofficeToken, BACKOFFICE_COOKIE } from '@/lib/backoffice-auth';

export interface AdminIdentity {
  authorized: boolean;
  email: string;
  userId: string | null;
}

// Emails allowed to use the /admin dashboard via their normal login session.
// Falls back to BACKOFFICE_EMAIL so the owner doesn't need a second env var.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.BACKOFFICE_EMAIL || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// Authorizes a request as admin via EITHER:
//   1. the signed, httpOnly backoffice cookie (set by /api/backoffice/auth), or
//   2. a logged-in NextAuth session whose email is on the admin allowlist.
// Anyone else — including ordinary logged-in users — is rejected.
export async function getAdminIdentity(req: NextRequest): Promise<AdminIdentity> {
  // Path 1: backoffice signed cookie (the /backoffice dashboard)
  const cookieToken = req.cookies.get(BACKOFFICE_COOKIE)?.value;
  if (cookieToken) {
    const verified = verifyBackofficeToken(cookieToken);
    if (verified) {
      return { authorized: true, email: verified.email, userId: null };
    }
  }

  // Path 2: allow-listed admin email via normal login (the /admin dashboard)
  if (ADMIN_EMAILS.length > 0) {
    try {
      const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      const email = (jwt?.email as string | undefined)?.toLowerCase();
      if (email && ADMIN_EMAILS.includes(email)) {
        return { authorized: true, email, userId: (jwt?.id as string) || null };
      }
    } catch {
      // fall through to unauthorized
    }
  }

  return { authorized: false, email: '', userId: null };
}
