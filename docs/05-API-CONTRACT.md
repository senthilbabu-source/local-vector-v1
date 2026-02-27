# 05 — API Contract & Route Specification

## The Technical Contract Between Frontend and Backend
## Base URL: `https://app.localvector.ai/api/v1`
### Version: 2.5 | Date: February 24, 2026

---

## 1. Authentication & Security Protocol

All API requests (except the public Magic Menu layer and the free hallucination checker) require authentication.

- **Auth Method:** Bearer token (Supabase JWT) via `Authorization: Bearer <token>` header.
- **Tenant Context:** `org_id` is automatically resolved from the JWT via the `memberships` table. It is NEVER passed by the client.
- **Rate Limiting:** 60 requests/minute per `org_id` (enforced via Vercel KV).
- **Plan Enforcement:** Endpoints that consume API credits check `ai_audits_used_this_month < max_ai_audits_per_month` before executing.
- **Rate Limit Headers:** Every response includes X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset. Coding agents must use these to disable UI buttons when limits are reached.

## 1.1 Session Bootstrap

### GET `/auth/context`

Lightweight endpoint used to resolve the current user's tenant context. Called on every app shell mount and used by the Onboarding Guard (Doc 06) to handle the delay between Supabase Auth signup and the PostgreSQL trigger creating the org.

**Response (org exists):**
```json
{
  "user_id": "uuid",
  "email": "aruna@charcoalnchill.com",
  "org_id": "uuid",
  "org_name": "Charcoal N Chill",
  "role": "owner",
  "plan": "growth",
  "onboarding_completed": true
}
```

**Response (org not yet created — trigger pending):**
```json
{
  "user_id": "uuid",
  "email": "aruna@charcoalnchill.com",
  "org_id": null,
  "org_name": null,
  "role": null,
  "plan": null,
  "onboarding_completed": false
}
```

**Frontend behavior:** If `org_id` is `null`, display "Setting up your workspace..." and poll this endpoint every 1 second for up to 10 seconds. See Doc 06, Onboarding Guard State.

---

## 2. Dashboard & Overview

### GET `/dashboard/stats`

Returns aggregated metrics for the dashboard home screen.

**Response:**
```json
{
  "reality_score": 72,
  "score_trend": "+3",
  "open_hallucinations": 2,
  "hallucinations_fixed_this_month": 5,
  "competitor_intercepts_this_month": 3,
  "magic_menu_published": true,
  "magic_menu_page_views": 450,
  "listings_synced": 4,
  "listings_total": 7,
  "last_audit_date": "2026-02-15T03:00:00Z",
  "next_audit_date": "2026-02-16T03:00:00Z",
  "plan": "growth",
  "audits_remaining": 42,
  "sov_score": 18.5,
  "sov_last_run": "2026-02-23T02:00:00Z",
  "first_mover_alerts_count": 2,
  "content_drafts_pending": 1
}
```

---

## 3. The Fear Engine (Hallucination Audits)

### GET `/hallucinations`

Returns all hallucinations, filterable by status.

**Query Params:** `?status=open|fixed|dismissed&severity=critical|high|medium|low`

**Response:**
```json
{
  "hallucinations": [
    {
      "id": "uuid",
      "severity": "critical",
      "category": "status",
      "model_provider": "perplexity-sonar",
      "claim_text": "Perplexity reports the venue is permanently closed.",
      "expected_truth": "Venue is OPERATIONAL. Open Mon-Sat 5PM-12AM.",
      "correction_status": "open",
      "first_detected_at": "2026-02-10T03:00:00Z",
      "last_seen_at": "2026-02-15T03:00:00Z",
      "occurrence_count": 3,
      "propagation_events": [
        { "event": "fixed", "date": "2026-02-16T10:00:00Z" },
        { "event": "crawled", "date": "2026-02-18T14:30:00Z" }
      ]
    }
  ],
  "total": 2
}
```

### POST `/audits/run`

Triggers an on-demand audit. Deducts from monthly quota.

**Request Body:**
```json
{
  "prompt_type": "status_check",
  "model_provider": "perplexity-sonar",
  "location_id": "uuid (optional, defaults to primary)"
}
```

**Response:** `202 Accepted` with audit ID. Results appear in `/hallucinations` once processed.
```json
{
  "audit_id": "uuid",
  "status": "processing",
  "estimated_completion_seconds": 15
}
```

**Error (quota exceeded):** `429 Too Many Requests`
```json
{
  "error": "Monthly audit limit reached",
  "audits_used": 60,
  "audits_limit": 60,
  "upgrade_url": "/billing/upgrade"
}
```

### POST `/hallucinations/:id/verify`

Re-runs the specific audit to check if the hallucination has been corrected.

**Cooldown Rule:** Only executable once every 24 hours per hallucination to manage API costs and respect AI propagation timelines.

**Response (Success):**
```json
{
  "id": "uuid",
  "previous_status": "open",
  "new_status": "fixed",
  "verification_response": "Perplexity now correctly reports the venue as open."
}
```
**Error (Cooldown Active):** `429 Too Many Requests`
```json
{
  "error": "Verification cooldown active",
  "message": "AI models take time to update. Please wait 24 hours before re-verifying this fix.",
  "retry_after_seconds": 86400
}
```

### PATCH `/hallucinations/:id/dismiss`

