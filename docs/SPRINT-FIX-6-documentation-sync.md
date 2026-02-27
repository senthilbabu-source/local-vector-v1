# Sprint FIX-6 — Documentation Sync: AI_RULES Tier 4/5 Stubs + CLAUDE.md Final State

> **Claude Code Prompt — Bulletproof Production Fix Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `MEMORY.md`
> **Prerequisites:** FIX-1 through FIX-5 complete. All critical, high, and medium issues resolved.

---

## 🎯 Objective

Bring the three AI context files — `AI_RULES.md`, `CLAUDE.md`, and `MEMORY.md` — into full alignment with the actual state of the codebase before Tier 4 work begins.

**[LOW-1.1]** `AI_RULES.md` has no §55–§61 stubs for Sprints 102–109. The Tier 4/5 master plan specifies that each sprint adds a corresponding AI_RULES section. Without stubs, the next engineer (or next Claude Code session) has no numbered anchor points to add rules into — creating a risk of numbering collisions and lost architectural context.

**[LOW-1.2]** `CLAUDE.md` still reflects Tier 1–3 as "in progress." It must be updated to reflect the true current state: Tiers 1–3 complete through Sprint 101, FIX-1 through FIX-5 applied, Tier 4 gated on external API approvals, and Tier 5 gated on live data accumulation.

**Why this matters:** Every new Claude Code session reads `AI_RULES.md` and `CLAUDE.md` as its primary context. If these files say the project is at Sprint 89 or that `database.types.ts` needs regeneration, the next AI session will make decisions based on stale reality. This sprint makes the context files the single source of truth.

**What is stale today:**
- `AI_RULES.md` ends at §54 (or wherever the last sprint left it). §55–§61 do not exist — not even as placeholders.
- `CLAUDE.md` sprint completion record doesn't mention FIX-1 through FIX-5. It may still list database.types.ts regeneration as a TODO.
- `MEMORY.md` may not have a decision record for the production readiness fixes and the Tier 4 gate conditions.
- `DEVLOG.md` may be missing entries for FIX-1 through FIX-5 if those were added during fast-paced fix sessions.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing a single line, read all of these files completely. This sprint is about accurate representation of reality — you cannot write accurate documentation without reading what currently exists.

```
Read docs/AI_RULES.md                                 — Read every existing section. Find the last numbered rule. Confirm what §§ exist.
Read CLAUDE.md                                        — Read entire file. Note last sprint listed, any open TODOs, Tier status.
Read MEMORY.md                                        — Read all decision records. Note what is missing.
Read DEVLOG.md                                        — Read the last 20 entries. Confirm FIX-1 through FIX-5 have entries.
Read docs/roadmap.md (if it exists)                   — Current roadmap status for Tier 4/5 features.
Read docs/09-BUILD-PLAN.md (if it exists)             — Sprint checklist — confirm Sprints 1-101 are marked complete.
Read docs/LocalVector-Master-Intelligence-Platform-Strategy.md — Tier 4/5 plan details (Sprint 102-109 specs).
```

**Run this pre-implementation diagnosis:**

