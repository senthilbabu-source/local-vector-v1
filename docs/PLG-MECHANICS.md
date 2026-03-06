# LocalVector.ai — Product-Led Growth Mechanics

**Version:** 1.0 — March 5, 2026
**Owner:** Senthilbabu
**Status:** Pre-launch. Activate in the sequence defined in Section 8.

---

## How to Use This Document

Product-led growth means the product itself — not sales or marketing spend — is the primary driver of acquisition, activation, and expansion. This document defines exactly how LocalVector's PLG mechanics work, what is already built, what needs to be added, and what to measure.

Three loops power LocalVector's growth. Each loop feeds the next:

```
Loop 1 — Discovery:   Restaurant owner finds ViralScanner
                      → scans their business
                      → sees AI mistake about their restaurant
                      → signs up for trial

Loop 2 — Activation:  Trial user activates (finds their first AI mistake in the full product)
                      → understands the dollar value at stake
                      → converts to paid

Loop 3 — Expansion:   Paid customer gets results
                      → tells another restaurant owner
                      → agency discovers white-label potential
                      → word-of-mouth referral
```

The strength of a PLG flywheel is that each loop drives the next with zero marginal cost per new user. This document optimizes all three loops.

---

## Section 1: Loop 1 — Discovery (ViralScanner)

### What exists

The ViralScanner at `/scan/` is a free public tool. A user enters a business name and city, the product runs an AI accuracy audit, and shows a result page at `/scan/results`.

- **`app/scan/_components/ScanDashboard.tsx`** — the result page, with real free data (mentions, sentiment, accuracy issues 1–3) and locked score cards
- **`app/scan/_components/EmailCaptureForm.tsx`** — post-scan email capture form (§207)
- **`scan_leads` table** — email + business name + scan status stored for follow-up
- **Result states:** `fail` (AI mistake found), `pass` (AI data correct), `not_found` (restaurant not in AI)

### The conversion moment

The ViralScanner creates urgency in one of three ways depending on the scan result:

| Result | Message | Urgency level | Expected conversion |
|--------|---------|--------------|---------------------|
| `fail` | "ChatGPT has wrong information about your restaurant" | High — active problem | Highest |
| `not_found` | "AI doesn't know your restaurant exists" | Medium — invisible problem | Medium |
| `pass` | "AI has correct information right now" | Low — no visible problem | Lowest |

**The PLG implication:** 60–70% of scans are expected to return `fail` or `not_found`. These are the conversion-ready states. The `pass` state needs a different conversion frame: "You're correct today — monitoring ensures you stay correct."

### What to optimize in the scanner (pre-launch)

#### 1. The email capture placement

Currently in ScanDashboard Section 5 (bottom of page). The problem: most users do not scroll to the bottom after seeing their scan result. The `fail` result creates anxiety at the top — the email capture should be close to the anxiety.

**Proposed placement for `fail` result:**
- Move `EmailCaptureForm` to appear immediately below the alert banner (Section 1 of ScanDashboard), above the locked score cards
- Keep the bottom CTA as a secondary touchpoint for users who do scroll

For `not_found` and `pass` results, the current bottom placement is fine — no urgency is created at the top.

**Implementation:** In `ScanDashboard.tsx`, conditionally render `EmailCaptureForm` after the alert banner when `result.status === 'fail'`. Keep the existing bottom placement for all states.

#### 2. The CTA copy on locked cards

Currently: "Signup to unlock" (from `LockPill` component) and "Sign up to unlock" (from `LockOverlay`).

This copy is generic. It creates no urgency and offers no specific value statement.

**Replace with result-aware copy:**

| Scan result | Lock overlay copy |
|-------------|------------------|
| `fail` | "Sign up to see all AI mistakes about your restaurant →" |
| `not_found` | "Sign up to claim your AI presence →" |
| `pass` | "Sign up to monitor weekly — AI data changes →" |

**Implementation:** Pass `result.status` into `LockOverlay` and `LockPill` components. Add a `statusCopy` prop.

#### 3. The scan lead follow-up sequence

Every email captured in `scan_leads` enters a 3-email sequence. This sequence is the highest-ROI outreach you will send — the person has already seen a problem about their business.