User manually dismisses a hallucination (e.g., it's a false positive).

**Request Body:**
```json
{
  "resolution_notes": "This is actually correct — we are closed Mondays now."
}
```

---

## 4. The Magic Engine (Menu & Schema)

### GET `/magic-menu`

Returns the current menu status for the org's primary location.

**Response:**
```json
{
  "id": "uuid",
  "processing_status": "published",
  "public_url": "https://menu.localvector.ai/charcoal-n-chill",
  "page_views": 450,
  "human_verified": true,
  "verified_at": "2026-02-01T00:00:00Z",
  "item_count": 47,
  "last_updated": "2026-02-01T00:00:00Z",
  "propagation_events": [
    { "event": "published", "date": "2026-02-01T10:00:00Z" },
    { "event": "link_injected", "date": "2026-02-01T10:05:00Z" }
  ]
}
```

### POST `/magic-menu/upload`

Accepts PDF or image upload. Initiates OCR pipeline.

**Request:** `multipart/form-data` with `file` field (max 10MB, PDF/JPG/PNG).

**Response:** `202 Accepted`
```json
{
  "menu_id": "uuid",
  "processing_status": "processing",
  "estimated_completion_seconds": 30
}
```

### POST `/magic-menu/manual`

Creates an empty menu record for manual entry (no file upload). Used when OCR pipeline is unavailable or the user prefers to type their menu directly.

**Request Body:**
```json
{
  "location_id": "uuid (optional, defaults to primary)"
}
```

**Response:** `201 Created`
```json
{
  "menu_id": "uuid",
  "processing_status": "review_ready",
  "extracted_data": []
}
```

**Next step:** User populates the menu via `PUT /magic-menu/:id` with the full `extracted_data` array, then publishes via `POST /magic-menu/:id/publish`.

### GET `/magic-menu/:id/preview`

Returns the AI-extracted menu data for user review before publishing.

**Response:**
```json
{
  "menu_id": "uuid",
  "extraction_confidence": 0.92,
  "extracted_data": [
    {
      "category": "Appetizers",
      "items": [
        {
          "name": "Samosa Chaat",
          "description": "Crispy samosas topped with tangy chutneys and yogurt",
          "price": 12.99,
          "dietary_tags": ["vegetarian"]
        }
      ]
    }
  ]
}
```

**Data Contract:** The `extracted_data` structure shown above is the canonical shape. It MUST conform to the `MenuExtractedData` Zod schema defined in Doc 03, Section 9 (TypeScript Data Interfaces). All code that reads or writes this field — backend extraction, frontend editing, JSON-LD generation — MUST import and validate against that schema.

### PUT `/magic-menu/:id`

Update menu data. Supports two workflows:
1. **Post-OCR editing:** User corrects AI-extracted prices and descriptions after a `POST /upload`.
2. **Manual entry (fallback):** User builds the menu from scratch without uploading a file. In this case, a menu record is created via `POST /magic-menu/manual` first, then populated via this endpoint.

**Request Body:** The full `extracted_data` array conforming to the `MenuExtractedData` schema (Doc 03, Section 9).
```json
{
  "extracted_data": [
    {
      "category": "Appetizers",
      "items": [
        {
          "name": "Samosa Chaat",
          "description": "Crispy samosas topped with tangy chutneys and yogurt",
          "price": 12.99,
          "dietary_tags": ["vegetarian"]
        }
      ]
    }
  ]
}
```

### POST `/magic-menu/:id/publish`

Converts reviewed data into JSON-LD and deploys to public edge.

**Prerequisites:** `human_verified` must be `true` (user clicked "I certify this is correct").

**Response:**
```json
{
  "status": "published",
  "public_url": "https://menu.localvector.ai/charcoal-n-chill",
  "json_ld_preview": {}
}
```

### GET `/magic-menu/:id/aeo-health`

Returns the "Answer-First" compliance score for a specific menu. Used by the "Readability Meter" in the dashboard.

**Response:**
```json
{
  "readability_score": 85,
  "missing_keywords": ["happy hour", "vegan options"],
  "llm_preview": "Charcoal N Chill is a premier hookah lounge in Alpharetta serving..."
}
```

### GET `menu.localvector.ai/:slug/llms.txt` (PUBLIC — No Auth)

Serves the generated Markdown file for AI agents (GPTBot, ClaudeBot).

**Headers:** `Content-Type: text/plain or text/markdown`.
**Cache:** Vercel Edge Cache, `s-maxage=3600`.

---

### GET `menu.localvector.ai/:slug/ai-config.json` (PUBLIC — No Auth)

Serves the GEO configuration file used to declare the entity's "Ground Truth" to search engines.
**Headers:** `Content-Type: application/json`.
**Response:**
```json
{
  "entity": "Charcoal N Chill",
  "data_sources": {
    "ground_truth": "https://menu.localvector.ai/charcoal-n-chill"
  }
}
```

### GET `menu.localvector.ai/:slug` (PUBLIC — No Auth)

Serves the public Magic Menu page with embedded JSON-LD for AI agents.

**Headers:** `Content-Type: text/html with embedded application/ld+json`.
**Cache:** Vercel Edge Cache, `Cache-Control: public, s-maxage=86400, stale-while-revalidate=3600`.

---

## 5. The Greed Engine (Competitor Intercept)

**Access:** Growth tier and above only. Returns `403` for Starter/Trial.

> **Architectural note (Phase 3):** The Greed Engine endpoints below were implemented
> as Next.js Server Actions rather than REST Route Handlers. Server Actions are idiomatic
> for App Router internal mutations and provide RLS-scoped auth automatically via
> `getSafeAuthContext()`. The four Server Actions in `app/dashboard/compete/actions.ts`
> cover the full contract: `addCompetitor` (POST /competitors), `deleteCompetitor` (DELETE),
> `runCompetitorIntercept` (POST /competitors/intercepts — 2-stage Perplexity → GPT-4o-mini),
> and `markInterceptActionComplete` (PATCH /competitors/intercepts/:id/action).
> REST endpoints are deferred to Phase 4+ when external API consumers require them.

### GET `/competitors`

Returns the user's defined competitors.

**Response:**
```json
{
  "competitors": [
    { "id": "uuid", "name": "Cloud 9 Lounge", "address": "123 Main St, Alpharetta, GA" }
  ],
  "max_competitors": 3
}
```

### POST `/competitors`

Add a competitor to track (max 3 for Growth, 10 for Agency).

### GET `/competitors/intercepts`

Returns the latest intercept analysis results.

**Response:**
```json
{
  "intercepts": [
    {
      "id": "uuid",
      "competitor_name": "Cloud 9 Lounge",
      "query_asked": "Best hookah bar in Alpharetta",
      "winner": "Cloud 9 Lounge",
      "winning_factor": "15 more review mentions of 'late night' atmosphere",
      "gap_magnitude": "high",
      "gap_details": { "competitor_mentions": 15, "your_mentions": 2 },
      "suggested_action": "Ask 3 customers to mention 'late night' in their reviews",
      "action_status": "pending",
      "created_at": "2026-02-15T03:00:00Z"
    }
  ]
}
```

### PATCH `/competitors/intercepts/:id/action`

Update the status of a suggested action task.

**Request Body:**
```json
{ "action_status": "completed" }
```

---

## 6. Listings (The Big 6)

### Scope: Read & Monitor Only

Listings endpoints track the user's presence on the Big 6 directories. We do **NOT** write data back to Google, Yelp, Apple Maps, or any third-party directory API. The `PUT` endpoint updates our internal record only (e.g., user pastes in their Yelp URL or marks a listing as verified).

The user corrects mismatches by clicking through to each platform directly. This is a deliberate MVP architectural decision to avoid OAuth complexity and third-party API dependency.

**Agent Rule:** Do NOT implement any OAuth integration, API client, or write-back logic for external directories. No external API calls are made from any `/listings` endpoint.

### GET `/listings`

Returns directory listing status for the org's primary location.

**Response:**
```json
{
  "listings": [
    {
      "id": "uuid",
      "directory": "google",
      "display_name": "Google Business Profile",
      "sync_status": "synced",
      "listing_url": "https://maps.google.com/...",
      "nap_consistency_score": 95,
      "last_checked_at": "2026-02-15T03:00:00Z"
    },
    {
      "id": "uuid",
      "directory": "yelp",
      "display_name": "Yelp",
      "sync_status": "mismatch",
      "listing_url": "https://yelp.com/biz/...",
      "nap_consistency_score": 70,
      "last_checked_at": "2026-02-14T03:00:00Z"
    }
  ]
}
```

### PUT `/listings/:id`

Update the **internal** record for a directory listing. This does NOT push data to the external directory.

**Request Body:**
```json
{
  "listing_url": "https://yelp.com/biz/charcoal-n-chill-alpharetta",
  "sync_status": "synced | mismatch | not_found | not_claimed",
  "nap_consistency_score": 95
}
```

**Agent Rule:** This endpoint writes to the `directory_listings` table only. No external HTTP calls.

---

## 7. Visibility Score

### GET `/visibility/current`

Returns the most recent Reality Score and its components.

### GET `/visibility/history?days=30`

Returns historical score snapshots for trend charts.

**Response:**
```json
{
  "scores": [
    { "date": "2026-02-15", "reality_score": 72, "visibility": 65, "accuracy": 80, "data_health": 70 },
    { "date": "2026-02-08", "reality_score": 69, "visibility": 60, "accuracy": 75, "data_health": 70 }
  ]
}
```

---

## 8. Billing

### POST `/billing/checkout`

Creates a Stripe Checkout session.

**Request Body:** `{ "plan": "starter" | "growth" | "agency" }`

**Response:** `{ "checkout_url": "https://checkout.stripe.com/..." }`

### POST `/billing/portal`

Creates a Stripe Customer Portal session for managing subscriptions.

### POST `/webhooks/stripe` (Internal — No Auth, Stripe Signature Verification)

Handles Stripe events. See Doc 02, Section 5 for implementation.

---

## 9. Public Free Tool (No Auth)

**Goal:** Capture emails from users who "pass" the free check by warning them about future risk.

### POST `/public/hallucination-check`

The viral "Is ChatGPT Lying About Your Restaurant?" tool.

**Ground Truth Source:** For the free tool, Ground Truth is constructed from the **Google Places API** (business hours, status, address) — NOT from the `locations` table (the business is not a tenant). The response's `reality` field reflects Google Places data. See Doc 04 for the prompt construction logic.

**Agent Rule:** This endpoint MUST NOT query the `locations` or `organizations` tables. It operates entirely outside the tenant context.

**Rate Limit:** 1 per IP per day (Vercel KV).

**Request Body:**
```json
{
  "business_name": "Charcoal N Chill",
  "city": "Alpharetta",
  "state": "GA"
}
```

**Response:**
```json
{
  "status": "hallucination_detected",
  "checks": [
    {
      "model": "Perplexity",
      "question": "Is Charcoal N Chill in Alpharetta open?",
      "ai_answer": "Charcoal N Chill is currently OPEN.",
      "reality": "Charcoal N Chill is currently OPEN.",
      "result": "PASS",
      "severity": "none"
    }
  ],
  "cta": {
    "message": "You are safe **today**. However, AI models drift every week. Enter your email to get a free re-scan next Monday.",
    "signup_url": "https://app.localvector.ai/signup?intent=drift_monitor"
  }
}
```

**Error (business not found):** `404 Not Found`
```json
{
  "status": "not_found",
  "message": "We couldn't find a business matching that name in that city. Try the exact name as it appears on Google.",
  "suggestion": "Check spelling or try a nearby city."
}
```

---

## 10. Agency Endpoints (Agency Tier Only)

### GET `/orgs`

Lists all organizations managed by the agency user.

### POST `/orgs/switch`

Switches the active org context for the session.

**Request Body:** `{ "org_id": "uuid" }`

### GET `/reports/export?format=pdf`

Generates a white-label audit report PDF for a client.

---

## 11. Location & Settings (Truth Calibration)

### PATCH `/locations/primary`

Used during **Onboarding Step 2.5 (Truth Calibration)** to save the business's ground truth before the first audit runs.

**Request Body:**
```json
{
  "business_name": "Charcoal N Chill",
  "amenities": {
    "has_outdoor_seating": true,
    "serves_alcohol": true,
    "takes_reservations": false
  },
  "hours_data": {
    "monday": "closed",
    "tuesday": { "open": "17:00", "close": "01:00" }
  }
}
```

### POST `/magic-menu/:id/track-injection`

Call this when the user clicks "I have pasted this link into Google" in the **Link Injection Modal** (Doc 06).
Updates `propagation_events` with `event: 'link_injected'`.

**Response:** `200 OK`
```json
{
  "status": "recorded",
  "propagation_events": [
    { "event": "published", "date": "2026-02-01T10:00:00Z" },
    { "event": "link_injected", "date": "2026-02-01T10:05:00Z" }
  ]
}
```

---

## 12. SOV Engine (Share-of-Answer)

> **Spec:** Doc 04c — SOV Engine Specification, Sections 3–6
> **Auth:** Bearer JWT required. `org_id` resolved from token.
> **Plan Gate:** All plans (Starter: system queries only; Growth+: custom queries allowed)

### GET `/sov/queries`

Returns the active SOV query library for the org's primary location.

**Query Params:** `?location_id=uuid&category=discovery|comparison|occasion|near_me|custom&active_only=true`

**Response:**
```json
{
  "queries": [
    {
      "id": "uuid",
      "query_text": "best hookah lounge Alpharetta GA",
      "query_category": "discovery",
      "occasion_tag": null,
      "intent_modifier": null,
      "is_system_generated": true,
      "is_active": true,
      "last_run_at": "2026-02-23T02:00:00Z",
      "last_sov_result": 100,
      "last_cited": true,
      "run_count": 4
    },
    {
      "id": "uuid",
      "query_text": "hookah open now Alpharetta",
      "query_category": "near_me",
      "occasion_tag": null,
      "intent_modifier": null,
      "is_system_generated": true,
      "is_active": true,
      "last_run_at": "2026-02-23T02:00:00Z",
      "last_sov_result": 0,
      "last_cited": false,
      "run_count": 4
    }
  ],
  "total": 13,
  "custom_queries_used": 0,
  "custom_queries_limit": 5
}
```

### POST `/sov/queries`

Add a custom query to the tracking library. **Growth tier and above only.**

**Plan Gate:** Returns `403` for Starter plan.

**Request Body:**
```json
{
  "query_text": "best hookah bar for bachelorette party Alpharetta",
  "query_category": "occasion",
  "occasion_tag": "bachelorette",
  "intent_modifier": null,
  "location_id": "uuid (optional, defaults to primary)"
}
```

**Validation:**
- `query_text`: required, max 200 chars, must not duplicate existing active query for this location
- `query_category`: required, must be one of: `discovery`, `comparison`, `occasion`, `near_me`, `custom`

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "query_text": "best hookah bar for bachelorette party Alpharetta",
  "query_category": "occasion",
  "is_system_generated": false,
  "is_active": true,
  "created_at": "2026-02-23T12:00:00Z"
}
```

**Error (custom limit reached):** `422 Unprocessable Entity`
```json
{
  "error": "Custom query limit reached",
  "custom_queries_used": 5,
  "custom_queries_limit": 5,
  "upgrade_url": "/billing/upgrade"
}
```

**Error (duplicate query):** `409 Conflict`
```json
{
  "error": "This query is already being tracked for this location."
}
```

### DELETE `/sov/queries/:id`

Deactivates a custom query (sets `is_active = false`). System-generated queries cannot be deleted — they can only be deactivated.

**Response:** `200 OK`
```json
{ "id": "uuid", "is_active": false }
```

**Error (system query delete attempt):** `403 Forbidden`
```json
{
  "error": "System-generated queries cannot be deleted. Use PATCH to deactivate."
}
```

### GET `/sov/report`

Returns the latest SOV report with trend data and top-level metrics.

**Query Params:** `?location_id=uuid&weeks=8` (default: 8 weeks of history)

**Response:**
```json
{
  "current": {
    "snapshot_date": "2026-02-23",
    "share_of_voice": 18.5,
    "citation_rate": 42.0,
    "queries_run": 13,
    "queries_cited": 3,
    "top_cited_query": "best hookah lounge Alpharetta GA"
  },
  "trend": [
    { "snapshot_date": "2026-02-23", "share_of_voice": 18.5, "citation_rate": 42.0 },
    { "snapshot_date": "2026-02-16", "share_of_voice": 15.4, "citation_rate": 38.0 },
    { "snapshot_date": "2026-02-09", "share_of_voice": 15.4, "citation_rate": 35.0 }
  ],
  "week_over_week_delta": 3.1,
  "state": "ready"
}
```

**Response (new tenant, cron not yet run):**
```json
{
  "current": null,
  "trend": [],
  "week_over_week_delta": null,
  "state": "calculating",
  "message": "Your first AI visibility scan runs Sunday at 2 AM EST. Check back Monday."
}
```

**Agent Rule:** Always handle `state: "calculating"` in the frontend. Never render a score of `0` for first-time users — render the calculating state (Doc 06 Section 8).

### GET `/sov/alerts`

Returns open First Mover Alerts — queries where no local business is currently cited by AI.

**Query Params:** `?status=new|actioned|dismissed&location_id=uuid`

**Response:**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "query_text": "hookah lounge open late Alpharetta",
      "query_category": "near_me",
      "detected_at": "2026-02-23T02:15:00Z",
      "status": "new",
      "opportunity_copy": "AI isn't recommending anyone for this query. Be the first to own it."
    }
  ],
  "total_new": 2
}
```

