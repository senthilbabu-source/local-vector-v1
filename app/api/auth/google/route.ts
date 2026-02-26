// ---------------------------------------------------------------------------
// GET /api/auth/google — Google OAuth 2.0 Initiation (Sprint 57B)
//
// Redirects the user to Google's authorization endpoint with:
//   • scope: GBP management + basic profile
//   • state: random CSRF token stored in a secure httpOnly cookie
//   • access_type: offline (we need a refresh_token for background publishing)
//   • prompt: consent (always get refresh_token, even on re-auth)
//
// Security:
//   • CSRF protection via state parameter + cookie comparison in callback
//   • State cookie: httpOnly, secure, sameSite=lax, 10-min maxAge
//   • Requires authenticated session (via getAuthContext)
//
// Required env vars:
//   GOOGLE_CLIENT_ID=...
//   GOOGLE_CLIENT_SECRET=... (used in callback, not here)
//   NEXT_PUBLIC_APP_URL=https://app.localvector.ai
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Google OAuth 2.0 endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

// GBP management scope + basic profile info
const SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export async function GET(request: NextRequest) {
  // ── Guard: env must be configured ─────────────────────────────────────
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 503 }
    );
  }

  // ── Guard: user must be authenticated ─────────────────────────────────
  let auth;
  try {
    auth = await getAuthContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Generate CSRF state token ─────────────────────────────────────────
  const stateBytes = new Uint8Array(32);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Store state in httpOnly cookie for comparison in callback
  const cookieStore = await cookies();
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/api/auth/google/callback',
  });

  // Also store org_id so the callback can associate the token
  cookieStore.set('google_oauth_org', auth.orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/auth/google/callback',
  });

  // ── Build the authorization URL ───────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
