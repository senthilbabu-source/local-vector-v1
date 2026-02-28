# Sprint L — Retention & Onboarding: Sample Data Mode, Listings Verification & Tour Completion

> **Claude Code Prompt — Bulletproof Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisites:** Sprints A–K must be fully merged and all tests passing. Sprint L spans frontend, server actions, and one new cron route — no new DB tables beyond what's noted.

---

## 🎯 Objective

Sprint L addresses the three highest-churn-risk gaps that remain after Sprints A–K. Each one targets a specific moment in the user journey where a paying customer currently hits a wall.

**The problem each gap creates and what Sprint L does about it:**

1. **C4 — Sample Data Mode:** A customer signs up on a Monday. They pay. They're excited. They open the dashboard and see blank cards and this message: *"Your first automated scan runs Sunday — check back Monday."* Six days of nothing. The product has all the infrastructure it needs — Sentry, Supabase, Stripe — but nothing to show. Churn risk is highest in the first 7 days, and this is the reason. After Sprint L: the dashboard immediately shows a realistic sample dataset drawn from the golden-tenant fixture, watermarked with a dismissible "Sample Data" banner. The user understands what the product will look like when real data arrives. Every card has something in it. The wait feels like anticipation instead of abandonment.

2. **C2 Phase 2 — Listings Verification (Yelp Fusion):** Sprint K made the UI honest — five platforms now show "Manual tracking" instead of a fake green checkmark. Sprint L takes the next real step: wiring the Yelp Fusion API to *verify* that the business data Yelp shows matches what LocalVector knows to be true. This is a read-only integration (Yelp's public API is read-only — we fetch, not push). The result is a `VerificationRow` that shows exactly what Yelp is currently displaying — name, address, phone, hours — and flags any discrepancies against the org's verified data. Bing Places verification follows the same pattern using the Bing Local Business Search API. Apple Business Connect and TripAdvisor are scoped as "manual URL tracking only" with a placeholder for future API access, because their APIs don't support the read/verify pattern cleanly.

3. **M2 — GuidedTour Completion:** Sprint E specified three new tour steps (Share of Voice, Citations, Revenue Impact) that were not in the original 5-step tour. Sprint E also delivered the `FirstVisitTooltip` per-page banners. Sprint L completes the GuidedTour side: verifies the 3 steps were added, adds them if not, and verifies the `data-testid` attributes on the nav items they target. This closes the last known onboarding gap from the February 2026 analysis.

**Why this ordering:** Sample data (C4) is the highest-impact item — it directly reduces day-1 churn for every new signup going forward. Listings verification (C2 Phase 2) is scoped to what's actually achievable with available APIs. Tour completion (M2) is the lowest-effort item and closes the last open M-priority finding.

**Estimated total implementation time:** 22–28 hours. Sample data mode (12–14 hours) is the most complex because it touches every dashboard card and requires a careful data-shaping layer. Listings verification (6–8 hours) requires the Yelp Fusion API integration plus the verification UI. Tour completion (3–4 hours) is verify-and-add.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                                   — Rules 42–69 from Sprints A–K now in effect
Read CLAUDE.md                                          — Full Sprint A–K implementation inventory
Read MEMORY.md                                          — All architecture decisions through Sprint K

--- C4: Sample Data Mode ---
Read app/dashboard/page.tsx                             — COMPLETE FILE. Current null-state handling
                                                          (lines 152–165 or wherever the empty state is).
                                                          What does the page currently render when
                                                          realityScore === null? What data fetches exist?
                                                          What prop shapes do each card component accept?
Read app/dashboard/_components/                         — ls; read every component that appears on
                                                          dashboard/page.tsx. Understand each component's
                                                          props interface — these must accept sample data
                                                          in the same shape as real data.
Read src/__fixtures__/golden-tenant.ts                  — COMPLETE FILE. All sample data available.
                                                          Sprint D added revenue config. Sprint E added
                                                          dental fixture. The restaurant fixture is the
                                                          sample data source for dashboard/page.tsx.
Read supabase/seed.sql                                  — Confirm data shapes match what golden-tenant.ts
                                                          exports. The seed data is the fixture data.
Read lib/supabase/database.types.ts                     — TypeScript DB types. Sample data must match
                                                          these types exactly — no `as any`.

--- C2 Phase 2: Listings Verification ---
Read app/dashboard/integrations/                        — ls; read every file including:
                                                          page.tsx, actions.ts, _components/PlatformRow.tsx
                                                          _components/ManualTrackingRow.tsx (Sprint K)
Read lib/integrations/platform-config.ts                — Sprint K: PLATFORM_CONFIG, hasAutomatedSync.
                                                          Verify it exists and has the right shape.
Read supabase/prod_schema.sql                           — integrations or org_integrations table:
                                                          Exact columns for storing verification results
                                                          (verified_name, verified_address, discrepancy_flag, etc.)
                                                          If no verification columns exist, note it — a migration
                                                          may be needed.
Read .env.example (or equivalent)                       — What env vars already exist? Check for:
                                                          YELP_API_KEY, BING_MAPS_KEY, or equivalent.
                                                          If not present, the verification feature needs
                                                          an env var setup step documented in DEVLOG.

--- M2: GuidedTour ---
Read app/dashboard/_components/GuidedTour.tsx           — COMPLETE FILE. Current step count (should be 5
                                                          or 8 depending on Sprint E completion). Tour
                                                          library used. Step object format.
Read components/layout/Sidebar.tsx                      — Verify data-testid attributes:
                                                          nav-share-of-voice, nav-revenue-impact,
                                                          nav-citations — do they exist?
Read app/dashboard/settings/_components/SettingsForm.tsx — Sprint B: Restart Tour button. Confirm present.
```

**Specifically understand before writing any code:**

- **Dashboard card prop shapes:** Before writing the sample data layer, read every dashboard card component completely. Each card has a specific props interface — `AIHealthScoreCard`, `SOVTrendChart`, `HallucinationsByModel`, etc. The sample data must match these interfaces exactly. The `isSampleMode` boolean is passed alongside the data props, not instead of them.

- **Golden-tenant data completeness:** `golden-tenant.ts` may not have sample data for every dashboard card. Run:
  ```bash
  grep -n "export\|const.*=\s*{" src/__fixtures__/golden-tenant.ts | head -30
  ```
  For any card that needs data the fixture doesn't provide, create realistic placeholder values in `lib/sample-data/dashboard-sample.ts` (the new file) — don't modify golden-tenant.ts.

- **Yelp Fusion API:** The Yelp Business Search API (v3) is read-only. Business lookup by phone number is the most reliable matching strategy for local businesses. The endpoint is `GET https://api.yelp.com/v3/businesses/search?phone={phone}`. Requires `Authorization: Bearer {YELP_API_KEY}`. Before writing the integration, verify the actual API endpoint — Yelp's API has changed over time. If `YELP_API_KEY` is not in `.env.example`, add it and document the setup in the DEVLOG.

- **Bing Local Business Search:** The Bing Web Search API v7 has a local business search capability. However, it's part of the Azure Cognitive Services suite and may require `Ocp-Apim-Subscription-Key`. Before writing the Bing integration, verify the exact endpoint and auth header — it may differ from Yelp's Bearer token pattern.

- **GuidedTour library:** Read `GuidedTour.tsx` carefully. The sprint E spec assumed the tour library might be `react-joyride`, `intro.js`, or custom. The step format depends entirely on what's actually in the file. Do not assume.

- **Sample data timing:** The sample data mode triggers when `realityScore === null && openAlerts.length === 0`. This is the new-user state — no scan has completed yet. It should NOT trigger for existing users whose scan returned zero alerts and a null score (edge case: an org that had data but reset). The `isSampleMode` determination should check `org.created_at` — if the org was created within the last 14 days AND has null scores, show sample data. If older than 14 days with null scores, show an error/investigation state instead.

---

## 🏗️ Architecture — What to Build

---

### Feature 1: Sample Data Mode — C4

**The user's real question on day 1:** "What does this product actually do?"

**Current experience:** Blank cards, a "check back Monday" message, and 6 days of silence. Paying customers open an empty dashboard and close their laptop.

**After Sprint L:** A realistic-looking dashboard with a "Sample Data" banner at the top. Every card is populated. The user can click through to every page and understand what the product will show once their data arrives. The banner explains exactly what they're seeing and when real data will replace it.

#### Step 1: `lib/sample-data/dashboard-sample.ts` — The sample data layer

This file is the single source of truth for all sample data shown during the new-user empty state. It exports typed sample data objects that match each dashboard card's prop interface exactly.

```typescript
/**
 * lib/sample-data/dashboard-sample.ts
 *
 * Sample data for the dashboard empty state (new users, pre-first-scan).
 * All data is drawn from the golden-tenant fixture (Charcoal N Chill).
 *
 * AI_RULES §70: Sample data must be labeled wherever shown.
 * Never display sample data without a visible "Sample Data" indicator.
 * Sample data must be visually distinct from real data — use the
 * SampleDataBanner and SampleDataOverlay components, never raw data alone.
 *
 * This file is intentionally decoupled from golden-tenant.ts (the test fixture).
 * The types here mirror the dashboard card prop interfaces exactly.
 * If a card's interface changes, update both the card and this file.
 */

// ── Reality Score sample ────────────────────────────────────────────────────
// Read RealityScoreCard props interface before setting this type
export const SAMPLE_REALITY_SCORE = {
  score: 62,
  trend: +8,           // +8 points vs last week
  label: 'Developing', // whatever the label system uses for 62/100
} as const;

// ── AI Health Score sample ───────────────────────────────────────────────────
// Read AIHealthScoreCard props interface — it may have sub-scores
export const SAMPLE_AI_HEALTH = {
  overall: 58,
  visibility: 48,
  accuracy: 72,
  dataHealth: 65,
  freshness: 44,
  // Top recommendation — must match HealthScoreResult type:
  topRecommendation: {
    title: 'Fix 3 hallucination alerts',
    description: 'ChatGPT and Perplexity are giving customers wrong hours. Fixing these will improve your Accuracy score significantly.',
    actionLabel: 'Fix alerts',
    actionHref: '/dashboard/alerts',
    impact: 'high' as const,
  },
} as const;

// ── Open alerts sample ───────────────────────────────────────────────────────
// Read hallucination_alerts table shape from prod_schema.sql
// These must match the actual DB row type for AlertCard to render them
export const SAMPLE_ALERTS = [
  {
    id: 'sample-alert-001',
    alert_type: 'wrong_hours',
    model: 'chatgpt',
    status: 'open',
    severity: 'critical',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    org_id: 'sample-org',
  },
  {
    id: 'sample-alert-002',
    alert_type: 'wrong_location',
    model: 'perplexity',
    status: 'open',
    severity: 'warning',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    org_id: 'sample-org',
  },
  {
    id: 'sample-alert-003',
    alert_type: 'missing_from_results',
    model: 'gemini',
    status: 'open',
    severity: 'warning',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    org_id: 'sample-org',
  },
] as const;

// ── SOV sample ───────────────────────────────────────────────────────────────
// Read SOVTrendChart props — time-series data shape
export const SAMPLE_SOV_TREND = [
  { week: '2025-12-01', sov_pct: 22 },
  { week: '2025-12-08', sov_pct: 24 },
  { week: '2025-12-15', sov_pct: 21 },
  { week: '2025-12-22', sov_pct: 27 },
  { week: '2025-12-29', sov_pct: 25 },
  { week: '2026-01-05', sov_pct: 31 },
  { week: '2026-01-12', sov_pct: 28 },
  { week: '2026-01-19', sov_pct: 34 },
] as const;

// ── Hallucinations by model sample ───────────────────────────────────────────
// Read HallucinationsByModel props
export const SAMPLE_HALLUCINATIONS_BY_MODEL = [
  { model: 'chatgpt',    count: 3 },
  { model: 'perplexity', count: 2 },
  { model: 'gemini',     count: 1 },
  { model: 'claude',     count: 0 },
] as const;

// ── Competitor comparison sample ─────────────────────────────────────────────
// Read CompetitorComparison props
export const SAMPLE_COMPETITOR_COMPARISON = [
  { name: 'Charcoal N Chill',    score: 62, isOrg: true },
  { name: 'Lips Hookah Lounge',  score: 74, isOrg: false },
  { name: 'Cloud Nine Hookah',   score: 58, isOrg: false },
] as const;

// ── Revenue leak sample ───────────────────────────────────────────────────────
// Read RevenueLeakCard props
export const SAMPLE_REVENUE_LEAK = {
  monthlyLoss: 2800,
  annualLoss: 33600,
} as const;

// ── Proof timeline sample ─────────────────────────────────────────────────────
// Read ProofTimelineCard props — time-series of correction events
export const SAMPLE_PROOF_TIMELINE = [
  {
    id: 'sample-proof-001',
    event_type: 'correction_submitted',
    description: 'Correction brief submitted to ChatGPT for wrong hours',
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-proof-002',
    event_type: 'improvement_detected',
    description: 'Reality Score improved from 54 → 62',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
] as const;

// ── Entity health sample ──────────────────────────────────────────────────────
export const SAMPLE_ENTITY_HEALTH = {
  overall_score: 68,
  hours_accuracy: 55,
  address_accuracy: 82,
  name_accuracy: 90,
  category_accuracy: 71,
} as const;

// ── Next scan date ────────────────────────────────────────────────────────────
// Find the next upcoming Sunday from today:
function nextSunday(): Date {
  const d = new Date();
  const daysUntilSunday = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + daysUntilSunday);
  return d;
}

export function getNextScanDate(): Date {
  return nextSunday();
}

export function getNextScanDateFormatted(): string {
  return nextSunday().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}
```

**Important:** After reading each dashboard card's actual props interface, adapt these sample objects to match. The types are intentionally broad here — they must be narrowed to match the real interfaces before the code compiles.

#### Step 2: `SampleDataBanner` — `app/dashboard/_components/SampleDataBanner.tsx`

The persistent, dismissible banner that explains the sample data state.

```tsx
'use client';

/**
 * SampleDataBanner
 *
 * Shown at the top of the dashboard when the user has no real scan data yet.
 * Explains why sample data is showing and when real data will arrive.
 *
 * AI_RULES §70: Sample data must always be labeled.
 * This banner is the primary label — it is never hidden or optional.
 */

import { useState } from 'react';
import { FlaskConical, X, ArrowRight } from 'lucide-react';

interface SampleDataBannerProps {
  nextScanDate: string;    // e.g., "Sunday, March 8, 2026"
  orgName: string;
}

export function SampleDataBanner({ nextScanDate, orgName }: SampleDataBannerProps) {
  // NOTE: This banner is NOT permanently dismissible (no localStorage).
  // It re-appears on every visit until real data arrives.
  // Users can temporarily collapse it within the session.
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 hover:bg-amber-100 transition-colors"
        data-testid="sample-banner-collapsed"
      >
        <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
        Showing sample data — click to expand
      </button>
    );
  }

  return (
    <div
      className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4"
      role="status"
      aria-live="polite"
      data-testid="sample-data-banner"
    >
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">
            Sample data — your scan hasn't run yet
          </p>
          <p className="mt-1 text-xs text-amber-700">
            What you're seeing is a realistic preview of what LocalVector will show for{' '}
            <span className="font-medium">{orgName}</span> once your first AI scan completes.
            Real data for your business will replace this automatically on{' '}
            <span className="font-semibold">{nextScanDate}</span>.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-xs text-amber-600">
              You can explore every feature — just know these numbers aren't yours yet.
            </p>
            <a
              href="/dashboard/settings"
              className="inline-flex items-center gap-1 text-xs text-amber-700 underline hover:text-amber-900"
              data-testid="sample-banner-settings-link"
            >
              Adjust scan settings
              <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="ml-2 shrink-0 rounded text-amber-500 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          aria-label="Collapse sample data notice"
          data-testid="sample-banner-collapse"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
```

#### Step 3: `SampleDataOverlay` — `app/dashboard/_components/SampleDataOverlay.tsx`

A wrapper that adds a subtle "SAMPLE" pill to any card being shown in sample mode. Cards themselves don't need to know they're showing sample data — the overlay handles the labeling.

```tsx
/**
 * SampleDataOverlay
 *
 * Wraps a dashboard card to add a "SAMPLE" pill indicator.
 * Use this on every card that shows sample data.
 *
 * The overlay is purely cosmetic — the card's data and functionality
 * are unchanged. The "SAMPLE" pill is the only visual addition.
 */

interface SampleDataOverlayProps {
  children: React.ReactNode;
  /** True when sample data is being shown. When false, renders children unchanged. */
  active: boolean;
}

export function SampleDataOverlay({ children, active }: SampleDataOverlayProps) {
  if (!active) return <>{children}</>;

  return (
    <div className="relative" data-testid="sample-overlay">
      {children}
      <div
        className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200 pointer-events-none"
        aria-hidden="true"
      >
        Sample
      </div>
    </div>
  );
}
```

#### Step 4: Determine `isSampleMode` in `app/dashboard/page.tsx`

```typescript
// In the server component, after fetching scores and org:
const isNewOrg = org?.created_at
  ? (Date.now() - new Date(org.created_at).getTime()) < 14 * 24 * 60 * 60 * 1000
  : false;

// Sample mode: new org (< 14 days old) with no scan data yet
const isSampleMode = isNewOrg && (scores?.realityScore === null || scores === null);

// Import sample data (only used when isSampleMode is true):
// import { SAMPLE_REALITY_SCORE, SAMPLE_AI_HEALTH, ... } from '@/lib/sample-data/dashboard-sample';
```

#### Step 5: Apply sample data in `app/dashboard/page.tsx`

Replace the current empty-state message with the populated sample dashboard. Read the current page completely before writing this — the structure may vary from what's described here.

```tsx
// New layout for the dashboard page:
<div className="p-6 space-y-6">

  {/* Sample data banner — shown only in sample mode */}
  {isSampleMode && (
    <SampleDataBanner
      nextScanDate={getNextScanDateFormatted()}
      orgName={org?.name ?? 'your business'}
    />
  )}

  {/* Reality Score card */}
  <SampleDataOverlay active={isSampleMode}>
    <RealityScoreCard
      score={isSampleMode ? SAMPLE_REALITY_SCORE.score : (scores?.realityScore ?? null)}
      trend={isSampleMode ? SAMPLE_REALITY_SCORE.trend : (scores?.trend ?? null)}
      /* ... other props from current implementation */
    />
  </SampleDataOverlay>

  {/* AI Health Score card */}
  <SampleDataOverlay active={isSampleMode}>
    <AIHealthScoreCard
      overall={isSampleMode ? SAMPLE_AI_HEALTH.overall : (healthScore?.overall ?? null)}
      /* ... adapt to actual AIHealthScoreCard props */
    />
  </SampleDataOverlay>

  {/* Top Issues — Sprint G: TopIssuesPanel */}
  {/* Sprint G spec: TopIssuesPanel derives issues from openAlerts.
      In sample mode, pass SAMPLE_ALERTS as the alerts prop */}
  <SampleDataOverlay active={isSampleMode}>
    <TopIssuesPanel
      alerts={isSampleMode ? SAMPLE_ALERTS : openAlerts}
    />
  </SampleDataOverlay>

  {/* SOV Trend Chart */}
  <SampleDataOverlay active={isSampleMode}>
    <SOVTrendChart
      data={isSampleMode ? SAMPLE_SOV_TREND : (sovData ?? [])}
    />
  </SampleDataOverlay>

  {/* Hallucinations by Model */}
  <SampleDataOverlay active={isSampleMode}>
    <HallucinationsByModel
      data={isSampleMode ? SAMPLE_HALLUCINATIONS_BY_MODEL : (hallucinationsByModel ?? [])}
    />
  </SampleDataOverlay>

  {/* Competitor Comparison */}
  <SampleDataOverlay active={isSampleMode}>
    <CompetitorComparison
      competitors={isSampleMode ? SAMPLE_COMPETITOR_COMPARISON : (competitors ?? [])}
    />
  </SampleDataOverlay>

  {/* Revenue Leak Card */}
  <SampleDataOverlay active={isSampleMode}>
    <RevenueLeakCard
      monthlyLoss={isSampleMode ? SAMPLE_REVENUE_LEAK.monthlyLoss : (revenueLeak?.monthlyLoss ?? null)}
    />
  </SampleDataOverlay>

  {/* ... remaining cards in the same pattern */}
</div>
```

**This pattern is illustrative. Read the actual `dashboard/page.tsx` before writing.** The card names, prop names, and layout structure must match what exists. If a card appears in the current page but doesn't have sample data in `dashboard-sample.ts`, add it to that file.

**Do not remove the existing null-state fallback from individual cards.** Cards should still handle `null` gracefully for the case where a user is >14 days old with missing data (the investigation/error state).

#### Step 6: Update `app/dashboard/page.tsx` — remove the "check back Monday" message

The current static message at lines 152–165 gets replaced by the `SampleDataBanner` + sample-populated cards. Remove only the hardcoded "Your first automated scan runs Sunday..." text. Do not remove any other null-state handling in the file.

---

### Feature 2: Listings Verification — C2 Phase 2

**The user's real question:** "Does Yelp have my correct information?"

**Current experience after Sprint K:** Yelp, TripAdvisor, Bing Places, Apple Business Connect, and Foursquare show "Manual tracking" with a URL entry form. Honest, but passive.

**After Sprint L:** Yelp and Bing show a verification summary — what those platforms are actually displaying about the business, cross-referenced against the org's known-good data, with any discrepancies flagged. The user sees: "Yelp shows your address as 123 Main St — ✓ correct" or "Yelp shows you close at 9pm — ✗ your actual closing time is 11pm."

**Scope:** Yelp Fusion API (phone-based lookup) and Bing Local Business Search. TripAdvisor, Apple Business Connect, and Foursquare remain manual-tracking-only — their APIs don't support clean read/verify without business ownership verification that LocalVector can't automate.

#### Step 1: `app/api/integrations/verify-yelp/route.ts` — new API route

```typescript
/**
 * POST /api/integrations/verify-yelp
 *
 * Looks up the business on Yelp by phone number and compares the result
 * against the org's verified data.
 *
 * Authentication: Supabase session (RLS enforced)
 * Rate limit: 1 call per org per 24 hours (stored in integrations table)
 * External: Yelp Fusion API v3
 */

import { createClient } from '@/lib/supabase/server';
import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';

const YELP_API_BASE = 'https://api.yelp.com/v3';
const RATE_LIMIT_HOURS = 24;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get org and location data
    const { data: org } = await supabase
      .from('orgs')
      .select('id, name')
      .eq('owner_id', user.id)   // Adjust to actual column name
      .single();

    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

    // Get location data (phone, address)
    const { data: location } = await supabase
      .from('locations')          // Adjust to actual table name from prod_schema.sql
      .select('phone, address, city, state, zip, name, hours')
      .eq('org_id', org.id)
      .single();

    if (!location?.phone) {
      return NextResponse.json({ error: 'No phone number configured for this business' }, { status: 400 });
    }

    // Rate-limit check: was this verified in the last 24 hours?
    const { data: existingVerification } = await supabase
      .from('org_integrations')   // Adjust to actual table name from prod_schema.sql
      .select('verified_at, verification_result')
      .eq('org_id', org.id)
      .eq('platform', 'yelp')
      .maybeSingle();

    if (existingVerification?.verified_at) {
      const hoursAgo = (Date.now() - new Date(existingVerification.verified_at).getTime()) / (1000 * 60 * 60);
      if (hoursAgo < RATE_LIMIT_HOURS) {
        // Return cached result
        return NextResponse.json({
          cached: true,
          result: existingVerification.verification_result,
        });
      }
    }

    // Yelp API call
    const yelpApiKey = process.env.YELP_API_KEY;
    if (!yelpApiKey) {
      Sentry.captureException(new Error('YELP_API_KEY not configured'), {
        tags: { component: 'verify-yelp' },
      });
      return NextResponse.json({ error: 'Yelp API not configured' }, { status: 503 });
    }

    // Normalize phone to E.164-ish format for Yelp (+15551234567)
    const normalizedPhone = location.phone.replace(/\D/g, '');
    const e164Phone = normalizedPhone.startsWith('1')
      ? `+${normalizedPhone}`
      : `+1${normalizedPhone}`;

    const yelpResponse = await fetch(
      `${YELP_API_BASE}/businesses/search?phone=${encodeURIComponent(e164Phone)}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${yelpApiKey}`,
          Accept: 'application/json',
        },
      }
    );

    if (!yelpResponse.ok) {
      const errorBody = await yelpResponse.text();
      Sentry.captureException(new Error(`Yelp API error: ${yelpResponse.status}`), {
        tags: { component: 'verify-yelp' },
        extra: { status: yelpResponse.status, body: errorBody },
      });
      return NextResponse.json({ error: 'Yelp API request failed' }, { status: 502 });
    }

    const yelpData = await yelpResponse.json();
    const business = yelpData.businesses?.[0];

    if (!business) {
      // No match found on Yelp
      const result = {
        found: false,
        yelpId: null,
        discrepancies: [],
        yelpUrl: null,
        verifiedAt: new Date().toISOString(),
      };

      // Store the result
      await supabase.from('org_integrations').upsert({
        org_id: org.id,
        platform: 'yelp',
        verified_at: result.verifiedAt,
        verification_result: result,
        status: 'verified',
      });

      return NextResponse.json({ cached: false, result });
    }

    // Compare Yelp data against org's known data
    const discrepancies = detectDiscrepancies({
      yelpBusiness: business,
      location,
    });

    const result = {
      found: true,
      yelpId: business.id,
      yelpName: business.name,
      yelpAddress: formatYelpAddress(business.location),
      yelpPhone: business.phone,
      yelpRating: business.rating,
      yelpReviewCount: business.review_count,
      yelpUrl: business.url,
      discrepancies,
      verifiedAt: new Date().toISOString(),
    };

    // Store the result
    await supabase.from('org_integrations').upsert({
      org_id: org.id,
      platform: 'yelp',
      verified_at: result.verifiedAt,
      verification_result: result,
      status: 'verified',
      has_discrepancy: discrepancies.length > 0,
    });

    return NextResponse.json({ cached: false, result });

  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'verify-yelp' } });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatYelpAddress(loc: { address1?: string; city?: string; state?: string; zip_code?: string }): string {
  return [loc.address1, loc.city, loc.state, loc.zip_code].filter(Boolean).join(', ');
}

interface DiscrepancyCheckInput {
  yelpBusiness: {
    name: string;
    location: { address1?: string; city?: string; state?: string; zip_code?: string };
    phone?: string;
  };
  location: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
  };
}

interface Discrepancy {
  field: string;
  yelpValue: string;
  localValue: string;
  severity: 'high' | 'low';
}

function detectDiscrepancies({ yelpBusiness, location }: DiscrepancyCheckInput): Discrepancy[] {
  const issues: Discrepancy[] = [];

  // Name check (fuzzy — ignore case and common suffixes)
  const yelpNameNorm = yelpBusiness.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const localNameNorm = (location.name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (localNameNorm && !yelpNameNorm.includes(localNameNorm) && !localNameNorm.includes(yelpNameNorm)) {
    issues.push({
      field: 'Business name',
      yelpValue: yelpBusiness.name,
      localValue: location.name ?? '',
      severity: 'high',
    });
  }

  // Address check
  const yelpAddr = (yelpBusiness.location.address1 ?? '').toLowerCase();
  const localAddr = (location.address ?? '').toLowerCase();
  if (localAddr && yelpAddr && !yelpAddr.includes(localAddr.split(' ').slice(0, 2).join(' '))) {
    issues.push({
      field: 'Street address',
      yelpValue: yelpBusiness.location.address1 ?? '',
      localValue: location.address ?? '',
      severity: 'high',
    });
  }

  // Phone check
  const yelpPhone = (yelpBusiness.phone ?? '').replace(/\D/g, '').slice(-10);
  const localPhone = (location.phone ?? '').replace(/\D/g, '').slice(-10);
  if (localPhone && yelpPhone && localPhone !== yelpPhone) {
    issues.push({
      field: 'Phone number',
      yelpValue: yelpBusiness.phone ?? '',
      localValue: location.phone ?? '',
      severity: 'high',
    });
  }

  return issues;
}
```

**Read `prod_schema.sql` before writing this route.** Adapt all table names (`org_integrations`, `locations`) and column names to match the actual schema. If `org_integrations` doesn't have a `verification_result` JSONB column, the migration step below adds it.

#### Step 2: Migration (if needed) — `supabase/migrations/[timestamp]_add_listing_verification.sql`

```sql
-- Only run this if org_integrations doesn't already have verification columns.
-- Check prod_schema.sql first: grep -A 30 "CREATE TABLE.*org_integrations\|integration" supabase/prod_schema.sql

ALTER TABLE public.org_integrations
  ADD COLUMN IF NOT EXISTS verified_at        timestamptz,
  ADD COLUMN IF NOT EXISTS verification_result jsonb,
  ADD COLUMN IF NOT EXISTS has_discrepancy    boolean DEFAULT false;

COMMENT ON COLUMN public.org_integrations.verification_result IS
  'Cached result from platform verification API. Shape varies by platform.';
COMMENT ON COLUMN public.org_integrations.has_discrepancy IS
  'True when verification found data on the platform that differs from org verified data.';
```

**Only create this migration if the columns don't already exist.** Verify against `prod_schema.sql` first.

#### Step 3: `ListingVerificationRow` — `app/dashboard/integrations/_components/ListingVerificationRow.tsx`

Shown instead of `ManualTrackingRow` for platforms that support verification (Yelp, Bing):

```tsx
'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Discrepancy {
  field: string;
  yelpValue: string;
  localValue: string;
  severity: 'high' | 'low';
}

interface VerificationResult {
  found: boolean;
  yelpName?: string;
  yelpAddress?: string;
  yelpPhone?: string;
  yelpUrl?: string;
  discrepancies: Discrepancy[];
  verifiedAt: string;
}

interface ListingVerificationRowProps {
  platform: 'yelp' | 'bing';           // Which platform
  platformLabel: string;                // "Yelp" or "Bing Places"
  platformIcon: React.ReactNode;
  claimUrl: string;                     // URL to claim/edit listing
  cachedResult: VerificationResult | null;  // Last known result (from DB)
  verifyEndpoint: string;               // e.g., '/api/integrations/verify-yelp'
}

export function ListingVerificationRow({
  platform,
  platformLabel,
  platformIcon,
  claimUrl,
  cachedResult,
  verifyEndpoint,
}: ListingVerificationRowProps) {
  const [result, setResult] = useState<VerificationResult | null>(cachedResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(verifyEndpoint, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(body.error ?? 'Verification failed');
        return;
      }
      const { result: newResult } = await res.json();
      setResult(newResult);
    } catch (err) {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  const hasDiscrepancies = result?.discrepancies && result.discrepancies.length > 0;
  const notFound = result?.found === false;

  return (
    <div
      className="px-4 py-4 space-y-3"
      data-testid={`listing-verification-${platform}`}
    >
      {/* Platform header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 shrink-0">{platformIcon}</div>
          <div>
            <p className="text-sm font-medium text-foreground">{platformLabel}</p>
            <p className="text-xs text-muted-foreground">
              {!result
                ? 'Not yet verified'
                : notFound
                ? 'Not found on this platform'
                : hasDiscrepancies
                ? `${result.discrepancies.length} discrepancy found`
                : 'Verified — data matches'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Status icon */}
          {result && (
            notFound ? (
              <AlertCircle className="h-4 w-4 text-amber-500" data-testid={`${platform}-status-not-found`} />
            ) : hasDiscrepancies ? (
              <XCircle className="h-4 w-4 text-red-500" data-testid={`${platform}-status-discrepancy`} />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" data-testid={`${platform}-status-ok`} />
            )
          )}

          {/* Verify / Re-verify button */}
          <button
            type="button"
            onClick={handleVerify}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              loading
                ? 'border-border bg-muted text-muted-foreground cursor-wait'
                : 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10',
            )}
            data-testid={`${platform}-verify-btn`}
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} aria-hidden="true" />
            {loading ? 'Checking…' : result ? 'Re-verify' : 'Verify now'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Verified data — what the platform shows */}
      {result?.found && (
        <div className="rounded-md bg-muted/50 border border-border px-3 py-2 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            What {platformLabel} is showing
          </p>
          <div className="space-y-1 text-xs">
            {result.yelpName && (
              <div className="flex gap-2">
                <span className="w-24 shrink-0 text-muted-foreground">Name</span>
                <span className="text-foreground">{result.yelpName}</span>
              </div>
            )}
            {result.yelpAddress && (
              <div className="flex gap-2">
                <span className="w-24 shrink-0 text-muted-foreground">Address</span>
                <span className="text-foreground">{result.yelpAddress}</span>
              </div>
            )}
            {result.yelpPhone && (
              <div className="flex gap-2">
                <span className="w-24 shrink-0 text-muted-foreground">Phone</span>
                <span className="text-foreground">{result.yelpPhone}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Discrepancies */}
      {hasDiscrepancies && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600">
            Discrepancies found
          </p>
          {result!.discrepancies.map((d, i) => (
            <div key={i} className="text-xs space-y-0.5">
              <p className="font-medium text-red-700">{d.field}</p>
              <p className="text-red-600">
                {platformLabel} shows: <span className="font-medium">{d.yelpValue}</span>
              </p>
              <p className="text-muted-foreground">
                Your data: <span className="font-medium">{d.localValue}</span>
              </p>
            </div>
          ))}
          <a
            href={claimUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-red-700 underline hover:text-red-900"
            data-testid={`${platform}-claim-link`}
          >
            Fix on {platformLabel}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Not found */}
      {notFound && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          Your business wasn't found on {platformLabel} by phone number. You may not have a
          listing yet, or your phone number may differ.{' '}
          <a href={claimUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Claim your {platformLabel} listing →
          </a>
        </div>
      )}

      {/* Last verified timestamp */}
      {result?.verifiedAt && (
        <p className="text-[10px] text-muted-foreground">
          Last checked: {new Date(result.verifiedAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      )}
    </div>
  );
}
```

#### Step 4: Update `app/dashboard/integrations/page.tsx`

Load cached verification results and render `ListingVerificationRow` for Yelp (and Bing if implemented). Read the current page file before modifying — the fetch patterns and `PlatformRow`/`ManualTrackingRow` composition from Sprint K must be preserved.

```typescript
// In the server component, load cached verification results:
const { data: yelpVerification } = await supabase
  .from('org_integrations')
  .select('verification_result, verified_at, has_discrepancy')
  .eq('org_id', orgId)
  .eq('platform', 'yelp')
  .maybeSingle();
```

```tsx
{/* Yelp — verification-capable */}
<ListingVerificationRow
  platform="yelp"
  platformLabel="Yelp"
  platformIcon={<YelpIcon />}   // Whatever icon is already used in the integrations page
  claimUrl="https://biz.yelp.com"
  cachedResult={yelpVerification?.verification_result ?? null}
  verifyEndpoint="/api/integrations/verify-yelp"
/>
```

**Bing Places:** Follow the same pattern with a `/api/integrations/verify-bing` route using the Bing Local Business Search API. The Bing Maps API key is `BING_MAPS_KEY` env var. If the API is not available or too complex to wire in this sprint, document in DEVLOG and keep Bing as `ManualTrackingRow` for now — scope it to Sprint M.

---

### Feature 3: GuidedTour Completion — M2

**State after Sprint E:** The `FirstVisitTooltip` per-page banners were built (Sprint E Step 3 + 4). The GuidedTour 3 new steps (SOV, Citations, Revenue Impact) were specified in Sprint E but may not have been implemented depending on whether the implementer completed that part of Sprint E.

#### Step 1: Verify current state

```bash
# Count current tour steps:
grep -c "target\|step\|content:" app/dashboard/_components/GuidedTour.tsx

# Check for nav testids:
grep -n "nav-share-of-voice\|nav-revenue-impact\|nav-citations" components/layout/Sidebar.tsx

# Confirm restart tour button:
grep -n "Restart Tour\|lv_tour_completed" app/dashboard/settings/_components/SettingsForm.tsx
```

If the tour already has 8 steps (original 5 + 3 from Sprint E), document in DEVLOG and skip to Step 3 (verification only).

If the tour has only 5 steps, implement Steps 2–4.

#### Step 2: Add `data-testid` attributes to nav items (if missing)

```tsx
// In components/layout/Sidebar.tsx, find the nav items for:
// Share of Voice → add data-testid="nav-share-of-voice"
// Citations → add data-testid="nav-citations"
// Revenue Impact → add data-testid="nav-revenue-impact"

// Only add missing testids — don't modify items that already have them.
```

#### Step 3: Add 3 new steps to `GuidedTour.tsx`

Read the existing step structure completely. Match it exactly — do not infer the format from the Sprint E spec.

```typescript
// The 3 new steps to add after the existing 5 (adjust format to match tour library):
// Content for each step:

const STEP_SHARE_OF_VOICE = {
  target: '[data-testid="nav-share-of-voice"]',
  title: 'Share of Voice',
  body: 'Track how often AI models mention your business compared to competitors when customers search for businesses like yours. This is the metric traditional SEO tools can\'t see.',
  placement: 'right',
};

const STEP_CITATIONS = {
  target: '[data-testid="nav-citations"]',
  title: 'Citations',
  body: 'Citations are the web mentions that teach AI models about your business. More high-quality citations means a higher AI visibility score. This page shows which citation sources are helping — and which ones are teaching AI models the wrong things.',
  placement: 'right',
};

const STEP_REVENUE_IMPACT = {
  target: '[data-testid="nav-revenue-impact"]',
  title: 'Revenue Impact',
  body: 'See an estimate of the monthly revenue you\'re losing because AI models are giving customers wrong information. LocalVector pre-fills realistic defaults — you can refine them with your actual revenue numbers.',
  placement: 'right',
};
```

#### Step 4: Verify tour total step count

After adding the 3 steps, the total must be 8. Write a test that enforces this:

```typescript
// In: src/__tests__/unit/guided-tour.test.ts (new file)

describe('GuidedTour')
  it('has exactly 8 steps', () => {
    // Import the steps array from GuidedTour.tsx and assert length === 8
  });
  it('includes Share of Voice step', () => {
    // Assert a step with target matching 'nav-share-of-voice' exists
  });
  it('includes Citations step', () => {});
  it('includes Revenue Impact step', () => {});
  it('step 6 target matches nav-share-of-voice', () => {});
  it('step 7 target matches nav-citations', () => {});
  it('step 8 target matches nav-revenue-impact', () => {});
```

---

## 🧪 Testing

### Test File 1: `src/__tests__/unit/sample-data-mode.test.tsx` — 18 tests

```
describe('dashboard-sample.ts')
  1.  SAMPLE_REALITY_SCORE.score is a number between 40 and 100
  2.  SAMPLE_AI_HEALTH.overall is a number between 40 and 100
  3.  SAMPLE_ALERTS is a non-empty array with at least 2 items
  4.  SAMPLE_ALERTS items have: id, alert_type, model, status, severity, created_at
  5.  SAMPLE_SOV_TREND is a non-empty array; each item has week (string) and sov_pct (number)
  6.  SAMPLE_HALLUCINATIONS_BY_MODEL: each item has model (string) and count (number)
  7.  getNextScanDate() returns a Date on a Sunday (getDay() === 0)
  8.  getNextScanDateFormatted() returns a string containing "Sunday"

describe('SampleDataBanner')
  9.  renders data-testid="sample-data-banner" when visible
  10. renders orgName in the banner text
  11. renders nextScanDate in the banner text
  12. click collapse button → data-testid="sample-banner-collapsed" visible
  13. click collapsed bar → banner re-expands
  14. data-testid="sample-banner-settings-link" present, href="/dashboard/settings"

describe('SampleDataOverlay')
  15. active=false: renders children without "Sample" pill
  16. active=true: renders children AND data-testid="sample-overlay"
  17. active=true: "Sample" text visible in overlay
  18. active=true: pointer-events-none on the pill (does not block clicks on card)

describe('isSampleMode logic')
  19. New org (< 14 days) + null score → isSampleMode = true
  20. Old org (> 14 days) + null score → isSampleMode = false
  21. Any org + non-null score → isSampleMode = false
```

**Target: 21 tests**

### Test File 2: `src/__tests__/unit/listing-verification.test.tsx` — 16 tests

```
describe('detectDiscrepancies()')
  1.  Matching name, address, phone → empty discrepancies array
  2.  Mismatched name → one discrepancy with field='Business name'
  3.  Mismatched address → discrepancy with field='Street address'
  4.  Mismatched phone (digits only) → discrepancy with field='Phone number'
  5.  Name mismatch is fuzzy: "Charcoal N Chill" vs "Charcoal and Chill" → no discrepancy (partial match)
  6.  Phone normalization: "+1 (555) 123-4567" vs "5551234567" → match (no discrepancy)

describe('ListingVerificationRow')
  7.  cachedResult=null → "Not yet verified" text visible
  8.  cachedResult with found=false → "Not found on this platform" text
  9.  cachedResult with found=true, 0 discrepancies → CheckCircle2 icon + "data matches" text
  10. cachedResult with found=true, discrepancies > 0 → XCircle icon + discrepancy list visible
  11. data-testid="{platform}-verify-btn" present
  12. click verify button → loading state ("Checking…") shown
  13. data-testid="{platform}-status-ok" when found and no discrepancies
  14. data-testid="{platform}-status-discrepancy" when discrepancies found
  15. data-testid="{platform}-status-not-found" when found=false
  16. discrepancy block includes "Fix on Yelp →" link (data-testid="{platform}-claim-link")
```

**Target: 16 tests**

### Test File 3: `src/__tests__/unit/guided-tour.test.ts` — 8 tests

```
describe('GuidedTour')
  1.  Tour step array has exactly 8 items
  2.  Step 6 target matches "nav-share-of-voice"
  3.  Step 7 target matches "nav-citations"
  4.  Step 8 target matches "nav-revenue-impact"
  5.  All steps have a non-empty title or content field
  6.  All steps have a non-empty target field
  7.  No two steps target the same element
  8.  Steps 1–5 targets unchanged from pre-Sprint-L (regression guard):
      nav-dashboard, nav-alerts, nav-menu, nav-compete, nav-content
```

**Target: 8 tests**

### E2E Test File: `src/__tests__/e2e/sprint-l-smoke.spec.ts` — 20 tests

```
describe('Sprint L — Retention & Onboarding E2E')

  Sample Data Mode (simulate new org state):
  1.  When realityScore is null and org is < 14 days old:
      data-testid="sample-data-banner" is visible
  2.  At least one data-testid="sample-overlay" is visible on the dashboard
  3.  "SAMPLE" pill text is visible in at least one card
  4.  Click collapse button → data-testid="sample-banner-collapsed" appears
  5.  Click collapsed bar → data-testid="sample-data-banner" reappears
  6.  sample-banner-settings-link navigates to /dashboard/settings
  7.  All major dashboard cards (RealityScore, AIHealth, TopIssues, SOV) render
      with non-null content in sample mode — no blank cards

  Listings Verification:
  8.  /dashboard/integrations: listing-verification-yelp is present
  9.  data-testid="yelp-verify-btn" is present and enabled
  10. Click verify button → loading state visible ("Checking…")
  11. After verification (mocked): result section renders with what Yelp shows
  12. If discrepancies present: yelp-status-discrepancy icon visible
  13. If no discrepancies: yelp-status-ok icon visible
  14. yelp-claim-link present when discrepancies exist

  GuidedTour:
  15. GuidedTour has 8 steps (verify via component test hook or DOM observation)
  16. nav-share-of-voice data-testid present in sidebar
  17. nav-citations data-testid present in sidebar
  18. nav-revenue-impact data-testid present in sidebar
  19. Restart Tour button present in settings (regression from Sprint B)
  20. "Sample" pill on cards does NOT block clicking — card links still work
```

### Run commands

```bash
npx vitest run src/__tests__/unit/sample-data-mode.test.tsx
npx vitest run src/__tests__/unit/listing-verification.test.tsx
npx vitest run src/__tests__/unit/guided-tour.test.ts
npx vitest run                                                     # ALL Sprints A–L — 0 regressions
npx playwright test src/__tests__/e2e/sprint-l-smoke.spec.ts
npx tsc --noEmit                                                   # 0 new type errors
```

---

## 📂 Files to Create / Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/sample-data/dashboard-sample.ts` | **CREATE** | Sample data objects for all dashboard cards |
| 2 | `app/dashboard/_components/SampleDataBanner.tsx` | **CREATE** | Dismissible amber banner for sample mode |
| 3 | `app/dashboard/_components/SampleDataOverlay.tsx` | **CREATE** | "Sample" pill wrapper for individual cards |
| 4 | `app/dashboard/page.tsx` | **MODIFY** | `isSampleMode` logic; sample data props; remove static "check back Monday" message |
| 5 | `app/api/integrations/verify-yelp/route.ts` | **CREATE** | Yelp Fusion API verification route |
| 6 | `app/api/integrations/verify-bing/route.ts` | **CREATE** | Bing Local Business Search verification route (or defer to Sprint M if API too complex) |
| 7 | `app/dashboard/integrations/_components/ListingVerificationRow.tsx` | **CREATE** | Verification UI: status, discrepancy list, re-verify button |
| 8 | `app/dashboard/integrations/page.tsx` | **MODIFY** | Load cached verification; render ListingVerificationRow for Yelp |
| 9 | `supabase/migrations/[timestamp]_add_listing_verification.sql` | **CREATE (if needed)** | Add `verified_at`, `verification_result`, `has_discrepancy` to `org_integrations` |
| 10 | `app/dashboard/_components/GuidedTour.tsx` | **MODIFY** | Add 3 new steps (Share of Voice, Citations, Revenue Impact) if not already present |
| 11 | `components/layout/Sidebar.tsx` | **MODIFY (if needed)** | Add missing `data-testid` attrs for nav items targeted by tour steps |
| 12 | `src/__tests__/unit/sample-data-mode.test.tsx` | **CREATE** | 21 tests |
| 13 | `src/__tests__/unit/listing-verification.test.tsx` | **CREATE** | 16 tests |
| 14 | `src/__tests__/unit/guided-tour.test.ts` | **CREATE** | 8 tests |
| 15 | `src/__tests__/e2e/sprint-l-smoke.spec.ts` | **CREATE** | 20 E2E tests |

**New API routes:** 1–2 (verify-yelp required; verify-bing conditional)
**New migrations:** 0–1 (only if verification columns don't exist)

---

## 🧠 Edge Cases to Handle

1. **`isSampleMode` — 14-day threshold.** The 14-day check (`org.created_at`) prevents accidentally showing sample data to existing users who happen to have a null score (e.g., after a DB reset or migration issue). If `org.created_at` isn't available or the orgs table doesn't have this column, fall back to checking only `realityScore === null` — but document this as a known limitation in DEVLOG, since it could show sample data to non-new orgs in edge cases.

2. **Sample data type safety.** Every sample data object in `dashboard-sample.ts` must typecheck against the actual card component's prop type. Before writing `dashboard-sample.ts`, read each card's TypeScript interface. Use `satisfies` or explicit type annotations: `export const SAMPLE_ALERTS: HallucinationAlertRow[] = [...]`. Do not use `as const` on objects that contain types incompatible with the DB row type.

3. **`SampleDataOverlay` and card internal links.** Sprint G added cross-navigation links to dashboard cards (e.g., "See full analysis →" on SOVTrendChart). The `SampleDataOverlay` uses `pointer-events-none` only on the "Sample" pill — not on the card itself. The `relative` wrapper is on the outer div, not blocking the inner card's links. Verify this works in E2E test #20.

4. **Yelp API rate limits.** The Yelp Fusion API has rate limits (varies by account tier — typically 500 calls/day on free tier). The route implements a 24-hour cache by storing results in `org_integrations.verification_result`. The cache check must happen before the API call. Even with the cache, production load across many orgs could exhaust the daily limit. Log the Yelp response headers (X-RateLimit-Remaining) to Sentry breadcrumbs.

5. **Yelp phone-based lookup may return multiple results.** The `businesses/search?phone=` endpoint can return multiple businesses with the same phone number (unlikely but possible). Always use `businesses[0]` — the best match. Log to Sentry with a breadcrumb if `businesses.length > 1` so you can investigate if this causes incorrect matches.

6. **`detectDiscrepancies()` name matching is fuzzy — it can miss real discrepancies.** For example, "Charcoal N Chill" vs "Charcoal & Chill" would pass the current check. This is intentional — strict string equality causes too many false positives. But document this limitation: the name check may miss real naming issues with unusual variations.

7. **Bing Places API availability.** As of the sprint date, the Bing Local Business Search API is part of Azure Cognitive Services and requires a subscription key from Azure Portal. If `BING_MAPS_KEY` is not available during implementation, defer the Bing verification route to Sprint M and keep Bing as a `ManualTrackingRow`. Document the deferral in DEVLOG with the exact endpoint needed: `https://dev.virtualearth.net/REST/v1/LocalSearch/?query={business_name}&userLocation={lat,lng}&key={key}`.

8. **GuidedTour step 5 to 6 transition.** The original 5-step tour may end with a "Finish" or "Complete" button on step 5. When adding step 6, this completion event must be moved to step 8. Read the tour library's API for the completion callback — some libraries use `onComplete` tied to the last step automatically, others require explicit configuration.

9. **`SampleDataBanner` session collapse vs. permanent dismiss.** The banner collapses within the session (component state) but is NOT permanently dismissible via localStorage — it reappears on every page load until real data arrives. This is intentional: users shouldn't be able to accidentally dismiss the notice and then forget why their data looks weird. The X button collapses it within the session only.

10. **Sample data `created_at` dates.** The `SAMPLE_ALERTS` have `created_at` values derived from `Date.now()` at module load time. In a server component this is fine. In tests, freeze `Date.now()` with `vi.setSystemTime()` to get deterministic timestamps. The `getNextScanDate()` function should also be mockable in tests.

11. **`verify-yelp` route authentication.** The route uses `supabase.auth.getUser()` to identify the org. If the user's session has expired, the route returns 401. The `ListingVerificationRow` client component should handle 401 gracefully: show a "Please sign in again" message rather than a generic error.

12. **Migration idempotency.** The migration adds columns with `ADD COLUMN IF NOT EXISTS`. This is safe to run multiple times. However, if the `org_integrations` table doesn't exist at all (i.e., Sprint K's platform-config work stored integration state differently), the migration will fail. Read `prod_schema.sql` before writing the migration to confirm the exact table name.

---

## 🚫 What NOT to Do

1. **DO NOT show sample data to users who are older than 14 days and have null scores.** These users have a real problem (scan failure, cron issue) — they need to see an error/investigation state, not sample data. The 14-day check is critical.
2. **DO NOT make `SampleDataBanner` permanently dismissible via localStorage.** If a user dismisses it permanently, they lose the visual indicator that data is not real. The collapse is session-only.
3. **DO NOT add fake data to any non-dashboard page in sample mode.** Sample data is only for `app/dashboard/page.tsx` (the main dashboard). The detail pages (Alerts, SOV, Compete, etc.) show their normal empty states — they do not receive sample data. This is intentional: clicking through from a sample card should land on an honest empty page.
4. **DO NOT call the Yelp API on page load server-side.** The verification is triggered by user click (via the client-side `handleVerify` function), not at page render time. Server-side, only the cached result from `org_integrations` is read.
5. **DO NOT hardcode Yelp API credentials.** Always use `process.env.YELP_API_KEY`. If missing, return a 503 and log to Sentry — never throw an unhandled error.
6. **DO NOT modify the `ManualTrackingRow` from Sprint K.** It stays for TripAdvisor, Apple Business Connect, and Foursquare. Only Yelp (and Bing, if implemented) switch to `ListingVerificationRow`.
7. **DO NOT re-implement the "Restart Tour" Settings button.** Sprint B built it. Verify it's there; if missing, re-add it — but do not create a duplicate.
8. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).
9. **DO NOT modify `middleware.ts`** (AI_RULES §6).
10. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).

