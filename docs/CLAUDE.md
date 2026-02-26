# CLAUDE.md — LocalVector V1 Project Context

## Project Overview

LocalVector is an AEO/GEO SaaS platform that helps local businesses monitor and improve their visibility in AI-generated answers (ChatGPT, Perplexity, Gemini, etc.). Built with Next.js 16 (App Router), TypeScript, Supabase/PostgreSQL, and the Vercel AI SDK.

## Tech Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Database:** Supabase (PostgreSQL) with RLS via `current_user_org_id()`
- **AI:** Vercel AI SDK (`ai` package) with OpenAI, Perplexity, Anthropic, Google providers — configured in `lib/ai/providers.ts`
- **Billing:** Stripe webhooks → `organizations.plan_tier` enum (`trial | starter | growth | agency`)
- **Email:** Resend + React Email (`emails/`)
- **Cache:** Upstash Redis (`lib/redis.ts`) — optional, all callers must degrade gracefully
- **Testing:** Vitest (unit/integration in `src/__tests__/`), Playwright (E2E in `tests/e2e/`, 18 specs)
- **Monitoring:** Sentry (client, server, edge configs)

## Architecture Rules

- **Database is the source of truth.** `supabase/prod_schema.sql` is the canonical schema. All migrations in `supabase/migrations/` are applied in timestamp order.
- **Services are pure.** Files in `lib/services/` never create their own Supabase client — callers pass one in. This lets the same service work with RLS-scoped clients (user actions) and service-role clients (cron routes).
- **Plan gating lives in `lib/plan-enforcer.ts`.** Always check feature availability before rendering premium UI or executing paid-tier operations.
- **AI providers are centralized.** Never call AI APIs directly — use `getModel(key)` from `lib/ai/providers.ts`. Mock fallbacks activate when API keys are absent.
- **RLS pattern:** Every tenant-scoped table has `org_isolation_select/insert/update/delete` policies using `org_id = public.current_user_org_id()`.
- **Cron routes** live in `app/api/cron/` and require `Authorization: Bearer <CRON_SECRET>` header. Each has a kill switch env var.

## Key Directories

```
app/api/cron/          — Automated pipelines (sov, audit, content-audit)
app/(auth)/            — Auth pages (login, register, forgot-password, reset-password)
app/dashboard/         — Authenticated dashboard pages (each has error.tsx boundary)
app/dashboard/citations/     — Citation Gap Dashboard (Sprint 58A)
app/dashboard/page-audits/   — Page Audit Dashboard (Sprint 58B)
lib/ai/                — AI provider config, schemas, actions
lib/services/          — Pure business logic services
lib/page-audit/        — HTML parser + AEO auditor
lib/tools/             — AI chat tool definitions
lib/mcp/               — MCP server tool registrations
lib/supabase/database.types.ts — Full Database type (28 tables, 9 enums, Relationships)
supabase/migrations/   — Applied SQL migrations (timestamp-ordered)
supabase/prod_schema.sql — Full production schema dump
docs/                  — Spec documents (authoritative for planned features)
src/__tests__/         — Unit + integration tests
tests/e2e/             — Playwright E2E tests
```

## Database Tables (Key Ones)

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant root — has `plan_tier`, `plan_status`, notification prefs (`notify_hallucination_alerts`, `notify_weekly_digest`, `notify_sov_alerts`) |
| `locations` | Business locations per org |
| `target_queries` | SOV query library per location |
| `sov_evaluations` | Per-query SOV results (engine, rank, competitors) |
| `visibility_analytics` | Aggregated SOV scores per snapshot date |
| `ai_hallucinations` | Detected hallucinations with severity + status tracking |
| `content_drafts` | AI-generated content awaiting human approval |
| `competitor_intercepts` | Head-to-head competitor analysis results |
| `local_occasions` | Seasonal event reference table |
| `citation_source_intelligence` | Which platforms AI actually cites per category (aggregate, not org-scoped) |
| `page_audits` | AEO page audit results per org (5 dimension scores + recommendations) |
| `google_oauth_tokens` | GBP OAuth credentials per org (service-role writes, authenticated SELECT) |
| `location_integrations` | Platform connections per location (Big 6 + listing URLs + WordPress `wp_username`/`wp_app_password`) |
| `cron_run_log` | Cron execution health log (cron_name, duration_ms, status, summary JSONB) — service-role only, no RLS policies |