### POST `/sov/alerts/:id/action`

Mark an alert as actioned (user clicked "Create Content") or dismissed.

**Request Body:**
```json
{ "action": "actioned" | "dismissed" }
```

**Response:** `200 OK`
```json
{ "id": "uuid", "status": "actioned", "actioned_at": "2026-02-23T14:00:00Z" }
```

### GET `/sov/gaps`

Returns the Prompt Intelligence gap analysis for a location — untracked queries, competitor-discovered gaps, and zero-citation clusters. Computed on-demand from the reference library and current query library.

**Spec:** Doc 15 — Local Prompt Intelligence, Section 8.3

**Query Params:** `?location_id=uuid` (required)

**Response:**
```json
{
  "gaps": [
    {
      "gapType": "untracked",
      "queryText": "hookah bar open late Alpharetta GA",
      "queryCategory": "near_me",
      "estimatedImpact": "high",
      "suggestedAction": "Add \"hookah bar open late Alpharetta GA\" to your tracking library."
    },
    {
      "gapType": "competitor_discovered",
      "queryText": "best late night hookah Alpharetta",
      "queryCategory": "comparison",
      "estimatedImpact": "high",
      "suggestedAction": "Cloud 9 Lounge is winning this query. Track it to measure your progress."
    },
    {
      "gapType": "zero_citation_cluster",
      "queryText": "hookah near me, hookah open now, best hookah near me",
      "queryCategory": "near_me",
      "estimatedImpact": "high",
      "suggestedAction": "Multiple tracked queries are returning zero citations. This suggests a content gap, not a tracking gap — consider creating a page that directly answers these queries."
    }
  ],
  "totalGaps": 3,
  "lastAnalyzedAt": "2026-02-25T02:30:00Z"
}
```

