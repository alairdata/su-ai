import { NextResponse } from 'next/server';

// Force this route to be dynamic (not cached by Next.js)
export const dynamic = 'force-dynamic';

// VERCEL_GIT_COMMIT_SHA is set by Vercel on every deployment - stable within a deploy
// Fallback to a build-time timestamp baked into the bundle
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || '20260210c';

export async function GET() {
  return NextResponse.json({ buildId: BUILD_ID }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
