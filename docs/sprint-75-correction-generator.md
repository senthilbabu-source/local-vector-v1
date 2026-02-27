# Sprint 75 — Hallucination → Correction Content Generator

> **Claude Code Prompt — First-Pass Ready**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Close the **Fear Engine loop** by generating actionable correction content for every detected hallucination. Currently, the dashboard shows "ChatGPT claims you're permanently closed" — the user panics, doesn't know what to do. After this sprint, each hallucination has a **"Fix This"** button that generates a correction package: a GBP post draft, a website correction snippet, and an `llms.txt` correction notice — all built from the business's actual ground truth data already in LocalVector.

**The flywheel stage:** PRESCRIBE → GENERATE. Hallucination detected (DETECT) → Diagnosed with category + severity (IDENTIFY) → Ranked correction actions generated (PRESCRIBE) → Ready-to-use content produced (GENERATE).

**Why this matters:** "AI thinks you're closed. Here's a Google Business Profile post, a website update, and an llms.txt correction to fix it — all written using your actual hours and data. Click to approve and publish." That's the difference between a monitoring tool and a growth engine.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                          — All engineering rules
Read CLAUDE.md                                 — Project context + architecture
Read supabase/prod_schema.sql                  — Canonical schema (§1) — ai_hallucinations, content_drafts
Read lib/supabase/database.types.ts            — TypeScript DB types (§38)
Read src/__fixtures__/golden-tenant.ts          — Golden Tenant fixtures (§4)
Read lib/types/ground-truth.ts                 — Ground truth types for hours, amenities (§9)
Read lib/services/ai-audit.service.ts          — Fear Engine — how hallucinations are detected
Read lib/autopilot/                            — Autopilot content draft generation pattern
Read lib/schema-generator/                     — Schema generator pure functions (Sprint 70)
Read app/dashboard/page.tsx                    — Main dashboard with hallucination AlertFeed
Read app/dashboard/content-drafts/actions.ts   — Content draft actions (approve, reject, create)
Read lib/plan-enforcer.ts                      — canRunAutopilot() (Growth+)
Read lib/ai/providers.ts                       — Model keys (§19.3)
```

---

## 🏗️ Architecture — What to Build

### Component 1: Correction Generator Service — `lib/services/correction-generator.service.ts`

**Pure service** — takes hallucination data + ground truth as input, returns correction content. No Supabase client import (caller passes data in). No AI calls — content is built from ground truth templates, not LLM-generated text.

**Why no AI call?** Correction content must be factually accurate. Using an LLM to generate a correction for an LLM hallucination risks generating a new hallucination. All correction text is built deterministically from verified ground truth data already stored in the `locations` table.

```typescript
import type { HoursData, Amenities } from '@/lib/types/ground-truth';

// ── Input ──────────────────────────────────────────────

export interface CorrectionInput {
  /** The hallucination record */
  hallucination: {
    id: string;
    claim_text: string;
    expected_truth: string | null;
    category: string | null;
    severity: string;
    model_provider: string;
  };

  /** Ground truth from the locations table */
  location: {
    business_name: string;
    address_line1: string;
    city: string;
    state: string;
    zip: string;
    phone: string | null;
    website_url: string | null;
    hours_data: HoursData | null;
    amenities: Amenities | null;
    categories: string[] | null;
    operational_status: string | null;
  };
}

// ── Output ─────────────────────────────────────────────

export interface CorrectionPackage {
  /** Human-readable diagnosis: why AI got this wrong */
  diagnosis: string;

  /** Ranked correction actions (highest impact first) */
  actions: CorrectionAction[];

  /** Ready-to-use content pieces */
  content: {
    /** Google Business Profile post draft */
    gbpPost: string | null;
    /** Website "About" section correction snippet */
    websiteSnippet: string | null;
    /** llms.txt correction notice for AI crawlers */
    llmsTxtEntry: string;
    /** Social media post (generic, works for Instagram/Facebook) */
    socialPost: string | null;
  };
}

export interface CorrectionAction {
  /** Short title, e.g. "Update Google Business Profile" */
  title: string;
  /** Description of what to do */
  description: string;
  /** Estimated impact: 'high' | 'medium' | 'low' */
  impact: 'high' | 'medium' | 'low';
  /** Where to take this action */
  platform: 'gbp' | 'website' | 'llms_txt' | 'social' | 'yelp' | 'review_response';
}
```

#### Correction Logic by Hallucination Category

The `category` field on `ai_hallucinations` categorizes the type of misinformation. Build correction templates for each:

```typescript
/**
 * Pure function — generates a correction package from hallucination + ground truth.
 * No I/O, no AI calls, no side effects.
 */
