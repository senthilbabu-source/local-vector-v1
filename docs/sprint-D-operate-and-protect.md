# Sprint D — Operate & Protect: Admin Dashboard, Credit System, Revenue Defaults & Positioning

> **Claude Code Prompt — Bulletproof Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisites:** Sprints A, B, and C must be fully merged and all their tests passing before starting Sprint D.

---

## 🎯 Objective

Sprint D is the pre-acquisition sprint. Sprints A–C made the product trustworthy for customers. Sprint D makes it operable and financially safe for **you** as the operator. Without this sprint, active customer acquisition is a liability: you'd have no visibility into who's paying, what they're costing you, or when the product is breaking for them.

1. **L1 — Admin Operations Dashboard** — No operator-facing dashboard exists. You cannot see your customers, their plan, their MRR contribution, their last login, or how much their scans cost in Perplexity/OpenAI API calls. This sprint builds a minimal but complete `/admin` section: Customer List, API Usage Summary, Cron Health, and Revenue Summary. Protected by `ADMIN_EMAILS` env var — no auth system changes required.

2. **N1 — Credit/Usage System** — Any user on any plan can click "Run Analysis," "Generate Brief," and "Re-audit" unlimited times. Each click triggers real Perplexity and OpenAI API calls. An aggressive agency customer with 10 locations and 10 competitors can silently incur $50–100 in a single session. Before you bring customers in at scale, this must be capped. This sprint implements: a DB credits table, server-side enforcement middleware, a credits meter in the TopBar, and per-plan monthly limits with auto-refill.

3. **M4 — Restaurant-Specific Revenue Config Defaults** — The Revenue Impact form uses generic defaults. A restaurant owner opening it for the first time sees placeholder numbers that don't reflect their business. This sprint audits and replaces the `DEFAULT_CONFIG` with restaurant-appropriate values (avg check $55, 60 covers/night, 1.4× weekend multiplier) and adds a Charcoal N Chill golden tenant fixture for revenue config tests.

4. **M6 — AI vs. Traditional SEO Positioning Banner** — Paying customers who also use Yext or BrightLocal look at the dashboard and wonder "what does this add that my other tools don't?" There is no in-product answer. This sprint adds a one-time dismissible banner for new users that clearly articulates the differentiation.

**Why this sprint fourth:** You are about to actively acquire customers. L1 gives you operational visibility the moment the first paying customer signs up. N1 caps your per-customer API cost exposure before a single aggressive user can cause a billing surprise. M4 and M6 are 1–2 hour fixes each that meaningfully improve the first impression of two important surfaces.

**Estimated total implementation time:** 30–40 hours. The admin dashboard (L1) is the heaviest component at 15–20 hours. The credits system (N1) is 10–12 hours. M4 and M6 together are under 3 hours.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                                  — All engineering rules (now includes Rules 42–49 from Sprints A–C)
Read CLAUDE.md                                                         — Full implementation inventory (Sprints A–C artifacts listed)
Read MEMORY.md                                                         — All architecture decisions from Sprints A–C
Read supabase/prod_schema.sql                                          — Canonical schema — read fully before writing any migration
Read lib/supabase/database.types.ts                                    — TypeScript DB types
Read src/__fixtures__/golden-tenant.ts                                 — Golden tenant fixtures

--- L1: Admin Dashboard ---
Read middleware.ts  (do NOT modify — read only for auth patterns)      — How auth currently works
Read proxy.ts                                                          — Where middleware logic actually lives (AI_RULES §6)
Read lib/supabase/server.ts                                            — createClient() vs createServiceRoleClient()
Read lib/plan-enforcer.ts                                              — Understand how plan checking works
Read app/api/cron/sov/route.ts                                         — Pattern for how cron results are logged
Read supabase/migrations/20260226000008_cron_run_log.sql               — cron_run_log table schema (exists from earlier work)
Read app/dashboard/billing/page.tsx                                    — Existing Stripe integration patterns
Read lib/stripe/                                                       — Existing Stripe helpers
Read .env.example  (or equivalent)                                     — All env var names in use

--- N1: Credits System ---
Read app/dashboard/_components/TopBar.tsx  (or equivalent)            — Where the credits meter will appear
Read app/api/cron/sov/route.ts                                         — Example expensive operation (how to intercept before execution)
Read app/dashboard/magic-menus/actions.ts                              — Example server action to credit-gate
Read app/dashboard/share-of-voice/actions.ts                           — Example server action to credit-gate
Read app/dashboard/compete/_components/AddCompetitorForm.tsx           — Example client-side expensive trigger
Read app/dashboard/alerts/_components/CorrectionPanel.tsx             — Correction brief generation (expensive)
Read lib/plan-enforcer.ts                                              — Understand checkPlan pattern; credit limits follow same structure
Read lib/plan-display-names.ts                                         — Sprint A artifact — use getPlanDisplayName() in TopBar

--- M4: Revenue Defaults ---
Read app/dashboard/revenue-impact/_components/RevenueConfigForm.tsx   — Current form fields and DEFAULT_CONFIG
Read lib/services/revenue-leak.service.ts                             — Where DEFAULT_CONFIG is used in calculations
Read src/__fixtures__/golden-tenant.ts                                 — Existing golden tenant data (add revenue fixture here)

