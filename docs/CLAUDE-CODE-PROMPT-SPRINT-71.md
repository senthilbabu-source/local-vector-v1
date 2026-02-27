# Claude Code Prompt — Sprint 71: Per-Dimension Page Audit Scores + Actionable Fix Recommendations

## ⚠️ READ BEFORE ANYTHING ELSE

Read these files in order BEFORE writing any code:
1. `docs/AI_RULES.md` — all 38 rules. Critical for this sprint:
   - §1 (schema source of truth = `prod_schema.sql`)
   - §3 (RLS, `getSafeAuthContext()`, belt-and-suspenders `.eq('org_id', orgId)`)
   - §4 (tests first, golden tenant fixtures, mocking)
   - §5 (no API calls on page load)
   - §6 (Next.js 16 App Router, Tailwind v4, shadcn)
   - §12 (Tailwind literal classes — no dynamic concatenation)
   - §13 (DEVLOG format, verified test counts)
   - §18 (`createClient()` for pages)
   - §20 (never hardcode placeholder metrics — propagate null)
   - §25 (`'use server'` files — all exports must be async)
   - §34 (Page Audit dashboard patterns — this IS the page audit section)
   - §38 (database.types.ts, no `as any` on Supabase)
2. `docs/DESIGN-SYSTEM.md` — color tokens, score thresholds (green ≥80, amber ≥50, red <50)
3. `supabase/prod_schema.sql` — `page_audits` table (search for `CREATE TABLE.*page_audits`)
4. `lib/supabase/database.types.ts` — `page_audits` Row/Insert/Update types
5. `lib/page-audit/auditor.ts` — **READ THE ENTIRE FILE.** Contains all 5 scoring functions + `buildRecommendations()` + `PageAuditResult` interface. This is the scoring engine.
6. `app/dashboard/page-audits/page.tsx` — **READ FULLY.** The current page has 2 bugs: `faqSchemaScore={0}` and `entityClarityScore={0}` are hardcoded.
7. `app/dashboard/page-audits/_components/PageAuditCard.tsx` — Current card shows dimension bars but receives hardcoded zeros.
8. `app/dashboard/page-audits/_components/DimensionBar.tsx` — Existing reusable score bar.
9. `app/dashboard/page-audits/actions.ts` — `reauditPage()` server action. Note: it upserts `aeo_readability_score` but NOT `faq_schema_score` or `entity_clarity_score`.
10. `src/__fixtures__/golden-tenant.ts` — golden tenant data

---

## What This Sprint Does

Sprint 71 has **3 deliverables** that transform the Page Audit dashboard from a passive scorecard into an actionable fix machine:

### Problem 1 (🔴 BUG): Two Dimension Scores Are Always Zero

**The bug:** `app/dashboard/page-audits/page.tsx` line ~170 passes hardcoded zeros:

```typescript
faqSchemaScore={0}                                   // ← ALWAYS ZERO
keywordDensityScore={audit.aeo_readability_score ?? 0}
entityClarityScore={0}                                // ← ALWAYS ZERO
```

**Root cause:** The `page_audits` table only stores 3 individual dimension columns (`answer_first_score`, `schema_completeness_score`, `aeo_readability_score`), plus `faq_schema_present` (boolean). The auditor (`auditor.ts`) computes 5 dimension scores but only 3 are persisted — `faqSchemaScore` and `entityClarityScore` are lost after audit.

**Fix:** Add 2 missing columns to `page_audits` via migration: `faq_schema_score INTEGER` and `entity_clarity_score INTEGER`. Update the `reauditPage()` action and audit cron to write all 5 scores.

### Problem 2: Recommendations Are Generic, Not Actionable

**Current state:** Recommendations say things like "Add a `<script>` block with correct `@type`" — helpful, but the user doesn't know WHAT to add. Sprint 70 built schema generators.

