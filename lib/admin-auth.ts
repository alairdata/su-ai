import { NextRequest } from 'next/server';
import { getSessionFromRequest } from './mobile-auth';
import { verifyBackofficeToken, BACKOFFICE_COOKIE } from './backoffice-auth';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(email => email.length > 0);

export interface AdminIdentity {
  authorized: boolean;
  email: string;
  userId: string | null;
}

export async function getAdminIdentity(req: NextRequest): Promise<AdminIdentity> {
  // Try NextAuth session first
  const session = await getSessionFromRequest(req);
  if (session?.user?.email) {
    const email = session.user.email.toLowerCase();
    if (ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(email)) {
      return { authorized: true, email, userId: session.user.id || null };
    }
  }

  // Fall back to backoffice token
  const token = req.cookies.get(BACKOFFICE_COOKIE)?.value;
  if (token) {
    const data = verifyBackofficeToken(token);
    if (data) {
      return { authorized: true, email: data.email, userId: null };
    }
  }

  if (ADMIN_EMAILS.length === 0) {
    console.error('SECURITY: ADMIN_EMAILS not configured!');
  }

  return { authorized: false, email: '', userId: null };
}