**Error (missing location_id):** `400 Bad Request`
```json
{ "error": "location_id query parameter is required" }
```

**Error (location not found):** `404 Not Found`
```json
{ "error": "Location not found or access denied" }
```

### POST `/cron/sov` (Internal — Service Role Only)

Triggered by Vercel Cron weekly at Sunday 2 AM EST. Executes the SOV cron job (Doc 04c Section 4). Not callable by authenticated browser clients.

**Auth:** `Authorization: Bearer ${CRON_SECRET}` (env var, not user JWT)

**Response:** `202 Accepted`
```json
{
  "status": "queued",
  "estimated_queries": 156,
  "triggered_at": "2026-02-23T07:00:00Z"
}
```

---

## 13. Content Drafts (Autopilot Pipeline)

> **Spec:** Doc 19 — Autopilot Engine (planned). Table DDL: `supabase/migrations/20260223000002_content_pipeline.sql`
> **Auth:** Bearer JWT required.
> **Plan Gate:** Content draft generation (automated) requires Growth tier. Viewing drafts is available on all plans.

The Content Drafts endpoints expose the human-in-the-loop approval layer for AI-generated content. Drafts are created automatically by the Autopilot Engine (Doc 19) when triggers fire (competitor gap, occasion, First Mover Alert). Humans review and approve before any content is published.

