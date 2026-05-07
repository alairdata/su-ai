import { createHmac, timingSafeEqual } from 'crypto';

const TTL_MS = 24 * 60 * 60 * 1000;
export const BACKOFFICE_COOKIE = 'backoffice-token';

function getSecret() {
  return process.env.BACKOFFICE_SECRET || process.env.NEXTAUTH_SECRET || '';
}

export function signBackofficeToken(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + TTL_MS })).toString('base64url');
  const sig = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyBackofficeToken(token: string): { email: string } | null {
  try {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac('sha256', getSecret()).update(payload).digest('base64url');
    const expBuf = Buffer.from(expected);
    const sigBuf = Buffer.from(sig);
    if (expBuf.length !== sigBuf.length || !timingSafeEqual(expBuf, sigBuf)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Date.now()) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}
