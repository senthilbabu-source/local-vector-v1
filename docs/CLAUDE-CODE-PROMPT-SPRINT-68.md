# Claude Code Prompt — Sprint 68: Fix `ai_audits` Bug + Add AI Assistant to Sidebar

## ⚠️ READ BEFORE ANYTHING ELSE

Read these files in order BEFORE writing any code:
1. `docs/AI_RULES.md` — all 38 rules. Pay special attention to:
   - §1 (schema source of truth is `prod_schema.sql`)
   - §3 (RLS, `getSafeAuthContext`, org_id server-side)
   - §4 (tests first, golden tenant fixtures, mocking)
   - §7 (UUID hex constraint)
   - §11 (RLS shadowban — org_id must always be server-side)
   - §13 (DEVLOG entry format, test count verification)
   - §17 (side-effect resilience — `.catch()`)
   - §18 (`createServiceRoleClient()` only in cron/inngest/webhooks)
   - §20 (never hardcode placeholder metrics)
   - §23 (never show fake timestamps)
   - §25 (`'use server'` — all exports must be async)
   - §30 (Inngest patterns — service-role per step, withTimeout)
   - §38 (database.types.ts, no `as any` on Supabase)
2. `docs/CLAUDE.md` — project context, table inventory, migration list
3. `supabase/prod_schema.sql` — search for `ai_audits` table definition (lines ~291–306)
4. `lib/supabase/database.types.ts` — search for `ai_audits` Row/Insert/Update types
5. `src/__fixtures__/golden-tenant.ts` — golden tenant data (org ID: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`)
6. `lib/data/dashboard.ts` — lines 121–130 where `ai_audits` is queried for "Last Scan"
7. `lib/inngest/functions/audit-cron.ts` — the `processOrgAudit()` function that SHOULD write `ai_audits` but doesn't
8. `app/api/cron/audit/route.ts` — inline fallback that also skips `ai_audits`
9. `components/layout/Sidebar.tsx` — `NAV_ITEMS` array (lines 26–110)
10. `DEVLOG.md` — to understand entry format and insert new entry at top

---

## What This Sprint Does

Sprint 68 has exactly **2 deliverables** — both are bug fixes, not features:

### Bug 1 (🔴 CRITICAL): `ai_audits` Table Is Never Written To

**The problem:** The `ai_audits` table exists in the database schema with columns: `id`, `org_id`, `location_id`, `model_provider`, `prompt_type`, `prompt_text`, `raw_response`, `response_metadata`, `is_hallucination_detected`, `audit_date`, `created_at`.

The main dashboard (`lib/data/dashboard.ts` line ~123) queries this table to show the "Last Scan" timestamp:
```typescript
supabase
  .from('ai_audits')
  .select('audit_date')
  .eq('org_id', orgId)
  .order('audit_date', { ascending: false })
  .limit(1)
  .maybeSingle()
```

But **neither** the Inngest audit cron (`lib/inngest/functions/audit-cron.ts`) **nor** the inline fallback (`app/api/cron/audit/route.ts`) ever INSERT into `ai_audits`. They write directly to `ai_hallucinations` only.

**Result:** Every customer sees "Last Scan: never" permanently, even after their audit cron has run dozens of times.

**Additional FK gap:** The `ai_hallucinations` table has an `audit_id UUID` FK column referencing `ai_audits.id`, but it's always NULL because no parent row is created.

### Bug 2 (🔴): AI Assistant Missing from Sidebar Navigation

**The problem:** The AI Assistant page exists at `app/dashboard/ai-assistant/page.tsx` and works correctly, but the `NAV_ITEMS` array in `components/layout/Sidebar.tsx` has no entry for it. Users can only reach it by manually typing the URL.

---

## Architecture Overview

```
Sprint 68 — Two Bug Fixes
━━━━━━━━━━━━━━━━━━━━━━━━━

BUG 1: ai_audits Never Written
├── Fix A: lib/inngest/functions/audit-cron.ts
│   └── processOrgAudit() → INSERT ai_audits row BEFORE ai_hallucinations
│       └── Set audit_id FK on hallucination rows
├── Fix B: app/api/cron/audit/route.ts
│   └── Inline fallback → same INSERT pattern
├── Fix C: supabase/seed.sql
│   └── Add seed rows for ai_audits (golden tenant)
├── Fix D: src/__fixtures__/golden-tenant.ts
│   └── Add MOCK_AI_AUDIT fixture
├── Test: src/__tests__/unit/audit-cron-ai-audits.test.ts
│   └── Verify ai_audits INSERT + FK linking
│
BUG 2: AI Assistant Not in Sidebar
├── Fix: components/layout/Sidebar.tsx
│   └── Add NAV_ITEMS entry for /dashboard/ai-assistant
├── Test: src/__tests__/unit/sidebar-nav-items.test.ts
│   └── Verify NAV_ITEMS includes ai-assistant
│
DOCS:
├── DEVLOG.md — new entry at top
├── docs/AI_RULES.md — add §39 if new pattern discovered
└── supabase/seed.sql — update UUID reference card
```

---

## Phase 1: Fix `ai_audits` — Inngest Audit Cron

### 1A — Understand the `ai_audits` Table Schema

Read `supabase/prod_schema.sql` and confirm these columns:

```sql
CREATE TABLE IF NOT EXISTS "public"."ai_audits" (
    "id"                        uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "org_id"                    uuid NOT NULL,
    "location_id"               uuid,
    "model_provider"            public.model_provider NOT NULL,      -- enum
    "prompt_type"               public.audit_prompt_type NOT NULL,   -- enum
    "prompt_text"               text,
    "raw_response"              text,
    "response_metadata"         jsonb,
    "is_hallucination_detected" boolean DEFAULT false,
    "audit_date"                timestamptz DEFAULT now(),
    "created_at"                timestamptz DEFAULT now()
);
```

**Enums (from prod_schema.sql):**
- `model_provider`: `'openai-gpt4o' | 'perplexity-sonar' | 'google-gemini' | 'anthropic-claude' | 'microsoft-copilot' | 'openai-gpt4o-mini'`
- `audit_prompt_type`: `'status_check' | 'hours_check' | 'amenity_check' | 'menu_check' | 'recommendation'`

**FK relationship:** `ai_hallucinations.audit_id` → `ai_audits.id` (ON DELETE SET NULL)

### 1B — Modify `processOrgAudit()` in `lib/inngest/functions/audit-cron.ts`

**Current flow:**
1. Fetch primary location
2. Call `auditLocation()` → returns `DetectedHallucination[]`
3. Insert into `ai_hallucinations` (if any found)
4. Send email alert

**New flow (changes in bold):**
1. Fetch primary location
2. Call `auditLocation()` → returns `DetectedHallucination[]`
3. **INSERT one `ai_audits` row as the scan log entry**
4. **If hallucinations found, INSERT into `ai_hallucinations` WITH `audit_id` set to the new audit row's ID**
5. Send email alert
6. **Return the audit ID in the result for traceability**

**Implementation details for the `ai_audits` INSERT:**

```typescript
// ── Create parent audit row ──────────────────────────────────────────
const auditRow = {
  org_id: location.org_id,
  location_id: location.id,
  model_provider: 'openai-gpt4o' as Database['public']['Enums']['model_provider'],
  prompt_type: 'status_check' as Database['public']['Enums']['audit_prompt_type'],
  is_hallucination_detected: hallucinations.length > 0,
  // audit_date and created_at default to now()
  // prompt_text and raw_response are nullable — omit for V1
};

const { data: auditData, error: auditError } = await supabase
  .from('ai_audits')
  .insert(auditRow)
  .select('id')
  .single();

if (auditError) {
  // Log but do NOT throw — the audit row is a scan log, not critical path.
  // Hallucinations should still be inserted even if the parent log fails.
  console.error(`[inngest-audit] ai_audits insert failed: ${auditError.message}`);
}

const auditId = auditData?.id ?? null;
```

**Then modify the hallucination INSERT to include audit_id:**

```typescript
const hallRows = hallucinations.map((h) => ({
  org_id: location.org_id,
  location_id: location.id,
  audit_id: auditId,  // ← NEW: FK link to parent audit
  model_provider: h.model_provider as Database['public']['Enums']['model_provider'],
  severity: h.severity as Database['public']['Enums']['hallucination_severity'],
  category: h.category,
  claim_text: h.claim_text,
  expected_truth: h.expected_truth,
  correction_status: 'open' as Database['public']['Enums']['correction_status'],
}));
```

**Update the return type:**

```typescript
export interface AuditOrgResult {
  success: boolean;
  hallucinationsInserted: number;
  auditId: string | null;  // ← NEW
}
```

### ⚠️ CRITICAL EDGE CASES

1. **`ai_audits` INSERT fails but hallucination INSERT should still work.** The audit row is a scan log. A failure to log the scan must NEVER prevent hallucination detection from completing. Use a try/catch around the audit INSERT only, and pass `auditId = null` to the hallucination rows if it fails. The `audit_id` FK column is nullable (no NOT NULL constraint in schema), so null is valid.

2. **Zero hallucinations still get an `ai_audits` row.** The whole point is to log EVERY scan, not just scans that find problems. `is_hallucination_detected = false` when clean. This is what fixes the "Last Scan: never" bug — even a clean scan shows a timestamp.

3. **`model_provider` enum value must be valid.** The Fear Engine currently uses `openai-gpt4o` (key `fear-audit` in `lib/ai/providers.ts`). Use `'openai-gpt4o'` as the `model_provider`. DO NOT use `'openai'` — that's not a valid enum value.

4. **`prompt_type` enum value.** Use `'status_check'` as the default audit prompt type. This represents the Fear Engine's primary function (checking if AI thinks the business is closed, has wrong hours, etc.).

5. **Service-role client.** This code runs inside Inngest step functions. It already correctly uses `createServiceRoleClient()` per step (AI_RULES §30.3). No change needed there.

6. **`select('id').single()` after INSERT.** This is the standard pattern to get the new row's generated UUID back. The `.single()` is safe here because we're inserting exactly one row.

### 1C — Apply the Same Fix to the Inline Fallback

The inline fallback in `app/api/cron/audit/route.ts` has its own copy of the audit loop (the `runInlineAudit()` function). Apply the **exact same pattern** there:

1. Find the hallucination INSERT block (around line ~146)
2. Add the `ai_audits` INSERT before it (same pattern as 1B)
3. Add `audit_id` to the hallucination rows

**DO NOT refactor to share code between Inngest and inline.** They are intentionally separate (AI_RULES §30.1). The inline fallback is a safety net — it should be self-contained.

---

## Phase 2: Fix AI Assistant Sidebar Navigation

### 2A — Add NAV_ITEMS Entry

In `components/layout/Sidebar.tsx`, add the AI Assistant entry to the `NAV_ITEMS` array.

**Placement:** After "Page Audits" and before "Settings". This groups it with the analysis tools.

**Icon:** Use `MessageSquare` from `lucide-react` (already likely imported, but check — if not, add the import).

```typescript
{
  href: '/dashboard/ai-assistant',
  label: 'AI Assistant',
  icon: MessageSquare,
  exact: false,
  active: true,
},
```

**Update the `data-testid` pattern.** Per AI_RULES §35.4, the sidebar links use `data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}`. This entry will get `data-testid="nav-ai-assistant"`.

### ⚠️ EDGE CASES

1. **Check that `MessageSquare` is available.** Read the lucide-react imports at the top of `Sidebar.tsx`. If `MessageSquare` isn't imported, add it to the existing import statement. Do NOT add a second import from lucide-react.

2. **Icon alternatives.** If `MessageSquare` doesn't feel right, `Bot` or `Sparkles` are also available in lucide-react. Prefer `MessageSquare` for consistency with chat/assistant semantics.

3. **E2E sidebar test.** There's an existing `14-sidebar-nav.spec.ts` that tests 9 sidebar links. After adding AI Assistant, there will be 10 navigable links. The E2E test may need updating — but DO NOT modify E2E tests in this sprint. Note the discrepancy in the DEVLOG for Sprint 69 to address.

---

## Phase 3: Update Seed Data

### 3A — Add `ai_audits` Seed Rows to `supabase/seed.sql`

Add seed data for the golden tenant so local development shows a "Last Scan" timestamp.

**First, register the new UUIDs in the reference card at the top of `seed.sql`.**

Use the `d0` prefix for ai_audits rows (check existing prefixes to avoid collision):

```sql
-- ── ai_audits ──────────────────────────────────────────────────
-- d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  audit #1 (golden tenant, recent scan)
-- d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12  audit #2 (golden tenant, older scan)
```

**UUIDs MUST be hex-only** (AI_RULES §7). The `d0` prefix is safe (d is valid hex).

**Insert 2 seed rows** — one recent (yesterday), one older (1 week ago):

```sql
-- ── Section: ai_audits ─────────────────────────────────────────
INSERT INTO ai_audits (id, org_id, location_id, model_provider, prompt_type, is_hallucination_detected, audit_date) VALUES
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'openai-gpt4o', 'status_check', true, NOW() - INTERVAL '1 day'),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'openai-gpt4o', 'status_check', false, NOW() - INTERVAL '7 days');
```

**Verify:** The `org_id` and `location_id` UUIDs match the golden tenant's values in `seed.sql`.

### 3B — Update `ai_hallucinations` Seed Rows (Link `audit_id`)

If existing `ai_hallucinations` seed rows have `audit_id = NULL`, update them to reference the new audit row:

```sql
-- Update existing hallucination seed rows to link to audit #1
UPDATE ai_hallucinations SET audit_id = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
WHERE org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND audit_id IS NULL;
```

Or modify the existing INSERT statements to include `audit_id` directly. Read the current seed file to decide which approach is cleaner.

### 3C — Add `MOCK_AI_AUDIT` to Golden Tenant Fixture

In `src/__fixtures__/golden-tenant.ts`, add:

```typescript
export const MOCK_AI_AUDIT = {
  id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  model_provider: 'openai-gpt4o' as const,
  prompt_type: 'status_check' as const,
  is_hallucination_detected: true,
  audit_date: new Date().toISOString(),
  created_at: new Date().toISOString(),
} as const;
```

---

## Phase 4: Tests (Write FIRST, Then Implement — AI_RULES §4)

### 4A — `src/__tests__/unit/audit-cron-ai-audits.test.ts` (NEW)

This test file validates that the `processOrgAudit()` function correctly writes to `ai_audits`.

**Test cases (minimum 8):**

```
describe('processOrgAudit — ai_audits integration')
  1. ✅ creates ai_audits row when hallucinations ARE found
  2. ✅ creates ai_audits row when hallucinations are NOT found (clean scan)
  3. ✅ sets is_hallucination_detected=true when hallucinations found
  4. ✅ sets is_hallucination_detected=false when no hallucinations
  5. ✅ links hallucination rows to audit via audit_id FK
  6. ✅ sets model_provider to 'openai-gpt4o' (valid enum)
  7. ✅ sets prompt_type to 'status_check' (valid enum)
  8. ✅ still inserts hallucinations even if ai_audits INSERT fails
  9. ✅ returns auditId in result when successful
  10. ✅ returns auditId=null in result when ai_audits INSERT fails
