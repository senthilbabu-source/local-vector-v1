# LocalVector.ai — V1 Core Loop: Five-Stage User Journey

> **Source:** This document is derived from `DEVLOG.md` Phases 12–16 and 19.
> It describes the end-to-end flow a restaurant owner experiences from first contact to
> AI-corrected visibility. Each stage maps to exactly one product phase.

---

## Overview

```
[/]                [/onboarding]          [/dashboard]         [/dashboard/         [/m/:slug]
 Acquire      →     Calibrate       →      Monitor        →    magic-menus]    →   Distribute
(Phase 16)        (Phase 12)             (Phase 13)           Fix (Phase 14)     (Phase 15)
```

A prospective owner hits the marketing page, is shocked by a hallucination demo, signs up,
completes the ground-truth wizard, sees their active AI lies on the fear-first dashboard,
publishes a corrected menu, and injects the honeypot link into Google Business Profile.

---

## Stage 1 — Acquire (Phase 16: Viral Wedge / Free Scanner)

**Entry point:** `/` (public, no auth required)

**Goal:** Turn visitor outrage into a `/login` click.

### What happens
1. Owner lands on the marketing page (`app/page.tsx`).
2. They fill in "Business Name" and "City, State" into the `ViralScanner` widget.
3. `runFreeScan()` (Server Action in `app/actions/marketing.ts`) simulates a 2-second AI scan
   and returns a hardcoded `FAIL` result:
   - Engine: `ChatGPT`
   - Severity: `critical`
   - Claim: `"Permanently Closed"`
4. A red alert card appears with the hallucination details and a full-width CTA:
   **"Claim Your Profile to Fix This Now"** → `href="/login"`.
5. The page also shows the social proof badge ("AI Visibility Score: 98/100") and
   the Charcoal N Chill case study ($1,600/month revenue recovery).

### Key components
| File | Role |
|------|------|
| `app/page.tsx` | Landing page Server Component |
| `app/_components/ViralScanner.tsx` | `'use client'` form with `useTransition` |
| `app/actions/marketing.ts` | `runFreeScan()` Server Action (mock, no live API) |

### E2E coverage
`tests/e2e/01-viral-wedge.spec.ts` — 3 tests: scan form → red alert card → CTA href → social proof badge → case study text.

---

## Stage 2 — Calibrate (Phase 12: Onboarding Guard / Truth Calibration)

**Entry point:** `/onboarding` (auth required; guard fires automatically)

**Goal:** Collect the "ground truth" business data that powers all hallucination comparisons.

### What happens
1. After signup/login, the user navigates to `/dashboard/*`.
2. `app/dashboard/layout.tsx` checks the primary location:
   - If `hours_data IS NULL AND amenities IS NULL` → `redirect('/onboarding')`.
3. The `TruthCalibrationForm` (3-step wizard) collects:
   - **Step 1:** Business Name (text input, pre-filled from DB).
   - **Step 2:** Amenity toggles (Outdoor Seating, Serves Alcohol, Takes Reservations, etc.).
   - **Step 3:** Hours grid — each day has a "Closed" toggle or `<input type="time">` for open/close.
4. On submit, `saveGroundTruth()` (`app/onboarding/actions.ts`) validates with Zod,
   derives `org_id` server-side via `getSafeAuthContext()`, and writes to `locations`.
5. Client calls `router.push('/dashboard')` on success.

### JSONB encoding rules (Doc 03 §15.1, AI_RULES §10)
```json
{
  "monday":    "closed",
  "tuesday":   { "open": "11:00", "close": "22:00" },
  "wednesday": { "open": "11:00", "close": "22:00" }
}
```
- Missing key → "hours unknown" (do not infer closed).
- String literal `"closed"` → explicitly closed that day.

### Key components
| File | Role |
|------|------|
| `app/onboarding/page.tsx` | Server Component shell |
| `app/onboarding/_components/TruthCalibrationForm.tsx` | `'use client'` 3-step wizard |
| `app/onboarding/actions.ts` | `saveGroundTruth()` Server Action (Zod v4, RLS-safe) |
| `app/dashboard/layout.tsx` | Onboarding guard (redirect if `!hours_data && !amenities`) |