**Agent Rule:** No content is ever auto-published. `human_approved` must be `true` and `status` must be `'approved'` before the publish endpoint is callable. The publish endpoint validates both fields server-side — do not rely on client-side checks alone.

### GET `/content-drafts`

Returns all content drafts for the org.

**Query Params:** `?status=draft|approved|published|rejected|archived&trigger_type=competitor_gap|occasion|prompt_missing|first_mover|manual&location_id=uuid`

**Response:**
```json
{
  "drafts": [
    {
      "id": "uuid",
      "trigger_type": "competitor_gap",
      "trigger_id": "uuid",
      "draft_title": "Why Charcoal N Chill is Alpharetta's Best Late-Night Hookah Experience",
      "content_type": "faq_page",
      "aeo_score": 74,
      "status": "draft",
      "human_approved": false,
      "target_prompt": "best hookah lounge Alpharetta late night",
      "published_url": null,
      "created_at": "2026-02-23T08:00:00Z"
    }
  ],
  "total": 1,
  "pending_approval_count": 1
}
```

### GET `/content-drafts/:id`

Returns the full draft content for review.

**Response:**
```json
{
  "id": "uuid",
  "trigger_type": "competitor_gap",
  "trigger_context": {
    "competitor_name": "Cloud 9 Lounge",
    "winning_factor": "15 more review mentions of 'late night' atmosphere",
    "query_asked": "best hookah lounge Alpharetta late night"
  },
  "draft_title": "Why Charcoal N Chill is Alpharetta's Best Late-Night Hookah Experience",
  "draft_content": "Looking for the best hookah lounge open late in Alpharetta? Charcoal N Chill stays open until 2 AM on weekends...",
  "content_type": "faq_page",
  "aeo_score": 74,
  "aeo_breakdown": {
    "answer_first": 85,
    "keyword_density": 70,
    "structure": 65
  },
  "target_prompt": "best hookah lounge Alpharetta late night",
  "target_keywords": ["late night hookah Alpharetta", "hookah lounge open late"],
  "status": "draft",
  "human_approved": false,
  "created_at": "2026-02-23T08:00:00Z"
}
```

### PATCH `/content-drafts/:id`

Edit draft content before approving. Available while `status = 'draft'`.

**Request Body (all fields optional):**
```json
{
  "draft_title": "Updated title",
  "draft_content": "Updated content...",
  "target_prompt": "refined target query"
}
```

**Response:** `200 OK` — returns updated draft object.

**Error (draft already approved):** `409 Conflict`
```json
{
  "error": "Draft cannot be edited after approval. Reject it first to re-enable editing."
}
```

### POST `/content-drafts/:id/approve`