```

**Mocking strategy:**

```typescript
// Mock Supabase — track calls to .from('ai_audits') and .from('ai_hallucinations')
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}));

// Mock ai-audit service
vi.mock('@/lib/services/ai-audit.service', () => ({
  auditLocation: vi.fn(),
}));

// Mock email (fire-and-forget, AI_RULES §17)
vi.mock('@/lib/email', () => ({
  sendHallucinationAlert: vi.fn().mockResolvedValue(undefined),
}));

// Mock revenue leak (side effect)
vi.mock('@/lib/services/revenue-leak.service', () => ({
  snapshotRevenueLeak: vi.fn().mockResolvedValue(undefined),
}));
```

**Mock Supabase client pattern** (AI_RULES §38.2 — no `as any`):

Build a mock that tracks which `.from()` table is called and returns appropriate responses:

```typescript
function createMockSupabase(options: {
  auditInsertResult?: { data: { id: string } | null; error: Error | null };
  hallucinationInsertResult?: { error: Error | null };
}) {
  const mockInsertChain = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  
  return {
    from: vi.fn((table: string) => {
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { /* golden tenant location */ },
            error: null,
          }),
        };
      }
      if (table === 'ai_audits') {
        mockInsertChain.single.mockResolvedValue(
          options.auditInsertResult ?? { data: { id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }, error: null }
        );
        return { insert: vi.fn().mockReturnValue(mockInsertChain) };
      }
      if (table === 'ai_hallucinations') {
        return {
          insert: vi.fn().mockResolvedValue(
            options.hallucinationInsertResult ?? { error: null }
          ),
        };
      }
      // memberships (for email lookup) — return mock owner
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { users: { email: 'test@example.com' } },
            error: null,
          }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    }),
  } as unknown as SupabaseClient<Database>;
}
```

**Key assertions:**

```typescript
// Test 1: Verify ai_audits INSERT was called
expect(mockSupabase.from).toHaveBeenCalledWith('ai_audits');

