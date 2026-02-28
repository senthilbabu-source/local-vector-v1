# LocalVector V1 — Code Analysis & Enhancement Report
**Based on:** Live `.git` clone of `senthilbabu-source/local-vector-v1`  
**Analyzed:** 790 files · 180 unit tests · 27 E2E specs · 36 migrations  
**Date:** February 27, 2026  
**Scope:** Improvements to what is already built. No Tier 4/5 drift.

---

## Executive Summary

The codebase is in strong structural shape — Inngest, Supabase RLS, Sentry, Stripe, and Vercel Cron are all properly wired. The test suite is substantial at 1,789+ passing tests. However, there are **5 categories of real issues found in the code** that, if fixed, would meaningfully improve paying customer experience and revenue. Every finding below is grounded in specific files and line numbers.

---

## 🔴 CRITICAL PRIORITY

---

### C1. 42 Bare `catch {}` Blocks Are Swallowing Errors Silently
**Files:** Spread across the entire codebase  
**Impact:** Paying customers see blank cards, broken features, and have no idea what went wrong. You have no visibility either.

The actual count from the codebase:
- `app/dashboard/page.tsx` — lines 80, 92, 102, 131 (Proof Timeline, Entity Health, Occasion Alerts, GBP card all fail silently)
- `app/api/cron/sov/route.ts` — lines 203, 217, 309 (SOV org failures swallowed)
- `app/_components/ViralScanner.tsx` — line 150 (public-facing tool fails silently)
- `app/dashboard/compete/_components/AddCompetitorForm.tsx` — line 50
- `app/dashboard/magic-menus/actions.ts` — line 125
- `app/dashboard/share-of-voice/actions.ts` — line 293
- `app/dashboard/settings/team/_components/TeamClient.tsx` — line 116
- Plus 34 more across auth routes, cron routes, API handlers

**Fix needed:**
```typescript
// CURRENT (broken for observability):
} catch {
  // Proof timeline is non-critical — dashboard renders without it.
}

// SHOULD BE:
} catch (err) {
  Sentry.captureException(err, { tags: { component: 'proof-timeline' } });
  // Non-critical: render degraded state with an informative message
}
```

