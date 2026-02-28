# Sprint M — Conversion, Verification & Reliability: Plan Comparison Table, Bing Verification, Positioning Banner & Service Tests

> **Claude Code Prompt — Bulletproof Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisites:** Sprints A–L must be fully merged and all tests passing. Sprint M spans frontend, one new API route, and service-layer unit tests. No new DB tables required.

---

## 🎯 Objective

Sprint M closes the four remaining gaps from the February 2026 analysis that haven't been addressed by Sprints A–L. These are not glamorous features — there's no new page, no major redesign. But each one either directly earns revenue (M3), makes an existing feature more trustworthy (Bing verification), retains users who are questioning the product's value (M6), or prevents silent production failures from going undetected (M1/L5). Done correctly, Sprint M is the sprint that makes the product feel complete.

**The four areas and the specific work:**

1. **M3 — Plan Feature Comparison Table:** The billing page shows upgrade tiers with prices but no feature breakdown. A Growth plan user ($59/mo) who is considering Agency ($custom) can only see the price — not what they'd actually unlock. `lib/plan-enforcer.ts` contains 17 gating functions that fully define the feature matrix. This sprint renders that matrix as a clear comparison table directly on the billing page — driven entirely from `plan-enforcer.ts` so it stays in sync automatically as the matrix evolves. No hardcoding. Users can see exactly what they get at each tier. This is the most direct upsell conversion lever available without writing new backend code.

2. **C2 Phase 2 — Bing Places Verification:** Sprint L shipped Yelp verification (read-only, phone-based lookup, discrepancy detection, 24-hour cache). Bing Places was deferred because the Azure API credentials needed verification. Sprint M completes the parallel implementation for Bing using the Bing Local Business Search REST API — same pattern as Yelp: name + location lookup, discrepancy comparison, `ListingVerificationRow` component, 24-hour cache in `org_integrations`. Five platforms are now verified or manual-tracked; only TripAdvisor, Apple Business Connect, and Foursquare remain manual-only.

3. **M6 — AI vs. Traditional SEO Positioning Banner:** Users who also pay for Yext, BrightLocal, or Semrush occasionally wonder what LocalVector adds. The landing page explains this well; the dashboard doesn't reinforce it at all after signup. This sprint adds a one-time, permanently-dismissible (localStorage) banner for new users — shown in the first 30 days — that explains in plain English why AI visibility is a distinct measurement from search rankings. Not marketing copy: a factual, useful explainer that anchors the product's value proposition at the moment users are most likely to question it.

4. **M1/L5 — Critical Service Test Coverage:** Three services have no unit tests despite being on the critical path for paid features: `gbp-token-refresh.ts` (Google OAuth tokens expire hourly; broken refresh = dead GBP integration for all connected customers), `cron-logger.ts` (the thing that tells you when scheduled jobs fail — untested), and `entity-auto-detect.ts` (used by Entity Health, the Sprint J page). This sprint writes unit tests for all three. These aren't checkbox tests — they test the failure scenarios that matter: what happens when the refresh token is expired, what happens when Supabase upsert fails in the cron logger, what happens when entity detection finds no match.

**Why this ordering:** M3 earns money immediately (upsell table) and requires the least new infrastructure. Bing verification completes the C2 arc started in Sprint K. M6 protects MRR from users on the fence. Service tests prevent the kind of silent failure that costs you a customer you never knew you lost.

**Estimated total implementation time:** 18–22 hours. M3 (6–8 hours) is the heaviest because the feature matrix rendering requires careful design decisions about what to show at each tier. Bing verification (4–5 hours) follows the Yelp pattern from Sprint L. M6 (2–3 hours) is a simple dismissible banner. Service tests (5–6 hours) require reading each service completely before writing a single test.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                                   — Rules 42–71 from Sprints A–L now in effect
Read CLAUDE.md                                          — Full Sprint A–L implementation inventory
Read MEMORY.md                                          — All architecture decisions through Sprint L

--- M3: Plan Feature Comparison Table ---
Read lib/plan-enforcer.ts                               — COMPLETE FILE. All gating functions.
                                                          Understand: which features exist, what
                                                          the gating logic is per plan, what the
                                                          plan enum values are (trial/starter/growth/agency).
Read app/dashboard/billing/page.tsx                     — COMPLETE FILE. Current layout: what tier
                                                          cards exist, what data is already shown,
                                                          how the current plan is displayed, where
                                                          upgrade CTAs link to.
Read app/dashboard/billing/_components/                 — ls; read every component. Understand the
                                                          BillingCard, SeatManagementCard (Sprint K),
                                                          and any tier comparison UI already present.
Read lib/supabase/database.types.ts                     — Find the plan enum/type to confirm values.
Read stripe-config.ts or lib/stripe/                    — How Stripe plans are referenced. Needed to
                                                          link upgrade CTA buttons to the correct flow.

--- C2 Phase 2: Bing Verification ---
Read app/api/integrations/verify-yelp/route.ts          — Sprint L: Yelp route. Read completely —
                                                          Bing route mirrors this with API differences.
Read app/dashboard/integrations/_components/            — ls; read ListingVerificationRow.tsx (Sprint L)
                                                          and ManualTrackingRow.tsx (Sprint K). Bing
                                                          uses ListingVerificationRow, same as Yelp.
Read app/dashboard/integrations/page.tsx                — Current state after Sprint L. How is
                                                          ListingVerificationRow wired for Yelp?
                                                          Bing follows the exact same pattern.
Read lib/integrations/platform-config.ts                — Sprint K: PLATFORM_CONFIG. Bing entry
                                                          currently has hasAutomatedSync: false.
                                                          After this sprint it gains hasVerification.

--- M6: AI vs. SEO Positioning Banner ---
Read components/ui/FirstVisitTooltip.tsx               — Sprint E: existing localStorage dismiss
                                                          infrastructure. M6 banner follows the
                                                          same pattern with a different key and
                                                          permanent (not session-only) dismissal.
Read app/dashboard/layout.tsx (or equivalent)           — Where does the main dashboard layout render?
                                                          The M6 banner is placed in the layout,
                                                          not on a specific page.
Read app/dashboard/page.tsx                             — Sprint L: SampleDataBanner. M6 banner
                                                          must be suppressed when SampleDataBanner
                                                          is showing — one banner at a time.

--- M1/L5: Service Unit Tests ---
Read lib/services/gbp-token-refresh.ts                  — COMPLETE FILE. Function signature, tables
                                                          read/written, Google OAuth endpoint used,
                                                          all error paths.
Read lib/services/cron-logger.ts                        — COMPLETE FILE. How it writes to cron_run_log,
                                                          what params it accepts, return on success/failure.
Read lib/services/entity-auto-detect.ts                 — COMPLETE FILE. What it does, return type,
                                                          any external API calls (must be mocked).