## Current Migrations (Applied)

1. `20260218000000_initial_schema.sql` — Core tables + RLS
2. `20260220000001_create_menu_categories.sql`
3. `20260221000001_public_menu_reads.sql`
4. `20260221000002_create_integrations.sql`
5. `20260221000003_create_ai_evaluations.sql`
6. `20260221000004_create_sov_tracking.sql` — Creates `target_queries` and `sov_evaluations`
7. `20260223000001_add_gpt4o_mini_model_provider.sql`
8. `20260224000001_content_pipeline.sql` — `content_drafts`, `page_audits`, `local_occasions`, `citation_source_intelligence`
9. `20260224000002_gbp_integration.sql`
10. `20260224000003_listing_url_column.sql`
11. `20260225000001_revenue_leak.sql` — `revenue_config`, `revenue_snapshots`
12. `20260226000001_add_query_category.sql`
13. `20260226000002_autopilot_trigger_idempotency.sql`
14. `20260226000003_competitor_intercepts_rls_policies.sql`
15. `20260226000004_rls_audit_fixes.sql`
16. `20260226000005_seed_occasions_phase2.sql` — 12 new occasions (32 total)
17. `20260226000006_google_oauth_tokens_rls.sql` — org_isolation_select for authenticated, service-role-only writes
18. `20260226000007_wp_credentials.sql` — `wp_username`, `wp_app_password` columns on `location_integrations`
19. `20260226000008_cron_run_log.sql` — `cron_run_log` table for cron health logging (service-role only)
20. `20260226000009_notification_prefs.sql` — `notify_hallucination_alerts`, `notify_weekly_digest`, `notify_sov_alerts` columns on `organizations`

## Testing Commands

```bash
npm test                    # Run all Vitest tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:coverage       # With coverage report
npx playwright test         # E2E tests
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY, PERPLEXITY_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY
CRON_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
```

---

## CURRENT TASK: Build the Autopilot Engine (Full Publish Pipeline)

### What It Is

The Autopilot Engine is the **ACT layer** that closes the DETECT → DIAGNOSE → ACT → MEASURE loop. Every other engine creates `content_drafts` rows (First Mover alerts, occasion pages, prompt gaps, competitor gaps) but those drafts currently sit in the dashboard with no way to publish. This engine adds:

1. **AI draft generation** — converts triggers into polished, AEO-optimized content via GPT-4o-mini
2. **HITL approval workflow** — strict state machine with server-side enforcement (no auto-publish, ever)
3. **Publish pipeline** — download as HTML (Phase 5), WordPress REST API (Phase 6), GBP Post (Phase 6)
4. **Post-publish measurement** — SOV re-check 14 days after publish to verify AI is now citing the content
5. **Draft queue management** — cap at 5 pending drafts per org, auto-archive expired occasion drafts

The full spec is in `docs/19-AUTOPILOT-ENGINE.md`. API contracts in `docs/05-API-CONTRACT.md §13`. UI spec in `docs/06-FRONTEND-UX-SPEC.md §9`.

### What Already Exists

**Database — `content_drafts` table (FULLY CREATED):**
- `id`, `org_id`, `location_id`, `trigger_type`, `trigger_id`, `draft_title`, `draft_content`, `target_prompt`, `content_type`, `aeo_score`, `status`, `human_approved`, `published_url`, `published_at`, `approved_at`, `created_at`, `updated_at`
- CHECK constraints on `trigger_type` (5 values), `content_type` (5 values), `status` (5 values)
- RLS: `org_isolation_select/insert/update/delete` policies

**Database — supporting tables:**
- `google_oauth_tokens` — GBP OAuth credentials (access_token, refresh_token, expires_at, gbp_account_name)
- `location_integrations` — platform connections per location (status, external_id, listing_url)
- `locations` — has `google_location_name` and `gbp_integration_id` columns for GBP
- `local_occasions` — for occasion draft expiry logic (annual_date field)

