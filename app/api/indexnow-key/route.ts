// GET /api/indexnow-key — serves the IndexNow key file for domain verification.
//
// IndexNow requires a plain-text file at {appUrl}/{key}.txt containing just
// the key value. We can't put a .txt file in the app router, so this route
// is proxied by a rewrite in next.config.ts (or called directly as fallback).
//
// The rewrite maps /{key}.txt → /api/indexnow-key so IndexNow's crawler
// can verify the key at the expected URL.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const key = process.env.INDEXNOW_API_KEY;
  if (!key) {
    return new NextResponse('Not configured', { status: 404 });
  }
  return new NextResponse(key, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