### E2E coverage
`tests/e2e/02-onboarding-guard.spec.ts` — 1 test: auth guard fires on `/dashboard/magic-menus` → redirect to `/onboarding` → wizard completes → `/dashboard` redirect confirmed.

---

## Stage 3 — Monitor (Phase 13: Fear First Dashboard / Reality Score)

**Entry point:** `/dashboard` (auth required; onboarding guard already passed)

**Goal:** Show the owner every active AI lie about their business, leading with fear.

### What happens
1. `app/dashboard/page.tsx` (Server Component) queries `ai_hallucinations` in parallel:
   - Open alerts (correction_status = `'open'`) → passed to `AlertFeed`.
   - Fixed count → contributes to Reality Score Accuracy component.
2. `AlertFeed` renders open hallucinations with pulsing `alert-crimson` left border,
   severity badge, friendly engine name, claim_text vs expected_truth, and time elapsed.
   - If no open alerts: "All clear! No AI lies detected." green banner.
3. `RealityScoreCard` shows the composite Reality Score:
   ```
   Reality Score = Visibility×0.4 + Accuracy×0.4 + DataHealth×0.2
   ```
   - Visibility: `null` on first load — renders "Calculating..." skeleton until weekly SOV cron runs. Populated by SOV Engine (Doc 04c). **Never render a fallback number.** First real score appears after Sunday 2 AM EST cron run.
   - Accuracy: derived from open alert count.
   - DataHealth: 100 (user passed the onboarding guard).
   - Color: truth-emerald ≥80, amber 60–79, alert-crimson <60.
4. "Fix with Magic Menu" CTA in each alert links to `/dashboard/magic-menus`.

### Key components
| File | Role |
|------|------|
| `app/dashboard/page.tsx` | Server Component, parallel Supabase queries |
| `app/dashboard/_components/AlertFeed.tsx` | Hallucination list, severity badges |
| `app/dashboard/_components/RealityScoreCard.tsx` | Composite score formula |
| `supabase/seed.sql §10` | 2 open + 1 fixed hallucination for golden tenant |

### E2E coverage
`tests/e2e/03-dashboard-fear-first.spec.ts` — 5 tests: AlertFeed leads, Reality Score=87, hamburger menu opens sidebar, Listings nav item present, correct page title.

---

## Stage 4 — Fix (Phase 14: Magic Menu Pipeline)

**Entry point:** `/dashboard/magic-menus` (auth required)

**Goal:** Extract, review, and publish a corrected machine-readable menu.

### What happens
1. If no `magic_menus` record exists for the org, `MenuWorkspace` renders `UploadState`:
   - Drag-and-drop zone + "Simulate AI Parsing" button.
2. Clicking "Simulate AI Parsing" calls `simulateAIParsing()`:
   - Creates a `magic_menus` record (if absent).
   - Populates `extracted_data` with confidence-scored menu items.
   - Advances `processing_status` to `'review_ready'`.
3. `ReviewState` renders the Confidence Triage UI:
   - **≥0.85** → Auto-Approved (collapsed, truth-emerald).
   - **0.60–0.84** → Needs Review (expanded, amber).
   - **<0.60** → Must Edit (expanded, alert-crimson; blocks publish).
4. Owner checks "I certify this menu is accurate" and clicks "Approve All & Publish to AI".
5. `approveAndPublish()` marks `human_verified=true`, `is_published=true`,
   `processing_status='published'`, revalidates `/m/[slug]`.
6. `LinkInjectionModal` appears with the public URL (`/m/{slug}`), a Copy button,
   and "Open Google Business Profile" external link.
7. Clicking "I pasted this link into Google" calls `trackLinkInjection()`.

