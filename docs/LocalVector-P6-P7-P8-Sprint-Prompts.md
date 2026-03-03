# LocalVector.ai — P6 + P7 + P8 Sprint Prompts
## Security, DevOps, Launch Readiness & Product Feature Backlog
**Sprint Block:** P6-FIX-25 through P8-FIX-38 (14 sprints)
**Priority:** P6 = Security/Compliance | P7 = DevOps/Launch | P8 = Product Features
**Execution Environment:** VS Code + Claude Code
**Prerequisite:** All P0–P5 sprints complete and committed

---

## Execution Order

```
P6  (security — run in order)
  P6-FIX-25  Security Hardening (headers, CSP, RLS, secrets)
  P6-FIX-26  GDPR / Privacy (deletion, export, consent)
  P6-FIX-27  Accessibility — WCAG 2.1 AA
  P6-FIX-28  Mobile Responsiveness

P7  (devops — run in order)
  P7-FIX-29  Error Tracking (Sentry)
  P7-FIX-30  Logging & Observability
  P7-FIX-31  CI/CD Pipeline (GitHub Actions + Supabase branches)
  P7-FIX-32  Pre-Launch Checklist

P8  (product features — independent, run in any order after P7)
  P8-FIX-33  Reality Score / DataHealth v2
  P8-FIX-34  SOV Gap → Content Brief Generator
  P8-FIX-35  Google Business Profile Integration
  P8-FIX-36  IndexNow + Bing Places Sync
  P8-FIX-37  Competitive Hijacking Alerts
  P8-FIX-38  Per-Engine Optimization Playbooks
```

---

---

# P6-FIX-25 — Security Hardening

## Background

Before real user data touches the application the attack surface must be
minimized. This sprint covers HTTP security headers, Content Security Policy,
XSS prevention via input sanitization, secrets leak detection, Supabase RLS
audit, and middleware hardening. A single RLS gap means any authenticated user
can read another user's scan data — a critical vulnerability.

## Pre-Flight Checklist

```bash
# 1. Check what security headers exist today
curl -sI https://your-staging-domain/ | grep -iE \
  "content-security|x-frame|x-content-type|strict-transport|permissions-policy"

# 2. Inventory all tables and their RLS status
# Run in Supabase SQL editor:
# SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename;

# 3. Check for secrets accidentally hardcoded
grep -rn "sk_live\|sk_test\|service_role\|anon.*key" \
  --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules | grep -v ".env" | grep -v "process\.env"

# 4. Find all dangerouslySetInnerHTML usages
grep -rn "dangerouslySetInnerHTML" --include="*.tsx" . | grep -v node_modules

# 5. Check Supabase client instantiations
grep -rn "createClient\|createServerClient\|createBrowserClient" \
  --include="*.ts" --include="*.tsx" . | grep -v node_modules | head -20

# 6. Baseline
pnpm test --passWithNoTests 2>&1 | tail -5
```

---

### PROMPT — P6-FIX-25

```
You are a senior security engineer on LocalVector.ai (Next.js 14, Supabase,
TypeScript). Your task is P6-FIX-25: harden the application against common
web vulnerabilities. Every fix must be verified by a test. Nothing should
break existing functionality.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — HTTP SECURITY HEADERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update next.config.js. Add these headers on every response:

  const securityHeaders = [
    { key: 'X-DNS-Prefetch-Control',   value: 'on' },
    { key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Frame-Options',          value: 'SAMEORIGIN' },
    { key: 'X-Content-Type-Options',   value: 'nosniff' },
    { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
    { key: 'Content-Security-Policy',  value: buildCSP() },
  ]

  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — CONTENT SECURITY POLICY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: lib/security/csp.ts

  export function buildCSP(): string {
    const directives: Record<string, string[]> = {
      'default-src':  ["'self'"],
      'script-src':   ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
      'style-src':    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src':     ["'self'", 'https://fonts.gstatic.com'],
      'img-src':      ["'self'", 'data:', 'blob:', 'https://*.supabase.co'],
      'connect-src':  ["'self'", 'https://*.supabase.co',
                       'wss://*.supabase.co',    // Realtime WebSocket
                       'https://api.stripe.com'],
      'frame-src':    ['https://js.stripe.com'],
      'object-src':   ["'none'"],
      'base-uri':     ["'self'"],
      'form-action':  ["'self'"],
      'upgrade-insecure-requests': [],
    }
    return Object.entries(directives)
      .map(([k, v]) => v.length ? `${k} ${v.join(' ')}` : k)
      .join('; ')
  }

  In development only: use Content-Security-Policy-Report-Only header
  (violations logged, not blocked) so development is not disrupted.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — INPUT SANITIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  pnpm add isomorphic-dompurify && pnpm add -D @types/dompurify

Create file: lib/security/sanitize.ts

  import DOMPurify from 'isomorphic-dompurify'

  // Strip all HTML — for every plain-text user-supplied field
  export function sanitizeText(input: string): string {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }).trim()
  }

  // Validate URL — rejects javascript: and data: schemes
  export function sanitizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) return null
      return parsed.toString()
    } catch { return null }
  }

  // Strip control characters before writing to DB
  export function sanitizeForDB(input: string): string {
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
  }

  Apply sanitizeText() to every user-supplied string field in:
    app/api/profile/update/route.ts  (business_name, description, phone, etc.)
    Any other route that writes user input to the database

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — SUPABASE RLS FULL AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run in Supabase SQL editor to get current RLS status:
  SELECT tablename, rowsecurity
  FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

Create migration: supabase/migrations/[ts]_rls_complete_audit.sql

For EVERY user-data table that has rowsecurity = false, apply:

  ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "[table]_select_own" ON [table] FOR SELECT
    USING (auth.uid() = user_id);
  CREATE POLICY "[table]_insert_own" ON [table] FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "[table]_update_own" ON [table] FOR UPDATE
    USING (auth.uid() = user_id);

  Tables that MUST have RLS (apply the pattern to each):
    profiles, subscriptions, usage_limits, scans, scan_cooldowns,
    onboarding_steps, credits_usage_log, scan_results, ai_mentions,
    position_rankings, sov_scores, content_recommendations, ai_mistakes,
    voice_search_results, site_visitors, reputation_signals,
    citation_sources, reality_scores

  Tables that intentionally skip RLS (document with a comment):
    job_execution_log  -- service_role only, no user_id, append-only audit

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — SUPABASE CLIENT USAGE AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Rule A: service-role key (supabaseAdmin) — server only, API routes, Inngest jobs
Rule B: anon key (supabaseBrowser) — client components only, respects RLS
Rule C: SUPABASE_SERVICE_ROLE_KEY must NEVER appear in NEXT_PUBLIC_* vars

Find violations:
  grep -rn "supabaseAdmin\|service_role" --include="*.tsx" . \
    | grep "'use client'" | grep -v node_modules

For each 'use client' file that imports supabaseAdmin: fix by moving the
operation to an API route and calling it via fetch().

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — SECRETS LEAK PREVENTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  pnpm add -D husky secretlint @secretlint/secretlint-rule-preset-recommend
  npx husky init

  .husky/pre-commit:
    #!/bin/sh
    npx secretlint "**/*" --secretlintignore .gitignore
    pnpm tsc --noEmit
    pnpm lint

  Verify .gitignore includes: .env .env.local .env.production .env.*.local

  Create .env.example with all required variable names and placeholder values
  (no real keys). This file IS committed to the repo as documentation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — MIDDLEWARE SECURITY LAYER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In middleware.ts, prepend these checks BEFORE existing auth logic:

  // 1. Block known scanner user agents
  const ua = request.headers.get('user-agent') ?? ''
  const blockedUA = [/sqlmap/i, /nikto/i, /nmap/i, /masscan/i]
  if (blockedUA.some(p => p.test(ua))) {
    return new Response('Forbidden', { status: 403 })
  }

  // 2. Enforce HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    const proto = request.headers.get('x-forwarded-proto')
    if (proto !== 'https') {
      return NextResponse.redirect(
        `https://${request.headers.get('host')}${request.nextUrl.pathname}`, 301
      )
    }
  }

  // 3. Attach request ID to every response (log correlation)
  const requestId = crypto.randomUUID()
  const response = NextResponse.next()
  response.headers.set('X-Request-Id', requestId)
  return response

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/security/csp.test.ts
  it('includes default-src self')
  it('includes Supabase connect-src with wss:// for Realtime')
  it('includes Stripe script-src')
  it('object-src is none')
  it('base-uri is self')
  it('does not contain unsafe-eval')

CREATE: __tests__/security/sanitize.test.ts
  describe('sanitizeText')
    it('strips <script> tags')
    it('strips HTML event attributes (onerror, onclick)')
    it('strips javascript: href')
    it('preserves plain unicode text and emoji')
    it('trims whitespace')
  describe('sanitizeUrl')
    it('accepts https:// URLs')
    it('rejects javascript: protocol — returns null')
    it('rejects data: protocol — returns null')
    it('rejects malformed strings — returns null')
  describe('sanitizeForDB')
    it('strips null bytes')
    it('strips ASCII control characters')
    it('preserves normal text')

CREATE: __tests__/security/rls.test.ts
  // Queries Supabase schema to verify RLS status
  const MUST_HAVE_RLS = [
    'profiles','subscriptions','usage_limits','scans','scan_results',
    'ai_mentions','position_rankings','content_recommendations',
    'ai_mistakes','credits_usage_log','onboarding_steps',
  ]
  MUST_HAVE_RLS.forEach(table => {
    it(`${table} has RLS enabled`)
  })
  it('SUPABASE_SERVICE_ROLE_KEY is not in any NEXT_PUBLIC_ env var')

CREATE: __tests__/security/middleware.test.ts
  it('returns 403 for sqlmap user agent')
  it('returns 403 for nikto user agent')
  it('allows normal browser user agents')
  it('adds X-Request-Id header to all responses')
  it('redirects http to https in production')
  it('does not redirect in development')

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P6-FIX-25
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] All 7 security headers on every response (verify with curl -sI)
  [ ] CSP blocks unsafe-eval; allows only required external origins
  [ ] sanitizeText() applied to all user-supplied string fields
  [ ] RLS enabled on all 19 user-data tables
  [ ] service-role key never used in 'use client' files
  [ ] .gitignore covers all .env files
  [ ] .env.example committed with placeholder values
  [ ] Husky pre-commit: secretlint + tsc + lint
  [ ] Middleware blocks scanner UAs, enforces HTTPS, adds X-Request-Id
  [ ] All tests pass | 0 regressions | 0 TS errors | 0 lint errors
  [ ] Manual: curl -sI dashboard → all 7 headers visible
  [ ] Manual: npx secretlint → 0 secrets found in codebase
```

---

---

# P6-FIX-26 — GDPR / Privacy Compliance

## Background

LocalVector.ai processes personal business data linked to real people (names,
addresses, emails, location data). GDPR (EU) and CCPA (California) both require:
right to deletion, right to data export, cookie consent, and documented privacy
terms. Operating without these exposes the business to regulatory risk.

---

### PROMPT — P6-FIX-26

```
You are a senior fullstack engineer on LocalVector.ai. Your task is P6-FIX-26:
implement GDPR/CCPA compliance — account deletion with a 7-day grace period,
full data export, a cookie consent banner, and public privacy/terms pages.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — DATABASE: DELETION TRACKING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Migration: supabase/migrations/[ts]_gdpr_fields.sql

  ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deletion_token         TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS data_export_last_at    TIMESTAMPTZ;

  -- All foreign keys to auth.users must already have ON DELETE CASCADE
  -- Verify each one:
  SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table,
         rc.delete_rule
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu USING (constraint_name)
  JOIN information_schema.constraint_column_usage AS ccu USING (constraint_name)
  JOIN information_schema.referential_constraints AS rc USING (constraint_name)
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'users';

  For any FK without ON DELETE CASCADE: add it in the migration.
  This ensures that when auth.users row is deleted, all data cascades.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — ACCOUNT DELETION API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: app/api/account/delete/route.ts  (POST)

  Logic:
    1. Auth required — 401 if no session
    2. Check not already marked for deletion (idempotent)
    3. Generate a one-time deletion_token (crypto.randomUUID())
    4. Set profiles.deletion_requested_at = now(), deletion_token = token
    5. Cancel active Stripe subscription immediately:
         stripe.subscriptions.cancel(subscriptionId, { prorate: false })
    6. Schedule Inngest deletion job to run in 7 days:
         inngest.send({ name: 'account/deletion.scheduled',
           data: { userId, token },
           ts: Date.now() + 7 * 24 * 60 * 60 * 1000 })
    7. Send confirmation email with cancel link:
         "[business_name], your account is scheduled for deletion on [date].
          Click here to cancel: [app_url]/account/cancel-deletion?token=[token]"
    8. Return { success: true, deletionDate: (now + 7 days).toISOString() }

