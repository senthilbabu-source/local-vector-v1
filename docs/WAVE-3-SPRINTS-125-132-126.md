# LocalVector — Wave 3 Sprint Prompts
## Sprints 132 · 126 · 125 — Data Accumulation + Spec Required

> **Claude Code Prompt — First-Pass Ready**
> Paste each sprint section separately into VS Code Claude Code (`Cmd+L` / `Ctrl+L`).
> **Always upload alongside:** `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## ⏳ Wave 3 Activation Checklist

| Sprint | Earliest Start | Gate Condition |
|--------|---------------|----------------|
| **132** | **Now** | Sprint 89 (GBP OAuth) ✅ + Sprint 80 (Entity KG) ✅ |
| **126** | **Now** | Write `docs/21-AGENT-SEO.md` spec first, then build |
| **125** | **~March 30, 2026** | Sprint 123 (Multi-Model SOV) running ≥ 28 days |

**Recommended order:** 132 → 126 → 125

---

---

# Sprint 132 — Entity-Optimized Review Response Generator

> **Claude Code Prompt — First-Pass Ready**
> **START NOW.** All dependencies met.
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Sprint 107 (review-sync cron) already generates basic AI response drafts. The gap: those drafts are generic brand-voice replies that don't weave in **entity keywords** — the specific terms (business name, category, location, signature items) that Google's local algorithm reads as authority signals.

Sprint 132 adds a dedicated **entity-weaving layer** on top of the existing pipeline. Instead of "Thanks for visiting, we're glad you enjoyed the experience!" we get: "Thank you for choosing Charcoal N Chill in Alpharetta! We're thrilled our hookah lounge delivered an amazing experience."

**Why this matters:** Google crawls and indexes GBP review responses. Entity terms (businessName + city + category) in responses reinforce Knowledge Graph associations. This is a confirmed local-SEO signal.

**The user sees (reviews dashboard):**
```
⭐⭐⭐⭐⭐  "Amazing hookah experience!"  — Ahmed K.
──────────────────────────────────────────────────────
📝 Response Draft  [Entity-Optimized ✓]
   "Thank you for visiting Charcoal N Chill in Alpharetta!
    We're thrilled our hookah lounge delivered such an
    amazing experience. See you again soon!"

   Entity terms woven: [Charcoal N Chill] [Alpharetta] [hookah lounge]

[Approve & Publish →]   [Edit]   [Regenerate]
```

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                               — All rules
Read CLAUDE.md                                      — Architecture
Read lib/review-engine/response-generator.ts        — COMPLETE FILE. Existing response generation
Read lib/review-engine/types.ts                     — COMPLETE FILE. Review, BrandVoiceProfile, ReviewResponseDraft
Read lib/review-engine/review-sync-service.ts       — COMPLETE FILE. Where generateResponseDraft() is called
Read lib/review-engine/brand-voice-profiler.ts      — COMPLETE FILE. Entity keyword source pattern
Read lib/ai/providers.ts                            — Check if 'review-response' model key exists
Read supabase/prod_schema.sql                       — reviews table (all columns + constraints)
Read lib/supabase/database.types.ts                 — Full Database type (§38)
Read src/__fixtures__/golden-tenant.ts              — GOLDEN_TENANT structure (§4)
Read app/dashboard/reviews/                         — ls + read page.tsx if present
```

---

## 🏗️ Architecture

```
EXISTING (Sprint 107):
generateResponseDraft(review, groundTruth, brandVoice) → plain text

NEW LAYER (Sprint 132):
selectEntityTerms(location) → string[2-3]          ← entity-weaver.ts
generateEntityOptimizedResponse(
  review, groundTruth, brandVoice, entityTerms)    ← extends response-generator.ts

Review sync service wired to call NEW path:
generateEntityOptimizedResponse() → draft with entityTermsUsed in metadata
```

**Critical constraint:** EXACTLY 2–3 entity terms per response. More looks spammy. Fewer misses the benefit.

---

## 📐 Component Specs

### Component 1: `lib/reviews/entity-weaver.ts` — NEW (pure function, no I/O)