**Server Actions (3 already implemented in `app/dashboard/content-drafts/actions.ts`):**
- `approveDraft(formData)` — sets `status='approved'`, `human_approved=true`, `approved_at`
- `rejectDraft(formData)` — sets `status='rejected'`
- `createManualDraft(formData)` — plan-gated (Growth+), inserts with `trigger_type='manual'`

**UI (fully built):**
- `app/dashboard/content-drafts/page.tsx` — list view with filter tabs (All/Drafts/Approved/Published/Rejected)
- `ContentDraftCard.tsx` — renders trigger badges (First Mover=amber, Competitor Gap=red, Occasion=blue, Prompt Gap=purple, Manual=grey), status badges, AEO score, approve/reject buttons
- `DraftFilterTabs.tsx` — status filter tabs
- E2E test: `tests/e2e/08-content-drafts.spec.ts`
- Unit test: `src/__tests__/unit/content-drafts-actions.test.ts`

**Infrastructure:**
- `lib/ai/providers.ts` — `getModel('greed-intercept')` = GPT-4o-mini (cost-efficient, for draft generation)
- `lib/schema/types.ts` — Schema.org typed builders via `schema-dts` (Restaurant, FAQPage, LocalBusiness, etc.)
- `lib/utils/generateMenuJsonLd.ts` — existing JSON-LD generator (pattern to follow)
- `lib/utils/zipBundle.ts` — ZIP creation utility (tested)
- `lib/plan-enforcer.ts` — `canRunAutopilot(plan)` returns true for Growth+

**What other engines already do that feeds this system:**
- SOV Engine `writeSOVResults()` creates `first_mover` drafts (basic: title + one-line content)
- Occasion Engine (if built) creates `occasion` drafts
- Prompt Intelligence (if built) creates `prompt_missing` drafts for zero-citation clusters
- Greed Engine stores intercepts with `query_asked`, `winning_factor`, `gap_analysis` — feeds `competitor_gap` context

### What Needs to Be Built

#### Phase 1: Core Draft Generation Service

**1a. Master Draft Creator** — `lib/autopilot/create-draft.ts`

Pure service. The single entry point all triggers call:

```
createDraft(trigger: DraftTrigger, supabase) → ContentDraft
```

Steps (Doc 19 §3.1):
1. **Idempotency check** — if `trigger.triggerId` is set, check for existing `content_drafts` row with that `trigger_id`. Skip if found.
2. **Pending draft cap** — count drafts with `status='draft'` for this org. If ≥ 5, suppress new draft (Doc 19 §8.1). Log warning, return null.
3. **Load location context** — fetch `business_name`, `city`, `state`, `categories` from `locations` table
4. **Determine content type** — `competitor_gap` → `faq_page`, `occasion` → `occasion_page`, `prompt_missing` → `faq_page`, `first_mover` → `faq_page` (discovery) or `occasion_page` (occasion queries), `manual` → user-selected
5. **Generate brief via GPT-4o-mini** — call `generateDraftBrief()` with trigger context
6. **Score content** — call the page audit's `scoreAnswerFirst()` or a lightweight heuristic for initial AEO score
7. **Insert into `content_drafts`** — all fields populated, `status='draft'`, `human_approved=false`

**1b. Draft Brief Generator** — `lib/autopilot/generate-brief.ts`

Uses `getModel('greed-intercept')` (GPT-4o-mini) with Vercel AI SDK `generateText()`:

```
generateDraftBrief(trigger, location, contentType) → { title, content, targetKeywords }
```

The prompt (Doc 19 §3.2) varies by trigger type via a **context block builder** (Doc 19 §3.3):
- `competitor_gap` → includes competitor name, winning factor, query being lost
- `occasion` → includes occasion name, days until peak, competitor status
- `prompt_missing` → includes zero-citation queries or page audit recommendations
- `first_mover` → includes query text, "no business cited" message
- `manual` → includes user's additional context text

Add Zod schema in `lib/ai/schemas.ts`:
```typescript
export const AutopilotDraftSchema = z.object({
  title: z.string(),
  content: z.string(),
  estimated_aeo_score: z.number().min(0).max(100),
  target_keywords: z.array(z.string()),
});
```

Mock fallback when API keys absent (match SOV engine pattern).

**1c. Upgrade Existing Trigger Points**

