# Sprint 104 — Content Grader Completion

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

The Content Grader infrastructure (Doc 17) is ~80% built. The AEO auditor, HTML parser, monthly cron, UI cards, and static schema generator all exist. Three things are missing that make the feature passive rather than actionable:

**Gap 1 — No on-demand audit.** Users cannot submit a new URL. `reauditPage()` only re-runs audits for URLs already in the `page_audits` table. The empty state says "Your first results will appear after the next scan cycle" — a dead end. Doc 17 §3.2 lists on-demand auditing as the primary user trigger.

**Gap 2 — No AI-generated FAQ.** When an audit finds `faqSchemaPresent === false`, the recommendation says "Add FAQPage schema" without giving the actual schema. Doc 17 §4 defines `generateAiFaqSet()` — a GPT-4o-mini call that produces 5 realistic Q&A pairs personalized to the business, formatted as ready-to-paste JSON-LD. The static `generateFAQPageSchema()` in `lib/schema-generator/faq-schema.ts` exists but uses SOV query templates, not AI generation. The dynamic version is missing entirely.

**Gap 3 — Single-page seed data.** Only the homepage audit exists in `seed.sql`. The UI always shows a single card — impossible to see how multi-page scoring and aggregate AEO scores work in development.

This sprint closes all three gaps. No migrations, no new routes, no new sidebar entries. Pure feature completion.

**Audit gap closed:** Item #7 — "Content Grader: on-demand audit missing, AI FAQ generator not implemented." (0% → 100%)

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                            — All rules. Key: §2 (no as any), §5 (no AI on page load), §12 (no dynamic Tailwind), §13 (DEVLOG format)
Read docs/CLAUDE.md                                              — Project context
Read DEVLOG.md                                                   — Sprint history. Latest: 101, FIX-9, 102, 103
Read docs/17-CONTENT-GRADER.md                                   — Full spec. §4 = FAQ auto-generator. §3.2 = on-demand trigger. §5 = recommendation delivery.
Read lib/page-audit/auditor.ts                                   — auditPage() signature, LocationContext type, PageAuditRecommendation type, DimensionKey
Read lib/page-audit/html-parser.ts                               — parsePage() — understand what the auditor consumes
Read app/dashboard/page-audits/actions.ts                        — reauditPage() — the server action to extend with addPageAudit()
Read app/dashboard/page-audits/schema-actions.ts                 — generateSchemaFixes() — wire AI FAQ into this
Read app/dashboard/page-audits/page.tsx                          — Full page — empty state + main state to update with URL input
Read app/dashboard/page-audits/_components/PageAuditCard.tsx     — How "Generate Schema Fix" button works — understand the onGenerateSchema prop chain
Read app/dashboard/page-audits/_components/SchemaFixPanel.tsx    — How GeneratedSchema is displayed — JSON-LD, description, estimatedImpact
Read lib/schema-generator/types.ts                               — GeneratedSchema type — faq-generator must return this
Read lib/schema-generator/faq-schema.ts                          — Static FAQ generator (Sprint 70) — AI generator is separate, not a replacement
Read lib/schema-generator/index.ts                               — What's exported — do NOT re-export the new AI generator from here
Read lib/ai/providers.ts                                         — getModel(), hasApiKey(), ModelKey type — how to add new model key
Read lib/plan-enforcer.ts                                        — canRunPageAudit() — Growth/Agency only
Read src/__fixtures__/golden-tenant.ts                           — Golden Tenant (org_id: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11, website: https://charcoalnchill.com)
Read supabase/seed.sql                                           — Lines 1393–1430 — existing homepage page_audit row to understand format
Read src/__tests__/unit/page-auditor.test.ts                     — Test patterns: fetch mocking, AI SDK mocking, makeHtml() helper
Read src/__tests__/unit/reaudit-action.test.ts                   — Test pattern for server action tests: mock Supabase, mock auth
Read src/__tests__/unit/schema-generator-faq.test.ts             — Do not duplicate — understand what's already covered
```

**Specifically understand before writing code:**
- `reauditPage()` requires the page to already exist in `page_audits` — `addPageAudit()` is for new URLs
- `generateSchemaFixes()` in `schema-actions.ts` calls static generators (FAQ via SOV queries, Hours, LocalBusiness) — the AI FAQ generator runs separately and is triggered only when `faqSchemaPresent === false`
- `GeneratedSchema` from `lib/schema-generator/types.ts` is what `SchemaFixPanel` consumes — the AI FAQ must return this exact type
- Model key `'greed-intercept'` = gpt-4o-mini — used in auditor.ts for Answer-First scoring, same pattern for FAQ generation
- `hasApiKey('openai')` returns `false` in test env — both AI paths need fallback static content
- AI_RULES §5: never trigger AI calls on page load — FAQ generation is user-triggered only
- `PageType` is `'homepage' | 'menu' | 'about' | 'faq' | 'events' | 'occasion' | 'other'` — `inferPageType()` logic already exists in the cron (replicate, don't import from there)
- `onConflict: 'org_id,page_url'` — the upsert constraint for `page_audits`

---

## 🏗️ Architecture — What to Build

### Component 1: AI FAQ Generator — `lib/page-audit/faq-generator.ts`

**New file.** Implements Doc 17 §4. Generates 5 business-specific Q&A pairs using GPT-4o-mini, formats as ready-to-paste JSON-LD, returns a `GeneratedSchema` so it slots directly into `SchemaFixPanel`.

```typescript
// ---------------------------------------------------------------------------
// lib/page-audit/faq-generator.ts — AI FAQ Auto-Generator (Sprint 104)
//
// Generates 5 realistic customer Q&A pairs for a business using GPT-4o-mini.
// Produces ready-to-paste FAQPage JSON-LD schema.
//
// Called when: page audit finds faqSchemaPresent === false AND user clicks
// "Generate Schema Fix" (AI_RULES §5 — never on page load).
//
// Returns GeneratedSchema (same type as static generators) so it renders
// identically in SchemaFixPanel without UI changes.
//
// Spec: docs/17-CONTENT-GRADER.md §4
// ---------------------------------------------------------------------------
```

**Add model key to `lib/ai/providers.ts`:**

The `ModelKey` type and `MODELS` map need a new entry for FAQ generation. Add:
```typescript
'faq-generation': openai('gpt-4o-mini'),
```

Add `'faq-generation'` to the `ModelKey` union type and to the `MODELS` object. Follow the exact pattern of the existing entries.

**AI prompt (Doc 17 §4.1):**

```typescript
const prompt = `Generate 5 FAQ questions and answers for a ${pageType} page for this business:

Business: ${businessName}
Category: ${primaryCategory}
City: ${city}, ${state}
Page purpose: ${pageType}

Requirements:
- Questions must be realistic queries a customer would type into ChatGPT or Perplexity
- Answers must be direct (Answer-First), factual, and ≤ 50 words
- Include the business name and city naturally in at least 2 answers
- Mix of operational questions (hours, parking, reservations) and experiential ("What is the vibe at...")

Return JSON only, no markdown:
{
  "faqs": [
    { "question": "...", "answer": "..." }
  ]
}`;
```

**AI path:**

```typescript
const { text } = await generateText({
  model: getModel('faq-generation'),
  prompt,
  temperature: 0.4,
});

// Strip markdown code fences if present (defensive)
const clean = text.replace(/```json\n?|\n?```/g, '').trim();
const parsed = JSON.parse(clean);
const faqs = parsed.faqs as Array<{ question: string; answer: string }>;
```

**Fallback (no API key or parse error):**

Generate 5 static Q&A pairs from `LocationContext` data — do not call the AI. Pattern:

```typescript
function staticFaqFallback(location: LocationContext, pageType: string): Array<{ question: string; answer: string }> {
  const name = location.business_name;
  const city = location.city ?? 'our area';
  const category = location.categories?.[0] ?? 'business';

  return [
    {
      question: `What is ${name}?`,
      answer: `${name} is a ${category} located in ${city}. Visit us to experience our full menu and atmosphere.`,
    },
    {
      question: `Where is ${name} located?`,
      answer: `${name} is located in ${city}${location.state ? `, ${location.state}` : ''}.`,
    },
    {
      question: `What are the hours for ${name}?`,
      answer: `Please visit our website or call us for current hours. We update our schedule regularly.`,
    },
    {
      question: `Does ${name} take reservations?`,
      answer: `Contact ${name} directly for reservation availability and booking information.`,
    },
    {
      question: `What makes ${name} unique in ${city}?`,
      answer: `${name} stands out as a premier ${category} in ${city}, offering a distinctive experience for our guests.`,
    },
  ];
}
```

**`buildFaqSchema()` — JSON-LD builder (Doc 17 §4.2):**

```typescript
function buildFaqSchema(faqs: Array<{ question: string; answer: string }>): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
  return JSON.stringify(schema, null, 2);
}
```

**Main export:**

```typescript
export interface FaqGenerationInput {
  location: LocationContext;
  pageType: string;
}

