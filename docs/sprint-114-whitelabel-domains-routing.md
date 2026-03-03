# Sprint 114 — White-Label: Domains + Routing

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`, `lib/plan-enforcer.ts`,
> `lib/membership/types.ts`, `middleware.ts`

---

## 🎯 Objective

Build the **White-Label Domain + Routing** layer — the infrastructure that lets Agency plan customers serve LocalVector under their own domain or subdomain, with per-org domain configuration stored in the database and resolved at the edge.

**What this sprint answers:** "How do I make LocalVector appear as my own product at my own domain?"

**What Sprint 114 delivers:**
- `org_domains` table — per-org custom domain + subdomain config with verification state
- Edge middleware updated to resolve incoming request hostname → org_id
- `GET /api/whitelabel/domain` — fetch current domain config for org
- `POST /api/whitelabel/domain` — save/update domain config (owner only, Agency plan)
- `DELETE /api/whitelabel/domain` — remove custom domain
- `POST /api/whitelabel/domain/verify` — trigger DNS verification check
- `/dashboard/settings/domain` — domain configuration UI with DNS instructions and verification status
- Subdomain routing: `{slug}.localvector.ai` resolves to the correct org automatically
- Custom domain routing: `app.theirbrand.com` resolves to the correct org
- `OrgContext` — a lightweight context object resolved per-request, passed through to server components
- Sidebar navigation: new "White-Label" settings section in `/dashboard/settings`

**What this sprint does NOT build:** custom branding/theming (Sprint 115), white-labeled email templates (Sprint 115), partner billing for resellers (future). Sprint 114 is routing infrastructure only — the domain resolves to the correct org, but the product still looks like LocalVector.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read AI_RULES.md                                 — All rules (51 rules as of Sprint 113)
Read CLAUDE.md                                   — Full implementation inventory
Read middleware.ts                               — CRITICAL: read every line before touching
  § FIND: existing auth guard logic
  § FIND: public routes allowlist (added /invitations in Sprint 112)
  § FIND: how session is currently resolved
  § FIND: any existing hostname/subdomain handling
Read supabase/prod_schema.sql
  § FIND: organizations — all columns (name, plan_tier, slug if exists)
  § FIND: whether organizations already has a slug/subdomain column
  § FIND: existing RLS policy pattern to replicate
Read lib/plan-enforcer.ts                        — canAddMember(), plan_tier values
Read lib/membership/types.ts                     — MemberRole
Read lib/supabase/database.types.ts             — All current types
Read src/__fixtures__/golden-tenant.ts           — All existing fixtures
Read app/dashboard/settings/page.tsx            — Existing settings page structure
Read next.config.ts (or next.config.js)         — Current Next.js config for rewrites/headers
Read vercel.json                                 — Current Vercel config
Read supabase/seed.sql                           — Seed pattern
```

**Specifically understand before writing code:**

1. **`middleware.ts` is the most dangerous file in this sprint.** AI_RULES §6 says never edit it. This sprint is the ONE exception — but only to add hostname resolution BEFORE the existing auth guard. Read every line of the existing middleware. Understand exactly what it does. Add the minimum possible change. If the existing middleware is complex, prefer adding a separate `lib/middleware/domain-resolver.ts` helper and calling it from middleware rather than inlining logic.

2. **Whether `organizations` already has a `slug` column.** Many LocalVector sprints reference org slugs (e.g. `/m/[slug]`). Check `prod_schema.sql` carefully. If a `slug` column exists, use it for subdomain routing. If not, derive the subdomain from `organizations.name` (kebab-case, truncated to 63 chars — DNS label limit).

3. **DNS verification approach.** Verifying custom domains requires the org to add a CNAME or TXT record. The verification endpoint checks DNS via a DNS-over-HTTPS lookup (use `https://cloudflare-dns.com/dns-query` — no extra library needed, just `fetch()`). Do NOT use Node.js `dns` module — it is not available in Vercel Edge runtime.

4. **Vercel configuration for custom domains.** Real custom domain routing in production requires Vercel's Domains API or manual domain addition in the Vercel dashboard. In Sprint 114, we build the DB config and routing logic — the actual Vercel domain addition is a manual step documented in the settings UI instructions. Do NOT attempt to call the Vercel API programmatically in Sprint 114.

5. **`next.config` rewrites vs middleware.** Subdomain routing (`{slug}.localvector.ai`) is best handled in middleware, not next.config rewrites, because it needs DB access to resolve org_id. Custom domains also need middleware. Do not use `next.config` for this.

---

## 🏗️ Architecture — What to Build

### Directory Structure

```
lib/whitelabel/
  index.ts                    — barrel export
  types.ts                    — OrgDomain, DomainConfig, DomainVerification, OrgContext
  domain-service.ts           — DB operations for domain config (pure, caller passes client)
  domain-resolver.ts          — Edge-compatible hostname → org lookup (used by middleware)
  dns-verifier.ts             — DNS-over-HTTPS verification (pure fetch, no Node dns module)

app/api/whitelabel/
  domain/
    route.ts                  — GET, POST, DELETE domain config
    verify/
      route.ts                — POST trigger DNS verification

app/dashboard/settings/
  domain/
    page.tsx                  — Domain configuration page (server component)
    _components/
      DomainConfigForm.tsx    — Domain input + save
      DnsInstructions.tsx     — Step-by-step DNS setup guide
      VerificationStatus.tsx  — Live verification status badge

middleware.ts                 — MODIFY: add hostname resolution at top of handler
```

---

### Component 1: Types — `lib/whitelabel/types.ts`