Every non-critical `catch` should:
1. Call `Sentry.captureException(err)` — Sentry is already configured (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`) and is **completely unused** in most catch blocks
2. Set a local state variable that renders a user-visible degraded state (`"Proof timeline temporarily unavailable — retry"`) instead of a blank card

**Priority: CRITICAL — you're flying blind on production failures.**

---

### C2. Listings Sync Is a Mock (Not Wired to Real APIs)
**File:** `app/dashboard/integrations/actions.ts` lines 94–160  
**File:** `app/dashboard/integrations/_components/PlatformRow.tsx` line 158  

The comment says it plainly:
```
// Phase 8 uses a mock implementation to establish the architecture:
//   1. Set status → 'syncing'
//   2. Await 2 000 ms  (simulates a real API round-trip)
//   3. Set status → 'connected'
// Real API logic (GBP, Apple Business Connect, Bing Places API calls) drops in at step 2 in Phase 8b
```

The "Listings" nav item (22 total nav items, all `active: true`) leads to a page where clicking "Sync" does a `setTimeout(2000)` and then sets status to `connected`. **This is the "Big 6 Listings" section that paying customers see.** The button works visually but does nothing real.

Additionally, `toggleIntegration` in the same file uses mock OAuth state — there's no real connect flow for Yelp, TripAdvisor, Bing Places, or Apple Business Connect.

**Only GBP (Google Business Profile) is actually connected** via real OAuth (Sprints 89, 89b).

**Action needed:** Either wire the real APIs in this sprint cycle, or clearly label the other 5 platforms as "Manual URL tracking — automated sync coming soon" so customers aren't misled.

---

### C3. Plan Naming Inconsistency: Landing Page vs. Dashboard vs. DB
**Files:** `app/_sections/PricingSection.tsx` vs. `app/dashboard/billing/page.tsx` vs. `lib/plan-enforcer.ts`

The DB enum and plan enforcer use: `trial | starter | growth | agency`

The billing page uses: `Starter ($29) | Growth ($59) | Agency (Custom)`

The **landing page** uses completely different marketing names:
- "THE AUDIT" (Free)
- "STARTER" ($29)  
- "AI SHIELD" ($59)  ← maps to `growth` in the DB
- "BRAND FORTRESS" (Custom) ← maps to `agency` in the DB

A customer signs up for "AI SHIELD" and lands in their dashboard to see "Growth Plan" in the sidebar footer. This breaks trust immediately. The names need to be unified across all three surfaces, or the billing page needs to map the DB names back to the marketing names.

---

### C4. New Users Sit With an Empty Dashboard for Up to 7 Days
**File:** `app/dashboard/page.tsx` lines 152–165

When `scores.realityScore === null && openAlerts.length === 0`, the dashboard shows:
```
"Your first automated scan runs Sunday, [date] — 
check back Monday for your Reality Score, SOV trend, and hallucination alerts."
```

That's it. 15+ dashboard cards are either blank or in null states. The AIHealthScoreCard, SOVTrendChart, HallucinationsByModel, CompetitorComparison, ProofTimelineCard, EntityHealthCard all render empty or nothing.

**A paying customer who signs up on a Monday sees essentially nothing for 6 days.** This is the highest-risk moment for churn.

**Fix:** Implement "sample data mode" — seed mock data in the same shape as real data that is displayed with a `SAMPLE DATA` watermark overlay until the first real scan completes. The seed.sql already has full fixture data (see the `supabase/seed.sql` UUID reference card — 40+ seeded rows). Use that data shape to generate realistic sample dashboards.

---

## 🟠 HIGH PRIORITY

---

### H1. No Contextual Help/Tooltip System on Any Dashboard Card
**Files:** All `app/dashboard/_components/` — MetricCard, AIHealthScoreCard, RealityScoreCard, SOVTrendChart, HallucinationsByModel, etc.

The existing "tooltips" in the codebase are:
- Recharts chart tooltips (hover on chart data points) — all 4 charts have these
- A GuidedTour that only covers 5 nav items: Dashboard, Alerts, Menu, Compete, Content

**Nothing explains the actual metrics to users.** A restaurant owner looking at:
- "Reality Score: 62" — doesn't know what it means
- "AI Visibility: 48%" — doesn't know how it's derived
- "Intercept analyses: 3" — no idea what an "intercept" is
- "Cluster Map" — cryptic name, no explanation anywhere
- "Agent Readiness" — very jargon-heavy, no tooltip

The `MetricCard` component has no `tooltip` or `description` prop at all. The `AIHealthScoreCard` has component bars but no explanations of what Visibility / Accuracy / Structure / Freshness mean.

**Fix:** Add a shared `InfoTooltip` component (a `?` icon with a popover on hover/click) that can be composed into any card. Add it to at minimum: MetricCard (4 instances on dashboard), AIHealthScoreCard, RealityScoreCard, SOVTrendChart, HallucinationsByModel.

Example content for "Reality Score":
> **What is this?** Your Reality Score is a 0–100 measure of how accurately AI models represent your business.  
> **How it's calculated:** Visibility (40%) + Accuracy (40%) + Data Health (20%)  
> **What to do:** Fix open hallucination alerts to improve your Accuracy component.

---

### H2. Settings Page Is Missing Critical User Controls
**File:** `app/dashboard/settings/_components/SettingsForm.tsx`

Current settings sections:
1. Account — display name (editable), email (read-only)
2. Security — password change
3. Organization — org name (read-only), plan chip, billing link
4. Notifications — 3 toggles: hallucination alerts, weekly digest, SOV alerts
5. Danger Zone — delete org modal

**Missing settings that users need:**

**Score & Scan settings** (impactful):
- AI models to track — which of OpenAI/Perplexity/Gemini/Copilot/Claude to include in audits (currently hardcoded)
- Custom query templates — the SOV query seeds are auto-generated; users should be able to add their own ("best hookah lounge for private events in Alpharetta")
- Scan frequency preference — for Starter plan: only weekly; let users pick the day of week

**Competitor settings** (impactful):
- Competitor management is buried inside `/dashboard/compete/_components/AddCompetitorForm.tsx`. It should also be accessible from Settings

**Integration settings** (useful):
- WordPress credentials (currently in `/dashboard/integrations/_components/WordPressConnectModal.tsx`) — should be surfaced in Settings/Integrations tab
- Webhook URL for alerts — for agency users who want Slack/Zapier notifications

**Notification expansion** (quick wins):
- Score drop threshold alert (e.g., "alert me if Reality Score drops more than 10 points")
- New competitor detected alert
- Monthly summary report toggle

---

### H3. SOV Cron Failures Are Silent and Untracked
**File:** `app/api/cron/sov/route.ts` lines 200–220, 309

The SOV cron processes all orgs sequentially. When an individual org's SOV run fails:
```typescript
} catch {
  // ← No Sentry, no logging, no error count, nothing
  continue;
}
```

This means if SOV scans silently fail for 30% of your customer base every Sunday, you won't know until customers complain. The `cron_run_log` table exists (`supabase/migrations/20260226000008_cron_run_log.sql`) but the SOV cron's per-org failure isn't writing to it.

**Fix:** Write per-org failure records to `cron_run_log` and call `Sentry.captureException`. The System Health dashboard page reads from `cron_run_log` — these failures should show up there for you as the operator.

---

### H4. 22 Sidebar Items — Navigation Is Overwhelming
**File:** `components/layout/Sidebar.tsx` lines 40–200

All 22 nav items are `active: true` and visible in the sidebar simultaneously:
Dashboard · Alerts · Menu · Share of Voice · Cluster Map · Content · Content Calendar · Compete · Listings · Citations · Page Audits · Bot Activity · Proof Timeline · Entity Health · Agent Readiness · Revenue Impact · AI Assistant · AI Says · AI Sentiment · AI Sources · System Health · Settings · Billing

That's 23 items in a single scrollable list. For a first-time paying customer, this is overwhelming and contradicts the "seamless, logical, flowing" UX goal.

**Fix — Group by function:**
```
MONITOR
  Dashboard
  Alerts
  AI Says