Create: app/api/account/cancel-deletion/route.ts  (POST)

  Body: { token: string }
  Logic:
    1. Find profile by deletion_token = token
    2. Return 404 if not found or deletion not requested
    3. Clear deletion_requested_at and deletion_token
    4. Cancel the Inngest job (find and cancel by event data)
    5. Reactivate Stripe subscription if within grace period
       (create new subscription — old one was cancelled)
    6. Send confirmation: "Account deletion cancelled. Welcome back."
    7. Return { success: true }

Create Inngest function: account/deletion.execute
  Triggered by 'account/deletion.scheduled' event after 7-day delay.
  Logic:
    1. Verify profiles.deletion_requested_at still set (not cancelled)
    2. Verify deletion_token matches (not tampered)
    3. Delete from auth.users — cascade handles everything else:
         await supabaseAdmin.auth.admin.deleteUser(userId)
    4. Log deletion to a separate audit_log table (not cascaded — for compliance)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — DATA EXPORT API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: app/api/account/export/route.ts  (POST)

  Logic:
    1. Auth required — 401 if no session
    2. Rate limit: 1 export per 24 hours per user
       Check profiles.data_export_last_at — return 429 if < 24h ago
    3. Fetch ALL user data in parallel (Promise.all):
         profile, scans, ai_mentions, position_rankings,
         content_recommendations, ai_mistakes, credits_usage_log,
         onboarding_steps, reality_scores
    4. Build export object:
         {
           exportVersion: '1.0',
           exportedAt: new Date().toISOString(),
           userData: {
             profile: { ...profile, stripe_customer_id: '[redacted]' },
             scans, aiMentions, positionRankings, recommendations,
             aiMistakes, creditsHistory, onboardingProgress, realityScores
           }
         }
    5. Update profiles.data_export_last_at = now()
    6. Return downloadable JSON:
         new Response(JSON.stringify(export, null, 2), {
           headers: {
             'Content-Type': 'application/json',
             'Content-Disposition':
               'attachment; filename="localvector-data-export.json"',
           },
         })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — SETTINGS UI: DELETION + EXPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add a "Data & Privacy" section to app/dashboard/settings/profile/page.tsx:

  Export section:
    "Download all your data" button
    → POST /api/account/export → triggers browser file download
    → Show last export date if data_export_last_at is set

  Danger Zone section:
    If deletion NOT requested:
      "Delete Account" button (red, outlined)
      → Opens confirmation modal: user must type "DELETE" to confirm
      → Shows: "Your account will be permanently deleted on [date+7]"
      → On confirm: POST /api/account/delete

    If deletion IS requested:
      Warning banner: "Account deletion scheduled for [date]"
      "Cancel Deletion" button
      → POST /api/account/cancel-deletion with token from profile
      → On success: reload page, banner disappears

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — COOKIE CONSENT BANNER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: components/ui/CookieConsent.tsx  ('use client')

  LocalVector.ai uses only essential cookies (Supabase auth session).
  No advertising, no analytics cookies. So the banner is minimal:

  Shows on first visit (before localStorage 'cookie_consent' key exists):
    Text: "We use essential cookies to keep you logged in. See our [Privacy Policy]."
    Button: "Got it" → sets localStorage.cookie_consent = 'accepted' → hides banner

  Behavior:
    - Returns null once cookie_consent is set
    - Position: fixed bottom, z-50, non-blocking
    - Accessible: role="dialog", aria-label="Cookie consent", keyboard focusable
    - Does NOT show inside /dashboard (user is already logged in — implied consent)

  Add to app/(marketing)/layout.tsx (marketing pages only).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — LEGAL PAGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: app/(marketing)/privacy/page.tsx  (static, no auth required)

  Sections:
    1. What data we collect (business info, scan results, usage logs, billing)
    2. How we use it (AI visibility scanning, recommendations, product improvement)
    3. Who we share it with (Stripe for billing, Supabase for storage, Resend for email)
    4. Data retention (scan data: 12 months; billing records: 7 years for tax)
    5. Your rights: access, export (/dashboard/settings/profile), deletion
    6. Cookies: essential only (Supabase auth session)
    7. Contact: privacy@localvector.ai
    8. Last updated: [current date]

  Metadata: title: 'Privacy Policy | LocalVector.ai'

Create: app/(marketing)/terms/page.tsx  (static, no auth required)

  Sections:
    1. Acceptance of terms
    2. Description of service
    3. Account registration and security
    4. Payment and billing (Stripe, auto-renewal, refund policy)
    5. Acceptable use (no scraping, no impersonation)
    6. Intellectual property
    7. Limitation of liability
    8. Termination
    9. Governing law (State of Georgia, USA)
    10. Contact: legal@localvector.ai

  Link both pages in:
    - Login page footer
    - Signup page footer
    - Dashboard footer
    - Cookie consent banner

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/api/account/delete.test.ts
  it('returns 401 when unauthenticated')
  it('sets deletion_requested_at on profiles')
  it('generates unique deletion_token')
  it('cancels active Stripe subscription')
  it('schedules Inngest deletion job 7 days out')
  it('sends confirmation email')
  it('returns deletionDate = now + 7 days')
  it('is idempotent (second call returns same deletionDate)')

CREATE: __tests__/api/account/cancel-deletion.test.ts
  it('returns 401 when unauthenticated')
  it('returns 404 for invalid token')
  it('clears deletion_requested_at and deletion_token')
  it('sends cancellation confirmation email')

CREATE: __tests__/api/account/export.test.ts
  it('returns 401 when unauthenticated')
  it('returns Content-Disposition attachment header')
  it('export JSON contains all required data categories')
  it('stripe_customer_id is redacted in export')
  it('rate limits to 1 export per 24 hours')
  it('does not include other users data (isolation test)')

CREATE: __tests__/components/CookieConsent.test.tsx
  it('renders when localStorage key not set')
  it('does not render when localStorage key is set')
  it('sets localStorage key when dismissed')
  it('has role=dialog for accessibility')
  it('links to /privacy page')

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P6-FIX-26
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] Account deletion: 7-day delay, token-verified, Stripe cancelled
  [ ] Account deletion cancel: clears flag + token, job cancelled
  [ ] Inngest deletion job executes auth.admin.deleteUser after 7 days
  [ ] All FK relationships have ON DELETE CASCADE (verified in migration)
  [ ] Data export: all categories, stripe_customer_id redacted
  [ ] Rate limit: 1 export per 24 hours
  [ ] Cookie consent banner on marketing pages only
  [ ] /privacy page publicly accessible with all required sections
  [ ] /terms page publicly accessible with governing law = Georgia, USA
  [ ] Links to privacy/terms in login, signup, dashboard footer
  [ ] All tests pass | 0 regressions | 0 TS errors | 0 lint errors
  [ ] Manual: request deletion → email received → cancel → account intact
  [ ] Manual: download export → valid JSON containing all data types
```

---

---

# P6-FIX-27 — Accessibility (WCAG 2.1 AA)

### PROMPT — P6-FIX-27

```
You are a senior accessibility engineer on LocalVector.ai (Next.js 14, React,
Tailwind CSS). Your task is P6-FIX-27: audit and fix the entire application to
meet WCAG 2.1 AA standards. Zero critical or serious violations on all pages.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — INSTALL AND RUN AUTOMATED AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  pnpm add -D axe-playwright @axe-core/playwright

Create: e2e/accessibility/axe-audit.spec.ts

  import { checkA11y } from 'axe-playwright'

  const PAGES = [
    '/login', '/signup',
    '/dashboard',
    '/dashboard/settings/profile',
    '/dashboard/billing',
    '/dashboard/ai-mentions',
    '/dashboard/position',
    '/dashboard/ai-says',
    '/dashboard/recommendations',
    '/privacy', '/terms',
  ]

  for (const path of PAGES) {
    test(`${path} — zero critical/serious axe violations`, async ({ page }) => {
      await page.goto(path)
      await checkA11y(page, undefined, {
        axeOptions: {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
        },
        violationCallback: (violations) => {
          const critical = violations.filter(v =>
            ['critical', 'serious'].includes(v.impact ?? ''))
          if (critical.length > 0) {
            console.table(critical.map(v => ({
              rule: v.id, impact: v.impact,
              element: v.nodes[0]?.html?.slice(0, 80),
            })))
          }
          expect(critical).toHaveLength(0)
        },
      })
    })
  }

Run audit first, document all violations, then fix them below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — FIX EVERY VIOLATION CATEGORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apply all of the following proactively — these are the most common WCAG
violations in dark-themed SaaS dashboards:

A. Skip link (add as first element in every page layout):
     <a href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4
                   focus:left-4 focus:z-50 focus:bg-white focus:text-black
                   focus:px-4 focus:py-2 focus:rounded">
       Skip to main content
     </a>
   Add id="main-content" to the <main> element.

B. Semantic landmarks in app/dashboard/layout.tsx:
     <nav aria-label="Main navigation">  ← sidebar
     <main id="main-content">            ← content area
     <header>                            ← top header bar

C. Focus rings — add to globals.css:
     *:focus-visible {
       outline: 2px solid #3b82f6;
       outline-offset: 2px;
     }
     /* Never suppress focus rings without providing a replacement */

D. Button accessible names (audit all icon-only buttons):
     Find all: grep -rn "<button\|<Button" --include="*.tsx" . | grep -v "aria-label"
     For icon-only buttons: add aria-label="[action description]"
     For spinner buttons: aria-label="[action], loading" + aria-busy="true"

E. Form inputs with labels (audit all forms):
     Every <input>, <select>, <textarea> must have:
       - <label htmlFor={inputId}> OR
       - aria-label="[field name]" OR
       - aria-labelledby pointing to a visible label element
     Check profile form, login form, invite form, domain form.

F. Color contrast (dark theme specific fixes):
     text-gray-400 on dark backgrounds typically fails 4.5:1 — upgrade to text-gray-300
     Locked sidebar items (dimmed state): ensure contrast ≥ 3:1 even when dimmed
     Badge text: verify all colored badges (green/amber/red) meet contrast on dark bg
     Check with: https://webaim.org/resources/contrastchecker/

G. Images and icons:
     All <img>: add alt="" (decorative) or alt="[description]" (meaningful)
     SVG icons used inline: add aria-hidden="true" (decorative) or
       role="img" + aria-label="[description]" (meaningful)
     Next.js <Image>: same rule as <img>

H. Chart accessibility:
     Every chart component needs:
       <div role="img"
            aria-label="[Chart description, e.g.: Share of Voice chart showing
                         your business at 23% for the week of March 3, 2026]">
         [chart]
       </div>
     Add a visually-hidden data table alternative for screen reader users:
       <table className="sr-only">...</table>

I. Modal/dialog accessibility (UpgradeModal from P1-FIX-06):
     Verify: role="dialog", aria-modal="true", aria-labelledby={titleId}
     Focus must trap inside modal when open
     Focus must return to trigger element when modal closes
     Escape key must close modal

J. Page titles — verify every page has unique metadata:
     app/dashboard/page.tsx:          'Dashboard | LocalVector.ai'
     app/dashboard/billing/page.tsx:  'Billing | LocalVector.ai'
     app/dashboard/ai-mentions/page.tsx: 'AI Mentions | LocalVector.ai'
     etc.

K. Live regions for dynamic content:
     Credits counter update: wrap in <span aria-live="polite" aria-atomic="true">
     Scan status updates: wrap in <div role="status">
     Error messages: role="alert"
     Success messages: role="status"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — KEYBOARD NAVIGATION AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test every interactive element using keyboard only (no mouse):

  Tab through the entire dashboard:
    [ ] Every interactive element reachable by Tab
    [ ] Tab order matches visual reading order (left-to-right, top-to-bottom)
    [ ] No focus traps outside of modals
    [ ] Sidebar nav items: Enter/Space activate them
    [ ] Dropdown menus (if any): Arrow keys navigate, Escape closes
    [ ] Filter tabs: Arrow keys switch between tabs (ARIA tab pattern)
    [ ] Getting Started steps: keyboard accessible action buttons

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P6-FIX-27
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] axe-playwright: 0 critical/serious violations on all audited pages
  [ ] Skip link present and functional on every page
  [ ] Semantic landmarks: <nav>, <main>, <header> in dashboard layout
  [ ] Focus rings visible on all interactive elements
  [ ] All buttons have accessible names (no unlabelled icon buttons)
  [ ] All form inputs have associated labels
  [ ] Color contrast ≥ 4.5:1 for all text (verified with contrast checker)
  [ ] All images have alt text or alt="" (decorative)
  [ ] Charts have role="img" + aria-label describing the data
  [ ] Modal focus trap tested and working
  [ ] All pages have unique, descriptive title tags
  [ ] Live regions on credits counter, scan status, error/success messages
  [ ] Full keyboard navigation works without mouse
  [ ] All axe E2E tests pass | 0 regressions | 0 TS errors