export async function generateAiFaqSet(input: FaqGenerationInput): Promise<GeneratedSchema> {
  // ... AI call with fallback ...
  const jsonLdString = buildFaqSchema(faqs);
  return {
    schemaType: 'FAQPage',
    jsonLd: JSON.parse(jsonLdString),
    jsonLdString,
    description: `AI-generated FAQ schema with ${faqs.length} questions tailored to ${input.location.business_name}. Paste into your website <head>.`,
    estimatedImpact: 'Est. +20 AEO score points — FAQPage schema is the #1 driver of AI citation probability.',
    missingReason: 'No FAQPage structured data found on your website.',
  };
}
```

**Important:** `LocationContext` is already defined in `lib/page-audit/auditor.ts`. Import it from there — do not redefine it.

---

### Component 2: Wire AI FAQ into Schema Actions — `app/dashboard/page-audits/schema-actions.ts`

**Modify the existing file.** When `generateSchemaFixes()` is called, check whether the current org's primary location has a page audit with `faqSchemaPresent === false`. If so, call `generateAiFaqSet()` and include the result alongside the static schemas.

**Current flow:** `generateSchemaFixes()` always generates 3 static schemas (FAQ from SOV, Hours, LocalBusiness).

**New flow:** `generateSchemaFixes()` generates the 3 static schemas as before. Additionally, if the org's most recent page audit has `faqSchemaPresent === false`, prepend the AI-generated FAQ schema to the result. Since the AI-generated FAQ is more personalized, it appears first in the `SchemaFixPanel` tabs.

**Implementation:**

```typescript
// After generating static schemas:

// Check if FAQ schema is missing from most recent audit
const { data: recentAudit } = await supabase
  .from('page_audits')
  .select('faq_schema_present, location_id, page_type, page_url')
  .eq('org_id', ctx.orgId)
  .order('last_audited_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (recentAudit?.faq_schema_present === false) {
  // Fetch location context for the AI generator
  const { data: location } = await supabase
    .from('locations')
    .select('business_name, city, state, categories, amenities')
    .eq('id', recentAudit.location_id ?? '')
    .maybeSingle();

  if (location) {
    const aiSchema = await generateAiFaqSet({
      location: {
        business_name: location.business_name,
        city: location.city,
        state: location.state,
        categories: location.categories as string[] | null,
        amenities: location.amenities as Record<string, boolean | undefined> | null,
      },
      pageType: recentAudit.page_type,
    });
    // Prepend AI FAQ (more specific) before static FAQ
    schemas.unshift(aiSchema);
  }
}
```

**Note:** `SchemaFixPanel` deduplicates by `schemaType` for the tab display. Both the AI and static FAQ generators return `schemaType: 'FAQPage'`. The first one in the array wins — the AI-generated one. The static one is silently dropped. This is intentional: when AI generation succeeds, we don't want two FAQ tabs.

**Deduplication guard:** After building the `schemas` array, add:
```typescript
// Deduplicate: keep first occurrence of each schemaType
const seen = new Set<string>();
const dedupedSchemas = schemas.filter((s) => {
  if (seen.has(s.schemaType)) return false;
  seen.add(s.schemaType);
  return true;
});
return { success: true, schemas: dedupedSchemas };
```

---

### Component 3: `addPageAudit()` Server Action — `app/dashboard/page-audits/actions.ts`

**Add to the existing file.** New export alongside `reauditPage()`.

```typescript
// ---------------------------------------------------------------------------
// addPageAudit — Submit a new URL for on-demand AEO audit (Sprint 104)
//
// Doc 17 §3.2: "On-demand (user clicks 'Audit')"
// Plan gate: Growth/Agency only (canRunPageAudit).
// Rate limit: 1 audit per URL per 5 minutes (same as reauditPage).
// Type inference: mirrors inferPageType() from the monthly cron.
// ---------------------------------------------------------------------------