```bash
# 1. Find the last numbered rule in AI_RULES.md
grep -E "^## §[0-9]+" docs/AI_RULES.md | tail -5
# Note the last section number — stubs will follow sequentially from there

# 2. Check if FIX-1 through FIX-5 rules already exist in AI_RULES.md
grep -E "§5[5-9]|§6[0-9]" docs/AI_RULES.md
# Note: FIX-1 through FIX-5 each appended a rule (§55-§59). Confirm which exist.

# 3. Find last sprint entry in CLAUDE.md
grep -E "Sprint [0-9]+" CLAUDE.md | tail -10
# Note the last sprint number mentioned

# 4. Confirm FIX sprints are or aren't in CLAUDE.md
grep -i "FIX-1\|FIX-2\|FIX-3\|FIX-4\|FIX-5" CLAUDE.md
# If no output: all FIX sprints need to be added to CLAUDE.md

# 5. Check MEMORY.md for production readiness decision record
grep -i "production readiness\|tier 4\|FIX-1\|audit" MEMORY.md
# Note what's missing

# 6. Check DEVLOG.md for FIX sprint entries
grep -i "FIX-1\|FIX-2\|FIX-3\|FIX-4\|FIX-5\|schema types\|memberships RLS\|cron registration" DEVLOG.md
# Confirm which FIX sprints have DEVLOG entries

# 7. Check what the Tier 4/5 sprint numbers are
grep -E "Sprint 10[2-9]" docs/LocalVector-Master-Intelligence-Platform-Strategy.md | head -10
# Confirm: 102=Apple BC, 103=Bing Places, 104=FAQ, 105=Reviews, 106=RAG, 107=Competitor, 108=Playbooks, 109=Intent

# 8. Check the current §55-§59 situation (added by FIX-1 through FIX-5)
grep -n "^## §5[5-9]" docs/AI_RULES.md
# This tells you which rule numbers are already taken by FIX sprints
# Tier 4/5 stubs must start AFTER these
```

---

## 🏗️ Architecture — What to Build

### Part A: AI_RULES.md — Tier 4/5 Sprint Stubs

#### Step 1: Determine the correct starting §number

FIX-1 through FIX-5 each appended a rule to `AI_RULES.md` (§55, §56, §57, §58, §59 respectively — confirm exact numbers from the grep above). The Tier 4/5 stubs must start at the next available number.

**If FIX-1 through FIX-5 added §55–§59:** Tier 4/5 stubs are §60–§67 (one per sprint, Sprints 102–109).
**If some FIX rules were not added:** Adjust accordingly based on grep output. The important thing is the stubs are clearly labeled with their sprint number and are in sequential §order.

#### Step 2: Add Tier 4/5 stubs to `AI_RULES.md`

Append the following to the end of `AI_RULES.md`. Replace `§6X` with the actual next sequential number from your diagnosis.