// Test 5: Verify hallucination rows include audit_id
const hallInsertCall = mockSupabase.from.mock.calls.find(([t]) => t === 'ai_hallucinations');
// ... drill into the insert arg to check audit_id is set

// Test 8: ai_audits fails, hallucinations still inserted
const failSupabase = createMockSupabase({
  auditInsertResult: { data: null, error: new Error('DB constraint') },
});
// ... verify hallucination insert was still called
```

### 4B — `src/__tests__/unit/sidebar-nav-items.test.ts` (NEW)

A lightweight test to ensure the AI Assistant nav item is present and correctly configured.

**Test cases (minimum 4):**

```
describe('Sidebar NAV_ITEMS')
  1. ✅ includes AI Assistant entry
  2. ✅ AI Assistant href is '/dashboard/ai-assistant'
  3. ✅ AI Assistant has active=true
  4. ✅ AI Assistant is positioned before Settings
```

**Implementation note:** You'll need to export `NAV_ITEMS` (or the component renders them, so you may need to render the component and check for the nav link). Prefer testing the data array directly if possible. If `NAV_ITEMS` is not exported, either:
- Export it as a named export (preferred — it's just data)
- Or use `@testing-library/react` to render and check for the link

If exporting, add `export` to the `const NAV_ITEMS` declaration. This is safe — it's a static array, not a component.

### 4C — Run Existing Tests (Regression Check)

After implementing, run the FULL test suite to verify nothing broke:

```bash
npx vitest run                    # All unit tests
npx tsc --noEmit                  # Type checking
```

**Known files that test audit-cron behavior and may need inspection:**
- `src/__tests__/unit/inngest-audit-cron.test.ts` — tests `processOrgAudit()`. This test WILL need updating because the function now has a new `ai_audits` INSERT call. The mock Supabase client must handle the new `.from('ai_audits')` call.
- `src/__tests__/unit/cron-audit.test.ts` — tests the cron route handler. May need mock updates if it tests the inline fallback.

**⚠️ CRITICAL: Read these existing test files BEFORE making changes.** The mock Supabase clients in these files may break when you add the new `.from('ai_audits')` call. You MUST update their mocks to handle the new table access gracefully.

---

## Phase 5: Documentation

### 5A — DEVLOG.md Entry

Insert at the TOP of `DEVLOG.md` (reverse chronological order — AI_RULES §13.4):

```markdown
## 2026-02-27 — Sprint 68: Fix ai_audits Bug + Add AI Assistant to Sidebar (Completed)