```

---

---

# P6-FIX-28 — Mobile Responsiveness

### PROMPT — P6-FIX-28

```
You are a senior frontend engineer on LocalVector.ai (Next.js 14, Tailwind CSS).
Your task is P6-FIX-28: make every page fully responsive from 375px (iPhone SE)
through 768px (tablet) through desktop. Zero horizontal scroll, zero broken
layouts, zero unreadable content at any viewport width.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — BASELINE AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test every page at these viewports in Chrome DevTools before writing code:
  375px, 390px, 768px, 1024px, 1440px

Document every layout issue found. Common issues in dashboard apps:
  - Sidebar takes full width → content invisible
  - Data tables overflow → horizontal scroll
  - Charts fixed-width → overflow on mobile
  - Plan comparison table 4 columns → too cramped
  - Credits counter text truncated
  - Getting Started steps text overflow

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — MOBILE SIDEBAR (OFF-CANVAS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: components/layout/MobileNavOverlay.tsx  ('use client')

  Props: isOpen: boolean, onClose: () => void, children: React.ReactNode

  Structure:
    // Backdrop
    {isOpen && (
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
    )}
    // Slide-in panel
    <div
      id="mobile-sidebar"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform
                  duration-250 ease-out md:hidden
                  ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {children}
    </div>

  Keyboard: useEffect listening for 'keydown' Escape → calls onClose
  Focus trap: when isOpen, Tab cycles within the panel

Create: components/layout/HamburgerButton.tsx

  Props: onClick: () => void, isOpen: boolean
  data-testid="hamburger-button"
  aria-label: isOpen ? 'Close navigation' : 'Open navigation'
  aria-expanded: isOpen
  aria-controls: 'mobile-sidebar'
  Classes: md:hidden (hidden on desktop)
  Icon: 3 lines → X (transition with CSS)

Modify: app/dashboard/layout.tsx

  'use client'  (needs useState for navOpen)

  const [navOpen, setNavOpen] = useState(false)

  <div className="flex h-screen overflow-hidden">
    {/* Desktop sidebar — hidden on mobile */}
    <aside
      data-testid="desktop-sidebar"
      className="hidden md:flex md:w-64 md:flex-col md:flex-shrink-0"
    >
      <Sidebar planTier={profile.plan_tier} />
    </aside>

    {/* Mobile off-canvas sidebar */}
    <MobileNavOverlay isOpen={navOpen} onClose={() => setNavOpen(false)}>
      <Sidebar
        planTier={profile.plan_tier}
        onNavItemClick={() => setNavOpen(false)}
      />
    </MobileNavOverlay>

    {/* Main content */}
    <div className="flex flex-1 flex-col overflow-auto min-w-0">
      {/* Mobile header bar */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-800 md:hidden">
        <HamburgerButton
          onClick={() => setNavOpen(true)}
          isOpen={navOpen}
        />
        <span className="text-sm font-medium text-white">LocalVector.ai</span>
      </div>
      <main id="main-content" className="flex-1 p-4 md:p-6">
        {children}
      </main>
    </div>
  </div>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — CHARTS (RESPONSIVE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For every chart component in the codebase:
  find . -name "*.tsx" | xargs grep -l "BarChart\|LineChart\|PieChart\|ResponsiveContainer"

Ensure every chart uses ResponsiveContainer:
  <div
    data-testid="chart-container"
    className="w-full overflow-x-auto"
  >
    <ResponsiveContainer width="100%" height="100%">
      <div className="h-48 md:h-72">   {/* shorter on mobile */}
        <BarChart ... />
      </div>
    </ResponsiveContainer>
  </div>

Legend placement:
  Mobile (< 640px): layout="vertical" (stacks below chart)
  Desktop: layout="horizontal" (beside chart)
  Use CSS media query or a useMobile() hook.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — RESPONSIVE GRID FIXES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plan comparison cards (billing page):
  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"

Dashboard stat cards:
  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"

Getting Started steps:
  Each step: flex-col on mobile, flex-row on desktop
  Action button: full-width on mobile (w-full sm:w-auto)

Settings form:
  Single column on mobile, 2-column on desktop for address fields
  className="grid grid-cols-1 sm:grid-cols-2 gap-4"

Data tables (AI Mentions, Position, etc.):
  Wrap in: <div className="overflow-x-auto">
  On mobile: show only the 2-3 most important columns
  Add horizontal scroll indicator (subtle shadow on right edge)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — TAP TARGETS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WCAG 2.5.5 requires minimum 44×44px touch targets on mobile.
Find all small interactive elements and add padding:

  Sidebar nav items: min-h-[44px] with py-2.5
  Getting Started checkboxes: w-11 h-11 (with centered inner icon)
  Icon buttons: p-2 to bring total to 44px minimum
  Filter tabs: min-h-[44px]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — PLAYWRIGHT RESPONSIVE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: e2e/responsive/mobile.spec.ts

  test.describe('Mobile (375px)', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('dashboard has no horizontal scroll', async ({ page }) => {
      await page.goto('/dashboard')
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      expect(bodyWidth).toBeLessThanOrEqual(376)
    })

    test('desktop sidebar is hidden', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page.locator('[data-testid="desktop-sidebar"]')).toBeHidden()
    })

    test('hamburger button is visible', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page.locator('[data-testid="hamburger-button"]')).toBeVisible()
    })

    test('mobile nav opens and closes via hamburger', async ({ page }) => {
      await page.goto('/dashboard')
      await page.click('[data-testid="hamburger-button"]')
      await expect(page.locator('[data-testid="mobile-sidebar"]')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-testid="mobile-sidebar"]')).toBeHidden()
    })

    test('mobile nav closes when backdrop clicked', async ({ page }) => {
      await page.goto('/dashboard')
      await page.click('[data-testid="hamburger-button"]')
      await page.locator('.bg-black\\/50').click()
      await expect(page.locator('[data-testid="mobile-sidebar"]')).toBeHidden()
    })

    test('charts do not overflow viewport', async ({ page }) => {
      await page.goto('/dashboard')
      for (const chart of await page.locator('[data-testid="chart-container"]').all()) {
        const box = await chart.boundingBox()
        expect(box?.width).toBeLessThanOrEqual(376)
      }
    })

    test('billing plan cards stack to single column', async ({ page }) => {
      await page.goto('/dashboard/billing')
      const cards = page.locator('[data-testid="plan-card"]')
      const boxes = await Promise.all(
        (await cards.all()).map(c => c.boundingBox())
      )
      // All cards should have same left offset (stacked, not side-by-side)
      const lefts = boxes.map(b => b?.x ?? 0)
      const allSameColumn = lefts.every(l => Math.abs(l - lefts[0]) < 5)
      expect(allSameColumn).toBe(true)
    })
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P6-FIX-28
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] Zero horizontal scroll on any page at 375px
  [ ] Off-canvas sidebar: opens/closes, Escape works, backdrop closes
  [ ] Desktop sidebar hidden (md:hidden) on mobile
  [ ] All charts use ResponsiveContainer — no overflow
  [ ] Plan cards: 4-col → 2-col → 1-col responsive grid
  [ ] Dashboard stat cards: responsive grid
  [ ] Data tables: overflow-x-auto wrapper
  [ ] All tap targets ≥ 44×44px
  [ ] All Playwright mobile tests pass | 0 regressions | 0 TS errors
  [ ] Manual: test on real device (or BrowserStack) — no layout breaks
```

---

---

# P7-FIX-29 — Error Tracking (Sentry)

### PROMPT — P7-FIX-29

```
You are a senior DevOps engineer on LocalVector.ai (Next.js 14). Your task is
P7-FIX-29: integrate Sentry for production error tracking, source map uploads,
user context attribution, and performance monitoring of critical jobs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — INSTALL AND CONFIGURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  pnpm add @sentry/nextjs
  npx @sentry/wizard@latest -i nextjs --saas

  The wizard creates:
    sentry.client.config.ts
    sentry.server.config.ts
    sentry.edge.config.ts
    instrumentation.ts

  Configure each file:

  // sentry.client.config.ts
  import * as Sentry from '@sentry/nextjs'
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_APP_VERSION,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration()],
  })

  // sentry.server.config.ts and sentry.edge.config.ts — same dsn/env config

  Add required env vars to .env.example:
    NEXT_PUBLIC_SENTRY_DSN=
    NEXT_PUBLIC_APP_VERSION=
    SENTRY_ORG=
    SENTRY_PROJECT=
    SENTRY_AUTH_TOKEN=   # for source map upload (never NEXT_PUBLIC_)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — SOURCE MAP UPLOAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Wrap next.config.js with withSentryConfig:

  const { withSentryConfig } = require('@sentry/nextjs')

  module.exports = withSentryConfig(nextConfig, {
    silent: true,
    org:     process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    // Upload source maps to Sentry, hide them from browser
    hideSourceMaps: true,
    // Tree-shake Sentry logger in production
    disableLogger: true,
    authToken: process.env.SENTRY_AUTH_TOKEN,
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — USER CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After the user session is established (in root layout server component),
pass userId to a client component that sets Sentry user context:

Create: components/monitoring/SentryUserContext.tsx  ('use client')

  import * as Sentry from '@sentry/nextjs'
  import { useEffect } from 'react'

  export function SentryUserContext({ userId }: { userId: string }) {
    useEffect(() => {
      Sentry.setUser({ id: userId })
      return () => { Sentry.setUser(null) }
    }, [userId])
    return null
  }

  Add to app/dashboard/layout.tsx:
    <SentryUserContext userId={session.user.id} />

  Note: do NOT set email or name in Sentry user context — userId is enough
  for correlation without storing PII in Sentry.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — captureError UTILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: lib/monitoring/capture-error.ts

  import * as Sentry from '@sentry/nextjs'

  export function captureError(
    error: unknown,
    context?: Record<string, unknown>
  ): void {
    if (process.env.NODE_ENV === 'test') return
    Sentry.withScope(scope => {
      if (context) scope.setExtras(context)
      Sentry.captureException(error)
    })
    console.error('[error]', error instanceof Error ? error.message : error, context)
  }

  export function captureWarning(
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (process.env.NODE_ENV === 'test') return
    Sentry.withScope(scope => {
      if (context) scope.setExtras(context)
      Sentry.captureMessage(message, 'warning')
    })
  }

  Replace all bare catch blocks that have console.error with captureError:
    grep -rn "catch" --include="*.ts" . | grep "console.error" | grep -v node_modules
  Replace all console.warn in server code with captureWarning.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — SCAN JOB PERFORMANCE TRACING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Wrap the scan Inngest job handler:

  const span = Sentry.startInactiveSpan({
    name: 'ai-visibility-scan',
    op: 'inngest.job',
    attributes: { userId, scanId },
  })
  try {
    // ... scan processing ...
    span.setStatus({ code: 1 })  // OK
  } catch (error) {
    span.setStatus({ code: 2, message: 'internal_error' })
    captureError(error, { userId, scanId, jobName: 'ai-visibility-scan' })
    throw error  // re-throw so Inngest retries
  } finally {
    span.end()
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — ALERT RULES (DOCUMENT IN README)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add to docs/MONITORING.md — these alerts must be configured in Sentry dashboard:

  Alert 1: Any new error issue → email immediately
  Alert 2: Error rate > 1% in 5 min → email + Slack
  Alert 3: P95 response time > 3s on any transaction → email
  Alert 4: Scan job failure rate > 10% in 1 hour → email immediately
  Alert 5: Any 500 error from billing routes → email immediately

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/lib/monitoring/capture-error.test.ts
  it('calls Sentry.captureException with error')
  it('attaches context as extras')
  it('does NOT call Sentry in test environment (NODE_ENV=test)')
  it('always logs to console regardless of environment')
  it('does not throw when Sentry is unavailable')
  it('captureWarning calls Sentry.captureMessage with warning level')

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P7-FIX-29
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] Sentry SDK configured for client, server, edge runtimes
  [ ] Source maps upload on every production build (hideSourceMaps: true)
  [ ] userId set in Sentry user context after login (no PII)
  [ ] captureError replaces all bare console.error in catch blocks
  [ ] Scan job wrapped in Sentry performance span
  [ ] Alert rules documented in docs/MONITORING.md
  [ ] All tests pass | 0 regressions | 0 TS errors
  [ ] Manual: throw deliberate error in API route → appears in Sentry < 30s
  [ ] Manual: verify source maps work — Sentry shows real file/line numbers
```

---

---

# P7-FIX-30 — Logging & Observability

### PROMPT — P7-FIX-30

```
You are a senior DevOps engineer on LocalVector.ai. Your task is P7-FIX-30:
implement structured JSON logging with pino, request tracing, Inngest job
observability, and slow query detection. Every production issue must be
debuggable from logs alone.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — PINO STRUCTURED LOGGER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  pnpm add pino && pnpm add -D pino-pretty @types/pino

Create: lib/logger/index.ts

  import pino from 'pino'

  export const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: {
      env:     process.env.NODE_ENV,
      service: 'localvector-api',
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'local',
    },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      // NEVER log these fields — strip them before output
      paths: ['*.password', '*.token', '*.secret', '*.authorization',
              '*.stripe_customer_id', '*.email'],
      censor: '[REDACTED]',
    },
    ...(process.env.NODE_ENV !== 'production'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}
    ),
  })

  export function createRequestLogger(requestId: string, userId?: string) {
    return logger.child({ requestId, ...(userId ? { userId } : {}) })
  }

  export function createJobLogger(jobName: string, userId?: string) {
    return logger.child({ jobName, ...(userId ? { userId } : {}) })
  }

  IMPORTANT: pino is server-only. Client components must NOT import from this file.
  Add to tsconfig.json paths:
    "@/lib/logger": ["lib/logger/index.ts"]
  Client components use console.log only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — REQUEST LOGGING WRAPPER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: lib/api/with-logging.ts

  export function withLogging(
    handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>
  ) {
    return async (req: Request, ctx: Record<string, unknown>): Promise<Response> => {
      const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID()
      const reqLogger = createRequestLogger(requestId)
      const start = Date.now()

      reqLogger.info({
        method:    req.method,
        path:      new URL(req.url).pathname,
        userAgent: req.headers.get('user-agent')?.slice(0, 100),
      }, 'request.start')

      try {
        const response = await handler(req, ctx)
        reqLogger.info({
          status:     response.status,
          durationMs: Date.now() - start,
        }, 'request.complete')
        return response
      } catch (error) {
        reqLogger.error({
          error:      error instanceof Error ? error.message : 'unknown',
          durationMs: Date.now() - start,
        }, 'request.error')
        throw error
      }
    }
  }

  Wrap every API route handler:
    export const POST = withLogging(async (req) => { ... })
    export const GET  = withLogging(async (req) => { ... })
    export const PATCH = withLogging(async (req) => { ... })

  NEVER log: request bodies, response bodies, auth tokens, passwords.
  ONLY log: method, path, status, durationMs, requestId, userId.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — INNGEST JOB OBSERVABILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For every Inngest job handler, add structured logging:

  const jobLogger = createJobLogger('ai-visibility-scan', userId)
  jobLogger.info({ scanId, triggeredBy }, 'job.started')

  // ... job processing ...

  jobLogger.info({ scanId, durationMs: Date.now() - start }, 'job.completed')

  // On error:
  jobLogger.error({ scanId, error: err.message, stack: err.stack }, 'job.failed')