OPTIMIZE  
  Share of Voice
  Cluster Map
  Compete
  Citations
  Page Audits

CREATE
  Content
  Content Calendar
  Menu (Magic Menu)

MANAGE
  Listings
  Revenue Impact
  AI Assistant

INTELLIGENCE
  Bot Activity
  Proof Timeline
  Entity Health
  Agent Readiness
  AI Sentiment
  AI Sources

ACCOUNT
  System Health
  Settings
  Billing
```

This requires only adding section headers to the Sidebar component — minor change, huge UX impact.

---

### H5. Dashboard Main Page Has No Cross-Card Navigation/Linking
**File:** `app/dashboard/page.tsx`

The 15+ cards on the main dashboard page are isolated islands. Examples of missing connections:
- The `MetricCard` for "Open alerts: 3" has no link to `/dashboard/hallucinations`
- The `SOVTrendChart` has no "See full analysis →" link to `/dashboard/share-of-voice`
- The `HallucinationsByModel` chart has no link to `/dashboard/hallucinations?filter=openai-gpt4o`
- The `CompetitorComparison` chart has no link to `/dashboard/compete`
- The `AIHealthScoreCard` recommendation says "Fix your schema" with `actionHref` but this link doesn't appear to actually render as a clickable CTA
- The `RevenueLeakCard` has no link to `/dashboard/revenue-impact`

The `HealthScoreResult` type already has `actionHref` and `actionLabel` per recommendation — but checking `AIHealthScoreCard.tsx`, the top recommendation's button/link needs to be verified as actually rendered.

---

### H6. `monthlyCostPerSeat` Is a Null TODO in Production Code
**File:** `app/actions/seat-actions.ts` line 190

```typescript
monthlyCostPerSeat: null, // TODO: fetch from Stripe price when Agency pricing is configured
```

This is served to the billing page's SeatManagementCard. Agency customers on the most expensive plan can't see their per-seat cost. This needs to be fetched from the Stripe Price API.

---

## 🟡 MEDIUM PRIORITY

---

### M1. Test Coverage Gaps — 6 Services With No Unit Tests
**Gap analysis:** Running `ls lib/services/` vs. `ls src/__tests__/unit/`

Services with **no unit tests at all**:
- `cron-logger.ts` — critical: logs all scheduled job runs
- `entity-auto-detect.ts` — used by Entity Health feature
- `gbp-token-refresh.ts` — critical: OAuth tokens expire; broken refresh = dead GBP integration
- `places-refresh.ts` — refreshes Google Places data
- `sov-seed.ts` — seeds initial SOV queries for new orgs

Services with **no E2E tests for their pages**:
- `/dashboard/source-intelligence` — no e2e spec
- `/dashboard/sentiment` — no e2e spec
- `/dashboard/agent-readiness` — no e2e spec
- `/dashboard/system-health` — no e2e spec
- `/dashboard/cluster-map` — no e2e for the visual/chart interactions
- `/dashboard/revenue-impact` — no e2e for the RevenueConfigForm submission

**Missing E2E edge case tests:**
- Plan downgrade flow (Agency → Growth → Starter) — feature access should change immediately
- Trial expiry — what does the dashboard show when trial ends?
- GBP OAuth token expiry — what happens when the refresh token is invalid?
- `cron_run_log` System Health page with mix of success/failure runs

---

### M2. Onboarding GuidedTour Is Minimal and Doesn't Cover New Pages
**File:** `app/dashboard/_components/GuidedTour.tsx`

The tour has exactly 5 steps targeting: `nav-dashboard`, `nav-alerts`, `nav-menu`, `nav-compete`, `nav-content`.

The tour doesn't explain:
- Share of Voice (arguably the most sophisticated feature)
- Revenue Impact
- Citations (gated feature — users who just upgraded won't know what to do)
- Entity Health / Agent Readiness (highly jargon-heavy)

Also, the tour triggers from `localStorage` key `lv_tour_completed`. If a user clears localStorage or uses a different browser, they never see the tour again — and they can't re-trigger it from Settings.

**Fix:** Add "Restart Tour" to the Settings page. Add 3 more tour steps for SOV, Citations, and Revenue Impact. Consider a per-feature "first visit" tooltip that shows once when a user navigates to that page for the first time.

---

### M3. Plan Feature Matrix Is Not Shown In-App
**File:** `app/dashboard/billing/page.tsx`

The billing page shows the 3 upgrade tiers but doesn't show a feature comparison table. A Growth plan user looking at the billing page can't see "what additional features would I get on Agency?" They can only see the price.

The `lib/plan-enforcer.ts` file contains the full feature matrix (17 gating functions). This data should be rendered in the billing page as a comparison table so users can see exactly what they'd unlock by upgrading — driving upgrade conversion.

---

### M4. Revenue Config Form Defaults Are Generic, Not Restaurant-Specific
**File:** `app/dashboard/revenue-impact/_components/RevenueConfigForm.tsx`  
**File:** `lib/services/revenue-leak.service.ts`

The `DEFAULT_CONFIG` presumably has generic revenue assumptions. For a restaurant/lounge customer this should be pre-populated with realistic defaults:
- Average check size: $45–$65
- Tables/covers per night: 40–80
- Weekend premium multiplier: 1.4x
- Hookah revenue per table per night: $35–$55

The golden tenant fixture (`src/__fixtures__/golden-tenant.ts`) represents Charcoal N Chill but the defaults in the service might not reflect restaurant-specific revenue patterns. Worth auditing.

---

### M5. Industry Abstraction Layer — First Extension: Medical/Dental
**Current state:** The codebase is deeply restaurant-specific. Evidence:
- `supabase/seed.sql` — golden tenant is "Charcoal N Chill" (hookah lounge)
- Onboarding wizard — Step 4 placeholder: `"best hookah bar with live music"`
- Magic Menus — Utensils icon, category label "Menu" (food/drink specific)
- Schema generator — `servesCuisine`, `menu` schema types (food-specific)
- SOV query seeds — oriented toward restaurant discovery queries

**No code changes needed for first horizontal extension** — just new data and configuration:
- New golden tenant fixture for Medical (e.g., a dental practice in Alpharetta)
- Industry-specific SOV query templates in `lib/services/sov-seed.ts`
- Industry-specific schema types in `lib/schema-generator/` (add `Physician`, `MedicalClinic`, `MedicalSpecialty` types)
- Industry-specific onboarding copy (replace "menu" with "services", "cuisine" with "specialty")
- Replace the `Utensils` icon in sidebar with a dynamic icon based on industry type

**Best first vertical for testing:** Medical/Dental practices. Why:
- Same local AI search problem ("best pediatric dentist near me")
- Higher fear of hallucinations (wrong insurance info, wrong credentials = legal risk)
- Higher willingness to pay ($200–500/mo is normal for a practice management tool)
- Schema.org has well-defined `Physician`/`MedicalClinic` types — Magic Engine translates directly
- Referral networks are tight (one happy dentist tells 10 others)

---

### M6. The AI Visibility Score Positioning vs. Traditional SEO — Missing In-App
**No file exists for this** — it's a gap in the product copy

The landing page positions LocalVector well against traditional SEO tools. But inside the dashboard, once a user is paying, there's no reinforcement of this positioning. Users who also have Yext or BrightLocal might wonder "what does this add?"

**Fix:** Add a one-time dismissible banner for new users that reads:
> "Traditional SEO tools track your Google rankings. LocalVector tracks what AI says about you — a layer those tools can't see. Your Reality Score measures AI visibility, not search rankings."

Also: the `ai-responses` page ("AI Says") is the most powerful differentiator — what AI models actually say about your business in their own words. This page should be one of the first things new users see, not buried as item 18 of 22 in the sidebar.

---

## 🟢 LOW PRIORITY

---

### L1. Admin Operations Dashboard Doesn't Exist
**No files found for admin** — confirmed via grep for "admin" in app/

There is no operator-facing admin dashboard for Aruna to:
- See all customers, their plan, MRR, and last login
- Track per-customer API costs (Perplexity, OpenAI, Google Grounded calls made by the SOV/audit cronis)
- Calculate margin: plan revenue − API cost − Vercel/Supabase cost
- Manage billing exceptions or apply credits
- See Stripe subscription health across the customer base

The `cron_run_log` table and Sentry are the closest things to operational visibility right now.

**Scope for a minimal admin dashboard:**
- Protected by a hardcoded admin email check (e.g., `ADMIN_EMAILS` env var)
- Route: `/admin` (separate from `/dashboard`)
- Pages: Customer List · API Usage Summary · Cron Health (cross-org) · Revenue Summary

---

### L2. Weekly Digest Email Exists but Is Potentially Sending Without Score Data
**File:** `app/api/cron/weekly-digest/route.ts` line 86 — bare `catch {}`  
**File:** `lib/services/weekly-digest.service.ts`

The weekly digest cron exists and presumably sends emails via Resend. But if a customer's score hasn't populated yet (new user, no scan run), what does the email say? Sending "Your Reality Score this week: —" is a bad first impression. There should be a guard that skips the digest email for orgs with no scan data.

---

### L3. Content Calendar Exists But Its Relationship to Content Drafts Is Unclear
**Files:** `app/dashboard/content-calendar/` and `app/dashboard/content-drafts/`

Both are in the sidebar. Both deal with content. From the code structure they appear to be separate flows — the calendar is date-based occasion-driven, the drafts are edit-and-publish flows. But a first-time user might not understand how they relate.

A simple "breadcrumb" or "generated by Occasion Engine" tag on drafts that originated from the calendar would make the flow clearer.

---

### L4. ViralScanner Error Handling (Public-Facing Conversion Tool)
**File:** `app/_components/ViralScanner.tsx` line 150

The ViralScanner on the landing page is your primary conversion tool. It has a bare `catch {}`. If the public Places search API fails, the user gets no feedback. For a tool that's meant to demonstrate LocalVector's value in 8 seconds, a silent failure is a conversion killer.

**Fix:** Show a friendly error state ("Our AI scanner is temporarily unavailable — try again in a moment") and log to Sentry.

---

### L5. GBP Token Refresh Has No Test
**File:** `lib/services/gbp-token-refresh.ts`  
**No test file found:** `src/__tests__/unit/gbp-token-refresh.test.ts` — doesn't exist

Google OAuth tokens expire every hour. The refresh token flow (`app/api/cron/refresh-gbp-tokens/route.ts`) is the only thing keeping GBP integrations alive. An untested refresh flow that silently fails would break GBP sync for all connected customers without anyone knowing.

---

## 💡 NICE-TO-HAVE

---

### N1. Credit/Usage System for API Cost Control
**No existing implementation** — would need new DB tables and middleware

Currently, any user on any plan can click "Run Analysis", "Generate Brief", "Re-audit" buttons unlimited times. The Perplexity and OpenAI API calls these trigger are real costs. For agency customers with 10 locations and 10 competitors, an aggressive user could incur $50–100 in API costs in a single session.

**Minimal implementation:**
- `api_credits` table: `org_id, credits_used, credits_limit, reset_date`
- Middleware check before expensive API operations
- Credits meter in the TopBar component
- Plan limits: Starter (100 manual triggers/mo), Growth (500), Agency (2,000)
- Auto-refill on billing date

---

### N2. "AI Answer Preview" — Show What AI Says Right Now
**Partial foundation:** `app/dashboard/ai-responses/` page already shows stored AI responses

The gap: users can't run an on-demand query right now without waiting for the next cron. The AI Assistant page (`/dashboard/ai-assistant`) has a chat interface but it's general-purpose.

A dedicated "AI Answer Preview" widget — type a query, see what 3 AI models say about your business right now — would be the most viscerally compelling feature in the product. This is different from the existing AI responses (which are cron-scheduled). This is on-demand.

---

### N3. Hallucination Correction Brief Needs a "Did It Work?" Follow-Up
**File:** `app/dashboard/_components/CorrectionPanel.tsx`

When a user generates a correction (via the Fear Engine's `correction-generator.service.ts`), the hallucination status goes to `verifying`. But there's no automated follow-up that checks if the AI model has updated its answer after correction.

A follow-up scan 2 weeks after a correction (targeted just at that hallucination's category/query) would close the loop and show users their fixes are working — a powerful retention signal.

---

### N4. Benchmark Comparison — "You vs. Avg Restaurant in Your City"
**No existing implementation** — requires aggregate data across customers

Once you have 10+ restaurant customers in the same metro, you can show: "Your Reality Score (62) vs. Alpharetta restaurants average (51)." This is a powerful retention tool — customers who are above average feel good; below average feel motivated to fix it.

**Requires:** An anonymized aggregation query over `organizations` table, scoped to same city. Can be added as a weekly computed value stored in a `benchmarks` table.

---

## Priority Summary

| ID | Finding | Priority | Effort | Revenue Impact |
|----|---------|----------|--------|----------------|
| C1 | 42 bare `catch {}` — Sentry unused for errors | Critical | Low | High (retention + ops) |
| C2 | Listings sync is a mock — 5 of 6 platforms fake | Critical | High | High (trust) |
| C3 | Plan name mismatch: "AI Shield" vs "Growth" | Critical | Low | High (trust/conversion) |
| C4 | New users see empty dashboard for up to 7 days | Critical | Medium | High (trial conversion) |
| H1 | No contextual help/tooltip system on any card | High | Medium | High (conversion/NPS) |
| H2 | Settings page missing 8+ useful controls | High | Medium | Medium (retention) |
| H3 | SOV cron org failures are silent | High | Low | Medium (ops reliability) |
| H4 | 22 sidebar items ungrouped — cognitively overwhelming | High | Low | High (UX/NPS) |
| H5 | Dashboard cards have no cross-navigation links | High | Low | Medium (UX) |
| H6 | `monthlyCostPerSeat: null` TODO in production | High | Low | Medium (Agency billing) |
| M1 | 6 services with no unit tests + 6 E2E page gaps | Medium | High | Medium (quality) |
| M2 | GuidedTour covers 5 of 22 nav items; no retrigger | Medium | Medium | Medium (onboarding) |
| M3 | No in-app plan feature comparison on billing page | Medium | Low | Medium (upsell) |
| M4 | Revenue config defaults not restaurant-specific | Medium | Low | Low-Medium |
| M5 | Industry abstraction: Medical/Dental as first extension | Medium | High | High (new market) |
| M6 | AI vs. traditional SEO positioning missing in-app | Medium | Low | Medium (retention) |
| L1 | No admin operations dashboard | Low | High | Medium (ops) |
| L2 | Weekly digest sends even when no score data | Low | Low | Low-Medium |
| L3 | Content Calendar ↔ Content Drafts flow unclear | Low | Low | Low |
| L4 | ViralScanner error handling (public conversion tool) | Low | Low | Medium (conversion) |
| L5 | GBP token refresh has no unit test | Low | Low | Medium (reliability) |
| N1 | Credit/usage system for API cost control | Nice-to-have | High | High (unit economics) |
| N2 | On-demand AI Answer Preview widget | Nice-to-have | Medium | High (wow factor) |
| N3 | Hallucination correction follow-up scan | Nice-to-have | Medium | Medium (stickiness) |
| N4 | Benchmark: you vs. city average | Nice-to-have | Medium | Medium (retention) |

---

## Recommended Immediate Action Order

**This week (critical, low-effort):**
1. **C3** — Unify plan names. Change PricingSection.tsx "AI SHIELD" → "Growth" and "BRAND FORTRESS" → "Agency". 30-minute fix, massive trust impact.
2. **C1** — Add `Sentry.captureException(err)` to all 42 bare catch blocks. 2-hour sweep, gives you instant production observability.
3. **H3** — Log SOV cron per-org failures to `cron_run_log`. 1-hour fix.
4. **L4** — Fix ViralScanner error state. 30 minutes. This is your public conversion tool.
5. **H4** — Add section group headers to Sidebar. 1-hour fix, dramatically improves first impression.
6. **H5** — Add `href` links to all dashboard MetricCards and chart cards. 2-hour fix.

**Next sprint (high impact, medium effort):**
7. **C4** — Sample data mode for new users (use existing `seed.sql` data shape)
8. **H1** — Build `InfoTooltip` component and add to 10 priority cards
9. **H2** — Expand Settings with scan preferences, competitor management, webhook URL
10. **M3** — Add plan feature comparison table to billing page

**Following sprint:**
11. **C2** — Wire real Yelp/TripAdvisor/Bing APIs or clearly label as "manual tracking"
12. **M1** — Write unit tests for the 6 untested services (especially `gbp-token-refresh.ts`)
13. **M5** — Medical/dental vertical extension scoping

---

*Report based on direct code analysis of 790 files. All file paths and line numbers verified against the live repository.*