export function generateCorrectionPackage(input: CorrectionInput): CorrectionPackage { ... }
```

**Category handlers:**

| Category | Diagnosis Template | GBP Post | Website Snippet | llms.txt Entry |
|----------|-------------------|----------|----------------|----------------|
| `hours` | "AI has incorrect hours. Your verified hours: {formatted_hours}" | "📍 Our current hours: {hours}. Visit us tonight!" | "Open {formatted_hours}. Updated {date}." | "CORRECTION: {business} hours are {hours}. Previous AI claims of {claim} are incorrect." |
| `closed` / `permanently_closed` | "AI incorrectly states you are closed. You are actively operating." | "🟢 We're OPEN! Visit us at {address}. {hours_today}" | "{business} is OPEN and actively serving customers at {address}." | "CORRECTION: {business} is NOT permanently closed. Status: OPERATIONAL. Verified: {date}." |
| `address` | "AI has the wrong address. Your verified address: {address}" | "📍 Find us at {full_address}!" | "Located at {full_address}" | "CORRECTION: {business} address is {address}, NOT {claim}." |
| `phone` | "AI has the wrong phone number." | "📞 Call us at {phone}" | "Call {phone}" | "CORRECTION: {business} phone is {phone}." |
| `menu` | "AI has incorrect menu information." | "🍽️ Check our latest menu at {website_url}" | "View our current menu at {url}" | "CORRECTION: For current menu, visit {website_url}." |
| `amenities` | "AI has incorrect amenity claims." | Post about the specific amenity | Amenity correction | "CORRECTION: {business} {does/does not} offer {amenity}." |
| Default (unknown category) | "AI has inaccurate information. Verified data below." | Generic "We're here!" post | Generic correction | Generic correction with all verified data |

**Template interpolation uses ground truth only.** Never include the hallucinated claim in generated correction content (except in the `llms.txt` entry where it's explicitly labeled as incorrect).

#### Hours Formatting Helper

Reuse or import the hours formatting logic from `lib/schema-generator/hours-schema.ts` or create a lightweight formatter:

```typescript
/**
 * Format hours_data into human-readable string.
 * Uses ground truth types from lib/types/ground-truth.ts (AI_RULES §9).
 */
export function formatHoursForCorrection(hours: HoursData): string { ... }

// Example output: "Tue–Thu 5pm–1am, Fri–Sat 5pm–2am, Sun 5pm–1am, Mon closed"
```

---

### Component 2: Data Fetcher — `lib/data/correction-generator.ts`

Fetches hallucination + ground truth data, calls the pure service.

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { generateCorrectionPackage, type CorrectionInput, type CorrectionPackage } from '@/lib/services/correction-generator.service';

/**
 * Fetches hallucination + location ground truth, generates correction package.
 */
export async function fetchCorrectionPackage(
  supabase: SupabaseClient<Database>,
  hallId: string,
  orgId: string
): Promise<CorrectionPackage | null> {
  // 1. Fetch hallucination by id + org_id (belt-and-suspenders §18)
  const { data: hall } = await supabase
    .from('ai_hallucinations')
    .select('id, claim_text, expected_truth, category, severity, model_provider')
    .eq('id', hallId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!hall) return null;

  // 2. Fetch primary location with ground truth
  const { data: location } = await supabase
    .from('locations')
    .select('business_name, address_line1, city, state, zip, phone, website_url, hours_data, amenities, categories, operational_status')
    .eq('org_id', orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) return null;

  // 3. Cast JSONB columns per AI_RULES §38.4
  const input: CorrectionInput = {
    hallucination: {
      id: hall.id,
      claim_text: hall.claim_text,
      expected_truth: hall.expected_truth,
      category: hall.category,
      severity: hall.severity ?? 'high',
      model_provider: hall.model_provider,
    },
    location: {
      ...location,
      hours_data: location.hours_data as HoursData | null,
      amenities: location.amenities as Amenities | null,
      categories: location.categories as string[] | null,
    },
  };

  return generateCorrectionPackage(input);
}
```

