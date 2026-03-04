// ---------------------------------------------------------------------------
// app/api/health/route.ts — Health Check Endpoint (P7-FIX-32)
//
// GET /api/health — no auth required.
// Verifies Supabase DB and Stripe connectivity.
// Returns 200 (ok) or 503 (degraded) with service check details.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import Stripe from 'stripe';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

export async function GET() {
  const checks: Record<string, boolean> = {};

  // Database connectivity
  try {
    const supabase = createServiceRoleClient();
    await supabase.from('organizations').select('id').limit(1);
    checks.database = true;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: '/api/health', sprint: 'P7-FIX-32' },
    });
    checks.database = false;
  }

  // Stripe connectivity
  try {
    await getStripe().balance.retrieve();
    checks.stripe = true;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: '/api/health', sprint: 'P7-FIX-32' },
    });
    checks.stripe = false;
  }

  const allHealthy = Object.values(checks).every(Boolean);
  return NextResponse.json(
    {
      status: allHealthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
    },
    { status: allHealthy ? 200 : 503 }
  );
}
