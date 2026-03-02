import { type NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';
import { detectAIBot } from '@/lib/crawler/bot-detector';
import { resolveOrgFromHostname } from '@/lib/whitelabel/domain-resolver';

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

  const { pathname } = request.nextUrl;

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
     * - api/*         (our own Route Handlers handle auth internally)
     * - static assets (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