```typescript
export type DomainType = 'subdomain' | 'custom';

export type VerificationStatus =
  | 'unverified'    // never checked or check failed
  | 'pending'       // check initiated, waiting
  | 'verified'      // DNS check passed
  | 'failed';       // DNS check explicitly failed (wrong record)

export interface OrgDomain {
  id: string;
  org_id: string;
  domain_type: DomainType;
  // For subdomain: the {slug} part of {slug}.localvector.ai
  // For custom: the full domain, e.g. "app.theirbrand.com"
  domain_value: string;
  // The DNS TXT record value the org must add to verify ownership
  // Format: "localvector-verify={token}"
  verification_token: string;
  verification_status: VerificationStatus;
  verified_at: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DomainConfig {
  // The effective domain this org is accessible at
  // For subdomain: "{slug}.localvector.ai"
  // For custom (verified): the custom domain value
  // For custom (unverified): "{slug}.localvector.ai" (fallback)
  effective_domain: string;
  subdomain: string;         // always present — derived from org slug or name
  custom_domain: OrgDomain | null;
  subdomain_domain: OrgDomain | null;
}

/**
 * Lightweight org context resolved per-request in middleware.
 * Passed via request headers to server components.
 * MUST be small — it travels in every request header.
 */
export interface OrgContext {
  org_id: string;
  org_name: string;
  plan_tier: string;
  // The hostname that was used to access the app
  resolved_hostname: string;
  // Whether this request came via a custom domain (vs subdomain or direct)
  is_custom_domain: boolean;
}

export interface DomainVerificationResult {
  verified: boolean;
  status: VerificationStatus;
  checked_at: string;
  error: string | null;
}

// DNS TXT record format for domain verification
export const VERIFICATION_TXT_PREFIX = 'localvector-verify=';
// Subdomain pattern: {slug}.localvector.ai
export const SUBDOMAIN_BASE = 'localvector.ai';
// Max subdomain slug length (DNS label limit is 63 chars)
export const MAX_SUBDOMAIN_LENGTH = 63;
```

---

### Component 2: Migration — `supabase/migrations/[timestamp]_org_domains.sql`

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 114: White-Label Domains + Routing
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Add slug to organizations if it doesn't exist
--    Check prod_schema.sql first — if slug already exists, skip this block.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS slug text UNIQUE;

COMMENT ON COLUMN public.organizations.slug IS
  'URL-safe slug for subdomain routing: {slug}.localvector.ai. '
  'Derived from org name on creation. Unique across all orgs. Sprint 114.';

-- Backfill slugs for existing orgs (kebab-case from name, truncated to 63 chars)
-- Use a simple regex approach available in Postgres:
UPDATE public.organizations
   SET slug = LOWER(
     REGEXP_REPLACE(
       REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'),
       '\s+', '-', 'g'
     )
   )
 WHERE slug IS NULL;

-- Handle slug conflicts from backfill by appending org id suffix
-- (run a second pass for any remaining duplicates)
UPDATE public.organizations o1
   SET slug = SUBSTRING(slug, 1, 55) || '-' || SUBSTRING(id::text, 1, 7)
 WHERE EXISTS (
   SELECT 1 FROM public.organizations o2
   WHERE o2.slug = o1.slug AND o2.id != o1.id
 );

-- 2. org_domains table
CREATE TABLE IF NOT EXISTS public.org_domains (
  id                    uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid               NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain_type           text               NOT NULL CHECK (domain_type IN ('subdomain', 'custom')),
  domain_value          text               NOT NULL,
  verification_token    text               NOT NULL UNIQUE DEFAULT (
    'localvector-verify=' || encode(gen_random_bytes(16), 'hex')
  ),
  verification_status   text               NOT NULL DEFAULT 'unverified'
                                           CHECK (verification_status IN
                                             ('unverified', 'pending', 'verified', 'failed')),
  verified_at           timestamptz,
  last_checked_at       timestamptz,
  created_at            timestamptz        NOT NULL DEFAULT NOW(),
  updated_at            timestamptz        NOT NULL DEFAULT NOW(),
  -- One domain entry per type per org
  UNIQUE (org_id, domain_type)
);

COMMENT ON TABLE public.org_domains IS
  'Custom domain and subdomain configuration per org. Sprint 114. '
  'Each org has at most one subdomain row and one custom domain row. '
  'Verification required for custom domains before routing activates.';

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_org_domains_org_id
  ON public.org_domains (org_id);

-- CRITICAL: This index powers the hot path in domain-resolver.ts
-- Every request does a hostname lookup — this must be fast.
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_domains_value_verified
  ON public.org_domains (domain_value)
  WHERE verification_status = 'verified';

-- Also index all domain_values for O(1) lookup during verification check
CREATE INDEX IF NOT EXISTS idx_org_domains_domain_value
  ON public.org_domains (domain_value);

-- Index organizations.slug for subdomain routing
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug
  ON public.organizations (slug)
  WHERE slug IS NOT NULL;

-- 4. RLS
ALTER TABLE public.org_domains ENABLE ROW LEVEL SECURITY;

-- Members can read their org's domain config
CREATE POLICY "org_domains: members can read"
  ON public.org_domains FOR SELECT
  USING (org_id = public.current_user_org_id());

-- Only owner can insert/update/delete domain config
CREATE POLICY "org_domains: owner can insert"
  ON public.org_domains FOR INSERT
  WITH CHECK (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id  = public.current_user_org_id()
        AND om.user_id = auth.uid()
        AND om.role    = 'owner'
    )
  );

CREATE POLICY "org_domains: owner can update"
  ON public.org_domains FOR UPDATE
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id  = public.current_user_org_id()
        AND om.user_id = auth.uid()
        AND om.role    = 'owner'
    )
  );

CREATE POLICY "org_domains: owner can delete"
  ON public.org_domains FOR DELETE
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id  = public.current_user_org_id()
        AND om.user_id = auth.uid()
        AND om.role    = 'owner'
    )
  );

-- Service role full access (middleware domain resolution runs as service role)
CREATE POLICY "org_domains: service role full access"
  ON public.org_domains
  USING (auth.role() = 'service_role');

-- 5. Seed subdomain rows for existing orgs
INSERT INTO public.org_domains (org_id, domain_type, domain_value, verification_status, verified_at)
SELECT
  id,
  'subdomain',
  slug || '.localvector.ai',
  'verified',       -- subdomains are auto-verified (we control *.localvector.ai)
  NOW()