```markdown
---

## §60. 🍎 Apple Business Connect Sync — Sprint 102 (PLACEHOLDER — NOT YET EXECUTED)

> **Status:** Awaiting Apple Business Connect API approval. Do not implement until API access is confirmed.
> **Gate condition:** Apple Business Connect API credentials approved and accessible.

Sprint 102 will sync business profile data from Apple Business Connect (ABC) into LocalVector's `locations` table via a new `abc_connections` table and `/api/cron/abc-sync` route. Rules will be defined when the sprint executes.

**Pre-sprint requirements:**
- Submit Apple Business Connect API access request at https://developer.apple.com/business-connect/ (if not yet done)
- Confirm API response schema before designing the data mapper
- Follow the GBP data mapper pattern from `lib/gbp/gbp-data-mapper.ts` (AI_RULES §41) for the ABC mapper

**Provisional rule (update when sprint executes):**
- All Apple Business Connect data transformation must be centralized in `lib/abc/abc-data-mapper.ts` — never inline in route handlers.

---

## §61. 🔷 Bing Places Sync — Sprint 103 (PLACEHOLDER — NOT YET EXECUTED)

> **Status:** Awaiting Bing Places Partner API approval. Do not implement until API access is confirmed.
> **Gate condition:** Bing Places Partner API credentials approved and accessible.

Sprint 103 will sync business data from Bing Places for Business into LocalVector via a new `bing_connections` table and `/api/cron/bing-sync` route.

**Pre-sprint requirements:**
- Apply for Bing Places Partner API at https://bingplaces.com (if not yet done)
- Confirm Bing Places API authentication method (OAuth vs API key) before designing the connection flow
- Follow the same OAuth + cron pattern established by GBP (Sprints 57B, 89, 90)

**Provisional rule (update when sprint executes):**
- All Bing Places data transformation must be centralized in `lib/bing/bing-data-mapper.ts`.

---

## §62. 🤖 Dynamic FAQ Auto-Generation — Sprint 104 (PLACEHOLDER — NOT YET EXECUTED)

> **Status:** No external dependencies. Can execute immediately after FIX-1 through FIX-5 are complete.
> **Gate condition:** None — this sprint is ready to run.

Sprint 104 will auto-generate FAQ schema markup (`FAQPage` JSON-LD) from a business's location data, GBP Q&A, and AI analysis. Output is injected into the location's public page and AEO schema layer.

**Pre-sprint requirements:**
- Read `lib/aeo/schema-generator.ts` (Sprint 85) before designing FAQ generation — reuse the schema builder pattern
- Read `app/api/aeo/` routes to understand how generated schema is served
- FAQ content generated via Claude (Anthropic API) — use `lib/ai/providers.ts` pattern

**Provisional rules (update when sprint executes):**
- FAQ generation must be idempotent — running twice produces the same output for the same input data.
- Generated FAQ items must be stored in `locations.faq_data` (jsonb) — not hard-coded in schema templates.
- Maximum 10 FAQ items per location — truncate, do not error, if AI returns more.

---

## §63. 💬 Review Response Engine — Sprint 105 (PLACEHOLDER — NOT YET EXECUTED)

> **Status:** Requires 3–5 active Agency customers with live review data before meaningful testing.
> **Gate condition:** At least 3 Agency-tier customers actively using LocalVector with GBP reviews flowing in.

Sprint 105 will generate AI-drafted responses to Google Business Profile reviews, surfaced in a new "Reviews" dashboard section. Responses are drafts only — the business owner approves before publishing.

**Pre-sprint requirements:**
- Confirm GBP Reviews API access is available under existing OAuth scopes (check Sprint 57B scopes)
- If reviews scope is missing, re-authorization flow must be designed before implementing Sprint 105
- Design the review response queue UI as a separate dashboard section — do not embed in existing GBP import UI

**Provisional rules (update when sprint executes):**
- Review responses are ALWAYS drafts — never auto-publish without explicit user approval.
- Response generation must respect the `STOP_AUDIT_CRON` / kill-switch pattern for cost control.
- Store draft responses in a new `review_responses` table — never mutate the source review data.

---

## §64. 🧠 RAG Chatbot Widget — Sprint 106 (PLACEHOLDER — NOT YET EXECUTED)

> **Status:** Requires 80%+ complete menu/product data for at least one location before meaningful testing.
> **Gate condition:** Golden tenant (Charcoal N Chill) has complete menu data in `magic_menu` table.

Sprint 106 will embed a RAG-powered chatbot widget on the public-facing location page (`/[slug]`). The chatbot answers customer questions using the location's menu, hours, amenities, and FAQ data as its knowledge base.

**Pre-sprint requirements:**
- Verify `magic_menu` data quality for Charcoal N Chill — run `SELECT COUNT(*) FROM magic_menu WHERE org_id = 'a0eebc99-...'`
- Read `lib/ai/providers.ts` for Anthropic client setup — the RAG widget uses the same client
- Read `app/[slug]/page.tsx` to understand the public page structure before adding the widget

**Provisional rules (update when sprint executes):**
- The chatbot widget is a `'use client'` component with a floating button — it must not block LCP on initial page load (lazy load with dynamic import).
- RAG retrieval is server-side only — never expose raw menu data or embedding vectors to the client.
- Widget must degrade gracefully when AI is unavailable — show a static "Contact us" fallback.

---

## §65. 🎯 Competitor Prompt Hijacking — Sprint 107 (PLACEHOLDER — NOT YET EXECUTED)

> **Status:** Requires 4–8 weeks of SOV (Share of Voice) baseline data.
> **Gate condition:** `/api/cron/sov` has been running in production for at least 4 weeks (confirmed by `cron_run_log` entries).
> **Clock started:** When `vercel.json` was updated in FIX-3 to register `/api/cron/sov`.

Sprint 107 will analyze SOV data to identify competitor prompts where a business could outrank current AI citations, and generate targeted content briefs to capture those positions.

**Pre-sprint requirements:**
- Query `cron_run_log` to confirm SOV cron has at least 4 weeks of data: `SELECT COUNT(*), MIN(ran_at), MAX(ran_at) FROM cron_run_log WHERE route = '/api/cron/sov'`
- Read all existing SOV data in `sov_snapshots` table to understand data shape before designing analysis
- Do NOT start Sprint 107 if SOV data is less than 4 weeks old — the baseline will be statistically unreliable

**Provisional rules (update when sprint executes):**
- Competitor analysis uses only data already stored in `sov_snapshots` — never triggers new live AI queries for this feature.
- Content briefs are stored in `content_briefs` table (new) — not in the SOV snapshot records.

---

## §66. 📊 Per-Engine AI Playbooks — Sprint 108 (PLACEHOLDER — NOT YET EXECUTED)

> **Status:** Requires 8 weeks of multi-engine SOV data (Perplexity, GPT-4o, Gemini, Copilot).
> **Gate condition:** `/api/cron/sov` has been running for at least 8 weeks with all 4 engines active.

Sprint 108 will generate per-AI-engine optimization playbooks — specific guidance on how to optimize content for each engine's citation patterns based on historical SOV data.

**Pre-sprint requirements:**
- Confirm all 4 SOV engines (Perplexity, GPT-4o, Gemini, Copilot) are returning data in `sov_snapshots`
- Check for engines with data gaps (API failures, rate limits) before building playbooks on incomplete data
- Read `lib/sov/sov-engine.ts` to understand how engine data is tagged before designing playbook grouping

**Provisional rules (update when sprint executes):**
- Playbooks are per-engine AND per-business-category — a hookah lounge playbook differs from a dentist playbook.
- Playbook generation must be re-runnable — new data should update playbooks, not create duplicates.

---

## §67. 🔍 Intent Discovery Engine — Sprint 109 (PLACEHOLDER — NOT YET EXECUTED)

> **Status:** Requires 8 weeks of Perplexity query history data.
> **Gate condition:** Perplexity SOV engine has been running for at least 8 weeks and `sov_snapshots` contains `raw_query` data from Perplexity responses.

Sprint 109 will mine Perplexity's query data to discover the actual natural-language questions users ask when finding local businesses — creating an "intent map" that drives content strategy.

**Pre-sprint requirements:**
- Verify `sov_snapshots.raw_query` is being populated by the Perplexity engine (not just the citation result)
- If `raw_query` is not stored: Sprint 109 cannot proceed until the SOV cron is updated to capture it — this is a pre-sprint data pipeline fix
- Read Perplexity API documentation to confirm query extraction is available in the response format

**Provisional rules (update when sprint executes):**
- Intent discovery runs as a monthly batch job — not per request.
- Query clustering uses a deterministic algorithm (not pure LLM) to ensure reproducible intent groups.
- Intent maps are stored in a new `intent_clusters` table — never overwrite raw query data.
```