export async function addPageAudit(
  rawUrl: string,
): Promise<{ success: boolean; error?: string }> {
```

**Implementation requirements:**

1. **Auth:** `getSafeAuthContext()` — return error if no orgId
2. **Plan gate:** Fetch org plan from `organizations` table. Call `canRunPageAudit(plan)`. Return `{ success: false, error: 'Page audits require Growth or Agency plan.' }` if gated.
3. **URL validation:** Ensure `rawUrl` starts with `http://` or `https://`. If not, prepend `https://`. Reject obviously invalid URLs with a clear error message.
4. **Rate limit:** Use the same `reauditTimestamps` Map already in the file (it's module-scoped). Key: `${ctx.orgId}:${normalizedUrl}`.
5. **Page type inference:** Replicate `inferPageType()` locally in this file (don't import from the cron — that's an API route, not a shared lib). Same logic: `/menu` → `'menu'`, `/about` → `'about'`, etc.
6. **Location fetch:** Get the primary location for `location_id` (required for `page_audits` insert):
   ```typescript
   const { data: location } = await supabase
     .from('locations')
     .select('id, business_name, city, state, categories, amenities')
     .eq('org_id', ctx.orgId)
     .eq('is_primary', true)
     .maybeSingle();
   ```
7. **Audit:** Call `auditPage(normalizedUrl, pageType, locationCtx)` — wrap in try/catch. If the page is unreachable, return `{ success: false, error: 'Could not fetch that URL. Is it publicly accessible?' }`.
8. **Upsert:** Same fields and `onConflict: 'org_id,page_url'` as `reauditPage()`.
9. **Revalidate:** `revalidatePath('/dashboard/page-audits')`.

---

### Component 4: URL Input UI — `app/dashboard/page-audits/page.tsx` + new `AddPageAuditForm.tsx`

**Two parts:**

#### Part A — New Client Component: `app/dashboard/page-audits/_components/AddPageAuditForm.tsx`

A self-contained client component that renders a URL input + Audit button, calls `addPageAudit()`, and shows inline feedback.

```typescript
// ---------------------------------------------------------------------------
// AddPageAuditForm — Sprint 104: On-demand URL submission form
//
// Client component. Calls addPageAudit() server action on submit.
// Shows loading state, success message, and error inline.
// AI_RULES §5: action is user-triggered only.
// ---------------------------------------------------------------------------
```

**UI spec:**

```
┌─────────────────────────────────────────────────────────┐
│  [https://yoursite.com/about     ] [Audit Page ↗]       │
│  [error or success message here  ]                      │
└─────────────────────────────────────────────────────────┘
```

- Input: `type="url"`, placeholder `"https://yoursite.com/about"`, `data-testid="audit-url-input"`
- Button: "Audit Page", `data-testid="audit-url-submit"`, disabled during pending
- Loading state: button text becomes "Auditing..." with `disabled`
- Success: green "Audit complete — results updated." message, input clears
- Error: red error message from action result
- Do NOT use `<form>` — use `onClick` handler with `useTransition` (AI_RULES critical UI requirements)
- All Tailwind classes must be literal strings (AI_RULES §12)
- `data-testid="add-page-audit-form"` on the wrapper div

#### Part B — Update `page.tsx`

**Empty state:** Replace the passive "Your first results will appear after the next scan cycle" copy with the `AddPageAuditForm` component and a brief explainer:

```tsx
<div className="space-y-8">
  <div>
    <h1 className="text-xl font-semibold text-white">Page Audits</h1>
    <p className="mt-0.5 text-sm text-[#94A3B8]">
      Score your pages on 5 AEO dimensions to maximize AI visibility.
    </p>
  </div>
  <div data-testid="page-audits-empty" className="rounded-2xl bg-surface-dark border border-white/5 p-8">
    {/* icon */}
    <p className="mt-3 text-sm font-medium text-slate-300">Audit your first page</p>
    <p className="mt-1 max-w-sm text-xs text-slate-500 mb-6">
      Enter any public URL from your website to score it on Answer-First Structure,
      Schema Completeness, FAQ Schema, Keyword Density, and Entity Clarity.
    </p>
    <AddPageAuditForm />
  </div>
</div>
```

**Main state (with existing audits):** Add an "Audit New Page" collapsible section at the top, before `AuditScoreOverview`:

```tsx
{/* Audit New Page — collapsible form */}
<details className="rounded-xl bg-surface-dark border border-white/5 p-4">
  <summary className="cursor-pointer text-sm font-medium text-slate-300 hover:text-white transition-colors list-none flex items-center gap-2">
    <span className="text-electric-indigo">+</span> Audit a new page
  </summary>
  <div className="mt-4">
    <AddPageAuditForm />
  </div>
</details>
```

**Import:** `import AddPageAuditForm from './_components/AddPageAuditForm';`

---

### Component 5: Additional Seed Rows — `supabase/seed.sql`

Add two more page audit rows for the golden tenant so the UI shows multi-page scoring. Add immediately after the existing homepage row (line ~1430).

**About page row:**

```sql
-- Sprint 104: About page audit for golden tenant
INSERT INTO public.page_audits (
  id, org_id, location_id,
  page_url, page_type,
  aeo_readability_score, answer_first_score, schema_completeness_score,
  faq_schema_present, faq_schema_score, entity_clarity_score,
  overall_score, recommendations, last_audited_at, created_at
)
SELECT
  'b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'https://charcoalnchill.com/about',
  'about',
  82,   -- aeo_readability_score (keyword density)
  72,   -- answer_first_score
  45,   -- schema_completeness_score (has some schema but missing required props)
  FALSE, -- faq_schema_present
  0,    -- faq_schema_score
  75,   -- entity_clarity_score (name + address present)
  58,   -- overall_score
  '[{"issue":"No FAQPage schema found — this is the #1 driver of AI citations","fix":"Add FAQPage schema with at least 5 Q&A pairs about Charcoal N Chill.","impactPoints":20,"dimensionKey":"faqSchema","schemaType":"FAQPage"},{"issue":"Missing required JSON-LD schema for about page","fix":"Add LocalBusiness schema with foundingDate and description properties.","impactPoints":15,"dimensionKey":"schemaCompleteness","schemaType":"LocalBusiness"}]'::jsonb,
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO UPDATE SET recommendations = EXCLUDED.recommendations;
```

**FAQ page row (high-scoring — shows what "done" looks like):**

```sql
-- Sprint 104: FAQ page audit for golden tenant (high-scoring reference)
INSERT INTO public.page_audits (
  id, org_id, location_id,
  page_url, page_type,
  aeo_readability_score, answer_first_score, schema_completeness_score,
  faq_schema_present, faq_schema_score, entity_clarity_score,
  overall_score, recommendations, last_audited_at, created_at
)
SELECT
  'b4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'https://charcoalnchill.com/faq',
  'faq',
  90,   -- aeo_readability_score
  85,   -- answer_first_score (FAQ pages naturally answer-first)
  88,   -- schema_completeness_score
  TRUE, -- faq_schema_present
  100,  -- faq_schema_score (≥5 Q&A pairs)
  80,   -- entity_clarity_score
  89,   -- overall_score
  '[]'::jsonb,
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '1 hour'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO UPDATE SET overall_score = EXCLUDED.overall_score;
```

---

### Component 6: Unit Tests — `src/__tests__/unit/faq-generator.test.ts`

**New file.** 15 tests covering the AI FAQ generator.

```
describe('generateAiFaqSet')

  describe('AI path (hasApiKey returns true)')
    1.  calls generateText with model faq-generation
    2.  prompt includes business name, city, category, and pageType
    3.  returns GeneratedSchema with schemaType FAQPage
    4.  jsonLdString is valid JSON parseable as FAQPage schema
    5.  mainEntity array has exactly 5 items (from AI response)
    6.  each mainEntity item has @type Question and acceptedAnswer
    7.  description includes business name
    8.  estimatedImpact mentions +20 AEO score points
    9.  strips markdown code fences from AI response before parsing

  describe('fallback path (hasApiKey returns false)')
    10. returns GeneratedSchema without calling generateText
    11. fallback faqs has exactly 5 items
    12. fallback faqs include business_name in at least one answer
    13. fallback faqs include city in at least one answer

  describe('buildFaqSchema')
    14. produces valid FAQPage JSON-LD structure
    15. mainEntity count matches faqs array length

  describe('error handling')
    16. falls back to static when generateText throws
    17. falls back to static when AI response is malformed JSON
```

**17 tests total.**

**Mock setup:**

```typescript
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));
vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn(),
}));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
```

**AI response mock (valid):**

```typescript
const MOCK_AI_RESPONSE = JSON.stringify({
  faqs: [
    { question: 'What is Charcoal N Chill?', answer: 'Charcoal N Chill is a hookah bar in Alpharetta, GA.' },
    { question: 'Where is Charcoal N Chill located?', answer: 'Located in Alpharetta, GA.' },
    { question: 'What are the hours?', answer: 'Check our website for current hours.' },
    { question: 'Do you take reservations?', answer: 'Yes, contact us to reserve.' },
    { question: 'What makes you unique?', answer: 'Premium hookah and live entertainment in Alpharetta.' },
  ],
});
```

---

### Component 7: Unit Tests — `src/__tests__/unit/add-page-audit.test.ts`

**New file.** 12 tests covering the `addPageAudit()` server action.

```
describe('addPageAudit')

  describe('auth and plan checks')
    1.  returns error when not authenticated (null auth context)
    2.  returns error when orgId is null
    3.  returns error when plan is starter (canRunPageAudit = false)
    4.  proceeds when plan is growth

  describe('URL validation and normalization')
    5.  normalizes URL missing https:// prefix
    6.  accepts valid https:// URL without modification
    7.  returns error for clearly invalid URL (empty string)

  describe('rate limiting')
    8.  returns error when same org+URL audited within 5 minutes

  describe('page type inference')
    9.  infers homepage for root URL
    10. infers about for /about URL
    11. infers faq for /faq URL

  describe('persistence')
    12. calls auditPage() and upserts result to page_audits with correct fields
    13. returns success: true on successful audit and save
```

**13 tests total.**

**Mock setup pattern (same as `reaudit-action.test.ts`):**

```typescript
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: mockAuthContext }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/page-audit/auditor', () => ({ auditPage: mockAuditPage }));
vi.mock('@/lib/plan-enforcer', () => ({ canRunPageAudit: vi.fn().mockReturnValue(true) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
```

---

## 🧪 Full Test Plan

### New tests

```bash
npx vitest run src/__tests__/unit/faq-generator.test.ts
# 17 tests — AI path, fallback, JSON-LD structure, error handling

npx vitest run src/__tests__/unit/add-page-audit.test.ts
# 13 tests — auth, plan gate, URL validation, type inference, persistence
```

### Regression — existing page-audits tests must pass unchanged

```bash
npx vitest run src/__tests__/unit/page-auditor.test.ts
# Must pass — no changes to auditor.ts

npx vitest run src/__tests__/unit/reaudit-action.test.ts
# Must pass — reauditPage() unchanged

npx vitest run src/__tests__/unit/page-audit-dimensions.test.ts
# Must pass

npx vitest run src/__tests__/unit/page-audit-card.test.tsx
# Must pass — PageAuditCard unchanged
```

### TypeScript check

```bash
npx tsc --noEmit
# 0 errors — confirm ModelKey type includes 'faq-generation'
```

### Full suite

```bash
npx vitest run
# All tests passing — zero regressions
# Baseline: ~2543+ tests
```

---

## 📂 Files to Create / Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/page-audit/faq-generator.ts` | **CREATE** | AI-powered FAQ Q&A generator with static fallback — returns `GeneratedSchema` |
| 2 | `lib/ai/providers.ts` | **MODIFY** | Add `'faq-generation'` to `ModelKey` union type and `MODELS` object |
| 3 | `app/dashboard/page-audits/schema-actions.ts` | **MODIFY** | Wire `generateAiFaqSet()` when `faqSchemaPresent === false`; deduplicate by schemaType |
| 4 | `app/dashboard/page-audits/actions.ts` | **MODIFY** | Add `addPageAudit()` export with plan gate, URL validation, type inference, audit + upsert |
| 5 | `app/dashboard/page-audits/_components/AddPageAuditForm.tsx` | **CREATE** | Client component — URL input + Audit button + inline feedback |
| 6 | `app/dashboard/page-audits/page.tsx` | **MODIFY** | Import `AddPageAuditForm`; update empty state; add collapsible "Audit New Page" section |
| 7 | `supabase/seed.sql` | **MODIFY** | Add about + faq page audit rows for golden tenant (ON CONFLICT DO UPDATE) |
| 8 | `src/__tests__/unit/faq-generator.test.ts` | **CREATE** | 17 unit tests for AI FAQ generator |
| 9 | `src/__tests__/unit/add-page-audit.test.ts` | **CREATE** | 13 unit tests for addPageAudit() server action |

**No migrations. No new API routes. No sidebar changes. No new DB tables.**

---

## 🚫 What NOT to Do

1. **DO NOT modify `lib/schema-generator/faq-schema.ts`** — the static FAQ generator (Sprint 70) is separate and stays. It generates FAQ from SOV query templates. The new AI generator is in `lib/page-audit/faq-generator.ts` and generates from business context.
2. **DO NOT export `generateAiFaqSet` from `lib/schema-generator/index.ts`** — it lives in `lib/page-audit/`, a different namespace.
3. **DO NOT trigger `generateAiFaqSet()` on page load** (AI_RULES §5) — it is user-triggered only via the "Generate Schema Fix" button → `generateSchemaFixes()` → `schema-actions.ts`.
4. **DO NOT use `as any`** (AI_RULES §2) — use typed Supabase queries.
5. **DO NOT use `<form>` tags** in React/Client Components — use `onClick` handlers with `useTransition`.
6. **DO NOT import `inferPageType` from the cron route** (`app/api/cron/content-audit/route.ts`) — replicate the logic locally in `actions.ts`.
7. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12) — all color classes literal strings.
8. **DO NOT change `reauditPage()`** — it works correctly for existing pages. `addPageAudit()` is the new companion for new URLs.
9. **DO NOT call `generateAiFaqSet()` with location data from `schema-actions.ts` if `recentAudit?.location_id` is null** — guard with an early return.
10. **DO NOT skip the `canRunPageAudit(plan)` check** in `addPageAudit()` — Starter/Trial users get a clear error, not a 401.

---

## ✅ Definition of Done

- [ ] `lib/page-audit/faq-generator.ts` — created; `generateAiFaqSet()` exported; AI path with `'faq-generation'` model; static fallback when `hasApiKey('openai')` is false; `buildFaqSchema()` internal helper; returns `GeneratedSchema`
- [ ] `lib/ai/providers.ts` — `'faq-generation'` added to `ModelKey` union and `MODELS` map; `npx tsc --noEmit` confirms no type error on `getModel('faq-generation')`
- [ ] `app/dashboard/page-audits/schema-actions.ts` — fetches most recent audit's `faq_schema_present`; calls `generateAiFaqSet()` when false; deduplicates schemas by `schemaType`; AI FAQ prepended before static FAQ
- [ ] `app/dashboard/page-audits/actions.ts` — `addPageAudit()` exported; plan gate (Growth/Agency); URL normalization (https://); rate limit (5 min); page type inference; primary location fetch; `auditPage()` call with try/catch; upsert with `onConflict: 'org_id,page_url'`; `revalidatePath`
- [ ] `app/dashboard/page-audits/_components/AddPageAuditForm.tsx` — created; Client Component; `useTransition` for pending state; success clears input; error displays inline; `data-testid` on form wrapper, input, and button; no `<form>` tags
- [ ] `app/dashboard/page-audits/page.tsx` — imports `AddPageAuditForm`; empty state has form + explainer; main state has `<details>` collapsible with form; passive "next scan cycle" copy removed
- [ ] `supabase/seed.sql` — about page row (id: b3eebc99..., score 58, faq_schema_present false); faq page row (id: b4eebc99..., score 89, faq_schema_present true); both use `ON CONFLICT DO UPDATE`
- [ ] `src/__tests__/unit/faq-generator.test.ts` — 17 tests passing (AI path, fallback, JSON-LD structure, error handling)
- [ ] `src/__tests__/unit/add-page-audit.test.ts` — 13 tests passing (auth, plan, URL, rate limit, inference, persistence)
- [ ] `npx tsc --noEmit` — **0 errors**
- [ ] `npx vitest run src/__tests__/unit/faq-generator.test.ts` — **17 tests passing**
- [ ] `npx vitest run src/__tests__/unit/add-page-audit.test.ts` — **13 tests passing**
- [ ] `npx vitest run src/__tests__/unit/page-auditor.test.ts` — **passing (no regression)**
- [ ] `npx vitest run src/__tests__/unit/reaudit-action.test.ts` — **passing (no regression)**
- [ ] `npx vitest run` — **all tests passing, zero regressions**
- [ ] DEVLOG.md entry written

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-03-01 — Sprint 104: Content Grader Completion (Completed)

**Goal:** Close the 3 remaining Content Grader gaps: AI-powered FAQ generator, on-demand URL submission, and multi-page seed data. Closes Doc 17 audit gap #7 (0% → 100%).

**Scope:**
- `lib/page-audit/faq-generator.ts` — **NEW.** AI FAQ auto-generator (Doc 17 §4). Uses GPT-4o-mini ('faq-generation' model) to generate 5 business-specific Q&A pairs. Static fallback when no API key. Returns `GeneratedSchema` so it renders in `SchemaFixPanel` without UI changes. `buildFaqSchema()` outputs ready-to-paste FAQPage JSON-LD.
- `lib/ai/providers.ts` — **MODIFIED.** Added `'faq-generation': openai('gpt-4o-mini')` to `ModelKey` union and `MODELS` map.
- `app/dashboard/page-audits/schema-actions.ts` — **MODIFIED.** `generateSchemaFixes()` now checks most recent audit's `faq_schema_present`. When false, calls `generateAiFaqSet()` and prepends result. Deduplicates schemas by `schemaType` (AI FAQ wins over static FAQ).
- `app/dashboard/page-audits/actions.ts` — **MODIFIED.** Added `addPageAudit(rawUrl)` export. Plan gate (canRunPageAudit, Growth/Agency). URL normalization. Rate limit (5 min, same Map as reauditPage). Local page type inference. Primary location fetch. Calls auditPage(), upserts to page_audits. revalidatePath('/dashboard/page-audits').
- `app/dashboard/page-audits/_components/AddPageAuditForm.tsx` — **NEW.** Client Component. URL input + Audit Page button. useTransition for pending state. Success clears input. Error inline. data-testid on all interactive elements. No <form> tags.
- `app/dashboard/page-audits/page.tsx` — **MODIFIED.** Empty state: passive copy replaced with AddPageAuditForm + explainer. Main state: <details> collapsible "Audit a new page" section prepended before AuditScoreOverview.
- `supabase/seed.sql` — **MODIFIED.** Added about page audit (score: 58, faq missing) and faq page audit (score: 89, faq present) for golden tenant. ON CONFLICT DO UPDATE. Dev now shows 3-page multi-audit view.
- `src/__tests__/unit/faq-generator.test.ts` — **NEW.** 17 Vitest tests: AI path, fallback, JSON-LD structure, error handling.
- `src/__tests__/unit/add-page-audit.test.ts` — **NEW.** 13 Vitest tests: auth, plan gate, URL validation/normalization, rate limit, page type inference, DB persistence.

**Tests added:**
- `faq-generator.test.ts` — **17 tests** (AI path + fallback + JSON-LD + errors)
- `add-page-audit.test.ts` — **13 tests** (auth + plan + URL + rate limit + persistence)

**Run commands:**
```bash
npx tsc --noEmit                                                           # 0 errors
npx vitest run src/__tests__/unit/faq-generator.test.ts                    # 17 tests PASS
npx vitest run src/__tests__/unit/add-page-audit.test.ts                   # 13 tests PASS
npx vitest run src/__tests__/unit/page-auditor.test.ts                     # PASS (no regression)
npx vitest run src/__tests__/unit/reaudit-action.test.ts                   # PASS (no regression)
npx vitest run                                                              # all passing
```
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `auditPage()` | Sprint 58B/Surgery 3 | The auditor called by `addPageAudit()` |
| `html-parser.ts` | Sprint 58B | HTML extraction used internally by `auditPage()` |
| `reauditPage()` + rate limit Map | Sprint 71 | Shares module-scoped rate limit state; pattern to follow |
| `generateSchemaFixes()` | Sprint 70 | Extended — not replaced |
| Static FAQ generator | Sprint 70 | Stays; AI generator supplements, not replaces |
| `SchemaFixPanel` | Sprint 70 | Already handles `GeneratedSchema` — no changes needed |
| `canRunPageAudit()` | Sprint 58B | Plan gate already defined |
| `page_audits` table + seed row | Sprint 58B | Table exists; one homepage row in seed |

---

## 🧠 Edge Cases to Handle

1. **`faq-generation` not in `ModelKey`:** TypeScript will error on `getModel('faq-generation')` until you add it to the union type and MODELS map in `lib/ai/providers.ts`. Do this before writing the generator — run `npx tsc --noEmit` to confirm.

2. **AI response with markdown fences:** GPT-4o-mini sometimes wraps JSON in ` ```json ` fences even when instructed not to. Always strip before `JSON.parse()`: `text.replace(/```json\n?|\n?```/g, '').trim()`.

3. **`schemaType` collision in `SchemaFixPanel`:** Both the AI FAQ and static FAQ have `schemaType: 'FAQPage'`. `SchemaFixPanel` renders tabs keyed by `schemaType`. Two FAQPage tabs would render identically. The deduplication guard in `schema-actions.ts` prevents this — confirm it runs before the return statement.

4. **`recentAudit?.location_id` is null:** Some older audit rows may have `location_id: null` (audits created before Sprint 100 location scoping). Guard: `if (!recentAudit?.location_id) skip AI FAQ generation — fall through to static schemas only`.

5. **`addPageAudit()` and the same rate limit Map as `reauditPage()`:** Both share `reauditTimestamps`. The module-scoped Map works because both functions are in the same file. Confirm the key format is the same: `${ctx.orgId}:${normalizedUrl}` — normalize before rate-limit check, not after.

6. **URL normalization edge cases:** Users may paste `charcoalnchill.com` (no scheme), `http://` (non-HTTPS), or `https://charcoalnchill.com/` (trailing slash). Normalize to `https://` + no trailing slash for the rate limit key and DB storage. The `page_audits` upsert uses `page_url` as part of the unique constraint — inconsistent URLs create duplicate rows.

7. **`<details>` + `<summary>` in main state:** The collapsible "Audit a new page" uses native HTML `<details>`/`<summary>` — no JavaScript state needed. Verify it renders correctly alongside `PlanGate` — the `PlanGate` wraps everything including this new section since it's inside the `<PlanGate>` block in `page.tsx`. Do not add the form outside `PlanGate` — Starter/Trial users would see the form but `addPageAudit()` would reject them server-side. The UX should match: hide the form for plan-gated users.

8. **Static fallback FAQ quality:** The fallback answers are generic but must be factually safe. Do not generate answers that claim specific hours, prices, or features that aren't sourced from `LocationContext`. The provided template is conservative — keep it that way.

---

## 📚 Document Sync + Git Commit

After all tests pass and `npx tsc --noEmit` shows 0 errors:

### Step 1: Update `docs/DEVLOG.md`

Paste the DEVLOG entry above at the top (after header, before Sprint 103).

### Step 2: Update root `DEVLOG.md`

```markdown
## 2026-03-01 — Sprint 104: Content Grader Completion (Completed)
**Goal:** Close 3 remaining Content Grader gaps (Doc 17 audit gap #7). AI FAQ generator (lib/page-audit/faq-generator.ts, GPT-4o-mini, static fallback). On-demand addPageAudit() action (plan gate, URL validation, rate limit). AddPageAuditForm client component. Multi-page seed data (about + faq pages). 30 new tests. Zero regressions.
```

### Step 3: Update `docs/CLAUDE.md`

```markdown
### Sprint 104 — Content Grader Completion (2026-03-01)
- `lib/page-audit/faq-generator.ts` — **NEW.** AI-powered FAQ auto-generator (Doc 17 §4). GPT-4o-mini. Static fallback. Returns GeneratedSchema.
- `lib/ai/providers.ts` — **MODIFIED.** Added 'faq-generation' model key.
- `app/dashboard/page-audits/schema-actions.ts` — **MODIFIED.** Wires AI FAQ when faqSchemaPresent=false. Deduplicates by schemaType.
- `app/dashboard/page-audits/actions.ts` — **MODIFIED.** addPageAudit() — on-demand audit for new URLs. Plan gate + URL normalization + rate limit + page type inference.
- `app/dashboard/page-audits/_components/AddPageAuditForm.tsx` — **NEW.** URL input client component.
- `app/dashboard/page-audits/page.tsx` — **MODIFIED.** Empty state: AddPageAuditForm. Main state: collapsible Audit New Page section.
- `supabase/seed.sql` — **MODIFIED.** About + FAQ page audit rows for golden tenant.
- Tests: `faq-generator.test.ts` (17) + `add-page-audit.test.ts` (13) — 30 new tests.
```

**Note:** No new AI_RULES entry for this sprint. No new patterns introduced — all patterns follow §2, §5, §12, §17.

### Step 4: Git commit

```bash
git add -A
git commit -m "Sprint 104: Content Grader Completion

- lib/page-audit/faq-generator.ts: NEW AI FAQ auto-generator (Doc 17 §4).
  GPT-4o-mini ('faq-generation' model), 5 business-specific Q&A pairs,
  static fallback when no API key, buildFaqSchema() → FAQPage JSON-LD,
  returns GeneratedSchema for SchemaFixPanel
- lib/ai/providers.ts: add 'faq-generation' to ModelKey + MODELS
- schema-actions.ts: wire generateAiFaqSet() when faqSchemaPresent=false,
  deduplicate schemas by schemaType (AI FAQ wins over static FAQ)
- actions.ts: add addPageAudit() — plan gate (canRunPageAudit), URL
  normalization (https://), rate limit (5min, shared Map), page type
  inference, primary location fetch, auditPage() + upsert, revalidate
- AddPageAuditForm.tsx: NEW client component — URL input + Audit Page
  button, useTransition, success/error inline, no <form> tags
- page.tsx: empty state → AddPageAuditForm + explainer; main state →
  <details> collapsible 'Audit a new page' section before score overview
- seed.sql: about page audit (score 58, faq missing) + faq page audit
  (score 89, faq present) for golden tenant — ON CONFLICT DO UPDATE
- faq-generator.test.ts: NEW 17 tests (AI path, fallback, JSON-LD, errors)
- add-page-audit.test.ts: NEW 13 tests (auth, plan, URL, rate, inference)

npx tsc --noEmit → 0 errors
npx vitest run → all passing (30 new tests, 0 regressions)

Closes Doc 17 audit gap #7: Content Grader on-demand audit + AI FAQ."

git push origin main
```

---

## 🏁 Sprint Outcome + Audit Plan Closure

After Sprint 104 completes, all 4 audit sprints are done:

| Sprint | What | Status |
|--------|------|--------|
| FIX-9  | TypeScript zero-error sweep | ✅ Done |
| 102    | Database types sync + sidebar nav | ✅ Done |
| 103    | Benchmarks full page + sidebar | ✅ Done |
| 104    | Content Grader completion | ✅ Done |

**Content Grader after Sprint 104:**
- Monthly cron audits all active orgs automatically ✅ (existed)
- Users can re-audit existing pages ✅ (existed)
- Users can submit **new** URLs for immediate auditing ✅ (Sprint 104)
- Audit results include **AI-generated FAQ schema** ready to paste ✅ (Sprint 104)
- Dev environment shows 3-page multi-audit view ✅ (Sprint 104 seed data)
- 30 new tests protecting this feature surface ✅ (Sprint 104)

The project returns to the original roadmap. Next up per `CLAUDE.md`: Sprint 104 original (Dynamic FAQ Auto-Generation for the standalone FAQ page feature), Sprint 105 (Apple Business Connect — API-gated), Sprint 106 (Bing Places — API-gated), then Sprints 107–109 gated on SOV data accumulation.
