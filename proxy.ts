import { type NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';
import { detectAIBot } from '@/lib/crawler/bot-detector';
import { resolveOrgFromHostname } from '@/lib/whitelabel/domain-resolver';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit/rate-limiter';
import { PLAN_RATE_LIMITS, RATE_LIMIT_BYPASS_PREFIXES } from '@/lib/rate-limit/types';

const PROTECTED_PREFIXES = ['/dashboard'];
const AUTH_PREFIXES = ['/login', '/register', '/signup'];

export function proxy(request: NextRequest) {
  return handleProxy(request);
}

async function handleProxy(request: NextRequest) {
  // ── Subdomain routing (Sprint 62C) ──────────────────────────────────────
  //
  // Vercel DNS configuration:
  //   menu.localvector.ai  → CNAME to Vercel (rewrite to /m/ path)
  //   app.localvector.ai   → CNAME to Vercel (normal app routing)
  //   localvector.ai       → CNAME to Vercel (landing page, default)
  //
  // Requires wildcard DNS: *.localvector.ai → Vercel deployment.
  //
  // Local dev: curl -H "Host: menu.localhost:3000" http://localhost:3000/charcoal-n-chill
  // Or add to /etc/hosts: 127.0.0.1 menu.localhost
  //
  const hostname = request.headers.get('host') ?? '';

  if (hostname.startsWith('menu.')) {
    // menu.localvector.ai/<slug> → /m/<slug> (public, no auth needed)
    const { pathname } = request.nextUrl;

    // Sprint 73: AI bot detection — fire-and-forget log
    const ua = request.headers.get('user-agent');
    const bot = detectAIBot(ua);
    if (bot && pathname !== '/' && !pathname.startsWith('/m/')) {
      const slug = pathname.slice(1); // e.g. "/charcoal-n-chill" → "charcoal-n-chill"
      const logUrl = new URL('/api/internal/crawler-log', request.url);
      fetch(logUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.CRON_SECRET ?? '',
        },
        body: JSON.stringify({ botType: bot.botType, userAgent: ua, slug }),
      }).catch(() => {}); // Absorbed — bot logging never blocks page delivery (§17)
    }

    const url = request.nextUrl.clone();
    if (!url.pathname.startsWith('/m/')) {
      url.pathname = `/m${url.pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // ── Sprint 118: Rate limiting for /api/ routes ────────────────────────────
  // Runs BEFORE auth guard. API routes handle auth internally.
  // Uses x-org-plan header (Sprint 114 white-label) or falls back to IP-based.
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    // Bypass protected routes (webhooks, cron, email, revalidate)
    if (RATE_LIMIT_BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown';
    const planHeader = request.headers.get('x-org-plan');
    const orgId = request.headers.get('x-org-id');

    let config = PLAN_RATE_LIMITS['anonymous'];
    let identifier = ip;

    if (planHeader && orgId && PLAN_RATE_LIMITS[planHeader]) {
      config = PLAN_RATE_LIMITS[planHeader];
      identifier = orgId;
    }

    const rlResult = await checkRateLimit(config, identifier);
    if (!rlResult.allowed) {
      return NextResponse.json(
        {
          error: 'rate_limited',
          message: 'Too many requests',
          retry_after: rlResult.retry_after,
        },
        { status: 429, headers: getRateLimitHeaders(rlResult) },
      );
    }

    const apiResponse = NextResponse.next();
    const rlHeaders = getRateLimitHeaders(rlResult);
    for (const [key, value] of Object.entries(rlHeaders)) {
      apiResponse.headers.set(key, value);
    }
    return apiResponse;
  }

  // app. subdomain or bare domain → standard routing with auth
  const { supabase, response } = createMiddlewareClient(request);

  // ── Sprint 114: White-Label domain resolution ─────────────────────────────
  // Resolve incoming hostname → org context BEFORE auth guard.
  // If a match is found, inject x-org-* headers for server components.
  // On failure: continue normally (never block requests due to domain resolution).
  try {
    const orgContext = await resolveOrgFromHostname(hostname, supabase);
    if (orgContext) {
      response.headers.set('x-org-id', orgContext.org_id);
      response.headers.set('x-org-name', orgContext.org_name);
      response.headers.set('x-org-plan', orgContext.plan_tier);
      response.headers.set('x-resolved-hostname', orgContext.resolved_hostname);
      response.headers.set('x-is-custom-domain', String(orgContext.is_custom_domain));
    }
  } catch {
    // Domain resolution failure must never block the request — degrade silently
  }

  // IMPORTANT: Use getUser(), NOT getSession().
  // getSession() reads from the cookie without server-side verification and can
  // be spoofed. getUser() sends the token to Supabase Auth for validation.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Always return the response from createMiddlewareClient so any refreshed
  // session cookies are forwarded to the browser.
  return response;
}

export const config = {
  matcher: [
    /*
     * Run on all paths except:
     * - _next/static  (Next.js build artifacts)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - static assets (svg, png, jpg, etc.)
     *
     * Sprint 118: api/* now included for rate limiting.
     * API routes return early after rate limit check (no auth guard).
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