Marks a draft as human-approved and ready to publish.

**Request Body:**
```json
{
  "approver_notes": "Optional — note why this was approved / any edits made"
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "status": "approved",
  "human_approved": true,
  "approved_at": "2026-02-23T14:00:00Z"
}
```

### POST `/content-drafts/:id/reject`

Moves draft back to editable state for revision.

**Request Body:**
```json
{
  "rejection_reason": "The opening paragraph is too generic. Needs to mention our Versace lounge specifically."
}
```

**Response:** `200 OK`
```json
{ "id": "uuid", "status": "draft", "human_approved": false }
```

### POST `/content-drafts/:id/publish`

Publishes an approved draft. **Requires `human_approved: true` and `status: 'approved'`.**

Currently supported publish targets:
- `wordpress` — posts to connected WordPress site via REST API (Phase 6)
- `gbp_post` — posts to Google Business Profile as a GBP update (Phase 6)
- `download` — returns the content as a downloadable HTML/Markdown file (Phase 5, available first)

**Request Body:**
```json
{
  "publish_target": "download",
  "wordpress_config": {
    "post_type": "page",
    "slug": "alpharetta-late-night-hookah"
  }
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "status": "published",
  "published_url": "https://charcoalnchill.com/alpharetta-late-night-hookah",
  "published_at": "2026-02-23T15:00:00Z"
}
```

**Error (not approved):** `403 Forbidden`
```json
{
  "error": "Draft must be approved before publishing. Call POST /content-drafts/:id/approve first.",
  "human_approved": false
}
```

---

## 14. Page Audits (Content Grader — Site-Wide)

> **Spec:** Doc 17 — Content Grader Specification (planned). Table DDL: `supabase/migrations/20260223000002_content_pipeline.sql`
> **Auth:** Bearer JWT required.
> **Plan Gate:** All plans (Starter: primary page audit only; Growth+: full site audit)

The Page Audit endpoints extend the existing `ai_readability_score` (currently menu-only) to all pages on the tenant's website. An audit fetches the page URL, evaluates AEO readiness, and returns a prioritized fix list.

### GET `/pages/audits`

Returns all page audits for the org, ordered by `last_audited_at` descending.

**Query Params:** `?page_type=homepage|menu|about|faq|events|occasion|other&location_id=uuid`

**Response:**
```json
{
  "audits": [
    {
      "id": "uuid",
      "page_url": "https://charcoalnchill.com",
      "page_type": "homepage",
      "overall_score": 58,
      "aeo_readability_score": 50,
      "answer_first_score": 45,
      "schema_completeness_score": 75,
      "faq_schema_present": false,
      "last_audited_at": "2026-02-23T10:00:00Z",
      "top_recommendation": "Add an answer-first paragraph above the fold targeting 'best hookah lounge Alpharetta'"
    }
  ],
  "total": 3,
  "average_score": 62
}
```

### GET `/pages/audits/:id`

Returns full audit detail including all recommendations.

**Response:**
```json
{
  "id": "uuid",
  "page_url": "https://charcoalnchill.com",
  "page_type": "homepage",
  "overall_score": 58,
  "aeo_readability_score": 50,
  "answer_first_score": 45,
  "schema_completeness_score": 75,
  "faq_schema_present": false,
  "recommendations": [
    {
      "issue": "No answer-first paragraph",
      "fix": "Add: 'Charcoal N Chill is Alpharetta's premier hookah lounge, open Thursday-Sunday until 2 AM, featuring Indo-American fusion cuisine and live entertainment.'",
      "impact_points": 20,
      "priority": "high"
    },
    {
      "issue": "Missing FAQ schema",
      "fix": "Add FAQPage schema answering: 'Does Charcoal N Chill serve food?', 'Is hookah available?', 'Do you take reservations?'",
      "impact_points": 15,
      "priority": "high"
    },
    {
      "issue": "No LocalBusiness schema on homepage",
      "fix": "Add LocalBusiness JSON-LD with name, address, hours, phone, and priceRange.",
      "impact_points": 10,
      "priority": "medium"
    }
  ],
  "last_audited_at": "2026-02-23T10:00:00Z"
}
```

### POST `/pages/audits/run`

Triggers an audit for a specific page URL. Fetches the URL, scores it, and upserts the result.

**Request Body:**
```json
{
  "page_url": "https://charcoalnchill.com/about",
  "page_type": "about",
  "location_id": "uuid (optional, defaults to primary)"
}
```

**Validation:**
- `page_url`: required, must be a valid HTTPS URL
- Page must be publicly accessible (no auth walls)
- For Starter plan: only `page_type: 'homepage'` allowed

**Response:** `202 Accepted`
```json
{
  "audit_id": "uuid",
  "status": "processing",
  "page_url": "https://charcoalnchill.com/about",
  "estimated_completion_seconds": 20
}
```

Results appear in `GET /pages/audits` once processing completes (typically < 30 seconds).

**Error (Starter plan restriction):** `403 Forbidden`
```json
{
  "error": "Starter plan supports homepage audits only. Upgrade to audit additional pages.",
  "upgrade_url": "/billing/upgrade"
}
```

**Error (monthly quota exceeded):** `429 Too Many Requests`
```json
{
  "error": "Monthly page audit limit reached",
  "audits_used": 10,
  "audits_limit": 10,
  "plan": "growth",
  "resets_at": "2026-03-01T00:00:00Z",
  "upgrade_url": "/billing/upgrade"
}
```

> **Quota limits (from Doc 17 Section 3.1):** Starter = 1 audit/month (homepage only), Growth = 10/month, Agency = 50/month across all locations. Quota is tracked against `org_id` + current billing period.

**Error (page not accessible):** `422 Unprocessable Entity`
```json
{
  "error": "Page returned a non-200 status. Ensure the URL is publicly accessible.",
  "status_code_received": 404
}
```