Create migration: supabase/migrations/[ts]_job_execution_log.sql

  CREATE TABLE IF NOT EXISTS job_execution_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name    TEXT         NOT NULL,
    event_id    TEXT,
    user_id     UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    status      TEXT         NOT NULL CHECK (status IN ('started','completed','failed')),
    duration_ms INTEGER,
    error_msg   TEXT,
    started_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
  );
  -- No RLS — service_role only
  -- Auto-purge rows > 30 days old (add to weekly cleanup cron)

At job start: INSERT INTO job_execution_log (job_name, event_id, user_id, status)
At job end:   UPDATE job_execution_log SET status='completed', duration_ms=X WHERE id=logId
At job fail:  UPDATE job_execution_log SET status='failed', error_msg=Y WHERE id=logId

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — SLOW QUERY DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: lib/db/query-monitor.ts

  const SLOW_QUERY_THRESHOLD_MS = 500

  export async function timedQuery<T>(
    label: string,
    queryFn: () => Promise<{ data: T; error: unknown }>
  ): Promise<{ data: T; error: unknown }> {
    const start = Date.now()
    const result = await queryFn()
    const durationMs = Date.now() - start

    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn({ label, durationMs }, 'slow.query')
      captureWarning(`Slow DB query: ${label}`, { durationMs })
    }

    return result
  }

  Apply to these 5 critical queries (run on every dashboard load):
    1. resolveDataMode    in lib/data/scan-data-resolver.ts
    2. getCompletedSteps  in lib/onboarding/completion.ts
    3. getCreditBalance   in lib/credits/credits-service.ts
    4. fetchProfile       wherever profile is loaded in dashboard layout
    5. getLatestScanResults  wherever dashboard chart data is fetched

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — CONSOLE.LOG MIGRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Replace all server-side console.log/warn/error with structured logger calls:

  Find all occurrences in server-side files:
    grep -rn "console\.log\|console\.warn\|console\.error" \
      --include="*.ts" app/api/ lib/ inngest/ | grep -v node_modules

  Migration pattern:
    console.log('msg', data)    → logger.info(data, 'msg')
    console.warn('msg', data)   → logger.warn(data, 'msg')
    console.error('msg', error) → logger.error({ error: error.message }, 'msg')

  Client components (files with 'use client') — leave console.log as-is.
  Server components, API routes, and lib/ — all must use logger.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P7-FIX-30
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] pino logger outputs JSON in production, pretty-print in dev
  [ ] redact config strips email, token, secret, stripe_customer_id from all logs
  [ ] withLogging wrapper applied to all API route handlers
  [ ] All server-side console.log/warn/error replaced with logger calls
  [ ] Inngest jobs log start/complete/fail with durationMs
  [ ] job_execution_log table populated on every job run
  [ ] timedQuery applied to 5 critical DB queries
  [ ] Queries > 500ms trigger captureWarning (visible in Sentry)
  [ ] No PII in any log line (verified by redact config)
  [ ] All tests pass | 0 regressions | 0 TS errors
  [ ] Manual: POST /api/profile/update → structured JSON log in console
```

---

---

# P7-FIX-31 — CI/CD Pipeline

### PROMPT — P7-FIX-31

```
You are a senior DevOps engineer on LocalVector.ai (GitHub Actions, Vercel,
Supabase). Your task is P7-FIX-31: build a complete CI/CD pipeline with
automated quality gates on every PR, staging deploy on merge to staging,
and production deploy on merge to main — with Supabase branch databases
for safe migration testing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — PR QUALITY GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: .github/workflows/pr-check.yml

  name: PR Quality Gate
  on:
    pull_request:
      branches: [main, staging]

  jobs:
    quality:
      name: TypeScript + Lint + Unit Tests
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v3
          with: { version: 8 }
        - uses: actions/setup-node@v4
          with: { node-version: '20', cache: 'pnpm' }
        - run: pnpm install --frozen-lockfile
        - run: pnpm tsc --noEmit
        - run: pnpm lint
        - run: pnpm test --coverage --reporter=verbose
          env:
            SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
            SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_TEST_SERVICE_KEY }}
            NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
            NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_TEST_ANON_KEY }}
        - uses: codecov/codecov-action@v4
          with: { token: ${{ secrets.CODECOV_TOKEN }}, fail_ci_if_error: false }

    security:
      name: Security Scan
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v3
          with: { version: 8 }
        - uses: actions/setup-node@v4
          with: { node-version: '20', cache: 'pnpm' }
        - run: pnpm install --frozen-lockfile
        - run: npx secretlint "**/*" --secretlintignore .gitignore
        - name: Dependency vulnerability scan
          uses: aquasecurity/trivy-action@master
          with:
            scan-type: fs
            scan-ref: .
            severity: HIGH,CRITICAL
            exit-code: '1'
            ignore-unfixed: true

    e2e:
      name: E2E Tests (Playwright)
      runs-on: ubuntu-latest
      needs: [quality]
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v3
          with: { version: 8 }
        - uses: actions/setup-node@v4
          with: { node-version: '20', cache: 'pnpm' }
        - run: pnpm install --frozen-lockfile
        - run: npx playwright install --with-deps chromium
        - run: pnpm build
          env: &build_env
            NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
            NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_TEST_ANON_KEY }}
            STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
            # ... all required build-time env vars
        - run: pnpm test:e2e
          env:
            <<: *build_env
            PLAYWRIGHT_BASE_URL: http://localhost:3000
            E2E_USER_FREE: ${{ secrets.E2E_USER_FREE }}
            E2E_PASS_FREE: ${{ secrets.E2E_PASS_FREE }}
            E2E_USER_GROWTH: ${{ secrets.E2E_USER_GROWTH }}
            E2E_PASS_GROWTH: ${{ secrets.E2E_PASS_GROWTH }}
            E2E_USER_AI_SHIELD: ${{ secrets.E2E_USER_AI_SHIELD }}
            E2E_PASS_AI_SHIELD: ${{ secrets.E2E_PASS_AI_SHIELD }}
        - uses: actions/upload-artifact@v4
          if: failure()
          with:
            name: playwright-report-${{ github.run_id }}
            path: playwright-report/
            retention-days: 7

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — STAGING DEPLOY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: .github/workflows/deploy-staging.yml

  name: Deploy → Staging
  on:
    push:
      branches: [staging]

  jobs:
    migrate:
      name: Apply DB Migrations (staging)
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: supabase/setup-cli@v1
          with: { version: latest }
        - run: supabase db push --db-url "${{ secrets.STAGING_DB_URL }}"

    deploy:
      name: Deploy to Vercel (staging)
      needs: [migrate]
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - name: Deploy to Vercel staging
          run: |
            npx vercel --token ${{ secrets.VERCEL_TOKEN }} \
              --scope ${{ secrets.VERCEL_ORG_ID }} \
              --yes \
              2>&1 | tee /tmp/vercel-output.txt
            DEPLOY_URL=$(cat /tmp/vercel-output.txt | grep "https://" | tail -1)
            echo "STAGING_URL=$DEPLOY_URL" >> $GITHUB_ENV
        - name: Comment deploy URL on PR
          uses: actions/github-script@v7
          if: github.event_name == 'push'
          with:
            script: |
              // Find the PR for this push and add a deploy URL comment

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — PRODUCTION DEPLOY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: .github/workflows/deploy-production.yml

  name: Deploy → Production
  on:
    push:
      branches: [main]

  jobs:
    quality-gate:
      name: Quality gate (re-run for main)
      uses: ./.github/workflows/pr-check.yml
      secrets: inherit

    migrate:
      name: Apply DB Migrations (production)
      needs: [quality-gate]
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: supabase/setup-cli@v1
          with: { version: latest }
        - run: supabase db push --db-url "${{ secrets.PRODUCTION_DB_URL }}"

    deploy:
      name: Deploy to Vercel (production)
      needs: [migrate]
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - run: |
            npx vercel --token ${{ secrets.VERCEL_TOKEN }} \
              --scope ${{ secrets.VERCEL_ORG_ID }} \
              --prod --yes

    notify:
      name: Notify on deploy
      needs: [deploy]
      runs-on: ubuntu-latest
      steps:
        - name: Slack notification
          run: |
            curl -s -X POST "${{ secrets.SLACK_WEBHOOK_URL }}" \
              -H 'Content-type: application/json' \
              -d "{\"text\":\"✅ LocalVector.ai deployed to production — ${{ github.sha }}\"}" \
            || true  # never fail the workflow on notification failure

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — SUPABASE BRANCH DATABASES FOR MIGRATION PRS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In .github/workflows/pr-check.yml, add a conditional job:

  supabase-branch:
    name: Create Supabase branch DB
    runs-on: ubuntu-latest
    if: |
      contains(join(github.event.pull_request.labels.*.name, ','), 'db-migration')
    outputs:
      branch-url: ${{ steps.create.outputs.branch-url }}
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - id: create
        run: |
          BRANCH_NAME="pr-${{ github.event.number }}"
          supabase branches create "$BRANCH_NAME" \
            --project-ref ${{ secrets.SUPABASE_PROJECT_REF }} || true
          # Get branch DB URL
          URL=$(supabase branches get "$BRANCH_NAME" \
            --project-ref ${{ secrets.SUPABASE_PROJECT_REF }} \
            --output json | jq -r '.db_url')
          echo "branch-url=$URL" >> $GITHUB_OUTPUT
          # Apply migrations to branch
          supabase db push --db-url "$URL"

  Add cleanup on PR close:
    Create: .github/workflows/cleanup-supabase-branch.yml
      on: { pull_request: { types: [closed] } }
      jobs:
        cleanup:
          run: |
            supabase branches delete "pr-${{ github.event.number }}" \
              --project-ref ${{ secrets.SUPABASE_PROJECT_REF }} || true

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — GITHUB SECRETS DOCUMENTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: docs/GITHUB_SECRETS.md

  Document every secret required in GitHub repository settings:

  | Secret                        | Description                              |
  |-------------------------------|------------------------------------------|
  | SUPABASE_TEST_URL             | Test project Supabase URL                |
  | SUPABASE_TEST_SERVICE_KEY     | Test project service role key            |
  | SUPABASE_TEST_ANON_KEY        | Test project anon key                    |
  | STAGING_DB_URL                | Staging Supabase DB URL                  |
  | PRODUCTION_DB_URL             | Production Supabase DB URL               |
  | SUPABASE_PROJECT_REF          | Production project ref (for branches)    |
  | VERCEL_TOKEN                  | Vercel deploy token                      |
  | VERCEL_ORG_ID                 | Vercel org ID                            |
  | STRIPE_TEST_SECRET_KEY        | Stripe test mode secret key (CI only)    |
  | SENTRY_AUTH_TOKEN             | Sentry source map upload token           |
  | CODECOV_TOKEN                 | Codecov upload token                     |
  | SLACK_WEBHOOK_URL             | Slack deploy notifications               |
  | E2E_USER_FREE / E2E_PASS_FREE | Test user credentials per plan tier      |
  | ...                           | (all 4 plan tier E2E users)              |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P7-FIX-31
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] pr-check.yml: TS + lint + unit tests + E2E + secrets scan + vuln scan
  [ ] deploy-staging.yml: migrations → Vercel staging — triggers on push to staging
  [ ] deploy-production.yml: quality gate → migrations → Vercel prod → Slack notify
  [ ] Supabase branch DB created for PRs labeled 'db-migration'
  [ ] Branch DB cleaned up on PR close
  [ ] docs/GITHUB_SECRETS.md lists all required secrets
  [ ] Playwright screenshots/videos uploaded as artifact on E2E failure
  [ ] First push to staging branch triggers full pipeline successfully
  [ ] Manual: open PR → all 3 checks (quality, security, e2e) run → merge → staging deploys