---

## ✅ Definition of Done

**Sample Data Mode:**
- [ ] `lib/sample-data/dashboard-sample.ts` created; all sample objects typecheck against real component prop interfaces
- [ ] `SampleDataBanner` renders with correct content; collapse works; banner re-appears on next page load
- [ ] `SampleDataOverlay` renders "Sample" pill; `active=false` renders children unchanged
- [ ] `isSampleMode` true only for orgs < 14 days old with null `realityScore`
- [ ] All major dashboard cards populated in sample mode — no blank cards
- [ ] Static "check back Monday" message removed from `dashboard/page.tsx`
- [ ] Sample mode never triggers for detail pages (Alerts, SOV, etc.)
- [ ] `sample-data-mode.test.tsx` — 21 tests passing

**Listings Verification:**
- [ ] `verify-yelp` API route created; auth check; rate-limit cache; Sentry on API errors
- [ ] `detectDiscrepancies()` returns empty array for matching data; correct discrepancies for mismatches
- [ ] `ListingVerificationRow` renders for Yelp on integrations page
- [ ] Verify button triggers API call; loading state shown; result renders
- [ ] Discrepancy list shows field, Yelp value, local value, and "Fix on Yelp →" link
- [ ] Not-found state has claim link
- [ ] Cached result loaded from DB on page render
- [ ] Migration added if needed; `verification_result` JSONB column exists
- [ ] `listing-verification.test.tsx` — 16 tests passing