```typescript
// lib/reviews/entity-weaver.ts — Sprint 132
// Selects 2-3 entity terms for review response weaving.
// PURE FUNCTION — AI_RULES §164: MAX 3 entity terms. Never override.

export interface EntityTermSelection {
  terms: string[];    // exactly 2-3, ordered by priority
  rationale: string[]; // which slot rule was used (for debugging + tests)
}

export interface EntityWeaveInput {
  businessName: string;
  city: string;
  categories: string[] | null;  // ['NightClub', 'BarOrPub']
  signatureItems: string[];      // top 3 published menu item names
  keyAmenities: string[];        // true amenities: ['hookah', 'live music']
  reviewRating: number;
  reviewKeywords: string[];      // keywords from reviews.keywords[]
}

// Category → human label (for slot 3 fallback)
const ENTITY_CATEGORY_LABELS: Record<string, string> = {
  'Restaurant': 'restaurant', 'FoodEstablishment': 'restaurant',
  'BarOrPub': 'bar', 'NightClub': 'hookah lounge',
  'Cafe': 'cafe', 'Physician': 'medical practice',
  'Dentist': 'dental practice', 'HairSalon': 'hair salon',
  'GymOrFitnessCenter': 'fitness center',
};

/**
 * Select exactly 2-3 entity terms.
 *
 * Slot 1: businessName — always
 * Slot 2: city — always
 * Slot 3: context-aware: mentioned item > mentioned amenity > category label > first signature item
 */
export function selectEntityTerms(input: EntityWeaveInput): EntityTermSelection {
  const terms: string[] = [input.businessName, input.city];
  const rationale: string[] = ['slot1:business_name', 'slot2:city'];

  const lowerKw = input.reviewKeywords.map(k => k.toLowerCase());

  const matchedItem = input.signatureItems.find(item =>
    lowerKw.some(k => item.toLowerCase().includes(k) || k.includes(item.toLowerCase().slice(0, 5)))
  );
  const matchedAmenity = input.keyAmenities.find(a =>
    lowerKw.some(k => a.toLowerCase().includes(k))
  );

  if (matchedItem) {
    terms.push(matchedItem);
    rationale.push(`slot3:matched_item:${matchedItem}`);
  } else if (matchedAmenity) {
    terms.push(`${matchedAmenity} lounge`);
    rationale.push(`slot3:matched_amenity:${matchedAmenity}`);
  } else if (input.categories?.length) {
    const label = ENTITY_CATEGORY_LABELS[input.categories[0]];
    if (label) {
      terms.push(label);
      rationale.push(`slot3:category_label:${input.categories[0]}`);
    }
  } else if (input.signatureItems.length > 0) {
    terms.push(input.signatureItems[0]);
    rationale.push(`slot3:first_signature_item`);
  }
  // If nothing fills slot 3 — return 2 terms (acceptable)

  return { terms: terms.slice(0, 3), rationale };
}

/**
 * Extract human-readable names from amenities JSONB.
 * Returns only true values, underscores → spaces, max 3.
 */
export function extractKeyAmenities(
  amenities: Record<string, boolean | null> | null,
  max = 3,
): string[] {
  if (!amenities) return [];
  return Object.entries(amenities)
    .filter(([, v]) => v === true)
    .map(([k]) => k.replace(/_/g, ' '))
    .slice(0, max);
}
```

---

### Component 2: `lib/review-engine/response-generator.ts` — MODIFY (2 changes only)

**Change 1: Extend `buildResponseSystemPrompt()` signature and add entity instruction block:**

```typescript
export function buildResponseSystemPrompt(
  groundTruth: GroundTruth,
  brandVoice: BrandVoiceProfile,
  sentiment: ReviewSentiment,
  entityTerms?: string[],          // ← ADD optional param
): string {
  // ... (all existing lines preserved) ...

  // ADD AFTER the SEO keyword block:
  if (entityTerms && entityTerms.length > 0) {
    lines.push('Entity optimization — naturally weave ALL of these terms into the response:');
    for (const t of entityTerms) lines.push(`  - "${t}"`);
    lines.push('IMPORTANT: Use each naturally in context — never list them. No more than 3 terms.');
    lines.push('');
  }
  // ... rest of existing logic ...
}
```

**Change 2: Extend `generateResponseDraft()` with optional `entityTerms` param:**

```typescript
export async function generateResponseDraft(
  review: Review,
  groundTruth: GroundTruth,
  brandVoice: BrandVoiceProfile,
  entityTerms?: string[],           // ← ADD optional param
): Promise<ReviewResponseDraft | null>
```

Pass `entityTerms` into `buildResponseSystemPrompt()`.

**Backward compatibility:** Both params are optional — all Sprint 107 callers still compile without changes.

---

### Component 3: `lib/review-engine/types.ts` — MODIFY (extend `ReviewResponseDraft`)

```typescript
// ADD to existing ReviewResponseDraft interface:
entityTermsUsed?: string[];    // which entity terms were woven in
entityOptimized?: boolean;     // whether entity optimization was applied
```

---

### Component 4: `lib/reviews/review-responder.ts` — NEW (orchestrator)

```typescript
// lib/reviews/review-responder.ts — Sprint 132
// Orchestrates entity selection + response generation.
// AI_RULES §164: This is the ONLY entry point for review response generation
// after Sprint 132. Never call bare generateResponseDraft() from new code.

import * as Sentry from '@sentry/nextjs';
import { selectEntityTerms, extractKeyAmenities } from './entity-weaver';
import { generateResponseDraft } from '@/lib/review-engine/response-generator';
import type { Review, ReviewResponseDraft, BrandVoiceProfile } from '@/lib/review-engine/types';
import type { GroundTruth } from '@/lib/nap-sync/types';

export interface EntityOptimizedResponseInput {
  review: Review;
  groundTruth: GroundTruth;
  brandVoice: BrandVoiceProfile;
  locationCategories: string[] | null;
  locationAmenities: Record<string, boolean | null> | null;
  signatureMenuItems: string[];
}

export async function generateEntityOptimizedResponse(
  input: EntityOptimizedResponseInput,
): Promise<ReviewResponseDraft | null> {
  try {
    const entitySelection = selectEntityTerms({
      businessName: input.groundTruth.name,
      city: input.groundTruth.city,
      categories: input.locationCategories,
      signatureItems: input.signatureMenuItems,
      keyAmenities: extractKeyAmenities(input.locationAmenities),
      reviewRating: input.review.rating,
      reviewKeywords: input.review.keywords ?? [],
    });

    const draft = await generateResponseDraft(
      input.review,
      input.groundTruth,
      input.brandVoice,
      entitySelection.terms,
    );

    if (!draft) return null;

    return { ...draft, entityTermsUsed: entitySelection.terms, entityOptimized: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'review-responder', sprint: '132' } });
    // Graceful fallback: generate without entity optimization
    return generateResponseDraft(input.review, input.groundTruth, input.brandVoice);
  }
}
```