---

### Part B: CLAUDE.md — Sprint Completion State Update

#### Step 1: Find the sprint completion section

```bash
grep -n "Sprint\|Tier\|completion\|inventory" CLAUDE.md | head -30
# Find the implementation inventory section and the sprint status section
```

#### Step 2: Update the sprint completion record

Find the section that lists completed sprints. It likely ends around Sprint 93 or Sprint 101. Update it to reflect the full completion state:

Add after the last Sprint 101 entry:

```markdown
### Production Readiness Fixes (February 2026)

> **Context:** A full production readiness audit was completed on 2026-02-27 identifying 10 issues
> (3 critical, 3 high, 3 medium, 1 low). All issues were resolved in FIX-1 through FIX-6
> before any production traffic or customer onboarding.

#### Sprint FIX-1 — Schema Types Regeneration ([DATE])
- `lib/supabase/database.types.ts` — Regenerated. Sprint 99-101 tables/columns now typed (seat_limit, location_permissions, occasion_snoozes, sidebar_badge_state).
- `supabase/prod_schema.sql` — Regenerated. Aligned with all migrations through Sprint 101.
- Removed `(supabase as any)` casts from `occasion-feed.ts`, `badge-counts.ts`, `occasions.ts`.
- Tests: `database-types-completeness.test.ts` (12 tests)
- Result: `npx tsc --noEmit` = 0 errors (was 41)

#### Sprint FIX-2 — Security Hardening ([DATE])
- npm audit fix: `@modelcontextprotocol/sdk`, `minimatch`, `rollup` — 0 HIGH vulnerabilities remaining.
- `supabase/migrations/20260303000001_memberships_rls.sql` — ENABLE RLS + 4 org isolation policies on `memberships` table.
- `supabase/prod_schema.sql` — Updated with memberships RLS.
- Tests: `memberships-rls.test.ts` (12 tests), `npm-audit.test.ts` (3 tests)

#### Sprint FIX-3 — Critical Runtime Fixes ([DATE])
- `vercel.json` — Added 4 missing cron registrations: `/api/cron/audit`, `/api/cron/sov`, `/api/cron/citation`, `/api/cron/content-audit`.
- `app/dashboard/settings/locations/page.tsx` — Fixed PlanGate default import → named import `{ PlanGate }`.
- Tests: `vercel-cron-config.test.ts` (7 tests), `plan-gate-imports.test.ts` (4 tests)
- **SOV baseline clock started:** `/api/cron/sov` now fires weekly. Sprints 107-109 require 4-8 weeks of this data.

#### Sprint FIX-4 — Operational Hardening ([DATE])
- `.env.local.example` — Added 13 missing environment variables (CRON_SECRET, Google OAuth, kill switches, AI API keys).
- `app/api/chat/route.ts` — Added Upstash Redis rate limiting (20 requests/hour/org).
- Tests: `env-completeness.test.ts` (13 tests), `chat-rate-limiting.test.ts` (9 tests)

#### Sprint FIX-5 — E2E Test Coverage Sprints 98-101 ([DATE])
- `src/__tests__/e2e/multi-user-invitations.spec.ts` — 12 Playwright tests (Sprint 98)
- `src/__tests__/e2e/seat-billing.spec.ts` — 12 Playwright tests (Sprint 99)
- `src/__tests__/e2e/multi-location-management.spec.ts` — 14 Playwright tests (Sprint 100, includes PlanGate regression guard)
- `src/__tests__/e2e/occasion-alerts-badges.spec.ts` — 14 Playwright tests (Sprint 101)
- Total: 52 new Playwright tests. Full E2E coverage: ~75 tests.

#### Sprint FIX-6 — Documentation Sync ([DATE])
- `AI_RULES.md` — §60–§67 stubs added for Tier 4/5 sprints (102-109). Each stub documents gate conditions and provisional rules.
- `CLAUDE.md` — This update. Sprint completion state accurate through FIX-6.
- `MEMORY.md` — Production readiness decision record added.
```