Currently, `writeSOVResults()` in `sov-engine.service.ts` creates bare-bones `first_mover` drafts with minimal content:
```typescript
draft_content: `No business is being recommended for "${opp.queryText}". Create content...`
```

After this build, it should call `createDraft()` instead, passing the full trigger context so GPT-4o-mini generates real AEO-optimized content. Same for Occasion Engine and Prompt Intelligence triggers.

#### Phase 2: Publish Pipeline

**2a. Publish Server Action** — add to `app/dashboard/content-drafts/actions.ts`

```
publishDraft(formData: { draft_id, publish_target }) → ActionResult
```

**CRITICAL SERVER-SIDE VALIDATION (Doc 19 §4.1 — non-negotiable):**
- Fetch the draft by ID (RLS-scoped)
- Verify `human_approved === true` AND `status === 'approved'`
- If either fails → return `{ success: false, error: 'Draft must be approved before publishing' }`
- This is the **only** enforcement point. No client-side bypass possible.

**2b. Download Target** — `lib/autopilot/publish-download.ts` (Phase 5 — build first)

Per Doc 19 §5.1:
- Generate HTML with proper `<title>`, `<meta>` tags
- Inject JSON-LD: `LocalBusiness` schema from location data + `FAQPage` schema if `content_type='faq_page'`
- Use `schema-dts` types from `lib/schema/types.ts` for type safety
- Return base64 HTML string for client download
- Update draft: `status='published'`, `published_at=now()`

**2c. GBP Post Target** — `lib/autopilot/publish-gbp.ts` (Phase 6)

Per Doc 19 §5.3:
- Fetch `google_oauth_tokens` for the org (service-role, no RLS on this table)
- Check token expiry, refresh if needed
- Truncate content to 1500 chars (GBP limit)
- POST to `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`
- Handle token refresh on 401
- Update draft: `status='published'`, `published_url=gbpPost.searchUrl`, `published_at=now()`

**2d. WordPress Target** — `lib/autopilot/publish-wordpress.ts` (Phase 6)

Per Doc 19 §5.2:
- Read WordPress credentials from `location_integrations` where `platform='wordpress'`
- POST to `${siteUrl}/wp-json/wp/v2/pages` with Basic auth (Application Password)
- Create as WordPress `draft` (second approval layer in WP admin)
- Update draft: `status='published'`, `published_url=wpPost.link`, `published_at=now()`

#### Phase 3: Post-Publish Measurement

**3a. SOV Re-Check Scheduler** — `lib/autopilot/post-publish.ts`

Per Doc 19 §6.1:
- After successful publish, if `target_prompt` exists, schedule a re-check
- Store in Redis key: `sov_recheck:{draft_id}` with value `{ locationId, targetQuery, publishedAt }`, TTL 15 days
- The weekly SOV cron checks for pending re-check keys and runs the query
- Compare: if business now cited (was not before) → send celebration email
- If Redis unavailable, skip gracefully (AI_RULES §17)

**3b. Integrate into SOV Cron** — modify `app/api/cron/sov/route.ts`

Add a sub-step after SOV results are written:
- Scan Redis for `sov_recheck:*` keys where `publishedAt` is 14+ days ago
- For each, run a single SOV query against the `targetQuery`
- Compare with pre-publish state
- Clean up the Redis key after check

#### Phase 4: Draft Queue Management

**4a. Pending Draft Cap Enforcement**

Inside `createDraft()` (already described in Phase 1). Count `content_drafts WHERE org_id = ? AND status = 'draft'`. If ≥ 5, suppress and return null.

**4b. Occasion Draft Expiry** — add to SOV cron or as daily sub-step

Per Doc 19 §8.2:
```sql
UPDATE content_drafts
SET status = 'archived'
WHERE trigger_type = 'occasion'
  AND status IN ('draft', 'approved')
  AND trigger_id IN (
    SELECT id FROM local_occasions
    WHERE annual_date IS NOT NULL
      AND TO_DATE(annual_date, 'MM-DD') < CURRENT_DATE
  );
```

Run this check inside the SOV cron per-org loop. Archive occasion drafts whose peak has passed.

#### Phase 5: Edit → Re-Score Flow

Per Doc 19 §4.3:

**5a. Update PATCH action** — add `editDraft()` to `app/dashboard/content-drafts/actions.ts`