---

### Component 5: Wire into `lib/review-engine/review-sync-service.ts` — MODIFY

Replace the `generateResponseDraft()` call in the sync loop:

```typescript
// BEFORE:
const draft = await generateResponseDraft(reviewObj, groundTruth, brandVoice);

// AFTER (Sprint 132):
// Fetch menu items for entity selection (add to existing parallel queries)
const menuItems = /* existing magic_menus query already in service, or add:
  await supabase
    .from('magic_menus')
    .select('extracted_data')
    .eq('location_id', locationId)
    .eq('is_published', true)
    .limit(1)
    .maybeSingle()
*/;

const signatureItems = extractTopMenuItems(menuItems?.data?.extracted_data, 3);

const draft = await generateEntityOptimizedResponse({
  review: reviewObj,
  groundTruth,
  brandVoice,
  locationCategories: location.categories as string[] | null,
  locationAmenities: location.amenities as Record<string, boolean | null> | null,
  signatureMenuItems: signatureItems,
});
```

Add helper `extractTopMenuItems(extractedData, count): string[]` — safely reads item names from magic_menus `extracted_data` JSONB. Returns empty array if null/invalid.

---

### Component 6: `app/dashboard/reviews/page.tsx` — CREATE (if not present)

```typescript
// Server component. Reads reviews grouped by response_status.
// Sections: Needs Response (pending_draft + draft_ready), Approved, Published.
// Per review card:
//   - Star rating, reviewer name, review excerpt
//   - Response draft with entity terms shown as amber badges
//   - "Entity-Optimized ✓" badge when entityOptimized=true
//   - Approve & Publish, Edit, Regenerate, Skip actions
// Growth+ plan gate for entity optimization badge display.
// data-testid: "reviews-page", "review-card-[id]", "entity-badge", "approve-btn-[id]"
```

---

### Component 7: `app/dashboard/reviews/actions.ts` — NEW

```typescript
'use server';
// approveReviewResponse(reviewId) — response_status = 'approved'
// publishReviewResponse(reviewId) — calls gbp-reply-pusher → 'published'
// regenerateResponse(reviewId)    — calls generateEntityOptimizedResponse(), updates draft
// skipResponse(reviewId)          — 'skipped'
// All actions: getSafeAuthContext() + assertOrgRole('editor')+

// BANNED_PHRASES check before every save:
export const BANNED_PHRASES = [
  'as a valued customer',
  "we're so sorry for any inconvenience",
  'we value your feedback',
  'we apologize for any inconvenience',
  'thank you for bringing this to our attention',
  'we strive to provide',
  'your satisfaction is our priority',
];

// If banned phrase found → retry once with phrase in forbidden list.
// If second attempt also contains it → save anyway, flag with entityOptimized=false.
```

---

### Component 8: `src/__tests__/unit/entity-weaver.test.ts` — NEW (target: 28 tests)

```typescript
describe('selectEntityTerms — slot 1', () => {
  it('always includes businessName as first term')
  it('includes businessName even for 1-star review')
})

describe('selectEntityTerms — slot 2', () => {
  it('always includes city as second term')
})

describe('selectEntityTerms — slot 3 (context-aware)', () => {
  it('uses matched signature item when reviewer keyword overlaps')
  it('uses matched amenity when reviewer keyword overlaps')
  it('falls back to category label when no keyword match')
  it('uses first signature item when category unmapped')
  it('returns 2 terms when nothing fills slot 3')
  it('never returns more than 3 terms')
  it('never returns 0 terms for complete location data')
})

describe('extractKeyAmenities', () => {
  it('converts underscores to spaces (outdoor_seating → outdoor seating)')
  it('only returns TRUE amenities')
  it('caps at max param (default 3)')
  it('returns empty array for null amenities')
})

describe('generateEntityOptimizedResponse', () => {
  it('calls selectEntityTerms before generateResponseDraft')
  it('passes entity terms to generateResponseDraft')
  it('sets entityTermsUsed in returned draft')
  it('sets entityOptimized=true in returned draft')
  it('falls back to non-entity when entity selection throws')
  it('falls back when generateResponseDraft returns null')
})

describe('buildResponseSystemPrompt — entity weaving', () => {
  it('includes entity terms block when entityTerms provided')
  it('omits entity terms block when entityTerms undefined')
  it('lists each term as a bullet')
  it('includes "no more than 3 terms" instruction')
})

describe('hasBannedPhrases', () => {
  it('detects "as a valued customer"')
  it('detects "we apologize for any inconvenience" (case-insensitive)')
  it('returns false for clean response')
  it('returns matched phrase when found')
})

describe('review sync service integration', () => {
  it('calls generateEntityOptimizedResponse not bare generateResponseDraft')
  it('passes location.categories to entity selection')
  it('passes location.amenities to entity selection')
})
```

---

## 🚫 What NOT to Do

1. **DO NOT use more than 3 entity terms** — `selectEntityTerms()` caps at 3.
2. **DO NOT break backward compatibility** of `generateResponseDraft()` — `entityTerms` is optional.
3. **DO NOT auto-publish** — every response requires human `approved` status first.
4. **DO NOT call bare `generateResponseDraft()`** from any new code — always go through `generateEntityOptimizedResponse()`.
5. **DO NOT store review text in Sentry extras** — log review ID only, never the customer's text.

