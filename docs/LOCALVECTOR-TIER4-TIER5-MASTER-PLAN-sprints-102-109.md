# 📋 LOCALVECTOR — TIER 4 + TIER 5 MASTER PLAN
## Sprints 102–109 | Ready to Execute When Data + APIs Are In Place

> **HOW TO USE THIS DOC**
> This is NOT a sprint prompt. It is a planning reference.
> When you're ready to execute a sprint, take the sprint's section here
> and use it as the briefing for Claude Code to generate the full prompt
> (same format as Sprints 96–101).
>
> **Tier status at time of writing:**
> - ✅ Tier 1 (Revenue-ready core): Complete
> - ✅ Tier 2 (Crons + AI visibility pipeline): Complete
> - ✅ Tier 3 (Agency + multi-user): Complete — Sprints 98–101
> - 🔲 Tier 4 (Sync + Distribution): Sprints 102–104 — **API registrations required first**
> - 🔲 Tier 5 (Differentiation moat): Sprints 105–109 — **Requires 4–8 weeks of live data**

---

## ⚡ BEFORE YOU START TIER 4

Two external API registrations must be submitted and approved before Sprint 102 or 103 can begin. These are approval-gated — Anthropic can't accelerate them. Submit the moment Tier 3 ships.

### Apple Business Connect API
- **What:** Apple's API for pushing business data to Apple Maps / Siri
- **Why needed:** Sprint 102 (Apple BC Sync) cannot proceed without approval
- **Register at:** https://businessconnect.apple.com
- **Approval time:** 2–4 weeks typically
- **What to prepare:** Business name, EIN or DUNS number, website, intended use case ("managing business location data for multiple clients via API")
- **Status tracking:** Save the confirmation email. Paste the API key into `.env.local` as `APPLE_BC_CLIENT_ID` and `APPLE_BC_CLIENT_SECRET` when received.

### Bing Places API
- **What:** Microsoft's API for pushing business data to Bing / Copilot / Edge
- **Why needed:** Sprint 103 (Bing Places Sync) cannot proceed without approval
- **Register at:** https://bingplaces.com → Partner API access
- **Approval time:** 1–3 weeks
- **Status tracking:** Paste key into `.env.local` as `BING_PLACES_API_KEY` when received.

> **If both APIs are still pending:** Do Sprint 104 (Dynamic FAQ Injection) first — it has no external dependencies and unblocks SEO value immediately.

---

---

# 🔵 TIER 4 — SYNC + DISTRIBUTION
## Sprints 102–104 | Push ground truth outward to every AI data source

**Tier theme:** Tiers 1–3 built the monitoring and agency infrastructure. Tier 4 shifts from monitoring to distribution — pushing the verified ground truth data LocalVector maintains into the platforms that AI models actually query. Apple Maps, Bing, and the business's own website become live data sources rather than passive targets.

**Tier outcome:** A LocalVector Agency org can correct a hallucination once (in the Truth Calibration form) and have that correction propagate to Google (existing), Apple Maps/Siri (new), and Bing/Copilot (new) simultaneously, plus appear in FAQ schema on the business's own pages.

---

## Sprint 102 — Apple Business Connect Sync

**Gap:** Feature #72 (Apple Business Connect) | **Effort:** L | **Dependency:** Apple BC API approval

### What this sprint builds
A one-way sync pipeline that pushes LocalVector's ground truth location data to Apple Business Connect, making it available to Siri, Apple Maps, and Spotlight. When a business corrects a hallucination in LocalVector, the correction flows to Apple's data layer within the next sync cycle.

### Core components

**`lib/apple-bc/apple-bc-client.ts`**
Thin wrapper around the Apple Business Connect REST API. Handles OAuth 2.0 token management (Apple BC uses client credentials flow with JWT assertion). Exposes: `getLocation()`, `updateLocation()`, `claimLocation()`.

Token management details:
- Apple BC uses ES256-signed JWTs (not RS256 — use `node-jose` or `jose` library)
- Access tokens expire in 1 hour — cache in memory, refresh before expiry
- Rate limit: 50 req/min per client. Build in exponential backoff.
- Never log the private key. Never log access tokens. Log only `location_id` and status codes.

**`lib/apple-bc/apple-bc-mapper.ts`**
Maps LocalVector's `locations` table schema to Apple BC's location data format. Key mappings:
- `locations.name` → `displayName`
- `locations.address/city/state/zip` → `address` (structured)
- `locations.phone` → `telephone` (must be E.164 format)
- `locations.hours_data` → `regularHours` (Apple BC has a specific hours schema)
- `locations.primary_category` → `categories` (Apple BC category taxonomy — build a mapping table)
- `locations.operational_status` → `status` (`OPEN`, `CLOSED_PERMANENTLY`, `CLOSED_TEMPORARILY`)