FROM public.organizations
WHERE slug IS NOT NULL
ON CONFLICT (org_id, domain_type) DO NOTHING;
```

---

### Component 3: Domain Service — `lib/whitelabel/domain-service.ts`

```typescript
/**
 * Pure domain config service. Caller passes Supabase client.
 *
 * ── getDomainConfig(supabase, orgId) ─────────────────────────────────────────
 * Fetches both the subdomain row and custom domain row for the org.
 * Also fetches org.slug to compute the effective_domain.
 * Returns DomainConfig:
 *   subdomain_domain: OrgDomain | null (the subdomain row)
 *   custom_domain: OrgDomain | null (the custom domain row)
 *   subdomain: string (org.slug — always present after Sprint 114 migration)
 *   effective_domain: computed as:
 *     if custom_domain?.verification_status === 'verified' → custom_domain.domain_value
 *     else → '{org.slug}.localvector.ai'
 *
 * ── upsertCustomDomain(supabase, orgId, customDomainValue) ───────────────────
 * Validates format: must be a valid hostname (no protocol, no path, no port).
 * Validation regex: /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
 * If invalid → throw 'invalid_domain_format'
 * If domain_value already exists on a DIFFERENT org (verified) → throw 'domain_taken'
 * UPSERT into org_domains (org_id, domain_type='custom'):
 *   ON CONFLICT (org_id, domain_type) DO UPDATE SET
 *     domain_value = EXCLUDED.domain_value,
 *     verification_status = 'unverified',  -- reset verification on domain change
 *     verified_at = NULL,
 *     updated_at = NOW()
 * Returns the updated OrgDomain.
 *
 * ── removeCustomDomain(supabase, orgId) ──────────────────────────────────────
 * DELETE FROM org_domains WHERE org_id = $orgId AND domain_type = 'custom'
 * Returns { success: true }
 * No error if custom domain doesn't exist (idempotent).
 *
 * ── updateVerificationStatus(supabase, orgId, result) ────────────────────────
 * Called by the verify endpoint after DNS check.
 * UPDATE org_domains SET
 *   verification_status = result.status,
 *   verified_at = (result.verified ? NOW() : NULL),
 *   last_checked_at = NOW(),
 *   updated_at = NOW()
 * WHERE org_id = $orgId AND domain_type = 'custom'
 * Returns updated OrgDomain.
 *
 * ── generateOrgSlug(orgName) ─────────────────────────────────────────────────
 * Pure function (no DB calls). Used during org creation to generate slug.
 * Steps:
 *   1. Lowercase
 *   2. Replace non-alphanumeric (except hyphens) with hyphens
 *   3. Replace multiple consecutive hyphens with single hyphen
 *   4. Strip leading/trailing hyphens
 *   5. Truncate to MAX_SUBDOMAIN_LENGTH (63) chars
 * Returns string.
 * Called in: org creation flow (wherever new orgs are created — check CLAUDE.md).
 */
```

---

### Component 4: Domain Resolver — `lib/whitelabel/domain-resolver.ts`

```typescript
/**
 * Edge-compatible domain resolver. Used by middleware.ts.
 * Must be compatible with Vercel Edge Runtime:
 *   - NO Node.js built-ins (no fs, no dns, no path)
 *   - NO heavy libraries
 *   - Supabase client must be edge-compatible (@supabase/ssr createServerClient)
 *
 * ── resolveOrgFromHostname(hostname, supabaseClient) ─────────────────────────
 * Given the incoming request hostname, returns OrgContext | null.
 *
 * Resolution order:
 *
 * 1. EXACT MATCH on verified custom domain:
 *    SELECT o.id, o.name, o.plan_tier, o.slug
 *    FROM org_domains od
 *    JOIN organizations o ON o.id = od.org_id
 *    WHERE od.domain_value = $hostname
 *      AND od.domain_type = 'custom'
 *      AND od.verification_status = 'verified'
 *    LIMIT 1
 *    If found → return OrgContext { is_custom_domain: true }
 *
 * 2. SUBDOMAIN MATCH on {slug}.localvector.ai:
 *    Extract slug: if hostname ends with '.localvector.ai',
 *    strip the suffix to get the slug prefix.
 *    SELECT o.id, o.name, o.plan_tier, o.slug
 *    FROM organizations o
 *    WHERE o.slug = $extractedSlug
 *    LIMIT 1
 *    If found → return OrgContext { is_custom_domain: false }
 *
 * 3. DIRECT ACCESS (app.localvector.ai or localhost):
 *    Return null — no org context from hostname.
 *    The existing session-based org resolution handles this.
 *
 * CACHING:
 *   Domain resolution runs on EVERY request — it must be fast.
 *   Use Upstash Redis to cache hostname → OrgContext for 5 minutes.
 *   Cache key: 'domain_ctx:{hostname}'
 *   Cache TTL: 300 seconds
 *   On cache miss: DB lookup, cache result.
 *   On Redis error: fall through to DB lookup silently (never fail the request).
 *   Invalidate cache on: domain save, domain delete, verification status change.
 *   Cache invalidation: DELETE 'domain_ctx:{hostname}' from Redis.
 *   Use the existing lib/redis.ts pattern (AI_RULES §17 — degrade gracefully).
 *
 * PERFORMANCE TARGET:
 *   Cache hit: < 10ms
 *   Cache miss (DB lookup): < 50ms
 *   The index idx_org_domains_value_verified makes the DB lookup O(1).
 *
 * ── extractSubdomain(hostname) ────────────────────────────────────────────────
 * Pure function (no DB, no network).
 * If hostname === 'localhost' || hostname === '127.0.0.1' → return null
 * If hostname ends with '.localvector.ai':
 *   slug = hostname.replace('.localvector.ai', '')
 *   return slug if non-empty, else null
 * Else return null
 */
```

---

### Component 5: DNS Verifier — `lib/whitelabel/dns-verifier.ts`

```typescript
/**
 * Edge-compatible DNS verifier. Uses DNS-over-HTTPS (Cloudflare DoH).
 * NO Node.js dns module — not available in Vercel Edge.
 *
 * ── verifyCustomDomain(domainValue, verificationToken) ───────────────────────
 * Checks that the org has added the required TXT record to their domain.
 *
 * Lookup URL:
 *   https://cloudflare-dns.com/dns-query?name={domainValue}&type=TXT
 * Request headers:
 *   Accept: application/dns-json
 *
 * Parse response:
 *   Look for Answer[].data that equals the verificationToken string.
 *   TXT records are returned with surrounding quotes in the data field
 *   — strip them before comparing: data.replace(/"/g, '').trim()
 *
 * Returns DomainVerificationResult:
 *   { verified: true, status: 'verified', checked_at, error: null }
 *   { verified: false, status: 'failed', checked_at, error: 'TXT record not found' }
 *   { verified: false, status: 'failed', checked_at, error: 'DNS lookup failed: ...' }
 *
 * Timeout: abort the fetch after 5 seconds using AbortController.
 * On timeout → return { verified: false, status: 'failed', error: 'DNS lookup timed out' }
 * Never throw — always return DomainVerificationResult.
 *
 * ── buildVerificationToken(rawToken) ─────────────────────────────────────────
 * Pure function. Returns the full TXT record value:
 * 'localvector-verify=' + rawToken
 * (rawToken is the hex part stored in org_domains.verification_token without prefix)
 */