---

## ✅ Definition of Done

- [ ] `lib/reviews/entity-weaver.ts` — `selectEntityTerms()` + `extractKeyAmenities()`, always 2-3 terms
- [ ] `lib/review-engine/types.ts` — `entityTermsUsed`, `entityOptimized` added to `ReviewResponseDraft`
- [ ] `lib/review-engine/response-generator.ts` — `entityTerms` optional param, system prompt extended
- [ ] `lib/reviews/review-responder.ts` — `generateEntityOptimizedResponse()` orchestrator
- [ ] `lib/review-engine/review-sync-service.ts` — wired to `generateEntityOptimizedResponse`
- [ ] `BANNED_PHRASES` + retry logic in `app/dashboard/reviews/actions.ts`
- [ ] `app/dashboard/reviews/page.tsx` — entity badge display, status grouping
- [ ] `app/dashboard/reviews/actions.ts` — approve/publish/regenerate/skip with role guards
- [ ] 28 tests passing
- [ ] `npx vitest run` — ALL tests passing, 0 regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 🔮 AI_RULES Addition

```markdown
## §164. Entity-Optimized Review Responses (Sprint 132)

Entity weaving in `lib/reviews/entity-weaver.ts`, orchestration in `lib/reviews/review-responder.ts`.

* **`generateEntityOptimizedResponse()` is the ONLY entry point** for review response generation after Sprint 132.
* **2-3 entity terms MAXIMUM.** `selectEntityTerms()` always caps at 3. Never override.
* **Term slots:** Slot 1 = businessName, Slot 2 = city, Slot 3 = context-aware (matched reviewer keyword > amenity > category label > first signature item).
* **`BANNED_PHRASES` list** checked before every save. Retry once on match.
* **Human approval required** — `response_status = 'approved'` must be set before publish.
* **Tests:** 28 Vitest.
```

---

---

# Sprint 126 — Agent-SEO Action Readiness Audit

> **Claude Code Prompt — First-Pass Ready**
> **FIRST ACTION: Create `docs/21-AGENT-SEO.md` before writing any code.**
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Sprint 84 (Agent Readiness Score) answers: "Can AI access your business *information*?" Sprint 126 answers: "Can AI agents take *action* for your customers?" — reservations, online orders, appointment bookings, via Schema.org action markup (`OrderAction`, `ReserveAction`).

A new **tab** in the existing Agent Readiness page (`app/dashboard/agent-readiness/`). Not a new page.

```
Sprint 84 already shows:    Can AI find your hours? ✅  Can AI find your menu? ✅
Sprint 126 new tab shows:   Can AI book a reservation? ❌  Can AI place an order? ❌
```

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
FIRST — CREATE THIS SPEC FILE:
Write docs/21-AGENT-SEO.md (see Step 1 below) BEFORE any code.

Read docs/AI_RULES.md                               — All rules, especially §102 (jargon-free UI)
Read CLAUDE.md                                      — Architecture
Read lib/services/agent-readiness.service.ts        — COMPLETE FILE. Sprint 84 base types + scoring pattern
Read lib/data/agent-readiness.ts                    — COMPLETE FILE. fetchAgentReadiness() pattern to mirror
Read app/dashboard/agent-readiness/page.tsx         — COMPLETE FILE. Tab structure to extend
Read lib/agent-readiness/scenario-descriptions.ts   — COMPLETE FILE. Jargon-free copy pattern (§102)
Read lib/schema-generator/                          — ls. Existing ReserveAction/OrderAction generators
Read supabase/prod_schema.sql                       — page_audits, locations, magic_menus tables
Read lib/supabase/database.types.ts                 — Full Database type (§38)
Read src/__fixtures__/golden-tenant.ts              — GOLDEN_TENANT (§4)
Read vercel.json                                    — Current crons; we add 1
```

---

## 📝 Step 1: Create `docs/21-AGENT-SEO.md`

Before writing any code, create this file:

```markdown
# 21-AGENT-SEO.md — Agent-SEO Action Readiness Spec
## Sprint 126

### Problem
Sprint 84 measures whether AI can access business *information* (hours, menu, location).
Sprint 126 measures whether AI agents can take *actions* — book, order, schedule.

### 5 Audit Dimensions

| ID | Jargon-free label | Schema type | Points |
|----|-------------------|-------------|--------|
| reserve_action | Reservation Booking | ReserveAction | 25 |
| order_action | Online Ordering | OrderAction | 25 |
| booking_cta | Visible Booking Button | n/a | 20 |
| booking_crawlable | Booking Link Accessible | n/a | 20 |
| appointment_action | Appointment Scheduling | MedicalAppointment/BuyAction | 10 |

### Scoring
- agent_action_ready: ≥ 80 pts
- partially_actionable: ≥ 40 pts
- not_actionable: < 40 pts

### Audit methodology
- Fetch homepage with standard User-Agent. Parse JSON-LD blocks. Read magic_menus schema.
- READ-ONLY. Never submit forms. Never execute JS. Never follow > 1 redirect.
- Check booking CTA accessibility in <a>/<button> text and aria-label attributes.
- Booking URL safety: HTTPS required; /login /signin path → needs-login flag.

### UI rules (§102 jargon-free)
- "ReserveAction" → "Reservation Booking" everywhere in UI
- "JSON-LD" → never shown in UI
- "OrderAction" → "Online Ordering"

