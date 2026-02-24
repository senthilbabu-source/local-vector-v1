# Audit Flow Architecture — Sprint 34+35
#### Version: 2.1 | Created: 2026-02-23 | Updated: 2026-02-23

---

## Overview

The Audit Flow turns the free ViralScanner into a full "Value-Creation Journey" that ends on a
public `/scan` result dashboard designed to drive signups. It is the primary conversion funnel
for anonymous users on the marketing landing page.

```
User types on landing page
        │
        ├─ Business name  → Places autocomplete  → business selected (phase: selected)
        │                                         → manual city fallback (phase: manual)
        │
        └─ Website URL    → URL detected, autocomplete suppressed (phase: idle, isUrlMode)
                          → "🔗 Scanning as website URL" hint shown

        Submit form
        │
        ▼
  phase: scanning — Diagnostic overlay
  • CSS fill-bar 4s animation (signal-green)
  • 6 cycling messages every 800ms (fade-up re-triggered via key={msgIndex})
  • runFreeScan() Server Action in flight (useTransition)
        │
        ▼
  ScanResult received
        │
        ├─ fail / pass / not_found → router.push('/scan?params') → ScanDashboard
        │
        └─ unavailable / rate_limited → inline card (stay on landing page)
```

---

## Files

| File | Role |
|------|------|
| `app/_components/ViralScanner.tsx` | Phase state machine, URL detection, diagnostic overlay, redirect |
| `app/actions/marketing.ts` | `runFreeScan()` Server Action — Perplexity API, rate limiting |
| `app/scan/page.tsx` | Async Server Component — awaits `searchParams`, parses, renders ScanDashboard |
| `app/scan/_components/ScanDashboard.tsx` | `'use client'` — full result dashboard (5 sections) |
| `app/scan/_utils/scan-params.ts` | Pure TS — URL param encoding/decoding; real fields (Sprint 34) + issue categories (Sprint 35) |
| `app/scan/_utils/sparkline.ts` | Pure TS — SVG polyline path generator (still used for trend lines) |
| `src/__tests__/unit/scan-params.test.ts` | 14 unit tests for the pure TS utilities |

---

## ViralScanner Phase State Machine

```
            ┌─────────────────────────────────┐
            │             idle                │
            │  name/URL input + autocomplete  │
            └───────────┬─────────────────────┘
                        │
         ┌──────────────┼──────────────────┐
         │              │                  │
    select from     "Enter manually"    type URL
    dropdown        link clicked        (looksLikeUrl)
         │              │                  │
         ▼              ▼                  │
    ┌─────────┐   ┌──────────┐             │
    │selected │   │  manual  │             │
    │name RO  │   │city input│             │
    └────┬────┘   └────┬─────┘             │
         │             │                  │
         └──────┬───────┘                 │
                │ submit ◄────────────────┘
                ▼
        ┌──────────────┐
        │   scanning   │
        │ diagnostic   │
        │  overlay     │
        └──────┬───────┘
               │
    ┌──────────┼──────────────────────┐
    │                                 │
  fail/pass/not_found         unavailable/rate_limited
    │                                 │
    ▼                                 ▼
 router.push('/scan?...')      inline result card
    │                         (phase: result)
    ▼
 ScanDashboard
```

---

## Smart Search — URL Mode

**Detection regex** (`looksLikeUrl()`, module-private):
```typescript
/^https?:\/\//i.test(input) ||
/^(www\.)?[\w-]+\.(com|net|org|io|co|ai|app|biz|us)\b/i.test(input)
```

When `isUrlMode = true`:
- Places autocomplete useEffect returns early (no API calls)
- Dropdown hidden, no "Enter manually" shown
- "🔗 Scanning as website URL" hint appears
- `url` field appended to FormData on submit
- Perplexity prompt includes ` (website: example.com)` context

---

## Diagnostic Overlay — Animation Details

All animations use existing CSS keyframes from `globals.css`. No Framer Motion.

| Element | Keyframe | Duration | Notes |
|---------|----------|----------|-------|
| Pulsing dot | `ping-dot` | 1.5s infinite | `cubic-bezier(0,0,0.2,1)` |
| Progress bar | `fill-bar` | 4s forwards | `cubic-bezier(0.4,0,0.2,1)` |
| Message text | `fade-up` | 0.3s both | Re-triggered by `key={msgIndex}` re-mount |

**Message cycling:** `setInterval(800ms)` advances `msgIndex` from 0 to 5 (6 messages). The
`key={msgIndex}` prop on the `<p>` forces React to unmount/remount the element on each change,
which restarts the `fade-up` CSS animation. This avoids any JavaScript animation library.

---

## /scan URL Schema

Result is encoded entirely in URL search params (ephemeral — no server storage):