**Goal:** Fix two critical bugs: (1) `ai_audits` table never written to, causing "Last Scan: never" for all customers, and (2) AI Assistant page missing from sidebar navigation.

**Scope:**
- `lib/inngest/functions/audit-cron.ts` — Added `ai_audits` INSERT in `processOrgAudit()` before hallucination writes. Sets `audit_id` FK on child hallucination rows. Graceful degradation: if audit INSERT fails, hallucinations still written with `audit_id=null`.
- `app/api/cron/audit/route.ts` — Applied same `ai_audits` INSERT pattern to inline fallback.
- `components/layout/Sidebar.tsx` — Added AI Assistant entry to `NAV_ITEMS` (MessageSquare icon, between Page Audits and Settings).
- `supabase/seed.sql` — Added 2 `ai_audits` seed rows (UUIDs: `d0...a11`, `d0...a12`). Updated hallucination seed rows with `audit_id` FK.
- `src/__fixtures__/golden-tenant.ts` — Added `MOCK_AI_AUDIT` fixture.

**Tests added:**
- `src/__tests__/unit/audit-cron-ai-audits.test.ts` — **N Vitest tests.** Validates ai_audits INSERT, FK linking, graceful failure, clean scan logging.
- `src/__tests__/unit/sidebar-nav-items.test.ts` — **N Vitest tests.** Validates AI Assistant in NAV_ITEMS with correct href and position.
- `src/__tests__/unit/inngest-audit-cron.test.ts` — **UPDATED.** Mock Supabase now handles `.from('ai_audits')`.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/audit-cron-ai-audits.test.ts  # N tests passing
npx vitest run src/__tests__/unit/sidebar-nav-items.test.ts     # N tests passing
npx vitest run                                                    # All tests passing
```
```