### Content brief integration
Missing capability → "Generate Schema →" button → Sprint 126 schema generator
```

---

## 🏗️ Architecture

```
No new DB table — results cached on locations:
  locations.agent_seo_cache JSONB    (ActionAuditResult)
  locations.agent_seo_audited_at TIMESTAMPTZ

lib/agent-seo/
  ├── agent-seo-types.ts
  ├── action-schema-detector.ts   — pure HTML parser + network fetch
  └── agent-seo-scorer.ts         — pure scoring

app/api/cron/agent-seo-audit/route.ts   — Weekly Mon 8 AM UTC
app/dashboard/agent-readiness/_components/AgentSEOTab.tsx
```

---

## 📐 Component Specs

### Component 1: Migration — `supabase/migrations/20260303000004_agent_seo.sql`

```sql
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS agent_seo_cache JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS agent_seo_audited_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.locations.agent_seo_cache IS
  'Cached ActionAuditResult JSON from Agent-SEO weekly audit. Sprint 126.';
```

---

### Component 2: `lib/agent-seo/agent-seo-types.ts` — NEW

```typescript
export type AuditStatus = 'pass' | 'partial' | 'fail' | 'skipped';

export interface ActionCapability {
  id: 'reserve_action' | 'order_action' | 'booking_cta' | 'booking_crawlable' | 'appointment_action';
  label: string;           // jargon-free label (never "ReserveAction")
  description: string;     // "Can AI book a reservation for a customer?"
  status: AuditStatus;
  maxPoints: number;
  earnedPoints: number;
  statusDetail: string;
  fixGuide: string | null;
  schemaTypeToAdd?: string;  // for "Generate Schema" CTA
}

export interface ActionAuditResult {
  score: number;
  level: 'agent_action_ready' | 'partially_actionable' | 'not_actionable';
  capabilities: ActionCapability[];
  topPriority: ActionCapability | null;
  auditedUrl: string | null;
  auditedAt: string;
}

export interface DetectedSchemas {
  hasReserveAction: boolean;
  reserveActionUrl?: string;
  hasOrderAction: boolean;
  orderActionUrl?: string;
  hasAppointmentAction: boolean;
  hasBookingCTA: boolean;
  bookingUrlIsHttps: boolean;
  bookingUrlNeedsLogin: boolean;
}
```

---

### Component 3: `lib/agent-seo/action-schema-detector.ts` — NEW

```typescript
// lib/agent-seo/action-schema-detector.ts — Sprint 126
// READ-ONLY audit. Standard User-Agent. Parses JSON-LD action schemas.
// AI_RULES §165: Never masquerade as bot. Never submit forms. Never follow >1 redirect.

const STANDARD_UA = 'Mozilla/5.0 (compatible; LocalVector/1.0; +https://localvector.ai/about)';
const LOGIN_PATTERNS = /\/(login|signin|sign-in|auth|account\/login)/i;

// fetchAndParseActionSchemas(url): calls fetch + parseActionSchemasFromHtml. Returns null on error.
// parseActionSchemasFromHtml(html, baseUrl): PURE function — exported for testing.
//   - Extracts all <script type="application/ld+json"> blocks
//   - Calls inspectSchemaForActions() on each parsed schema
//   - Checks for booking CTAs in <a>/<button> text + aria-label
//   - Sets bookingUrlIsHttps, bookingUrlNeedsLogin from reserveActionUrl ?? orderActionUrl
// inspectSchemaForActions(schema, result): recursively checks @type and potentialAction array.
//   Detects: ReserveAction, OrderAction, MedicalAppointment, BuyAction.
//   Extracts target.urlTemplate from detected actions.

export async function fetchAndParseActionSchemas(url: string): Promise<DetectedSchemas | null>
export function parseActionSchemasFromHtml(html: string, baseUrl: string): DetectedSchemas
```

Full implementation: see Wave 3 reference spec in docs/21-AGENT-SEO.md. Key patterns:
- Non-HTTPS URL → return all-false immediately (no fetch)
- `AbortSignal.timeout(15_000)` on all fetches
- `Sentry.captureException` on network error
- Skip malformed JSON-LD silently (`try/catch` per block)

---

### Component 4: `lib/agent-seo/agent-seo-scorer.ts` — NEW (pure function)

5 capabilities × fixed max points (25 + 25 + 20 + 20 + 10 = 100):

```typescript
// computeAgentSEOScore(detected, magicMenuJsonLd, websiteUrl, auditedAt) → ActionAuditResult
//
// Checks magic_menus JSON-LD string for LocalVector-generated action schemas
// (may contain ReserveAction/OrderAction even if homepage doesn't).
//
// booking_crawlable scoring:
//   bookingUrlIsHttps && !bookingUrlNeedsLogin → pass (20 pts)
//   bookingUrlNeedsLogin → partial (10 pts)
//   !bookingUrlIsHttps → fail (0 pts)
//   no booking URL found → skipped (10 pts — neutral)
//
// topPriority: highest maxPoints capability with status != 'pass'
// noWebsiteResult: returns score=0, not_actionable, empty capabilities when websiteUrl null