#### Step 3: Update the Tier status section

Find the section in `CLAUDE.md` that describes Tier status. Update it to:

```markdown
## Tier Completion Status

| Tier | Sprints | Status | Gate |
|------|---------|--------|------|
| Tier 1 | 1–30 | ✅ Complete | — |
| Tier 2 | 31–70 | ✅ Complete | — |
| Tier 3 | 71–101 | ✅ Complete | — |
| Production Fixes | FIX-1 – FIX-6 | ✅ Complete | — |
| Tier 4 | 102–106 | ⏳ Gated | Sprint 102: Apple BC API approval. Sprint 103: Bing Places API approval. Sprints 104–106: No external gate — ready to execute. |
| Tier 5 | 107–109 | ⏳ Gated | 4–8 weeks of SOV baseline data required. Clock started [DATE of FIX-3]. Earliest start: [DATE + 4 weeks]. |

### Next Sprint Ready to Execute: Sprint 104 — Dynamic FAQ Auto-Generation
No external dependencies. Can begin immediately.

### Sprints Pending External Approval:
- Sprint 102 (Apple Business Connect): Submit API request at https://developer.apple.com/business-connect/
- Sprint 103 (Bing Places): Submit API request at https://bingplaces.com

### Sprints Pending Data Accumulation:
- Sprint 107 (Competitor Prompt Hijacking): Needs 4+ weeks SOV data. Earliest: [FIX-3 date + 4 weeks].
- Sprint 108 (Per-Engine Playbooks): Needs 8+ weeks SOV data. Earliest: [FIX-3 date + 8 weeks].
- Sprint 109 (Intent Discovery): Needs 8+ weeks Perplexity query data. Earliest: [FIX-3 date + 8 weeks].
```

