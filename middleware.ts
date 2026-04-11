import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  process.env.NEXTAUTH_URL,
  'https://app.so-unfiltered-ai.com',
  'https://so-unfiltered-ai.com',
].filter(Boolean);

// Paths that skip CSRF check (webhooks + auth callbacks need external access)
const CSRF_EXEMPT_PATHS = [
  '/api/webhooks/',
  '/api/auth/',
  '/api/cron/',
  '/api/verify-email',
];

function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking — no one can embed your app in an iframe
  response.headers.set('X-Frame-Options', 'DENY');
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Only send referrer to your own origin
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Block features you don't use
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // CSP — allow your own domain + all required services
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.clarity.ms https://scripts.clarity.ms https://cdn.mxpnl.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.paystack.co https://*.supabase.co https://api.anthropic.com https://*.mixpanel.com https://*.clarity.ms https://api-js.mixpanel.com; frame-src 'self' https://checkout.paystack.com; frame-ancestors 'none';"
  );
  return response;
}

export function middleware(req: NextRequest) {
  const { method, nextUrl } = req;
  const pathname = nextUrl.pathname;

  // For non-API routes, just add security headers
  if (!pathname.startsWith('/api/')) {
    return addSecurityHeaders(NextResponse.next());
  }

  // GET/HEAD/OPTIONS API requests — add headers, skip CSRF
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return addSecurityHeaders(NextResponse.next());
  }

  // Skip CSRF check for exempt paths
  if (CSRF_EXEMPT_PATHS.some(path => pathname.startsWith(path))) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Allow requests from mobile app (Bearer token auth, no Origin header)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Check Origin header (set by browsers on cross-origin requests)
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  if (origin) {
    if (ALLOWED_ORIGINS.some(allowed => origin === allowed)) {
      return addSecurityHeaders(NextResponse.next());
    }
    console.error('CSRF: Blocked request from origin:', origin);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fallback: check Referer if no Origin (some browsers)
  if (referer) {
    if (ALLOWED_ORIGINS.some(allowed => allowed && referer.startsWith(allowed))) {
      return addSecurityHeaders(NextResponse.next());
    }
    console.error('CSRF: Blocked request from referer:', referer);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // No Origin or Referer — likely a server-side or same-origin request, allow it
  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