```

---

### Component 6: Middleware Update — `middleware.ts`

```typescript
/**
 * MODIFY middleware.ts — add domain resolution at the top.
 * AI_RULES §6 says never edit middleware.ts.
 * Sprint 114 is the ONE authorized exception for domain routing.
 *
 * STRATEGY: Minimize the change.
 * Add a single call to resolveOrgFromHostname() at the very top of the
 * middleware handler, BEFORE the existing auth guard logic.
 *
 * What to add:
 *
 * 1. Get hostname from request:
 *    const hostname = request.headers.get('host') ?? request.nextUrl.hostname
 *    // Strip port if present: hostname.split(':')[0]
 *
 * 2. Call resolveOrgFromHostname(hostname, supabaseClient)
 *    Use the edge-compatible Supabase client (createServerClient from @supabase/ssr)
 *    which should already be initialized in middleware for the auth guard.
 *    Reuse it — do not create a second client.
 *
 * 3. If OrgContext returned:
 *    Clone the request with added headers:
 *    headers.set('x-org-id', orgContext.org_id)
 *    headers.set('x-org-name', orgContext.org_name)
 *    headers.set('x-org-plan', orgContext.plan_tier)
 *    headers.set('x-resolved-hostname', orgContext.resolved_hostname)
 *    headers.set('x-is-custom-domain', String(orgContext.is_custom_domain))
 *    Pass the modified request to the next middleware step.
 *
 * 4. If no OrgContext (direct access / localhost):
 *    Continue with existing middleware behavior unchanged.
 *
 * 5. DO NOT change anything about the existing auth guard, session handling,
 *    redirects, or public routes logic. Only prepend the hostname resolution.
 *
 * HEADER READING IN SERVER COMPONENTS:
 * Server components read org context from headers via:
 *   import { headers } from 'next/headers'
 *   const orgId = headers().get('x-org-id')
 *
 * Create a helper: lib/whitelabel/get-org-context-from-headers.ts
 *   export function getOrgContextFromHeaders(): OrgContext | null
 *   Reads x-org-* headers from next/headers.
 *   Returns null if x-org-id is not set.
 */
```

---

### Component 7: API Routes

#### `app/api/whitelabel/domain/route.ts`

```typescript
/**
 * GET /api/whitelabel/domain
 * Returns current DomainConfig for the authenticated user's org.
 * All org members can view.
 * Plan: Agency only — non-Agency returns { domain_config: null, upgrade_required: true }
 *
 * POST /api/whitelabel/domain
 * Saves or updates the custom domain.
 * Body: { custom_domain: string }
 * Owner only. Agency plan only.
 *
 * Validation:
 * 1. custom_domain: valid hostname format (no https://, no paths, no ports)
 * 2. Not a LocalVector subdomain (cannot set custom_domain to 'foo.localvector.ai')
 * 3. Not already verified by another org → 409 'domain_taken'
 *
 * Response on success: { ok: true; domain: OrgDomain; dns_instructions: DnsInstructions }
 *
 * DnsInstructions:
 * {
 *   cname_record: { type: 'CNAME', name: custom_domain, value: 'proxy.localvector.ai' },
 *   txt_record: { type: 'TXT', name: custom_domain, value: verification_token },
 *   instructions: string[]   // ordered steps for non-technical users
 * }
 *
 * Error codes:
 * - 400: invalid_domain_format | localvector_domain_not_allowed
 * - 401: not authenticated
 * - 403: not_owner | plan_upgrade_required
 * - 409: domain_taken
 *
 * DELETE /api/whitelabel/domain
 * Removes the custom domain configuration. Owner only. Agency only.
 * Invalidates Redis cache for the old domain.
 * Response: { ok: true }
 */
```

#### `app/api/whitelabel/domain/verify/route.ts`

```typescript
/**
 * POST /api/whitelabel/domain/verify
 * Triggers a DNS verification check for the org's custom domain.
 * Owner only. Agency only.
 *
 * Flow:
 * 1. Fetch current custom domain config for org
 * 2. If no custom domain → 404 'no_custom_domain'
 * 3. If already verified → return { verified: true, status: 'verified' }
 * 4. Set status to 'pending' in DB (show loading state in UI)
 * 5. Call verifyCustomDomain(domainValue, verificationToken)
 * 6. Call updateVerificationStatus() with result
 * 7. If newly verified → invalidate Redis cache for the domain
 * 8. Return DomainVerificationResult
 *
 * Note: This is a synchronous check (not a webhook). The DNS check
 * takes < 5 seconds. The UI polls or awaits the response directly.
 *
 * Error codes:
 * - 401: not authenticated
 * - 403: not_owner | plan_upgrade_required
 * - 404: no_custom_domain
 */
```

---

### Component 8: Dashboard Settings Page — `app/dashboard/settings/domain/page.tsx`

```typescript
/**
 * Server Component. Fetches DomainConfig server-side.
 * Route: /dashboard/settings/domain
 *
 * Plan gate:
 * - Non-Agency: show upgrade prompt
 *   "Custom domain routing is available on the Agency plan."
 *   [Upgrade to Agency →]
 * - Agency: show full domain configuration UI
 *
 * Layout:
 * ┌───────────────────────────────────────────────────────────┐
 * │  Your Subdomain (Always Active)                           │
 * │  ─────────────────────────────────────────────────────    │
 * │  https://{slug}.localvector.ai                           │
 * │  ✅ Active                                                │
 * │                                                           │
 * │  Custom Domain (Optional)                                 │
 * │  ─────────────────────────────────────────────────────    │
 * │  [ app.yourbrand.com          ] [Save] [Verify] [Remove]  │
 * │                                                           │
 * │  Status: ⚠️ Unverified  [Verify Now →]                   │
 * │                                                           │
 * │  DNS Setup Instructions:                                  │
 * │  1. Log in to your DNS provider                           │
 * │  2. Add a CNAME record:                                   │
 * │     Name: app.yourbrand.com                               │
 * │     Value: proxy.localvector.ai                           │
 * │  3. Add a TXT record for verification:                    │
 * │     Name: app.yourbrand.com                               │
 * │     Value: localvector-verify=abc123...                   │
 * │  4. Click "Verify Now" (may take up to 48 hours for DNS)  │
 * └───────────────────────────────────────────────────────────┘
 *
 * Add to dashboard settings sidebar or nav:
 *   Route: /dashboard/settings/domain
 *   Label: "Domain"
 *   Agency plan badge for non-Agency users
 *
 * data-testid:
 *   "domain-settings-page"
 *   "subdomain-display"
 *   "custom-domain-input"
 *   "save-domain-btn"
 *   "verify-domain-btn"
 *   "remove-domain-btn"
 *   "verification-status-badge"
 *   "dns-instructions"
 *   "upgrade-prompt"
 */