export function computeAgentSEOScore(
  detected: DetectedSchemas | null,
  magicMenuJsonLd: Record<string, unknown> | null,
  websiteUrl: string | null,
  auditedAt: string,
): ActionAuditResult
```

---

### Component 5: `app/api/cron/agent-seo-audit/route.ts` — NEW

```typescript
// Schedule: "0 8 * * 1" (8 AM UTC every Monday)
// Kill switch: AGENT_SEO_CRON_DISABLED=true
// For all active locations with website_url set:
//   1. Fetch magic_menus.json_ld_schema for location
//   2. fetchAndParseActionSchemas(location.website_url)
//   3. computeAgentSEOScore(detected, magicMenuSchema, websiteUrl, now())
//   4. UPDATE locations SET agent_seo_cache = result, agent_seo_audited_at = now()
// Returns { audited, skipped, failed, total }
```

---

### Component 6: `src/__tests__/unit/agent-seo.test.ts` — NEW (target: 30 tests)

```typescript
describe('parseActionSchemasFromHtml', () => {
  it('detects ReserveAction in JSON-LD script block')
  it('detects OrderAction in JSON-LD script block')
  it('detects ReserveAction in potentialAction array')
  it('detects MedicalAppointment @type')
  it('extracts urlTemplate from ReserveAction target')
  it('detects booking CTA from anchor text containing "book"')
  it('detects booking CTA from aria-label containing "reserve"')
  it('skips malformed JSON-LD without throwing')
  it('returns all false for empty HTML')
})

describe('booking URL safety', () => {
  it('marks HTTPS URL without login path as safe')
  it('marks HTTP URL as bookingUrlIsHttps=false')
  it('detects /login path as bookingUrlNeedsLogin=true')
  it('detects /signin path as bookingUrlNeedsLogin=true')
})

describe('computeAgentSEOScore', () => {
  it('returns score 100 for location with all action schemas')
  it('returns score 0 when detected is null')
  it('gives 25 pts for ReserveAction present')
  it('gives 25 pts for OrderAction present')
  it('gives 20 pts for booking CTA present')
  it('gives 20 pts for crawlable booking URL (HTTPS, no login)')
  it('gives 10 partial pts for login-gated booking URL')
  it('gives 10 pts for appointment action')
  it('level is not_actionable for score < 40')
  it('level is partially_actionable for score 40–79')
  it('level is agent_action_ready for score >= 80')
  it('topPriority is highest-points failing capability')
  it('topPriority is null when all pass')
  it('checks magic_menus JSON-LD for LocalVector-generated schemas')
  it('returns noWebsiteResult when websiteUrl is null')
})

describe('fetchAndParseActionSchemas', () => {
  it('returns null for non-HTTPS URL without fetching')
  it('uses standard User-Agent header')
  it('handles timeout gracefully (null + Sentry)')
  it('handles non-200 response (null)')
  it('calls Sentry.captureException on network error')
})

describe('agent-seo-audit cron', () => {
  it('returns 401 without CRON_SECRET')
  it('returns skipped when kill switch active')
  it('skips locations without website_url')
  it('writes agent_seo_cache after successful audit')
  it('continues on per-location failure')
})
```

---

## ✅ Definition of Done

- [ ] `docs/21-AGENT-SEO.md` spec created FIRST
- [ ] Migration: `agent_seo_cache`, `agent_seo_audited_at` on `locations`
- [ ] `lib/agent-seo/agent-seo-types.ts` — all interfaces defined
- [ ] `lib/agent-seo/action-schema-detector.ts` — fetch + parse (pure fn exported)
- [ ] `lib/agent-seo/agent-seo-scorer.ts` — `computeAgentSEOScore` pure function
- [ ] Weekly cron `app/api/cron/agent-seo-audit/route.ts` + `vercel.json` updated
- [ ] `app/dashboard/agent-readiness/_components/AgentSEOTab.tsx` — new tab
- [ ] Agent Readiness page extended with Agent-SEO tab reading from cache
- [ ] 30 tests passing
- [ ] `npx vitest run` — ALL tests passing, 0 regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 🔮 AI_RULES Addition

```markdown
## §165. Agent-SEO Action Readiness Audit (Sprint 126)

Detection in `lib/agent-seo/action-schema-detector.ts`, scoring in `lib/agent-seo/agent-seo-scorer.ts`.

* **Spec-first rule:** `docs/21-AGENT-SEO.md` MUST exist before any code is written.
* **Standard User-Agent only** — never masquerade as a bot.
* **READ-ONLY** — never submit forms, never execute JS, never follow >1 redirect.
* **Jargon-free UI** (§102): "ReserveAction" → "Reservation Booking". Never show "JSON-LD" in UI.
* **Cache pattern:** `locations.agent_seo_cache` populated weekly. Never audit on page request.
* **Checks both** live website HTML AND `magic_menus.json_ld_schema` for LocalVector schemas.
* **Migration:** `20260303000004_agent_seo.sql`. Tests: 30 Vitest.
```

---

---

# Sprint 125 — Competitive Prompt Hijacking Alerts

> **Claude Code Prompt — First-Pass Ready**
> ⚠️ **DO NOT START BEFORE: ~March 30, 2026** (28 days after Sprint 123 started March 2, 2026)
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Detect when a competitor appears in AI responses for queries that should return the client business. This is distinct from normal SOV loss — **hijacking** requires a brand-intent query: city + category + ≥1 distinguishing signal pointing to the client.

**Example:**
```
Query: "hookah lounge Alpharetta open late weekends"
         category ↑      city ↑     ↑ signal

