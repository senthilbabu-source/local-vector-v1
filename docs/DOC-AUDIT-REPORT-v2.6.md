# LocalVector.ai Documentation Audit Report
### Version: 1.0 | Date: February 23, 2026
### Scope: All 34 documents in docs.zip (v2.6 suite)
### AI_RULES.md and DEVLOG.md: Not included in zip — not available for this audit

---

## Executive Summary

All 34 documents were systematically reviewed for internal consistency, cross-document alignment, schema accuracy, and security completeness. **12 issues found** — 1 critical, 1 high-security, and 10 medium/low. All 12 have been fixed in the output files.

**No logical regressions were found.** The Phase 1–4 (Phases 0–3 + Listings) implementations are fully intact. All Phase 5–8 specs are internally consistent and properly wired to their migration files.

---

## Issues Found and Fixed

### 🔴 CRITICAL — 1 Issue

#### ISSUE-04: `location_integrations` table missing from `prod_schema.sql`
- **Files affected:** `prod_schema.sql`, `20260223000003_gbp_integration.sql`
- **Problem:** Migration `20260223000003_gbp_integration.sql` adds a FK column `locations.gbp_integration_id REFERENCES location_integrations(id)`. The `location_integrations` table was created in an earlier migration (`20260221000002`) but is NOT in `prod_schema.sql` v2.5. Running `prod_schema.sql` on a fresh database followed by migration 3 would fail with "relation does not exist."
- **Fix applied:** Added `location_integrations` DDL to `prod_schema.sql` (now v2.6), positioned after `listings`. DDL reconstructed from RFC Section 2.4 and usage patterns across Docs 10, 19, and the RFC. Columns: `id, org_id, location_id, integration_type, platform, status, external_id, credentials (JSONB), last_sync_at, error_details, created_at, updated_at`.

---

### 🟠 HIGH — 1 Issue

#### ISSUE-05: Missing `REVOKE ALL` security statements in migration 3
- **File:** `20260223000003_gbp_integration.sql`
- **Problem:** The RFC Security Checklist explicitly requires `REVOKE ALL ON [table] FROM authenticated; REVOKE ALL ON [table] FROM anon;` for both `google_oauth_tokens` and `pending_gbp_imports`. Migration 3 had REVOKE ALL for `google_oauth_tokens` but was missing it for `pending_gbp_imports`.
- **Fix applied:** Added `REVOKE ALL ON public.pending_gbp_imports FROM authenticated; REVOKE ALL ON public.pending_gbp_imports FROM anon;` after the RLS enable statement.

---

### 🟡 MEDIUM — 6 Issues

#### ISSUE-02: PlanGate content table missing `page_audits` row
- **File:** `06-FRONTEND-UX-SPEC.md` Section 13.1
- **Problem:** `page_audits` was in the TypeScript `featureId` union but had no copy entry in the PlanGate content table — modal would render with blank headline and body.
- **Fix applied:** Added row: `page_audits | "Audit Your Full Website" | "Starter includes 1 homepage audit/month. Upgrade to Growth for 10 full-site audits/month." | "Upgrade to Growth — $59/mo"`

#### ISSUE-03: `13_CORE_LOOP_V1.md` references hardcoded Visibility = 98
- **File:** `13_CORE_LOOP_V1.md` line 113
- **Problem:** "Visibility: hardcoded 98 (GBP connected baseline)" — this was explicitly removed in Doc 04 v2.4 and Doc 04c. This document hadn't been updated.
- **Fix applied:** Updated to: "Visibility: `null` on first load — renders 'Calculating...' skeleton until weekly SOV cron runs. Populated by SOV Engine (Doc 04c). **Never render a fallback number.**"

#### ISSUE-07: `00-INDEX.md` Coding Agents section missing prompts for Docs 15–19
- **File:** `00-INDEX.md`
- **Problem:** Agents building Phase 5–8 features had no INDEX-level prompt directing them to the relevant companion docs.
- **Fix applied:** Added 5 agent prompt entries (one per doc 15–19) with key implementation warnings (HITL guarantee, float display layer, seeding order, etc.)

#### ISSUE-09: `POST /pages/audits/run` missing monthly quota 429 response
- **File:** `05-API-CONTRACT.md` Section 14
- **Problem:** Endpoint spec showed 403 for page type restriction but no 429 for monthly quota — implementer could miss quota enforcement. Doc 17 specifies Starter=1/month, Growth=10/month, Agency=50/month.
- **Fix applied:** Added `429 Too Many Requests` response body with `audits_used`, `audits_limit`, `plan`, and `resets_at` fields, plus quota reference note pointing to Doc 17 Section 3.1.

#### ISSUE-11: `11-TESTING-STRATEGY.md` has no coverage for Phase 5–8 test specs
- **File:** `11-TESTING-STRATEGY.md`
- **Problem:** Testing strategy (v2.3) was never updated for Phase 5–8. The 8 new test files referenced in the build plan acceptance criteria had no spec doc.
- **Fix applied:** Added Section 10 (Phase 5–8 Test Coverage) — unit test table (6 files), E2E test table (2 files), and 4 critical test rules (SOV mock, visibility null state, HITL 403, no real OAuth tokens in tests). Bumped doc to v2.4.

#### ISSUE-12: Doc 04 DataHealth formula needs Phase 7 forward reference
- **File:** `04-INTELLIGENCE-ENGINE.md` Section 6
- **Problem:** DataHealth sub-formula in Doc 04 describes the current formula (listing sync % + schema completeness % + readability). Doc 18 defines a new formula for Phase 7. Unlike the Visibility component (which has a clear Doc 04c forward reference), DataHealth had no signal that it changes in Phase 7.
- **Fix applied:** Added forward reference note below DataHealth table row pointing to Doc 18 Section 3.3 and its Agent Rule.