---

### Part C: MEMORY.md — Production Readiness Decision Record

Add the following decision record to `MEMORY.md`:

```markdown
## Decision: Production Readiness Audit + Fix Series (FIX-1 through FIX-6 — February 2026)

**Context:** A full production readiness audit was performed on 2026-02-27 before any customer onboarding. 10 issues were identified (3 critical, 3 high, 3 medium, 1 low). All were resolved before production traffic.

**Critical decisions made:**

1. **Types regeneration over hand-editing (FIX-1):** When database.types.ts was stale (41 TS errors), we regenerated via Supabase CLI rather than hand-editing. Hand-editing types is brittle and error-prone. Regeneration is the only acceptable method going forward.

2. **memberships RLS was missing — not intentional (FIX-2):** The memberships table was not protected by RLS. This was an oversight in the initial schema, not an intentional design decision. All tables with org_id must have RLS.

3. **vercel.json cron gap lost irreplaceable baseline time (FIX-3):** The SOV, audit, citation, and content-audit crons were never registered. Every day before FIX-3 was a day of irreplaceable SOV baseline data lost. Sprints 107-109 require this data. Fix was deployed on [FIX-3 date] — this is the SOV clock start date.

4. **Sprint 104 is the first Tier 4 sprint to execute:** No external dependencies. Apple BC (Sprint 102) and Bing Places (Sprint 103) are gated on API approvals that may take weeks. Sprint 104 (Dynamic FAQ Auto-Generation) can and should proceed immediately.

5. **Tier 5 earliest start date:** With SOV cron now running, the absolute earliest Tier 5 can begin is [FIX-3 date + 4 weeks] for Sprint 107, and [FIX-3 date + 8 weeks] for Sprints 108–109.

6. **E2E test-first commitment (FIX-5):** Sprints 98-101 shipped without E2E coverage — this must not happen again. AI_RULES §57 now requires E2E tests for every sprint with user-facing features, written alongside the feature code.
```

---

### Part D: DEVLOG.md — Backfill Any Missing FIX Sprint Entries

Check if FIX-1 through FIX-5 have DEVLOG entries:

```bash
grep -c "FIX-[1-5]" DEVLOG.md
# Expected: 5 (one per fix sprint)
# If fewer than 5: backfill the missing entries
```

For any missing FIX sprint entry, add a DEVLOG record using the format from each sprint's `📓 DEVLOG Entry Format` section. Use today's date if the original date is unknown. The minimum required fields are: Date, Sprint name, Problem, Solution, Tests added, Result.

---

## 🧪 Testing

This sprint has no new code, no new migrations, and no new test files. The verification is entirely manual review.

### Verification Checklist (run these commands to confirm accuracy)

```bash
# 1. AI_RULES stubs exist and are in sequence
grep -E "^## §[0-9]+" docs/AI_RULES.md | tail -12
# Must show sequential §numbers ending at §67 (or adjusted number)
# Must show Sprint 102 through Sprint 109 labels

# 2. No duplicate §numbers
grep -oE "§[0-9]+" docs/AI_RULES.md | sort | uniq -d
# Expected: no output (no duplicates)

# 3. All 8 Tier 4/5 sprints have stubs
for sprint in 102 103 104 105 106 107 108 109; do
  echo -n "Sprint $sprint stub: "
  grep -c "Sprint $sprint" docs/AI_RULES.md
done
# Each must output 1 (exactly one stub per sprint)

# 4. CLAUDE.md shows FIX-1 through FIX-6
for fix in FIX-1 FIX-2 FIX-3 FIX-4 FIX-5 FIX-6; do
  echo -n "$fix in CLAUDE.md: "
  grep -c "$fix" CLAUDE.md
done
# Each must output at least 1

# 5. Tier status table is in CLAUDE.md
grep -A20 "Tier Completion Status" CLAUDE.md | head -20
# Must show Tiers 1-3 as Complete, Tier 4 as Gated, Tier 5 as Gated

# 6. MEMORY.md has production readiness record
grep -c "Production Readiness Audit" MEMORY.md
# Must output 1

# 7. DEVLOG.md has all FIX sprint entries
for fix in FIX-1 FIX-2 FIX-3 FIX-4 FIX-5; do
  echo -n "$fix in DEVLOG: "
  grep -c "$fix" DEVLOG.md
done
# Each must output at least 1

# 8. Full test suite still passes (no code was changed, but confirm)
npx vitest run 2>&1 | tail -3
npx playwright test 2>&1 | tail -3
npx tsc --noEmit 2>&1 | wc -l
# tsc: 0 errors
# vitest: all passing
# playwright: all passing
```