### POST `/cron/page-audits` (Internal — Service Role Only)

Triggered by Vercel Cron monthly. Re-audits all tracked pages for drift detection.

**Auth:** `Authorization: Bearer ${CRON_SECRET}`

**Response:** `202 Accepted`
```json
{
  "status": "queued",
  "pages_queued": 12,
  "triggered_at": "2026-02-23T06:00:00Z"
}
```

---

## 15. Citation Gap Intelligence

> **Spec:** Doc 18 — Citation Intelligence (planned). Table DDL: `supabase/migrations/20260223000002_content_pipeline.sql`
> **Auth:** Bearer JWT required. `citation_source_intelligence` table is shared market data — no RLS, read via service role and surfaced through this API.
> **Plan Gate:** Growth tier and above only.

These endpoints expose the Citation Intelligence layer — which platforms AI models cite when answering local queries for a given category+city. This powers the Citation Gap Finder integrated into the Listings page (Doc 06 Section 11).

### GET `/citations/platform-map`

Returns citation frequency by platform for the org's business category and city. Powers the "Which platforms does AI cite for hookah lounges in Alpharetta?" view.

**Query Params:** `?location_id=uuid&model_provider=perplexity-sonar|openai-gpt4o`

**Response:**
```json
{
  "category": "hookah lounge",
  "city": "Alpharetta",
  "state": "GA",
  "model_provider": "perplexity-sonar",
  "platforms": [
    {
      "platform": "yelp",
      "citation_frequency": 0.87,
      "frequency_label": "Cited in 87% of AI answers",
      "org_listed": true,
      "org_listing_url": "https://yelp.com/biz/charcoal-n-chill-alpharetta",
      "gap": false
    },
    {
      "platform": "tripadvisor",
      "citation_frequency": 0.62,
      "frequency_label": "Cited in 62% of AI answers",
      "org_listed": false,
      "org_listing_url": null,
      "gap": true,
      "gap_action": "Claim your TripAdvisor listing to appear in 62% more AI answers"
    },
    {
      "platform": "google",
      "citation_frequency": 0.94,
      "frequency_label": "Cited in 94% of AI answers",
      "org_listed": true,
      "org_listing_url": "https://maps.google.com/...",
      "gap": false
    }
  ],
  "measured_at": "2026-02-20T00:00:00Z"
}
```

**Notes:**
- `org_listed` is derived by joining against the `listings` table for this org.
- `gap: true` when `org_listed: false` AND `citation_frequency > 0.3` (threshold: platform matters enough to be worth claiming).
- If no citation data exists for this category+city, returns empty `platforms` array with `measured_at: null` and a `data_collection_note` explaining when data will be available.

### GET `/citations/gap-score`

Returns a single gap score (0–100) representing how well-represented the org is on AI-cited platforms vs. the maximum possible.

**Response:**
```json
{
  "gap_score": 68,
  "platforms_covered": 3,
  "platforms_that_matter": 5,
  "top_gap": {
    "platform": "tripadvisor",
    "citation_frequency": 0.62,
    "action": "Claim your TripAdvisor listing"
  }
}
```

**Agent Rule:** `gap_score` is surfaced in the DataHealth component of the Reality Score (Doc 04 Section 6). It replaces the current placeholder for listing sync % in the DataHealth calculation once Doc 18 is implemented. Do not surface citation gap data on Starter plan — return `403`.

---

## 16. Surgical Integration Routes (2026-02-24)

> **Spec:** Surgical Integration Plan — Surgeries 2, 3, 5, 6
> **Added:** February 24, 2026
> **Implementation note:** All AI service calls in this section use Vercel AI SDK v4 (`generateText()` / `streamText()`) per `.cursorrules` §20. No raw `fetch()` calls to LLM APIs.

### 16.1 SOV Cron — Implementation Detail

> **Note:** This supplements the SOV cron spec in Section 12. The implementation uses `GET` method (not `POST`) and Vercel AI SDK v4 with a Perplexity custom provider.

**Route:** `GET /api/cron/sov`
**Auth:** `Authorization: Bearer ${CRON_SECRET}` (env var, not user JWT)
**Implementation:** `lib/services/sov.service.ts` (AI SDK `generateText()` with Perplexity custom provider)

**Response 200:**
```json
{
  "ok": true,
  "orgs_processed": 12,
  "queries_run": 180,
  "alerts_created": 3,
  "emails_sent": 2
}
```

**Schedule:** Weekly, Sunday 2 AM EST via Vercel Cron.
**Vercel Cron config (add to `vercel.json`):**
```json
{ "crons": [{ "path": "/api/cron/sov", "schedule": "0 7 * * 0" }] }
```

**Kill switch:** Set `STOP_SOV_CRON=true` in env to halt execution without removing the cron schedule.

**Supporting services:**
- `lib/services/sov-seed.service.ts` — Seeds 12–15 system queries per location at onboarding
- `lib/services/sov-email.service.ts` — Weekly SOV report email (fires only when SOV changes >= 2 points or First Mover Alert detected)

---

### 16.2 Content Audit Cron Endpoint

**Route:** `GET /api/cron/content-audit`
**Auth:** `Authorization: Bearer ${CRON_SECRET}`
**Implementation:** `lib/services/content-crawler.service.ts` (HTML parser), `lib/services/page-auditor.service.ts` (AEO scorer)

**Response 200:**
```json
{
  "ok": true,
  "orgs_found": 8,
  "pages_audited": 24,
  "failed": 0
}
```

**Content Crawler capabilities:**
- HTML parsing with heading extraction (H1–H6)
- Schema.org JSON-LD extraction from `<script type="application/ld+json">`
- Meta tag extraction (title, description, robots)
- Body text extraction for keyword density analysis