**Email 1 — Immediate (within 5 minutes):**
> Subject: Your AI audit result for [Business Name]
>
> [Business Name] appeared in AI search results [with the following issue / but was missing from AI results].
>
> Here's what we found for free. The full picture requires creating your account — it takes 60 seconds.
>
> [Start monitoring [Business Name] free for 30 days →]
>
> — Senthil, LocalVector

**Email 2 — Day 2 (if no signup):**
> Subject: A competitor is probably being mentioned in your place
>
> When AI doesn't know your restaurant accurately, it recommends a competitor instead.
>
> LocalVector shows you exactly which competitor is getting those mentions. Free for 30 days.
>
> [See your AI competition →]

**Email 3 — Day 5 (if no signup):**
> Subject: Last nudge — your scan expires
>
> Your free scan result for [Business Name] expires in 48 hours.
>
> After that, you'll need to run a new scan to see where AI stands on your restaurant.
>
> [Check my AI accuracy one more time →]

These emails are sent via Resend using the same `sendEmail()` utility in `lib/email.ts`. Implementation: a new `sendScanLeadSequence()` function triggered by a cron job that queries `scan_leads` where `email IS NOT NULL` and `converted_at IS NULL` and calculates the correct sequence step based on `created_at`.

**Migration needed:** Add `email_sequence_step integer DEFAULT 0`, `converted_at timestamptz` to `scan_leads` table before launch.

---

## Section 2: Loop 2 — Trial Activation

### The activation funnel (from BETA-PMF.md §4)

```
Step 1: Signed up
Step 2: Added restaurant location
Step 3: Connected GBP OR entered address
Step 4: First SOV scan completed
Step 5: Viewed AI Health Score
Step 6: Found first AI mistake   ← ACTIVATION MOMENT
Step 7: Initiated correction OR shared result
```

Every trial user who does NOT reach Step 6 within 7 days will churn. This is the only metric that matters in the trial phase.

### Friction points and fixes

#### Step 2–3: Location setup

The onboarding flow (`app/onboarding/connect/`) asks for GBP OAuth. Most trial users will not connect GBP on Day 1 — they are suspicious of OAuth permissions for a new product.

**PLG fix: Manual entry as the default path, GBP OAuth as the upgrade path.**

The current onboarding already supports manual business info entry. Ensure it is presented first, not as a secondary option. Copy: "Enter your restaurant details" as the primary CTA, "Connect Google Business Profile (faster)" as the secondary option below it.

After manual entry, the user should reach Step 4 within 30 seconds. The SOV scan triggers automatically after location creation.

#### Step 4: First SOV scan

The weekly SOV cron runs Sunday at 7 AM UTC — a new trial user who signs up on Tuesday will not see their first scan results for up to 6 days. That is too long to sustain attention.

**PLG fix: Force-run first scan at signup.**

For Trial accounts, trigger a one-time immediate SOV scan on first location creation. This exists as `POST /api/sov/trigger-manual` (P1-FIX-05). Wire it automatically on location creation for trial accounts only — no credit consumption, no rate limit for the first scan.

**Implementation:** In the location creation server action, after successful location insert, call `triggerManualSOVScan(orgId, locationId)` for Trial plan accounts. This is fire-and-forget. The scan completes in 30–90 seconds; the UI polls for completion.

**Current gap:** `trigger-manual` is rate-limited to 1/hr/org (Growth+ only). Add a `first_scan_bypass` flag — allow one free trigger per org with `last_manual_scan_triggered_at IS NULL`.

#### Step 5: Viewing AI Health Score

The dashboard shows the AI Health Score card via the main data page at `app/dashboard/page.tsx`. If the scan is still running when the user lands on the dashboard, they see a loading state.

**PLG fix: The ScanCompleteBanner (already built).**

`components/dashboard/ScanCompleteBanner.tsx` (§178) auto-dismisses after 8 seconds and shows on first scan completion. This is the correct mechanic — no changes needed. Verify it fires correctly for the first-scan path.

#### Step 6: Finding the first AI mistake

This is the moment the product delivers its core promise. Everything before this is preamble.

If no hallucinations exist (the scan ran but found no AI mistakes), the user cannot reach Step 6. This is both the product's worst failure mode and a real scenario for restaurants with accurate AI data.