---

## 📂 Files to Modify

| # | File | Action | What Changes |
|---|------|--------|-------------|
| 1 | `docs/AI_RULES.md` | **APPEND** | §60–§67 Tier 4/5 sprint stubs |
| 2 | `CLAUDE.md` | **MODIFY** | FIX-1 through FIX-6 in inventory; Tier completion status table; next sprint guidance |
| 3 | `MEMORY.md` | **APPEND** | Production readiness decision record |
| 4 | `DEVLOG.md` | **BACKFILL** | Add any missing FIX-1 through FIX-5 entries |

**No code files. No migrations. No test files. Documentation only.**

---

## 🚫 What NOT to Do

1. **DO NOT renumber existing §rules** — only append at the end. Renumbering breaks every cross-reference in DEVLOG, CLAUDE.md, and MEMORY.md that cites rule numbers.
2. **DO NOT add implementation code to the stubs** — stubs are placeholders only. Actual rules are written when the sprint executes. Premature rules based on guesses create false constraints.
3. **DO NOT mark Sprint 102 or 103 as ready** — they are genuinely gated on external API approvals. Do not change their status to "ready" as optimism.
4. **DO NOT delete or archive old DEVLOG entries** — DEVLOG is append-only (AI_RULES §13.2). Never delete entries, even for sprints that were reworked.
5. **DO NOT change the SOV clock start date** — it is the date FIX-3 was committed. Do not backdate it.
6. **DO NOT add §numbers that are already taken by FIX-1 through FIX-5 rules** — check the grep output from the pre-flight diagnosis before writing stubs.
7. **DO NOT update `docs/roadmap.md` to show Tier 4/5 as complete** — they are not. Only update the files listed in the Files to Modify table.
8. **DO NOT run `supabase db reset`** — this is a documentation sprint. No database operations.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `docs/AI_RULES.md` — §60–§67 stubs present (or adjusted §numbers — no gaps, no duplicates)
- [ ] Each stub has: status line, gate condition, pre-sprint requirements, at least one provisional rule
- [ ] `CLAUDE.md` — FIX-1 through FIX-6 listed in implementation inventory
- [ ] `CLAUDE.md` — Tier completion status table present and accurate
- [ ] `CLAUDE.md` — "Next Sprint Ready to Execute: Sprint 104" clearly stated
- [ ] `CLAUDE.md` — SOV clock start date recorded (date of FIX-3 commit)
- [ ] `MEMORY.md` — Production readiness decision record appended
- [ ] `DEVLOG.md` — All FIX-1 through FIX-5 entries present (backfilled if missing)
- [ ] Verification checklist commands all pass (no duplicate §numbers, all sprints covered)
- [ ] `npx tsc --noEmit` — 0 errors (unchanged from FIX-1)
- [ ] `npx vitest run` — all tests passing (unchanged from FIX-5)
- [ ] `npx playwright test` — all tests passing (unchanged from FIX-5)
- [ ] DEVLOG.md entry for FIX-6 itself written

---

## 📓 DEVLOG Entry