**Fix:** Enhance `buildRecommendations()` to include a `schemaType` field when the fix is "add schema." The UI can then link directly to the schema generator (Sprint 70) with one click. Also add per-dimension "quick fix" recommendations that are specific to the actual score.

### Problem 3: No Per-Dimension Drill-Down

**Current state:** DimensionBar shows a label, weight, and score — but no explanation of WHAT that dimension measures or WHY it scored low.

**Fix:** Add expandable detail sections to each dimension bar that explain the score and list specific actions.

---

## Architecture Overview

```
Sprint 71 — Per-Dimension Scores + Actionable Fixes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MIGRATION (Add missing columns):
├── supabase/migrations/20260227000001_page_audit_dimensions.sql
│   └── ALTER TABLE page_audits ADD faq_schema_score INTEGER, entity_clarity_score INTEGER

DATABASE TYPES UPDATE:
├── lib/supabase/database.types.ts — Add new columns to page_audits Row/Insert/Update

AUDITOR UPDATE:
├── lib/page-audit/auditor.ts
│   └── buildRecommendations() — add schemaType + dimensionKey fields

ACTION UPDATE:
├── app/dashboard/page-audits/actions.ts
│   └── reauditPage() — write all 5 dimension scores to DB

PAGE UPDATE:
├── app/dashboard/page-audits/page.tsx
│   └── Read new columns, pass real scores (no more hardcoded zeros)

COMPONENT UPDATES:
├── app/dashboard/page-audits/_components/
│   ├── DimensionBar.tsx      — MODIFY: add expandable detail section
│   ├── DimensionDetail.tsx   — NEW: per-dimension explanation + actions
│   ├── PageAuditCard.tsx     — MODIFY: accept new recommendation shape
│   └── PageAuditCardWrapper.tsx — MODIFY: pass through new props

SEED UPDATE:
├── supabase/seed.sql — Update page_audits seed with faq_schema_score + entity_clarity_score

TESTS:
├── src/__tests__/unit/page-audit-dimensions.test.ts   — Per-dimension scoring and recommendations
├── src/__tests__/unit/page-audit-card.test.ts         — Component rendering with real scores
└── src/__tests__/unit/reaudit-action.test.ts          — Server action writes all 5 columns
```

---

## Phase 1: Database Migration

### 1A — Create Migration File

**File:** `supabase/migrations/20260227000001_page_audit_dimensions.sql`

```sql
-- Sprint 71: Add missing dimension score columns to page_audits
-- The auditor computes 5 dimension scores but only 3 were persisted.
-- faq_schema_score and entity_clarity_score were lost after audit.

ALTER TABLE public.page_audits
  ADD COLUMN IF NOT EXISTS faq_schema_score INTEGER,
  ADD COLUMN IF NOT EXISTS entity_clarity_score INTEGER;

-- Backfill: For rows where faq_schema_present is known, derive score
-- faq_schema_present=true with unknown count → estimate 40 (1-2 items)
-- faq_schema_present=false → 0
UPDATE public.page_audits
SET faq_schema_score = CASE
  WHEN faq_schema_present = TRUE THEN 40
  WHEN faq_schema_present = FALSE THEN 0
  ELSE NULL
END
WHERE faq_schema_score IS NULL;

-- entity_clarity_score: No data to backfill from. Leave NULL.
-- NULL scores will display as "—" (pending) per AI_RULES §20.
```

### ⚠️ MIGRATION EDGE CASES

1. **`IF NOT EXISTS` on ALTER.** PostgreSQL `ALTER TABLE ADD COLUMN IF NOT EXISTS` is safe for replay. Required for idempotent migrations.
2. **Backfill is best-effort.** We can derive `faq_schema_score` approximately from `faq_schema_present`, but `entity_clarity_score` has no source — it's `NULL` until the next re-audit runs.
3. **`NULL` propagation.** New columns are `INTEGER` (nullable). The page UI MUST handle `NULL` as a pending state (AI_RULES §20), not as `0`.

---