Expected: Charcoal N Chill
Actual:   Atlanta Smoke House (competitor)
→ HIJACK ALERT
```

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                               — All rules
Read CLAUDE.md                                      — Architecture
Read lib/services/multi-model-sov.ts                — COMPLETE FILE. sov_model_results structure
Read lib/config/sov-models.ts                       — SOV_MODEL_CONFIGS, model provider strings
Read supabase/prod_schema.sql                       — sov_evaluations (mentioned_competitors JSONB), sov_model_results, target_queries, organizations
Read app/dashboard/source-intelligence/             — COMPLETE DIRECTORY. Page to extend
Read lib/data/source-intelligence.ts                — COMPLETE FILE. fetchSourceIntelligence() pattern
Read lib/supabase/database.types.ts                 — Full Database type (§38)
Read emails/                                        — ls. Existing email template pattern (React Email)
Read src/__fixtures__/golden-tenant.ts              — GOLDEN_TENANT + RIVAL_TENANT (§4)
Read vercel.json                                    — Current crons; we add 1
```

---

## 🏗️ Architecture

```
lib/hijack/
  ├── brand-intent-scorer.ts  — isBrandIntentQuery() → { isBrandIntent, signalCount, signals }
  └── hijack-detector.ts      — detectHijacks(orgId, locationId, supabase) → HijackDetectionResult

supabase/migrations/20260330000001_hijack_alerts.sql
  └── hijack_alerts table (one row per competitor per location)

app/api/cron/hijack-detection/route.ts  — Weekly Mon 7 AM UTC
app/dashboard/source-intelligence/_components/HijackingAlertsSection.tsx
emails/hijack-alert.tsx
app/actions/hijack.ts  — createDraftFromHijack(hijackAlertId)
```

---

## 📐 Component Specs

### Component 1: Migration — `supabase/migrations/20260330000001_hijack_alerts.sql`

```sql
CREATE TABLE IF NOT EXISTS public.hijack_alerts (
  id                uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id       uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  competitor_name   text NOT NULL,
  competitor_domain text,
  hijacked_queries  text[] NOT NULL DEFAULT '{}',
  engines_detected  text[] NOT NULL DEFAULT '{}',
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz,
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'resolved', 'monitoring')),
  email_sent_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, location_id, competitor_name)
);

ALTER TABLE public.hijack_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON public.hijack_alerts
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_all" ON public.hijack_alerts
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_hijack_active ON public.hijack_alerts (org_id, status)
  WHERE status = 'active';
```

---

### Component 2: `lib/hijack/brand-intent-scorer.ts` — NEW (pure function)

```typescript
// AI_RULES §166: isBrandIntentQuery() requires 2+ brand signals.
// NEVER classify as brand-intent with 1 signal.

export interface BrandIntentResult {
  isBrandIntent: boolean;  // true only when signalCount >= 2
  signalCount: number;
  signals: string[];       // for audit trail
}

export interface BrandIntentInput {
  queryText: string;
  businessName: string;
  city: string;
  state: string;
  categories: string[];
  keyAmenities: string[];   // true amenity names
  uniqueAttributes: string[]; // distinguishing phrases
}

// Signal types:
//   city: query.includes(city) → 'city:Alpharetta'
//   state: query.includes(state or abbreviation) → 'state:GA'
//   business_name: first-word match ≥ 4 chars → 'business_name:charcoal'
//   category: matches category keyword array → 'category:hookah'
//   amenity: matches key amenity → 'amenity:hookah'
//   attribute: matches first 6 chars of unique attribute

export function isBrandIntentQuery(input: BrandIntentInput): BrandIntentResult
```

---

### Component 3: `lib/hijack/hijack-detector.ts` — NEW

```typescript
// 28-day baseline gate. Aggregate competitor appearances. Return HijackAlert[].
// AI_RULES §166: NEVER produce alerts before 28-day baseline.

const MIN_BASELINE_DAYS = 28;

export interface HijackAlert {
  competitorName: string;
  hijackedQueries: string[];
  enginesDetected: string[];
  isNew: boolean;  // true = not in existing hijack_alerts table
}

export interface HijackDetectionResult {
  alerts: HijackAlert[];
  baselineSufficient: boolean;
  baselineStartDate: string | null;
  earliestAlertDate: string | null;
}

// detectHijacks(orgId, locationId, supabase) → HijackDetectionResult
//
// Algorithm:
// 1. Check baseline: first sov_model_results row date. If < 28 days → return insufficient.
// 2. Fetch location fields for brand-intent scoring.
// 3. Fetch recent sov_model_results (last 14 days) WHERE cited=false.
// 4. For each non-cited result: run isBrandIntentQuery(). Skip if isBrandIntent=false.
// 5. For brand-intent non-cited: fetch matching sov_evaluations.mentioned_competitors.
// 6. Aggregate: group hijacked queries by competitor name → one HijackAlert per competitor.
// 7. Compare against existing hijack_alerts table → set isNew flag.
// 8. Return aggregated alerts.

export async function detectHijacks(
  orgId: string,
  locationId: string,
  supabase: SupabaseClient,
): Promise<HijackDetectionResult>
```

---

### Component 4: `app/api/cron/hijack-detection/route.ts` — NEW

```typescript
// Schedule: "0 7 * * 1" (Monday 7 AM UTC)
// Kill switch: HIJACK_CRON_DISABLED=true
//
// For each active org with Agency plan:
//   1. detectHijacks(orgId, locationId, supabase)
//   2. Upsert new HijackAlert[] into hijack_alerts (ON CONFLICT UPDATE hijacked_queries, engines, last_detected_at)
//   3. For isNew=true alerts: send HijackAlertEmail via Resend; set email_sent_at
//   4. For resolved: mark alerts resolved where competitor no longer in current run
// Returns { processed, newAlerts, resolvedAlerts, noBaseline }
```

