# LocalVector V1 — Claude Code Sprint Prompts
### Sprints 56–62 | Post-Security Stabilization Phase
### Each prompt is self-contained — paste directly into Claude Code

---

---

## SPRINT 56 — Production Readiness: Inngest, Stripe, Occasion Seed

**Items: #6 (Inngest prod verification), #7 (Stripe e2e + Customer Portal), #10 (Occasion seed)**

---

### Prompt 56A — Inngest Production Verification & Hardening

```
## Task: Verify and harden all 4 Inngest fan-out functions for production

## Context
We have 4 Inngest functions registered in `app/api/inngest/route.ts`:
- `auditCronFunction` (lib/inngest/functions/audit-cron.ts) — daily hallucination audit
- `sovCronFunction` (lib/inngest/functions/sov-cron.ts) — weekly SOV engine  
- `contentAuditCronFunction` (lib/inngest/functions/content-audit-cron.ts) — monthly page audit
- `postPublishCheckFunction` (lib/inngest/functions/post-publish-check.ts) — 14-day post-publish SOV recheck

The Inngest client is in `lib/inngest/client.ts`. Events are typed in `lib/inngest/events.ts`. All 4 cron routes (`app/api/cron/*/route.ts`) dispatch to Inngest first and fall back to inline execution if Inngest is unavailable.

## Requirements

### 1. Add Inngest health check endpoint
Create `app/api/inngest/health/route.ts`:
- GET handler that returns JSON with: inngest client ID, number of registered functions, list of function IDs, environment (dev/prod)
- Protected by CRON_SECRET auth header (same pattern as cron routes)
- This lets us verify Inngest is reachable from Vercel without triggering actual functions

### 2. Harden concurrency and retry config on all 4 functions
Review and update each function's config object:
- `auditCronFunction`: concurrency limit 5, retries 3 (already set — verify)
- `sovCronFunction`: concurrency limit 3, retries 2 (SOV has rate-limited API calls — fewer retries to avoid cost multiplication)
- `contentAuditCronFunction`: concurrency limit 3, retries 2 
- `postPublishCheckFunction`: concurrency limit 10 (lightweight — just SOV recheck), retries 1

### 3. Add timeout protection to each step
In each function's `step.run()` calls, wrap the inner logic with a 55-second timeout guard (Vercel Pro limit is 60s per step invocation). Pattern:
```ts
const result = await Promise.race([
  actualWork(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Step timeout: 55s')), 55_000))
]);
```
Apply this to any step that makes external API calls (LLM queries, Supabase writes).

### 4. Add structured logging
At the end of each function, log a summary JSON object to console.log with:
- `function_id`, `event_name`, `started_at`, `completed_at`, `duration_ms`
- Function-specific metrics (orgs_processed, queries_run, etc.)
- Any step failures (count + first error message)

### 5. Write a manual trigger test script
Create `scripts/test-inngest-dispatch.ts` (Node.js script, not a route):
- Reads INNGEST_EVENT_KEY from .env.local
- Sends each of the 4 events to Inngest via HTTP POST to `https://inn.gs/e/{eventKey}`
- Prints the Inngest response for each
- Usage: `npx tsx scripts/test-inngest-dispatch.ts`
- Include a --dry-run flag that only prints what it WOULD send

## Constraints
- Do NOT modify any service logic (ai-audit.service.ts, sov-engine.service.ts, etc.)
- Do NOT change the cron route handlers — they already dispatch to Inngest
- Do NOT install new packages — inngest is already installed
- Keep all existing tests passing — run `npx vitest run` after changes
- The Inngest serve route MUST continue to export GET, POST, PUT
```

---

### Prompt 56B — Stripe Customer Portal + Subscription Management

```
## Task: Add Stripe Customer Portal and complete the billing flow

## Context
Current state:
- `app/dashboard/billing/actions.ts` has `createCheckoutSession()` for Starter ($29) and Growth ($59)
- `app/api/webhooks/stripe/route.ts` handles `checkout.session.completed` and `customer.subscription.updated`
- `app/dashboard/billing/page.tsx` shows 3-tier pricing cards with upgrade buttons
- Stripe env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_STARTER, STRIPE_PRICE_ID_GROWTH, NEXT_PUBLIC_APP_URL
- The organizations table has columns: plan, plan_status, stripe_customer_id, stripe_subscription_id

What's MISSING:
1. No way for existing subscribers to manage their subscription (upgrade/downgrade/cancel)
2. No Stripe Customer Portal integration
3. Billing page doesn't show current plan status for paying users
4. No handling of `customer.subscription.deleted` webhook event (cancellation)

## Requirements

### 1. Add `createPortalSession` server action in `app/dashboard/billing/actions.ts`
```ts
export async function createPortalSession(): Promise<{ url: string } | { url: null; demo: true }> {
  // Demo mode if STRIPE_SECRET_KEY absent
  // Get auth context → orgId
  // Fetch stripe_customer_id from organizations table
  // If no stripe_customer_id, return error
  // Create Stripe billing portal session with return_url to /dashboard/billing
  // Return the portal URL
}
```

### 2. Add `customer.subscription.deleted` handler to webhook route
In `app/api/webhooks/stripe/route.ts`, add a new case:
- `customer.subscription.deleted` → set plan to 'trial', plan_status to 'canceled'
- Look up org by stripe_customer_id (same pattern as handleSubscriptionUpdated)
- Log the cancellation

### 3. Update billing page to show current plan state
In `app/dashboard/billing/page.tsx`:
- Make it a server component (or add a server-fetched wrapper) that reads the org's current plan + plan_status
- If user has an active paid plan: show "Current Plan: Growth" badge on the active tier card, show "Manage Subscription" button that calls createPortalSession(), hide the upgrade button on the current tier
- If user is on trial: show all upgrade buttons as-is
- If plan_status is 'canceled' or 'past_due': show a warning banner with appropriate messaging
- Keep demo mode behavior (when STRIPE_SECRET_KEY absent) working — existing Playwright tests depend on it

### 4. Handle success/canceled URL params
The checkout session already redirects to `/dashboard/billing?success=true` or `?canceled=true`. Add:
- Success banner: "Your plan has been upgraded! Changes may take a moment to reflect."
- Canceled banner: "Checkout was canceled. No charges were made."
- Both auto-dismiss after 8 seconds

## Constraints
- Do NOT change the Stripe webhook signature verification logic
- Do NOT change the plan-to-tier mapping (UI_PLAN_TO_DB_TIER)
- Do NOT install new packages — stripe is already installed
- Preserve the demo mode pattern — all Stripe operations must gracefully no-op when STRIPE_SECRET_KEY is absent
- The billing page must remain visually consistent with the existing dark theme (bg-surface-dark, signal-green accent, etc.)
- Keep all existing tests passing — run `npx vitest run` after changes
```

---

### Prompt 56C — Seed `local_occasions` Table

```
## Task: Create seed data for the local_occasions table

## Context
The Occasion Engine (`lib/services/occasion-engine.service.ts`) runs as a sub-step of the weekly SOV cron. It queries the `local_occasions` table for upcoming events, checks if the business is already cited for occasion-related queries, and auto-generates content drafts.

The problem: the `local_occasions` table is EMPTY in production. The entire engine is dead code.

Table schema (from prod_schema.sql):
- id: uuid (auto-generated)
- name: varchar UNIQUE
- occasion_type: 'holiday' | 'celebration' | 'recurring' | 'seasonal'
- trigger_days_before: integer (how many days before peak to fire alerts)
- annual_date: varchar or null (MM-DD format, null = evergreen)
- peak_query_patterns: jsonb (array of { query: string, category: string })
- relevant_categories: text[] (which business categories this occasion applies to)
- is_active: boolean default true
- created_at, updated_at: timestamps

The TypeScript interface is in `lib/types/occasions.ts` → `LocalOccasionRow`.

The query patterns use `{city}` and `{category}` as template variables that get replaced at runtime with the actual location's city and category.

## Requirements

### Create `supabase/seeds/occasions_seed.sql`
Insert at least 30 occasions covering:

**Holidays (occasion_type: 'holiday', with annual_date MM-DD):**
- Valentine's Day (02-14), trigger 21 days before
- St. Patrick's Day (03-17), trigger 14 days
- Cinco de Mayo (05-05), trigger 14 days
- Mother's Day (05-11), trigger 21 days
- Father's Day (06-15), trigger 14 days
- July 4th (07-04), trigger 14 days
- Halloween (10-31), trigger 21 days
- Thanksgiving (11-27), trigger 21 days
- Christmas Eve (12-24), trigger 28 days
- New Year's Eve (12-31), trigger 21 days

**Celebrations (occasion_type: 'celebration', with annual_date):**
- Super Bowl Sunday (02-09), trigger 14 days
- Mardi Gras (03-04), trigger 14 days
- Diwali (10-20), trigger 14 days
- Lunar New Year (01-29), trigger 21 days

**Recurring (occasion_type: 'recurring', annual_date NULL = evergreen):**
- Bachelorette Party, trigger 30 days (always relevant)
- Bachelor Party, trigger 30 days
- Birthday Dinner, trigger 14 days
- Date Night, trigger 7 days
- Corporate Event, trigger 21 days
- Girls Night Out, trigger 7 days
- Anniversary Dinner, trigger 14 days
- Graduation Dinner, trigger 14 days
- Rehearsal Dinner, trigger 21 days
- Happy Hour, trigger 3 days
- Brunch, trigger 3 days
- Late Night, trigger 3 days

**Seasonal (occasion_type: 'seasonal', with approximate MM-DD):**
- Patio Season Opening (04-01), trigger 21 days
- Summer Menu Launch (06-01), trigger 14 days
- Football Watch Season (09-05), trigger 14 days
- Holiday Party Season (12-01), trigger 28 days

For each occasion:
- `peak_query_patterns` should have 2-4 query templates like:
  `[{"query": "best {category} for valentines day in {city}", "category": "occasion"}, {"query": "romantic dinner {city}", "category": "discovery"}]`
- `relevant_categories` should realistically match: ['restaurant', 'bar', 'lounge', 'hookah lounge', 'event venue', 'nightclub', 'cocktail bar'] — not every occasion applies to every category
- `is_active` = true for all

Use INSERT ... ON CONFLICT (name) DO NOTHING for idempotency.

### Also create the migration file
Create `supabase/migrations/20260226000004_seed_occasions.sql` that runs the same INSERT statements. This ensures new environments get the seed data automatically.

## Constraints
- Do NOT modify the local_occasions table schema
- Do NOT modify occasion-engine.service.ts
- Use realistic query patterns that a local restaurant customer would actually type into ChatGPT/Perplexity
- All dates use MM-DD format (NOT YYYY-MM-DD)
- Evergreen occasions (recurring type) MUST have annual_date as NULL
- Ensure the SQL is valid PostgreSQL — test by reading it carefully for syntax errors
- Include a comment header in the SQL file with the count of occasions inserted
```

---

---

## SPRINT 57 — Key UX: Chat Polish + GBP OAuth Flow

**Items: #8 (AI Chat polish), #9 (GBP OAuth connect)**

---

### Prompt 57A — AI Chat Assistant UI Polish

```
## Task: Polish the AI Chat Assistant for production quality

## Context
The AI Assistant lives at `/dashboard/ai-assistant`. The components are:
- `app/dashboard/ai-assistant/page.tsx` (33 lines, simple wrapper)
- `app/dashboard/ai-assistant/_components/Chat.tsx` (295 lines, the full chat UI)
- `app/api/chat/route.ts` (the streaming endpoint — recently renamed from chat-route.ts)
- `lib/tools/visibility-tools.ts` (4 org-scoped tools)

The Chat component uses `useChat()` from `@ai-sdk/react` with `api: '/api/chat'`.

Current tool result card types: ScoreCard, TrendList, AlertList, CompetitorList.

Current issues:
1. No error handling — if the API returns 401 or 500, the UI silently fails
2. No loading skeleton on initial page load
3. Empty state exists but quick-action buttons use a hacky `setTimeout + requestSubmit` pattern
4. No mobile responsiveness — input bar can overflow on small screens
5. TrendList shows a flat list of dates+percentages — should be a mini chart
6. No "stop generating" button during streaming
7. No message retry capability on failure

## Requirements

### 1. Error handling
Add `onError` callback to `useChat()`:
- Display an error banner at the bottom of the message list: "Something went wrong. Please try again."
- If error status is 401: show "Session expired. Please refresh the page."
- The error banner should have a "Retry" button that re-sends the last user message
- Error banner should be dismissible

### 2. Loading skeleton
When `mounted` is false or on initial render before messages load, show a skeleton:
- 3 placeholder message bubbles (alternating left/right) with `animate-pulse bg-surface-dark` blocks
- Keep it minimal — just gray rounded rectangles

### 3. Fix quick-action buttons
Replace the hacky `setTimeout + requestSubmit` pattern with the `append` function from `useChat()`:
```ts
const { messages, input, handleInputChange, handleSubmit, isLoading, append, error, reload } = useChat({...});
```
Quick action buttons should call: `append({ role: 'user', content: q })`
This is the correct AI SDK pattern — no fake events needed.

### 4. Mobile responsiveness
- Chat container: change `h-[calc(100vh-8rem)]` to include proper responsive padding
- Message bubbles: `max-w-[85%]` on desktop, `max-w-[95%]` on mobile (< 640px)
- Input bar: use `flex-col sm:flex-row` layout on small screens so send button stacks below input
- Quick action buttons in empty state: single column on mobile, flex-wrap on desktop

### 5. Replace TrendList with mini sparkline chart
Replace the flat date+percentage list in TrendList with a `recharts` AreaChart:
- Import from recharts (already installed)
- Small chart (height 120px) with signal-green fill, no axes labels, just the trend line
- Tooltip on hover showing date + SOV%
- Keep the "No SOV trend data yet" empty state

### 6. Stop generating button
When `isLoading` is true and the assistant is streaming:
- Show a "Stop" button (square icon) next to the input
- Use the `stop` function from `useChat()` to cancel the stream
- Button should be small and unobtrusive

### 7. Copy message content
Add a small copy icon button on hover for assistant messages (not user messages):
- Uses `navigator.clipboard.writeText()` 
- Shows brief "Copied!" tooltip feedback
- Only appears on hover/focus of the message bubble

## Constraints
- Do NOT modify `app/api/chat/route.ts` or `lib/tools/visibility-tools.ts`
- Do NOT install new packages — recharts, lucide-react, @ai-sdk/react are all already installed
- Keep the existing dark theme: bg-surface-dark, signal-green, electric-indigo, alert-crimson, midnight-slate
- Keep all 4 existing tool result card components (ScoreCard, AlertList, etc.) — only modify TrendList
- The component must remain a single file (`Chat.tsx`) — do not split into multiple files
- Preserve the `'use client'` directive at the top
- Run `npx vitest run` after changes to ensure no test regressions
```

---

### Prompt 57B — Google Business Profile OAuth Connect Flow

```
## Task: Build the GBP OAuth connect flow for the Integrations page

## Context
Current state:
- `lib/autopilot/publish-gbp.ts` is fully coded — token refresh, GBP Local Post creation, 401 retry
- `google_oauth_tokens` table exists in prod_schema.sql with columns: id, org_id, access_token, refresh_token, expires_at, gbp_account_name, created_at, updated_at
- `locations` table has a `google_location_name` column for the GBP API path
- `app/dashboard/integrations/page.tsx` shows PlatformRow components for the Big 6 directories
- `lib/plan-enforcer.ts` has `canConnectGBP(plan)` — available on starter, growth, agency (not trial)

What's MISSING:
1. No OAuth consent screen initiation endpoint
2. No OAuth callback handler
3. No UI on the integrations page to initiate/disconnect GBP
4. No way to select which GBP location to link after OAuth

Required Google APIs:
- Google OAuth 2.0 for token exchange
- Google My Business API (v4) for listing GBP locations

Required env vars (document in .env.example):
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI (e.g., https://app.localvector.ai/api/auth/google/callback)

## Requirements

### 1. Create OAuth initiation endpoint
`app/api/auth/google/route.ts` (GET):
- Verify user is authenticated via getSafeAuthContext()
- Check canConnectGBP(plan) — return 403 if trial
- Generate a random `state` parameter, store in a cookie (httpOnly, 5 min TTL, sameSite=lax)
- Store orgId in the state (encrypted or as signed JWT) so the callback knows which org to update
- Redirect to Google OAuth consent URL with scopes:
  - `https://www.googleapis.com/auth/business.manage` (GBP management)
- Return 302 redirect

### 2. Create OAuth callback handler  
`app/api/auth/google/callback/route.ts` (GET):
- Validate `state` parameter matches the cookie (CSRF protection)
- Exchange `code` for tokens via `https://oauth2.googleapis.com/token`
- Extract orgId from the state
- Fetch the user's GBP accounts/locations via `https://mybusinessaccountmanagement.googleapis.com/v1/accounts` and then locations
- Store in `google_oauth_tokens`:
  - access_token, refresh_token, expires_at (computed from expires_in)
  - gbp_account_name (the account resource name)
- Redirect to `/dashboard/integrations?gbp=connected`

### 3. Create GBP location selector
If the user has multiple GBP locations under their account, we need to let them pick which one to link.

Create `app/dashboard/integrations/_components/GBPLocationSelector.tsx`:
- Modal that appears after OAuth callback when multiple locations are found
- Shows list of GBP locations with name + address
- User picks one → updates `locations.google_location_name` for their primary location
- If only one location, auto-select it

### 4. Create disconnect action
Add server action in `app/dashboard/integrations/actions.ts`:
```ts
export async function disconnectGBP(): Promise<ActionResult>
```
- Delete the `google_oauth_tokens` row for the org
- Clear `locations.google_location_name` for the org's locations
- Revalidate the integrations page

### 5. Update integrations page UI
In `app/dashboard/integrations/page.tsx`:
- For the Google Business Profile PlatformRow:
  - If NOT connected: show "Connect GBP" button that navigates to `/api/auth/google`
  - If connected: show green "Connected" badge + the GBP location name + "Disconnect" button
  - If plan is trial: show "Upgrade to connect" with link to /dashboard/billing
- Handle the `?gbp=connected` URL param to show a success toast

### 6. Add RLS policy for google_oauth_tokens
Currently the table has RLS enabled but NO policies. Create migration:
`supabase/migrations/20260226000005_google_oauth_tokens_rls.sql`:
```sql
CREATE POLICY "org_isolation_select" ON "public"."google_oauth_tokens"
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_insert" ON "public"."google_oauth_tokens"
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_update" ON "public"."google_oauth_tokens"
  FOR UPDATE USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_delete" ON "public"."google_oauth_tokens"
  FOR DELETE USING (org_id = public.current_user_org_id());
```

## Constraints
- Do NOT modify `lib/autopilot/publish-gbp.ts` — it already handles token refresh correctly
- Do NOT install new packages for OAuth — use native fetch() for all Google API calls
- The state parameter MUST include CSRF protection (cookie comparison)
- NEVER expose access_token or refresh_token to the client — all token operations are server-side only
- If GOOGLE_CLIENT_ID is absent, the "Connect GBP" button should show "Not configured" instead of breaking
- All Google API calls must have proper error handling — surface user-friendly messages
- Keep the dark theme styling consistent with existing PlatformRow components
- Run `npx vitest run` after changes
```

---

---

## SPRINT 58 — Unlock Hidden Value: Citation, Page Audit, Prompt Intelligence UIs

**Items: #11, #12, #13**

---

### Prompt 58A — Citation Gap Dashboard Page

```
## Task: Build the Citation Intelligence dashboard page

## Context
The Citation Intelligence engine (`lib/services/citation-engine.service.ts`) runs monthly via `/api/cron/citation`. It queries Perplexity for 9 categories × 20 metros and records which platforms AI actually cites (Yelp, Google, TripAdvisor, etc.) into the `citation_source_intelligence` table.

The gap scoring function `calculateCitationGapScore()` already exists in the service — it compares which platforms AI cites for a business's category+city against which platforms the tenant is actually listed on.

Data flow:
- `citation_source_intelligence` has aggregate market data (not org-scoped): business_category, city, state, platform, citation_frequency (0.0–1.0), sample_query, model_provider
- `listings` table has the tenant's directory listings with sync_status
- `calculateCitationGapScore(platforms, tenantListings)` → { gapScore, platformsCovered, platformsThatMatter, topGap }

Types are in `lib/types/citations.ts`: CitationSourceIntelligence, CitationGapSummary, TenantListing.

## Requirements

### 1. Create the page
`app/dashboard/citations/page.tsx` (server component):
- Authenticate via getSafeAuthContext()
- Fetch the tenant's primary location (categories, city, state)
- Fetch citation_source_intelligence rows matching the tenant's primary category + city
- Fetch the tenant's listings joined with directories (for the gap calculation)
- Call calculateCitationGapScore() to get the gap summary
- Pass data to client components

### 2. Create components
`app/dashboard/citations/_components/CitationGapScore.tsx`:
- Large circular score ring (0-100) similar to SOVScoreRing pattern
- Color: green (80+), amber (50-79), red (<50)
- Shows "X of Y platforms covered"

`app/dashboard/citations/_components/PlatformCitationBar.tsx`:
- Horizontal bar chart showing each platform's citation_frequency (how often AI cites it)
- Color-code: green if tenant is listed on this platform, red/gray if not
- Each bar shows: platform name, frequency percentage, "Listed ✓" or "Not listed — Claim now"

`app/dashboard/citations/_components/TopGapCard.tsx`:
- Highlighted card for the #1 uncovered platform gap
- Shows: platform name, citation frequency, specific action text (from topGap.action)
- CTA button linking to that platform's signup page (provide reasonable defaults: yelp.com/biz_claim, tripadvisor.com/Owners, etc.)

### 3. Add navigation
Add "Citations" to the sidebar in `components/layout/Sidebar.tsx` — use a Link/Globe icon from lucide-react. Position it after "Integrations".

### 4. Plan gate
Only show this page for Growth and Agency plans. For Starter/Trial: show an upgrade card explaining the feature with a link to /dashboard/billing.
Use the existing plan from auth context — do NOT create a new plan enforcer function (the page-level check is sufficient).

### 5. Empty state
If no citation_source_intelligence data exists for the tenant's category+city:
- Show: "Citation data for [category] in [city] hasn't been collected yet. Data is updated monthly."
- Do not show the gap score or platform bars

## Constraints
- Do NOT modify citation-engine.service.ts — import and use calculateCitationGapScore() as-is
- Do NOT create new API routes — this is a server component that queries Supabase directly
- The citation_source_intelligence table is NOT org-scoped (it's aggregate market data) — query it by business_category + city + state, not by org_id
- citation_frequency is stored as 0.0–1.0 float — multiply by 100 for display
- Keep dark theme: bg-surface-dark, signal-green, alert-crimson, electric-indigo
- Run `npx vitest run` after changes
```

---

### Prompt 58B — Page Audit Dashboard Page

```
## Task: Build the Page Audit (Content Grader) dashboard page

## Context
The Content Grader (`lib/page-audit/auditor.ts`) runs monthly via `/api/cron/content-audit`. It scores website pages across 5 AEO dimensions and stores results in the `page_audits` table.

Table columns: org_id, location_id, page_url, page_type ('homepage'|'menu'|'about'|'faq'|'events'|'occasion'|'other'), overall_score (0-100), answer_first_score, schema_completeness_score, faq_schema_present (boolean), aeo_readability_score, recommendations (jsonb array of {issue, fix, impactPoints}), last_audited_at.

Types in `lib/page-audit/auditor.ts`: PageType, PageAuditResult, PageAuditRecommendation.

The 5 scoring dimensions and weights (Doc 17 §2):
- Answer-First Structure: 35%
- Schema Completeness: 25%  
- FAQ Schema Presence: 20%
- Keyword Density: 10%
- Entity Clarity: 10%

## Requirements

### 1. Create the page
`app/dashboard/page-audits/page.tsx` (server component):
- Authenticate via getSafeAuthContext()
- Fetch all page_audits rows for the org, ordered by last_audited_at desc
- Group by page_type for the summary view
- Calculate average overall_score across all pages

### 2. Create components
`app/dashboard/page-audits/_components/AuditScoreOverview.tsx`:
- Shows the average AEO score as a large number with color coding (green 80+, amber 50-79, red <50)
- Below: count of pages audited, last audit date

`app/dashboard/page-audits/_components/PageAuditCard.tsx`:
- One card per audited page showing: page_url (truncated), page_type badge, overall_score ring
- Expandable section showing the 5-dimension breakdown as horizontal progress bars:
  - Answer-First (score / 100)
  - Schema Completeness (score / 100)
  - FAQ Schema (present: green checkmark, absent: red X)
  - Keyword Density (score / 100)
  - AEO Readability (score / 100)
- Recommendations list: each recommendation shows issue, fix, and impact points badge

`app/dashboard/page-audits/_components/DimensionBar.tsx`:
- Reusable horizontal progress bar component
- Props: label, score (0-100), weight (string like "35%")
- Bar fill color: green (80+), amber (50-79), red (<50)

### 3. Add "Re-audit" action
Create server action in `app/dashboard/page-audits/actions.ts`:
```ts
export async function reauditPage(pageUrl: string, pageType: PageType): Promise<ActionResult>
```
- Import auditPage from lib/page-audit/auditor.ts
- Fetch location context for the org
- Run the audit and upsert the result
- Revalidate the page
- Rate limit: max 3 re-audits per org per day (check count of page_audits updated today)

### 4. Add navigation
Add "Page Audits" to the sidebar — use FileSearch icon from lucide-react. Position after "Citations".

### 5. Plan gate
Growth and Agency only. Starter/Trial shows upgrade card.

### 6. Empty state
If no page_audits exist: "No pages have been audited yet. Audits run monthly for businesses with a website URL configured."
Link to settings to add website_url if not set.

## Constraints
- Do NOT modify lib/page-audit/auditor.ts or lib/page-audit/html-parser.ts
- Import auditPage for the re-audit action — it's already a pure function
- The recommendations column is jsonb — parse it as PageAuditRecommendation[]
- faq_schema_present is boolean, not a 0-100 score — display as checkmark/X
- Keep dark theme consistent
- Run `npx vitest run` after changes
```

---

### Prompt 58C — Prompt Intelligence Gap Alerts UI

```
## Task: Add Prompt Intelligence gap alerts to the Share of Voice page

## Context
The Prompt Intelligence engine (`lib/services/prompt-intelligence.service.ts`) detects 3 types of gaps:
1. `untracked` — reference queries missing from the tenant's SOV tracking library
2. `competitor_discovered` — competitors winning queries the tenant doesn't track
3. `zero_citation_cluster` — 3+ tracked queries all returning 0 citations

It runs as a sub-step of the weekly SOV cron. There's also an API endpoint: `GET /api/v1/sov/gaps` that calls detectQueryGaps().

Types in `lib/types/prompt-intelligence.ts`: QueryGap (gapType, queryText, queryCategory, estimatedImpact, suggestedAction), CategoryBreakdown.

The function `computeCategoryBreakdown()` in the service takes queries + evaluations and returns per-category citation rates.

Currently the SOV page (`app/dashboard/share-of-voice/page.tsx`) shows SOVScoreRing, SovCard, SOVTrendChart, and FirstMoverCard. But it doesn't show any gap data.

## Requirements

### 1. Add gap alert section to SOV page
In `app/dashboard/share-of-voice/page.tsx`:
- Fetch gaps by calling detectQueryGaps(orgId, locationId, supabase) from the server component
- Fetch category breakdown by calling computeCategoryBreakdown() with the org's queries and evaluations
- Pass both to new client components below the existing SOV content
- Only show for Growth/Agency plans (use canRunSovEvaluation from plan-enforcer)

### 2. Create gap alert components
`app/dashboard/share-of-voice/_components/GapAlertCard.tsx`:
- Card for each QueryGap
- Shows: gap type badge (color-coded: red for competitor_discovered, amber for untracked, orange for zero_citation_cluster)
- Query text in emphasis
- Impact level badge (high/medium/low)
- Suggested action text
- "Add to Library" button for untracked gaps (calls existing addQuery server action from share-of-voice/actions.ts)
- "Dismiss" button that hides the card (client-side state only — no DB write needed)

`app/dashboard/share-of-voice/_components/CategoryBreakdownChart.tsx`:
- Horizontal stacked bar chart using recharts
- One bar per category (discovery, comparison, occasion, near_me, custom)
- Each bar shows: cited count (green) vs uncited count (gray)
- Label shows category name + citation rate percentage
- Height ~200px, fits in the existing page layout

### 3. Section header
Add a section header "Query Library Health" between the existing SOV content and the new gap section. Include a subtitle: "Gaps detected in your AI visibility tracking coverage."
If no gaps: show "Your query library has full coverage. No gaps detected."

## Constraints
- Do NOT modify prompt-intelligence.service.ts — import detectQueryGaps() and computeCategoryBreakdown() as-is
- Do NOT create new API routes — call the service functions directly from the server component
- The addQuery server action already exists in `app/dashboard/share-of-voice/actions.ts` — reuse it for the "Add to Library" button
- Keep the existing SOV page structure intact — add the new section below, don't reorganize
- recharts is already installed — import BarChart, Bar, XAxis, YAxis, Tooltip, Cell from recharts
- Keep dark theme: use fill="#22c55e" for cited (signal-green) and fill="#334155" for uncited (slate-700)
- Run `npx vitest run` after changes
```

---

---

## SPRINT 59 — Feature Completion: PDF Menus, Revenue Leak History, Weekly Digest

**Items: #15 (PDF upload), #17 (Revenue Leak history), #20 (Weekly Digest)**

---

### Prompt 59A — Magic Menu PDF Upload via GPT-4o Vision

```
## Task: Add PDF menu upload with GPT-4o Vision extraction to Magic Menus

## Context
Current state:
- CSV upload works via `lib/utils/parseCsvMenu.ts`
- Menu workspace at `app/dashboard/magic-menus/` with UploadState, ReviewState, MenuWorkspace components
- JSON-LD generation via `lib/utils/generateMenuJsonLd.ts`
- Public menu page at `app/m/[slug]/page.tsx`
- AI providers configured in `lib/ai/providers.ts` — `getModel('fear-audit')` returns `openai('gpt-4o')`
- Menu types in `lib/types/menu.ts`

What's missing: no PDF upload path. Users can't upload a PDF menu and have it OCR'd into structured data.

## Requirements

### 1. Create PDF extraction service
`lib/services/menu-ocr.service.ts`:
- Export async function `extractMenuFromPDF(pdfBuffer: Buffer): Promise<ExtractedMenuItem[]>`
- Convert PDF buffer to base64
- Call GPT-4o Vision via AI SDK's `generateObject()` with the image and a structured Zod schema
- Schema should extract: item name, description (nullable), price (number), category/section name
- Use `getModel('fear-audit')` (GPT-4o) for the vision call
- Include `hasApiKey('openai')` guard — return empty array with console.log if no key
- System prompt should instruct: "Extract every menu item from this restaurant menu image. Group items by section/category. Return structured JSON."
- Handle multi-page PDFs: if buffer is large, note in comments that GPT-4o Vision handles multi-page natively when sent as a document

### 2. Add PDF upload action
In `app/dashboard/magic-menus/actions.ts`, add:
```ts
export async function uploadPDFMenu(formData: FormData): Promise<ActionResult & { items?: ExtractedMenuItem[] }>
```
- Extract the File from formData
- Validate: must be application/pdf, max 10MB
- Convert to Buffer
- Call extractMenuFromPDF()
- Return the extracted items for the review step (do NOT insert into DB yet — user reviews first)

### 3. Update UploadState component
In `app/dashboard/magic-menus/_components/UploadState.tsx`:
- Add a tab or toggle: "CSV Upload" | "PDF Upload"
- PDF Upload tab shows a file drop zone (drag & drop or click to select)
- Accepts only .pdf files
- On upload: calls uploadPDFMenu action
- Shows loading spinner: "Extracting menu items with AI..."
- On success: transitions to ReviewState with the extracted items
- On error: shows error message with retry button

### 4. Add Zod schema for OCR response
In `lib/ai/schemas.ts`, add:
```ts
export const MenuOCRItemSchema = z.object({
  section: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
});
export const MenuOCRResultSchema = z.object({
  items: z.array(MenuOCRItemSchema),
});
```

## Constraints
- Do NOT modify the existing CSV upload path — it must continue working
- Do NOT modify generateMenuJsonLd.ts or the public menu page
- Use `generateObject()` with the Zod schema (NOT generateText + JSON.parse)
- The PDF is sent as a document content type to the AI SDK, not as a URL
- Max file size: 10MB (validate on both client and server)
- If extraction returns 0 items, show: "No menu items could be extracted. Try a clearer PDF or use CSV upload."
- Keep the existing review → publish flow intact — PDF extraction just provides a different input path to the same ReviewState
- Run `npx vitest run` after changes
```

---

### Prompt 59B — Revenue Leak Historical Trend Persistence

```
## Task: Persist Revenue Leak calculations as daily snapshots for trend visualization

## Context
Current state:
- `lib/services/revenue-leak.service.ts` has pure calculation functions: calculateRevenueLeak(), calculateHallucinationCost(), calculateSOVGapCost(), calculateCompetitorStealCost()
- `app/dashboard/page.tsx` and `app/dashboard/settings/revenue/` call these on every page load
- Dashboard shows LeakBreakdownChart and LeakTrendChart components
- Revenue config (avg_ticket, monthly_searches, etc.) stored in organizations table or defaults

Problem: LeakTrendChart has no historical data — it recalculates from current state every time. Users can't see "your leak dropped from $2,400 to $1,800 this month."

## Requirements

### 1. Create migration for revenue_leak_snapshots table
`supabase/migrations/20260226000006_revenue_leak_snapshots.sql`:
```sql
CREATE TABLE IF NOT EXISTS public.revenue_leak_snapshots (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  leak_low numeric(10,2) NOT NULL,
  leak_high numeric(10,2) NOT NULL,
  hallucination_cost_low numeric(10,2) DEFAULT 0,
  hallucination_cost_high numeric(10,2) DEFAULT 0,
  sov_gap_cost_low numeric(10,2) DEFAULT 0,
  sov_gap_cost_high numeric(10,2) DEFAULT 0,
  competitor_steal_cost_low numeric(10,2) DEFAULT 0,
  competitor_steal_cost_high numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, snapshot_date)
);
ALTER TABLE public.revenue_leak_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON public.revenue_leak_snapshots FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_insert" ON public.revenue_leak_snapshots FOR INSERT WITH CHECK (true);
```
Note: INSERT policy allows service_role (cron) to insert. RLS-scoped clients can only SELECT.

### 2. Add snapshot function to revenue-leak.service.ts
Add export:
```ts
export async function snapshotRevenueLeak(orgId: string, supabase: any): Promise<void>
```
- Fetch current hallucinations (open), latest SOV visibility_analytics, latest competitor_intercepts for the org
- Fetch revenue config from organizations table (or use DEFAULT_CONFIG)
- Call calculateRevenueLeak() with the current data
- Upsert into revenue_leak_snapshots with today's date (idempotent — ON CONFLICT DO UPDATE)

### 3. Wire snapshot into daily audit cron
In the inline fallback of `app/api/cron/audit/route.ts`, after the hallucination audit loop completes for an org, call `snapshotRevenueLeak(org.id, supabase)` in a try/catch (non-critical — don't fail the cron if snapshot fails).

Also add it to `lib/inngest/functions/audit-cron.ts` as an additional step after the hallucination audit step for each org.

### 4. Update LeakTrendChart to use historical data
In `app/dashboard/_components/LeakTrendChart.tsx`:
- Accept an array of snapshot rows as props (fetched by the dashboard page)
- Plot leak_high over time as an AreaChart (recharts)
- X-axis: snapshot_date, Y-axis: dollar amount
- Show the breakdown on hover (tooltip with hallucination + sov_gap + competitor_steal)

### 5. Update dashboard page to fetch snapshots
In `app/dashboard/page.tsx`, add a Supabase query:
- Fetch last 30 revenue_leak_snapshots for the org, ordered by snapshot_date asc
- Pass to LeakTrendChart

## Constraints
- Do NOT modify the pure calculation functions in revenue-leak.service.ts — add snapshotRevenueLeak() alongside them
- The snapshot function is a WRITE operation — it must use service-role client when called from cron
- Snapshot is idempotent — running twice on the same day for the same org just updates the row
- If no hallucinations/SOV/intercepts exist yet, snapshot should still write with all zeros
- Keep the existing recalculated-on-load display as the "current" value — the chart shows history
- Run `npx vitest run` after changes
```

---

### Prompt 59C — Wire Weekly Digest Email to SOV Cron

```
## Task: Wire the Weekly Digest email template to the SOV cron output

## Context
Current state:
- `emails/WeeklyDigest.tsx` — a 239-line React Email scaffold with props: businessName, shareOfVoice, queriesRun, queriesCited, firstMoverCount, dashboardUrl
- `lib/email.ts` has sendHallucinationAlert() and sendSOVReport() (raw HTML string)
- The SOV cron already calls sendSOVReport() after each org's SOV run
- sendSOVReport uses inline HTML strings, not the React Email template

## Requirements

### 1. Enhance WeeklyDigest.tsx
Update the React Email template to include:
- SOV section: current SOV %, change from last week (up/down arrow + delta), queries run, queries cited
- Hallucination section: count of open hallucinations, count of new since last week, worst severity
- Competitor section: count of active competitors tracked, most recent intercept winner
- Revenue Leak section: current leak range ($X – $Y/mo), change from last week
- Occasion section: count of upcoming occasions within 21 days (if any)
- CTA button: "View Full Dashboard" linking to dashboardUrl
- Keep the existing dark-on-white email design with the signal-green accent

### 2. Update props interface
```ts
export interface WeeklyDigestProps {
  businessName: string;
  shareOfVoice: number;
  sovDelta: number; // positive = up, negative = down
  queriesRun: number;
  queriesCited: number;
  firstMoverCount: number;
  openHallucinations: number;
  newHallucinationsThisWeek: number;
  competitorsTracked: number;
  leakLow: number;
  leakHigh: number;
  upcomingOccasions: number;
  dashboardUrl: string;
}
```

### 3. Add sendWeeklyDigest() to lib/email.ts
```ts
export async function sendWeeklyDigest(payload: WeeklyDigestPayload): Promise<void>
```
- Same pattern as sendHallucinationAlert: no-op if RESEND_API_KEY absent
- Use Resend's `react:` property to render WeeklyDigest component (instead of `html:` string)
- Import WeeklyDigest from '@/emails/WeeklyDigest'
- Subject line: "📊 Weekly AI Visibility Report — {businessName}"

### 4. Replace sendSOVReport with sendWeeklyDigest in SOV cron
In `app/api/cron/sov/route.ts` inline fallback:
- After writeSOVResults(), gather the additional data needed (hallucination counts, competitor count, revenue leak, occasion count)
- Call sendWeeklyDigest() instead of sendSOVReport()
- Keep sendSOVReport in lib/email.ts (don't delete it) but mark it as @deprecated

Do the same in `lib/inngest/functions/sov-cron.ts`.

### 5. Calculate sovDelta
In the SOV cron, after getting the current shareOfVoice:
- Fetch the previous week's visibility_analytics snapshot (snapshot_date = today - 7 days)
- sovDelta = currentSOV - previousSOV
- If no previous snapshot exists, sovDelta = 0

## Constraints
- Do NOT install new packages — resend and @react-email/components are already installed
- Do NOT delete sendSOVReport or sendHallucinationAlert — they may be used elsewhere
- The email MUST render correctly in Gmail, Outlook, and Apple Mail — React Email handles this, but avoid complex CSS
- All data fetching for the digest happens in the cron context (service-role client) — no auth needed
- If any supplementary data fetch fails (hallucinations, competitors, etc.), use 0 as default — never fail the email send
- Run `npx vitest run` after changes
```

---

---

## SPRINT 60 — Reliability: E2E Tests, Error Boundaries, Auth Gaps

**Items: #21 (Playwright update), #22 (Sentry boundaries), #24 (Google OAuth login), #25 (Password reset)**

---

### Prompt 60A — Update Playwright E2E Specs

```
## Task: Fix stale Playwright E2E tests and add coverage for new features

## Context
14 E2E spec files exist in tests/e2e/. Config is in playwright.config.ts. Test fixtures in tests/fixtures/. Global setup in tests/global-setup.ts.

Many specs likely have stale selectors because dashboard pages were rebuilt or renamed. New features (content drafts, SOV, AI assistant, citations, page audits) have no E2E coverage.

## Requirements

### 1. Audit and fix all existing specs
Run each spec file and fix selector/assertion failures:
- tests/e2e/auth.spec.ts
- tests/e2e/onboarding.spec.ts  
- tests/e2e/01-viral-wedge.spec.ts through 10-truth-audit.spec.ts
- tests/e2e/billing.spec.ts
- tests/e2e/hybrid-upload.spec.ts

For each, update selectors to match current HTML (use data-testid where possible — add data-testid attributes to components if needed).

### 2. Add new specs for missing features
Create:
- `tests/e2e/11-content-drafts.spec.ts` — navigate to content drafts, verify list loads, click into a draft detail page
- `tests/e2e/12-ai-assistant.spec.ts` — navigate to AI assistant, verify chat UI loads, verify quick-action buttons render, send a message (will fail without API key — just verify the UI doesn't crash)
- `tests/e2e/13-citations.spec.ts` — navigate to citations page, verify plan gate shows for trial users, verify page loads for growth users
- `tests/e2e/14-page-audits.spec.ts` — navigate to page audits, verify empty state or data renders

### 3. Add data-testid attributes
Add `data-testid` attributes to key interactive elements across dashboard pages so Playwright can reliably target them. At minimum:
- Sidebar navigation links: `data-testid="nav-{page-name}"`
- Dashboard metric cards: `data-testid="metric-{name}"`
- Action buttons: `data-testid="btn-{action}"`

### 4. Update global-setup.ts if needed
Ensure the test user creation and login flow still works with current auth patterns.

## Constraints
- Do NOT change application logic — only add data-testid attributes and fix test selectors
- Tests should pass in CI without real API keys (mock/demo mode)
- Use the existing test fixtures and global setup patterns
- Each spec should be independent (no ordering dependencies between files)
- Run `npx playwright test` to verify all specs pass
```

---

### Prompt 60B — Sentry Error Boundaries + Google OAuth + Password Reset

```
## Task: Add per-section error boundaries, Google OAuth login, and password reset

## Context
- Sentry is configured: sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts
- global-error.tsx exists for top-level errors
- Auth uses Supabase Auth with email/password
- Missing: section-level error.tsx files, Google OAuth sign-in, password reset flow

## Requirements

### Part 1: Error boundaries
Create `error.tsx` files for each dashboard section:
- `app/dashboard/error.tsx` — catches errors in the main dashboard overview
- `app/dashboard/hallucinations/error.tsx`
- `app/dashboard/share-of-voice/error.tsx`
- `app/dashboard/ai-assistant/error.tsx`
- `app/dashboard/content-drafts/error.tsx`

Each error.tsx should:
- Be a 'use client' component with `{ error, reset }` props
- Log to Sentry: `Sentry.captureException(error)`
- Show a user-friendly error card: icon, "Something went wrong" heading, error.message in small text, "Try Again" button calling reset()
- Consistent dark theme styling
- Import Sentry from '@sentry/nextjs'

### Part 2: Google OAuth login
In `app/(auth)/login/page.tsx`:
- Add "Sign in with Google" button below the email/password form
- Button calls Supabase's `signInWithOAuth({ provider: 'google', options: { redirectTo } })`
- redirectTo should be `${window.location.origin}/api/auth/callback` or `/dashboard`
- Style: white button with Google "G" icon, consistent with the dark auth page theme

In `app/(auth)/register/page.tsx`:
- Same "Sign up with Google" button
- Same Supabase signInWithOAuth call (Supabase auto-creates user on first OAuth login)

Note: Google OAuth provider must be configured in the Supabase dashboard separately — add a comment noting this requirement.

### Part 3: Password reset
Create `app/(auth)/forgot-password/page.tsx`:
- Simple form: email input + "Send Reset Link" button
- Calls Supabase `resetPasswordForEmail(email, { redirectTo })`
- redirectTo: `${window.location.origin}/auth/reset-password`
- Shows success message: "Check your email for a reset link"
- Shows error if email not found

Create `app/(auth)/reset-password/page.tsx`:
- Form with: new password input, confirm password input, "Reset Password" button
- Reads the token from URL params (Supabase adds it automatically)
- Calls Supabase `updateUser({ password })`
- On success: redirect to /login with success message
- Validate: passwords match, minimum 8 characters

Add "Forgot password?" link to the login page, positioned below the password input.

## Constraints
- Do NOT modify Sentry config files (they're already configured)
- For Google OAuth: use Supabase's built-in OAuth — do NOT implement custom OAuth flows
- The Google OAuth button should gracefully handle the case where Google provider isn't configured in Supabase (show a toast error, don't crash)
- Password reset redirectTo URL must match what's configured in Supabase Auth settings
- Keep the dark auth page theme (match existing login/register styling)
- Run `npx vitest run` after changes
```

---

---

## SPRINT 61 — Polish: Occasion Calendar, POS Mapper, Multi-Model SOV, WP Connect

**Items: #14 (Occasion calendar), #16 (POS mapper), #18 (Multi-model SOV), #19 (WP connect)**

---

### Prompt 61 — Occasion Calendar, Multi-Model SOV, WordPress Connect

```
## Task: Build occasion calendar UI, enable multi-model SOV, and add WordPress credential management

## Three sub-tasks in one sprint. Complete each sequentially.

---

### Sub-task A: Occasion Calendar UI
Add an "Upcoming Occasions" section to the content-drafts page.

In `app/dashboard/content-drafts/page.tsx`:
- Fetch active occasions from local_occasions table
- For each, compute daysUntilPeak using getDaysUntilPeak() from lib/services/occasion-engine.service.ts
- Filter to occasions within trigger window (daysUntilPeak >= 0 AND <= trigger_days_before)
- Sort by daysUntilPeak ascending (soonest first)

Create `app/dashboard/content-drafts/_components/OccasionTimeline.tsx`:
- Shows each upcoming occasion as a horizontal card with: occasion name, days until peak (countdown badge), occasion_type badge (holiday/celebration/recurring/seasonal), relevant_categories tags
- If a content_draft already exists with trigger_type='occasion' and trigger_id=occasion.id, show "Draft exists" link to the draft
- If no draft: show "Create Draft" button that calls the existing createManualDraft action with trigger_type='occasion'

Show this section above the draft list, inside a collapsible "Upcoming Occasions" header.

### Sub-task B: Multi-Model SOV Queries
Currently `runSOVQuery()` in sov-engine.service.ts only calls `getModel('sov-query')` (Perplexity).

Update `lib/services/sov-engine.service.ts`:
- Add an optional `modelKey` parameter to `runSOVQuery()` with default `'sov-query'`
- Add a new export: `runMultiModelSOVQuery(query: SOVQueryInput): Promise<SOVQueryResult[]>` that runs the same query against both 'sov-query' (Perplexity) and 'sov-query-openai' (GPT-4o) in parallel
- Each result should include a `modelProvider` field ('perplexity' or 'openai')
- In writeSOVResults(), store separate sov_evaluations rows per engine (the engine column already exists)

Update the SOV cron inline fallback and Inngest function to use `runMultiModelSOVQuery()` for Growth/Agency orgs, and single-model for Starter orgs.

### Sub-task C: WordPress Credential Management
In `app/dashboard/integrations/page.tsx`, add a WordPress integration row:
- If NOT connected: show "Connect WordPress" button that opens a modal
- If connected: show green badge + site URL + "Disconnect" button

Create `app/dashboard/integrations/_components/WordPressConnectModal.tsx`:
- Form fields: WordPress Site URL, Username, Application Password
- "Test Connection" button that calls a server action to verify credentials (HEAD request to wp-json/wp/v2/pages with Basic auth)
- "Save" button that stores credentials in location_integrations table (integration_type='wordpress')
- Clear documentation text: "Create an Application Password in your WordPress admin: Users → Your Profile → Application Passwords"

Add server actions in `app/dashboard/integrations/actions.ts`:
- `testWordPressConnection(siteUrl, username, appPassword)` — returns success/failure
- `saveWordPressCredentials(siteUrl, username, appPassword)` — stores in location_integrations
- `disconnectWordPress()` — deletes the location_integrations row

## Constraints
- For Sub-task A: import getDaysUntilPeak from occasion-engine.service.ts — do NOT reimplement
- For Sub-task B: the sov-query-openai model key already exists in providers.ts — just use it
- For Sub-task B: do NOT call both models for Starter plans — check plan tier first
- For Sub-task C: Application Passwords are stored server-side only — NEVER expose to client
- For Sub-task C: the test connection action must timeout after 10 seconds
- Keep all existing functionality working — no regressions
- Run `npx vitest run` after changes
```

---

---

## SPRINT 62 — Scale Prep: Cron Health, Guided Tour, Subdomains, Landing, Settings, Agency

**Items: #23, #26, #27, #28, #29, #30**

---

### Prompt 62 — Scale Prep Sprint

```
## Task: Complete 6 final V1 polish items for launch readiness

## These are independent sub-tasks. Complete each sequentially.

---

### Sub-task A: Cron Health Logging (#23)
Create `supabase/migrations/20260226000007_cron_run_log.sql`:
- Table: cron_run_log (id uuid PK, cron_name varchar, started_at timestamptz, completed_at timestamptz, duration_ms integer, status 'success'|'failed'|'timeout', summary jsonb, error_message text nullable)
- No RLS needed (service-role only writes)

Create `lib/services/cron-logger.ts`:
- Export `logCronStart(cronName)` → returns { logId, startedAt }
- Export `logCronComplete(logId, summary)` → sets completed_at, duration_ms, status='success', summary
- Export `logCronFailed(logId, errorMessage)` → sets status='failed', error_message

Wire into all 4 cron route inline fallbacks: wrap the main logic with logCronStart/logCronComplete/logCronFailed.

### Sub-task B: Post-Onboarding Guided Tour (#26)
Install `react-joyride` (or use a simpler custom tooltip approach).
Create `app/dashboard/_components/GuidedTour.tsx`:
- 5-step tour: Reality Score → Hallucinations link → Magic Menu link → Compete link → AI Assistant link
- Each step: spotlight on the element + tooltip with 1-2 sentence explanation
- "Next" / "Skip Tour" buttons
- Store completion in localStorage key `lv_tour_completed`
- Only shows on first dashboard visit (check localStorage)

Wire into dashboard layout: render GuidedTour client component after the main content.

### Sub-task C: Subdomain Routing (#27)
Update `middleware.ts` (the existing Supabase middleware):
- Check the hostname of incoming requests
- If hostname starts with `menu.`: rewrite URL to `/m/` path (public menu pages)
- If hostname starts with `app.`: continue normally (dashboard)
- If neither: continue normally (landing page at root)
- Keep all existing session refresh logic intact

Add comment documenting the Vercel DNS config needed: wildcard subdomain *.localvector.ai pointing to the Vercel deployment.

### Sub-task D: Landing Page Performance (#28)
Split `app/page.tsx` (1,181 lines) into sections:
- Create `app/_sections/Hero.tsx`, `FearSection.tsx`, `HowItWorks.tsx`, `Pricing.tsx`, `FAQ.tsx`, `CTA.tsx`
- The main page.tsx imports and composes them
- Add `loading="lazy"` to any images below the fold
- Wrap below-fold sections in dynamic imports: `const Pricing = dynamic(() => import('./_sections/Pricing'))`
- Keep all content identical — this is a refactor, not a redesign

### Sub-task E: Settings Completeness (#29)
Expand `app/dashboard/settings/page.tsx`:
- Profile section: display name (editable), email (read-only), change password link (to /auth/reset-password)
- Notification preferences: toggle switches for email_hallucination_alerts (on/off), email_weekly_digest (on/off), email_sov_alerts (on/off) — store in organizations table (add columns if needed via migration)
- Danger zone: "Delete Organization" button with confirmation modal — calls a server action that soft-deletes (sets plan_status to 'canceled', does NOT actually delete data)

### Sub-task F: Agency Multi-Location UI (#30)
Update `components/layout/Sidebar.tsx`:
- If org has multiple locations: show a location switcher dropdown at the top of the sidebar
- Dropdown lists all locations for the org (fetched in dashboard layout and passed as props)
- Selected location stored in a cookie or URL search param
- All dashboard pages that query by location_id should read the selected location

Update `app/dashboard/locations/page.tsx`:
- Show all locations in a list/grid
- "Add Location" button respects maxLocations(plan) from plan-enforcer.ts
- If at limit: show "Upgrade to Agency for more locations"
- Each location card shows: business name, city/state, is_primary badge

## Constraints
- Sub-task A: cron_run_log is infrastructure only — no dashboard UI needed
- Sub-task B: guided tour must not block page interaction (overlay with pointer-events-none except the tooltip)
- Sub-task C: do NOT break existing path-based routing — subdomains are additive
- Sub-task D: no content changes — only structural refactoring
- Sub-task E: add notification columns via migration if they don't exist; default all to true
- Sub-task F: location switcher cookie name: `lv_selected_location`
- Run `npx vitest run` after ALL sub-tasks complete
```

---

---

## Quick Reference: Sprint → Items Map

| Sprint | Items | Theme | Est. |
|--------|-------|-------|------|
| **S56** | #6, #7, #10 | Production readiness | 8–12 hrs |
| **S57** | #8, #9 | Key UX | 9–12 hrs |
| **S58** | #11, #12, #13 | Unlock hidden value | 11–16 hrs |
| **S59** | #15, #17, #20 | Feature completion | 12–16 hrs |
| **S60** | #21, #22, #24, #25 | Reliability | 12–17 hrs |
| **S61** | #14, #16, #18, #19 | Polish | 13–19 hrs |
| **S62** | #23, #26, #27, #28, #29, #30 | Scale prep | 22–32 hrs |