## Phase 2: Update `database.types.ts`

### 2A — Add New Columns

In `lib/supabase/database.types.ts`, find the `page_audits` section and add to Row, Insert, and Update:

```typescript
// Row
faq_schema_score: number | null;
entity_clarity_score: number | null;

// Insert
faq_schema_score?: number | null;
entity_clarity_score?: number | null;

// Update
faq_schema_score?: number | null;
entity_clarity_score?: number | null;
```

---

## Phase 3: Update Auditor Recommendation Types

### 3A — Enhance `PageAuditRecommendation` in `lib/page-audit/auditor.ts`

Add two optional fields to the existing interface:

```typescript
export interface PageAuditRecommendation {
  issue: string;
  fix: string;
  impactPoints: number;
  dimensionKey?: 'answerFirst' | 'schemaCompleteness' | 'faqSchema' | 'keywordDensity' | 'entityClarity';
  schemaType?: 'FAQPage' | 'OpeningHoursSpecification' | 'LocalBusiness';  // Links to Sprint 70 generator
}
```

### 3B — Update `buildRecommendations()` to Tag Dimensions and Schema Types

Modify each recommendation in `buildRecommendations()` to include `dimensionKey` and `schemaType` where applicable:

```typescript
// Schema recommendations
if (scores.schemaCompleteness < 50) {
  recs.push({
    issue: `Missing required JSON-LD schema for ${pageType} page`,
    fix: `Add a <script type="application/ld+json"> block with the correct @type for your ${pageType} page.`,
    impactPoints: 25,
    dimensionKey: 'schemaCompleteness',        // ← NEW
    schemaType: 'LocalBusiness',                // ← NEW: links to Sprint 70 generator
  });
}

// FAQ recommendations
if (!scores.faqPresent) {
  recs.push({
    issue: 'No FAQPage schema found — this is the #1 driver of AI citations',
    fix: `Add FAQPage schema with at least 5 Q&A pairs about ${name}.`,
    impactPoints: 20,
    dimensionKey: 'faqSchema',                 // ← NEW
    schemaType: 'FAQPage',                      // ← NEW
  });
}

// Answer-First recommendations
if (scores.answerFirst <= 30) {
  recs.push({
    // ... existing fields ...
    dimensionKey: 'answerFirst',                // ← NEW
  });
}

// Keyword recommendations
if (scores.keywordDensity < 50) {
  recs.push({
    // ... existing fields ...
    dimensionKey: 'keywordDensity',             // ← NEW
  });
}

// Entity clarity
if (scores.entityClarity < 50) {
  recs.push({
    // ... existing fields ...
    dimensionKey: 'entityClarity',              // ← NEW
  });
}
```

### ⚠️ BACKWARDS COMPATIBILITY

The `dimensionKey` and `schemaType` fields are OPTIONAL (`?`). Existing recommendations in the DB (from before this sprint) don't have them. The UI must handle `undefined` gracefully — show the recommendation without the dimension badge or schema link.

---

## Phase 4: Update Server Action — `reauditPage()`

### 4A — Write All 5 Dimension Scores

In `app/dashboard/page-audits/actions.ts`, update the upsert to include the 2 new columns:

```typescript
const { error } = await supabase.from('page_audits').upsert(
  {
    org_id: ctx.orgId,
    location_id: existingAudit.location_id,
    page_url: pageUrl,
    page_type: existingAudit.page_type,
    overall_score: result.overallScore,
    answer_first_score: result.answerFirstScore,
    schema_completeness_score: result.schemaCompletenessScore,
    faq_schema_present: result.faqSchemaPresent,
    faq_schema_score: result.faqSchemaScore,           // ← NEW
    entity_clarity_score: result.entityClarityScore,   // ← NEW
    aeo_readability_score: result.keywordDensityScore,
    recommendations: result.recommendations as unknown as Json,
    last_audited_at: new Date().toISOString(),
  },
  { onConflict: 'org_id,page_url' },
);
```