**`app/api/cron/apple-bc-sync/route.ts`**
Nightly cron (runs after 2am, staggered from other crons). For each Agency org with a connected Apple BC account:
1. Load org's active locations
2. For each location: call `apple-bc-client.getLocation()` to check current Apple data
3. Compare with LocalVector ground truth (field-by-field diff)
4. If diff exists: call `updateLocation()` with changed fields only (partial update)
5. Log sync result to `apple_bc_sync_log` table (new table — location_id, synced_at, fields_updated, status)

**`app/dashboard/settings/connections/page.tsx`** (extend or create)
Connection management UI for Apple BC:
- "Connect Apple Business Connect" button → initiates claim flow (Apple BC requires manual claim verification for new locations)
- Shows sync status per location: "Last synced 2h ago", "Sync pending", "Error — click to retry"
- Manual "Sync Now" button (owner only)

**`app/actions/apple-bc.ts`**
`connectAppleBC(locationId)`, `disconnectAppleBC(locationId)`, `manualSync(locationId)`

### Database additions
```sql
CREATE TABLE apple_bc_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  location_id      uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  apple_location_id text,                    -- Apple's internal location ID
  claim_status     text DEFAULT 'unclaimed'  -- 'unclaimed' | 'pending' | 'claimed' | 'error'
  last_synced_at   timestamptz,
  sync_status      text,                     -- 'ok' | 'error' | 'pending'
  sync_error       text,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (location_id)
);

CREATE TABLE apple_bc_sync_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid REFERENCES locations(id) ON DELETE CASCADE,
  synced_at        timestamptz DEFAULT now(),
  fields_updated   text[],
  status           text,        -- 'success' | 'error' | 'no_changes'
  error_message    text
);
```

### Edge cases to handle in the full prompt
- Apple BC requires manual claim verification for each location (cannot be fully automated — the UI must walk the owner through it)
- Apple's category taxonomy differs from Google's — the mapper needs a hardcoded translation table for the top 20 business categories
- Rate limiting: if an Agency org has 10 locations and the cron runs nightly, 10 API calls is well within limits. But future scaling needs backoff.
- Partial update: never send unchanged fields — Apple BC may overwrite their own editorial enrichments
- Disconnected location: if `apple_bc_connections` row is absent for a location, skip it silently (not all locations need BC sync)
- `operational_status = 'closed_permanently'`: Apple BC has a permanent close flag — call a separate `closeLocation()` endpoint, not `updateLocation()`

### Tests to write
- Unit: `apple-bc-mapper` field mapping (hours conversion, E.164 phone, category mapping)
- Unit: `apple-bc-client` token refresh logic + rate limit backoff
- Unit: cron diff logic (changed fields detected correctly, unchanged fields skipped)
- Unit: `manualSync` action role check (owner only)
- Integration: full sync cycle with mock Apple BC API (MSW)
- E2E: connection UI shows correct sync status per location

### AI_RULES addition
§55: Apple BC sync rules — partial update only (never full overwrite), never log tokens/keys, claim flow is manual (never attempt to auto-claim), E.164 phone format required.

---

## Sprint 103 — Bing Places Sync

**Gap:** Feature #73 (Bing Places / Copilot) | **Effort:** M | **Dependency:** Bing Places API approval

