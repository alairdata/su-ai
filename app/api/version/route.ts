import { NextResponse } from 'next/server';

// This value is set at build time and stays constant for the lifetime of the deployment
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || process.env.BUILD_ID || Date.now().toString();

export async function GET() {
  return NextResponse.json({ buildId: BUILD_ID }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