--- M6: Positioning Banner ---
Read app/dashboard/page.tsx                                            — Where the banner will appear (Sprint B's SampleModeBanner is the reference pattern)
Read components/ui/SampleModeBanner.tsx                                — Sprint B artifact: use as reference implementation pattern
Read lib/supabase/database.types.ts                                    — Check if orgs has a dismissed_banners column or similar
```

**Specifically understand before writing code:**

- **Admin route protection strategy:** There is no existing `/admin` route. The protection must happen at the route level — a server component check at the top of every admin page that reads `ADMIN_EMAILS` from env and redirects non-admin users to `/dashboard`. Do NOT use `middleware.ts` for this (AI_RULES §6) — do it in each admin page's server component or a shared admin layout.

- **Credits system scope:** "Expensive operations" are manual triggers that fire LLM API calls. Automated cron runs (SOV scan, weekly digest) do NOT consume credits — they run on schedule regardless. Credits gate only user-initiated actions: "Run Analysis," "Generate Brief," "Re-audit," "Add Competitor" (if it triggers an initial scan). Read each targeted server action to confirm which ones trigger API calls.

- **`api_credits` table vs. column on `orgs`:** A separate `api_credits` table is correct (supports per-month reset, audit trail). Check `prod_schema.sql` — it almost certainly doesn't exist yet. You will create it.

- **Revenue config field names:** Read `RevenueConfigForm.tsx` to discover the exact field names before writing `DEFAULT_CONFIG` values. The report gives example values; the form may use different keys.

- **M6 banner persistence:** The positioning banner should show once per user session, or once ever (dismissed permanently). Use `localStorage` for permanent dismissal (unlike Sprint B's `SampleModeBanner` which used `sessionStorage`). The banner is for new users only — define "new" as org created in the last 30 days.

---

## 🏗️ Architecture — What to Build

---

### Component 1: Admin Operations Dashboard — `app/admin/`

The admin dashboard is a completely separate section of the app. It lives at `/admin`, not inside `/dashboard`. It shares the same Supabase connection but has no overlap with the customer-facing dashboard layout.

#### Step 1: Admin layout and authentication guard

**Create `app/admin/layout.tsx`:**

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Admin layout — server component.
 * Protects all /admin/* routes.
 * ADMIN_EMAILS is a comma-separated list of email addresses in env.
 * Example: ADMIN_EMAILS="aruna@charcoalnchill.com"
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) {
    // Not an admin — send to their customer dashboard
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
```

**Create `app/admin/_components/AdminNav.tsx`:**

A minimal top navigation bar for the admin section. Not the customer sidebar.

```tsx
// Links: Dashboard (back to /dashboard) | Customers | API Usage | Cron Health | Revenue
// Show the logged-in admin email in the top right.
// Style: simple, functional — not the marketing brand style.
```

**`.env.example` update:** Add `ADMIN_EMAILS=` to the example file. Document that this is a comma-separated list.

#### Step 2: Admin index page — `app/admin/page.tsx`

Redirect to `/admin/customers` (the most useful first view):

```typescript
import { redirect } from 'next/navigation';
export default function AdminPage() {
  redirect('/admin/customers');
}
```

#### Step 3: Customer List — `app/admin/customers/page.tsx`

The most critical admin view. Shows every org, their plan, MRR contribution, last login, and Reality Score.

**Data to fetch (all via `createServiceRoleClient()` — admin bypasses RLS):**

```typescript
// Fetch all orgs with their plan and creation date:
const { data: orgs } = await supabaseAdmin
  .from('orgs')
  .select(`
    id,
    name,
    plan,
    created_at,
    stripe_customer_id,
    stripe_price_id,
    last_scan_at
  `)
  .order('created_at', { ascending: false });

// Fetch the most recent auth user per org for last_login:
// Strategy: join orgs to auth.users via org_members or users table
// Read prod_schema.sql to find how users are linked to orgs (org_members table? users.org_id?)
// Adjust this query to match the actual schema.

// Fetch the most recent reality_score per org:
const { data: scores } = await supabaseAdmin
  .from('ai_scores')  // adjust table name to match actual schema
  .select('org_id, reality_score, created_at')
  .order('created_at', { ascending: false });
// Deduplicate to latest per org in TypeScript (or use a .limit(1) per org)
```

**MRR calculation:**

```typescript
const PLAN_MRR: Record<string, number> = {
  trial:   0,
  starter: 29,
  growth:  59,
  agency:  0,   // custom — fetch from Stripe if stripe_price_id is set
};

function calculateMRR(plan: string, stripeAmount?: number | null): number {
  if (plan === 'agency' && stripeAmount) return stripeAmount;
  return PLAN_MRR[plan] ?? 0;
}
```

**Customer list table UI:**

```tsx
<table className="w-full text-sm" data-testid="admin-customer-table">
  <thead>
    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <th className="px-4 py-3">Organization</th>
      <th className="px-4 py-3">Plan</th>
      <th className="px-4 py-3">MRR</th>
      <th className="px-4 py-3">Reality Score</th>
      <th className="px-4 py-3">Last Scan</th>
      <th className="px-4 py-3">Last Login</th>
      <th className="px-4 py-3">Created</th>
    </tr>
  </thead>
  <tbody>
    {orgs.map((org) => (
      <tr key={org.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
        <td className="px-4 py-3 font-medium text-foreground">{org.name ?? 'Unnamed'}</td>
        <td className="px-4 py-3">
          <PlanBadge plan={org.plan} />
        </td>
        <td className="px-4 py-3 tabular-nums">${calculateMRR(org.plan)}/mo</td>
        <td className="px-4 py-3 tabular-nums">
          {orgScores[org.id] ?? <span className="text-muted-foreground">—</span>}
        </td>
        <td className="px-4 py-3 text-muted-foreground text-xs">
          {org.last_scan_at ? formatRelativeDate(org.last_scan_at) : '—'}
        </td>
        <td className="px-4 py-3 text-muted-foreground text-xs">
          {orgLastLogins[org.id] ?? '—'}
        </td>
        <td className="px-4 py-3 text-muted-foreground text-xs">
          {formatRelativeDate(org.created_at)}
        </td>
      </tr>
    ))}
  </tbody>
</table>

// Summary row below the table:
<div className="mt-4 flex gap-8 text-sm">
  <div>
    <span className="text-muted-foreground">Total customers:</span>
    <span className="ml-2 font-semibold">{orgs.length}</span>
  </div>
  <div>
    <span className="text-muted-foreground">MRR:</span>
    <span className="ml-2 font-semibold text-emerald-600">${totalMRR}/mo</span>
  </div>
  <div>
    <span className="text-muted-foreground">Active trials:</span>
    <span className="ml-2 font-semibold">{trialCount}</span>
  </div>
</div>
```

**Create `app/admin/_components/PlanBadge.tsx`:** A small colored badge for plan names. Use `getPlanDisplayName()` from Sprint A.

**Create `lib/admin/format-relative-date.ts`:** A utility that formats ISO timestamps to "3 days ago," "just now," "2 weeks ago" etc. Use `Intl.RelativeTimeFormat` — do not install a date library.

#### Step 4: API Usage Summary — `app/admin/api-usage/page.tsx`

Shows per-org API credit consumption. Depends on the `api_credits` table from N1 — implement this page after N1's DB migration is in place.

```typescript
// Fetch credit usage per org:
const { data: creditUsage } = await supabaseAdmin
  .from('api_credits')
  .select('org_id, credits_used, credits_limit, reset_date, plan')
  .order('credits_used', { ascending: false });
```

**API Usage table columns:** Organization · Plan · Credits Used · Credits Limit · % Used · Reset Date

**Highlight at-risk orgs:** Any org at > 80% of their monthly credit limit gets a yellow warning row. Any org at 100% (hard-capped) gets a red row.

```tsx
// Row highlight logic:
const usagePercent = (row.credits_used / row.credits_limit) * 100;
const rowClass = usagePercent >= 100
  ? 'bg-red-50 border-red-200'
  : usagePercent >= 80
  ? 'bg-amber-50 border-amber-200'
  : '';
```

**Summary stats at top of page:**

```tsx
<div className="grid grid-cols-4 gap-4 mb-8">
  <AdminStatCard label="Total API calls this month" value={totalCreditsUsed} />
  <AdminStatCard label="Orgs at >80% usage" value={nearLimitCount} highlight="warning" />
  <AdminStatCard label="Orgs hard-capped (100%)" value={cappedCount} highlight="danger" />
  <AdminStatCard label="Estimated API cost" value={`$${estimatedCost}`} />
</div>
```

**Estimated API cost calculation:** Use rough estimates — these are for operator awareness, not invoicing.

```typescript
// Rough cost per credit (adjust based on actual API pricing):
const ESTIMATED_COST_PER_CREDIT = 0.02;  // ~$0.02 per manual API trigger (Perplexity + OpenAI blended)
const estimatedCost = (totalCreditsUsed * ESTIMATED_COST_PER_CREDIT).toFixed(2);
```

Document this estimate in a code comment: "Blended estimate of Perplexity + OpenAI cost per manual trigger. Update ESTIMATED_COST_PER_CREDIT as actual cost data becomes available."

#### Step 5: Cron Health — `app/admin/cron-health/page.tsx`

Reads from `cron_run_log` (created in Sprint A/C) to show the health of all scheduled jobs across all orgs.

```typescript
// Fetch last 100 cron runs, all crons, all orgs:
const { data: cronRuns } = await supabaseAdmin
  .from('cron_run_log')
  .select('id, cron_name, org_id, status, started_at, completed_at, duration_ms, orgs_processed, error_message')
  .order('started_at', { ascending: false })
  .limit(100);
```

**Cron health summary cards at top:**

```tsx
// One card per cron name: last run time, last status, success rate (last 10 runs)
const cronNames = [...new Set(cronRuns.map((r) => r.cron_name))];

{cronNames.map((cron) => {
  const runs = cronRuns.filter((r) => r.cron_name === cron);
  const lastRun = runs[0];
  const last10 = runs.slice(0, 10);
  const successRate = Math.round((last10.filter((r) => r.status === 'success').length / last10.length) * 100);

  return (
    <div key={cron} className="rounded-lg border border-border p-4" data-testid="cron-health-card">
      <p className="text-sm font-semibold">{cron}</p>
      <p className="text-xs text-muted-foreground mt-1">
        Last run: {formatRelativeDate(lastRun.started_at)}
      </p>
      <div className="flex items-center gap-2 mt-2">
        <StatusDot status={lastRun.status} />
        <span className="text-xs">{successRate}% success (last 10)</span>
      </div>
    </div>
  );
})}
```

**Cron run log table below the summary:** All 100 runs, sortable. Columns: Cron Name · Org ID · Status · Duration · Orgs Processed · Started At · Error (if any).

**`StatusDot` component:** A colored circle — green for success, red for failed, yellow for running/unknown.

#### Step 6: Revenue Summary — `app/admin/revenue/page.tsx`

A simple financial snapshot. Reads from org + Stripe data already available.

```typescript
// Build MRR breakdown by plan:
const mrrByPlan = orgs.reduce((acc, org) => {
  const mrr = calculateMRR(org.plan, org.stripeUnitAmount);
  acc[org.plan] = (acc[org.plan] ?? 0) + mrr;
  return acc;
}, {} as Record<string, number>);

const totalMRR = Object.values(mrrByPlan).reduce((a, b) => a + b, 0);
const arr = totalMRR * 12;
```

**Revenue page layout:**

```tsx
<div className="space-y-8">
  {/* Top-line metrics */}
  <div className="grid grid-cols-3 gap-4">
    <AdminStatCard label="MRR" value={`$${totalMRR}`} />
    <AdminStatCard label="ARR (projected)" value={`$${arr}`} />
    <AdminStatCard label="Paying customers" value={payingCount} />
  </div>

  {/* MRR by plan */}
  <section>
    <h2 className="text-sm font-semibold mb-3">MRR by Plan</h2>
    {Object.entries(mrrByPlan).map(([plan, mrr]) => (
      <div key={plan} className="flex justify-between py-2 border-b border-border/50">
        <span className="text-sm">{getPlanDisplayName(plan)}</span>
        <span className="text-sm font-medium tabular-nums">${mrr}/mo</span>
      </div>
    ))}
  </section>

  {/* Trial conversion funnel */}
  <section>
    <h2 className="text-sm font-semibold mb-3">Trial Funnel</h2>
    <div className="space-y-2">
      <FunnelRow label="Total signups (all time)" value={orgs.length} />
      <FunnelRow label="Currently on trial" value={trialCount} />
      <FunnelRow label="Converted to paid" value={payingCount} />
      <FunnelRow
        label="Conversion rate"
        value={`${Math.round((payingCount / orgs.length) * 100)}%`}
      />
    </div>
  </section>
</div>
```

**Do NOT connect to Stripe's revenue APIs directly.** MRR is calculated from the `plan` column in the `orgs` table and the `PLAN_MRR` constant. This is intentionally simple — Stripe's dashboard handles real-time revenue reporting. The admin page's revenue view is for quick operational awareness, not accounting.

---

### Component 2: Credit/Usage System — N1

**The problem:** Every user on every plan can click "Run Analysis," "Generate Brief," and "Re-audit" unlimited times. Each click fires real Perplexity and OpenAI API calls. This sprint implements hard monthly credit limits.

**Design principle:** Credits gate only user-initiated LLM operations. Automated cron runs are not credit-gated. A user who has exhausted their credits still receives their weekly digest and Sunday scan.

#### Step 1: DB migration — `supabase/migrations/[timestamp]_api_credits.sql`

```sql
-- Sprint D: Credit/usage system for API cost control
CREATE TABLE IF NOT EXISTS public.api_credits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  plan          text NOT NULL,
  credits_used  integer NOT NULL DEFAULT 0,
  credits_limit integer NOT NULL,
  reset_date    timestamptz NOT NULL,        -- First day of next calendar month, midnight UTC
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT api_credits_credits_non_negative CHECK (credits_used >= 0),
  CONSTRAINT api_credits_limit_positive CHECK (credits_limit > 0)
);

-- Each org has exactly one active credits row:
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_credits_org_id ON public.api_credits (org_id);

-- For admin page sorting by usage:
CREATE INDEX IF NOT EXISTS idx_api_credits_usage ON public.api_credits (credits_used DESC);

-- RLS: users can read their own org's credits; admin service role can read all.
ALTER TABLE public.api_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own org credits"
  ON public.api_credits FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
  ));

-- No user UPDATE policy — credits are only modified by server-side service role client.

COMMENT ON TABLE public.api_credits IS
  'Monthly API credit tracking per org. Credits gate user-initiated LLM operations. Sprint D.';
COMMENT ON COLUMN public.api_credits.reset_date IS
  'UTC midnight on the first day of the next calendar month. Credits_used resets to 0 at this date.';
```

**Update `prod_schema.sql` and `database.types.ts`** to include the new table.

#### Step 2: Credit limits constant — `lib/credits/credit-limits.ts`

```typescript
/**
 * Monthly credit limits per plan.
 * One credit = one user-initiated LLM API call.
 * Automated cron operations do NOT consume credits.
 *
 * Source: lib/plan-enforcer.ts plan values.
 * AI_RULES §50: update both files together when plan gates change.
 */
export const PLAN_CREDIT_LIMITS: Record<string, number> = {
  trial:   25,    // Enough to explore, not enough to abuse
  starter: 100,   // ~3 per day — sufficient for a typical small restaurant
  growth:  500,   // ~16 per day — sufficient for active users with 10 competitors
  agency:  2000,  // ~65 per day — sufficient for multi-location, multi-competitor use
};

/**
 * Returns the credit limit for a given plan.
 * Falls back to trial limit for unknown plans (defensive).
 */
export function getCreditLimit(plan: string | null | undefined): number {
  return PLAN_CREDIT_LIMITS[plan ?? 'trial'] ?? PLAN_CREDIT_LIMITS.trial;
}

/**
 * Returns the first UTC midnight of next month from a given date.
 * Used for computing reset_date on credit row creation.
 */
export function getNextResetDate(from: Date = new Date()): Date {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return next;
}
```

#### Step 3: Credit service — `lib/credits/credit-service.ts`

Server-only module. All credit operations go through this service. No direct DB calls from action files.

```typescript
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCreditLimit, getNextResetDate } from './credit-limits';
import * as Sentry from '@sentry/nextjs';

/**
 * Result type for credit check operations.
 */
export type CreditCheckResult =
  | { ok: true; creditsRemaining: number }
  | { ok: false; reason: 'insufficient_credits'; creditsUsed: number; creditsLimit: number }
  | { ok: false; reason: 'credits_row_missing'; }
  | { ok: false; reason: 'db_error'; };

/**
 * Checks if an org has sufficient credits for one operation.
 * Does NOT consume the credit — call consumeCredit() after the operation succeeds.
 * 
 * @param orgId - The org's UUID
 */
export async function checkCredit(orgId: string): Promise<CreditCheckResult> {
  const supabase = createServiceRoleClient();

  try {
    const { data, error } = await supabase
      .from('api_credits')
      .select('credits_used, credits_limit, reset_date, plan')
      .eq('org_id', orgId)
      .single();

    if (error || !data) {
      // Credits row doesn't exist — create it on first check
      const initialized = await initializeCredits(orgId);
      if (!initialized) return { ok: false, reason: 'db_error' };
      return { ok: true, creditsRemaining: initialized.credits_limit };
    }

    // Check if reset is needed (past reset_date):
    if (new Date(data.reset_date) <= new Date()) {
      await resetCredits(orgId, data.plan);
      return { ok: true, creditsRemaining: getCreditLimit(data.plan) };
    }

    if (data.credits_used >= data.credits_limit) {
      return {
        ok: false,
        reason: 'insufficient_credits',
        creditsUsed: data.credits_used,
        creditsLimit: data.credits_limit,
      };
    }

    return { ok: true, creditsRemaining: data.credits_limit - data.credits_used };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'credit-service', function: 'checkCredit', sprint: 'D' },
      extra: { orgId },
    });
    return { ok: false, reason: 'db_error' };
  }
}

/**
 * Increments credits_used by 1 for an org.
 * Call this AFTER the expensive operation completes successfully.
 * If the operation fails, do not consume the credit.
 */
export async function consumeCredit(orgId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  try {
    await supabase.rpc('increment_credits_used', { p_org_id: orgId });
  } catch (err) {
    // Credit consumption failure is non-fatal — log but do not throw.
    Sentry.captureException(err, {
      tags: { service: 'credit-service', function: 'consumeCredit', sprint: 'D' },
      extra: { orgId },
    });
  }
}

/**
 * Creates a new credits row for an org based on their current plan.
 * Called on first checkCredit() if row doesn't exist.
 */
async function initializeCredits(
  orgId: string,
): Promise<{ credits_limit: number } | null> {
  const supabase = createServiceRoleClient();

  // Fetch the org's plan:
  const { data: org } = await supabase
    .from('orgs')
    .select('plan')
    .eq('id', orgId)
    .single();

  if (!org) return null;

  const limit = getCreditLimit(org.plan);
  const resetDate = getNextResetDate();

  const { error } = await supabase
    .from('api_credits')
    .insert({
      org_id: orgId,
      plan: org.plan,
      credits_used: 0,
      credits_limit: limit,
      reset_date: resetDate.toISOString(),
    });

  if (error) return null;
  return { credits_limit: limit };
}

/**
 * Resets credits_used to 0 and sets the next reset_date.
 * Called when reset_date has passed.
 */
async function resetCredits(orgId: string, plan: string): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase
    .from('api_credits')
    .update({
      credits_used: 0,
      credits_limit: getCreditLimit(plan),
      reset_date: getNextResetDate().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId);
}
```

**Create a Supabase RPC function for atomic increment:**

```sql
-- In the migration file (or a separate migration):
CREATE OR REPLACE FUNCTION public.increment_credits_used(p_org_id uuid)
RETURNS void AS $$
  UPDATE public.api_credits
  SET credits_used = credits_used + 1,
      updated_at = now()
  WHERE org_id = p_org_id;
$$ LANGUAGE sql SECURITY DEFINER;
```

This atomic increment prevents race conditions from concurrent credit consumption. A JavaScript `credits_used + 1` read-modify-write would be racy.

#### Step 4: Wire credit check into expensive server actions

Read each target action file before modifying it. Understand the existing auth pattern (how `orgId` is obtained). Apply the credit check at the top of the action, before the expensive call.

**Standard pattern for every credit-gated server action:**

```typescript
'use server';
import { checkCredit, consumeCredit } from '@/lib/credits/credit-service';
// ... other imports

export async function generateCorrectionBrief(alertId: string): Promise<...> {
  // 1. Get org_id from auth context (existing pattern — match what's already in this file)
  const { orgId } = await getSafeAuthContext();  // or however auth works in this file

  // 2. Check credit BEFORE the expensive operation
  const creditCheck = await checkCredit(orgId);
  if (!creditCheck.ok) {
    if (creditCheck.reason === 'insufficient_credits') {
      return {
        error: 'credit_limit_reached',
        creditsUsed: creditCheck.creditsUsed,
        creditsLimit: creditCheck.creditsLimit,
      };
    }
    // DB error or missing row — fail gracefully, allow the operation
    // (don't block users due to a credit service failure)
  }

  // 3. Execute the expensive operation
  try {
    const result = await callExpensiveLLMOperation(alertId);

    // 4. Consume credit AFTER success
    if (creditCheck.ok) {
      await consumeCredit(orgId);
    }

    return { ok: true, result };
  } catch (err) {
    // Do NOT consume credit on failure
    Sentry.captureException(err, { tags: { action: 'generateCorrectionBrief' } });
    return { error: 'generation_failed' };
  }
}
```

**Target actions to credit-gate** (read each file to confirm LLM calls exist before gating):

| Action | File | LLM call? |
|--------|------|----------|
| Generate correction brief | `app/dashboard/alerts/_components/CorrectionPanel.tsx` + related action | Yes — confirm |
| Re-audit hallucination | alerts-related action | Yes — confirm |
| Run SOV analysis (manual) | `app/dashboard/share-of-voice/actions.ts` | Yes — confirm |
| Generate magic menu | `app/dashboard/magic-menus/actions.ts` | Yes — confirm |
| Add competitor (initial scan) | `app/dashboard/compete/_components/AddCompetitorForm.tsx` | Check — may only DB-write |

**If `credit_limit_reached` is returned to the client:** The calling component must handle this error code and show a specific UI message — not a generic error.

**Credit-limit error UI pattern** (apply in each component that calls a credit-gated action):

```tsx
{actionError === 'credit_limit_reached' && (
  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm" data-testid="credit-limit-error">
    <p className="font-medium text-amber-800">Monthly credit limit reached</p>
    <p className="mt-1 text-amber-700">
      You've used all {creditsLimit} credits for this month.
      Credits reset on {formatDate(resetDate)}.{' '}
      <Link href="/dashboard/billing" className="underline">Upgrade your plan</Link> for more credits.
    </p>
  </div>
)}
```

#### Step 5: Credits meter in TopBar

Read `app/dashboard/_components/TopBar.tsx` (or equivalent) fully. Understand its current content and layout.

**Fetch credits data in the parent server component** (wherever `TopBar` is rendered — likely the dashboard layout):

```typescript
// In app/dashboard/layout.tsx or wherever TopBar gets its props:
const { data: credits } = await supabase
  .from('api_credits')
  .select('credits_used, credits_limit, reset_date')
  .eq('org_id', orgId)
  .single();
```

**Pass to TopBar as a prop:**

```tsx
<TopBar credits={credits} />
```

**Credits meter in TopBar:**

```tsx
// Credits meter — show only when credits data is available
{credits && (
  <div className="flex items-center gap-2" data-testid="credits-meter">
    <div className="hidden sm:flex flex-col items-end">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
        API Credits
      </span>
      <span className="text-xs font-medium tabular-nums">
        {credits.credits_limit - credits.credits_used}
        <span className="text-muted-foreground"> / {credits.credits_limit}</span>
      </span>
    </div>
    <CreditsMeterBar used={credits.credits_used} limit={credits.credits_limit} />
  </div>
)}
```

**`CreditsMeterBar` component** — a small horizontal bar (like a battery indicator):

```tsx
function CreditsMeterBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div
      className="h-1.5 w-16 rounded-full bg-muted overflow-hidden"
      role="progressbar"
      aria-valuenow={used}
      aria-valuemax={limit}
      aria-label={`${limit - used} API credits remaining`}
      data-testid="credits-meter-bar"
    >
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
```

**Credits tooltip on hover:** When the user hovers the credits meter, show a popover (reuse `InfoTooltip` from Sprint B):

```tsx
// Tooltip content:
"You have {remaining} of {limit} API credits remaining this month. 
Credits are used when you manually trigger analyses, generate correction briefs, or re-audit hallucinations.
Credits reset on {formatDate(resetDate)}."
```

---

### Component 3: Restaurant-Specific Revenue Config Defaults — M4

**The problem:** `RevenueConfigForm.tsx` uses generic placeholder defaults. A restaurant owner opening it for the first time sees numbers that don't apply to their business.

#### Step 1: Audit the current DEFAULT_CONFIG

Read `app/dashboard/revenue-impact/_components/RevenueConfigForm.tsx` and `lib/services/revenue-leak.service.ts` fully.

Find the `DEFAULT_CONFIG` (or equivalent constant). Note every field name and its current default value. Then replace with restaurant-appropriate values:

```typescript
/**
 * Restaurant-optimized default revenue configuration.
 * Based on typical full-service restaurant/lounge metrics.
 * Modeled after Charcoal N Chill (hookah lounge + fusion restaurant, Alpharetta GA).
 * 
 * Field names must match the form's field names exactly — verify against RevenueConfigForm.tsx
 * before changing any key.
 * 
 * Sprint D: AI_RULES §51 — update golden-tenant.ts REVENUE_CONFIG fixture in the same PR.
 */
export const DEFAULT_REVENUE_CONFIG = {
  // Adjust field names to match actual form fields:
  averageCheckSize:        55,    // $55 avg check (food + beverages; hookah adds premium)
  coversPerNight:          60,    // 60 covers on a typical weeknight
  nightsOpenPerWeek:        5,    // Mon–Fri open; adjust if different
  weekendPremiumMultiplier: 1.4,  // 40% revenue premium on Fri–Sat
  hookaRevenuPerTable:     45,    // $45 hookah revenue per table per session
  tablesWithHookah:        12,    // ~12 hookah tables in a typical lounge setup
  avgPartySize:             4,    // 4 guests per table on average
  avgSessionLength:       120,    // 2 hours average (in minutes)
};
```

**Apply the defaults in the form:** In `RevenueConfigForm.tsx`, find where `defaultValues` or initial state is set. Replace the current values with `DEFAULT_REVENUE_CONFIG`. If the form uses `react-hook-form`, update the `defaultValues` prop. If it uses `useState`, update the initial state object.

#### Step 2: Add revenue config fixture to golden tenant

In `src/__fixtures__/golden-tenant.ts`, add:

```typescript
/**
 * Sprint D — Charcoal N Chill default revenue configuration.
 * Matches DEFAULT_REVENUE_CONFIG in revenue-leak.service.ts.
 * Used in revenue-impact E2E tests (Sprint C) and unit tests for revenue calculations.
 */
export const CHARCOAL_N_CHILL_REVENUE_CONFIG = {
  averageCheckSize:         55,
  coversPerNight:           60,
  nightsOpenPerWeek:         5,
  weekendPremiumMultiplier:  1.4,
  hookaRevenuePerTable:     45,
  tablesWithHookah:         12,
  avgPartySize:              4,
  avgSessionLength:         120,
} as const;

/**
 * Expected weekly revenue leak from DEFAULT_REVENUE_CONFIG.
 * Computed manually and used to verify revenue-leak.service.ts calculations.
 * Update this value if DEFAULT_REVENUE_CONFIG changes.
 */
export const CHARCOAL_N_CHILL_EXPECTED_WEEKLY_REVENUE = 16500;  // $16,500/week — compute from config
```

**Compute `CHARCOAL_N_CHILL_EXPECTED_WEEKLY_REVENUE` manually** by reading `revenue-leak.service.ts` calculation logic and running the math with the default values. Do not guess — verify the formula.

---

### Component 4: AI vs. SEO Positioning Banner — M6

**The problem:** Paying customers who also use Yext, BrightLocal, or Moz look at the LocalVector dashboard and have no in-product answer to "what does this add that my current tools don't?"

**Implementation pattern:** Follow the `SampleModeBanner` pattern from Sprint B exactly — same structure, same dismiss mechanism, but with `localStorage` (not `sessionStorage`) for permanent dismissal.

#### Create `components/ui/PositioningBanner.tsx`

```tsx
'use client';

/**
 * PositioningBanner — shown once to new users (org created < 30 days ago).
 * Explains how LocalVector differs from traditional SEO tools.
 * Dismissed permanently via localStorage (unlike SampleModeBanner which uses sessionStorage).
 * 
 * Show condition: org is < 30 days old AND banner not previously dismissed AND not in sample mode.
 * Never show simultaneously with SampleModeBanner — positioning banner shows only after
 * the user has real data (sample mode is over).
 */

const DISMISSED_KEY = 'lv_positioning_banner_dismissed';

export function PositioningBanner() {
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined'
      ? localStorage.getItem(DISMISSED_KEY) === 'true'
      : false
  );

  if (dismissed) return null;

  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
      data-testid="positioning-banner"
      role="status"
    >
      <Sparkles className="mt-0.5 h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-medium text-foreground">
          LocalVector tracks a layer your other SEO tools can't see.
        </p>
        <p className="mt-1 text-muted-foreground">
          Traditional SEO tools (Yext, BrightLocal, Moz) track your Google <em>search rankings</em>.
          LocalVector tracks what AI models <em>say about you</em> — the answers ChatGPT, Perplexity,
          and Gemini give when customers ask "best hookah lounge near me." Your Reality Score measures
          AI visibility, not search position.{' '}
          <Link href="/dashboard/ai-responses" className="text-primary hover:underline font-medium">
            See what AI says about your business →
          </Link>
        </p>
      </div>
      <button
        onClick={() => {
          localStorage.setItem(DISMISSED_KEY, 'true');
          setDismissed(true);
        }}
        className="ml-2 mt-0.5 rounded text-muted-foreground/60 hover:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Dismiss this notice"
        data-testid="positioning-banner-dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
```

Import `Sparkles`, `X` from `'lucide-react'`. Import `Link` from `'next/link'`. Import `useState` from `'react'`.

#### Wire into `app/dashboard/page.tsx`

Show the banner **only when:**
1. The org was created less than 30 days ago (`org.created_at` check)
2. The org has real data (not in sample mode — `isSampleMode()` returns false)
3. The banner has not been dismissed (client-side check via localStorage)

```tsx
// In dashboard page (server component — pass the condition as a prop):
const isNewOrg = org?.created_at
  ? Date.now() - new Date(org.created_at).getTime() < 30 * 24 * 60 * 60 * 1000
  : false;

// In JSX — show AFTER the SampleModeBanner section:
{isNewOrg && !sampleMode && <PositioningBanner />}
```

**The banner shows SampleModeBanner first (if in sample mode), then PositioningBanner (when real data exists).** They never appear simultaneously. This sequencing creates a natural user journey: "You're seeing sample data" → (scan completes) → "Here's how LocalVector differs from your other tools."

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/admin-auth-guard.test.ts`

```
describe('Admin layout auth guard')
  1.  non-admin user is redirected to /dashboard
  2.  unauthenticated user is redirected to /login
  3.  admin user (email in ADMIN_EMAILS) is not redirected
  4.  ADMIN_EMAILS env var accepts comma-separated list of emails
  5.  email comparison is case-insensitive (ARUNA@domain.com matches aruna@domain.com)
  6.  empty ADMIN_EMAILS env var blocks all users (no accidents)
  7.  ADMIN_EMAILS with whitespace around emails is trimmed correctly
```

**Target: 7 tests**

### Test File 2: `src/__tests__/unit/credit-service.test.ts`

```
describe('checkCredit()')
  1.  returns { ok: true } when credits_used < credits_limit
  2.  returns { ok: false, reason: 'insufficient_credits' } when credits_used >= credits_limit
  3.  initializes a new credits row when none exists (first call for an org)
  4.  new credits row uses the org's current plan for the limit
  5.  resets credits when reset_date is in the past
  6.  after reset, credits_used = 0 and reset_date advances to next month
  7.  on Supabase DB error, returns { ok: false, reason: 'db_error' }
  8.  Sentry.captureException is called on DB error

describe('consumeCredit()')
  9.  calls the increment_credits_used RPC with the correct org_id
  10. on RPC failure, captures to Sentry and does NOT throw
  11. consumeCredit does not throw even if the DB call fails

describe('getCreditLimit()')
  12. trial plan → 25
  13. starter plan → 100
  14. growth plan → 500
  15. agency plan → 2000
  16. null plan → falls back to trial (25)
  17. unknown plan → falls back to trial (25)

describe('getNextResetDate()')
  18. returns a date in the future
  19. returns UTC midnight on the 1st of the next calendar month
  20. works correctly when called in December (next month = January of next year)
```

**Target: 20 tests**

All Supabase calls mocked via `vi.mock('@/lib/supabase/server')`. The `increment_credits_used` RPC mocked as a Supabase `.rpc()` call.

### Test File 3: `src/__tests__/unit/credit-gated-actions.test.ts`

```
describe('Credit-gated server actions')
  
  When credits are available:
  1.  generateCorrectionBrief proceeds to the LLM call
  2.  generateCorrectionBrief calls consumeCredit after success
  3.  generateCorrectionBrief does NOT call consumeCredit if the LLM call fails

  When credits are exhausted:
  4.  generateCorrectionBrief returns { error: 'credit_limit_reached' } immediately
  5.  generateCorrectionBrief does NOT call the LLM when credits exhausted
  6.  the error response includes creditsUsed and creditsLimit values

  When credit service has a DB error:
  7.  on 'db_error' from checkCredit, the action proceeds anyway (fail-open for service errors)
  8.  consumeCredit is NOT called when checkCredit returned db_error (no double-counting risk)

  Repeat for magic menu generation:
  9.  magic menu generation is blocked when credits exhausted
  10. magic menu generation proceeds when credits available
  
  Repeat for manual SOV analysis (if it's credit-gated):
  11. manual SOV trigger is blocked when credits exhausted
  12. manual SOV trigger proceeds when credits available
```

**Target: 12 tests**

### Test File 4: `src/__tests__/unit/revenue-config-defaults.test.ts`

```
describe('DEFAULT_REVENUE_CONFIG')
  1.  averageCheckSize is a number between $30 and $100 (reasonable restaurant range)
  2.  coversPerNight is a positive integer
  3.  weekendPremiumMultiplier is between 1.0 and 2.0
  4.  nightsOpenPerWeek is between 1 and 7
  5.  all values in DEFAULT_REVENUE_CONFIG are positive numbers (no zeros, no negatives)

describe('revenue-leak.service.ts with restaurant defaults')
  6.  calculateWeeklyRevenue(DEFAULT_REVENUE_CONFIG) returns a positive number
  7.  calculateWeeklyRevenue result is > $5,000 and < $100,000 (sanity range for a restaurant)
  8.  weekday revenue is less than weekend revenue * weekendPremiumMultiplier (premium applies)
  9.  CHARCOAL_N_CHILL_EXPECTED_WEEKLY_REVENUE matches the actual calculation output

describe('RevenueConfigForm defaults')
  10. form renders with averageCheckSize field pre-filled to 55 (or the actual default)
  11. form renders with coversPerNight field pre-filled to 60 (or actual default)
  12. submitting the form with default values does not produce a validation error
```

**Target: 12 tests**

### Test File 5: `src/__tests__/unit/positioning-banner.test.tsx`

```
describe('PositioningBanner')
  1.  renders when localStorage does not have the dismissed key
  2.  does NOT render when localStorage has 'lv_positioning_banner_dismissed' = 'true'
  3.  clicking the dismiss button sets localStorage and hides the banner
  4.  data-testid="positioning-banner" is present when visible
  5.  data-testid="positioning-banner-dismiss" is on the dismiss button
  6.  contains a link to /dashboard/ai-responses
  7.  the word "AI" (or "artificial intelligence") appears in the banner text

describe('Dashboard integration')
  8.  banner renders when isNewOrg=true and sampleMode=false
  9.  banner does NOT render when isNewOrg=false
  10. banner does NOT render when sampleMode=true (SampleModeBanner takes priority)
```

**Target: 10 tests**

### E2E Test Files

**`src/__tests__/e2e/admin-dashboard.spec.ts`:**

```
describe('Admin Dashboard')
  Auth:
  1.  non-admin user visiting /admin is redirected to /dashboard
  2.  unauthenticated user visiting /admin is redirected to /login
  3.  admin user can access /admin/customers

  Customer list:
  4.  /admin/customers loads without error for admin user
  5.  admin-customer-table is visible
  6.  at least one org row is present (golden tenant)
  7.  Plan column shows "AI Shield" (not "growth") — using getPlanDisplayName()
  8.  MRR column shows "$59/mo" for a growth plan org

  Cron health:
  9.  /admin/cron-health loads without error
  10. at least one cron-health-card is visible (if cron_run_log has entries)

  Revenue:
  11. /admin/revenue loads without error
  12. MRR summary stat is visible and numeric
  13. "Paying customers" stat is visible
```

**Target: 13 E2E tests**

**`src/__tests__/e2e/credits-system.spec.ts`:**

```
describe('Credits System — E2E')
  TopBar meter:
  1.  credits-meter is visible in the dashboard TopBar for logged-in users
  2.  credits-meter-bar is present and has a width > 0
  3.  hovering the credits meter shows a tooltip with "credits remaining" text

  Credit-limit error:
  4.  when credits are exhausted (mocked), clicking "Generate Brief" shows credit-limit-error
  5.  credit-limit-error contains a link to /dashboard/billing
  6.  credit-limit-error shows the reset date

  Normal flow:
  7.  with sufficient credits, "Generate Brief" proceeds (LLM call mocked to succeed)
  8.  after successful generation, the credits meter updates (credits_used increments)
```

**Target: 8 E2E tests**

### Run commands:

```bash
npx vitest run src/__tests__/unit/admin-auth-guard.test.ts          # 7 tests
npx vitest run src/__tests__/unit/credit-service.test.ts            # 20 tests
npx vitest run src/__tests__/unit/credit-gated-actions.test.ts      # 12 tests
npx vitest run src/__tests__/unit/revenue-config-defaults.test.ts   # 12 tests
npx vitest run src/__tests__/unit/positioning-banner.test.tsx       # 10 tests
npx vitest run                                                       # All tests — 0 regressions
npx playwright test src/__tests__/e2e/admin-dashboard.spec.ts       # 13 tests
npx playwright test src/__tests__/e2e/credits-system.spec.ts        # 8 tests
npx tsc --noEmit                                                     # 0 new type errors
```

---

## 📂 Files to Create / Modify

| # | File | Action | Component |
|---|------|--------|-----------|
| 1 | `app/admin/layout.tsx` | **CREATE** | L1 — Admin auth guard + layout |
| 2 | `app/admin/page.tsx` | **CREATE** | L1 — Redirect to /admin/customers |
| 3 | `app/admin/_components/AdminNav.tsx` | **CREATE** | L1 — Admin navigation bar |
| 4 | `app/admin/_components/AdminStatCard.tsx` | **CREATE** | L1 — Reusable stat card |
| 5 | `app/admin/_components/PlanBadge.tsx` | **CREATE** | L1 — Colored plan badge |
| 6 | `app/admin/customers/page.tsx` | **CREATE** | L1 — Customer list |
| 7 | `app/admin/api-usage/page.tsx` | **CREATE** | L1 + N1 — API usage summary |
| 8 | `app/admin/cron-health/page.tsx` | **CREATE** | L1 — Cron health view |
| 9 | `app/admin/revenue/page.tsx` | **CREATE** | L1 — Revenue summary |
| 10 | `lib/admin/format-relative-date.ts` | **CREATE** | L1 — Date formatting utility |
| 11 | `supabase/migrations/[timestamp]_api_credits.sql` | **CREATE** | N1 — Credits table + RPC |
| 12 | `supabase/prod_schema.sql` | **MODIFY** | N1 — api_credits table |
| 13 | `lib/supabase/database.types.ts` | **MODIFY** | N1 — api_credits types |
| 14 | `lib/credits/credit-limits.ts` | **CREATE** | N1 — Plan limits + reset date |
| 15 | `lib/credits/credit-service.ts` | **CREATE** | N1 — checkCredit, consumeCredit |
| 16 | `app/dashboard/_components/TopBar.tsx` | **MODIFY** | N1 — Credits meter |
| 17 | `app/dashboard/layout.tsx` | **MODIFY** | N1 — Fetch credits for TopBar |
| 18 | `app/dashboard/alerts/_components/CorrectionPanel.tsx` | **MODIFY** | N1 — Credit gate |
| 19 | `app/dashboard/magic-menus/actions.ts` | **MODIFY** | N1 — Credit gate |
| 20 | `app/dashboard/share-of-voice/actions.ts` | **MODIFY** | N1 — Credit gate (if LLM call) |
| 21 | `app/dashboard/revenue-impact/_components/RevenueConfigForm.tsx` | **MODIFY** | M4 — Restaurant defaults |
| 22 | `lib/services/revenue-leak.service.ts` | **MODIFY** | M4 — DEFAULT_REVENUE_CONFIG |
| 23 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | M4 — Revenue config fixture |
| 24 | `components/ui/PositioningBanner.tsx` | **CREATE** | M6 — AI vs SEO banner |
| 25 | `app/dashboard/page.tsx` | **MODIFY** | M6 — Render PositioningBanner |
| 26 | `.env.example` | **MODIFY** | L1 — Add ADMIN_EMAILS= |
| 27 | `src/__tests__/unit/admin-auth-guard.test.ts` | **CREATE** | Tests (7) |
| 28 | `src/__tests__/unit/credit-service.test.ts` | **CREATE** | Tests (20) |
| 29 | `src/__tests__/unit/credit-gated-actions.test.ts` | **CREATE** | Tests (12) |
| 30 | `src/__tests__/unit/revenue-config-defaults.test.ts` | **CREATE** | Tests (12) |
| 31 | `src/__tests__/unit/positioning-banner.test.tsx` | **CREATE** | Tests (10) |
| 32 | `src/__tests__/e2e/admin-dashboard.spec.ts` | **CREATE** | E2E tests (13) |
| 33 | `src/__tests__/e2e/credits-system.spec.ts` | **CREATE** | E2E tests (8) |

---

## 🧠 Edge Cases to Handle

1. **Admin route must survive `ADMIN_EMAILS` being unset.** If the env var is missing or empty, the admin layout must redirect everyone — including you — rather than granting access to anyone. An unset `ADMIN_EMAILS` defaults to blocking all access, not allowing all access. The check: `if (adminEmails.length === 0) redirect('/dashboard')`.

2. **Admin pages use `createServiceRoleClient()` — not the user-scoped client.** The customer list, API usage, and cron health pages must bypass RLS to read all orgs' data. Every Supabase call in the admin section uses `createServiceRoleClient()`. Never use the user-scoped `createClient()` in admin pages — it will return empty results due to RLS.

3. **Credits system: fail-open on DB errors.** If `checkCredit()` returns `{ ok: false, reason: 'db_error' }`, the action should proceed rather than blocking the user. A credit service outage must not prevent customers from using the product. Document this in the code: `// Fail-open: a credit service DB error should not block user operations`.

4. **Credits: atomic increment via RPC.** The `consumeCredit()` function uses a Supabase RPC (`increment_credits_used`) for atomic increment. Do not use a read-modify-write pattern (`credits_used + 1` in TypeScript) — concurrent requests from the same org could cause double-counting. The RPC is the only correct approach here.

5. **Credits reset timing: timezone safety.** `getNextResetDate()` computes UTC midnight on the first of next month. Customers in UTC-5 (Eastern Time, US) will see their credits reset at 7pm local time on the last day of the month — slightly counterintuitive but acceptable. Document this in the `credit-limits.ts` JSDoc. Do not attempt timezone-local resets — they add complexity without meaningful benefit.

6. **Credits: plan change resets limits.** If a user upgrades from Starter (100 credits) to Growth (500 credits) mid-month, their `credits_limit` on the `api_credits` row should update immediately. Handle this in `initializeCredits()` — when the row already exists but the plan differs from the current org plan, update the limit. Or handle it in a separate `syncCreditPlanLimit()` function called from the billing upgrade flow. Read the existing billing/upgrade server action and add a `syncCreditPlanLimit()` call there.

7. **PositioningBanner + SampleModeBanner: never simultaneous.** The positioning banner must only show when `sampleMode === false`. A user in sample mode sees `SampleModeBanner`; once real data arrives, they see `PositioningBanner`. The sequencing logic in `dashboard/page.tsx` must enforce this: `{isNewOrg && !sampleMode && <PositioningBanner />}`.

8. **PositioningBanner "new org" threshold is 30 days.** Unlike the 14-day sample mode window, the positioning banner uses 30 days. This allows users who took a while to understand their first scan results to still see the differentiation message when they start exploring the product. The constants are different — document both in their respective files.

9. **Admin API usage page depends on N1 DB migration.** The `/admin/api-usage` page reads from `api_credits`. If N1's migration hasn't run yet when this page is deployed, it will return an empty result or a DB error. Guard the page: if `api_credits` table is empty, show "No credit data yet — credits are tracked once users perform their first manual operation."

10. **Revenue config field name mapping.** The `DEFAULT_REVENUE_CONFIG` keys must exactly match the form field names in `RevenueConfigForm.tsx`. Before writing any value, read the form's `register()` calls or `name` attributes. A key mismatch would silently fail — the form would ignore the default value and show an empty field.

11. **`CHARCOAL_N_CHILL_EXPECTED_WEEKLY_REVENUE` must be computed, not estimated.** Run the actual formula from `revenue-leak.service.ts` manually (or by running the service in a test) with `DEFAULT_REVENUE_CONFIG` values, then hardcode the result. A wrong expected value makes the test useless as a regression guard.

12. **Admin nav must not appear in the customer-facing dashboard.** The `AdminNav` component is only in `app/admin/layout.tsx`. It must never be imported into `app/dashboard/layout.tsx`. Verify this with a grep after implementing: `grep -r "AdminNav" app/dashboard/` must return no results.

---

## 🚫 What NOT to Do

1. **DO NOT use `middleware.ts` for admin auth** (AI_RULES §6). The admin guard lives in `app/admin/layout.tsx` as a server component check. Middleware lives in `proxy.ts` only.
2. **DO NOT use the user-scoped `createClient()` in any admin page** — it respects RLS and will return only the logged-in admin's own org data. Always use `createServiceRoleClient()` in admin pages.
3. **DO NOT block cron runs with credit checks.** Credits gate only user-initiated operations. The SOV Sunday scan, weekly digest, and GBP token refresh crons run unconditionally.
4. **DO NOT use a read-modify-write pattern for credit increment.** Use the `increment_credits_used` RPC for atomic increment. This is mandatory — listed in AI_RULES §50.
5. **DO NOT connect to Stripe's revenue API** in the admin revenue page. MRR is calculated from the `orgs.plan` column and `PLAN_MRR` constant. Stripe is the source of truth for actual payments; the admin page is for operational awareness only.
6. **DO NOT show the `PositioningBanner` to users in sample mode** — they haven't seen their real data yet; the positioning message is premature. The condition is `isNewOrg && !sampleMode`.
7. **DO NOT add `ADMIN_EMAILS` to the production env without first setting it** — if it's empty, everyone (including you) is locked out of `/admin`. Set it in Vercel env vars before deploying.
8. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
9. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12). The `CreditsMeterBar` color must use literal class strings. Use `const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'` and apply it as `className={color}` — this is acceptable because the full literal string is in the ternary.
10. **DO NOT store `ADMIN_EMAILS` in the DB.** It lives in env vars only. If it were in the DB, a compromised admin account could grant itself persistent access — env vars can only be changed via Vercel dashboard with deployment credentials.
11. **DO NOT apply credit limits retroactively** to existing orgs who have never had a credits row. Their first `checkCredit()` call initializes the row with a fresh monthly allowance — they don't inherit any past "debt."
12. **DO NOT show the admin dashboard link in the customer-facing sidebar** for admin users. The admin section is accessible via direct URL (`/admin`) only — it should not appear in the customer nav even for admins who are also customers.

---

## ✅ Definition of Done (AI_RULES §13.5)

**L1 — Admin Dashboard:**
- [ ] `app/admin/layout.tsx` — auth guard reading `ADMIN_EMAILS` env; redirects non-admin to `/dashboard`, unauthenticated to `/login`
- [ ] `app/admin/customers/page.tsx` — customer table with org name, plan (display name), MRR, reality score, last scan, created date
- [ ] `app/admin/api-usage/page.tsx` — credit usage table with at-risk row highlighting (>80% amber, 100% red)
- [ ] `app/admin/cron-health/page.tsx` — cron health cards + run log table
- [ ] `app/admin/revenue/page.tsx` — MRR by plan, ARR projection, trial funnel
- [ ] All admin pages use `createServiceRoleClient()` exclusively
- [ ] `AdminNav` component does not appear in any customer-facing file
- [ ] `.env.example` has `ADMIN_EMAILS=` documented
- [ ] `grep -r "AdminNav" app/dashboard/` returns 0 results

**N1 — Credits System:**
- [ ] `supabase/migrations/[timestamp]_api_credits.sql` — `api_credits` table, unique index on org_id, RLS policy, `increment_credits_used` RPC
- [ ] `lib/credits/credit-limits.ts` — `PLAN_CREDIT_LIMITS` (trial:25, starter:100, growth:500, agency:2000), `getCreditLimit()`, `getNextResetDate()`
- [ ] `lib/credits/credit-service.ts` — `checkCredit()`, `consumeCredit()`, `initializeCredits()`, `resetCredits()` — all with Sentry on errors
- [ ] Credit check wired into: correction brief generation, magic menu generation, and any other confirmed LLM-triggering actions
- [ ] Credits meter visible in `TopBar` with bar, numeric display, and InfoTooltip
- [ ] `credit_limit_reached` error renders user-friendly message with billing link and reset date in every gated component
- [ ] `grep -n "increment_credits_used" lib/credits/credit-service.ts` returns the RPC call (not a JS read-modify-write)
- [ ] Plan upgrade in billing flow calls `syncCreditPlanLimit()` to update credits_limit immediately

**M4 — Revenue Defaults:**
- [ ] `DEFAULT_REVENUE_CONFIG` in `revenue-leak.service.ts` uses restaurant-appropriate values (avg check ~$55, ~60 covers/night, 1.4× weekend premium)
- [ ] `RevenueConfigForm.tsx` pre-populates with `DEFAULT_REVENUE_CONFIG` values
- [ ] `CHARCOAL_N_CHILL_REVENUE_CONFIG` and `CHARCOAL_N_CHILL_EXPECTED_WEEKLY_REVENUE` added to `golden-tenant.ts`
- [ ] `CHARCOAL_N_CHILL_EXPECTED_WEEKLY_REVENUE` verified to match actual service calculation output

**M6 — Positioning Banner:**
- [ ] `components/ui/PositioningBanner.tsx` — `localStorage` dismiss, `data-testid="positioning-banner"`, link to `/dashboard/ai-responses`
- [ ] Banner renders in `dashboard/page.tsx` only when `isNewOrg=true && !sampleMode`
- [ ] Banner is dismissed permanently (localStorage, not sessionStorage)
- [ ] Banner and `SampleModeBanner` never appear simultaneously

**Tests:**
- [ ] `npx vitest run src/__tests__/unit/admin-auth-guard.test.ts` — **7 tests passing**
- [ ] `npx vitest run src/__tests__/unit/credit-service.test.ts` — **20 tests passing**
- [ ] `npx vitest run src/__tests__/unit/credit-gated-actions.test.ts` — **12 tests passing**
- [ ] `npx vitest run src/__tests__/unit/revenue-config-defaults.test.ts` — **12 tests passing**
- [ ] `npx vitest run src/__tests__/unit/positioning-banner.test.tsx` — **10 tests passing**
- [ ] `npx vitest run` — ALL tests passing across Sprints A–D, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/admin-dashboard.spec.ts` — **13 tests passing**
- [ ] `npx playwright test src/__tests__/e2e/credits-system.spec.ts` — **8 tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## [DATE] — Sprint D: Operate & Protect — Admin Dashboard, Credits, Revenue Defaults & Positioning (Completed)

**Goal:** Pre-acquisition sprint. Build operator visibility (admin dashboard) and unit economics protection (credits system) before active customer acquisition. Two quick wins round the sprint out.

**Scope:**
- `app/admin/layout.tsx` — **NEW.** Admin auth guard via ADMIN_EMAILS env var. Redirects non-admin → /dashboard, unauthenticated → /login. Case-insensitive email comparison.
- `app/admin/customers/page.tsx` — **NEW.** Customer list: org name, plan (display name), MRR, reality score, last scan, created date. Summary row: total customers, total MRR, trial count.
- `app/admin/api-usage/page.tsx` — **NEW.** Credit usage table: per-org credits_used/limit/pct. Row highlighting: amber >80%, red 100%. Estimated API cost at $0.02/credit.
- `app/admin/cron-health/page.tsx` — **NEW.** Cron summary cards (last run, success rate last 10) + full run log table (100 rows). StatusDot: green/red/yellow.
- `app/admin/revenue/page.tsx` — **NEW.** MRR by plan, ARR projection, trial conversion funnel.
- `lib/admin/format-relative-date.ts` — **NEW.** Intl.RelativeTimeFormat utility. No date library dependency.
- `supabase/migrations/[timestamp]_api_credits.sql` — **NEW.** api_credits table, unique idx on org_id, RLS (read own org), increment_credits_used RPC (atomic, SECURITY DEFINER).
- `lib/credits/credit-limits.ts` — **NEW.** PLAN_CREDIT_LIMITS (trial:25/starter:100/growth:500/agency:2000), getCreditLimit(), getNextResetDate() (UTC midnight, 1st of next month).
- `lib/credits/credit-service.ts` — **NEW.** checkCredit() (init + reset + check), consumeCredit() (RPC only, non-fatal), initializeCredits(), resetCredits(). Fail-open on DB errors.
- TopBar — **MODIFIED.** Credits meter: numeric display + CreditsMeterBar (green/amber/red) + InfoTooltip. Credits fetched in dashboard layout.
- [N] server actions credit-gated: [list exact actions]. Credit-limit error returns structured error code with creditsUsed, creditsLimit, resetDate.
- Credit-gated components — **MODIFIED.** credit-limit-error UI with billing link and reset date.
- `lib/services/revenue-leak.service.ts` — **MODIFIED.** DEFAULT_REVENUE_CONFIG updated to restaurant values: avgCheck=$55, covers=60, nightsOpen=5, weekendMultiplier=1.4.
- `RevenueConfigForm.tsx` — **MODIFIED.** Pre-populated with DEFAULT_REVENUE_CONFIG.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** CHARCOAL_N_CHILL_REVENUE_CONFIG + CHARCOAL_N_CHILL_EXPECTED_WEEKLY_REVENUE added.
- `components/ui/PositioningBanner.tsx` — **NEW.** Dismisses permanently via localStorage. Shows only when isNewOrg && !sampleMode. Links to /dashboard/ai-responses.
- `app/dashboard/page.tsx` — **MODIFIED.** PositioningBanner rendered for new orgs not in sample mode.

**Tests added:**
- `src/__tests__/unit/admin-auth-guard.test.ts` — N tests
- `src/__tests__/unit/credit-service.test.ts` — N tests
- `src/__tests__/unit/credit-gated-actions.test.ts` — N tests
- `src/__tests__/unit/revenue-config-defaults.test.ts` — N tests
- `src/__tests__/unit/positioning-banner.test.tsx` — N tests
- `src/__tests__/e2e/admin-dashboard.spec.ts` — N tests
- `src/__tests__/e2e/credits-system.spec.ts` — N tests

**Total across all sprints (A+B+C+D): [N] Vitest + [N] Playwright passing**
```

---

## 🔮 AI_RULES Update (Add to `AI_RULES.md`)

```markdown
## 50. 💳 Credits System — Atomic Increment and Fail-Open (Sprint D)

All credit operations use `lib/credits/credit-service.ts`. Direct DB reads/writes to `api_credits` from action files are banned.

* **Increment rule:** `consumeCredit()` MUST use the `increment_credits_used` Supabase RPC — never a JavaScript read-modify-write. Race conditions in concurrent requests cause undercounting.
* **Fail-open rule:** If `checkCredit()` returns `{ ok: false, reason: 'db_error' }`, the calling action MUST proceed. A credit service outage must not block users.
* **Cron exemption:** Weekly digest, SOV scan, GBP refresh, and all other cron operations are NEVER credit-gated. Credits gate only user-initiated LLM triggers.
* **Plan upgrade:** When a user upgrades, `syncCreditPlanLimit()` must be called to update `credits_limit` in `api_credits`. Never leave a Growth user with a Starter credit limit after upgrade.

## 51. 🔑 Admin Dashboard — Service Role Only, Env-Var Auth (Sprint D)

All pages under `app/admin/` use `createServiceRoleClient()` exclusively and authenticate via `ADMIN_EMAILS` env var.

* **Rule:** Never use the user-scoped `createClient()` in admin pages — RLS will filter out cross-org data.
* **Auth rule:** Admin access is determined by `ADMIN_EMAILS` env var (comma-separated). This list is never stored in the DB.
* **Empty env var:** If `ADMIN_EMAILS` is unset or empty, ALL users are redirected away from `/admin` — including the operator. Set this in Vercel before deploying.
* **Nav rule:** `AdminNav` must never be imported into any file under `app/dashboard/`. Admin section is accessed via direct URL only.

## 52. 📊 Revenue Config Defaults — Restaurant-Specific (Sprint D)

`DEFAULT_REVENUE_CONFIG` in `lib/services/revenue-leak.service.ts` is restaurant-optimized.

* **Rule:** Do not reset to generic defaults. The values (avg check ~$55, ~60 covers/night, 1.4× weekend) reflect a full-service restaurant/lounge.
* **Sync rule:** `CHARCOAL_N_CHILL_REVENUE_CONFIG` in `src/__fixtures__/golden-tenant.ts` must always match `DEFAULT_REVENUE_CONFIG`. Update both in the same PR if defaults change.
* **Verification:** `CHARCOAL_N_CHILL_EXPECTED_WEEKLY_REVENUE` must match the actual `revenue-leak.service.ts` calculation output. Run the test after any config change.
```

---

## 📚 Document Sync + Git Commit

```bash
git add -A
git status

git commit -m "Sprint D: Operate & Protect — Admin Dashboard, Credits, Revenue Defaults & Positioning

- app/admin/: auth guard (ADMIN_EMAILS env), customer list, api-usage, cron-health, revenue summary
- admin pages: all use createServiceRoleClient() — bypasses RLS for cross-org visibility
- api_credits table: org_id unique, RLS, increment_credits_used RPC (atomic, SECURITY DEFINER)
- lib/credits/: credit-limits.ts (25/100/500/2000 by plan) + credit-service.ts (checkCredit, consumeCredit)
- TopBar: credits meter (numeric + bar + InfoTooltip), credits fetched in dashboard layout
- [N] server actions credit-gated with fail-open on DB errors, credit_limit_reached error UI
- revenue-leak.service.ts: DEFAULT_REVENUE_CONFIG → restaurant values (avg check $55, 60 covers, 1.4x weekend)
- golden-tenant.ts: CHARCOAL_N_CHILL_REVENUE_CONFIG + CHARCOAL_N_CHILL_EXPECTED_WEEKLY_REVENUE
- PositioningBanner: localStorage dismiss, renders for new orgs when real data exists (not in sample mode)
- tests: [N] Vitest + [N] Playwright passing, 0 regressions across all sprints (A+B+C+D)
- AI_RULES: Rules 50 (credits atomic/fail-open), 51 (admin service-role/env-auth), 52 (revenue defaults)

Fixes: L1 (admin dashboard), N1 (credits system), M4 (revenue defaults), M6 (positioning banner)
Unblocks: active customer acquisition — operator visibility and cost controls are now in place."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint D completes, LocalVector is ready for active customer acquisition:

**As the operator, you can now:**
- Log into `/admin` and see every customer, their plan, and their MRR contribution in real time
- See which customers are consuming the most API credits and approaching their limit
- See the health of every cron job across all orgs — no more Sunday-night uncertainty
- See your current MRR, ARR projection, and trial conversion rate on one page

**Your unit economics are now protected:**
- No customer can trigger more than 25–2,000 LLM API calls per month depending on plan
- The credits meter in the TopBar shows customers how much of their allowance they've used
- A credit-limit-reached error links them to billing — turning a limit into an upgrade prompt

**New customer experience is complete:**
- Day 1: sample data dashboard (Sprint B) — they see a populated product, not an empty shell
- Day 1: positioning banner (Sprint D) — they understand the AI vs. SEO differentiation immediately
- Day 2–7: real data arrives from Sunday scan (Sprint B sample mode exits automatically)
- Ongoing: InfoTooltips (Sprint B) explain every metric; sidebar grouping (Sprint A) makes navigation clear

**What remains in the backlog for future sprints:**
- M2: GuidedTour expansion (3 more steps: SOV, Citations, Revenue Impact)
- M5: Medical/dental vertical extension (data-only, no code)
- N2: On-demand AI Answer Preview widget
- N3: Hallucination correction follow-up scan
- N4: Benchmark comparison (needs 10+ customers in same metro first)