| Param | Present for | Value |
|-------|------------|-------|
| `status` | all | `fail` \| `pass` \| `not_found` |
| `biz` | all | Business name (URL-encoded) |
| `engine` | all | `ChatGPT` |
| `severity` | fail only | `critical` \| `high` \| `medium` |
| `claim` | fail only | Claim text (e.g., `Permanently Closed`) |
| `truth` | fail only | Expected truth (e.g., `Open`) |
| `mentions` | fail, pass | `none`\|`low`\|`medium`\|`high` — real from Perplexity (Sprint 34) |
| `sentiment` | fail, pass | `positive`\|`neutral`\|`negative` — real from Perplexity (Sprint 34) |
| `issues` | fail, pass (optional) | Pipe-separated accuracy issues, URL-encoded (Sprint 34) |
| `issue_cats` | fail, pass (optional) | Pipe-separated issue categories — `hours`\|`address`\|`menu`\|`phone`\|`other` (Sprint 35) |

**Example URLs:**
```
/scan?status=fail&biz=My+Cafe&engine=ChatGPT&severity=critical&claim=Permanently+Closed&truth=Open&mentions=low&sentiment=negative
/scan?status=fail&biz=My+Cafe&engine=ChatGPT&...&issues=AI+shows+wrong+address&issue_cats=address
/scan?status=pass&biz=My+Cafe&engine=ChatGPT&mentions=high&sentiment=positive
/scan?status=not_found&biz=My+Cafe&engine=ChatGPT
```

**Backwards-compat:** Sprint 33/34 URLs lacking `mentions`/`sentiment`/`issue_cats` params are
decoded with graceful defaults — never returns `invalid` for missing optional params.

**Invalid / missing params** → `parseScanParams` returns `{ status: 'invalid' }` →
ScanDashboard renders a simple fallback with a "Run a free scan" link.

---

## Real AI-Presence Fields (Sprint 34, AI_RULES §26)

Sprint 34 replaced the Sprint 33 KPI lookup table (`deriveKpiScores`) with real fields
returned directly by Perplexity. The `/scan` dashboard now uses a **free / locked** split:

**Free (real, from Perplexity):**
| Field | Type | Shown as |
|-------|------|----------|
| `mentions_volume` | `'none'`\|`'low'`\|`'medium'`\|`'high'` | AI Mentions card with "Live" badge |
| `sentiment` | `'positive'`\|`'neutral'`\|`'negative'` | AI Sentiment card with "Live" badge |

**Locked (numerical — require continuous monitoring):**
| Card | Shown as |
|------|----------|
| AI Visibility Score (AVS) | `██/100` with lock overlay |
| Citation Integrity (CI) | `██/100` with lock overlay |

The `accuracy_issues` field (up to 3 strings) and `accuracy_issue_categories` parallel array
from Perplexity are used in the Detected Issues section (Sprint 35 — see below).

---

## ScanDashboard Sections

| # | Section | AI_RULES Constraint |
|---|---------|---------------------|
| 0 | Sticky nav — logo + "← Run another scan" | — |
| 1 | Alert banner — fail (crimson) / pass (emerald) / not_found (slate) | Real data only |
| 2 | **Row 1: "From Your Scan"** — AI Mentions + AI Sentiment (real categoricals) | Real from Perplexity, "Live" badge (§26) |
| 2 | **Row 2: "Unlock Full Scores"** — AVS + Citation Integrity (locked ██/100) | Honest about monitoring required (§26) |
| 3 | Competitive landscape — My Brand bar (colored, no score) + 3 sample bars, locked | "Sample data" disclaimer, no fake numbers |
| 4 | **Detected Issues** — item 1 unlocked: first `accuracy_issue` (if any) or main result; items 2–3 locked/blurred: next real issues or generic fallback | Sprint 35: real issues with category badge (§24, §26) |
| 5 | CTA — "Claim My AI Profile — Start Free" → `/signup` | — |

---

## Routing & Auth

`/scan` is a **public route** — not in `PROTECTED_PREFIXES` in `app/proxy.ts` (which only
protects `/dashboard`). The middleware passes `/scan` through without auth checks.

`robots: { index: false, follow: false }` is set on the scan page — result URLs are personal
and should not be indexed by search engines.

---

## Future Improvements

| Item | Notes |
|------|-------|
| **Persistent result URLs** | Store scan result in Vercel KV with UUID → `/scan/[id]`. Currently ephemeral (URL params only). |
| **URL scraping** | Add Firecrawl/Jina integration to actually verify business data from the website URL. Currently passes URL as context string to Perplexity. |
| **Real AVS data for auth users** | Phase 5 SOV cron populates `visibility_analytics`. The `/scan` Estimated KPIs remain permanent for anonymous users. |
| **Email capture** | Add optional email field to CTA (pre-fills signup form). |