```

---

### Component 9: DomainConfigForm — `app/dashboard/settings/domain/_components/DomainConfigForm.tsx`

```typescript
/**
 * 'use client'
 * Handles the custom domain input, save, verify, and remove actions.
 *
 * State: current custom domain value (from server), editing state, loading state
 *
 * Save flow:
 *   POST /api/whitelabel/domain → on success: show DNS instructions below the form
 *   On error: show inline error message
 *
 * Verify flow:
 *   POST /api/whitelabel/domain/verify
 *   Show loading state: "Checking DNS..."
 *   On verified: show green "✅ Verified" badge, hide DNS instructions
 *   On failed: show "DNS record not found. Check your settings and try again."
 *   On pending: show "Still checking... DNS propagation can take up to 48 hours."
 *
 * Remove flow:
 *   window.confirm("Remove your custom domain? The subdomain will continue to work.")
 *   DELETE /api/whitelabel/domain → on success: clear form, hide DNS instructions
 *
 * data-testid matches parent page spec above.
 */
```

---

### Component 10: DNS Instructions — `app/dashboard/settings/domain/_components/DnsInstructions.tsx`

```typescript
/**
 * Pure display component. No state. No API calls.
 * Props: { cname_record, txt_record, custom_domain: string }
 *
 * Renders two copy-able code blocks:
 * CNAME: Name = {custom_domain} | Value = proxy.localvector.ai
 * TXT:   Name = {custom_domain} | Value = {verification_token}
 *
 * Each block has a [Copy] button that copies the value to clipboard.
 * On copy: button shows "Copied ✅" for 2 seconds.
 *
 * data-testid:
 *   "cname-record-value"
 *   "txt-record-value"
 *   "copy-cname-btn"
 *   "copy-txt-btn"
 */
```

---

### Component 11: OrgContext Header Helper — `lib/whitelabel/get-org-context-from-headers.ts`

```typescript
/**
 * Server-side helper for reading OrgContext from request headers
 * set by middleware.ts domain resolver.
 *
 * import { headers } from 'next/headers'
 *
 * export function getOrgContextFromHeaders(): OrgContext | null {
 *   const h = headers();
 *   const orgId = h.get('x-org-id');
 *   if (!orgId) return null;
 *   return {
 *     org_id: orgId,
 *     org_name: h.get('x-org-name') ?? '',
 *     plan_tier: h.get('x-org-plan') ?? '',
 *     resolved_hostname: h.get('x-resolved-hostname') ?? '',
 *     is_custom_domain: h.get('x-is-custom-domain') === 'true',
 *   };
 * }
 *
 * Usage in any server component:
 *   const orgContext = getOrgContextFromHeaders();
 *   // If null: request came via direct access — use session-based org
 *   // If present: request came via subdomain or custom domain
 *
 * Sprint 115 will use this to load per-org theme settings.
 */
```

---

### Component 12: Seed Data

```sql
-- In supabase/seed.sql — add domain config for golden tenant

DO $$
DECLARE
  v_org_id uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
BEGIN
  -- Ensure golden tenant has a slug
  UPDATE public.organizations
     SET slug = 'charcoal-n-chill'
   WHERE id = v_org_id AND slug IS NULL;

  -- Subdomain row (auto-verified)
  INSERT INTO public.org_domains (
    org_id, domain_type, domain_value,
    verification_status, verified_at
  ) VALUES (
    v_org_id, 'subdomain', 'charcoal-n-chill.localvector.ai',
    'verified', NOW() - INTERVAL '30 days'
  ) ON CONFLICT (org_id, domain_type) DO NOTHING;

  -- Custom domain row (unverified — for testing the unverified state)
  INSERT INTO public.org_domains (
    org_id, domain_type, domain_value,
    verification_token, verification_status
  ) VALUES (
    v_org_id, 'custom', 'app.charcoalnchill.com',
    'localvector-verify=seed1234567890abcdef1234567890ab',
    'unverified'
  ) ON CONFLICT (org_id, domain_type) DO NOTHING;
END $$;
```

---

### Component 13: Golden Tenant Fixtures

```typescript
// Sprint 114 — domain fixtures
import type { OrgDomain, DomainConfig, OrgContext } from '@/lib/whitelabel/types';