### Key components
| File | Role |
|------|------|
| `app/dashboard/magic-menus/page.tsx` | Server Component, fetches MenuWorkspaceData |
| `app/dashboard/magic-menus/_components/MenuWorkspace.tsx` | `'use client'` state machine |
| `app/dashboard/magic-menus/_components/UploadState.tsx` | Upload/simulate UI |
| `app/dashboard/magic-menus/_components/ReviewState.tsx` | Confidence triage + certify |
| `app/dashboard/magic-menus/_components/LinkInjectionModal.tsx` | Post-publish distribution modal |
| `app/dashboard/magic-menus/actions.ts` | `simulateAIParsing`, `approveAndPublish`, `trackLinkInjection` |
| `lib/types/menu.ts` | `MenuExtractedItem`, `MenuExtractedData`, `MenuWorkspaceData` |

### E2E coverage
`tests/e2e/04-magic-menu-pipeline.spec.ts` — 1 test: full pipeline from UploadState → triage → certify → publish → LinkInjectionModal.

---

## Stage 5 — Distribute (Phase 15: AI Honeypot / Public Menu Page)

**Entry point:** `/m/:slug` (public, edge-cached, no auth)

**Goal:** Serve machine-readable ground truth to AI crawlers after the owner injects the URL.

### What happens
1. AI crawlers (ChatGPT, Perplexity, Gemini, etc.) follow the GBP link and land on `/m/{slug}`.
2. The page (`app/m/[slug]/page.tsx`) emits two `<script type="application/ld+json">` blocks:
   - **Restaurant schema**: name, address, phone, `openingHoursSpecification` (built from `hours_data`).
   - **Menu schema**: `hasMenuSection` → `hasMenuItem` tree from published menu items.
3. Crawlers that support `llms.txt` fetch `/m/{slug}/llms.txt`:
   - `text/plain` Markdown with `# BusinessName`, `## Business Information`,
     `## Operating Hours`, `## Amenities`, `## Menu` sections.
   - Hours formatted in 12h, "Closed" for closed days, "Hours not specified" for missing keys.
4. Advanced crawlers fetch `/m/{slug}/ai-config.json` (GEO Standard):
   - `$schema`, `entity` (name, type, location_id, SHA-256 address hash), `data_sources`,
     `policies`, `last_updated`.

### Key components
| File | Role |
|------|------|
| `app/m/[slug]/page.tsx` | Public menu page, Deep Night theme, dual JSON-LD |
| `app/m/[slug]/llms.txt/route.ts` | Route Handler → `text/plain` LLM-readable Markdown |
| `app/m/[slug]/ai-config.json/route.ts` | Route Handler → `application/json` GEO Standard |
| `lib/types/ground-truth.ts` | `HoursData`, `DayHours`, `Amenities` (imported, not re-defined) |

### E2E coverage
`tests/e2e/05-public-honeypot.spec.ts` — 4 tests: page renders business name and menu items; Restaurant + Menu JSON-LD blocks present and valid; `llms.txt` returns 200 with correct Markdown structure; `ai-config.json` returns 200 with GEO Standard fields.

---

## Full Loop Diagram

```
Visitor hits /
     │
     ▼
[ViralScanner] — runFreeScan() (mock, 2s delay)
     │ red alert card: "ChatGPT says Permanently Closed"
     ▼
[/login] ──── signup/login ────►
                                │
                                ▼
                  [dashboard/layout.tsx Onboarding Guard]
                       │ hours_data IS NULL?
                  YES  │                  NO
                  ▼                       ▼
         [/onboarding]            [/dashboard] Reality Score
         TruthCalibrationForm      AlertFeed → "Fix with Magic Menu"
                  │                       │
                  ▼                       ▼
         saveGroundTruth()        [/dashboard/magic-menus]
         → /dashboard             simulateAIParsing → ReviewState
                                  → approveAndPublish → LinkInjectionModal
                                            │
                                            ▼
                                  [/m/:slug] + llms.txt + ai-config.json
                                  AI crawlers consume ground truth
                                  Reality Score improves next audit cycle
```

---

> **Last updated:** Phase 19 (2026-02-22)
> All five stages have full Playwright E2E coverage — 25/25 tests passing.