Read src/__tests__/unit/                                — ls; read 2–3 existing unit tests. Match
                                                          the project's existing test style and
                                                          mocking patterns exactly.
Read src/__fixtures__/golden-tenant.ts                  — Use these fixtures in tests, not new ones.
```

**Specifically understand before writing any code:**

- **`plan-enforcer.ts` gating shape:** Read every gating function. Understand the function signatures — do they take a plan string? An org object? A user object? The `buildFeatureMatrix()` function must call these with the exact argument shape they expect. The comparison table derives all data from these functions — it contains no hardcoded feature availability.

- **Billing page upgrade flow:** Before adding upgrade CTAs to the comparison table, understand how the current upgrade mechanism works. Is it a redirect to Stripe Checkout? A server action? A Stripe portal link? The table footer CTAs must use the same mechanism already in place. Do not introduce a new payment flow.

- **Bing Local Business Search API:** The endpoint is `GET https://dev.virtualearth.net/REST/v1/LocalSearch/?query={name}&userLocation={lat},{lng}&key={BING_MAPS_KEY}`. Auth uses a query parameter (`key=`), not a Bearer header (this differs from Yelp). The response structure is `resourceSets[0].resources[]`. Field names may vary — use optional chaining everywhere. Verify `BING_MAPS_KEY` exists in `.env.example`; if not, add it and document in DEVLOG.

- **M6 banner — two-banner rule:** The positioning banner is suppressed when `SampleDataBanner` is showing. `sampleDataActive` is computed server-side (same condition as in Sprint L: org < 14 days old AND null realityScore) and passed as a prop to `AiVsSeoBanner`. The client component reads this prop in a `useEffect` alongside the localStorage check.

- **Service test mocking strategy:** Read the existing unit tests (2–3 files) to understand the mocking patterns the project uses. Some projects use `vi.mock` for module mocking; others use `vi.stubGlobal` for fetch; others use MSW. Use whatever pattern already exists. Do not introduce a new mocking strategy unless the existing one genuinely can't cover the needed scenarios.

---

## 🏗️ Architecture — What to Build

---

### Feature 1: Plan Feature Comparison Table — M3

**The user's real question on the billing page:** "What do I actually get if I upgrade?"

**Current experience:** Three tier cards with prices, no feature breakdown. A Growth customer considering Agency has no way to answer that question without leaving the product.

**After Sprint M:** A feature comparison table below the existing tier cards shows every gated feature across all plan tiers. Derived entirely from `plan-enforcer.ts`. Zero hardcoded values.

#### Step 1: `lib/billing/feature-matrix.ts`

```typescript
/**
 * lib/billing/feature-matrix.ts
 *
 * Derives the plan feature comparison table from lib/plan-enforcer.ts.
 * Zero gating logic lives here — all availability is computed by calling
 * plan-enforcer.ts functions with each plan tier.
 *
 * AI_RULES §72: Plan feature matrix is always derived from plan-enforcer.ts,
 * never hardcoded. If plan-enforcer.ts changes, this table changes automatically.
 */

// READ plan-enforcer.ts BEFORE EDITING THE IMPORTS BELOW.
// Replace these placeholders with the actual export names from that file.
import {
  canAccessCompete,
  canAccessCitations,
  canAccessRevenueImpact,
  canAccessAgentReadiness,
  canAccessContentCalendar,
  canAccessApiIntegrations,
  canAccessTeamSeats,
  canAccessWhiteLabel,
  canAccessCustomQueries,
  canAccessWebhooks,
  // ... all gating function exports that exist
} from '@/lib/plan-enforcer';

export type PlanTier = 'trial' | 'starter' | 'growth' | 'agency';

export const PLAN_TIERS: PlanTier[] = ['trial', 'starter', 'growth', 'agency'];

export const PLAN_LABELS: Record<PlanTier, string> = {
  trial:   'Free Trial',
  starter: 'Starter',
  growth:  'Growth',
  agency:  'Agency',
};

export const PLAN_PRICES: Record<PlanTier, string> = {
  trial:   'Free',
  starter: '$29/mo',
  growth:  '$59/mo',
  agency:  'Custom',
};

export interface FeatureRow {
  label: string;
  description?: string;
  category: 'Core' | 'Intelligence' | 'Collaboration' | 'Integrations';
  /** All values derived from plan-enforcer.ts gating functions */
  availability: Record<PlanTier, boolean>;
  /** Optional per-plan limit text (e.g., "Up to 3 competitors") */
  limits?: Partial<Record<PlanTier, string>>;
}

/**
 * Build the feature matrix by calling plan-enforcer gating functions
 * for each plan tier.
 *
 * After reading plan-enforcer.ts:
 * 1. Replace placeholder imports with actual function names
 * 2. Add/remove rows to match the actual gating functions
 * 3. Wrap each call in try/catch — default to false on error
 *    (a blank cell is safer than a billing page crash)
 */
export function buildFeatureMatrix(): FeatureRow[] {
  function gate(fn: (plan: PlanTier) => boolean, tier: PlanTier): boolean {
    try { return fn(tier); } catch { return false; }
  }

  return [
    // ── Core ────────────────────────────────────────────────────────────────
    {
      label: 'AI Reality Score',
      description: 'Weekly scan measuring how accurately AI models represent your business.',
      category: 'Core',
      availability: {
        trial:   gate(canAccessRealityScore, 'trial'),
        starter: gate(canAccessRealityScore, 'starter'),
        growth:  gate(canAccessRealityScore, 'growth'),
        agency:  gate(canAccessRealityScore, 'agency'),
      },
    },
    {
      label: 'Hallucination Alerts',
      description: 'Alerts when AI models say something incorrect about your business.',
      category: 'Core',
      availability: {
        trial:   gate(canAccessAlerts, 'trial'),
        starter: gate(canAccessAlerts, 'starter'),
        growth:  gate(canAccessAlerts, 'growth'),
        agency:  gate(canAccessAlerts, 'agency'),
      },
    },

    // ── Intelligence ─────────────────────────────────────────────────────────
    {
      label: 'Competitor Analysis',
      description: 'Compare your AI visibility against competitors in your area.',
      category: 'Intelligence',
      availability: {
        trial:   gate(canAccessCompete, 'trial'),
        starter: gate(canAccessCompete, 'starter'),
        growth:  gate(canAccessCompete, 'growth'),
        agency:  gate(canAccessCompete, 'agency'),
      },
    },
    {
      label: 'Citations Tracker',
      description: 'Monitor citation sources teaching AI models about your business.',
      category: 'Intelligence',
      availability: {
        trial:   gate(canAccessCitations, 'trial'),
        starter: gate(canAccessCitations, 'starter'),
        growth:  gate(canAccessCitations, 'growth'),
        agency:  gate(canAccessCitations, 'agency'),
      },
    },
    {
      label: 'Revenue Impact Calculator',
      description: 'Estimate monthly revenue loss from AI hallucinations.',
      category: 'Intelligence',
      availability: {
        trial:   gate(canAccessRevenueImpact, 'trial'),
        starter: gate(canAccessRevenueImpact, 'starter'),
        growth:  gate(canAccessRevenueImpact, 'growth'),
        agency:  gate(canAccessRevenueImpact, 'agency'),
      },
    },
    {
      label: 'Agent Readiness',
      description: 'Check how ready your business data is for AI agent interactions.',
      category: 'Intelligence',
      availability: {
        trial:   gate(canAccessAgentReadiness, 'trial'),
        starter: gate(canAccessAgentReadiness, 'starter'),
        growth:  gate(canAccessAgentReadiness, 'growth'),
        agency:  gate(canAccessAgentReadiness, 'agency'),
      },
    },
    {
      label: 'Content Calendar',
      description: 'AI-powered occasion-driven content schedule.',
      category: 'Intelligence',
      availability: {
        trial:   gate(canAccessContentCalendar, 'trial'),
        starter: gate(canAccessContentCalendar, 'starter'),
        growth:  gate(canAccessContentCalendar, 'growth'),
        agency:  gate(canAccessContentCalendar, 'agency'),
      },
    },
    {
      label: 'Custom SOV Queries',
      description: 'Add your own search queries for Share of Voice tracking.',
      category: 'Intelligence',
      availability: {
        trial:   gate(canAccessCustomQueries, 'trial'),
        starter: gate(canAccessCustomQueries, 'starter'),
        growth:  gate(canAccessCustomQueries, 'growth'),
        agency:  gate(canAccessCustomQueries, 'agency'),
      },
    },

    // ── Collaboration ────────────────────────────────────────────────────────
    {
      label: 'Team Seats',
      description: 'Invite team members to your LocalVector workspace.',
      category: 'Collaboration',
      availability: {
        trial:   gate(canAccessTeamSeats, 'trial'),
        starter: gate(canAccessTeamSeats, 'starter'),
        growth:  gate(canAccessTeamSeats, 'growth'),
        agency:  gate(canAccessTeamSeats, 'agency'),
      },
    },
    {
      label: 'White Label Reports',
      description: 'Export branded PDF reports for clients.',
      category: 'Collaboration',
      availability: {
        trial:   gate(canAccessWhiteLabel, 'trial'),
        starter: gate(canAccessWhiteLabel, 'starter'),
        growth:  gate(canAccessWhiteLabel, 'growth'),
        agency:  gate(canAccessWhiteLabel, 'agency'),
      },
    },

    // ── Integrations ─────────────────────────────────────────────────────────
    {
      label: 'Google Business Profile Sync',
      description: 'Connect and monitor your GBP listing.',
      category: 'Integrations',
      availability: {
        trial:   gate(canAccessApiIntegrations, 'trial'),
        starter: gate(canAccessApiIntegrations, 'starter'),
        growth:  gate(canAccessApiIntegrations, 'growth'),
        agency:  gate(canAccessApiIntegrations, 'agency'),
      },
    },
    {
      label: 'Webhook Alerts',
      description: 'Send hallucination alerts to Slack, Zapier, or custom endpoints.',
      category: 'Integrations',
      availability: {
        trial:   gate(canAccessWebhooks, 'trial'),
        starter: gate(canAccessWebhooks, 'starter'),
        growth:  gate(canAccessWebhooks, 'growth'),
        agency:  gate(canAccessWebhooks, 'agency'),
      },
    },
    // Add remaining rows matching actual plan-enforcer.ts exports
  ];
}

/** Is planA lower in hierarchy than planB? */
export function isPlanLowerThan(planA: PlanTier, planB: PlanTier): boolean {
  const order: Record<PlanTier, number> = { trial: 0, starter: 1, growth: 2, agency: 3 };
  return order[planA] < order[planB];
}
```