**⚠️ Replace `N` with actual counts** verified via:
```bash
grep -cE "^\s*(it|test)\(" src/__tests__/unit/audit-cron-ai-audits.test.ts
grep -cE "^\s*(it|test)\(" src/__tests__/unit/sidebar-nav-items.test.ts
```

### 5B — docs/AI_RULES.md Updates

**Only if you discover a new engineering constraint.** Potential candidates:

- If the `ai_audits` INSERT pattern reveals a general rule about "scan log tables should always be written regardless of findings," document it.
- If mock Supabase patterns for multi-table INSERT chains require a new convention, add it to §4 or §38.

### 5C — Update docs/14_TESTING_STRATEGY.md

If this file exists, add the new test files to the inventory with their test counts.

---

## Definition of Done Checklist

Before marking Sprint 68 complete, verify ALL of these:

- [ ] `processOrgAudit()` INSERTs into `ai_audits` on every run (with and without hallucinations)
- [ ] `audit_id` FK is set on `ai_hallucinations` rows when audit INSERT succeeds
- [ ] `audit_id` is `null` on `ai_hallucinations` rows when audit INSERT fails (graceful degradation)
- [ ] Inline fallback in `route.ts` has the same pattern
- [ ] AI Assistant appears in sidebar between Page Audits and Settings
- [ ] `supabase/seed.sql` has `ai_audits` seed rows (UUID reference card updated)
- [ ] `golden-tenant.ts` has `MOCK_AI_AUDIT` fixture
- [ ] New test file: `audit-cron-ai-audits.test.ts` — all passing
- [ ] New test file: `sidebar-nav-items.test.ts` — all passing
- [ ] Existing test file: `inngest-audit-cron.test.ts` — still passing (mocks updated)
- [ ] `npx vitest run` — ALL tests passing
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `DEVLOG.md` entry with verified test counts (grep, not memory)
- [ ] No new `as any` casts on Supabase clients
- [ ] No hardcoded timestamps or fake metrics (AI_RULES §20, §23)
- [ ] All UUIDs in seed.sql use hex-only characters (AI_RULES §7)
- [ ] `AuditOrgResult` interface updated with `auditId: string | null`