**GuidedTour:**
- [ ] Tour has exactly 8 steps
- [ ] Steps 6, 7, 8 target: `nav-share-of-voice`, `nav-citations`, `nav-revenue-impact`
- [ ] All 3 nav `data-testid` attributes present in Sidebar
- [ ] Restart Tour button still present in Settings (regression check)
- [ ] `guided-tour.test.ts` — 8 tests passing

**All tests:**
- [ ] `npx vitest run` — ALL Sprints A–L passing, zero regressions
- [ ] `sprint-l-smoke.spec.ts` — 20 E2E tests passing
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry

```markdown
## [DATE] — Sprint L: Retention & Onboarding (Completed)

**Sample Data Mode:**
- isSampleMode check: created_at column on orgs: [yes / no — fallback to realityScore === null only]
- Dashboard cards updated with sample data props: [list card names]
- Cards with missing sample data (added to dashboard-sample.ts): [list]
- Static "check back Monday" removed from: [file:line]

**Listings Verification:**
- Yelp Fusion API: YELP_API_KEY env var [present in .env.example / added]
- Yelp phone lookup endpoint: api.yelp.com/v3/businesses/search?phone=... [confirmed working / mocked]
- Bing verification: [implemented in this sprint / deferred to Sprint M — reason: {reason}]
- Migration created: [yes — columns added / no — columns already existed]
- org_integrations table name confirmed: [actual name]

**GuidedTour:**
- Steps before Sprint L: [5 / 8 — Sprint E already completed this]
- Steps added in Sprint L: [0 / 3 — list which ones]
- Nav data-testid attrs added: [list any that were missing]
- Restart Tour button: [verified present / re-added — it was missing]

**Tests:** 45 Vitest + 20 Playwright; 0 regressions Sprints A–L
**Cumulative (A–L):** [N] Vitest + [N] Playwright
```