---

### Component 3: Server Action — `app/dashboard/actions/correction.ts`

```typescript
'use server';

import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchCorrectionPackage } from '@/lib/data/correction-generator';
import type { CorrectionPackage } from '@/lib/services/correction-generator.service';
import { z } from 'zod/v4';

const GenerateCorrectionSchema = z.object({
  hallucinationId: z.string().uuid(),
});

/**
 * Server Action: Generate correction content for a specific hallucination.
 * Uses getSafeAuthContext() per AI_RULES §3.
 * User-initiated (button click) — not on page load (AI_RULES §5).
 */
export async function generateCorrection(formData: FormData): Promise<
  { success: true; data: CorrectionPackage } |
  { success: false; error: string }
> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const parsed = GenerateCorrectionSchema.safeParse({
    hallucinationId: formData.get('hallucinationId'),
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const result = await fetchCorrectionPackage(supabase, parsed.data.hallucinationId, ctx.orgId);

  if (!result) return { success: false, error: 'Hallucination or location not found' };

  return { success: true, data: result };
}

/**
 * Server Action: Create a content_draft from a correction action.
 * Converts a CorrectionPackage content piece into a content_draft
 * that enters the Autopilot HITL approval pipeline.
 */
export async function createCorrectionDraft(formData: FormData): Promise<
  { success: true; draftId: string } |
  { success: false; error: string }
> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const hallucinationId = formData.get('hallucinationId') as string;
  const contentType = formData.get('contentType') as string; // 'gbp_post' | 'blog_post'
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  if (!hallucinationId || !contentType || !title || !content) {
    return { success: false, error: 'Missing required fields' };
  }

  const supabase = await createClient();

  // Get primary location
  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  const { data: draft, error } = await supabase
    .from('content_drafts')
    .insert({
      org_id: ctx.orgId,
      location_id: location?.id ?? null,
      trigger_type: 'hallucination_correction',
      trigger_id: hallucinationId,
      draft_title: title,
      draft_content: content,
      content_type: contentType,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) return { success: false, error: 'Failed to create draft' };

  return { success: true, draftId: draft.id };
}
```

---

### Component 4: Migration — Add `hallucination_correction` trigger type

The `content_drafts.trigger_type` column has a CHECK constraint that only allows: `competitor_gap`, `occasion`, `prompt_missing`, `first_mover`, `manual`. We need to add `hallucination_correction`.

#### `supabase/migrations/20260227000004_hallucination_correction_trigger.sql`

```sql
-- Sprint 75: Add 'hallucination_correction' to content_drafts trigger_type CHECK constraint.

-- Drop and recreate the CHECK constraint with the new value
ALTER TABLE public.content_drafts
  DROP CONSTRAINT IF EXISTS content_drafts_trigger_type_check;

ALTER TABLE public.content_drafts
  ADD CONSTRAINT content_drafts_trigger_type_check
  CHECK (trigger_type::text = ANY (ARRAY[
    'competitor_gap', 'occasion', 'prompt_missing',
    'first_mover', 'manual', 'hallucination_correction'
  ]::text[]));
```

**Update `prod_schema.sql`:** Add `'hallucination_correction'` to the trigger_type CHECK constraint.

---

### Component 5: Dashboard UI — "Fix This" Button on Hallucination Alerts

#### 5A: Correction Panel — `app/dashboard/_components/CorrectionPanel.tsx`

**Client Component** (`'use client'`) — triggered by clicking "Fix This" on a hallucination alert. Uses `useTransition()` for the server action call.