---

## What NOT to Do

1. **DO NOT** create a new migration file. The `ai_audits` table already exists in the schema. This is a code-only fix.
2. **DO NOT** modify `lib/data/dashboard.ts`. The dashboard query is correct — it reads `ai_audits.audit_date`. Once we write to the table, the query will work.
3. **DO NOT** refactor `processOrgAudit()` and the inline fallback to share code. They are intentionally separate (AI_RULES §30.1).
4. **DO NOT** change the audit cron schedule or kill switch behavior.
5. **DO NOT** add `console.log` statements (there are already 39 in production — AI_RULES hygiene issue). Use `console.error` for the failure catch block only.
6. **DO NOT** modify E2E tests (`tests/e2e/`). Note any needed E2E updates in the DEVLOG for a future sprint.
7. **DO NOT** change the `model_provider` or `audit_prompt_type` enums. Use existing values only.
8. **DO NOT** add prompt_text or raw_response to the ai_audits row. Those fields are nullable and can be populated in a future sprint when we want to store audit prompts for the "AI Says" response library feature.

---

## File Change Summary

| File | Action | What Changes |
|------|--------|-------------|
| `lib/inngest/functions/audit-cron.ts` | MODIFY | Add `ai_audits` INSERT, set `audit_id` on hallucinations, update return type |
| `app/api/cron/audit/route.ts` | MODIFY | Same pattern in inline fallback |
| `components/layout/Sidebar.tsx` | MODIFY | Add AI Assistant to `NAV_ITEMS`, import `MessageSquare` |
| `supabase/seed.sql` | MODIFY | Add `ai_audits` seed rows, update UUID reference card |
| `src/__fixtures__/golden-tenant.ts` | MODIFY | Add `MOCK_AI_AUDIT` export |
| `src/__tests__/unit/audit-cron-ai-audits.test.ts` | CREATE | New test file for ai_audits integration |
| `src/__tests__/unit/sidebar-nav-items.test.ts` | CREATE | New test file for sidebar nav |
| `src/__tests__/unit/inngest-audit-cron.test.ts` | MODIFY | Update mock Supabase to handle `.from('ai_audits')` |
| `DEVLOG.md` | MODIFY | Add Sprint 68 entry at top |

**Total new files:** 2 (test files)
**Total modified files:** 7
**Total deleted files:** 0
**Estimated scope:** Small-Medium (focused bug fixes with thorough testing)