**PLG fix: SOV gap as the activation substitute.**

If `ai_hallucinations` is empty for the org but `sov_evaluations` show a competitor being mentioned more, show the competitor gap as the "discovery" moment. Copy: "Your restaurant wasn't mentioned when someone asked for [category] in [city]. [Competitor] was."

This is already partially in the product via `AIVisibilityPanel` on the dashboard. Ensure this panel surfaces a specific, named competitor and not just a percentage.

### In-trial upgrade triggers

These are the moments inside the trial when upgrading to Starter or Growth is presented contextually — not as a generic "upgrade now" prompt, but in response to something the user just discovered.

#### Trigger 1: After finding a hallucination (Trial → Starter)

**Where:** `app/dashboard/hallucinations/` page, on the AI Mistakes detail view
**What the user sees:** They found an AI mistake. The correction workflow is visible but gated.
**Current state:** Plan gate blocks the correction initiation — `UpgradeModal` fires.
**Copy optimization:** The UpgradeModal should reference the specific hallucination:

> "Fix AI errors about [Business Name]"
>
> You found that ChatGPT shows [wrong info]. Starter plan lets you initiate corrections across all AI platforms and monitor when they're fixed.
>
> $49/month — start correcting today →

**Implementation:** Pass the hallucination `claim_text` into the UpgradeModal as an optional `context` prop. The modal already has `featureName` and `requiredPlan` props — extend to accept `contextLine?: string`.

#### Trigger 2: After viewing competitor gap (Trial → Starter)

**Where:** `app/dashboard/share-of-voice/` page
**What the user sees:** A competitor is being mentioned more in AI than they are.
**Current state:** SOV page shows the competitor gap. Multi-model breakdown is plan-gated.
**Copy optimization:**

> "[Competitor] is mentioned in 68% of AI responses about [category]. You're in 12%."
>
> Starter plan monitors all 4 AI platforms weekly and alerts you when your gap closes.
>
> $49/month →

#### Trigger 3: After viewing Lost Sales estimate (Trial → Growth)

**Where:** `app/dashboard/revenue-impact/` page
**What the user sees:** The Lost Sales calculator shows an estimated annual loss.
**Current state:** Revenue calculator shows numbers for trial users (no plan gate on this page).
**Conversion moment:** When the annual loss estimate exceeds $1,200, add an inline CTA:

> "You're potentially losing $[X]/year to AI inaccuracy."
>
> AI Shield includes weekly corrections, multi-model monitoring, and content drafts that help close this gap.
>
> $149/month — recover your revenue →

**Implementation:** In `app/dashboard/revenue-impact/page.tsx`, after the Lost Sales total is computed, conditionally show an inline upgrade card when `annualLoss > 1200` and `plan === 'trial' || plan === 'starter'`.

#### Trigger 4: The 7-day trial warning (Trial → Starter)

**Where:** Email (from onboarding sequence Day 7 in CS-SUPPORT.md §4) + in-product banner
**Timing:** Day 7 of trial
**Implementation:** Add a time-based banner in `DashboardShell`. Show when `orgCreatedAt` is between 7 and 14 days ago and plan is still `trial`:

```
"Your free audit ends in [N] days. [N] AI issues are still unresolved for [Business Name]."
[Upgrade to Starter — fix them now →]
```

Reference the count from `ai_hallucinations WHERE status = 'open'` for the org.

---

## Section 3: Loop 3 — Referral & Word of Mouth

### The restaurant owner referral network

Restaurant owners talk to other restaurant owners — at industry events, local associations, Facebook groups, and neighboring businesses. The best referral mechanic for this ICP is one that creates a natural conversation starter, not a discount incentive.

### Mechanic 1: Share Your AI Health Score

After a user's first scan, allow them to share their AI Health Score as a static image or link.

**URL:** `localvector.ai/score/[public_token]` — a read-only public page showing:
- The restaurant name
- Their AI Health Score (the grade, not the number)
- One key finding ("ChatGPT has wrong hours" or "Mentioned in 4 out of 5 AI platforms")
- A CTA: "Is your restaurant's AI data accurate? Find out free →" linking to ViralScanner