```
┌─────────────────────────────────────────────────────────────────┐
│  🔧 Correction Package                                   [✕]   │
│                                                                   │
│  📋 Diagnosis                                                    │
│  AI incorrectly states Charcoal N Chill is permanently closed.   │
│  Your business is actively operating at 11950 Jones Bridge Rd.   │
│                                                                   │
│  🎯 Recommended Actions                                          │
│  ─────────────────────────────────────────────────────────────── │
│  1. 🟢 HIGH — Update Google Business Profile                    │
│     Post a fresh update confirming you're open.                  │
│     [Create GBP Post Draft →]                                    │
│                                                                   │
│  2. 🟡 MEDIUM — Update Website                                  │
│     Add a clear "we're open" statement to your homepage.         │
│     [Copy Website Snippet]                                        │
│                                                                   │
│  3. 🔵 LOW — Update llms.txt                                    │
│     Add correction notice for AI crawlers.                       │
│     [Copy llms.txt Entry]                                         │
│                                                                   │
│  ─────────────────────────────────────────────────────────────── │
│  📝 Generated Content Preview                                    │
│                                                                   │
│  GBP Post:                                                        │
│  "🟢 We're OPEN! Visit Charcoal N Chill at 11950 Jones Bridge   │
│   Road, Alpharetta. Open Tue–Sun starting at 5pm. Come enjoy     │
│   our premium hookah and Indo-American fusion cuisine!"           │
│                                                                   │
│  llms.txt Entry:                                                  │
│  "CORRECTION: Charcoal N Chill is NOT permanently closed.        │
│   Status: OPERATIONAL. Hours: Tue–Thu 5pm–1am, Fri–Sat 5pm–2am, │
│   Sun 5pm–1am. Verified: Feb 27, 2026."                          │
│                                                                   │
│  [Create Draft for Approval]  [Copy All to Clipboard]             │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- "Fix This" button calls `generateCorrection()` server action via `formData` with `hallucinationId`.
- Panel shows while `isPending` with a loading spinner.
- "Create GBP Post Draft" calls `createCorrectionDraft()` — creates a `content_drafts` row with `trigger_type='hallucination_correction'`, then redirects to `/dashboard/content-drafts`.
- "Copy" buttons use `navigator.clipboard.writeText()` with a brief "Copied!" toast.
- Plan gating: "Create Draft" button requires `canRunAutopilot(plan)` (Growth+). Starter/Trial users see the content preview but with a "Upgrade to Growth to auto-create drafts" message. Copy buttons work for all tiers.
- Impact badges: HIGH = green, MEDIUM = amber, LOW = blue — literal Tailwind classes (AI_RULES §12).

#### 5B: Integration into Existing Alert Feed

Read the existing `AlertFeed` or hallucination display component on the main dashboard. Add a "Fix This" button to each hallucination alert card:

```tsx
<button
  onClick={() => setSelectedHallId(alert.id)}
  className="text-sm text-indigo-400 hover:text-indigo-300"
>
  Fix This →
</button>
```

When clicked, the `CorrectionPanel` slides open (or renders inline) with the correction package for that hallucination.

---

### Component 6: Golden Tenant Fixture — `src/__fixtures__/golden-tenant.ts`

```typescript
/**
 * Sprint 75 — Canonical CorrectionInput fixture for Charcoal N Chill.
 * Uses a "permanently closed" hallucination — the most common and impactful type.
 */