```

---

---

# P7-FIX-32 — Pre-Launch Checklist

### PROMPT — P7-FIX-32

```
You are a senior DevOps engineer preparing LocalVector.ai for public launch.
Your task is P7-FIX-32: execute the complete pre-launch checklist, verify
every external service is in production mode, and create automated verification
scripts that can be run at any time to confirm launch readiness.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — ENV VAR GUARD (BUILD-TIME)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: lib/env-guard.ts

  const REQUIRED = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_STARTER',
    'STRIPE_PRICE_GROWTH',
    'STRIPE_PRICE_AI_SHIELD',
    'RESEND_API_KEY',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'NEXT_PUBLIC_SENTRY_DSN',
    'INNGEST_EVENT_KEY',
    'INNGEST_SIGNING_KEY',
  ]

  export function assertEnvironment(): void {
    const missing = REQUIRED.filter(k => !process.env[k]?.trim())
    if (missing.length > 0) {
      throw new Error(
        `[env-guard] Missing required environment variables:\n${missing.map(k => `  - ${k}`).join('\n')}`
      )
    }
    if (process.env.NODE_ENV === 'production') {
      if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
        throw new Error('[env-guard] STRIPE_SECRET_KEY is a test key in production')
      }
      if (process.env.STRIPE_WEBHOOK_SECRET?.includes('test')) {
        throw new Error('[env-guard] STRIPE_WEBHOOK_SECRET appears to be a test secret')
      }
    }
  }

  Call assertEnvironment() at the top of next.config.js:
    const { assertEnvironment } = require('./lib/env-guard')
    assertEnvironment()  // Fails build immediately if env vars missing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — HEALTH CHECK ENDPOINT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: app/api/health/route.ts  (GET, no auth required)

  export async function GET() {
    const checks: Record<string, boolean> = {}

    // Check Supabase connectivity
    try {
      await supabaseAdmin.from('profiles').select('id').limit(1)
      checks.database = true
    } catch { checks.database = false }

    // Check Stripe connectivity
    try {
      await stripe.balance.retrieve()
      checks.stripe = true
    } catch { checks.stripe = false }

    const allHealthy = Object.values(checks).every(Boolean)
    return Response.json(
      { status: allHealthy ? 'ok' : 'degraded', checks,
        timestamp: new Date().toISOString(),
        version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown' },
      { status: allHealthy ? 200 : 503 }
    )
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — SEO INFRASTRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: app/robots.txt/route.ts

  export function GET() {
    return new Response(
      `User-agent: *\nAllow: /\n` +
      `Disallow: /dashboard/\nDisallow: /api/\nDisallow: /_next/\n` +
      `Sitemap: https://localvector.ai/sitemap.xml`,
      { headers: { 'Content-Type': 'text/plain' } }
    )
  }

Create: app/sitemap.ts

  import { MetadataRoute } from 'next'
  export default function sitemap(): MetadataRoute.Sitemap {
    return [
      { url: 'https://localvector.ai', changeFrequency: 'weekly', priority: 1 },
      { url: 'https://localvector.ai/privacy', changeFrequency: 'monthly', priority: 0.3 },
      { url: 'https://localvector.ai/terms', changeFrequency: 'monthly', priority: 0.3 },
    ]
  }

Update app/layout.tsx with full production metadata:
  title: { default: 'LocalVector.ai — AI Visibility for Local Businesses',
           template: '%s | LocalVector.ai' }
  description: 'Know exactly how AI search engines see your business. Monitor, optimize, and protect your visibility on ChatGPT, Perplexity, Gemini, and more.'
  metadataBase: new URL('https://localvector.ai')
  openGraph: { type: 'website', images: ['/og-image.png'] }
  twitter: { card: 'summary_large_image' }
  robots: { index: true, follow: true }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — STRIPE LIVE MODE VERIFICATION SCRIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: scripts/verify-stripe.ts

  import Stripe from 'stripe'

  async function verifyStripe() {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })

    console.log('Checking Stripe configuration...')

    // 1. Verify live mode
    const isLive = process.env.STRIPE_SECRET_KEY!.startsWith('sk_live_')
    console.log(isLive ? '✅ Stripe is in live mode' : '⚠️  Stripe is in TEST mode')

    // 2. Verify all price IDs exist and are active
    const prices = [
      { name: 'Starter',   id: process.env.STRIPE_PRICE_STARTER! },
      { name: 'Growth',    id: process.env.STRIPE_PRICE_GROWTH! },
      { name: 'AI Shield', id: process.env.STRIPE_PRICE_AI_SHIELD! },
    ]
    for (const { name, id } of prices) {
      try {
        const price = await stripe.prices.retrieve(id)
        console.log(price.active
          ? `✅ ${name} price active ($${price.unit_amount! / 100}/mo)`
          : `❌ ${name} price is INACTIVE`)
      } catch {
        console.log(`❌ ${name} price not found: ${id}`)
      }
    }

    // 3. Verify webhook endpoint
    const webhooks = await stripe.webhookEndpoints.list()
    const appWebhook = webhooks.data.find(w =>
      w.url.includes('localvector.ai/api/webhooks/stripe'))
    console.log(appWebhook?.status === 'enabled'
      ? `✅ Webhook registered and enabled`
      : `❌ Webhook not found for localvector.ai`)
  }

  verifyStripe().catch(console.error)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — LAUNCH VERIFICATION SHELL SCRIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: scripts/launch-verify.sh

  #!/bin/bash
  set -euo pipefail
  DOMAIN="${1:-https://localvector.ai}"
  PASS=0; FAIL=0

  check() {
    local label="$1"; local condition="$2"
    if eval "$condition" &>/dev/null; then
      echo "  ✅ $label"; ((PASS++))
    else
      echo "  ❌ $label"; ((FAIL++))
    fi
  }

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  LocalVector.ai Launch Verification"
  echo "  Domain: $DOMAIN"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  echo ""
  echo "[ Redirects ]"
  check "HTTP → HTTPS redirect (301)" \
    "[ \$(curl -so /dev/null -w '%{http_code}' http://localvector.ai) = '301' ]"

  echo ""
  echo "[ Security Headers ]"
  HEADERS=$(curl -sI $DOMAIN)
  check "Strict-Transport-Security" "echo '$HEADERS' | grep -qi 'strict-transport-security'"
  check "X-Frame-Options"           "echo '$HEADERS' | grep -qi 'x-frame-options'"
  check "X-Content-Type-Options"    "echo '$HEADERS' | grep -qi 'x-content-type-options'"
  check "Content-Security-Policy"   "echo '$HEADERS' | grep -qi 'content-security-policy'"
  check "X-Request-Id"              "echo '$HEADERS' | grep -qi 'x-request-id'"

  echo ""
  echo "[ Routes ]"
  check "Homepage (200)"     "[ \$(curl -so /dev/null -w '%{http_code}' $DOMAIN) = '200' ]"
  check "Health check (200)" "[ \$(curl -so /dev/null -w '%{http_code}' $DOMAIN/api/health) = '200' ]"
  check "robots.txt (200)"   "[ \$(curl -so /dev/null -w '%{http_code}' $DOMAIN/robots.txt) = '200' ]"
  check "sitemap.xml (200)"  "[ \$(curl -so /dev/null -w '%{http_code}' $DOMAIN/sitemap.xml) = '200' ]"
  check "Privacy page (200)" "[ \$(curl -so /dev/null -w '%{http_code}' $DOMAIN/privacy) = '200' ]"
  check "/dashboard requires auth (302)" \
    "[ \$(curl -so /dev/null -w '%{http_code}' $DOMAIN/dashboard) = '302' ]"

  echo ""
  echo "[ SSL ]"
  SSL_EXPIRY=$(echo | openssl s_client -connect localvector.ai:443 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  echo "  📋 Certificate expires: ${SSL_EXPIRY:-unknown}"
  check "SSL valid" "echo | openssl s_client -connect localvector.ai:443 2>/dev/null | openssl x509 -noout -checkend 2592000"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Results: $PASS passed, $FAIL failed"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  [ $FAIL -eq 0 ] || exit 1

  chmod +x scripts/launch-verify.sh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/api/health.test.ts
  it('returns 200 with status=ok when all services healthy')
  it('returns 503 with status=degraded when DB unreachable')
  it('does not require authentication')
  it('response includes checks.database and checks.stripe fields')
  it('response includes timestamp and version')

CREATE: __tests__/lib/env-guard.test.ts
  it('does not throw when all required vars are present')
  it('throws listing all missing vars when any are absent')
  it('throws when STRIPE_SECRET_KEY starts with sk_test_ in production')
  it('does not throw for test keys in development')

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P7-FIX-32
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] assertEnvironment() blocks build if any required env var missing
  [ ] assertEnvironment() blocks build if Stripe test key used in production
  [ ] /api/health returns 200 + checks.database + checks.stripe
  [ ] /api/health returns 503 when any service is unhealthy
  [ ] robots.txt disallows /dashboard/ and /api/
  [ ] sitemap.xml lists all public marketing pages
  [ ] Full production metadata (title, OG, Twitter) set in root layout
  [ ] scripts/verify-stripe.ts passes with live Stripe keys
  [ ] scripts/launch-verify.sh: all checks pass (exit 0)
  [ ] All tests pass | 0 regressions | 0 TS errors
  [ ] Manual: run launch-verify.sh → all ✅, exit 0