**Page Auditor scoring dimensions (weights from Doc 17 Section 2):**
- Answer-first structure score
- Schema completeness score
- Keyword density score
- FAQ presence detection

**Agent Rule:** The content crawler uses `generateText()` from the Vercel AI SDK (§22 in `.cursorrules`). Do NOT rewrite as raw `fetch()`.

---

### 16.3 MCP Server Endpoint

**Route:** `GET|POST|DELETE /api/mcp/{transport}`
**Transport:** Streamable HTTP (`transport` parameter is always `mcp` in practice).
**Auth:** MCP protocol-level authentication. No bearer token required at the HTTP layer — MCP clients handle their own auth handshake.
**Implementation:** `lib/mcp/tools.ts` (tool definitions), `app/api/mcp/[transport]/route.ts` (handler via `mcp-handler` package)

**Available tools:**

| Tool | Input Schema | Output |
|------|-------------|--------|
| `get_visibility_score` | `{ business_name: string }` | Visibility metrics (SOV, reality score, accuracy, open hallucinations) |
| `get_sov_report` | `{ business_name: string }` | Latest SOV snapshot + 8-week trend data |
| `get_hallucinations` | `{ business_name: string, status?: "open" \| "fixed" \| "dismissed" }` | Hallucination list with severity, model, claim, truth |
| `get_competitor_analysis` | `{ business_name: string }` | Competitor intercept results with gap analysis |

**Tool resolution pattern:** All tools resolve `orgId` by looking up `business_name` in the `locations` table, then joining to `organizations`. Query is case-insensitive via `.ilike()`. Tools return `{ error: "Business not found" }` if no match.

**MCP client configuration:**
```json
{
  "mcpServers": {
    "localvector": {
      "url": "https://app.localvector.ai/api/mcp/mcp"
    }
  }
}
```

**Agent Rule:** MCP tool schemas MUST use `zod/v3` (not `zod`). The MCP SDK requires Zod v3; the project's Zod v4 provides a v3 compat layer at this import path. See `.cursorrules` §24.2. Do NOT change these imports to `zod` — it will cause runtime errors.

---

### 16.4 AI Chat Endpoint (Generative UI)

**Route:** `POST /api/chat`
**Auth:** User session via `getSafeAuthContext()`. Returns `401` if not authenticated.
**Implementation:** `app/api/chat/route.ts`, `lib/tools/visibility-tools.ts`

**Request:**
```
POST /api/chat
Content-Type: application/json
Cookie: <session>
```

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "What's my visibility score?" }
  ]
}
```

**Response:** Server-Sent Events (SSE) data stream via AI SDK `toDataStreamResponse({ getErrorMessage })`. Not a standard JSON response — consumed by `useChat()` from `@ai-sdk/react` on the client. Stream errors (API key, rate limit, timeout) are mapped to user-friendly messages via `getErrorMessage` before reaching the client.

**System prompt:** "You are the LocalVector AI Assistant — an expert in AI visibility, AEO (Answer Engine Optimization), GEO (Generative Engine Optimization), and hallucination detection for local businesses."

**Tools available in chat context:**

| Tool | Zod Schema (v4) | Return Type Field |
|------|-----------------|-------------------|
| `getVisibilityScore` | `{}` (no input) | `{ type: "visibility_score", share_of_voice, reality_score, accuracy_score, open_hallucinations }` |
| `getSOVTrend` | `{}` | `{ type: "sov_trend", data: [{ date, sov }] }` |
| `getHallucinations` | `{ status?: "open" \| "fixed" \| "all" }` | `{ type: "hallucinations", filter, total, items: [{ severity, model, category, claim, truth }] }` |
| `getCompetitorComparison` | `{}` | `{ type: "competitor_comparison", competitors: [{ name, analyses, recommendation }] }` |

All tools are org-scoped — they automatically query using the authenticated user's `orgId`. No business name lookup required (unlike MCP tools which serve external clients).

**Agent Rule:** Chat tools use standard `zod` (v4) for schemas, unlike MCP tools which use `zod/v3`. See `.cursorrules` §25.2. The `type` field in each tool's return value is used by the `Chat.tsx` client component to select the appropriate UI card renderer (ScoreCard, TrendList, AlertList, CompetitorList).

**Dashboard page:** `/dashboard/ai-assistant`
**Client component:** `app/dashboard/ai-assistant/_components/Chat.tsx` (uses `useChat()` hook from `@ai-sdk/react`)
**UX spec:** Doc 06, Section 16

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.6 | 2026-02-25 | Added `GET /sov/gaps` endpoint (Doc 15 §8.3) — Prompt Intelligence gap report. Updated SOV cron summary to include `gaps_detected` field. |
| 2.5 | 2026-02-24 | Added Section 16 (Surgical Integration Routes — 4 endpoint groups): SOV cron implementation detail with Vercel AI SDK, Content Audit cron with crawler + auditor services, MCP Server with 4 AI-callable tools via Streamable HTTP transport, AI Chat streaming endpoint with 4 org-scoped tools + Generative UI. All routes use Vercel AI SDK v4 (`generateText`/`streamText`). MCP tools use `zod/v3`; chat tools use `zod` v4. Cross-references `.cursorrules` §20–§27. |
| 2.4 | 2026-02-23 | Added Section 12 (SOV Engine — 7 endpoints). Added Section 13 (Content Drafts — 6 endpoints). Added Section 14 (Page Audits — 4 endpoints). Added Section 15 (Citation Gap Intelligence — 2 endpoints). Updated `GET /dashboard/stats` response to include SOV fields. Added version history table. |
| 2.3 | 2026-02-16 | Initial version. Auth, Fear Engine, Magic Engine, Greed Engine, Listings, Visibility Score, Billing, Public Tool, Agency, Location/Settings endpoints. |