export const MOCK_CORRECTION_INPUT: import('@/lib/services/correction-generator.service').CorrectionInput = {
  hallucination: {
    id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    claim_text: 'Charcoal N Chill appears to be permanently closed.',
    expected_truth: 'Charcoal N Chill is actively operating at 11950 Jones Bridge Road Ste 103, Alpharetta, GA.',
    category: 'closed',
    severity: 'critical',
    model_provider: 'openai-gpt4o',
  },
  location: {
    business_name: 'Charcoal N Chill',
    address_line1: '11950 Jones Bridge Road Ste 103',
    city: 'Alpharetta',
    state: 'GA',
    zip: '30005',
    phone: '(470) 546-4866',
    website_url: 'https://charcoalnchill.com',
    hours_data: {
      monday: 'closed',
      tuesday: { open: '17:00', close: '01:00' },
      wednesday: { open: '17:00', close: '01:00' },
      thursday: { open: '17:00', close: '01:00' },
      friday: { open: '17:00', close: '02:00' },
      saturday: { open: '17:00', close: '02:00' },
      sunday: { open: '17:00', close: '01:00' },
    },
    amenities: {
      has_outdoor_seating: true,
      serves_alcohol: true,
      has_hookah: true,
      is_kid_friendly: false,
      takes_reservations: true,
      has_live_music: true,
      has_dj: true,
      has_private_rooms: true,
    },
    categories: ['Hookah Bar', 'Indian Restaurant', 'Fusion Restaurant', 'Lounge'],
    operational_status: 'OPERATIONAL',
  },
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/correction-generator-service.test.ts`

**Target: `lib/services/correction-generator.service.ts`**

```
describe('generateCorrectionPackage')
  Category-specific corrections:
  1.  generates GBP post for "closed" hallucination with business hours
  2.  generates website snippet for "closed" hallucination with address
  3.  generates llms.txt entry for "closed" hallucination with OPERATIONAL status
  4.  generates corrections for "hours" hallucination with formatted hours
  5.  generates corrections for "address" hallucination with verified address
  6.  generates corrections for "phone" hallucination with verified phone
  7.  generates corrections for "menu" hallucination with website URL
  8.  generates corrections for "amenities" hallucination
  9.  generates generic corrections for unknown category

  Diagnosis:
  10. includes model_provider name in diagnosis (e.g. "GPT-4o claims...")
  11. includes the hallucinated claim in diagnosis for context
  12. includes verified ground truth in diagnosis

  Actions ranking:
  13. ranks actions by impact (high → medium → low)
  14. includes GBP update as high-impact action for closed hallucination
  15. includes website update as medium-impact action
  16. includes llms.txt update in all correction packages

  Content quality:
  17. GBP post does NOT include the hallucinated claim (no amplification)
  18. GBP post includes business name, address, and current hours
  19. llms.txt entry includes both the correction and the false claim (labeled)
  20. website snippet is concise (< 200 chars)
  21. social post is under 280 chars (tweet-length)

  Edge cases:
  22. handles null hours_data (omits hours from content)
  23. handles null phone (omits phone from content)
  24. handles null website_url (omits URL from content)
  25. handles null expected_truth (uses generic correction)
  26. uses MOCK_CORRECTION_INPUT from golden-tenant and produces valid package

describe('formatHoursForCorrection')
  27. formats standard hours: "Tue–Thu 5pm–1am, Fri–Sat 5pm–2am"
  28. handles "closed" day literal correctly
  29. handles missing day keys (omits from output)
  30. handles single-day business (only one day open)
```

**30 tests total. No mocks needed — pure functions.**

### Test File 2: `src/__tests__/unit/correction-data.test.ts`

**Target: `lib/data/correction-generator.ts`**

```
describe('fetchCorrectionPackage')
  1. fetches hallucination by id + org_id
  2. fetches primary location for ground truth
  3. returns null when hallucination not found
  4. returns null when no primary location exists
  5. casts JSONB hours_data and amenities correctly (§38.4)
  6. calls generateCorrectionPackage with assembled input
  7. scopes all queries by org_id (§18)
```

**7 tests total.**

### Test File 3: `src/__tests__/unit/correction-action.test.ts`

**Target: `app/dashboard/actions/correction.ts`**

```
describe('generateCorrection')
  1. returns Unauthorized when no session
  2. returns validation error for invalid UUID
  3. returns success with CorrectionPackage on happy path
  4. passes hallucinationId and orgId to fetchCorrectionPackage

describe('createCorrectionDraft')
  5. returns Unauthorized when no session
  6. returns error when required fields missing
  7. inserts content_draft with trigger_type='hallucination_correction'
  8. sets trigger_id to the hallucination ID
  9. returns draftId on success
```

**9 tests total.**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/services/correction-generator.service.ts` | **CREATE** | Pure correction generator (templates + ground truth) |
| 2 | `lib/data/correction-generator.ts` | **CREATE** | Data fetcher — hallucination + location → correction package |
| 3 | `app/dashboard/actions/correction.ts` | **CREATE** | Server Actions: generateCorrection, createCorrectionDraft |
| 4 | `app/dashboard/_components/CorrectionPanel.tsx` | **CREATE** | Client Component — correction UI panel |
| 5 | `supabase/migrations/20260227000004_hallucination_correction_trigger.sql` | **CREATE** | Add trigger_type value to content_drafts CHECK |
| 6 | `supabase/prod_schema.sql` | **MODIFY** | Update trigger_type CHECK constraint |
| 7 | Main dashboard hallucination display | **MODIFY** | Add "Fix This" button to each alert card |
| 8 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add MOCK_CORRECTION_INPUT fixture |
| 9 | `src/__tests__/unit/correction-generator-service.test.ts` | **CREATE** | 30 tests — pure function |
| 10 | `src/__tests__/unit/correction-data.test.ts` | **CREATE** | 7 tests — data layer |
| 11 | `src/__tests__/unit/correction-action.test.ts` | **CREATE** | 9 tests — server actions |

**Expected test count: 46 new tests across 3 files.**

---

## 🚫 What NOT to Do

1. **DO NOT use AI/LLM to generate correction text.** Using an LLM to correct an LLM hallucination risks a new hallucination. All correction content is built deterministically from verified ground truth data. This is the same philosophy as the Schema Generator (Sprint 70, AI_RULES §39).
2. **DO NOT trigger correction generation on page load** (AI_RULES §5). It's user-initiated via the "Fix This" button.
3. **DO NOT include the hallucinated claim in the GBP post or website snippet.** Never amplify the misinformation. Only the `llms.txt` entry references the false claim (explicitly labeled as incorrect).
4. **DO NOT use `getAuthContext()` in Server Actions** (AI_RULES §3). Use `getSafeAuthContext()`.
5. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
6. **DO NOT inline plan-tier checks** (AI_RULES §5). Use `canRunAutopilot(plan)` for draft creation gating.
7. **DO NOT invent ad-hoc type definitions for hours_data or amenities** (AI_RULES §9). Import from `lib/types/ground-truth.ts`.
8. **DO NOT create files under `supabase/functions/`** (AI_RULES §6).
9. **DO NOT hardcode business data in templates** (AI_RULES §20). All content interpolates from the ground truth input.
10. **DO NOT modify the hallucination `correction_status`** in this sprint. Status workflow (open → verifying → fixed) is a future sprint concern.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `lib/services/correction-generator.service.ts` — Pure function, no I/O, ground-truth templates for 7+ categories
- [ ] `lib/data/correction-generator.ts` — Data fetcher with JSONB casting
- [ ] `app/dashboard/actions/correction.ts` — Two Server Actions with `getSafeAuthContext()`
- [ ] `app/dashboard/_components/CorrectionPanel.tsx` — Client Component with diagnosis, actions, content preview, copy/draft buttons
- [ ] "Fix This" button added to hallucination alerts on dashboard
- [ ] Migration adds `hallucination_correction` to `content_drafts` trigger_type CHECK
- [ ] `prod_schema.sql` updated
- [ ] `MOCK_CORRECTION_INPUT` added to golden-tenant
- [ ] `npx vitest run src/__tests__/unit/correction-generator-service.test.ts` — 30 tests passing
- [ ] `npx vitest run src/__tests__/unit/correction-data.test.ts` — 7 tests passing
- [ ] `npx vitest run src/__tests__/unit/correction-action.test.ts` — 9 tests passing
- [ ] `npx vitest run` — ALL tests passing, no regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-28 — Sprint 75: Hallucination → Correction Content Generator (Completed)

**Goal:** Close the Fear Engine loop by generating actionable correction content for each detected hallucination — a GBP post draft, website correction snippet, llms.txt correction notice, and social post — all built deterministically from verified ground truth data. No AI calls.

**Scope:**
- `lib/services/correction-generator.service.ts` — **NEW.** Pure correction generator (~300 lines). Exports: `generateCorrectionPackage()` (category-based template system for 7+ hallucination types: closed, hours, address, phone, menu, amenities, generic), `formatHoursForCorrection()` (human-readable hours from HoursData). Generates 4 content pieces per hallucination: GBP post, website snippet, llms.txt entry, social post. All content from ground truth — zero AI calls. GBP/website content never amplifies the hallucinated claim.
- `lib/data/correction-generator.ts` — **NEW.** Data fetcher. Queries `ai_hallucinations` by id+org_id, fetches primary location ground truth, casts JSONB columns (§38.4), assembles `CorrectionInput`, delegates to pure service.
- `app/dashboard/actions/correction.ts` — **NEW.** Two Server Actions: `generateCorrection(formData)` — Zod-validated UUID, fetches correction package. `createCorrectionDraft(formData)` — creates `content_drafts` row with `trigger_type='hallucination_correction'`, `trigger_id` = hallucination UUID.
- `app/dashboard/_components/CorrectionPanel.tsx` — **NEW.** Client Component. Shows diagnosis, ranked actions (HIGH/MEDIUM/LOW impact badges), content previews, copy-to-clipboard buttons, "Create Draft for Approval" button (plan-gated via `canRunAutopilot`). Uses `useTransition()` for server action calls.
- Dashboard hallucination alerts — **MODIFIED.** Added "Fix This →" button to each alert card, opens CorrectionPanel for that hallucination.
- `supabase/migrations/20260227000004_hallucination_correction_trigger.sql` — **NEW.** Adds `hallucination_correction` to `content_drafts.trigger_type` CHECK constraint.
- `supabase/prod_schema.sql` — **MODIFIED.** Updated trigger_type CHECK.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_CORRECTION_INPUT` fixture (permanently-closed hallucination + full Charcoal N Chill ground truth).

**Tests added:**
- `src/__tests__/unit/correction-generator-service.test.ts` — **N Vitest tests.** Category-specific corrections (7 types), diagnosis quality, action ranking, content quality rules (no claim amplification, length limits), hours formatting, edge cases (null fields).
- `src/__tests__/unit/correction-data.test.ts` — **N Vitest tests.** Data fetching, JSONB casting, null handling, org scoping.
- `src/__tests__/unit/correction-action.test.ts` — **N Vitest tests.** Auth guard, validation, happy paths for both actions, trigger_type='hallucination_correction'.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/correction-generator-service.test.ts  # N tests passing
npx vitest run src/__tests__/unit/correction-data.test.ts               # N tests passing
npx vitest run src/__tests__/unit/correction-action.test.ts             # N tests passing
npx vitest run                                                          # All tests passing
```

**Note:** Replace N with actual test counts verified via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `ai_hallucinations` table with `claim_text`, `expected_truth`, `category` | Initial schema | Hallucination data to correct |
| `content_drafts` table + Autopilot pipeline | Sprint 48 | Draft creation → HITL approval → publish flow |
| Ground truth types (`HoursData`, `Amenities`) | All sprints (§9) | Type-safe ground truth access |
| Schema Generator pure function pattern | Sprint 70 (§39) | Architectural pattern: pure functions, no I/O, ground truth only |
| `canRunAutopilot()` plan gating | Sprint 48 | Draft creation is Growth+ |
| `getSafeAuthContext()` auth pattern | All sprints (§3) | Server Action auth |
| Dashboard AlertFeed / hallucination display | Sprint 42+ | Existing UI to add "Fix This" button |

---

## 🧠 Edge Cases to Handle

1. **Hallucination with null `category`:** Use the generic/default correction template. Don't crash.
2. **Hallucination with null `expected_truth`:** Build correction from location ground truth alone. The diagnosis says "AI has inaccurate information about your business."
3. **Location with null `hours_data`:** Omit hours from all generated content. GBP post focuses on address and "we're open" message.
4. **Location with null `phone`:** Omit phone from content. Not all businesses have phone numbers.
5. **Location with null `website_url`:** Omit website link from content. Still generate GBP post and llms.txt.
6. **"Fix This" clicked but location deleted:** `fetchCorrectionPackage` returns `null` → show error state: "Could not generate correction — location data not found."
7. **Correction draft for a hallucination that's already been fixed:** Allow it — the user might want to create correction content proactively. Don't check `correction_status`.
8. **Multiple hallucinations for the same claim:** Each hallucination gets its own correction package. Deduplication is a future concern.
9. **Trial/Starter plan:** Users can view the correction package and copy content (free), but cannot create a content_draft (requires Growth+ via `canRunAutopilot`). The "Create Draft" button shows an upgrade prompt.

---

## 🔮 AI_RULES Update

```markdown
## 41. 🔧 Correction Content Is Ground-Truth Only — No AI Generation (Sprint 75)

Correction content for hallucinations is generated deterministically from verified ground truth data. **No AI/LLM calls** are used to generate correction text.

* **Why:** Using an LLM to correct an LLM hallucination risks producing a new hallucination. Correction content must be factually verifiable.
* **Pattern:** `generateCorrectionPackage()` in `lib/services/correction-generator.service.ts` uses template interpolation with data from the `locations` table (hours, address, amenities, etc.).
* **Never amplify:** GBP posts, website snippets, and social posts MUST NOT include the hallucinated claim. Only `llms.txt` entries reference the false claim (explicitly labeled as incorrect) because AI crawlers need to see the correction paired with the error.
* **Ground truth imports:** Always use types from `lib/types/ground-truth.ts` (§9) for hours_data, amenities, etc.
* **Content_drafts trigger_type:** Correction drafts use `trigger_type='hallucination_correction'` with `trigger_id` pointing to the `ai_hallucinations.id`.
```