```
editDraft(formData: { draft_id, draft_title?, draft_content?, target_prompt? }) → ActionResult
```

- Only allowed when `status = 'draft'` (not approved/published). Return 409 if status is 'approved'.
- On content change, recalculate AEO score using a lightweight heuristic (keyword presence, answer-first check, length). Do NOT call GPT-4o-mini on every edit — too expensive.
- Update `updated_at` timestamp.

### Files to Create

| File | Purpose |
|------|---------|
| `lib/autopilot/create-draft.ts` | Master draft creator with idempotency, cap, and full context |
| `lib/autopilot/generate-brief.ts` | GPT-4o-mini prompt builder per trigger type |
| `lib/autopilot/publish-download.ts` | HTML download with JSON-LD injection |
| `lib/autopilot/publish-gbp.ts` | GBP Post via Google API |
| `lib/autopilot/publish-wordpress.ts` | WordPress REST API publish |
| `lib/autopilot/post-publish.ts` | SOV re-check scheduling via Redis |
| `lib/autopilot/score-content.ts` | Lightweight AEO scoring heuristic |
| `lib/types/autopilot.ts` | TypeScript interfaces (DraftTrigger, DraftContext, PublishResult, PostPublishMeasurementTask) |
| `app/dashboard/content-drafts/[id]/page.tsx` | Draft detail/review view (Doc 06 §9.2) — context panel, editable content, AEO breakdown, publish target selector |
| `src/__tests__/unit/autopilot-create-draft.test.ts` | Unit tests for draft creator (idempotency, cap, context building) |
| `src/__tests__/unit/autopilot-generate-brief.test.ts` | Unit tests for brief generation (all 5 trigger types, mock fallback) |
| `src/__tests__/unit/autopilot-publish.test.ts` | Unit tests for all publish targets (download HTML structure, GBP truncation, WP draft status) |
| `src/__tests__/unit/autopilot-post-publish.test.ts` | Unit tests for SOV re-check scheduling and execution |

### Files to Modify

| File | Change |
|------|--------|
| `app/dashboard/content-drafts/actions.ts` | Add `publishDraft()`, `editDraft()`, `archiveDraft()` server actions. **FIX:** `rejectDraft()` must set `status='draft'` + `human_approved=false` (not `status='rejected'`) per Doc 19 §4.2 state machine. |
| `app/dashboard/content-drafts/_components/ContentDraftCard.tsx` | Add Publish dropdown button (Download/WordPress/GBP) for approved drafts. Add Archive button for any state. Show factual disclaimer modal before publish. |
| `lib/ai/schemas.ts` | Add `AutopilotDraftSchema` for GPT-4o-mini brief response |
| `lib/services/sov-engine.service.ts` | Replace bare-bones first_mover draft creation with `createDraft()` call |
| `app/api/cron/sov/route.ts` | Add occasion draft expiry sub-step; add post-publish re-check sub-step |
| `src/__tests__/unit/content-drafts-actions.test.ts` | Add tests for `publishDraft()`, `editDraft()`, `archiveDraft()`. Update `rejectDraft()` test to expect `status='draft'`. |
| `src/__tests__/unit/cron-sov.test.ts` | Add tests for expiry and re-check sub-steps |

### Critical Discrepancies to Fix

**1. `rejectDraft()` sets wrong status.** The existing action in `actions.ts` sets `status: 'rejected'`, but Doc 19 §4.2 state machine says rejection should return the draft to `status: 'draft'` (making it editable again). The `rejected` status in the CHECK constraint seems intended as a terminal/archive-like state. Fix: `rejectDraft()` should set `status: 'draft'` AND `human_approved: false` to match the spec's "reject returns to editable" flow.

**2. `archiveDraft()` action missing.** Doc 19 §4.2 shows "Any state → [manual archive] → archived" but no action exists. Add `archiveDraft()` server action.

**3. No publish button in UI.** `ContentDraftCard.tsx` has Approve and Reject buttons but no Publish or Download button. The approved-state card needs a "Publish" dropdown (Download HTML / WordPress / GBP Post) and the factual disclaimer modal.