```

---

---

# P8-FIX-33 — Reality Score / DataHealth v2

### PROMPT — P8-FIX-33

```
You are a senior fullstack engineer on LocalVector.ai. Your task is P8-FIX-33:
implement the Reality Score — a composite 0–100 score measuring how accurately
AI engines represent a business. This is a core product differentiator.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — ALGORITHM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: lib/scoring/reality-score.ts

  export interface RealityScoreComponents {
    mentionCoverage:     number  // % of AI engines that mention the business
    dataAccuracy:        number  // correctness vs ground truth (penalized by mistakes)
    descriptionQuality:  number  // how well AIs describe the business
    categoryPresence:    number  // found in correct category queries
    competitivePosition: number  // relative SOV vs competitors
  }

  const WEIGHTS = {
    mentionCoverage:     0.30,
    dataAccuracy:        0.25,
    descriptionQuality:  0.20,
    categoryPresence:    0.15,
    competitivePosition: 0.10,
  }

  export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F'

  export function calculateRealityScore(c: RealityScoreComponents): {
    total:      number
    grade:      ScoreGrade
    components: RealityScoreComponents
  } {
    const total = Math.round(
      Object.entries(WEIGHTS).reduce(
        (sum, [k, w]) => sum + c[k as keyof RealityScoreComponents] * w, 0
      )
    )
    const grade: ScoreGrade =
      total >= 90 ? 'A' : total >= 80 ? 'B' :
      total >= 70 ? 'C' : total >= 60 ? 'D' : 'F'
    return { total, grade, components: c }
  }

  export function interpretScore(total: number): string {
    if (total >= 90) return 'Excellent — AI engines have highly accurate data'
    if (total >= 80) return 'Good — Minor gaps in how AI sees your business'
    if (total >= 70) return 'Fair — Some engines have outdated or missing info'
    if (total >= 60) return 'Poor — Significant gaps affecting your AI visibility'
    return 'Critical — AI engines have major inaccuracies about your business'
  }

  export function scoreDelta(current: number, previous: number | null): {
    delta: number
    direction: 'up' | 'down' | 'flat'
  } {
    if (previous === null) return { delta: 0, direction: 'flat' }
    const delta = current - previous
    return { delta, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' }
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — SCORE CALCULATOR (FROM SCAN DATA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: lib/scoring/score-calculator.ts

  Migration: supabase/migrations/[ts]_reality_scores.sql
    CREATE TABLE IF NOT EXISTS reality_scores (
      id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      scan_id                UUID REFERENCES scans(id) ON DELETE SET NULL,
      total_score            INTEGER NOT NULL CHECK (total_score BETWEEN 0 AND 100),
      grade                  TEXT    NOT NULL,
      mention_coverage       NUMERIC NOT NULL,
      data_accuracy          NUMERIC NOT NULL,
      description_quality    NUMERIC NOT NULL,
      category_presence      NUMERIC NOT NULL,
      competitive_position   NUMERIC NOT NULL,
      previous_total_score   INTEGER,
      calculated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE reality_scores ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "reality_scores_select_own" ON reality_scores
      FOR SELECT USING (auth.uid() = user_id);
    CREATE INDEX idx_reality_scores_user_calc
      ON reality_scores(user_id, calculated_at DESC);

  export async function computeAndSaveRealityScore(params: {
    supabase: SupabaseClient
    userId:   string
    scanId:   string
  }): Promise<{ total: number; grade: string } | null> {

    // 1. mentionCoverage — from ai_mentions
    const { data: mentions } = await supabase.from('ai_mentions')
      .select('engine, mentioned')
      .eq('user_id', params.userId)
      .eq('scan_id', params.scanId)
    const mentionCoverage = mentions?.length
      ? (mentions.filter(m => m.mentioned).length / mentions.length) * 100
      : 0

    // 2. dataAccuracy — penalize by ai_mistakes severity
    const { data: mistakes } = await supabase.from('ai_mistakes')
      .select('severity').eq('user_id', params.userId).eq('scan_id', params.scanId)
    const penalty = (mistakes ?? []).reduce((p, m) =>
      p + (m.severity === 'critical' ? 25 : m.severity === 'moderate' ? 12 : 5), 0)
    const dataAccuracy = Math.max(0, 100 - penalty)

    // 3. descriptionQuality — from ai_descriptions accuracy_score average
    const { data: descriptions } = await supabase.from('ai_descriptions')
      .select('accuracy_score')
      .eq('user_id', params.userId).eq('scan_id', params.scanId)
    const descriptionQuality = descriptions?.length
      ? descriptions.reduce((s, d) => s + (d.accuracy_score ?? 50), 0) / descriptions.length
      : 50

    // 4. categoryPresence — from position_rankings: was the business found?
    const { data: rankings } = await supabase.from('position_rankings')
      .select('rank_position').eq('user_id', params.userId).eq('scan_id', params.scanId)
    const categoryPresence = rankings?.length
      ? (rankings.filter(r => r.rank_position !== null).length / rankings.length) * 100
      : 0

    // 5. competitivePosition — from sov_scores: your SOV %
    const { data: sov } = await supabase.from('sov_scores')
      .select('score').eq('user_id', params.userId).eq('scan_id', params.scanId)
      .order('calculated_at', { ascending: false }).limit(1).single()
    const competitivePosition = sov?.score ?? 0

    // Get previous score for delta
    const { data: prev } = await supabase.from('reality_scores')
      .select('total_score').eq('user_id', params.userId)
      .order('calculated_at', { ascending: false }).limit(1).single()

    const { total, grade, components } = calculateRealityScore({
      mentionCoverage, dataAccuracy, descriptionQuality,
      categoryPresence, competitivePosition
    })

    // Persist
    await supabase.from('reality_scores').insert({
      user_id:               params.userId,
      scan_id:               params.scanId,
      total_score:           total,
      grade,
      mention_coverage:      components.mentionCoverage,
      data_accuracy:         components.dataAccuracy,
      description_quality:   components.descriptionQuality,
      category_presence:     components.categoryPresence,
      competitive_position:  components.competitivePosition,
      previous_total_score:  prev?.total_score ?? null,
    })

    return { total, grade }
  }

  Call computeAndSaveRealityScore from the scan completion handler
  (same place as markStepComplete and clearSampleData from P0-FIX-04 and P3-FIX-13).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — REALITY SCORE DASHBOARD WIDGET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: components/dashboard/RealityScoreWidget.tsx

  Props: score: number | null, grade: ScoreGrade | null,
         previousScore: number | null, components: RealityScoreComponents | null
         isLoading: boolean

  Layout:
    Large circular score gauge (SVG arc, 0–100 range):
      Color: green (80+), amber (60–79), red (< 60)
      Center: score number + grade letter
    Delta indicator: "+3 since last scan ↑" / "-5 ↓" / "New"
    5-component breakdown bar:
      Each component: label + narrow progress bar + value
    Interpretation text: interpretScore(total)
    Sample mode: show score as "--" with "Run your first scan to get your score"

  Placed prominently on the main dashboard, above the Getting Started checklist.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — SCORE HISTORY PAGE SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

On the main dashboard, below the widget:
  A small line chart showing Reality Score trend over the last 8 scans.
  X-axis: scan dates. Y-axis: score (0–100). Grade bands as background zones.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/lib/scoring/reality-score.test.ts
  describe('calculateRealityScore')
    it('calculates weighted total correctly')
    it('returns grade A for score >= 90')
    it('returns grade F for score < 60')
    it('clamps component values to 0–100 (no negative scores)')
    it('weights sum to 1.0 exactly')
    it('all components weighted: total never exceeds 100')
  describe('interpretScore')
    it('returns correct interpretation for each grade band')
  describe('scoreDelta')
    it('returns direction=up when current > previous')
    it('returns direction=flat when previous is null')
    it('returns correct delta amount')

CREATE: __tests__/lib/scoring/score-calculator.test.ts
  it('calculates mentionCoverage as percentage of engines that mentioned')
  it('penalizes dataAccuracy 25 points per critical mistake')
  it('penalizes dataAccuracy 12 points per moderate mistake')
  it('dataAccuracy never goes below 0')
  it('persists score to reality_scores table')
  it('stores previous_total_score from prior scan')
  it('is called from scan completion handler')

CREATE: __tests__/components/RealityScoreWidget.test.tsx
  it('shows "--" in sample mode')
  it('shows score and grade when data present')
  it('shows delta +/- since last scan')
  it('renders 5 component bars')
  it('shows skeleton when isLoading=true')
  it('gauge color is green for score >= 80')
  it('gauge color is red for score < 60')

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P8-FIX-33
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] reality_scores table created with RLS
  [ ] calculateRealityScore algorithm: 5 weighted components, grade A–F
  [ ] computeAndSaveRealityScore called from scan completion handler
  [ ] Score persists to DB after every scan
  [ ] RealityScoreWidget renders on dashboard with gauge + breakdown
  [ ] Score trend line chart shows last 8 scans
  [ ] Sample mode shows "--" with CTA to run first scan
  [ ] All tests pass | 0 regressions | 0 TS errors
  [ ] Manual: trigger scan → Reality Score appears within 30s
```

---

---

# P8-FIX-34 — SOV Gap → Content Brief Generator

## Background

This is the rescheduled Sprint 86. When a business has low Share of Voice for a
specific query, LocalVector should automatically generate a structured content
brief telling the user exactly what to write and how to write it to close that gap.

### PROMPT — P8-FIX-34

```
You are a senior fullstack engineer on LocalVector.ai. Your task is P8-FIX-34:
build the SOV Gap → Content Brief Generator. When a user's SOV drops below a
threshold for a specific query, generate a structured content brief via AI that
tells them exactly what to create to improve their AI visibility for that query.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — GAP DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: lib/sov/gap-detector.ts

  export interface SOVGap {
    queryText:       string
    engine:          string
    currentSOV:      number   // 0–100
    targetSOV:       number   // minimum desired SOV
    gapSize:         number   // targetSOV - currentSOV
    competitorNames: string[]
    category:        string
  }

  const SOV_TARGET_BY_PLAN = {
    free:      0,   // no gap detection for free
    starter:  20,
    growth:   35,
    ai_shield: 50,
  }

  export async function detectSOVGaps(params: {
    supabase: SupabaseClient
    userId:   string
    planTier: PlanTier
    scanId:   string
  }): Promise<SOVGap[]> {
    const target = SOV_TARGET_BY_PLAN[params.planTier]
    if (target === 0) return []

    const { data: sovScores } = await params.supabase
      .from('sov_scores')
      .select('query_text, engine, score, category')
      .eq('user_id', params.userId)
      .eq('scan_id', params.scanId)
      .lt('score', target)
      .order('score', { ascending: true })
      .limit(10)

    return (sovScores ?? []).map(row => ({
      queryText:       row.query_text,
      engine:          row.engine,
      currentSOV:      row.score,
      targetSOV:       target,
      gapSize:         target - row.score,
      competitorNames: [],  // populated in Step 2
      category:        row.category,
    }))
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — CONTENT BRIEF GENERATION (AI-POWERED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: lib/sov/brief-generator.ts

  export interface ContentBrief {
    gapId:          string
    queryText:      string
    engine:         string
    briefTitle:     string
    contentType:    'faq-page' | 'blog-post' | 'landing-page' | 'schema-markup'
    targetWordCount: number
    keyPoints:      string[]    // 3–5 specific points to cover
    suggestedTitle: string
    sampleOutline:  string[]
    schemaMarkup:   string | null
    estimatedImpact: 'high' | 'medium' | 'low'
    generatedAt:    string
  }

  export async function generateContentBrief(
    gap: SOVGap,
    businessProfile: { name: string; category: string; description: string }
  ): Promise<ContentBrief> {

    const prompt = `You are an AI visibility optimization expert.
A business called "${businessProfile.name}" (category: ${businessProfile.category})
has only ${gap.currentSOV}% Share of Voice on ${gap.engine} for the query:
"${gap.queryText}"

Their competitors have ${gap.targetSOV - gap.currentSOV}% more visibility.

Generate a structured content brief that tells this business owner EXACTLY what
content to create to improve their AI visibility for this query.

Respond in JSON only (no markdown fences):
{
  "briefTitle": "...",
  "contentType": "faq-page|blog-post|landing-page|schema-markup",
  "targetWordCount": number,
  "keyPoints": ["point1", "point2", "point3"],
  "suggestedTitle": "...",
  "sampleOutline": ["## Section 1", "## Section 2", "## Section 3"],
  "schemaMarkup": "JSON-LD schema string or null",
  "estimatedImpact": "high|medium|low",
  "reasoning": "1-2 sentence explanation of why this content will help"
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json',
                 'x-api-key': process.env.ANTHROPIC_API_KEY! },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text ?? '{}'
    const parsed = JSON.parse(text)

    return {
      gapId:           `${gap.engine}-${gap.queryText.replace(/\s+/g, '-')}`,
      queryText:       gap.queryText,
      engine:          gap.engine,
      briefTitle:      parsed.briefTitle,
      contentType:     parsed.contentType,
      targetWordCount: parsed.targetWordCount,
      keyPoints:       parsed.keyPoints ?? [],
      suggestedTitle:  parsed.suggestedTitle,
      sampleOutline:   parsed.sampleOutline ?? [],
      schemaMarkup:    parsed.schemaMarkup ?? null,
      estimatedImpact: parsed.estimatedImpact,
      generatedAt:     new Date().toISOString(),
    }
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — STORAGE AND INTEGRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Migration: supabase/migrations/[ts]_content_briefs.sql

  CREATE TABLE IF NOT EXISTS content_briefs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scan_id          UUID REFERENCES scans(id) ON DELETE SET NULL,
    gap_id           TEXT NOT NULL,
    query_text       TEXT NOT NULL,
    engine           TEXT NOT NULL,
    brief_data       JSONB NOT NULL,
    status           TEXT NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new','viewed','implemented','dismissed')),
    generated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ALTER TABLE content_briefs ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "briefs_select_own" ON content_briefs FOR SELECT
    USING (auth.uid() = user_id);
  CREATE INDEX idx_content_briefs_user ON content_briefs(user_id, generated_at DESC);

After scan completes and gaps are detected (in scan completion handler):
  1. Call detectSOVGaps()
  2. For each gap (max 3 per scan to control API costs):
       const brief = await generateContentBrief(gap, profile)
       await supabase.from('content_briefs').insert({ ...brief })
       await deductCredits({ userId, operation: 'content_recommendation' })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — CONTENT BRIEFS PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create/extend: app/dashboard/recommendations/page.tsx

  Add a "Content Briefs" tab alongside the existing recommendations tab.

  Each brief card shows:
    Query: "[query text]" on [engine]
    Impact badge: High / Medium / Low
    Content type chip: FAQ Page / Blog Post / etc.
    [View Brief] button → expands full brief inline or opens modal

  Expanded brief view:
    Title: [briefTitle]
    Suggested article title: [suggestedTitle]
    Target word count: [X] words
    Key points to cover: (bulleted list)
    Suggested outline: (numbered sections)
    Schema markup: (copyable code block if present)
    [Mark Implemented] button

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('detectSOVGaps', () => {
    it('returns empty array for free plan')
    it('returns gaps where SOV < target for plan tier')
    it('returns maximum 10 gaps ordered by worst first')
    it('does not return gaps where SOV >= target')
  })

  describe('generateContentBrief', () => {
    it('calls Anthropic API with business context and gap info')
    it('parses JSON response into ContentBrief shape')
    it('returns valid contentType value')
    it('handles malformed AI response gracefully (does not throw)')
    it('includes gap query and engine in returned brief')
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P8-FIX-34
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] content_briefs table created with RLS
  [ ] Gap detection returns gaps below plan-tier SOV target
  [ ] Brief generation calls Anthropic API with structured prompt
  [ ] Briefs generated for top 3 gaps per scan (API cost controlled)
  [ ] Credits deducted per brief generated
  [ ] Content Briefs tab on recommendations page
  [ ] Brief card shows query, engine, impact, content type
  [ ] Expanded view shows full brief with copyable schema markup
  [ ] All tests pass | 0 regressions | 0 TS errors
```

---

---

# P8-FIX-35 — Google Business Profile Integration

### PROMPT — P8-FIX-35

```
You are a senior fullstack engineer on LocalVector.ai. Your task is P8-FIX-35:
integrate Google Business Profile (GBP) so LocalVector can read a user's GBP
data (name, address, hours, categories) and use it as ground truth for
accuracy comparison in the Reality Score dataAccuracy component.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — OAUTH FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Required OAuth scopes:
    https://www.googleapis.com/auth/business.manage

  Required env vars:
    GOOGLE_CLIENT_ID
    GOOGLE_CLIENT_SECRET
    (add to .env.example)

Create: app/api/integrations/google/connect/route.ts  (GET)
  Generates Google OAuth URL with state (CSRF token) and redirects user.
  State stored in a signed cookie for verification on callback.

Create: app/api/integrations/google/callback/route.ts  (GET)
  Handles OAuth callback:
    1. Verify state parameter matches cookie
    2. Exchange code for access_token + refresh_token
    3. Store tokens encrypted in a new integrations table:
         CREATE TABLE IF NOT EXISTS integrations (
           id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
           user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
           provider     TEXT NOT NULL,  -- 'google_business'
           access_token  TEXT NOT NULL,
           refresh_token TEXT,
           expires_at   TIMESTAMPTZ,
           scopes       TEXT[],
           connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           UNIQUE(user_id, provider)
         );
    4. Trigger a GBP data sync job
    5. Redirect to /dashboard/settings/profile?connected=google

Create: app/api/integrations/google/disconnect/route.ts  (POST)
  Revokes OAuth token, deletes from integrations table.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — GBP DATA SYNC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: lib/integrations/google-business.ts

  export async function syncGBPData(params: {
    supabase: SupabaseClient
    userId:   string
  }): Promise<void> {
    // 1. Get access token (refresh if expired)
    const token = await getValidAccessToken(params.supabase, params.userId)
    if (!token) return

    // 2. Fetch accounts
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const { accounts } = await accountsRes.json()
    if (!accounts?.length) return

    // 3. Fetch locations for first account
    const accountName = accounts[0].name
    const locationsRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations` +
      `?readMask=name,title,storefrontAddress,regularHours,primaryCategory,websiteUri,phoneNumbers`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const { locations } = await locationsRes.json()
    if (!locations?.length) return

    const location = locations[0]

    // 4. Store ground truth data in profiles
    await params.supabase.from('profiles').update({
      gbp_name:          location.title,
      gbp_address:       formatAddress(location.storefrontAddress),
      gbp_phone:         location.phoneNumbers?.primaryPhone,
      gbp_website:       location.websiteUri,
      gbp_category:      location.primaryCategory?.displayName,
      gbp_hours:         JSON.stringify(location.regularHours),
      gbp_synced_at:     new Date().toISOString(),
    }).eq('id', params.userId)
  }

  Add GBP columns to profiles migration:
    gbp_name, gbp_address, gbp_phone, gbp_website,
    gbp_category, gbp_hours (JSONB), gbp_synced_at

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — CONNECT GBP UI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In /dashboard/settings/profile:
  Add "Connected Accounts" section above Danger Zone:

  Google Business Profile:
    If NOT connected:
      [Connect Google Business Profile] button
      → GET /api/integrations/google/connect → OAuth redirect
      Benefit text: "Connect to auto-fill your business data and improve accuracy"

    If connected:
      ✅ Connected (last synced: [gbp_synced_at])
      [Sync Now] button → POST /api/integrations/google/sync
      [Disconnect] button → POST /api/integrations/google/disconnect

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — USE GBP IN REALITY SCORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In score-calculator.ts, update dataAccuracy calculation:
  If profile.gbp_name is set (GBP connected):
    Compare ai_descriptions fields against GBP ground truth
    Penalize more precisely:
      Wrong name: -30 points
      Wrong address: -20 points
      Wrong phone: -15 points
      Wrong hours: -10 per engine with wrong hours
  If GBP not connected:
    Fall back to mistake-count-based scoring (existing behavior)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P8-FIX-35
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] OAuth flow: connect, callback, disconnect all working
  [ ] integrations table stores encrypted tokens
  [ ] GBP data synced to profiles.gbp_* columns
  [ ] Reality Score dataAccuracy uses GBP ground truth when available
  [ ] Connect GBP UI in settings with connected/disconnected states
  [ ] Sync Now button triggers fresh GBP data pull
  [ ] Token refresh handled automatically when expired
  [ ] All tests pass | 0 regressions | 0 TS errors
  [ ] Manual: connect GBP → profile auto-fills with GBP data
```

---

---

# P8-FIX-36 — IndexNow + Bing Places Sync

### PROMPT — P8-FIX-36

```
You are a senior fullstack engineer on LocalVector.ai. Your task is P8-FIX-36:
implement IndexNow for instant search engine URL submission and Bing Places sync
for business data accuracy in Microsoft's ecosystem (which feeds Copilot AI).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART A — INDEXNOW (INSTANT URL INDEXING)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IndexNow lets websites instantly notify search engines (Bing, Yandex)
when content changes. This is relevant for LocalVector because:
  - When a user publishes content based on a content brief (FIX-34),
    they can instantly submit those URLs to be indexed
  - Faster indexing = faster AI visibility improvement

Create: lib/indexnow/client.ts

  const INDEXNOW_KEY = process.env.INDEXNOW_API_KEY!  // generate once, save to DB

  export async function submitURLs(params: {
    host:   string   // e.g. "charcoalnchill.com"
    urls:   string[]
    userId: string
  }): Promise<{ submitted: number; errors: string[] }> {
    const body = {
      host:    params.host,
      key:     INDEXNOW_KEY,
      keyLocation: `https://${params.host}/${INDEXNOW_KEY}.txt`,
      urlList: params.urls.slice(0, 10000),  // IndexNow max per request
    }
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    if (res.ok || res.status === 202) {
      logger.info({ urls: params.urls.length, userId: params.userId }, 'indexnow.submitted')
      return { submitted: params.urls.length, errors: [] }
    }
    const error = await res.text()
    return { submitted: 0, errors: [error] }
  }

Create: app/api/integrations/indexnow/submit/route.ts  (POST)
  Auth required + plan check (growth+)
  Body: { urls: string[] }  — user submits their own website URLs
  Validates: all URLs must belong to user's registered domain (from profile.website)
  Calls submitURLs(), returns { submitted, errors }
  Deducts 1 credit per URL batch submitted

Create: app/api/integrations/indexnow/key/route.ts  (GET)
  Returns { key: INDEXNOW_KEY, keyFileUrl } so user can place the key file
  on their website (required by IndexNow protocol)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART B — BING PLACES SYNC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bing Places feeds Microsoft Copilot's local business data.
Keeping it accurate directly improves AI visibility on Copilot.

Create: lib/integrations/bing-places.ts

  export async function checkBingPlacesListing(params: {
    businessName: string
    address:      string
  }): Promise<{
    found:          boolean
    bingPlacesUrl:  string
    claimUrl:       string
    lastVerified:   string | null
  }> {
    // Bing Places does not have a public API for reading listings
    // Generate the search URL and claim URL for the user to visit:
    const searchQuery = encodeURIComponent(`${params.businessName} ${params.address}`)
    return {
      found:         false,  // Cannot determine programmatically without API key
      bingPlacesUrl: `https://www.bingplaces.com/`,
      claimUrl:      `https://www.bingplaces.com/BusinessOwner/ClaimBusiness`,
      lastVerified:  null,
    }
  }

  Note: Bing Places API requires applying for access separately.
  Build the UI scaffold now; API integration can be added when access is granted.

Create Bing Places guidance UI in /dashboard/settings/profile:

  "Bing Places (Microsoft Copilot)" section:
    - Status: "Unverified" / "Verified" (manually set by user)
    - Instructions:
        1. Visit Bing Places for Business
        2. Search for your business
        3. Claim and verify your listing
        4. Come back and mark as verified below
    - [Mark as Verified] button → sets profile.bing_places_verified = true
    - Benefit: "Verified Bing listings improve your visibility on Microsoft Copilot"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — INTEGRATIONS PAGE SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: app/dashboard/settings/integrations/page.tsx

  Lists all available integrations with connect/status UI:
    Google Business Profile  (FIX-35)
    IndexNow                 (FIX-36A) — Growth+
    Bing Places              (FIX-36B) — All plans
    [More coming soon]       Apple Business Connect, Google Analytics

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P8-FIX-36
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] IndexNow: POST /api/integrations/indexnow/submit works for Growth+
  [ ] IndexNow: validates submitted URLs belong to user's domain
  [ ] IndexNow: key file URL returned so user can place it on their site
  [ ] IndexNow: credits deducted per batch
  [ ] Bing Places: guidance UI with step-by-step instructions
  [ ] Bing Places: user can mark listing as verified
  [ ] Integrations settings page lists all integrations
  [ ] All tests pass | 0 regressions | 0 TS errors
```

---

---

# P8-FIX-37 — Competitive Hijacking Alerts

### PROMPT — P8-FIX-37

```
You are a senior fullstack engineer on LocalVector.ai. Your task is P8-FIX-37:
detect and alert users when an AI engine is confusing their business with a
competitor — a "competitive hijacking" event — and provide the context and
recommended actions to correct it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — HIJACKING DETECTION ALGORITHM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: lib/alerts/hijacking-detector.ts

  export interface HijackingEvent {
    id:             string
    userId:         string
    scanId:         string
    engine:         string
    queryText:      string
    hijackType:     'attribute_confusion' | 'competitor_citation' | 'address_mix'
    ourBusiness:    string
    competitorName: string
    evidenceText:   string    // the AI's actual response showing the confusion
    severity:       'critical' | 'high' | 'medium'
    detectedAt:     string
    status:         'new' | 'acknowledged' | 'resolved'
  }

  export function detectHijacking(params: {
    businessName:    string
    businessAddress: string
    aiDescriptions:  Array<{ engine: string; query: string; text: string }>
    aiMistakes:      Array<{ engine: string; mistake_text: string; correct_value: string }>
  }): HijackingEvent[] {
    const events: HijackingEvent[] = []

    for (const desc of params.aiDescriptions) {
      // Pattern 1: AI attributes a competitor's address to our business
      if (desc.text.includes(params.businessAddress) === false &&
          desc.text.match(/\d{1,5}\s\w+\s(st|ave|blvd|rd|dr|ln|way)\b/i)) {
        events.push({
          id: crypto.randomUUID(),
          hijackType: 'address_mix',
          competitorName: extractCompetitorName(desc.text),
          evidenceText: desc.text.slice(0, 300),
          severity: 'high',
          engine: desc.engine,
          queryText: desc.query,
          // ... other fields
        })
      }
      // Pattern 2: Competitor business name appears in our business's AI response
      // (requires a competitor name list — use position_rankings competitor_names)
    }
    return events
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — DATABASE + SCAN INTEGRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Migration: supabase/migrations/[ts]_hijacking_alerts.sql

  CREATE TABLE IF NOT EXISTS hijacking_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scan_id         UUID REFERENCES scans(id) ON DELETE SET NULL,
    engine          TEXT NOT NULL,
    query_text      TEXT NOT NULL,
    hijack_type     TEXT NOT NULL,
    our_business    TEXT NOT NULL,
    competitor_name TEXT NOT NULL,
    evidence_text   TEXT NOT NULL,
    severity        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'new',
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ
  );
  ALTER TABLE hijacking_alerts ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "alerts_select_own" ON hijacking_alerts FOR SELECT
    USING (auth.uid() = user_id);

Call detectHijacking from scan completion handler.
Save detected events to hijacking_alerts table.
If severity = 'critical': send email alert immediately (use sendEmail from FIX-21).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — HIJACKING ALERTS PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: app/dashboard/ai-mistakes/page.tsx  (extends the existing AI Mistakes page)
  Add a "Hijacking Alerts" tab with:
    Alert card per event:
      Severity badge (CRITICAL red / HIGH amber / MEDIUM gray)
      "[Engine] is confusing [Our Business] with [Competitor Name]"
      Evidence: expandable quote showing the AI's actual response
      Query: "When asked: [queryText]"
      Actions:
        [Acknowledge] → status = 'acknowledged'
        [Mark Resolved] → status = 'resolved', resolved_at = now()
        [View Correction Steps] → opens modal with specific fix guidance

  Fix guidance modal per hijack_type:
    address_mix: "Ensure your address is consistent across Google Business
                  Profile, your website, and all citation sources..."
    competitor_citation: "Create content that clearly differentiates your
                          business name and location from [competitor]..."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P8-FIX-37
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] hijacking_alerts table created with RLS
  [ ] detectHijacking runs on every scan completion
  [ ] Critical severity events trigger immediate email alert
  [ ] Hijacking Alerts tab on AI Mistakes page
  [ ] Each alert shows evidence + severity + engine
  [ ] Acknowledge and Mark Resolved transitions work
  [ ] Fix guidance modal provides actionable steps per hijack type
  [ ] All tests pass | 0 regressions | 0 TS errors
  [ ] Manual: simulated hijacking event → card appears on alerts page
```

---

---

# P8-FIX-38 — Per-Engine Optimization Playbooks

### PROMPT — P8-FIX-38

```
You are a senior fullstack engineer on LocalVector.ai. Your task is P8-FIX-38:
implement per-engine optimization playbooks — specific, actionable guidance
tailored to how each AI engine (ChatGPT, Perplexity, Gemini, Claude) works
and what signals it uses to rank and cite local businesses.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — PLAYBOOK DATA MODEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: lib/playbooks/engine-playbooks.ts

  export type AIEngine = 'chatgpt' | 'perplexity' | 'gemini' | 'claude'

  export interface PlaybookStep {
    id:          string
    order:       number
    title:       string
    description: string
    effort:      'low' | 'medium' | 'high'
    impact:      'low' | 'medium' | 'high'
    category:    'content' | 'technical' | 'citations' | 'schema' | 'reviews'
    actionUrl:   string | null   // link to tool or resource
    doneMetric:  string          // how to know it's done
  }

  export interface EnginePlaybook {
    engine:          AIEngine
    displayName:     string
    description:     string
    citationSources: string[]   // what sources this engine trusts
    rankingFactors:  string[]   // key ranking signals
    steps:           PlaybookStep[]
  }

  export const ENGINE_PLAYBOOKS: Record<AIEngine, EnginePlaybook> = {
    chatgpt: {
      engine:      'chatgpt',
      displayName: 'ChatGPT',
      description: 'ChatGPT retrieves local business data primarily from Bing web index and trusted review platforms.',
      citationSources: ['Bing Search', 'Yelp', 'TripAdvisor', 'Google Reviews', 'Official website'],
      rankingFactors:  ['Review volume and recency', 'Bing index authority', 'NAP consistency', 'Schema markup'],
      steps: [
        {
          id: 'chatgpt-1', order: 1,
          title: 'Verify your Bing Places listing',
          description: 'ChatGPT uses Bing's index. Claim and verify your Bing Places listing to ensure accurate data.',
          effort: 'low', impact: 'high', category: 'citations',
          actionUrl: 'https://www.bingplaces.com',
          doneMetric: 'Bing Places listing shows "Verified"',
        },
        {
          id: 'chatgpt-2', order: 2,
          title: 'Add LocalBusiness schema to your homepage',
          description: 'Schema markup helps ChatGPT extract accurate business data directly from your website.',
          effort: 'medium', impact: 'high', category: 'schema',
          actionUrl: 'https://schema.org/LocalBusiness',
          doneMetric: 'Google Rich Results Test passes for LocalBusiness',
        },
        // ... 3 more steps
      ],
    },
    perplexity: {
      engine:      'perplexity',
      displayName: 'Perplexity',
      description: 'Perplexity cites web sources in real time. Appearing in high-authority web sources is critical.',
      citationSources: ['Official website', 'News mentions', 'Review sites', 'Social media'],
      rankingFactors:  ['Domain authority of cited sources', 'Recency', 'Review ratings', 'Keyword presence in titles'],
      steps: [
        {
          id: 'perplexity-1', order: 1,
          title: 'Publish a high-quality FAQ page',
          description: 'Perplexity frequently cites FAQ content. A dedicated FAQ page with common questions about your business can significantly improve visibility.',
          effort: 'medium', impact: 'high', category: 'content',
          actionUrl: null,
          doneMetric: 'FAQ page indexed in Google and Bing',
        },
        // ... more steps
      ],
    },
    gemini: {
      engine:      'gemini',
      displayName: 'Google Gemini',
      description: 'Gemini prioritizes Google ecosystem data — Google Business Profile, Google Maps reviews, and Knowledge Graph.',
      citationSources: ['Google Business Profile', 'Google Maps', 'Google Knowledge Graph', 'Official website'],
      rankingFactors:  ['GBP completeness', 'Google review count/rating', 'Local SEO authority', 'Q&A responses on GBP'],
      steps: [
        {
          id: 'gemini-1', order: 1,
          title: 'Complete your Google Business Profile 100%',
          description: 'Gemini sources directly from GBP. Every empty field is a missed opportunity. Fill out all categories, attributes, hours, photos, and services.',
          effort: 'low', impact: 'critical', category: 'citations',
          actionUrl: 'https://business.google.com',
          doneMetric: 'GBP profile completeness score = 100%',
        },
        // ... more steps
      ],
    },
    claude: {
      engine:      'claude',
      displayName: 'Claude (Anthropic)',
      description: 'Claude synthesizes information from across the web. NAP consistency and authoritative citations matter most.',
      citationSources: ['Official website', 'Business directories', 'News articles', 'Review aggregators'],
      rankingFactors:  ['NAP consistency across sources', 'Website content quality', 'Third-party citations'],
      steps: [
        // ... playbook steps
      ],
    },
  }

  export function getPlaybookForEngine(engine: AIEngine): EnginePlaybook {
    return ENGINE_PLAYBOOKS[engine]
  }

  export function getPersonalizedSteps(
    engine: AIEngine,
    scanData: {
      hasBingPlaces: boolean
      hasGBP: boolean
      hasSchemaMarkup: boolean
      reviewCount: number
      mentionedByEngine: boolean
    }
  ): PlaybookStep[] {
    const playbook = ENGINE_PLAYBOOKS[engine]
    // Filter out already-done steps and sort by impact/effort ratio
    return playbook.steps
      .filter(step => {
        if (step.id === 'chatgpt-1' && scanData.hasBingPlaces) return false
        if (step.id === 'gemini-1' && scanData.hasGBP) return false
        return true
      })
      .sort((a, b) => {
        const impactScore = { high: 3, medium: 2, low: 1 }
        const effortScore = { low: 3, medium: 2, high: 1 }  // lower effort = better
        return (impactScore[b.impact] + effortScore[b.effort]) -
               (impactScore[a.impact] + effortScore[a.effort])
      })
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — PLAYBOOKS PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: app/dashboard/playbooks/page.tsx

  Layout:
    Tab per AI engine: ChatGPT | Perplexity | Google Gemini | Claude

    Per tab:
      Engine header:
        Logo + display name
        "How [engine] ranks local businesses": 2-sentence description
        Trusted sources chips: Bing / GBP / Yelp / etc.

      Your personalized playbook:
        Prioritized steps (highest impact/lowest effort first)
        Each step card:
          Title + description
          Effort badge (Low / Medium / High) + Impact badge
          Category chip (Content / Technical / Citations / Schema)
          [Start →] action button (links to actionUrl or opens modal)
          [Mark Done ✓] button

      Completion progress:
        "X of Y steps completed"
        Progress bar

  Track completion in: playbook_progress table
    CREATE TABLE IF NOT EXISTS playbook_progress (
      user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      engine     TEXT NOT NULL,
      step_id    TEXT NOT NULL,
      done       BOOLEAN NOT NULL DEFAULT false,
      done_at    TIMESTAMPTZ,
      PRIMARY KEY (user_id, engine, step_id)
    );

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — SIDEBAR + NAVIGATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add "Playbooks" to sidebar-config.ts:
  {
    key: 'playbooks',
    label: 'Playbooks',
    href: '/dashboard/playbooks',
    icon: 'BookMarked',
    section: 'how_ai_sees_you',
    requiredFeature: null,    // available to all paid plans
    requiredPlan: 'starter',  // free users see upgrade prompt
    upgradeMessage: 'Get step-by-step playbooks for each AI engine. Available on Starter plan and above.',
    upgradeTargetPlan: 'starter',
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/lib/playbooks/engine-playbooks.test.ts

  describe('ENGINE_PLAYBOOKS', () => {
    it('has entries for all 4 AI engines')
    it('each engine has at least 3 playbook steps')
    it('all step IDs are unique across all engines')
    it('all steps have valid effort and impact values')
    it('all steps have a doneMetric')
  })

  describe('getPersonalizedSteps', () => {
    it('filters out already-done steps based on scan data')
    it('sorts by impact/effort ratio (high impact, low effort first)')
    it('returns fewer steps when some are already complete')
    it('handles all 4 engines')
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P8-FIX-38
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] ENGINE_PLAYBOOKS defined for all 4 engines with 3+ steps each
  [ ] getPersonalizedSteps filters and sorts by impact/effort ratio
  [ ] playbook_progress table tracks per-user step completion
  [ ] Playbooks page renders with 4 engine tabs
  [ ] Each step shows effort + impact badges + action button
  [ ] Mark Done persists to playbook_progress table
  [ ] Completion progress bar updates as steps are completed
  [ ] Playbooks sidebar item added (Starter+ plan gate)
Done