### 4B — Also Update the Audit Cron Functions

If the content-audit cron (`app/api/cron/content-audit/route.ts` or `lib/inngest/functions/content-audit-cron.ts`) writes to `page_audits`, update those write paths too. Check with:

```bash
grep -rn "from('page_audits')" app/ lib/ --include="*.ts"
```

Apply the same 2-column addition to every write path.

---

## Phase 5: Update Page Data Fetching

### 5A — Fetch New Columns in `page.tsx`

In `app/dashboard/page-audits/page.tsx`, update the select to include new columns:

```typescript
supabase
  .from('page_audits')
  .select(
    'id, page_url, page_type, overall_score, answer_first_score, schema_completeness_score, faq_schema_present, faq_schema_score, entity_clarity_score, aeo_readability_score, recommendations, last_audited_at',
  )
```

### 5B — Update `PageAuditRow` Type

Add the new columns:

```typescript
interface PageAuditRow {
  id: string;
  page_url: string;
  page_type: string;
  overall_score: number | null;
  answer_first_score: number | null;
  schema_completeness_score: number | null;
  faq_schema_present: boolean | null;
  faq_schema_score: number | null;          // ← NEW
  entity_clarity_score: number | null;       // ← NEW
  aeo_readability_score: number | null;
  recommendations: PageAuditRecommendation[] | null;
  last_audited_at: string;
}
```

### 5C — Fix the Hardcoded Zeros (THE ACTUAL BUG FIX)

Replace the hardcoded values with real DB data:

```typescript
// BEFORE (broken):
faqSchemaScore={0}
entityClarityScore={0}

// AFTER (fixed):
faqSchemaScore={audit.faq_schema_score}            // ← Real value or null
entityClarityScore={audit.entity_clarity_score}     // ← Real value or null
```

---

## Phase 6: Component Updates

### 6A — Update `DimensionBar.tsx` — Expandable Detail

Transform DimensionBar from a static bar into an expandable detail section.

**New Props:**

```typescript
interface Props {
  label: string;
  score: number | null;       // ← CHANGED from number — nullable for pending state
  weight: string;
  dimensionKey: string;       // ← NEW: for matching recommendations
  recommendations?: PageAuditRecommendation[];  // ← NEW: filtered to this dimension
  expanded?: boolean;         // ← NEW: controlled from parent
  onToggle?: () => void;      // ← NEW: click to expand/collapse
}
```

**Null score handling (AI_RULES §20):**

```typescript
// Score display
{score !== null ? (
  <span className="text-xs font-semibold tabular-nums text-white">{score}</span>
) : (
  <span className="text-xs font-medium text-slate-500">—</span>
)}

// Bar fill — 0% width when null
style={{ width: `${score ?? 0}%` }}
```

**Expanded state shows:**
- Brief explanation of what this dimension measures
- Recommendations for this dimension (filtered by `dimensionKey`)
- For schema-related recommendations: a "Generate Fix →" button linking to Sprint 70's schema generator

### 6B — Create `DimensionDetail.tsx`

**File:** `app/dashboard/page-audits/_components/DimensionDetail.tsx`

Explanation panel shown when a DimensionBar is expanded.

**Dimension explanations (static text per dimension):**

| dimensionKey | Explanation |
|-------------|-------------|
| `answerFirst` | "Measures whether your page leads with the answer — AI models read top-down and stop early. A high score means your opening text directly answers the most common query." |
| `schemaCompleteness` | "Measures JSON-LD structured data on the page. Schema markup tells AI exactly what your business is, where it's located, and what you offer." |
| `faqSchema` | "Checks for FAQPage schema with Q&A pairs. Pages with FAQ schema are 3.2x more likely to appear in AI Overviews and answer boxes." |
| `keywordDensity` | "Checks that your business name, location, and category terms appear naturally in the visible text — not just in schema or footers." |
| `entityClarity` | "Measures whether AI can extract your complete business identity (name, address, phone, hours) from the page content." |