---

### 🟢 LOW / MINOR — 4 Issues

#### ISSUE-01: Doc 04 Starter cost total understated
- **File:** `04-INTELLIGENCE-ENGINE.md` Section 7
- **Problem:** Total (Starter) showed ~$0.90/month but line items add to ~$1.40/month. Doc 10 correctly showed $1.40.
- **Fix applied:** Updated to ~$1.40 (Starter) and ~$3.69 (Growth) to match Doc 10 cost table.

#### ISSUE-06: `00-INDEX.md` still showed Docs 15–19 as "(planned)"
- **File:** `00-INDEX.md`
- **Problem:** All 5 companion docs are now written (v1.0) and included in the zip. Index still had "(planned)" suffix and version history entry said "planned."
- **Fix applied:** Removed "(planned)" from rows 15–19. Updated version history 2.6 entry to say "shipped (v1.0)."

#### ISSUE-08: Occasion seeding quantity mismatch between Doc 16 and Build Plan Phase 6
- **Files:** `16-OCCASION-ENGINE.md`, `09-BUILD-PLAN.md`
- **Problem:** Doc 16 said "Phase 6 minimum — 10 occasions." Build Plan Phase 6 said "20 highest-value occasions."
- **Fix applied:** Updated Doc 16 to "Phase 6 minimum — 20 occasions" with explicit list of all 20.

#### ISSUE-10: "Phase 19" naming collision between `04b` (DEVLOG phase) and `Doc 19` (Autopilot)
- **File:** `04b-MAGIC-MENU-BULK-AUDIT.md` Alignment Notice
- **Problem:** 04b uses "Phase 19" to mean an internal DEVLOG development phase for Magic Menu features. With Doc 19 Autopilot Engine now existing, readers could confuse the two.
- **Fix applied:** Added disambiguation note at top of Alignment Notice section clarifying that "Phase 19" in 04b = DEVLOG internal phase, NOT Doc 19 Autopilot Engine.

---

## No Action Required — Verified Consistent

The following potential concerns were investigated and found to be non-issues:

- **`prod_schema.sql` `business_info` table:** Correctly marked deprecated in Doc 02 — intentional legacy safety.
- **Landing page "98/100" social proof badge** (Doc 08): Marketing copy for LocalVector's own visibility score — intentional, not the dashboard hardcoded value that was removed.
- **`roadmap.md` phase numbering:** Uses original product vision numbering (Phase 7/8/9) which differs from build plan's Phase 0–8. Roadmap is an abstraction-level doc — intentional difference.
- **`sov_first_mover_alerts` DDL:** Minor difference between migration (ON DELETE SET NULL for location_id) and 04c spec (no cascade clause). Migration is authoritative — minor spec omission, no code impact.
- **`pending_gbp_imports` created in both RFC migration and migration 3:** Both use `CREATE TABLE IF NOT EXISTS` — safe deduplication, DDL schemas match.
- **`13_CORE_LOOP_V1.md` landing page "98/100":** This is Stage 1 marketing page copy (social proof), not the Reality Score dashboard — intentional and correct.

---

## Files Modified

| File | Issues Fixed | What Changed |
|------|-------------|-------------|
| `prod_schema.sql` | ISSUE-04 | Added `location_integrations` table DDL; bumped to v2.6 |
| `20260223000003_gbp_integration.sql` | ISSUE-05 | Added `REVOKE ALL` for `pending_gbp_imports` |
| `04-INTELLIGENCE-ENGINE.md` | ISSUE-01, ISSUE-12 | Fixed Starter cost total; added DataHealth Phase 7 forward reference |
| `06-FRONTEND-UX-SPEC.md` | ISSUE-02 | Added `page_audits` row to PlanGate content table |
| `13_CORE_LOOP_V1.md` | ISSUE-03 | Replaced hardcoded-98 reference with null/calculating state |
| `00-INDEX.md` | ISSUE-06, ISSUE-07 | Removed "(planned)" from Docs 15–19; added agent prompts for 15–19; updated v2.6 history |
| `16-OCCASION-ENGINE.md` | ISSUE-08 | Phase 6 seed count 10 → 20, added explicit occasion list |
| `05-API-CONTRACT.md` | ISSUE-09 | Added 429 quota exceeded response to `POST /pages/audits/run` |
| `11-TESTING-STRATEGY.md` | ISSUE-11 | Added Section 10: Phase 5–8 test specs; bumped to v2.4 |
| `04b-MAGIC-MENU-BULK-AUDIT.md` | ISSUE-10 | Added Phase 19 disambiguation note to Alignment Notice |

---

## Docs Confirmed Unchanged (No Issues Found)

`01-MARKET-POSITIONING.md`, `02-MULTI-TENANT-ARCHITECTURE.md`, `03-DATABASE-SCHEMA.md`, `04c-SOV-ENGINE.md`, `07-GO-TO-MARKET.md`, `08-LANDING-PAGE-AEO.md`, `09-BUILD-PLAN.md`, `10-OPERATIONAL-PLAYBOOK.md`, `14_TESTING_STRATEGY.md`, `15-LOCAL-PROMPT-INTELLIGENCE.md`, `17-CONTENT-GRADER.md`, `18-CITATION-INTELLIGENCE.md`, `19-AUTOPILOT-ENGINE.md`, `RFC_GBP_ONBOARDING_V2_REPLACEMENT.md`, `roadmap.md`, `20260223000001_sov_engine.sql`, `20260223000002_content_pipeline.sql`, all BACKUP files.
