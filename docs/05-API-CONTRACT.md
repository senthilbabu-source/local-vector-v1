# 05 — API Contract & Route Specification

## The Technical Contract Between Frontend and Backend
## Base URL: `https://app.localvector.ai/api/v1`
### Version: 2.3 | Date: February 16, 2026

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
  "audits_remaining": 42
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
  "prompt_type": "status_check",  // Valid: "status_check", "hours_check", "amenity_check", "menu_check"
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
  "public_url": "[https://menu.localvector.ai/charcoal-n-chill](https://menu.localvector.ai/charcoal-n-chill)",
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
**📐 Data Contract:** The `extracted_data` structure shown above is the canonical shape. It MUST conform to the `MenuExtractedData` Zod schema defined in Doc 03, Section 9 (TypeScript Data Interfaces). All code that reads or writes this field — backend extraction, frontend editing, JSON-LD generation — MUST import and validate against that schema.

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
  "public_url": "[https://menu.localvector.ai/charcoal-n-chill](https://menu.localvector.ai/charcoal-n-chill)",
  "json_ld_preview": { /* Schema.org object */ }
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
    "ground_truth": "[https://menu.localvector.ai/charcoal-n-chill](https://menu.localvector.ai/charcoal-n-chill)"
  }
}
```

### GET `menu.localvector.ai/:slug` (PUBLIC — No Auth)

Serves the generated Markdown file for AI agents (GPTBot, ClaudeBot).

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

### ⚠️ Scope: Read & Monitor Only

Listings endpoints track the user's presence on the Big 6 directories. We do **NOT** write data back to Google, Yelp, Apple Maps, or any third-party directory API. The `PUT` endpoint updates our internal record only (e.g., user pastes in their Yelp URL or marks a listing as verified).

The user corrects mismatches by clicking through to each platform directly. This is a deliberate MVP architectural decision to avoid OAuth complexity and third-party API dependency.

**🤖 Agent Rule:** Do NOT implement any OAuth integration, API client, or write-back logic for external directories. No external API calls are made from any `/listings` endpoint.

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

**Use cases:**
- User pastes in the correct URL for their Yelp page after claiming it.
- User marks a listing as "synced" after manually fixing hours on Google.
- System updates `nap_consistency_score` after a health check.

**🤖 Agent Rule:** This endpoint writes to the `directory_listings` table only. No external HTTP calls.

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

**🤖 Agent Rule:** This endpoint MUST NOT query the `locations` or `organizations` tables. It operates entirely outside the tenant context.

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
    "monday": { "open": "17:00", "close": "23:00" },
    "tuesday": "closed"
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