**For each recommendation in this dimension:**
- Issue text (bold)
- Fix text (normal)
- Impact badge: `+{impactPoints} pts` in amber pill
- If `schemaType` is present: "Generate {schemaType} →" button that triggers the Sprint 70 schema action

### 6C — Update `PageAuditCard.tsx`

- Accept `recommendations` with the enhanced type (including optional `dimensionKey`, `schemaType`)
- Pass filtered recommendations to each DimensionBar
- Track which dimension is expanded via `useState`
- Only allow one dimension expanded at a time (accordion behavior)
- Update DimensionBar calls to pass `score` as `number | null` (not `?? 0`)

### 6D — Update `PageAuditCardWrapper.tsx`

Pass through any new props required by the updated card.

---

## Phase 7: Seed Data Update

### 7A — Update `page_audits` Seed

Add the new columns to the existing seed INSERT:

```sql
INSERT INTO public.page_audits (
  id, org_id, location_id,
  page_url, page_type,
  aeo_readability_score, answer_first_score, schema_completeness_score,
  faq_schema_present, faq_schema_score, entity_clarity_score,  -- ← NEW columns
  overall_score,
  recommendations,
  last_audited_at, created_at
)
SELECT
  'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'https://charcoalnchill.com',
  'homepage',
  78,    -- aeo_readability_score
  65,    -- answer_first_score
  55,    -- schema_completeness_score
  FALSE, -- faq_schema_present
  0,     -- faq_schema_score (no FAQ schema)
  62,    -- entity_clarity_score (has name+address but missing hours in text)
  66,    -- overall_score
  '[{"issue":"No FAQ schema markup","fix":"Add FAQPage JSON-LD with top 5 customer questions","impactPoints":20,"dimensionKey":"faqSchema","schemaType":"FAQPage"},{"issue":"Homepage opening paragraph does not directly answer intent","fix":"Lead with what you are, where you are, and who you serve","impactPoints":35,"dimensionKey":"answerFirst"},{"issue":"Missing required JSON-LD schema for homepage page","fix":"Add a <script type=\"application/ld+json\"> block with @type Restaurant","impactPoints":25,"dimensionKey":"schemaCompleteness","schemaType":"LocalBusiness"}]'::jsonb,
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '3 hours'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO UPDATE SET
  faq_schema_score = EXCLUDED.faq_schema_score,
  entity_clarity_score = EXCLUDED.entity_clarity_score,
  recommendations = EXCLUDED.recommendations;
```

**Note:** Use `ON CONFLICT ... DO UPDATE` instead of `DO NOTHING` so repeated seeds update the new columns.

---

## Phase 8: Tests (Write FIRST — AI_RULES §4)

### 8A — `src/__tests__/unit/page-audit-dimensions.test.ts` (NEW)

Tests for the enhanced `buildRecommendations()` and dimension scoring.

**Test cases (minimum 12):**

```
describe('buildRecommendations — enhanced')
  1.  ✅ includes dimensionKey on all recommendations
  2.  ✅ includes schemaType='FAQPage' when faq_schema_present is false
  3.  ✅ includes schemaType='LocalBusiness' when schema_completeness < 50
  4.  ✅ does NOT include schemaType on non-schema recommendations
  5.  ✅ sorts by impactPoints descending (highest first)
  6.  ✅ generates answerFirst recommendation when score <= 30
  7.  ✅ generates answerFirst recommendation when score 31-60
  8.  ✅ generates no answerFirst recommendation when score > 80
  9.  ✅ generates keywordDensity recommendation when < 50
  10. ✅ generates entityClarity recommendation when < 50
  11. ✅ uses business_name and city in recommendation text
  12. ✅ handles null business_name gracefully (fallback to "Your Business")

describe('PageAuditResult completeness')
  13. ✅ auditPage result includes all 5 dimension scores
  14. ✅ faqSchemaScore comes from scoreFaqSchema(), not hardcoded
  15. ✅ entityClarityScore comes from scoreEntityClarity(), not hardcoded
```