```markdown
## [DATE] — Sprint FIX-6: Documentation Sync — AI_RULES Tier 4/5 Stubs + CLAUDE.md Final State (Completed)

**Goal:** Bring AI_RULES.md, CLAUDE.md, and MEMORY.md into full alignment with actual project state before Tier 4 work begins.

**Changes:**
- `docs/AI_RULES.md` — Appended §60–§67: Tier 4/5 sprint stubs for Sprints 102-109. Each stub documents: execution status, gate condition, pre-sprint requirements, and provisional rules.
- `CLAUDE.md` — Updated implementation inventory with FIX-1 through FIX-6. Added Tier Completion Status table. Documented SOV clock start date. Identified Sprint 104 as the first immediately-executable Tier 4 sprint.
- `MEMORY.md` — Added production readiness decision record: 6 key architectural decisions from the fix series.
- `DEVLOG.md` — Backfilled [N] missing FIX sprint entries.

**No code changes. No migrations. No new tests.**

**Result:** AI context files are now accurate. Next Claude Code session will correctly understand:
- Tiers 1-3 are complete through Sprint 101
- FIX-1 through FIX-6 resolved all production readiness issues
- Sprint 104 is ready to execute immediately
- Sprint 102/103 are waiting on API approvals
- Sprints 107-109 need 4-8 weeks of SOV data from the clock that started with FIX-3

**Production readiness status: READY** (all 10 audit issues resolved)
```

---

## 📚 Git Commit

```bash
git add docs/AI_RULES.md CLAUDE.md MEMORY.md DEVLOG.md
git status  # Verify: only the 4 documentation files

git commit -m "FIX-6: Documentation sync — AI_RULES Tier 4/5 stubs + CLAUDE.md final state

- AI_RULES.md: §60-§67 stubs for Sprints 102-109 (Tier 4/5)
  each stub: status, gate condition, pre-sprint requirements, provisional rules
- CLAUDE.md: FIX-1 through FIX-6 in inventory; Tier completion table;
  Sprint 104 identified as first immediately-executable Tier 4 sprint;
  SOV clock start date recorded
- MEMORY.md: production readiness decision record (6 architectural decisions)
- DEVLOG.md: backfilled any missing FIX sprint entries

No code changes. No migrations. No new tests.
All existing tests still passing.

PRODUCTION READINESS STATUS: ALL 10 AUDIT ISSUES RESOLVED
Tiers 1-3 complete. FIX-1 through FIX-6 applied.
Next: Sprint 104 (Dynamic FAQ Auto-Generation) — no external dependencies."

git push origin main
```

---

## 🏁 Sprint Outcome + Full Fix Series Sign-Off

After FIX-6 completes, the LocalVector V1 production readiness audit is fully resolved.

### Complete Fix Series Summary

| Sprint | Issue Resolved | Severity | Key Outcome |
|--------|---------------|----------|-------------|
| FIX-1 | Schema types regen + prod_schema sync | 🔴 Critical | 41 TS errors → 0 |
| FIX-2 | npm vulns + memberships RLS | 🟠 High | 3 HIGH vulns → 0; memberships protected |
| FIX-3 | 4 missing crons + PlanGate crash | 🔴 Critical | SOV clock started; locations page working |
| FIX-4 | 13 env vars documented + /api/chat rate limit | 🟠 High | No silent deploy failures; AI cost protected |
| FIX-5 | 52 E2E tests for Sprints 98-101 | 🟡 Medium | 75 total Playwright tests protecting platform |
| FIX-6 | AI_RULES stubs + CLAUDE.md sync | 🟢 Low | AI context accurate; Tier 4 clear to launch |

### What's Next

**Immediately executable:** Sprint 104 — Dynamic FAQ Auto-Generation. No API approvals. No data waiting period. Start now.

**Submit today (if not done):**
- Apple Business Connect API request → unblocks Sprint 102
- Bing Places Partner API request → unblocks Sprint 103

**Calendar reminders to set:**
- [FIX-3 date + 4 weeks]: Check `cron_run_log` — if SOV has 4 weeks of data, Sprint 107 is unblocked
- [FIX-3 date + 8 weeks]: Check `cron_run_log` — if SOV has 8 weeks of data, Sprints 108 and 109 are unblocked
