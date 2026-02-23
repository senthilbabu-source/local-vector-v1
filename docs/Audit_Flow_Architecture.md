# Audit Flow Architecture — Sprint 33
#### Version: 1.0 | Created: 2026-02-23

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
  • 6 cycling messages every 650ms (fade-up re-triggered via key={msgIndex})
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
| `app/scan/_utils/scan-params.ts` | Pure TS — URL param encoding/decoding, KPI derivation |
| `app/scan/_utils/sparkline.ts` | Pure TS — SVG polyline path generator |
| `src/__tests__/unit/scan-params.test.ts` | 10 unit tests for the pure TS utilities |

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

**Message cycling:** `setInterval(650ms)` advances `msgIndex` from 0 to 5 (6 messages). The
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

**Example URLs:**
```
/scan?status=fail&biz=My+Cafe&engine=ChatGPT&severity=critical&claim=Permanently+Closed&truth=Open
/scan?status=pass&biz=My+Cafe&engine=ChatGPT
/scan?status=not_found&biz=My+Cafe&engine=ChatGPT
```

**Invalid / missing params** → `parseScanParams` returns `{ status: 'invalid' }` →
ScanDashboard renders a simple fallback with a "Run a free scan" link.

---

## KPI Score Derivation (AI_RULES §24)

Scores are derived from the **real** Perplexity scan result. They are labeled "Estimated" in
the UI — never claimed as live monitored data.

| Scan Result | AVS | Sentiment | Citation Integrity | AI Mentions |
|-------------|-----|-----------|-------------------|-------------|
| fail + critical | 18 | 12 | 22 | Low |
| fail + high | 34 | 28 | 38 | Low |
| fail + medium | 48 | 41 | 51 | Medium |
| pass | 79 | 74 | 82 | High |
| not_found | 11 | 8 | 9 | None |

**Score color thresholds:** signal-green ≥ 70 · alert-amber 40–69 · alert-crimson < 40

---

## ScanDashboard Sections

| # | Section | AI_RULES Constraint |
|---|---------|---------------------|
| 0 | Sticky nav — logo + "← Run another scan" | — |
| 1 | Alert banner — fail (crimson) / pass (emerald) / not_found (slate) | Real data only |
| 2 | Four KPI cards — AVS, Sentiment, Citation, Mentions | Labeled "Estimated" (§24/§20) |
| 3 | Competitive landscape — My Brand + 3 static bars, locked | "Sample data" disclaimer |
| 4 | Locked Fixes — item 1 real, items 2–3 blurred + lock icon | Item 1 = real result |
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