**4. No draft detail view.** Doc 06 §9.2 specs a `/content-drafts/:id` detail view with side-by-side context panel + editable content area + AEO score breakdown. Currently only the list view exists. Build `app/dashboard/content-drafts/[id]/page.tsx`.

### Safety & Security Constraints (NON-NEGOTIABLE)

1. **No auto-publish. Ever.** `human_approved: true` AND `status: 'approved'` validated server-side on every `publishDraft()` call. No exceptions. No bypass via `trigger_type` or plan tier.

2. **Factual disclaimer on publish.** The publish flow must include: *"You are publishing AI-generated content. Please verify all facts (prices, hours, amenities) before publishing."*

3. **Idempotency on all draft creation.** `createDraft()` checks `trigger_id` before inserting. Duplicate triggers produce zero additional drafts. Tested.

4. **Pending draft cap of 5.** Auto-triggered drafts (competitor_gap, occasion, prompt_missing) are silently suppressed when the org has ≥ 5 unreviewed drafts. Prevents alert fatigue and runaway AI generation.

5. **GBP token security.** `google_oauth_tokens` has RLS enabled with `org_isolation_select` for authenticated (read-only). INSERT/UPDATE/DELETE via service-role only. Tokens are never exposed to the client — only `google_email` and `gbp_account_name` are read by the integrations page.

6. **WordPress credentials.** Stored in `location_integrations` — RLS-scoped to org. Never sent to client; used server-side only in the publish action.

7. **Approved → Edit requires rejection.** An approved draft cannot be edited. User must reject it first (returns to `status='draft'`), then edit, then re-approve. This prevents stealth edits after approval.

### Architecture Patterns

- Follow `lib/services/sov-engine.service.ts` for the pure service pattern (no client creation)
- Follow `lib/ai/providers.ts` + `generateText()` for AI calls (not raw fetch)
- Follow `lib/page-audit/auditor.ts` for content scoring patterns
- Follow `lib/utils/generateMenuJsonLd.ts` for JSON-LD generation
- Follow existing `actions.ts` patterns for server actions (getSafeAuthContext, Zod validation, RLS-scoped client)

### Validation

After building:
1. `npm run test:unit` — all new autopilot tests pass
2. Create a `first_mover` draft via SOV cron → verify it now has GPT-generated content (not placeholder text)
3. Approve a draft → verify `publishDraft('download')` returns base64 HTML with JSON-LD
4. Attempt `publishDraft()` on an unapproved draft → verify 403 rejection
5. Attempt `publishDraft()` on a draft with `human_approved=false` → verify 403 rejection
6. Create 5 pending drafts → trigger a 6th via cron → verify it's suppressed (no 6th row)
7. Seed an occasion draft for a past occasion → run expiry logic → verify `status='archived'`
8. `editDraft()` on an approved draft → verify 409 Conflict
9. Content Drafts page shows "Download HTML" button on approved drafts
10. E2E: `tests/e2e/08-content-drafts.spec.ts` still passes

### Build Order

Build in this sequence to maintain testability at each step:

1. **Types + Zod schema** (`lib/types/autopilot.ts`, `lib/ai/schemas.ts`) — no dependencies
2. **AEO scoring heuristic** (`lib/autopilot/score-content.ts`) — pure function
3. **Brief generator** (`lib/autopilot/generate-brief.ts`) — needs AI schema
4. **Master draft creator** (`lib/autopilot/create-draft.ts`) — needs brief generator + scoring
5. **Unit tests for 1-4** — verify core pipeline works
6. **Fix `rejectDraft()` discrepancy** — change to `status='draft'` + `human_approved=false`
7. **Add `archiveDraft()` action** — simple status update to `'archived'`
8. **Download publisher** (`lib/autopilot/publish-download.ts`) — needs schema-dts
9. **Publish action** (`publishDraft()` in `actions.ts`) — needs download publisher, server-side HITL validation
10. **Edit action** (`editDraft()` in `actions.ts`) — needs scoring heuristic, 409 on approved drafts
11. **Draft detail view** (`app/dashboard/content-drafts/[id]/page.tsx`) — context panel, edit area, AEO breakdown, publish buttons
12. **Update ContentDraftCard.tsx** — add Publish dropdown + Archive button + disclaimer modal
13. **GBP publisher** (`lib/autopilot/publish-gbp.ts`) — needs OAuth token handling
14. **WordPress publisher** (`lib/autopilot/publish-wordpress.ts`) — needs integration credentials
15. **Post-publish measurement** (`lib/autopilot/post-publish.ts`) — needs Redis
16. **SOV cron integration** — wire occasion expiry + post-publish re-check
17. **Upgrade existing triggers** — replace bare-bones draft creation with `createDraft()` calls
18. **Full test suite** — unit + E2E