---

## 🔮 AI_RULES Update

```markdown
## 70. 🧪 Sample Data Mode — Always Labeled (Sprint L)

Sample data shown to new users (no first scan yet) is ALWAYS visually labeled.

* SampleDataBanner is REQUIRED on any page showing sample data. Never suppress it.
* SampleDataOverlay renders the "Sample" pill on every individual card showing sample data.
* Sample data only appears on app/dashboard/page.tsx (main dashboard). Detail pages
  (Alerts, SOV, Compete, etc.) show their normal empty states — NEVER sample data.
* isSampleMode = isNewOrg (< 14 days) AND realityScore === null.
  Never show sample data to orgs older than 14 days, even with null scores.
* SampleDataBanner collapse is session-only (component state). No localStorage persistence.
  The banner re-appears on every page load until real data arrives.
* lib/sample-data/dashboard-sample.ts is the single source of truth for all sample data.
  Do not hardcode sample values in page components.

## 71. 🔌 External API Verification Routes — Standard Pattern (Sprint L)

Listing verification routes (verify-yelp, verify-bing, etc.) follow this pattern:

* Auth check first (supabase.auth.getUser()) — return 401 if not authenticated.
* Rate-limit cache: check org_integrations.verified_at before hitting external API.
  Return cached result if verified within RATE_LIMIT_HOURS (24).
* API key check: if process.env.{API_KEY} is missing, log to Sentry and return 503.
  Never throw an unhandled error for a missing API key.
* Log API errors to Sentry with { tags: { component: 'verify-{platform}' } }.
* Store result in org_integrations.verification_result (JSONB) after every successful call.
* Never call external listing APIs at page-render time (server-side). Verification
  is user-triggered — client-side fetch to the /api route.
```