**Mocking strategy:** For `buildRecommendations()` tests, call the function directly with various score combinations — it's a pure function. For `auditPage` tests, mock `fetch` (returns HTML) and `generateText` (returns AI score).

### 8B — `src/__tests__/unit/page-audit-card.test.ts` (NEW)

Tests for the updated PageAuditCard component rendering.

**Test cases (minimum 8):**

```
describe('PageAuditCard — dimension display')
  1.  ✅ renders all 5 dimension bars with labels
  2.  ✅ renders real faqSchemaScore (not hardcoded 0)
  3.  ✅ renders real entityClarityScore (not hardcoded 0)
  4.  ✅ renders "—" when score is null (pending state)
  5.  ✅ renders green bar when score >= 80
  6.  ✅ renders amber bar when score 50-79
  7.  ✅ renders red bar when score < 50

describe('PageAuditCard — expandable dimensions')
  8.  ✅ clicking a dimension bar expands its detail section
  9.  ✅ only one dimension is expanded at a time (accordion)
  10. ✅ expanded dimension shows filtered recommendations
  11. ✅ "Generate Fix →" button appears when schemaType is present
```

**Testing approach:** Use `@testing-library/react` to render `PageAuditCard` with props matching the golden tenant seed data. Use `screen.getByText`, `fireEvent.click` for interactions.

### 8C — `src/__tests__/unit/reaudit-action.test.ts` (NEW)

Tests for the updated `reauditPage()` server action.

**Test cases (minimum 6):**

```
describe('reauditPage — dimension persistence')
  1.  ✅ writes faq_schema_score to DB
  2.  ✅ writes entity_clarity_score to DB
  3.  ✅ writes all 5 dimension scores in single upsert
  4.  ✅ returns success=false when not authenticated
  5.  ✅ returns success=false when rate limited
  6.  ✅ returns success=false when audit record not found
```

**Mocking strategy:**
- Mock `getSafeAuthContext()` for auth
- Mock `createClient()` with Supabase mock that captures upsert args
- Mock `auditPage()` to return a complete `PageAuditResult`
- Verify the upsert call includes both new columns

---

## Phase 9: Documentation

### 9A — DEVLOG.md Entry

Standard format. Include:
- Migration file
- All modified files
- Bug fix explanation (hardcoded zeros → real scores)
- Test counts verified with `grep -cE`

### 9B — Update docs/CLAUDE.md — Migration List

Add migration #21 to the Current Migrations list:

```
21. `20260227000001_page_audit_dimensions.sql` — `faq_schema_score`, `entity_clarity_score` columns on `page_audits`
```

### 9C — AI_RULES.md Update (if new pattern discovered)

Potential: If the "backfill from existing boolean to integer score" pattern is useful generally, document it.

---

## Definition of Done Checklist