### What this sprint builds
A sync pipeline for Bing Places, pushing LocalVector ground truth to the data source that powers Bing search, Copilot (Microsoft's AI assistant), and Edge's local business results. Architecturally mirrors Sprint 102 (Apple BC Sync) — reuses the mapper pattern, adds a Bing-specific client.

### Why this matters separately from Google
Bing Places data feeds Microsoft Copilot and Bing's local pack results. As Copilot grows in enterprise usage, Bing's local data becomes increasingly cited in AI responses. A business appearing correctly in Copilot results requires accurate Bing Places data — and most small businesses have outdated or unclaimed Bing listings.

### Core components

**`lib/bing-places/bing-places-client.ts`**
Wrapper around the Bing Places Partner API. Authentication: API key in `Authorization: BingPlaces-ApiKey [key]` header. Exposes: `searchBusiness()`, `getLocation()`, `updateLocation()`, `claimLocation()`.

**`lib/bing-places/bing-places-mapper.ts`**
Maps LocalVector schema to Bing Places format. Simpler than Apple (Bing's schema is closer to Google's). Key differences from Apple mapper:
- Bing uses Google-compatible category IDs for most business types (good reuse opportunity)
- Bing's hours format uses day-of-week arrays with open/close time strings
- Bing supports `amenities` as free-form attributes (map LocalVector's boolean amenities to Bing's attribute list)

**`app/api/cron/bing-sync/route.ts`**
Nightly cron (staggered from Apple BC cron by 30 min). Same pattern as Sprint 102.

**`app/dashboard/settings/connections/page.tsx`** (extend from Sprint 102)
Add Bing Places connection status alongside Apple BC. Both connections visible on same settings page. Do not create a separate page per platform — this is the connections hub.

**`lib/sync/sync-orchestrator.ts`** (new, shared)
Since Sprint 102 and 103 both sync the same location data to different platforms, extract the common orchestration logic here:
- `syncLocationToAll(locationId)` — triggers all connected platform syncs for a location
- Called after `updateLocation()` server action from Business Info Editor (Sprint 93)
- This means: when an owner updates business info, it automatically queues sync to Apple + Bing

### Database additions
```sql
CREATE TABLE bing_places_connections (
  -- Same structure as apple_bc_connections with bing_listing_id
);

CREATE TABLE bing_places_sync_log (
  -- Same structure as apple_bc_sync_log
);
```

### Edge cases to handle in the full prompt
- Bing's search API to find an existing listing may return multiple matches — the mapper must rank by address similarity (Levenshtein or token match), not just take the first result
- Bing Places sometimes has listings claimed by the business owner via consumer Bing — detect this and show a "Already claimed via Bing — verify API access" warning
- `sync-orchestrator` must handle partial failure (Apple sync succeeds, Bing sync fails) — log both independently, don't block the successful one
- Bing rate limit: 100 req/day on basic tier. With 10 locations and nightly syncs, this is fine. Document the limit.
- Business name disambiguation: if two Bing listings match the same business name + city, flag for manual review rather than auto-claiming

### Tests to write
- Unit: Bing mapper field mapping + category ID translation
- Unit: sync-orchestrator partial failure handling
- Unit: `syncLocationToAll` triggers both platform syncs
- Integration: Business Info Editor update → sync-orchestrator fires (verify linkage)
- E2E: Bing connection appears in settings/connections page

### AI_RULES addition
§56: Bing sync rules — same pattern as §55, plus sync-orchestrator is the only place `syncLocationToAll` is called (never call platform syncs directly from action files after Sprint 103).

---

## Sprint 104 — Dynamic FAQ Auto-Generation + Injection

**Gap:** Feature #74 (Dynamic FAQ) | **Effort:** M | **Dependency:** None (no external API)

### What this sprint builds
Automatically generates FAQ content from each location's ground truth data (menu, hours, amenities, category) and injects it as `FAQPage` JSON-LD schema into the Magic Menu page. Currently the Magic Menu (Sprint 89–90) has `Restaurant` and `Menu` schema but no FAQ schema. FAQ schema helps AI models (especially Perplexity and ChatGPT Browse) extract structured Q&A content to cite in responses.

This is the highest-ROI sprint in Tier 4 because it requires no API approval, no external dependency, and directly improves AI citation quality for every location.

### Core components

**`lib/faq/faq-generator.ts`**
Pure function: `generateFAQs(location, menuItems, amenities) → FAQ[]`

Generates question-answer pairs from structured data. Question templates:

```
Hours questions:
  "What are [Business Name]'s hours?" → formatted hours string
  "Is [Business Name] open on [Day]?" → yes/no + specific hours
  "What time does [Business Name] close?" → closing time for today (dynamic, uses location timezone)

Location questions:
  "Where is [Business Name] located?" → address + cross-streets if available
  "Is [Business Name] near [City] downtown?" → derived from address

Menu/Product questions (for each featured item):
  "Does [Business Name] have [Item]?" → yes + price + brief description
  "What is [Business Name]'s most popular [item type]?" → first featured item

Amenity questions (only for true amenities):
  "Does [Business Name] have [amenity]?" → yes + brief context
  "Is [Business Name] hookah-friendly?" (category-specific) → yes + description
  "Can I book a private event at [Business Name]?" → only if private_events amenity = true

Reservation/booking:
  "How do I make a reservation at [Business Name]?" → if phone/website available

Operational status:
  "Is [Business Name] still open?" → based on operational_status field
```

Generates up to 15 FAQ pairs per location. Quality rules:
- Never generate a question with an empty or vague answer ("We have great food" is not an answer)
- Never generate a question for a field that is null/unknown
- Prefer specific over generic ("What hookah flavors does Charcoal N Chill have?" > "What does Charcoal N Chill offer?")
- Hours questions are dynamic (based on current day in location timezone) but must be cached sensibly — FAQ schema is regenerated nightly, not on every page load

**`lib/faq/faq-schema-builder.ts`**
Converts `FAQ[]` to `FAQPage` JSON-LD string. Validates each Q&A pair length (Google recommends answers under 300 chars in FAQ schema). Escapes special characters for JSON safety.

**`app/api/magic-menu/[slug]/route.ts`** (extend from Sprint 89–90)
Inject the generated `FAQPage` JSON-LD as an additional `<script type="application/ld+json">` block on the Magic Menu page. The existing page already has `Restaurant` schema — FAQ runs alongside it, not replacing it.

**`app/api/cron/faq-regeneration/route.ts`**
Nightly cron that regenerates and caches FAQ content for all active locations. Stores result in `locations.faq_cache` (new JSONB column) with `faq_updated_at` timestamp. Magic Menu page reads from cache, not generates on-the-fly (performance).

**`app/dashboard/settings/magic-menu/page.tsx`** (extend from Sprint 89–90)
Add a "Generated FAQs" preview section showing the FAQ pairs that will be injected. Owner can:
- See all generated FAQ pairs
- Mark individual pairs as hidden (don't inject this Q&A — stored as excluded IDs in `locations.faq_excluded_ids` jsonb array)
- Trigger manual FAQ regeneration

**`app/actions/faq.ts`**
`excludeFAQItem(locationId, faqIndex)`, `regenerateFAQs(locationId)`, `getFAQPreview(locationId)`

### Database additions
```sql
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS faq_cache          jsonb,
  ADD COLUMN IF NOT EXISTS faq_updated_at     timestamptz,
  ADD COLUMN IF NOT EXISTS faq_excluded_ids   jsonb DEFAULT '[]';

COMMENT ON COLUMN locations.faq_cache IS
  'Generated FAQ pairs for this location. Regenerated nightly by faq-regeneration cron.
   Format: [{question: string, answer: string}]';
```

### Edge cases to handle in the full prompt
- Null/sparse data: a location with minimal info (just name + address) should still generate 3–5 quality FAQs (hours questions, location question, category question). Never generate 0 FAQs.
- Hours FAQ is timezone-sensitive: "Is X open today?" answer depends on the current day in the location's timezone, but the FAQ schema is cached — the answer should say "open Monday–Friday 11am–10pm" not "open today until 10pm" (static answer avoids stale cache problem)
- FAQ exclusion: `faq_excluded_ids` stores indices not content hashes — if FAQ regeneration reorders items, exclusions must be cleared and reconfirmed. Use content hash (SHA-256 of question string) as the exclusion key instead of index.
- JSON-LD injection: the `FAQPage` script tag must be added to the `<head>` alongside existing schema, not the `<body>`. If Next.js's metadata system is used for existing schema, extend it consistently.
- Google FAQ schema validation: answers must not contain HTML. Strip any markdown formatting from answer strings before serialization.
- FAQ schema length limit: Google's structured data guidelines recommend keeping FAQPage to 10 Q&A pairs for indexability. Cap at 10 even though generator produces up to 15 — owner exclusion + priority ordering determines which 10 survive.

### Tests to write
- Unit: `faq-generator` — hours questions use timezone correctly, null fields produce no question, specific over generic preference
- Unit: `faq-generator` — exactly 0 answers with null fields, minimum 3 answers with sparse data
- Unit: `faq-schema-builder` — valid JSON-LD output, HTML stripped from answers, cap at 10 pairs
- Unit: FAQ exclusion by content hash (not index)
- Unit: `faq-regeneration` cron processes all active locations
- Integration: Magic Menu page includes `FAQPage` JSON-LD in rendered HTML
- E2E: FAQ preview panel visible in settings, exclusion removes pair from preview

### AI_RULES addition
§57: FAQ rules — `faq-generator.ts` is the only place FAQ content is generated. Never inline question templates. Content hash exclusions, not index-based. Cap output at 10 pairs for schema injection even if more generated. Never include HTML in FAQ answer strings.

---

---

# 🟣 TIER 5 — DIFFERENTIATION
## Sprints 105–109 | The moat — features only possible with accumulated data

**Tier theme:** Every feature in this tier requires something that takes time to accumulate: a baseline of SOV data across multiple engines, a complete menu database, months of review history, a corpus of real customer queries. These cannot be faked or rushed. This is why Tier 5 must not be built before the platform has been running for 4–8 weeks with real paying customers.

**The risk of building Tier 5 too early:**
- Sprint 106 (RAG chatbot) answers "Is the kitchen still open?" from menu data. If menu data is 20% complete, the chatbot gives wrong answers.
- Sprint 107 (hijacking alerts) detects anomalies in SOV patterns. With 3 weeks of data, there is no baseline — everything looks like an anomaly.
- Sprint 108 (per-engine playbooks) recommends prioritizing SGE vs. Perplexity. Without 2+ months of multi-engine data, the recommendations have no statistical backing.

**The right time to start Tier 5:** When the first 3–5 Agency customers are live and have been running for 4–8 weeks. Their data becomes the dataset that makes these features work.

**Tier outcome:** Features that a competitor cannot replicate by building faster. They require the same data accumulation pipeline to run for the same duration. Six months of head start is six months of moat.

---

## Sprint 105 — Entity-Optimized Review Response Generator

**Gap:** Feature #76 (Entity-Optimized Reviews) | **Effort:** M | **Data dependency:** Moderate (entity graph from Sprint 1/2B + at least some reviews connected via GBP)

### What this sprint builds
AI-drafted responses to Google and Yelp reviews, with entity keywords (business name, category, location, signature items) woven naturally into the reply. The goal is not just to respond to reviews — it's to turn each response into a micro-document that reinforces the business's entity signals in AI training data.

### Why now (early in Tier 5)
This sprint has the lowest data dependency. It needs the entity graph (Sprint 1/2B) and access to reviews (GBP connection, Sprint 6/7). Both should exist after Tier 1–2. The "optimization" comes from the entity list, not from accumulated SOV data.

### Core components

**`lib/reviews/review-responder.ts`**
`generateReviewResponse(review, location, entityGraph) → string`

Prompts Claude (via Anthropic API) to draft a response that:
- Addresses the specific content of the review (not a generic template)
- Naturally includes 2–3 entity terms: business name, one category-specific term, one signature item or amenity
- Matches the tone of the review (effusive → warm, complaint → empathetic + solution-focused)
- Is under 200 words (Google's recommended length for responses)
- Does not use banned phrases ("We're so sorry", "As a valued customer", etc. — include a blocklist)

**`app/dashboard/reviews/page.tsx`** (new or extend existing)
Review management page showing:
- Unanswered reviews (sourced from GBP API / Google My Business API connection)
- AI-drafted response alongside each review
- "Use this response" button → opens the review in GBP for owner to paste + publish (or publishes directly if API write access is granted)
- Response quality score: entity keyword density, length, sentiment match

**`app/api/cron/review-fetch/route.ts`**
Nightly fetch of new reviews from connected GBP accounts. Stores in `business_reviews` table. Triggers `generateReviewResponse()` for new unanswered reviews. Sets `response_draft` on the review row.

### Database additions
```sql
CREATE TABLE business_reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       uuid REFERENCES locations(id) ON DELETE CASCADE,
  platform          text,        -- 'google', 'yelp'
  external_id       text,        -- Platform's review ID
  reviewer_name     text,
  rating            integer,
  review_text       text,
  review_date       timestamptz,
  response_draft    text,        -- AI-generated draft
  response_published text,       -- What was actually published
  responded_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (platform, external_id)
);
```

### Key edge cases
- Reviews with no text (just a star rating): don't generate a response referencing non-existent content. Generate a short acknowledgment that includes entity terms.
- 1-star reviews: always generate an empathetic response. Never generate a defensive response. Add a specific moderation prompt instruction.
- Review response already published: if `responded_at` is set, don't regenerate unless owner clicks "Re-draft"
- GBP write access: some GBP connections may be read-only. If so, the "Publish" button copies the response to clipboard + opens GBP URL. Do not fail silently if write access is denied.
- Entity term density: 2–3 entities per response. More than 3 looks spammy to Google's review quality system. Enforce a maximum.

---

## Sprint 106 — Truth-Grounded RAG Chatbot Widget

**Gap:** Feature #77 (RAG Chatbot) | **Effort:** L | **Data dependency:** HIGH — only valuable when menu + amenity + hours data is 80%+ complete for the location

### What this sprint builds
An embeddable customer-facing chat widget (`<script src="localvector.com/widget/[slug].js">`) that answers customer questions about the business using LocalVector's verified ground truth as the RAG context. Zero hallucinations because answers only come from data that has been manually verified in the Truth Calibration form.

### Why the data dependency matters
If a customer asks "Do you have vegan options?" and `menu_items` has 3 items when the real menu has 40, the chatbot either answers incorrectly ("No vegan options found") or adds a disclaimer so heavy it's useless. The chatbot is only worth shipping when the knowledge base is complete enough to answer most realistic questions correctly.

**Minimum viable data state before building:**
- Menu items: 80%+ of menu captured in `menu_items` table
- Amenities: all boolean amenities set (not null/unknown)
- Hours: complete 7-day hours in `hours_data`
- Operational status: set

### Core components

**`lib/rag/rag-context-builder.ts`**
`buildRAGContext(locationId) → RAGContext`

Assembles the knowledge base for a location:
- Business identity (name, address, phone, hours)
- Menu items (name, description, price, category, dietary flags)
- Amenities (only true values — never "we don't have X")
- Verified corrections from `ai_audits` (if a hallucination was corrected, the correction is in context)
- Common questions + answers from `faq_cache` (Sprint 104)

**`lib/rag/rag-responder.ts`**
`answerQuestion(question, ragContext) → { answer: string, sources: string[], confidence: 'high' | 'medium' | 'low' }`

Calls Claude API with RAG context as system prompt. System prompt includes a strict instruction: "Answer ONLY from the provided business information. If the answer is not in the context, say 'I don't have that information — please call us at [phone].'"

Confidence scoring:
- high: answer found in context, direct match
- medium: answer inferred from context (e.g., "Do you have seating?" → answered from `amenities.indoor_seating = true`)
- low: answer not found — fallback to "please call us"

**`app/(public)/widget/[slug]/page.tsx`**
The embeddable widget page (rendered in an iframe). Minimal styling, white-label ready.

**`app/(public)/widget/[slug].js/route.ts`**
The embed script. Returns a `<script>` that injects the iframe into the customer's website.

**`app/api/widget/chat/route.ts`**
POST endpoint called by the widget iframe. Rate-limited (20 req/hour per IP). Calls `answerQuestion()`. Returns JSON.

**Widget settings in dashboard:**
- Enable/disable widget per location
- Customize: widget button color, position (bottom-right / bottom-left), greeting message
- Preview pane showing the live widget
- Embed code snippet for the owner to copy

### Key edge cases
- Rate limiting: the widget is public-facing. Aggressive rate limiting (per-IP) prevents abuse. Also limit total API calls per location per day (100 questions/day on Growth, 500 on Agency — plan-gated).
- Questions about competitor businesses: if a customer asks "How do you compare to X?" — the RAG context has no data about competitors. Return the fallback, not speculation.
- Personal data in questions: customers may type their address, phone, order number into the chat. The widget must not store free-form question text in a way that creates PII retention obligations. Log only question category (hours/menu/reservation/other), not the question text.
- Widget on non-HTTPS sites: refuse to load. Show an error in the embed code generator if the target domain is HTTP.
- Concurrent chat sessions: the widget doesn't need session persistence. Each question is stateless (the full RAG context is resent each time — context window is large enough for this).

---

## Sprint 107 — Competitive Prompt Hijacking Alerts

**Gap:** Feature #78 (Competitive Hijacking) | **Effort:** M | **Data dependency:** HIGH — requires 4–8 weeks of SOV baseline data

### What this sprint builds
Detects when a competitor's content appears in AI responses to queries that should return the client business. Extends Source Intelligence (Sprint 81) and SOV monitoring to identify "hijacks" — moments where a competitor is cited for a query that strongly implies the user is looking for the client's specific business.

### What a "hijack" is
A query like "hookah lounge Alpharetta open late" should return Charcoal N Chill. If Perplexity returns a competitor (Atlanta Hookah Bar) for that query instead, that is a hijack. The difference from normal SOV loss: hijack queries are strongly business-intent queries (include the business's city, category, and a distinguishing attribute), not generic category queries.

### Why data dependency is real
To detect a hijack, you need:
1. A baseline: what was appearing in AI responses for these queries 4 weeks ago?
2. An anomaly: what is appearing now that wasn't before?
Without a baseline, every SOV result looks like it could be a hijack or could be normal.

### Core components

**`lib/hijack/hijack-detector.ts`**
`detectHijacks(orgId, locationId, lookbackDays) → HijackAlert[]`

Algorithm:
1. Load SOV query results for the past `lookbackDays` days
2. Filter to "brand-intent" queries (queries containing the business city + category + at least one brand signal)
3. For each brand-intent query, check if a competitor domain appears in the top 3 citations
4. Compare against baseline (same query, 4 weeks prior) — is this competitor new?
5. If competitor is new + query is brand-intent → flag as HijackAlert

**`app/dashboard/source-intelligence/page.tsx`** (extend from Sprint 81)
Add "Hijacking Alerts" section: red-amber cards showing detected hijacks with:
- The query that was hijacked
- Which competitor is being cited
- Which AI model is citing them
- How long the hijack has been detected (first seen date)
- CTA: "Create content to reclaim this query" → `createDraftFromQuery()`

**Email alert:** When a new hijack is detected, send a `HijackAlertEmail` to the org owner. Limit to 1 email per hijack (not repeated). Use the existing Resend email infrastructure.

### Key edge cases
- False positives: a competitor appearing for a generic query is not a hijack. Only flag if the query contains 2+ brand-intent signals.
- Baseline period: if the org has been running for less than 4 weeks, there is no baseline. Show a "Building baseline — alerts will be available on [date + 28 days from signup]" message. Never show false hijack alerts.
- Same competitor, different query: aggregate multiple hijacked queries from the same competitor into a single alert card (not 10 separate cards).
- Competitor later drops out of citations: mark the hijack as "resolved" — don't continue alerting for it. Keep it in the resolved history.

---

## Sprint 108 — Per-Engine Optimization Playbooks

**Gap:** Feature #79 (Engine Playbooks) | **Effort:** M | **Data dependency:** HIGH — requires multi-engine SOV data (Google SGE, Perplexity, ChatGPT Browse, Copilot)

### What this sprint builds
Generates per-engine, per-location optimization recommendations based on which signals each AI engine weights most heavily. The insight: Google SGE weights schema markup and E-E-A-T signals. Perplexity weights citation quality and URL freshness. ChatGPT Browse weights Wikipedia-style factual consistency. Each engine needs a different optimization strategy.

### What the data makes possible
After 2+ months of multi-engine SOV tracking, LocalVector has real data showing which engine cites which competitors, how often, and for what query types. The playbook engine compares the business's citation rate per engine against the top-cited competitor per engine and generates specific, actionable gaps.

### Core components

**`lib/playbooks/playbook-engine.ts`**
`generatePlaybook(orgId, locationId, targetEngine) → Playbook`

For each engine:
- Compute the business's citation rate (appearances / total queries) for that engine
- Compute the top competitor's citation rate for the same engine
- Identify the gap: where is the competitor beating you?
- Map the gap to known optimization levers for that engine (schema, freshness, citations, entity consistency)
- Generate 3–5 prioritized action items with estimated impact

Engine-specific signal libraries (hardcoded based on known LLM behavior patterns as of Sprint 101 knowledge):
- SGE: schema markup, GBP completeness, local pack ranking, review recency
- Perplexity: citation domain authority, content freshness, URL canonical status
- ChatGPT: Wikipedia presence, factual consistency across web mentions, structured data
- Copilot/Bing: Bing Places accuracy, Microsoft entity graph, Bing-indexed content freshness

**`app/dashboard/playbooks/page.tsx`** (new page)
Playbook dashboard showing per-engine recommendations. Tabs for each monitored engine. Each action item has:
- Priority (High / Medium / Low)
- Estimated SOV improvement if addressed
- Step-by-step instructions
- One-click connection to relevant LocalVector tool (e.g., "Update your menu schema" → links to Magic Menu settings)

### Key edge cases
- Insufficient data: if an engine has fewer than 20 queries tracked, show "Insufficient data" + estimated date when playbook will be available.
- Playbook staleness: regenerate playbooks weekly (not nightly — too expensive). Cache in `location_playbook_cache` JSONB column.
- Action items must be specific, not generic. "Improve your website" is not an action item. "Add `servesCuisine` to your Restaurant schema on [URL]" is.
- Competing recommendations: if the schema action for SGE conflicts with something the llms.txt action recommends (Sprint 97), flag the conflict rather than give contradictory advice.

---

## Sprint 109 — Conversational Intent Discovery

**Gap:** Feature #80 (Intent Discovery) | **Effort:** M | **Data dependency:** HIGH — requires 2+ months of Perplexity query history + real query prompt corpus

### What this sprint builds
Maps the long-tail conversational prompts that real customers use when asking AI models about businesses in the client's category and location. Identifies which prompts the business is NOT appearing for (content gaps) and generates content briefs to capture those queries.

### What makes this different from SOV tracking
SOV tracks pre-defined queries (ones LocalVector asks programmatically). Intent Discovery discovers queries that real people actually type — things like "best hookah lounge for a bachelorette party in Alpharetta" or "hookah bars that stay open past midnight near me" — that no one explicitly programmed into the system.

### How it works
1. **Query expansion:** Given a location's category and competitors, use Claude to generate 50+ plausible conversational prompts a real customer might ask an AI model
2. **Coverage audit:** Run a sample of these prompts through the Perplexity API (with `return_citations`) — check which ones mention the client vs. competitors
3. **Gap identification:** Prompts where competitors appear but the client doesn't = content gaps
4. **Brief generation:** For each gap, generate a content brief (see Sprint 86 — Content Brief Generator) focused on that specific query intent

### Core components

**`lib/intent/intent-discoverer.ts`**
`discoverIntents(locationId, sampleSize) → IntentDiscovery`
- Calls Claude API to generate prompt variations
- Batches Perplexity API calls (rate-limit aware)
- Returns gap analysis: {prompt, clientCited, competitorsCited, suggestedBrief}

**`app/dashboard/intent-discovery/page.tsx`** (new page)
- Shows discovered gap prompts grouped by theme (hours, events, specific offerings, comparisons)
- "Generate Brief" button per gap → triggers Sprint 86 Content Brief Generator
- Filtering by engine, theme, and opportunity score

**`app/api/cron/intent-discovery/route.ts`**
Weekly cron (not nightly — expensive in Perplexity API calls). Runs for Agency orgs only.

### Key edge cases
- Perplexity API cost: a 50-prompt discovery run = 50 API calls. With 10 Agency locations running weekly, that's 500 calls/week. Budget this into the Agency plan's cost of goods and document in MEMORY.md.
- Query deduplication: the same content gap might show up across 5 similar prompts. Cluster similar prompts before surfacing to avoid noise.
- Privacy: the expanded prompts are generated by Claude, not sourced from real user data. No PII handling needed. Document this clearly.
- Saturation: after 3–4 months, most gaps are known. Discovery yield drops. Add a "diminishing returns" indicator — if fewer than 5 new gaps discovered in the last run, suggest reducing run frequency to monthly.

---

---

# 🗓️ EXECUTION SEQUENCE DECISION TREE

```
TODAY (Tier 3 just shipped):
│
├── Submit Apple BC API registration
├── Submit Bing Places API registration
│
├── If Apple BC approved + Bing approved:
│   → Sprint 102 → Sprint 103 → Sprint 104
│
├── If only one approved:
│   → Do the approved one first, then Sprint 104, then the other
│
└── If neither approved yet:
    → Sprint 104 (no dependency) → then whichever API approves first


AFTER TIER 4 (Sprints 102–104 done):
│
├── Are Agency customers live? → At least 3–5?
├── Have they been running for 4+ weeks?
├── Is the menu data 80%+ complete for at least one location?
│
├── If yes to all:
│   → Sprint 105 (lowest data dependency — do first)
│   → Sprint 106 (only when menu is 80%+ for at least one customer)
│   → Sprint 107 (only after 4+ weeks of SOV baseline)
│   → Sprint 108 (only after 8+ weeks of multi-engine data)
│   → Sprint 109 (only after 8+ weeks of Perplexity query history)
│
└── If no to any:
    → Focus on customer acquisition, data quality, and retention
      before spending engineering time on Tier 5
```

---

# 📊 QUICK REFERENCE SPRINT TABLE

| Sprint | Name | Tier | Gap | Effort | Dependency | Status |
|--------|------|------|-----|--------|-----------|--------|
| 102 | Apple Business Connect Sync | 4 | #72 | L | Apple BC API approval | 🔲 |
| 103 | Bing Places Sync | 4 | #73 | M | Bing API approval | 🔲 |
| 104 | Dynamic FAQ Auto-Generation | 4 | #74 | M | None | 🔲 |
| 105 | Entity-Optimized Review Responses | 5 | #76 | M | GBP + entity graph | 🔲 |
| 106 | Truth-Grounded RAG Chatbot Widget | 5 | #77 | L | 80%+ menu data | 🔲 |
| 107 | Competitive Prompt Hijacking Alerts | 5 | #78 | M | 4–8 wks SOV baseline | 🔲 |
| 108 | Per-Engine Optimization Playbooks | 5 | #79 | M | 8 wks multi-engine data | 🔲 |
| 109 | Conversational Intent Discovery | 5 | #80 | M | 8 wks Perplexity history | 🔲 |

**Total AI_RULES additions:** §55 (Sprint 102) through §61 (Sprint 109)

---

# ✅ HOW TO GENERATE A FULL SPRINT PROMPT FROM THIS DOC

When you're ready to execute Sprint 102 (or any sprint here):

1. Open a new Claude conversation
2. Upload: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
3. Paste the sprint's section from this document
4. Add this instruction:

> "Using the sprint brief above and the attached project files, generate a full Claude Code prompt in the same bulletproof format used for Sprints 96–101. Include: pre-flight checklist, architecture (all parts), pre-implementation diagnosis bash commands, edge cases, full test suite (Vitest unit + Playwright E2E), DEVLOG format, AI_RULES update, acceptance criteria, and git commit template."

The full prompt will be generated in the same quality and format as the completed sprints.

---

*Document created after Sprint 101 (Tier 3 completion). Last updated: 2026-02-27.*
*Next update: when first Tier 4 sprint begins — mark status and add completion dates.*