---

## 📚 Git Commit

```bash
git add -A
git commit -m "Sprint L: Retention & Onboarding — Sample Data Mode, Listings Verification, Tour Completion

Sample Data Mode (C4):
- lib/sample-data/dashboard-sample.ts: typed sample objects for all dashboard cards
- SampleDataBanner: amber dismissible (session-only) banner with next-scan date
- SampleDataOverlay: 'Sample' pill wrapper for individual cards
- dashboard/page.tsx: isSampleMode (new org + null score); sample props on all cards;
  static 'check back Monday' message removed

Listings Verification (C2 Phase 2):
- /api/integrations/verify-yelp: Yelp Fusion phone lookup + discrepancy detection
- detectDiscrepancies(): name/address/phone fuzzy comparison
- ListingVerificationRow: verify button, status icons, discrepancy list, claim link
- integrations/page.tsx: ListingVerificationRow for Yelp; cached result from DB
- Migration: verified_at, verification_result, has_discrepancy on org_integrations

GuidedTour (M2 completion):
- GuidedTour.tsx: 8 total steps (was [5/8]); added SOV, Citations, Revenue Impact steps
- Sidebar.tsx: data-testids confirmed/added: nav-share-of-voice, nav-citations, nav-revenue-impact

Tests: 45 Vitest + 20 Playwright; 0 regressions Sprints A–L
AI_RULES: 70 (sample data always labeled), 71 (external verification route pattern)"

git push origin main
```