**Implementation:**
- Add `public_share_token uuid DEFAULT gen_random_uuid()` to `locations` table (migration needed)
- Create `app/(public)/score/[token]/page.tsx` — server page, read-only, no auth
- Share button on the AI Health Score card in the dashboard: "Share your score →" copies the URL
- The shared page includes the ViralScanner URL in its meta tags (OG image for social sharing)

This mechanic works because restaurant owners are competitive. If an owner sees their neighbor's score is "B" and theirs is unknown, they run the free scan.

### Mechanic 2: "Powered by LocalVector" in the widget (Agency plan)

The white-label agency feature includes a toggle `show_powered_by` in `org_themes` (Sprint 115). When enabled, the widget footer shows "Powered by LocalVector" with a link.

Agencies with the Brand Fortress plan who deploy the RAG chatbot widget to client restaurant websites will passively generate awareness among every website visitor.

This is already built. The conversion action: ensure the "Powered by LocalVector" link goes to a page optimized for agency discovery (`localvector.ai/agencies`) rather than the homepage.

### Mechanic 3: Founding member recognition (Beta)

From BETA-PMF.md §1: beta users who convert to paid are listed as founding members on the website (with permission). This is a social signal, not a financial incentive.

**Implementation:** Add a `is_founding_member boolean DEFAULT false` column to `organizations`. Set to `true` for any org that converts from beta (Day 28 before broad public launch). Create a public `/founding-members` page showing restaurant names and cities.

Low build cost. High social proof value for the first 90 days.

### Mechanic 4: The agency referral channel (Starter → Agency funnel)

Agency referrals are structurally different. An agency discovers LocalVector (often through a client showing them the ViralScanner result), tests it on one client, and then wants to deploy it across their book of business.

The PLG mechanic for agencies is not a referral link — it is a frictionless white-label onboarding.

**White-label agency discovery path:**
1. Agency account manager runs ViralScanner on a client restaurant → `fail` result
2. Account manager signs up for trial → activates
3. Upgrade prompt: "Managing multiple restaurants? Brand Fortress gives you a white-label dashboard for your clients."
4. Agency trial: 30-day free trial on Brand Fortress (10 locations) for verified agencies

**Verification for agency trial:** A simple self-declaration form ("I am an agency managing 3+ restaurant clients") is sufficient at launch. No verification infrastructure needed until 10+ agency accounts.

---

## Section 4: Upgrade Trigger Inventory

Complete inventory of every upgrade surface in the product. All should be verified pre-launch.

| Location | Component | Trigger condition | Current state | Action needed |
|----------|-----------|------------------|---------------|---------------|
| Sidebar nav — locked items | `Sidebar.tsx` + `UpgradeModal` | Click on minPlan-gated item | Built (P1-FIX-06) | Verify copy is specific per feature |
| Plan-locked pages | `PlanGate.tsx` | Load plan-gated page | Built | Verify redirect to `/dashboard?upgrade=[key]` |
| Upgrade redirect banner | `UpgradeRedirectBanner.tsx` | Load `/dashboard?upgrade=[key]` | Built (P1-FIX-07) | Add `corrections`, `multi-model`, `revenue-cta` keys |
| AI Mistakes — correction blocked | `hallucinations/page.tsx` | Click "Initiate correction" | Built (PlanGate) | Add hallucination context to UpgradeModal copy |
| SOV page — multi-model locked | `share-of-voice/page.tsx` | View multi-model breakdown | Built (PlanGate) | Add competitor name to upgrade CTA |
| Revenue Impact — high loss | `revenue-impact/page.tsx` | Annual loss > $1,200 | Not built | Add inline upgrade card (see §2) |
| 7-day trial warning banner | `DashboardShell.tsx` | Day 7–14 + plan=trial | Not built | Add time-based banner (see §2) |
| Credits exhausted | TopBar credits meter | credits_used = credits_limit | Partial — shows red bar | Add "Get more credits" link to billing |
| Content Drafts — export locked | `content-drafts/page.tsx` | Click export | Built (§205) | Verify copy |
| Team page — plan gate | `settings/team/page.tsx` | Non-agency views team page | Built | No change |
| API keys — agency locked | Settings API keys section | Starter/Growth views section | Built | No change |

### Priority build order for missing upgrade triggers