---

### Component 5: `emails/hijack-alert.tsx` — NEW (React Email)

```typescript
// Subject: "⚠️ [Competitor] is intercepting your AI search results"
// Body: N queries affected, which engines, link to source-intelligence dashboard
// Reuse existing Resend + React Email infrastructure
// Never embed customer query text verbatim — show query count only for privacy
```

---

### Component 6: `app/dashboard/source-intelligence/_components/HijackingAlertsSection.tsx` — NEW

```typescript
// Server component. Reads hijack_alerts for org.
// States:
//   no_baseline: "Building baseline — alerts available [date]" (amber card)
//   no_hijacks: "No competitor interceptions detected ✅" (green)
//   active_hijacks: Red alert cards, one per competitor
// Per alert card:
//   - Competitor name + engine badges + affected query count + first seen date
//   - "Create Content to Reclaim →" → createDraftFromHijack(alertId)
// data-testid: "hijacking-alerts-section", "hijack-card-[competitor]", "no-baseline-message"
```

---

### Component 7: `src/__tests__/unit/hijack-detection.test.ts` — NEW (target: 26 tests)

```typescript
describe('isBrandIntentQuery — signal count enforcement', () => {
  it('returns isBrandIntent=false with only 1 signal (§166 rule)')
  it('returns isBrandIntent=true with city + category (2 signals)')
  it('returns isBrandIntent=true with city + amenity (2 signals)')
  it('returns isBrandIntent=true with city + business name fragment')
  it('counts 3 signals correctly when city + category + amenity all match')
  it('is case-insensitive for city match')
  it('detects state abbreviation (GA for Georgia)')
  it('handles empty categories array')
  it('handles empty keyAmenities array')
  it('generic query with 0 signals → isBrandIntent=false')
})

describe('detectHijacks — baseline gating', () => {
  it('returns baselineSufficient=false when first SOV < 28 days ago')
  it('returns correct earliestAlertDate (baseline + 28 days)')
  it('returns empty alerts when baselineSufficient=false')
  it('returns baselineSufficient=true when > 28 days data exists')
})

describe('detectHijacks — aggregation', () => {
  it('aggregates multiple hijacked queries from same competitor into 1 alert')
  it('sets isNew=true when competitor not in existing hijack_alerts')
  it('sets isNew=false when competitor already in active alerts table')
  it('includes all engines that detected the competitor')
  it('only includes queries where isBrandIntentQuery=true')
  it('skips queries where isBrandIntentQuery=false')
})

describe('hijack-detection cron', () => {
  it('returns 401 without CRON_SECRET')
  it('returns skipped when kill switch active')
  it('upserts with ON CONFLICT to avoid duplicate rows')
  it('sends email only for isNew=true (email_sent_at null)')
  it('does not re-send email for ongoing hijack (email_sent_at set)')
  it('marks alert resolved when competitor no longer in current run')
})
```

---

## 🚫 What NOT to Do

1. **DO NOT alert before 28 days of SOV data** — `MIN_BASELINE_DAYS = 28` is absolute.
2. **DO NOT classify single-signal queries as brand-intent** — requires 2+.
3. **DO NOT create separate alert rows per query** — UNIQUE on `(org_id, location_id, competitor_name)`.
4. **DO NOT re-send hijack email** — check `email_sent_at != null` before sending.
5. **DO NOT run this for Starter or Growth plans** — Agency only (competitors data is premium).

---

## ✅ Definition of Done

- [ ] Migration: `hijack_alerts` table with RLS + UNIQUE constraint
- [ ] `isBrandIntentQuery()` — 2+ signal requirement enforced
- [ ] `detectHijacks()` — 28-day gate, competitor aggregation, `isNew` flag
- [ ] Weekly cron `hijack-detection` + `vercel.json` updated
- [ ] Email `hijack-alert.tsx` with Resend + email_sent_at guard
- [ ] `HijackingAlertsSection` — no-baseline state + active alerts
- [ ] `createDraftFromHijack()` server action (wires to Sprint 86 brief generator)
- [ ] 26 tests passing
- [ ] `npx vitest run` — ALL tests passing, 0 regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 🔮 AI_RULES Addition

```markdown
## §166. Competitive Prompt Hijacking Alerts (Sprint 125)

Detection in `lib/hijack/hijack-detector.ts`, scoring in `lib/hijack/brand-intent-scorer.ts`.

* **NEVER alert before 28-day SOV baseline.** `MIN_BASELINE_DAYS = 28` is constant.
* **`isBrandIntentQuery()` requires 2+ signals** — single-signal queries never brand-intent.
* **One alert per competitor** — UNIQUE(org_id, location_id, competitor_name). Aggregate queries.
* **One email per competitor, ever** — check `email_sent_at` before sending.
* **Agency-only** — Growth and below see no hijacking alerts.
* **Migration:** `20260330000001_hijack_alerts.sql` (activation date).
* **Tests:** 26 Vitest.
```

---

## Wave 3 Execution Summary

| Sprint | Start | Est. Time | Gate |
|--------|-------|-----------|------|
| **132** | Now | 4–6 hrs | None |
| **126** | Now (write spec first) | 5–7 hrs | `docs/21-AGENT-SEO.md` |
| **125** | ~March 30, 2026 | 4–5 hrs | 28-day SOV baseline |