- [ ] Migration adds `faq_schema_score` and `entity_clarity_score` to `page_audits`
- [ ] `database.types.ts` updated with new columns (Row, Insert, Update)
- [ ] `PageAuditRecommendation` has optional `dimensionKey` and `schemaType` fields
- [ ] `buildRecommendations()` tags every recommendation with `dimensionKey`
- [ ] Schema-related recommendations include `schemaType` linking to Sprint 70 generators
- [ ] `reauditPage()` writes all 5 dimension scores to DB
- [ ] Any other `page_audits` write paths also updated (check cron/inngest)
- [ ] `page.tsx` no longer has hardcoded `faqSchemaScore={0}` or `entityClarityScore={0}`
- [ ] `page.tsx` passes `null` (not `0`) when DB value is null (AI_RULES §20)
- [ ] DimensionBar handles `score: null` with "—" pending state
- [ ] DimensionBar is expandable with dimension explanation
- [ ] Expanded dimension shows filtered recommendations
- [ ] Schema recommendations show "Generate Fix →" button (links to Sprint 70)
- [ ] Accordion behavior: only one dimension expanded at a time
- [ ] Seed data updated with real `faq_schema_score` and `entity_clarity_score`
- [ ] Seed recommendations include `dimensionKey` and `schemaType` fields
- [ ] All 3 new test files passing (26+ tests total)
- [ ] `npx vitest run` — ALL tests passing
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npx supabase db reset` — seeds apply cleanly with new columns
- [ ] DEVLOG entry with verified test counts
- [ ] `docs/CLAUDE.md` migration list updated
- [ ] No `as any` on Supabase clients
- [ ] No hardcoded scores or placeholders (AI_RULES §20)
- [ ] Backwards compatible: old recommendations without `dimensionKey` render fine

---

## What NOT to Do

1. **DO NOT** modify scoring logic in `auditor.ts` (scoreAnswerFirst, scoreSchemaCompleteness, etc.). This sprint only fixes persistence and UI — the scoring algorithms stay the same.
2. **DO NOT** remove the `faq_schema_present` boolean column. It's still useful as a quick boolean check. The new `faq_schema_score` adds the numeric granularity.
3. **DO NOT** modify `aeo_readability_score` — it maps to `keywordDensityScore` and works correctly.
4. **DO NOT** backfill `entity_clarity_score` with fabricated values. NULL is honest; 0 is a lie (AI_RULES §20).
5. **DO NOT** make the migration destructive (no DROP COLUMN, no data loss).
6. **DO NOT** remove the `overallScore` composite calculation — it stays in the auditor.
7. **DO NOT** create a new page or route. All changes are to the existing `/dashboard/page-audits` page.
8. **DO NOT** add new npm packages.
9. **DO NOT** modify E2E tests. Note any needed updates in DEVLOG.
10. **DO NOT** change the 5-dimension weight formula (35/25/20/10/10) — that's Doc 17 §2.1 and is correct.

---

## File Change Summary

| File | Action | What Changes |
|------|--------|-------------|
| `supabase/migrations/20260227000001_page_audit_dimensions.sql` | CREATE | Add 2 columns + backfill |
| `lib/supabase/database.types.ts` | MODIFY | Add new columns to page_audits types |
| `lib/page-audit/auditor.ts` | MODIFY | Enhanced recommendation interface with dimensionKey + schemaType |
| `app/dashboard/page-audits/page.tsx` | MODIFY | Fetch new columns, pass real scores (fix hardcoded zeros) |
| `app/dashboard/page-audits/actions.ts` | MODIFY | Write all 5 scores in reauditPage() |
| `app/dashboard/page-audits/_components/DimensionBar.tsx` | MODIFY | Nullable score, expandable detail |
| `app/dashboard/page-audits/_components/DimensionDetail.tsx` | CREATE | Per-dimension explanation + recs |
| `app/dashboard/page-audits/_components/PageAuditCard.tsx` | MODIFY | Pass recs to dimensions, accordion state |
| `app/dashboard/page-audits/_components/PageAuditCardWrapper.tsx` | MODIFY | Pass through new prop types |
| `supabase/seed.sql` | MODIFY | Add faq_schema_score + entity_clarity_score to seed |
| `src/__tests__/unit/page-audit-dimensions.test.ts` | CREATE | Recommendation tagging + completeness |
| `src/__tests__/unit/page-audit-card.test.ts` | CREATE | Component rendering with real scores |
| `src/__tests__/unit/reaudit-action.test.ts` | CREATE | Server action persistence |
| `DEVLOG.md` | MODIFY | Sprint 71 entry |
| `docs/CLAUDE.md` | MODIFY | Migration list update |

**Total new files:** 5 (1 migration + 1 component + 3 test files)
**Total modified files:** 10
**Estimated scope:** Medium (schema migration + bug fix + UI enhancement)