1. **7-day trial warning banner** (highest conversion impact — time-pressure mechanic)
2. **Revenue Impact inline CTA** (self-qualifying: only shows when the math supports it)
3. **Credits exhausted → billing link** (low effort, prevents silent blocking)
4. **ViralScanner CTA copy by result** (described in §1 — affects top of funnel)

---

## Section 5: Funnel Analytics Instrumentation

You cannot optimize what you cannot measure. These are the events to track before launch.

### Events to instrument

All events go to Sentry as structured log entries until a proper analytics tool is added (PostHog or Mixpanel at $5K MRR per FEEDBACK-INFRA.md §7).

| Event | Where | Data to log |
|-------|-------|-------------|
| `scan_completed` | `app/scan/` — after scan result renders | `{ status: 'fail'|'pass'|'not_found', business_name, city }` |
| `scan_lead_captured` | `EmailCaptureForm` submit | `{ scan_status, source: 'post_scan' }` |
| `trial_signup` | `/api/auth/register` success | `{ source: 'viral_scanner'|'direct'|'referral' }` |
| `location_created` | Location creation action | `{ plan, day_since_signup }` |
| `first_scan_triggered` | SOV manual trigger on location create | `{ auto: true }` |
| `activation_reached` | First `ai_hallucinations` row created for org | `{ hours_since_signup }` |
| `upgrade_modal_opened` | `UpgradeModal` render | `{ feature_name, required_plan, current_plan }` |
| `upgrade_cta_clicked` | "Upgrade" link click in modal | `{ feature_name, required_plan }` |
| `trial_to_paid` | Stripe `subscription.updated` → plan changes from trial | `{ new_plan, days_as_trial }` |
| `share_score_clicked` | Share button on Health Score card | `{ plan }` |
| `churn` | Stripe `subscription.deleted` | `{ plan, days_active, churn_reason }` |

### Funnel conversion targets (30-day beta baseline)

| Funnel step | Target rate | How measured |
|-------------|------------|--------------|
| Scan → email capture | ≥ 15% | `scan_leads` / total scan result views |
| Email capture → trial signup | ≥ 30% | `auth.users` created / `scan_leads` with email |
| Signup → activation (Step 6) | ≥ 50% | Orgs with `ai_hallucinations` / total orgs |
| Activation → paid | ≥ 30% | Plan transitions / activated orgs |
| Overall scan → paid | ≥ 1.5% | Paid customers / total scan results |

The 1.5% scan-to-paid target means: if ViralScanner runs 1,000 scans per month, 15 paying customers. At $49/month Starter average, that is $735 MRR from organic scanner traffic alone.

---

## Section 6: ViralScanner as Top-of-Funnel

The ViralScanner is both a marketing tool and a product in itself. Optimizing it is the highest-leverage pre-launch action.

### Scan result page improvements (priority order)

**P0 — before launch:**

1. Move `EmailCaptureForm` above fold for `fail` result (described in §1)
2. Add result-aware locked card copy (described in §1)
3. Ensure `scan_leads` migration adds `email_sequence_step` and `converted_at` columns
4. Verify `EmailCaptureForm` server action sets `scan_status` correctly from scan result

**P1 — first 30 days after launch:**

5. Add social share OG meta tags to `/scan/results` — restaurant owners share scan results on Facebook groups. Currently the page has no OG image. Add a dynamic OG image via `app/scan/results/opengraph-image.tsx` showing the business name and result status.
6. Add a "Share this result" button on the `fail` result page — copies a URL. This creates organic distribution when a restaurant owner shows their AI Health Score to their neighbor.

**P2 — after beta (if scan volume > 500/month):**

7. Email sequence cron for `scan_leads` (described in §1)
8. UTM parameter tracking on all scanner CTAs (so you know which Facebook group or email drove the scan)

### ViralScanner CTA placement

The main landing page at `/` has a ViralScanner widget (rendered twice — hero + secondary CTA, per Playwright notes). Verify both instances use identical behavior. The "Run Another Scan" button in ScanDashboard nav strip is also a re-entry point.

The scan form at the top of the homepage should be the primary above-fold element — no changes needed if it already is.

---

## Section 7: Agency Channel PLG