### Edge Cases & Hardening

1. **GBP 1500-char truncation.** GBP posts cap at 1500 characters. `publish-gbp.ts` must truncate `draftContent` cleanly — at sentence boundary, not mid-word. Add ellipsis. Test with content > 1500 chars.

2. **WordPress auth failure.** If the Application Password is revoked or the site is down, `publish-wordpress.ts` must catch the error, NOT update the draft status to 'published', and return a clear error message. Test with 401 and 500 responses.

3. **GBP token expiry mid-publish.** `google_oauth_tokens.expires_at` may have passed. Check before publishing, refresh via refresh_token if expired, retry once. If refresh also fails, return error. Never publish with a stale token.

4. **Concurrent draft creation race.** Two cron runs could try to create the same `trigger_id` draft simultaneously. The idempotency check (SELECT before INSERT) has a TOCTOU race. Add a UNIQUE partial index on `(trigger_id) WHERE trigger_id IS NOT NULL` to the `content_drafts` table to make the DB enforce idempotency. Catch the unique violation and return the existing draft.

5. **Manual drafts have no `trigger_id`.** Manual drafts set `trigger_id = null`, so the idempotency check must skip for manual drafts. The UNIQUE index must be partial (WHERE trigger_id IS NOT NULL).

6. **Occasion peak date across year boundary.** `TO_DATE(annual_date, 'MM-DD')` for New Year's Eve (12-31) on January 1st is "past" — but the occasion just happened. The expiry query should handle this by checking if the occasion is ≤ 7 days in the past (grace period) before archiving.

7. **AEO score null on existing drafts.** Some existing seed drafts have `aeo_score = NULL`. The edit flow's re-score should handle null gracefully — compute fresh score rather than trying to compare with null baseline.

8. **Empty `draftContent` after GPT-4o-mini call.** If the AI returns empty or malformed JSON, `createDraft()` must catch, log the error, and NOT insert a draft with empty content. Return null and let the next cron cycle retry.

9. **Post-publish re-check when Redis is unavailable.** If Upstash Redis is down, the scheduling should fail silently (log warning, skip). The draft still publishes successfully. The re-check is nice-to-have, not blocking.

10. **Publish target not configured.** User clicks "WordPress" publish but has no WordPress integration configured. `publishDraft()` must check `location_integrations` for the target platform before attempting. Return clear error: "WordPress not connected. Go to Settings → Integrations to connect."

### Migration Needed

Add a partial unique index for trigger_id idempotency:

```sql
-- 20260226000001_autopilot_trigger_idempotency.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_drafts_trigger_id_unique
ON public.content_drafts (trigger_id)
WHERE trigger_id IS NOT NULL;
```

This prevents duplicate drafts for the same trigger at the database level, eliminating the TOCTOU race in `createDraft()`.

### Reference Documents

- `docs/19-AUTOPILOT-ENGINE.md` — **Primary spec** (§2 triggers, §3 generation, §4 HITL, §5 publish, §6 measurement, §7 orchestration, §8 queue management)
- `docs/05-API-CONTRACT.md §13` — Content Draft API contracts (all endpoints)
- `docs/06-FRONTEND-UX-SPEC.md §9` — Draft review UI (list view, detail view, interactions)
- `docs/04-INTELLIGENCE-ENGINE.md §3.4` — Greed Engine → Autopilot trigger point
- `docs/04c-SOV-ENGINE.md §6` — First Mover Alert → draft creation
- `docs/16-OCCASION-ENGINE.md §4` — Occasion → draft creation
- `docs/15-LOCAL-PROMPT-INTELLIGENCE.md §3` — Prompt gap → draft creation
- `docs/17-CONTENT-GRADER.md` — AEO scoring methodology
- `docs/AI_RULES.md` — Project-wide coding conventions