#### Step 2: `PlanComparisonTable` — `app/dashboard/billing/_components/PlanComparisonTable.tsx`

```tsx
/**
 * PlanComparisonTable
 *
 * 5-column feature comparison: Feature | Trial | Starter | Growth | Agency
 * All availability data from buildFeatureMatrix() / plan-enforcer.ts.
 * currentPlan column is highlighted. Higher-tier CTAs in footer row.
 */

import { buildFeatureMatrix, PLAN_LABELS, PLAN_PRICES, PLAN_TIERS, isPlanLowerThan, type PlanTier } from '@/lib/billing/feature-matrix';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanComparisonTableProps {
  currentPlan: PlanTier;
  /** Existing upgrade mechanism from billing page — pass URL or action */
  upgradeHref: string;
}

export function PlanComparisonTable({ currentPlan, upgradeHref }: PlanComparisonTableProps) {
  const rows = buildFeatureMatrix();
  const categories = [...new Set(rows.map(r => r.category))];

  return (
    <div className="overflow-x-auto rounded-xl border border-border" data-testid="plan-comparison-table">
      <table className="w-full min-w-[640px] text-sm">
        {/* Header */}
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="py-4 pl-6 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Feature
            </th>
            {PLAN_TIERS.map(tier => (
              <th
                key={tier}
                className={cn(
                  'px-4 py-4 text-center',
                  tier === currentPlan && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
                )}
                data-testid={`plan-col-${tier}`}
              >
                <p className={cn('text-xs font-semibold uppercase tracking-wide', tier === currentPlan ? 'text-primary' : 'text-foreground')}>
                  {PLAN_LABELS[tier]}
                </p>
                <p className="text-[11px] text-muted-foreground">{PLAN_PRICES[tier]}</p>
                {tier === currentPlan && (
                  <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Your plan
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {categories.map(category => (
            <>
              <tr key={`cat-${category}`} className="border-b border-border/50 bg-muted/20">
                <td colSpan={5} className="py-2 pl-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground" data-testid={`category-header-${category.toLowerCase()}`}>
                  {category}
                </td>
              </tr>
              {rows.filter(r => r.category === category).map((row, idx) => (
                <tr
                  key={row.label}
                  className={cn('border-b border-border/30', idx % 2 === 0 ? 'bg-background' : 'bg-muted/10')}
                  data-testid={`feature-row-${row.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <td className="py-3 pl-6 pr-4">
                    <p className="text-sm font-medium text-foreground">{row.label}</p>
                    {row.description && <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p>}
                  </td>
                  {PLAN_TIERS.map(tier => (
                    <td key={tier} className={cn('px-4 py-3 text-center', tier === currentPlan && 'bg-primary/5')} data-testid={`cell-${row.label.toLowerCase().replace(/\s+/g, '-')}-${tier}`}>
                      {row.availability[tier] ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Included" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="Not included" />
                      )}
                      {row.limits?.[tier] && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{row.limits[tier]}</p>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>

        <tfoot>
          <tr className="border-t border-border bg-muted/20">
            <td className="py-4 pl-6 text-xs text-muted-foreground">Updates automatically when plans change.</td>
            {PLAN_TIERS.map(tier => (
              <td key={tier} className={cn('px-4 py-4 text-center', tier === currentPlan && 'bg-primary/5')}>
                {tier === currentPlan ? (
                  <span className="text-xs text-muted-foreground">Current</span>
                ) : !isPlanLowerThan(tier, currentPlan) && tier !== 'trial' ? (
                  <a href={upgradeHref} className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors" data-testid={`upgrade-cta-${tier}`}>
                    Upgrade to {PLAN_LABELS[tier]}
                  </a>
                ) : null}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
```

#### Step 3: Wire into `app/dashboard/billing/page.tsx`

```tsx
// Below the existing tier price cards, after reading the current page layout:
<section className="mt-10 space-y-4">
  <div>
    <h2 className="text-base font-semibold text-foreground">What's included in each plan</h2>
    <p className="mt-0.5 text-sm text-muted-foreground">
      Everything in lower plans is included in higher plans.
    </p>
  </div>
  <PlanComparisonTable
    currentPlan={org.plan}     // org.plan from existing data fetch
    upgradeHref={upgradeHref}  // From existing upgrade CTA logic in the page
  />
</section>
```

---

### Feature 2: Bing Places Verification — C2 Phase 2

Same pattern as Sprint L's Yelp verification. Key differences: Bing uses query-param auth (not Bearer), name+location matching (not phone-based), and Bing's response shape (`resourceSets[0].resources[]`).

#### Step 1: `app/api/integrations/verify-bing/route.ts`

```typescript
/**
 * POST /api/integrations/verify-bing
 *
 * Bing Local Business Search verification.
 * Bing API: GET https://dev.virtualearth.net/REST/v1/LocalSearch/
 *   ?query={name}&userLocation={lat},{lng}&key={BING_MAPS_KEY}
 *
 * Auth: key= query parameter (NOT Bearer header — unlike Yelp).
 * Match strategy: name + location (Bing does not support phone lookup).
 * Cache: 24 hours in org_integrations, same as Yelp.
 *
 * AI_RULES §71: Auth check first, rate-limit cache before API call,
 * BING_MAPS_KEY guard with Sentry on missing key, store result in DB.
 */

import { createClient } from '@/lib/supabase/server';
import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';

const BING_LOCAL_SEARCH = 'https://dev.virtualearth.net/REST/v1/LocalSearch/';
const RATE_LIMIT_HOURS = 24;

export async function POST(_request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch org — adjust column name to prod_schema.sql
    const { data: org } = await supabase.from('orgs').select('id, name').eq('owner_id', user.id).single();
    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

    // Fetch location — adjust table and column names to prod_schema.sql
    const { data: location } = await supabase
      .from('locations')
      .select('name, phone, address, city, state, zip, lat, lng')
      .eq('org_id', org.id)
      .single();

    if (!location?.name) return NextResponse.json({ error: 'No location data' }, { status: 400 });

    // 24-hour cache check
    const { data: existing } = await supabase
      .from('org_integrations')
      .select('verified_at, verification_result')
      .eq('org_id', org.id)
      .eq('platform', 'bing')
      .maybeSingle();

    if (existing?.verified_at) {
      const hrs = (Date.now() - new Date(existing.verified_at).getTime()) / 3_600_000;
      if (hrs < RATE_LIMIT_HOURS) return NextResponse.json({ cached: true, result: existing.verification_result });
    }

    const bingKey = process.env.BING_MAPS_KEY;
    if (!bingKey) {
      Sentry.captureException(new Error('BING_MAPS_KEY not configured'), { tags: { component: 'verify-bing' } });
      return NextResponse.json({ error: 'Bing API not configured' }, { status: 503 });
    }

    // Build search URL
    const params = new URLSearchParams({ query: location.name, key: bingKey, maxResults: '5' });
    if (location.lat != null && location.lng != null) {
      params.set('userLocation', `${location.lat},${location.lng}`);
    } else if (location.city) {
      params.set('userLocation', location.city);
    }

    const bingRes = await fetch(`${BING_LOCAL_SEARCH}?${params}`);
    if (!bingRes.ok) {
      Sentry.captureException(new Error(`Bing API ${bingRes.status}`), { tags: { component: 'verify-bing' }, extra: { status: bingRes.status } });
      return NextResponse.json({ error: 'Bing API request failed' }, { status: 502 });
    }

    const bingData = await bingRes.json();
    const resources: Record<string, unknown>[] = bingData?.resourceSets?.[0]?.resources ?? [];
    const business = findBestBingMatch(resources, location.name);

    const verifiedAt = new Date().toISOString();

    if (!business) {
      const result = { found: false, discrepancies: [], verifiedAt };
      await supabase.from('org_integrations').upsert({ org_id: org.id, platform: 'bing', verified_at: verifiedAt, verification_result: result, status: 'verified', has_discrepancy: false });
      return NextResponse.json({ cached: false, result });
    }

    const discrepancies = detectBingDiscrepancies(business, location);
    const result = {
      found: true,
      bingName:    getString(business.name),
      bingAddress: formatBingAddress(business.Address as Record<string, string> | undefined),
      bingPhone:   getString(business.PhoneNumber ?? business.phone),
      bingUrl:     getString(business.Website ?? business.website),
      discrepancies,
      verifiedAt,
    };

    await supabase.from('org_integrations').upsert({ org_id: org.id, platform: 'bing', verified_at: verifiedAt, verification_result: result, status: 'verified', has_discrepancy: discrepancies.length > 0 });
    return NextResponse.json({ cached: false, result });

  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'verify-bing' } });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getString(v: unknown): string { return typeof v === 'string' ? v : ''; }

function findBestBingMatch(resources: Record<string, unknown>[], targetName: string): Record<string, unknown> | null {
  if (!resources.length) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(targetName);
  return resources.find(r => {
    const n = norm(getString(r.name));
    return n.includes(target) || target.includes(n);
  }) ?? resources[0];
}

function formatBingAddress(addr: Record<string, string> | undefined): string {
  if (!addr) return '';
  return [addr.addressLine, addr.locality, addr.adminDistrict, addr.postalCode].filter(Boolean).join(', ');
}

interface BingLocation { name: string; phone?: string | null; address?: string | null; }

function detectBingDiscrepancies(biz: Record<string, unknown>, loc: BingLocation) {
  const issues: { field: string; bingValue: string; localValue: string; severity: 'high' | 'low' }[] = [];

  // Name (fuzzy)
  const bingName = norm(getString(biz.name));
  const localName = norm(loc.name);
  if (localName && bingName && !bingName.includes(localName) && !localName.includes(bingName)) {
    issues.push({ field: 'Business name', bingValue: getString(biz.name), localValue: loc.name, severity: 'high' });
  }

  // Phone (digits-only comparison)
  const bingPhone = getString(biz.PhoneNumber ?? biz.phone).replace(/\D/g, '').slice(-10);
  const localPhone = (loc.phone ?? '').replace(/\D/g, '').slice(-10);
  if (bingPhone && localPhone && bingPhone !== localPhone) {
    issues.push({ field: 'Phone number', bingValue: getString(biz.PhoneNumber ?? biz.phone), localValue: loc.phone ?? '', severity: 'high' });
  }

  return issues;

  function norm(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }
}
```

#### Step 2: Update `integrations/page.tsx` and `platform-config.ts`

Follow the exact pattern established for Yelp in Sprint L — load Bing cached verification result from DB, render `ListingVerificationRow` with `platform="bing"` and `verifyEndpoint="/api/integrations/verify-bing"`. In `platform-config.ts`, add `hasVerification: true` and `verifyEndpoint` to the Bing entry.

**Check `ListingVerificationRow` for hardcoded "Yelp" text.** If the discrepancy section says "Fix on Yelp →", update it to use `platformLabel` prop dynamically: `Fix on {platformLabel} →`. This is required for Bing compatibility.

---

### Feature 3: AI vs. Traditional SEO Positioning Banner — M6

#### Step 1: `app/dashboard/_components/AiVsSeoBanner.tsx`

```tsx
'use client';

/**
 * AiVsSeoBanner
 *
 * One-time positioning banner for new users (first 30 days).
 * Permanently dismissible via localStorage ('lv_ai_vs_seo_dismissed').
 * Suppressed when SampleDataBanner is active — one banner at a time.
 *
 * AI_RULES §73: Factual, no competitive disparagement, no superlatives.
 * Copy explains what LocalVector measures vs. what traditional SEO tools measure.
 */

import { useState, useEffect } from 'react';
import { Layers, X } from 'lucide-react';

const STORAGE_KEY = 'lv_ai_vs_seo_dismissed';

export function AiVsSeoBanner({ sampleDataActive }: { sampleDataActive: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sampleDataActive) { setVisible(false); return; }
    try {
      setVisible(localStorage.getItem(STORAGE_KEY) !== 'true');
    } catch {
      setVisible(false);
    }
  }, [sampleDataActive]);

  if (!visible) return null;

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* non-critical */ }
    setVisible(false);
  }

  return (
    <div className="mb-5 rounded-lg border border-violet-200 bg-violet-50 p-4" role="note" data-testid="ai-vs-seo-banner">
      <div className="flex items-start gap-3">
        <Layers className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-violet-900">
            LocalVector measures a layer traditional SEO tools don't
          </p>
          <p className="mt-1 text-xs text-violet-700 leading-relaxed">
            Traditional SEO tools track your Google search rankings.
            LocalVector tracks what AI models say about your business when customers ask them directly.
            These are separate measurements — your{' '}
            <span className="font-medium">Reality Score</span>{' '}
            reflects AI visibility, which isn't captured by search ranking tools.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="ml-2 shrink-0 rounded text-violet-400 hover:text-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
          aria-label="Dismiss this message"
          data-testid="ai-vs-seo-dismiss"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
```

#### Step 2: Wire into dashboard layout

```typescript
// In app/dashboard/layout.tsx server component:
// Compute isNewUser (same pattern as isSampleMode from Sprint L, but 30-day window):
const isNewUser = org?.created_at
  ? (Date.now() - new Date(org.created_at).getTime()) < 30 * 24 * 60 * 60 * 1000
  : false;

// isSampleMode: org < 14 days AND null realityScore (pass to AiVsSeoBanner)
// Use the same computation as dashboard/page.tsx if org data is shared
const isSampleMode = isNewOrg && realityScore === null;
```

```tsx
{/* In layout JSX before {children}: */}
{isNewUser && <AiVsSeoBanner sampleDataActive={isSampleMode} />}
```

---

### Feature 4: Critical Service Unit Tests — M1/L5

**Read each service file completely before writing a single test.**

The test stubs below describe *intent*. The actual implementations depend entirely on the real service code — adapt function names, parameters, return types, and mocking targets to what you find.

#### `src/__tests__/unit/gbp-token-refresh.test.ts` — 12 tests

Critical paths to cover:
- Happy path: valid refresh token → new access token stored in Supabase
- Expired token: Google returns `invalid_grant` → service returns null or appropriate error, Sentry called
- Network failure: fetch throws → Sentry called, service does not throw
- Supabase write failure: token refreshed but not stored → Sentry called, returns gracefully
- Missing token: org has no refresh token → skipped safely without API call
- Token expiry timestamp: `expires_in` from Google correctly converted and stored

#### `src/__tests__/unit/cron-logger.test.ts` — 8 tests

Critical paths to cover:
- Success record written with correct status, timestamp, org_id
- Failure record includes error message
- Duration written when timing provided
- Sentry called when Supabase write fails
- Service does NOT throw when Supabase fails (returns gracefully)
- Two concurrent calls produce two separate records (no overwrite)

#### `src/__tests__/unit/entity-auto-detect.test.ts` — 10 tests

Critical paths to cover:
- Returns detected entity when business name matches
- Returns null/empty result when no match found
- Handles ambiguous/common business names without crashing
- Sentry called on external API failure
- Service returns gracefully (does not throw) on API unavailability
- If result includes confidence score, it is between 0 and 1
- Golden-tenant fixture produces a deterministic result
- Concurrent calls for different orgs do not interfere

---

## 🧪 Testing

### Test File 1: `src/__tests__/unit/plan-comparison-table.test.tsx` — 16 tests

```
describe('buildFeatureMatrix()')
  1.  Returns a non-empty array
  2.  Every row has: label, category, availability (all 4 tiers are booleans)
  3.  No row has availability hardcoded — each availability.{tier} is boolean (not a literal)
  4.  Trial plan has fewer true availabilities than Growth plan
  5.  Agency plan has equal-or-more true availabilities than Growth
  6.  All category values are in the defined union
  7.  Row labels are unique

describe('PlanComparisonTable')
  8.  data-testid="plan-comparison-table" present
  9.  4 plan column headers rendered (data-testid="plan-col-{tier}")
  10. currentPlan="growth": plan-col-growth has "Your plan" text
  11. Check icon (aria-label="Included") for available features on currentPlan
  12. Dash icon (aria-label="Not included") for unavailable features
  13. Upgrade CTA (data-testid="upgrade-cta-agency") visible for Growth user
  14. No upgrade CTA for lower tiers when currentPlan="growth"
  15. Category group headers render (data-testid="category-header-core")
  16. isPlanLowerThan('starter', 'growth') === true; isPlanLowerThan('agency', 'growth') === false
```

### Test File 2: `src/__tests__/unit/bing-verification.test.ts` — 10 tests

```
1.  findBestBingMatch: returns matching resource by name
2.  findBestBingMatch: falls back to first resource when no name match
3.  findBestBingMatch: returns null for empty array
4.  formatBingAddress: assembles from Bing address fields correctly
5.  formatBingAddress: no "undefined" when fields missing
6.  detectBingDiscrepancies: empty array when name and phone match
7.  detectBingDiscrepancies: flags phone digit mismatch
8.  detectBingDiscrepancies: phone normalization (+1 prefix) avoids false positives
9.  detectBingDiscrepancies: fuzzy name match — "Charcoal N Chill" vs "Charcoal & Chill" → no flag
10. detectBingDiscrepancies: name mismatch — "Best Bites" vs "Charcoal N Chill" → flagged
```

### Test File 3: `src/__tests__/unit/ai-vs-seo-banner.test.tsx` — 8 tests

```
1.  sampleDataActive=false, not dismissed: data-testid="ai-vs-seo-banner" visible
2.  sampleDataActive=true: banner NOT rendered
3.  Contains "AI models" in rendered text
4.  Contains "Reality Score" in rendered text
5.  Click dismiss: banner disappears
6.  Click dismiss: localStorage 'lv_ai_vs_seo_dismissed' set to 'true'
7.  localStorage already 'true' on mount: banner not shown
8.  data-testid="ai-vs-seo-dismiss" present on dismiss button
```

### E2E Test File: `src/__tests__/e2e/sprint-m-smoke.spec.ts` — 18 tests

```
Plan Comparison Table:
1.  /dashboard/billing: data-testid="plan-comparison-table" visible
2.  4 plan column headers visible
3.  At least 8 feature rows render
4.  "Your plan" badge on currentPlan column
5.  Category group headers present (at least Core and Intelligence)
6.  Upgrade CTA present for at least one higher tier

Bing Verification:
7.  /dashboard/integrations: listing-verification-bing present
8.  bing-verify-btn present and enabled
9.  Click verify: loading state shown
10. After verification: result section rendered
11. bing-status-ok or bing-status-discrepancy or bing-status-not-found visible

AI vs SEO Banner:
12. Dashboard: ai-vs-seo-banner visible for new org (< 30 days)
13. Banner NOT visible when sample-data-banner showing
14. Click dismiss: banner disappears
15. Reload: banner does not reappear after dismiss
16. Banner text contains "AI models" and "Reality Score"

Service tests (CI gate):
17. npx vitest run gbp-token-refresh.test.ts passes (0 failures)
18. npx vitest run cron-logger.test.ts AND entity-auto-detect.test.ts pass (0 failures)
```

### Run commands

```bash
npx vitest run src/__tests__/unit/plan-comparison-table.test.tsx
npx vitest run src/__tests__/unit/bing-verification.test.ts
npx vitest run src/__tests__/unit/ai-vs-seo-banner.test.tsx
npx vitest run src/__tests__/unit/gbp-token-refresh.test.ts
npx vitest run src/__tests__/unit/cron-logger.test.ts
npx vitest run src/__tests__/unit/entity-auto-detect.test.ts
npx vitest run                                                      # ALL Sprints A–M — 0 regressions
npx playwright test src/__tests__/e2e/sprint-m-smoke.spec.ts
npx tsc --noEmit                                                    # 0 new type errors
```

---

## 📂 Files to Create / Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/billing/feature-matrix.ts` | **CREATE** | `buildFeatureMatrix()` from plan-enforcer; `isPlanLowerThan()` |
| 2 | `app/dashboard/billing/_components/PlanComparisonTable.tsx` | **CREATE** | 5-column comparison table with category groups and upgrade CTAs |
| 3 | `app/dashboard/billing/page.tsx` | **MODIFY** | Add `PlanComparisonTable` below tier cards |
| 4 | `app/api/integrations/verify-bing/route.ts` | **CREATE** | Bing Local Business Search verification; 24-hr cache; Sentry |
| 5 | `app/dashboard/integrations/page.tsx` | **MODIFY** | Add Bing `ListingVerificationRow`; load Bing cached result |
| 6 | `lib/integrations/platform-config.ts` | **MODIFY** | `hasVerification: true` + `verifyEndpoint` for Bing |
| 7 | `app/dashboard/integrations/_components/ListingVerificationRow.tsx` | **MODIFY** | Use `platformLabel` prop in "Fix on {platform} →" link |
| 8 | `app/dashboard/_components/AiVsSeoBanner.tsx` | **CREATE** | Violet positioning banner; permanent localStorage dismiss |
| 9 | `app/dashboard/layout.tsx` (or equivalent) | **MODIFY** | `AiVsSeoBanner` for new users; pass `sampleDataActive` prop |
| 10 | `src/__tests__/unit/plan-comparison-table.test.tsx` | **CREATE** | 16 tests |
| 11 | `src/__tests__/unit/bing-verification.test.ts` | **CREATE** | 10 tests |
| 12 | `src/__tests__/unit/ai-vs-seo-banner.test.tsx` | **CREATE** | 8 tests |
| 13 | `src/__tests__/unit/gbp-token-refresh.test.ts` | **CREATE** | 12 tests |
| 14 | `src/__tests__/unit/cron-logger.test.ts` | **CREATE** | 8 tests |
| 15 | `src/__tests__/unit/entity-auto-detect.test.ts` | **CREATE** | 10 tests |
| 16 | `src/__tests__/e2e/sprint-m-smoke.spec.ts` | **CREATE** | 18 E2E tests |

**New API routes:** 1 (verify-bing)
**New migrations:** 0 (verification columns added in Sprint L migration)

---

## 🧠 Edge Cases to Handle

1. **`buildFeatureMatrix()` called with an unrecognized plan.** Wrap every gating call in the `gate()` helper that returns `false` on error — a missing feature cell is safer than a billing page crash.

2. **Agency upgrade CTA.** Agency likely goes to a contact/sales flow, not Stripe Checkout. Read the existing billing page's Agency CTA before wiring the table footer. The `upgradeHref` prop accommodates this — pass the correct URL for each tier's upgrade mechanism.

3. **`PlanComparisonTable` on mobile.** `overflow-x-auto` on the wrapper handles scroll. Add `sticky left-0 bg-background` to the feature label cell so the feature name stays readable while scrolling right.

4. **Bing API response field names.** The field names (`name`, `PhoneNumber`, `Address`, `addressLine`, `locality`) are based on Bing Maps REST API v7 docs but must be verified against a live response. Use optional chaining throughout (`business?.PhoneNumber ?? business?.phone`). Log the raw response shape to a Sentry breadcrumb on first call to help diagnose any field name discrepancies.

5. **Bing name-based matching false positives.** Unlike Yelp (phone), Bing matches by name + location. Similar business names nearby may return the wrong match. Log to Sentry breadcrumbs when `findBestBingMatch` falls back to `resources[0]` (no name match found) — this signals a potential false match.

6. **`AiVsSeoBanner` / `SampleDataBanner` co-existence.** The layout computes `isSampleMode` (org < 14 days + null score) and passes it to `AiVsSeoBanner` as `sampleDataActive`. If the layout doesn't currently fetch `realityScore`, add that fetch or derive it differently — but the condition must be accurate. If `isSampleMode` can't be determined in the layout, default `sampleDataActive={false}` (show the AI vs SEO banner) — that's less harmful than always suppressing it.

7. **`AiVsSeoBanner` suppression after 30 days.** The 30-day check is server-side in the layout (`isNewUser`). After 30 days, the component isn't rendered at all — no localStorage check needed for old users. This is intentional: the banner is never shown to users older than 30 days even if they never dismissed it.

8. **`gbp-token-refresh.ts` batch vs. single-org processing.** If the service processes all orgs in one call (batch), test that a single org's failure does not prevent others from being processed. If it's single-org, test that it fails safely and the caller can handle the error.

9. **`cron-logger.ts` `created_at` precision.** Cron logs need accurate timestamps. If the test checks `created_at`, freeze `Date.now()` with `vi.setSystemTime()` to get a deterministic value. Assert the timestamp is within 1 second of the frozen time.

10. **`entity-auto-detect.ts` external API in tests.** If the service calls Perplexity, OpenAI, or another external API, mock the entire fetch call. Never hit real external APIs in unit tests — CI should run offline. Verify the mock is called with the expected URL before asserting the service's return value.

11. **`ListingVerificationRow` platform-specific label update.** When fixing the hardcoded "Fix on Yelp →" text, verify the change doesn't break the existing Yelp E2E test from Sprint L (`sprint-l-smoke.spec.ts` test #13: `yelp-claim-link` present). The link should still render for Yelp — just with the dynamic label.

12. **`buildFeatureMatrix()` missing gating functions.** If `plan-enforcer.ts` exports functions that aren't in the template rows (e.g., `canAccessPageAudits`, `canAccessProofTimeline`), add rows for them. If rows are in the template but no corresponding gating function exists in `plan-enforcer.ts`, remove those rows. Log any such discrepancies in DEVLOG.

---

## 🚫 What NOT to Do

1. **DO NOT hardcode any feature availability in `buildFeatureMatrix()` or `PlanComparisonTable`.** Every cell must call a gating function from `plan-enforcer.ts`. If a gating function doesn't exist, don't show the feature.
2. **DO NOT use the `AiVsSeoBanner` for marketing or competitive claims.** AI_RULES §73: factual measurement distinctions only. No "unlike Yext" framing, no fear tactics, no superlatives.
3. **DO NOT show `AiVsSeoBanner` when `SampleDataBanner` is active.** One banner at a time. The `sampleDataActive` prop is the gate.
4. **DO NOT call Bing API at page render time.** Same rule as Yelp (AI_RULES §71): verification is user-triggered via POST.
5. **DO NOT write service tests that only cover the happy path.** AI_RULES §74: failure scenarios are required for critical services. At minimum: external API failure, Sentry called on error, service returns gracefully without throwing.
6. **DO NOT skip reading the three service files before writing their tests.** The test stubs describe intent — the implementations depend entirely on what's in the actual files.
7. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).
8. **DO NOT modify `middleware.ts`** (AI_RULES §6).
9. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
10. **DO NOT introduce a new payment flow for the upgrade CTAs in `PlanComparisonTable`.** Use the existing upgrade mechanism from the current billing page.

---

## ✅ Definition of Done

**Plan Feature Comparison Table:**
- [ ] `lib/billing/feature-matrix.ts` created; all rows derive from `plan-enforcer.ts` gating functions
- [ ] `gate()` helper wraps all gating calls; no crash on error
- [ ] `PlanComparisonTable` renders 4 plan columns; currentPlan highlighted with "Your plan"
- [ ] Category group headers separate rows; check/dash icons for availability
- [ ] Upgrade CTAs for plans above currentPlan; correct mechanism used
- [ ] Table on billing page below existing tier cards
- [ ] `plan-comparison-table.test.tsx` — 16 tests passing

**Bing Verification:**
- [ ] `verify-bing` route: auth, rate-limit, Sentry, Bing API, discrepancy detection, DB upsert
- [ ] `findBestBingMatch()` returns name-matched result or first fallback
- [ ] `detectBingDiscrepancies()` catches phone and name mismatches
- [ ] `ListingVerificationRow` renders for Bing; uses `platformLabel` for dynamic "Fix on {platform}" text
- [ ] `platform-config.ts` updated: `hasVerification: true`, `verifyEndpoint` for Bing
- [ ] `bing-verification.test.ts` — 10 tests passing

**AI vs SEO Positioning Banner:**
- [ ] `AiVsSeoBanner` renders for new orgs (< 30 days); not rendered after 30 days
- [ ] Suppressed when `sampleDataActive` is true
- [ ] Permanent dismiss via `lv_ai_vs_seo_dismissed` localStorage key
- [ ] Copy is factual; mentions "AI models" and "Reality Score"; no competitive disparagement
- [ ] `ai-vs-seo-banner.test.tsx` — 8 tests passing

**Service Tests:**
- [ ] `gbp-token-refresh.test.ts` — 12 tests; expired token + network failure + Supabase failure covered
- [ ] `cron-logger.test.ts` — 8 tests; failure path + Sentry covered
- [ ] `entity-auto-detect.test.ts` — 10 tests; not-found + API failure covered

**All tests:**
- [ ] `npx vitest run` — ALL Sprints A–M passing, zero regressions
- [ ] `sprint-m-smoke.spec.ts` — 18 E2E tests passing
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry

```markdown
## [DATE] — Sprint M: Conversion, Verification & Reliability (Completed)

**Plan Feature Comparison Table (M3):**
- plan-enforcer.ts gating functions used: [list actual names]
- Total feature rows: [count]
- Categories rendered: [list]
- Upgrade CTA mechanism: [Stripe Checkout redirect / portal link / contact form for Agency]
- Gating functions in plan-enforcer.ts NOT added to table (why): [list or "none"]
- Rows in template NOT in plan-enforcer.ts (removed): [list or "none"]

**Bing Verification (C2 Phase 2):**
- BING_MAPS_KEY env var: [already present / added to .env.example]
- Bing response shape verified: [against live API call / against docs only]
- findBestBingMatch fallback rate in testing: [0 / rare / frequent — document if frequent]
- ListingVerificationRow "Fix on {platform}" fix: [applied / was already dynamic]

**AI vs SEO Banner (M6):**
- localStorage key: lv_ai_vs_seo_dismissed
- Dashboard layout file modified: [file path]
- org.created_at + realityScore available in layout: [yes / fetched separately]
- sampleDataActive passed to banner from: [layout server component / page.tsx via context]

**Service Tests (M1/L5):**
- gbp-token-refresh.ts actual function signature: [describe]
- cron-logger.ts actual function signature: [describe]
- entity-auto-detect.ts external API calls: [yes (mocked with X) / no (pure function)]
- Mocking patterns used: [vi.stubGlobal / vi.mock / MSW]

**Tests:** 64 Vitest + 18 Playwright; 0 regressions Sprints A–M
**Cumulative (A–M):** [N] Vitest + [N] Playwright

**Remaining open items (deferred to Sprint N):**
- H2: Settings page expansion (scan model selection, custom SOV queries, scan day preference)
- N2: On-demand AI Answer Preview widget (the product's highest-impact "wow" feature)
- N3: Hallucination correction follow-up scan (closes the customer feedback loop)
```

---

## 🔮 AI_RULES Update

```markdown
## 72. 📊 Plan Feature Matrix — Always Derived from plan-enforcer.ts (Sprint M)

lib/billing/feature-matrix.ts derives all plan availability from lib/plan-enforcer.ts
gating functions. No feature availability is hardcoded in the comparison table.

Rules:
- Every row in buildFeatureMatrix() must have a corresponding gating function in plan-enforcer.ts.
- Every gating function in plan-enforcer.ts should have a corresponding row in buildFeatureMatrix().
- When plan-enforcer.ts gains a new gating function, add the row. When one is removed, remove the row.
- Use the gate() helper to wrap all calls — billing page must never crash on a gating function error.
- PlanComparisonTable upgrade CTAs use the existing billing upgrade mechanism only.
  Never introduce a new payment flow.

## 73. 📢 In-App Positioning Copy — Factual Only (Sprint M)

AiVsSeoBanner and any future in-product positioning copy follows these rules:

1. No competitive disparagement — no negative claims about any named competitor.
2. No superlatives — no "only", "best", "unlike anyone else".
3. Factual measurement distinctions only — what LocalVector measures vs. what other tools measure.
4. No urgency or fear tactics.
5. Copy must be reviewed for accuracy before each release. If the competitive landscape changes,
   update the copy.

Approved framing: "LocalVector tracks what AI models say about your business.
Traditional SEO tools track search rankings. These are different measurements."

## 74. 🔑 Service Unit Tests — Failure Scenarios Required (Sprint M)

Unit tests for critical-path services must include all of:
1. External API failure (network error, non-200 response) → Sentry called
2. Service returns gracefully (null or error result) — does not throw unhandled exception
3. Supabase write failure → Sentry called, state not left inconsistent
4. Tests that only cover the happy path are considered incomplete for critical services.

Critical services currently tested: gbp-token-refresh, cron-logger, entity-auto-detect.
When a new critical service is added, tests covering all four failure paths are required
before the service ships to production.
```

---

## 📚 Git Commit

```bash
git add -A
git commit -m "Sprint M: Conversion, Verification & Reliability

Plan Feature Comparison Table (M3):
- lib/billing/feature-matrix.ts: buildFeatureMatrix() derived from plan-enforcer.ts;
  isPlanLowerThan(); gate() helper for safe gating calls
- PlanComparisonTable: 5-column; category groups; check/dash; upgrade CTAs; sticky labels
- billing/page.tsx: comparison table below tier cards

Bing Places Verification (C2 Phase 2):
- /api/integrations/verify-bing: name+location matching; 24-hr cache; Sentry; DB upsert
- findBestBingMatch(), detectBingDiscrepancies(), formatBingAddress()
- integrations/page.tsx: ListingVerificationRow for Bing; cached result from DB
- platform-config.ts: hasVerification: true + verifyEndpoint for Bing
- ListingVerificationRow: dynamic 'Fix on {platformLabel}' link

AI vs SEO Banner (M6):
- AiVsSeoBanner: violet; permanent localStorage dismiss (lv_ai_vs_seo_dismissed)
- Suppressed when SampleDataBanner active (one banner at a time)
- dashboard/layout.tsx: shown for orgs < 30 days old

Service Tests (M1/L5):
- gbp-token-refresh.test.ts: 12 tests (happy path + expired + network fail + Supabase fail)
- cron-logger.test.ts: 8 tests (success + failure + Sentry + concurrent writes)
- entity-auto-detect.test.ts: 10 tests (found + not-found + API failure + golden-tenant fixture)

Tests: 64 Vitest + 18 Playwright; 0 regressions Sprints A–M
AI_RULES: 72 (feature matrix from plan-enforcer), 73 (positioning copy factual only),
           74 (service tests require failure scenarios)"

git push origin main
```

---

## 🏁 Sprint Outcome

Sprint M closes the last four open findings from the February 2026 analysis that have revenue or reliability consequences. After this sprint, the complete finding list is resolved.

**Plan Feature Comparison Table** — A Growth plan user can now answer "is Agency worth it?" without leaving the dashboard. The table shows every gated feature across all four plan tiers. Because it derives from `plan-enforcer.ts`, it updates automatically when features are added, removed, or regated — no maintenance required. The "Your plan" highlight and upgrade CTAs create a natural, low-pressure path to upgrading.

**Bing Verification** — Bing Places joins Yelp as a verifiable listing platform. Users can click "Verify now" on Bing to see what Bing is displaying about their business and flag discrepancies against their known data. The 24-hour cache prevents API overuse. Five of the six listing platforms now have real verification (GBP, Yelp, Bing) or honest manual tracking (TripAdvisor, Apple Business Connect, Foursquare).

**AI vs SEO Banner** — New users who are questioning LocalVector's differentiation from their existing SEO tools get a single, factual explanation — once, in the first 30 days, permanently dismissible when they've absorbed it. No marketing copy. No competitor disparagement. Just: "your Reality Score measures what AI models say, which isn't the same thing as your Google ranking."

**Service Tests** — Three services on the critical path for paid features now have unit tests covering happy paths and the four failure scenarios that matter most: external API failure, Sentry called on error, graceful return without throwing, Supabase write failure. AI_RULES §74 makes this a permanent standard — any future critical service without failure scenario tests will fail code review.

**The February 2026 analysis is now fully resolved.** Every Critical, High, and Medium finding is addressed across Sprints A–M. The remaining open items are Nice-to-Haves (N1–N4) that represent new capability rather than debt.

**What's next — Sprint N:** The first sprint that is purely additive — no debt, no repairs. Three items: (1) **H2 — Settings expansion** (scan model selection, custom SOV query seeds, scan day preference — the highest-value missing user controls), (2) **N2 — On-demand AI Answer Preview** (type a query, see what three AI models say about your business right now — the product's highest "wow factor" feature), and (3) **N3 — Correction follow-up scan** (automated re-scan 2 weeks after a hallucination correction, showing the user whether their fix worked — the strongest retention signal available).