---

## 🏁 Sprint Outcome

Sprint L solves the three highest-churn-risk gaps that remained after Sprints A–K.

**Sample Data Mode** — A customer who signs up on Monday no longer opens an empty dashboard. They see a fully-populated preview with every card showing realistic data for a hookah lounge in Alpharetta — the golden-tenant fixture. The amber banner at the top says "this is sample data" and tells them exactly when their real scan runs. They can explore every feature, click through to every page, and understand what LocalVector will show them once their data arrives. The wait becomes exploration instead of abandonment.

**Listings Verification** — Yelp is now a real integration instead of manual tracking. The user clicks "Verify now" and LocalVector fetches what Yelp is actually showing for their business, compares it against their verified data, and shows the diff. "Yelp shows your phone as 555-0192 — your actual number is 555-0199. Fix on Yelp →" is infinitely more useful than "Manual tracking." The 24-hour cache means this doesn't hammer the Yelp API — and every verification result is stored in the DB for the System Health dashboard.

**GuidedTour** — The tour now covers 8 features instead of 5. Share of Voice, Citations, and Revenue Impact all have nav-targeted tour steps that explain what the feature does in plain English, in context, on first login. Combined with the `FirstVisitTooltip` per-page banners from Sprint E, new users now have two complementary onboarding layers: the tour explains where things are, the per-page banners explain what they're looking at.

**What's next — Sprint M:** Three remaining items from the original analysis: (1) the plan feature comparison table on the billing page (M3 — drives upgrade conversion by showing Growth users what Agency unlocks), (2) Bing Places verification (C2 Phase 2 deferred), and (3) the in-app AI visibility positioning banner (M6 — the one-time dismissible "LocalVector sees what traditional SEO can't" message for new users who also use Yext or BrightLocal).