Agencies are a separate PLG motion. They do not discover LocalVector through the ViralScanner the way restaurant owners do — they discover it when a client asks them "what are you doing about AI search?"

### The agency discovery loop

```
Client restaurant owner shows agency the ViralScanner result
→ Agency account manager runs the scanner on their own clients
→ AM sees all clients have issues
→ AM signs up for Brand Fortress trial (10 locations)
→ AM deploys white-label widget to all client websites
→ "Powered by LocalVector" on 10 restaurant websites
→ Website visitors discover LocalVector
→ Some become direct ViralScanner users
```

### PLG mechanic for agency conversion

**The agency discovery CTA:** In the ViralScanner result footer, add: "This report was powered by LocalVector. Are you a marketing agency? Manage AI visibility for all your restaurant clients →"

Show this CTA only on `fail` results. The logic: an agency account manager who sees a client fail is in the highest-intent state.

**The agency trial offer:** When a user with `plan = 'trial'` visits `/dashboard/settings/team` or `/dashboard/settings/connections`, add a contextual callout:

> "Managing multiple restaurants for an agency?
> Brand Fortress gives you 10 locations, a white-label dashboard, and a client-facing report.
> [Start agency trial →]"

This surfaces the Brand Fortress value proposition at the moment the user is thinking about scale.

---

## Section 8: Launch Activation Sequence

Do not turn on all PLG mechanics at once. Activate in this order to isolate what is working.

| Phase | Weeks | Mechanics active | What you're measuring |
|-------|-------|-----------------|----------------------|
| **Phase 0 — Beta** | Weeks 1–4 | ViralScanner (existing), manual email outreach (BETA-PMF.md), EmailCaptureForm | Qualitative: do users understand the product? Conversion: do 3 of 10 pay? |
| **Phase 1 — Soft launch** | Weeks 5–8 | + Scan lead email sequence (3-email), + First scan auto-trigger on signup, + 7-day trial warning banner | Activation rate (target ≥50% reach Step 6). Trial-to-paid rate (target ≥30%). |
| **Phase 2 — Optimize** | Weeks 9–12 | + ViralScanner CTA copy by result status, + Revenue Impact inline CTA, + Share score mechanic | Scan-to-email-capture rate (target ≥15%). Scan-to-trial rate (target ≥5%). |
| **Phase 3 — Broad launch** | Week 13+ | + Social OG image on scan result, + Agency discovery CTA in scanner footer, + Founding member page | Overall scan-to-paid rate (target ≥1.5%). Agency trial signups (target 2–3 in first 60 days). |

Phase 3 corresponds to the "broad public launch" gate in BETA-PMF.md §7. Do not advance to Phase 3 until the go/no-go criteria pass.

---

## Section 9: What Not to Build Yet

These PLG mechanics are tempting but premature at launch. Build them after $5K MRR.

| Mechanic | Why to defer |
|----------|-------------|
| Referral program with cash/credit incentive | At <50 customers, referral incentives attract deal hunters. Word-of-mouth from real results is more valuable. Add at $5K MRR when you have 100+ customers to seed the referral base. |
| Public Product Hunt launch | PH launches work when you have social proof (50+ reviews, founding members, strong PMF score). Launching too early with weak social proof damages credibility permanently. Plan for Month 4. |
| Paid advertising (Meta/Google) | Do not buy traffic until scan-to-paid is validated at ≥1.5%. Paid CAC at <1.5% conversion will be $300+, unprofitable at Starter ARPU. |
| In-app NPS popup | Premature at <50 customers. Use the email-based NPS survey (FEEDBACK-INFRA.md §6) which is less disruptive. |
| Canny public feature voting board | Premature at <50 customers — attracts non-ICP requests (see FEEDBACK-INFRA.md §7). |
| Zapier / API integrations | Integration ecosystem is a retention play, not a growth play. Build after your core activation rate is solid. |

---

_Last updated: 2026-03-05_
_Owner: Senthilbabu_
_Next action: (1) Move `EmailCaptureForm` above fold for fail-result scans. (2) Add `email_sequence_step` + `converted_at` to `scan_leads` migration. (3) Build first-scan auto-trigger bypass for new Trial accounts. (4) Build 7-day trial warning banner in DashboardShell._