export const MOCK_ORG_DOMAIN_SUBDOMAIN: OrgDomain = {
  id: 'domain-sub-001',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  domain_type: 'subdomain',
  domain_value: 'charcoal-n-chill.localvector.ai',
  verification_token: 'localvector-verify=subdomain-auto-verified',
  verification_status: 'verified',
  verified_at: '2026-01-01T00:00:00.000Z',
  last_checked_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

export const MOCK_ORG_DOMAIN_CUSTOM_UNVERIFIED: OrgDomain = {
  id: 'domain-cust-001',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  domain_type: 'custom',
  domain_value: 'app.charcoalnchill.com',
  verification_token: 'localvector-verify=seed1234567890abcdef1234567890ab',
  verification_status: 'unverified',
  verified_at: null,
  last_checked_at: null,
  created_at: '2026-03-01T00:00:00.000Z',
  updated_at: '2026-03-01T00:00:00.000Z',
};

export const MOCK_ORG_DOMAIN_CUSTOM_VERIFIED: OrgDomain = {
  ...MOCK_ORG_DOMAIN_CUSTOM_UNVERIFIED,
  verification_status: 'verified',
  verified_at: '2026-03-01T12:00:00.000Z',
  last_checked_at: '2026-03-01T12:00:00.000Z',
};

export const MOCK_DOMAIN_CONFIG_UNVERIFIED: DomainConfig = {
  effective_domain: 'charcoal-n-chill.localvector.ai',
  subdomain: 'charcoal-n-chill',
  custom_domain: MOCK_ORG_DOMAIN_CUSTOM_UNVERIFIED,
  subdomain_domain: MOCK_ORG_DOMAIN_SUBDOMAIN,
};

export const MOCK_DOMAIN_CONFIG_VERIFIED: DomainConfig = {
  effective_domain: 'app.charcoalnchill.com',
  subdomain: 'charcoal-n-chill',
  custom_domain: MOCK_ORG_DOMAIN_CUSTOM_VERIFIED,
  subdomain_domain: MOCK_ORG_DOMAIN_SUBDOMAIN,
};

export const MOCK_ORG_CONTEXT_SUBDOMAIN: OrgContext = {
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_name: 'Charcoal N Chill',
  plan_tier: 'agency',
  resolved_hostname: 'charcoal-n-chill.localvector.ai',
  is_custom_domain: false,
};

export const MOCK_ORG_CONTEXT_CUSTOM: OrgContext = {
  ...MOCK_ORG_CONTEXT_SUBDOMAIN,
  resolved_hostname: 'app.charcoalnchill.com',
  is_custom_domain: true,
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/domain-service.test.ts`

**Supabase mocked. Pure functions zero mocks.**

```
describe('generateOrgSlug — pure')
  1.  'Charcoal N Chill' → 'charcoal-n-chill'
  2.  'Aruna\'s Café & Bar' → 'arunas-caf-bar' (special chars stripped)
  3.  'My   Business' (multiple spaces) → 'my-business'
  4.  'A' * 70 chars → truncated to 63 chars
  5.  leading/trailing hyphens stripped
  6.  existing hyphens preserved: 'my-brand-co' → 'my-brand-co'

describe('getDomainConfig — Supabase mocked')
  7.  returns subdomain and custom domain rows when both exist
  8.  effective_domain = custom domain when custom is verified
  9.  effective_domain = subdomain when custom is unverified
  10. effective_domain = subdomain when custom domain is null
  11. returns null custom_domain when only subdomain row exists

describe('upsertCustomDomain — Supabase mocked')
  12. throws 'invalid_domain_format' for 'notadomain'
  13. throws 'invalid_domain_format' for 'https://example.com'
  14. throws 'invalid_domain_format' for 'example.com/path'
  15. throws 'domain_taken' when domain verified by another org
  16. resets verification_status to 'unverified' on domain change
  17. returns OrgDomain on success

describe('removeCustomDomain — Supabase mocked')
  18. calls DELETE on org_domains for custom type
  19. returns { success: true } when no custom domain exists (idempotent)

describe('updateVerificationStatus — Supabase mocked')
  20. sets verified_at when result.verified = true
  21. sets verified_at = NULL when result.verified = false
  22. always updates last_checked_at
```

**22 tests.**

---

### Test File 2: `src/__tests__/unit/domain-resolver.test.ts`

**Supabase and Redis mocked. Pure functions zero mocks.**

```
describe('extractSubdomain — pure')
  1.  'charcoal-n-chill.localvector.ai' → 'charcoal-n-chill'
  2.  'localvector.ai' → null (no subdomain)
  3.  'localhost' → null
  4.  '127.0.0.1' → null
  5.  'app.theirbrand.com' → null (not a localvector.ai subdomain)
  6.  'app.localvector.ai:3000' (with port stripped) → 'app'

describe('resolveOrgFromHostname — Supabase + Redis mocked')
  7.  returns cached OrgContext on cache hit (no DB call)
  8.  queries DB on cache miss and caches result
  9.  returns OrgContext with is_custom_domain=true for verified custom domain
  10. returns OrgContext with is_custom_domain=false for subdomain match
  11. returns null for direct access hostname (app.localvector.ai)
  12. returns null for localhost
  13. falls through to DB on Redis error (no crash)
  14. handles DB returning no rows (returns null gracefully)
```

**14 tests.**

---

### Test File 3: `src/__tests__/unit/dns-verifier.test.ts`

**fetch mocked. Pure functions zero mocks.**

```
describe('verifyCustomDomain — fetch mocked')
  1.  returns { verified: true } when TXT record matches
  2.  returns { verified: false, error: 'TXT record not found' } when no matching record
  3.  handles TXT record with surrounding quotes (strips them before compare)
  4.  returns { verified: false, error: 'DNS lookup timed out' } on timeout
  5.  returns { verified: false, error: 'DNS lookup failed: ...' } on fetch error
  6.  always returns DomainVerificationResult — never throws

describe('buildVerificationToken — pure')
  7.  prepends 'localvector-verify=' to raw token
  8.  handles empty string input gracefully
```

**8 tests.**

---

### Test File 4: `src/__tests__/unit/domain-routes.test.ts`

```
describe('GET /api/whitelabel/domain')
  1.  returns 401 when not authenticated
  2.  returns { domain_config: null, upgrade_required: true } for non-Agency plan
  3.  returns DomainConfig for Agency plan member

describe('POST /api/whitelabel/domain')
  4.  returns 401 when not authenticated
  5.  returns 403 'plan_upgrade_required' for non-Agency plan
  6.  returns 403 'not_owner' for admin/analyst/viewer
  7.  returns 400 'invalid_domain_format' for bad domain
  8.  returns 400 'localvector_domain_not_allowed' for *.localvector.ai domain
  9.  returns 409 'domain_taken' when domain is verified by another org
  10. returns { ok: true, domain, dns_instructions } on success
  11. dns_instructions contains cname_record and txt_record

describe('DELETE /api/whitelabel/domain')
  12. returns 401 when not authenticated
  13. returns 403 for non-owner
  14. returns { ok: true } on success
  15. invalidates Redis cache for removed domain

describe('POST /api/whitelabel/domain/verify')
  16. returns 401 when not authenticated
  17. returns 404 'no_custom_domain' when no custom domain configured
  18. returns DomainVerificationResult with verified=true on DNS match
  19. returns DomainVerificationResult with verified=false on no DNS match
  20. sets status='pending' in DB before DNS check
  21. invalidates Redis cache when domain becomes verified
```

**21 tests.**

---

### Test File 5: `src/__tests__/e2e/domain-settings.spec.ts` — Playwright

```typescript
describe('Domain Settings', () => {

  test('Agency plan: shows subdomain and custom domain sections', async ({ page }) => {
    // Mock GET /api/whitelabel/domain → MOCK_DOMAIN_CONFIG_UNVERIFIED
    // Navigate to /dashboard/settings/domain
    // Assert: data-testid="domain-settings-page" visible
    // Assert: data-testid="subdomain-display" shows 'charcoal-n-chill.localvector.ai'
    // Assert: data-testid="custom-domain-input" shows 'app.charcoalnchill.com'
    // Assert: data-testid="verification-status-badge" shows 'Unverified'
    // Assert: data-testid="dns-instructions" visible
  });

  test('Non-Agency plan: shows upgrade prompt', async ({ page }) => {
    // Mock plan = 'growth'
    // Navigate to /dashboard/settings/domain
    // Assert: data-testid="upgrade-prompt" visible
    // Assert: custom-domain-input NOT visible
  });

  test('Save domain: shows DNS instructions after save', async ({ page }) => {
    // Clear input, type 'app.newbrand.com'
    // Mock POST /api/whitelabel/domain → { ok: true, domain: {...}, dns_instructions: {...} }
    // Click save-domain-btn
    // Assert: dns-instructions visible
    // Assert: cname-record-value shows 'proxy.localvector.ai'
    // Assert: txt-record-value shows verification token
  });

  test('Copy button: copies CNAME value to clipboard', async ({ page }) => {
    // Click copy-cname-btn
    // Assert: button text changes to 'Copied ✅'
  });

  test('Verify domain: shows verified state on success', async ({ page }) => {
    // Mock POST /api/whitelabel/domain/verify → { verified: true, status: 'verified' }
    // Click verify-domain-btn
    // Assert: loading text 'Checking DNS...' appears
    // Assert: verification-status-badge shows '✅ Verified'
    // Assert: dns-instructions hidden after verification
  });

  test('Verify domain: shows failed state on DNS miss', async ({ page }) => {
    // Mock POST /api/whitelabel/domain/verify → { verified: false, status: 'failed' }
    // Click verify-domain-btn
    // Assert: error message about DNS record not found visible
  });

  test('Remove domain: clears form after removal', async ({ page }) => {
    // Mock DELETE /api/whitelabel/domain → { ok: true }
    // Click remove-domain-btn
    // Accept window.confirm
    // Assert: custom-domain-input is empty
    // Assert: dns-instructions hidden
  });
});
```

**7 Playwright tests.**

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/domain-service.test.ts    # 22 tests
npx vitest run src/__tests__/unit/domain-resolver.test.ts   # 14 tests
npx vitest run src/__tests__/unit/dns-verifier.test.ts      # 8 tests
npx vitest run src/__tests__/unit/domain-routes.test.ts     # 21 tests
npx vitest run                                               # ALL — zero regressions
npx playwright test src/__tests__/e2e/domain-settings.spec.ts  # 7 Playwright tests
npx tsc --noEmit                                             # 0 type errors
```

**Total: 65 Vitest + 7 Playwright = 72 tests**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/whitelabel/types.ts` | **CREATE** | All domain + OrgContext types |
| 2 | `lib/whitelabel/domain-service.ts` | **CREATE** | DB operations for domain config |
| 3 | `lib/whitelabel/domain-resolver.ts` | **CREATE** | Edge-compatible hostname → org lookup |
| 4 | `lib/whitelabel/dns-verifier.ts` | **CREATE** | DNS-over-HTTPS verification |
| 5 | `lib/whitelabel/get-org-context-from-headers.ts` | **CREATE** | Header reader for server components |
| 6 | `lib/whitelabel/index.ts` | **CREATE** | Barrel export |
| 7 | `middleware.ts` | **MODIFY** | Add hostname resolution at top (minimum change) |
| 8 | `app/api/whitelabel/domain/route.ts` | **CREATE** | GET + POST + DELETE |
| 9 | `app/api/whitelabel/domain/verify/route.ts` | **CREATE** | POST verify |
| 10 | `app/dashboard/settings/domain/page.tsx` | **CREATE** | Domain settings page |
| 11 | `app/dashboard/settings/domain/_components/DomainConfigForm.tsx` | **CREATE** | Domain form |
| 12 | `app/dashboard/settings/domain/_components/DnsInstructions.tsx` | **CREATE** | DNS setup guide |
| 13 | `app/dashboard/settings/domain/_components/VerificationStatus.tsx` | **CREATE** | Status badge |
| 14 | `supabase/migrations/[timestamp]_org_domains.sql` | **CREATE** | Full migration |
| 15 | `supabase/prod_schema.sql` | **MODIFY** | Append org_domains + slug column |
| 16 | `lib/supabase/database.types.ts` | **MODIFY** | Add org_domains types |
| 17 | `supabase/seed.sql` | **MODIFY** | Domain rows for golden tenant |
| 18 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | 6 domain fixtures |
| 19 | `src/__tests__/unit/domain-service.test.ts` | **CREATE** | 22 tests |
| 20 | `src/__tests__/unit/domain-resolver.test.ts` | **CREATE** | 14 tests |
| 21 | `src/__tests__/unit/dns-verifier.test.ts` | **CREATE** | 8 tests |
| 22 | `src/__tests__/unit/domain-routes.test.ts` | **CREATE** | 21 tests |
| 23 | `src/__tests__/e2e/domain-settings.spec.ts` | **CREATE** | 7 Playwright tests |

**Total: 23 files**

---

## 🚫 What NOT to Do

1. **DO NOT use the Node.js `dns` module** — it is not available in Vercel Edge Runtime. Use DNS-over-HTTPS via `fetch()` to `cloudflare-dns.com/dns-query` exclusively.

2. **DO NOT call the Vercel API programmatically** — custom domain activation in production requires adding the domain in the Vercel dashboard manually. Document this in the DNS instructions UI. Do not attempt to automate Vercel domain provisioning in Sprint 114.

3. **DO NOT add heavy libraries to domain-resolver.ts** — it runs on every request in the Edge Runtime. Keep imports minimal. Use only `@supabase/ssr` and `lib/redis.ts`.

4. **DO NOT make domain resolution block the request** — if Redis is unavailable and the DB lookup fails, log the error and continue. Return null OrgContext. The request proceeds with session-based org resolution. Never 500 due to domain resolution failure.

5. **DO NOT write to `middleware.ts` beyond the hostname resolution addition** — read AI_RULES §6. This sprint has explicit authorization to add ONE thing: the hostname resolution call at the top. Everything else in middleware stays identical.

6. **DO NOT skip the Redis cache for domain resolution** — without caching, every page request makes a DB round-trip. The `idx_org_domains_value_verified` index makes DB lookups fast, but Redis cache (5 min TTL) eliminates them entirely for hot paths.

7. **DO NOT allow setting a custom domain to `*.localvector.ai`** — the API must reject this with `400 'localvector_domain_not_allowed'`. Users cannot claim a LocalVector subdomain as their custom domain.

8. **DO NOT auto-verify custom domains** — only subdomains (`*.localvector.ai`) are auto-verified (we control the wildcard DNS). Custom domains require the org to add DNS records and pass the TXT verification check.

9. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).

10. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).

11. **DO NOT use `page.waitForTimeout()` in Playwright** — event-driven waits only.

---

## ✅ Definition of Done

- [ ] `lib/whitelabel/types.ts` — DomainType, VerificationStatus (4 values), OrgDomain, DomainConfig, OrgContext, DomainVerificationResult, VERIFICATION_TXT_PREFIX, SUBDOMAIN_BASE, MAX_SUBDOMAIN_LENGTH
- [ ] `domain-service.ts` — generateOrgSlug() (pure), getDomainConfig() (effective_domain logic correct), upsertCustomDomain() (3 validation guards), removeCustomDomain() (idempotent), updateVerificationStatus()
- [ ] `domain-resolver.ts` — extractSubdomain() (pure), resolveOrgFromHostname() (2-step resolution, Redis cache with 300s TTL, graceful fallback)
- [ ] `dns-verifier.ts` — verifyCustomDomain() (Cloudflare DoH, 5s timeout, never throws), buildVerificationToken() (pure)
- [ ] `get-org-context-from-headers.ts` — reads 5 x-org-* headers, returns OrgContext | null
- [ ] `middleware.ts` MODIFIED — hostname resolution prepended, 5 x-org-* headers set, existing logic unchanged
- [ ] `GET /api/whitelabel/domain` — all members, Agency upgrade prompt for non-Agency
- [ ] `POST /api/whitelabel/domain` — owner + Agency, 4 validation guards, returns dns_instructions
- [ ] `DELETE /api/whitelabel/domain` — owner + Agency, invalidates Redis cache
- [ ] `POST /api/whitelabel/domain/verify` — sets pending → calls DNS check → updates status → invalidates cache on verify
- [ ] Domain settings page — 2 sections (subdomain always-active, custom domain optional), plan gate, all data-testid
- [ ] `DomainConfigForm` — save/verify/remove flows with correct loading + error states
- [ ] `DnsInstructions` — CNAME + TXT copy blocks, clipboard copy button
- [ ] `VerificationStatus` — 4 status states (unverified/pending/verified/failed) with correct visual treatment
- [ ] Migration: org_domains table (UNIQUE (org_id, domain_type)), slug column on organizations, backfill slugs, seed subdomain rows for existing orgs
- [ ] prod_schema.sql updated
- [ ] database.types.ts updated
- [ ] seed.sql: subdomain + custom domain rows for golden tenant
- [ ] golden-tenant.ts: 6 domain fixtures
- [ ] `npx vitest run src/__tests__/unit/domain-service.test.ts` — **22 tests passing**
- [ ] `npx vitest run src/__tests__/unit/domain-resolver.test.ts` — **14 tests passing**
- [ ] `npx vitest run src/__tests__/unit/dns-verifier.test.ts` — **8 tests passing**
- [ ] `npx vitest run src/__tests__/unit/domain-routes.test.ts` — **21 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/domain-settings.spec.ts` — **7 tests passing**
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] DEVLOG.md entry written
- [ ] AI_RULES Rule 52 written
- [ ] roadmap.md Sprint 114 marked ✅

---

## ⚠️ Edge Cases

1. **Slug collision during backfill** — two orgs with the same name produce the same slug. The migration handles this with a second UPDATE pass that appends the first 7 chars of the org UUID. The result is slightly ugly but unique.

2. **DNS propagation delay** — org saves domain and immediately clicks Verify. DNS hasn't propagated yet. Return `{ verified: false, status: 'failed', error: 'TXT record not found' }`. UI shows "DNS propagation can take up to 48 hours. Try again later." Do not return 'pending' for a DNS miss — 'pending' is only the transient state set immediately before the check runs.

3. **Org changes custom domain (replaces existing)** — `upsertCustomDomain()` resets `verification_status` to `'unverified'` and clears `verified_at`. The old domain's Redis cache entry is invalidated. The new domain starts fresh verification.

4. **Two orgs claim the same custom domain** — the second org to call `POST /api/whitelabel/domain` gets `409 'domain_taken'` because `idx_org_domains_value_verified` prevents duplicate verified domains. If neither is verified yet, the first to complete DNS verification wins. The second org's verify call will succeed DB-side but their DNS check will pass if they actually own the domain. Race condition is theoretical — domains are owned by one entity.

5. **Request hostname includes port** — `request.headers.get('host')` returns `localhost:3000` in dev. Strip the port before lookup: `hostname.split(':')[0]`. Edge cases: IPv6 addresses (extremely unlikely in this context — ignore).

6. **Subdomain request for non-existent slug** — `resolveOrgFromHostname()` returns null. Request proceeds with no OrgContext. If the user has a valid session, they land on their dashboard. If not, they get the login page. Do not 404 on unknown subdomains — the auth flow handles it.

7. **`getOrgContextFromHeaders()` called in a non-middleware context** — returns null (no headers set). All callers must handle null gracefully and fall back to session-based org resolution.

---

## 🔮 AI_RULES Update (Add Rule 52)

```markdown
## 52. 🌐 White-Label Domain Routing in `lib/whitelabel/` (Sprint 114)

* **Edge-only:** domain-resolver.ts runs in Vercel Edge Runtime. NO Node.js built-ins.
  Use fetch() for DNS-over-HTTPS. Use @supabase/ssr for DB. Use lib/redis.ts for cache.
* **Cache every domain resolution:** Redis TTL = 300s. Key: 'domain_ctx:{hostname}'.
  Invalidate on domain save, delete, and verification status change.
  Graceful degradation if Redis unavailable (AI_RULES §17).
* **middleware.ts addition:** ONLY the hostname resolution block. No other changes.
  5 headers set: x-org-id, x-org-name, x-org-plan, x-resolved-hostname,
  x-is-custom-domain. Read via getOrgContextFromHeaders() in server components.
* **No Vercel API calls:** Custom domain activation requires Vercel dashboard.
  Document this in the DNS instructions UI. Never automate Vercel domain provisioning.
* **Verification is TXT-based:** DNS-over-HTTPS to cloudflare-dns.com/dns-query.
  Token format: 'localvector-verify={hex}'. Strip quotes from TXT data before compare.
  5-second timeout. Never throw. Always return DomainVerificationResult.
* **Subdomains auto-verified:** *.localvector.ai is under our control. Insert with
  verification_status='verified'. Custom domains require explicit org verification.
* **generateOrgSlug() called on org creation:** Wire it into the org creation flow
  (wherever new organizations are created — check CLAUDE.md).
```

---

## 🗺️ What Comes Next

**Sprint 115 — White-Label: Theming + Emails:** Brand theming (logo/colors/fonts stored per-org), theme applied via OrgContext from headers (Sprint 114 infrastructure), white-labeled email templates using org branding, custom login page, "powered by LocalVector" toggle.
