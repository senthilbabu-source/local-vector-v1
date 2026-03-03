# LocalVector — Wave 4 Sprint Prompts
## Sprints 133 · 134 · 135 — Data-Gated Features

> **Claude Code Prompt — First-Pass Ready**
> Paste each sprint separately into VS Code Claude Code (`Cmd+L` / `Ctrl+L`).
> **Always upload alongside:** `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## ⏳ Wave 4 Activation Gates — DO NOT START EARLY

| Sprint | Gate Condition | How to Verify |
|--------|---------------|---------------|
| **133** RAG Chatbot Widget | `menu_items` ≥ 80% complete for ≥1 Agency location + all amenities set + full `hours_data` | `SELECT COUNT(*) FROM menu_items WHERE org_id = '[agency_org]'` — compare to real menu count |
| **134** Engine Playbooks | 8+ weeks of `sov_model_results` (Sprint 123 started March 2, 2026 → earliest ~April 27, 2026) | `SELECT MIN(created_at) FROM sov_model_results WHERE org_id = '[agency_org]'` |
| **135** Intent Discovery | Same as Sprint 134 + Perplexity results specifically present | `SELECT COUNT(*) FROM sov_model_results WHERE model_provider = 'perplexity-sonar' AND org_id = '[agency_org]'` — need ≥ 200 rows |

**These features fail without the data.** Shipping them early produces wrong answers (RAG) or baseless recommendations (Playbooks, Intent).

---

---

# Sprint 133 — Truth-Grounded RAG Chatbot Widget

> **Claude Code Prompt — First-Pass Ready**
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

An embeddable chat widget (`<script src="localvector.ai/widget/[slug].js">`) that answers customer questions about the business using LocalVector's verified ground truth as the RAG context. Zero hallucinations because answers come **only** from data manually verified in the Truth Calibration form.

**Why this is not a normal chatbot:** There is no LLM knowledge retrieval. The model receives a strict system prompt containing only the business's actual data — hours, menu, amenities, corrections. If the answer isn't in that context, the widget says "I don't have that — please call us at [phone]."

**What a customer sees on the business website:**
```
[💬 Ask us anything]

Customer: Do you have vegan options?
Widget:   Yes! We have several vegan options including the
          Mediterranean Bowl and Sweet Potato Curry.
          (Charcoal N Chill, Alpharetta)

Customer: Are you open on Sundays?
Widget:   We're open Sunday 4 PM – 2 AM.

Customer: Can I book a private event?
Widget:   I don't have details on that — please call us
          at (770) 555-0142 for private events.
```

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                               — All rules, especially §39 (pure services)
Read CLAUDE.md                                      — Architecture
Read supabase/prod_schema.sql                       — menu_items (all columns), locations,
                                                      magic_menus (extracted_data, json_ld_schema,
                                                      public_slug), ai_audits (hallucination corrections)
Read lib/supabase/database.types.ts                 — Full Database type (§38)
Read app/(public)/m/[slug]/page.tsx                 — COMPLETE FILE. Existing public page pattern to mirror
Read lib/data/                                      — ls. Understand fetcher patterns
Read src/__fixtures__/golden-tenant.ts              — GOLDEN_TENANT (§4)
Read vercel.json                                    — Current crons; we do NOT add a cron here
Read lib/ai/providers.ts                            — Available model keys
```

---

## 🗄️ Data Gate Check — Add to top of RAG context builder

```typescript
// lib/rag/rag-readiness-check.ts — Sprint 133
// PURE FUNCTION. Checks if a location's ground truth is complete enough for RAG.

export interface RAGReadinessResult {
  ready: boolean;
  completenessScore: number;  // 0–100
  gaps: string[];             // human-readable list of what's missing
}

export function checkRAGReadiness(input: {
  menuItemCount: number;
  amenitiesSetCount: number;
  amenitiesTotal: number;
  hoursDataComplete: boolean;  // all 7 days present
  operationalStatusSet: boolean;
}): RAGReadinessResult {
  const gaps: string[] = [];
  let score = 0;

  // Menu: 40 pts — we need at least 5 items as a minimum viable bar
  if (input.menuItemCount >= 5) score += 40;
  else gaps.push(`Menu needs at least 5 items (currently ${input.menuItemCount})`);

  // Amenities: 20 pts — at least 50% set (not null)
  const amenityCompleteness = input.amenitiesTotal > 0
    ? input.amenitiesSetCount / input.amenitiesTotal
    : 0;
  if (amenityCompleteness >= 0.5) score += 20;
  else gaps.push(`Amenities: ${Math.round(amenityCompleteness * 100)}% set (need 50%+)`);

  // Hours: 25 pts
  if (input.hoursDataComplete) score += 25;
  else gaps.push('Hours data incomplete (need all 7 days)');

  // Operational status: 15 pts
  if (input.operationalStatusSet) score += 15;
  else gaps.push('Operational status not set');

  return { ready: score >= 80, completenessScore: score, gaps };
}
```

**The widget page reads this score on load. If `ready=false`, the owner sees a completeness bar in the dashboard widget settings — not an error in production.**

---

## 🏗️ Architecture

```
lib/rag/
  ├── rag-readiness-check.ts  — pure completeness gate (above)
  ├── rag-context-builder.ts  — buildRAGContext(locationId, supabase) → RAGContext
  └── rag-responder.ts        — answerQuestion(question, ragContext) → RAGAnswer

app/(public)/widget/[slug]/
  └── page.tsx                — iframe-rendered widget UI (minimal, white-label ready)

app/(public)/widget/[slug].js/
  └── route.ts                — embed script (injects iframe into customer site)

app/api/widget/chat/
  └── route.ts                — POST endpoint (rate-limited, calls rag-responder)

app/dashboard/settings/widget/
  └── page.tsx                — Widget settings: enable/disable, colors, greeting, embed code

No new DB table. Widget settings stored on locations:
  locations.widget_enabled BOOLEAN DEFAULT false
  locations.widget_settings JSONB DEFAULT NULL  -- { color, position, greeting }
```

---

## 📐 Component Specs

### Component 1: Migration — `supabase/migrations/20260427000001_widget_settings.sql`

```sql
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS widget_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS widget_settings JSONB DEFAULT NULL;

COMMENT ON COLUMN public.locations.widget_settings IS
  'RAG widget configuration: {color, position, greeting, daily_limit}. Sprint 133.';
```

---

### Component 2: `lib/rag/rag-context-builder.ts` — NEW

```typescript
// lib/rag/rag-context-builder.ts — Sprint 133
//
// Assembles the knowledge base for RAG answering.
// AI_RULES §169: NEVER include speculative or unknown values in RAG context.
//   If a field is null/unknown, omit it entirely — never include "We don't have X".
//   The model should say "I don't have that info" rather than "We don't have X".

import type { SupabaseClient } from '@supabase/supabase-js';

export interface RAGContext {
  businessName: string;
  address: string;
  phone: string | null;
  website: string | null;
  hours: string;              // human-readable, e.g. "Mon–Fri 11am–10pm, Sat–Sun 4pm–2am"
  operationalStatus: string;  // "open", "temporarily closed", "permanently closed"
  menuItems: RAGMenuItem[];
  amenities: string[];        // only true amenity names: ["hookah", "outdoor seating"]
  corrections: string[];      // verified corrections from ai_audits
  faqPairs: Array<{ q: string; a: string }>;  // from locations.faq_cache (Sprint 128)
}

export interface RAGMenuItem {
  name: string;
  description?: string;
  price?: string;             // formatted: "$14.99" or null
  category: string;
  dietaryTags: string[];      // ["vegan", "gluten-free"]
  isAvailable: boolean;
}

/**
 * Build RAG context for a location.
 * Only includes confirmed, non-null data.
 * AI_RULES §169: Omit unknown fields rather than including "we don't have X".
 */
export async function buildRAGContext(
  locationId: string,
  supabase: SupabaseClient,
): Promise<RAGContext | null> {
  const [locationResult, menuResult, correctionsResult] = await Promise.all([
    supabase
      .from('locations')
      .select(`
        business_name, address_line1, city, state, zip, phone, website_url,
        hours_data, operational_status, amenities, faq_cache
      `)
      .eq('id', locationId)
      .single(),

    supabase
      .from('menu_items')
      .select(`
        name, description, price, currency, dietary_tags, is_available,
        menu_categories!inner(name)
      `)
      .eq('location_id', locationId)
      .eq('is_available', true)
      .order('sort_order'),

    // Verified hallucination corrections
    supabase
      .from('ai_audits')
      .select('response_metadata')
      .eq('location_id', locationId)
      .eq('is_hallucination_detected', true)
      .not('response_metadata', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const loc = locationResult.data;
  if (!loc) return null;

  // Build human-readable hours
  const hours = formatHoursData(loc.hours_data as Record<string, unknown> | null);

  // Build amenity list (only TRUE values)
  const amenities = Object.entries((loc.amenities as Record<string, boolean | null>) ?? {})
    .filter(([, v]) => v === true)
    .map(([k]) => k.replace(/_/g, ' '));

  // Build correction strings from ai_audits metadata
  const corrections = (correctionsResult.data ?? [])
    .map(row => {
      const meta = row.response_metadata as { correction?: string } | null;
      return meta?.correction ?? null;
    })
    .filter(Boolean) as string[];

  // Build menu items
  const menuItems: RAGMenuItem[] = (menuResult.data ?? []).map(item => ({
    name: item.name,
    description: item.description ?? undefined,
    price: item.price ? `$${Number(item.price).toFixed(2)}` : undefined,
    category: (item.menu_categories as { name: string }).name,
    dietaryTags: Array.isArray(item.dietary_tags) ? item.dietary_tags as string[] : [],
    isAvailable: item.is_available,
  }));

  // FAQ pairs from Sprint 128 cache (if present)
  const faqPairs = Array.isArray(loc.faq_cache) ? loc.faq_cache as Array<{ q: string; a: string }> : [];

  return {
    businessName: loc.business_name ?? '',
    address: [loc.address_line1, loc.city, loc.state, loc.zip].filter(Boolean).join(', '),
    phone: loc.phone ?? null,
    website: loc.website_url ?? null,
    operationalStatus: loc.operational_status ?? 'open',
    hours,
    menuItems,
    amenities,
    corrections,
    faqPairs,
  };
}

/**
 * Format hours_data JSONB into human-readable string.
 * Input: { monday: { open: "11:00", close: "22:00" }, ... }
 * Output: "Mon 11am–10pm, Tue 11am–10pm, ..."
 * Returns "Hours not available" if null/incomplete.
 */
export function formatHoursData(hoursData: Record<string, unknown> | null): string {
  if (!hoursData) return 'Hours not available';
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const abbr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const parts: string[] = [];
  for (let i = 0; i < days.length; i++) {
    const day = hoursData[days[i]] as { open?: string; close?: string; closed?: boolean } | undefined;
    if (!day) continue;
    if (day.closed) { parts.push(`${abbr[i]}: Closed`); continue; }
    if (day.open && day.close) {
      parts.push(`${abbr[i]} ${formatTime(day.open)}–${formatTime(day.close)}`);
    }
  }
  return parts.length > 0 ? parts.join(', ') : 'Hours not available';
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, '0')}${period}`;
}
```

---

### Component 3: `lib/rag/rag-responder.ts` — NEW

```typescript
// lib/rag/rag-responder.ts — Sprint 133
//
// Calls Claude API with RAG context as system prompt.
// AI_RULES §169: System prompt STRICTLY limits answers to provided context.
//   Never infer or speculate beyond what's in the context.

import * as Sentry from '@sentry/nextjs';
import type { RAGContext } from './rag-context-builder';

export type AnswerConfidence = 'high' | 'medium' | 'low';

export interface RAGAnswer {
  answer: string;
  confidence: AnswerConfidence;
  // 'high': direct match in context
  // 'medium': inferred from context (e.g., amenity flag → capability answer)
  // 'low': not found → fallback message with phone/contact
}

const FALLBACK_PHONE_INSTRUCTION = (phone: string | null) =>
  phone ? `please call us at ${phone}` : 'please contact us directly';

/**
 * Build the strict RAG system prompt.
 * Exported as pure function for testing.
 */
export function buildRAGSystemPrompt(ctx: RAGContext): string {
  const lines: string[] = [
    `You are the customer service assistant for ${ctx.businessName}, located at ${ctx.address}.`,
    '',
    'STRICT RULE: Answer ONLY from the information provided below.',
    `If the answer is not in this information, respond with: "I don't have that information — ${FALLBACK_PHONE_INSTRUCTION(ctx.phone)}."`,
    'NEVER guess, infer beyond the data, or mention competitors.',
    'Keep all answers under 80 words.',
    '',
    `Status: ${ctx.operationalStatus}`,
    `Hours: ${ctx.hours}`,
  ];

  if (ctx.phone) lines.push(`Phone: ${ctx.phone}`);
  if (ctx.website) lines.push(`Website: ${ctx.website}`);

  if (ctx.menuItems.length > 0) {
    lines.push('', '--- MENU ---');
    for (const item of ctx.menuItems) {
      const price = item.price ? ` (${item.price})` : '';
      const tags = item.dietaryTags.length > 0 ? ` [${item.dietaryTags.join(', ')}]` : '';
      const desc = item.description ? ` — ${item.description}` : '';
      lines.push(`• ${item.name}${price}${tags}${desc} [${item.category}]`);
    }
  }

  if (ctx.amenities.length > 0) {
    lines.push('', '--- FEATURES & AMENITIES ---');
    lines.push(ctx.amenities.join(', '));
  }

  if (ctx.corrections.length > 0) {
    lines.push('', '--- VERIFIED CORRECTIONS (use these over any other source) ---');
    for (const c of ctx.corrections) lines.push(`• ${c}`);
  }

  if (ctx.faqPairs.length > 0) {
    lines.push('', '--- COMMON QUESTIONS & ANSWERS ---');
    for (const faq of ctx.faqPairs) {
      lines.push(`Q: ${faq.q}`);
      lines.push(`A: ${faq.a}`);
    }
  }

  return lines.join('\n');
}

/**
 * Answer a customer question using RAG context.
 * Uses claude-sonnet-4-20250514 via Anthropic API (same pattern as other AI calls).
 * AI_RULES §169: Never log question text — log question category only.
 */
export async function answerQuestion(
  question: string,
  ctx: RAGContext,
): Promise<RAGAnswer> {
  try {
    const systemPrompt = buildRAGSystemPrompt(ctx);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);

    const data = await res.json() as { content: Array<{ type: string; text: string }> };
    const answer = data.content.find(b => b.type === 'text')?.text ?? '';

    // Confidence: low if fallback phrase detected, high otherwise
    const isLowConfidence = answer.includes("I don't have that information");
    const isMediumConfidence = answer.includes('based on') || answer.includes('suggests');
    const confidence: AnswerConfidence = isLowConfidence ? 'low' : isMediumConfidence ? 'medium' : 'high';

    return { answer, confidence };
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'rag-responder', sprint: '133' } });
    const fallback = `I'm temporarily unavailable — ${FALLBACK_PHONE_INSTRUCTION(ctx.phone)}.`;
    return { answer: fallback, confidence: 'low' };
  }
}
```

---

### Component 4: `app/api/widget/chat/route.ts` — NEW

```typescript
// POST /api/widget/chat
// Public endpoint — called by widget iframe.
// Rate limiting: 20 req/hour per IP, 100 questions/day per location (Growth), 500 (Agency).
//
// Request body: { slug: string, question: string }
// Response: { answer: string, confidence: 'high'|'medium'|'low' }
//
// Security rules (AI_RULES §170):
//   - Log question category ONLY (not text) — categories: hours/menu/reservation/amenity/other
//   - Never store question text in DB or logs
//   - Reject questions > 500 chars
//   - widget_enabled must be true for the location; 403 otherwise
//   - Validate slug exists before building context
//
// Rate limit headers: X-RateLimit-Remaining, X-RateLimit-Reset
// Use Upstash Redis (existing pattern) for rate limiting.
```

---

### Component 5: `app/(public)/widget/[slug]/page.tsx` — NEW

```typescript
// Minimal iframe-rendered widget UI. White-label ready.
// Renders inside an iframe at localvector.ai/widget/[slug]
//
// UI states:
//   loading: skeleton
//   ready: chat input + message list
//   error: "Chat temporarily unavailable" + phone number
//
// Design tokens: customizable via widget_settings.color + widget_settings.position
// Default greeting from widget_settings.greeting or "Ask us anything!"
// NEVER shows LocalVector branding if org has white-label setting.
//
// Message display:
//   - Customer messages: right-aligned
//   - Bot answers: left-aligned
//   - confidence='low': amber border on message + "For more info: [phone]"
//   - confidence='high'/'medium': no extra indicator
//
// No chat history persistence — stateless per session.
// Question text is NEVER sent to analytics — only POSTed to /api/widget/chat.
```

---

### Component 6: `app/(public)/widget/[slug].js/route.ts` — NEW

```typescript
// GET /widget/[slug].js
// Returns a <script> tag that injects an iframe into the customer's website.
// Validates: slug must exist + widget_enabled=true, else returns empty script.
// iframe src: https://localvector.ai/widget/[slug]
// Position: bottom-right or bottom-left per widget_settings.position
// Button: floating circle with chat bubble icon, color from widget_settings.color
// HTTPS enforcement: if target page is HTTP, returns console.warn only (no crash).
// Cache-Control: max-age=3600 (1 hour)
```

---

### Component 7: `app/dashboard/settings/widget/page.tsx` — NEW

```typescript
// Widget settings dashboard page.
// Shows:
//   - Data completeness bar (from checkRAGReadiness()) — blocks enable if < 80
//   - Enable/disable toggle (writes widget_enabled to locations)
//   - Customization: button color picker, position (bottom-right/left), greeting message
//   - Daily questions usage: [current]/[limit] today
//   - Embed code: <script src="..."> snippet with copy button
//   - Live preview pane showing the actual widget iframe
//
// Plan gate: Growth+ required to enable widget.
// If completenessScore < 80: show gap list from checkRAGReadiness(), disable toggle.
```

---

### Component 8: `src/__tests__/unit/rag.test.ts` — NEW (target: 32 tests)

```typescript
describe('checkRAGReadiness', () => {
  it('returns ready=true when all thresholds met')
  it('returns ready=false when menuItemCount < 5')
  it('returns ready=false when amenity completeness < 50%')
  it('returns ready=false when hours incomplete')
  it('returns ready=false when operational status not set')
  it('score=100 for perfectly complete location')
  it('score=0 for empty location')
  it('gaps array describes each failing dimension')
})

describe('buildRAGContext', () => {
  it('returns null when location not found')
  it('includes only true amenity values (not false or null)')
  it('formats price as $14.99 string')
  it('includes dietary tags from menu items')
  it('includes verified corrections from ai_audits')
  it('includes faq_cache pairs from locations table')
  it('omits description when null (AI_RULES §169)')
})

describe('formatHoursData', () => {
  it('formats standard open/close hours correctly')
  it('handles closed days')
  it('returns "Hours not available" for null input')
  it('formats midnight (00:00) correctly')
  it('formats PM hours (22:00 → 10pm)')
})

describe('buildRAGSystemPrompt', () => {
  it('includes STRICT RULE instruction')
  it('includes fallback phone instruction when phone present')
  it('includes fallback without phone when phone null')
  it('includes menu items with prices and dietary tags')
  it('includes amenities section when amenities present')
  it('includes corrections section when corrections present')
  it('includes FAQ section when faqPairs present')
  it('omits menu section when no menu items')
  it('answer must be under 80 words instruction present')
})

describe('answerQuestion', () => {
  it('returns high confidence for direct menu question')
  it('returns low confidence when answer contains fallback phrase')
  it('returns low confidence on API error with fallback message')
  it('includes phone in fallback when phone present')
  it('captures exception to Sentry on API error')
})

describe('/api/widget/chat route', () => {
  it('returns 400 for missing slug')
  it('returns 403 when widget_enabled=false')
  it('returns 400 for question > 500 chars')
  it('returns 429 when rate limit exceeded')
  it('returns answer and confidence on success')
})
```

---

## 🚫 What NOT to Do

1. **DO NOT enable widget when `checkRAGReadiness().ready = false`** — show completeness bar, not the enable toggle.
2. **DO NOT log question text anywhere** — category only (`hours`, `menu`, `reservation`, `amenity`, `other`).
3. **DO NOT include speculative data in RAG context** — omit null fields entirely (AI_RULES §169).
4. **DO NOT add session persistence** — each widget question is stateless. No history in DB.
5. **DO NOT show LocalVector branding** for white-label orgs — check org settings before rendering.
6. **DO NOT remove the "Answer ONLY from provided information" instruction** — this is the zero-hallucination guarantee.

---

## ✅ Definition of Done

- [ ] Migration: `widget_enabled`, `widget_settings` on `locations`
- [ ] `lib/rag/rag-readiness-check.ts` — `checkRAGReadiness()` pure function
- [ ] `lib/rag/rag-context-builder.ts` — `buildRAGContext()`, `formatHoursData()` (exported for tests)
- [ ] `lib/rag/rag-responder.ts` — `buildRAGSystemPrompt()` (exported), `answerQuestion()`
- [ ] `app/api/widget/chat/route.ts` — rate limited, no question text logging
- [ ] `app/(public)/widget/[slug]/page.tsx` — iframe widget UI
- [ ] `app/(public)/widget/[slug].js/route.ts` — embed script
- [ ] `app/dashboard/settings/widget/page.tsx` — completeness gate + settings + embed code
- [ ] 32 tests passing
- [ ] `npx vitest run` — ALL tests passing, 0 regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 🔮 AI_RULES Addition

```markdown
## §169. Truth-Grounded RAG Chatbot Widget (Sprint 133)

RAG context in `lib/rag/rag-context-builder.ts`, answering in `lib/rag/rag-responder.ts`.

* **Completeness gate:** `checkRAGReadiness().ready` must be true before widget can be enabled. Never allow enable with < 80 completeness score.
* **Omit nulls from context** — never include "We don't have X". If field is null, omit it.
* **System prompt is immutable** — "Answer ONLY from provided information" instruction must never be removed.
* **Zero question logging** — log category only, never question text (PII risk).
* **Stateless per session** — no chat history in DB. Each call is independent.
* **Rate limits:** 20 req/hr per IP, 100/day Growth, 500/day Agency.
* **Tests:** 32 Vitest.
```

---

---

# Sprint 134 — Per-Engine Optimization Playbooks

> **Claude Code Prompt — First-Pass Ready**
> ⚠️ **Activate after ~April 27, 2026** (8 weeks after Sprint 123 started March 2, 2026)
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Each AI engine (Perplexity, ChatGPT, Gemini, Copilot) weights signals differently. After 8 weeks of multi-engine SOV data from Sprint 123, LocalVector has real per-engine citation rates to compare against top competitors. Sprint 134 generates **specific, actionable playbooks** per engine showing exactly why a competitor is outranking you and what to fix.

**Not:** "Improve your website."
**Yes:** "Add `servesCuisine: 'Indian, American'` to your Restaurant JSON-LD on [URL]. Perplexity cites businesses with cuisine schema 3.2× more often than those without."

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                               — All rules
Read CLAUDE.md                                      — Architecture
Read lib/services/multi-model-sov.ts                — COMPLETE FILE. sov_model_results structure
Read lib/config/sov-models.ts                       — COMPLETE FILE. SOV_MODEL_CONFIGS, model providers
Read supabase/prod_schema.sql                       — sov_model_results (all columns), sov_evaluations
                                                      (mentioned_competitors), target_queries, locations
Read lib/supabase/database.types.ts                 — Full Database type (§38)
Read src/__fixtures__/golden-tenant.ts              — GOLDEN_TENANT + RIVAL_TENANT (§4)
Read vercel.json                                    — Current crons; we add 1 (weekly)
```

---

## 🏗️ Architecture

```
No new DB table. Cache on locations:
  locations.playbook_cache JSONB      -- { [engine]: Playbook, generated_at: string }
  locations.playbook_generated_at TIMESTAMPTZ

lib/playbooks/
  ├── playbook-types.ts          — Playbook, PlaybookAction, EngineSignalLibrary types
  ├── engine-signal-library.ts   — HARDCODED signal knowledge per engine (pure data)
  └── playbook-engine.ts         — generatePlaybook(orgId, locationId, engine, supabase) → Playbook

app/api/cron/playbook-generation/route.ts  — Weekly Monday 9 AM UTC
app/dashboard/playbooks/page.tsx           — New page with engine tabs
```

---

## 📐 Component Specs

### Component 1: Migration — `supabase/migrations/20260427000002_playbook_cache.sql`

```sql
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS playbook_cache JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS playbook_generated_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.locations.playbook_cache IS
  'Cached per-engine Playbook objects keyed by model_provider. Sprint 134.';
```

---

### Component 2: `lib/playbooks/engine-signal-library.ts` — NEW (pure data, no I/O)

```typescript
// lib/playbooks/engine-signal-library.ts — Sprint 134
//
// Hardcoded engine signal knowledge based on known LLM behavior patterns.
// AI_RULES §171: Signal weights are heuristics, not ML outputs. Always label
// recommendations as "evidence suggests" not "guaranteed to improve".
//
// This is never dynamically updated — it reflects the best known signal
// patterns as of Sprint 134. Update manually as engine behavior changes.

export interface SignalDefinition {
  id: string;
  label: string;                    // human-readable: "Restaurant Schema Markup"
  description: string;              // why this engine weights this signal
  checkFn: (locationData: LocationSignalInput) => SignalStatus;
  fixGuide: string;                 // specific, actionable instructions
  estimatedImpact: 'high' | 'medium' | 'low';
  linkedLocalVectorFeature?: string; // e.g., '/dashboard/magic-menus'
}

export type SignalStatus = 'present' | 'missing' | 'partial';

export interface LocationSignalInput {
  hasRestaurantSchema: boolean;
  hasMenuSchema: boolean;
  hasReserveActionSchema: boolean;
  gbpVerified: boolean;
  gbpCompleteness: number;        // 0–100 from Sprint 124 data health
  reviewCount: number;
  avgRating: number | null;
  lastReviewDate: string | null;  // ISO date
  websiteUrl: string | null;
  hasWikidataEntry: boolean;
  hasBingPlacesEntry: boolean;    // from Sprint 131 connection
  canonicalUrlConsistent: boolean; // website_url matches GBP website field
  menuItemCount: number;
}

export const ENGINE_SIGNAL_LIBRARIES: Record<string, SignalDefinition[]> = {
  'perplexity-sonar': [
    {
      id: 'citation_domain_authority',
      label: 'Cited Source Quality',
      description: 'Perplexity weights domain authority and freshness of sources it cites about your business.',
      checkFn: (d) => d.websiteUrl ? 'present' : 'missing',
      fixGuide: 'Ensure your website URL is set and consistent across all listings. A website that Perplexity can crawl and cite is the #1 Perplexity signal.',
      estimatedImpact: 'high',
      linkedLocalVectorFeature: '/dashboard/settings/business-info',
    },
    {
      id: 'canonical_url',
      label: 'Consistent Business URL',
      description: 'Perplexity detects inconsistent URLs across GBP, website, and directories as a low-authority signal.',
      checkFn: (d) => d.canonicalUrlConsistent ? 'present' : 'missing',
      fixGuide: 'Ensure your website URL in GBP, Yelp, and your Magic Menu all use the same canonical URL (https://www.yourdomain.com not http://yourdomain.com).',
      estimatedImpact: 'medium',
      linkedLocalVectorFeature: '/dashboard/settings/connections',
    },
    {
      id: 'menu_schema',
      label: 'Menu Data in Schema',
      description: 'Perplexity cites structured menu data when answering food/service queries.',
      checkFn: (d) => d.hasMenuSchema ? 'present' : d.menuItemCount > 0 ? 'partial' : 'missing',
      fixGuide: 'Publish your Magic Menu with JSON-LD schema enabled. This makes your menu directly readable by Perplexity.',
      estimatedImpact: 'high',
      linkedLocalVectorFeature: '/dashboard/magic-menus',
    },
  ],
  'gpt-4o-mini': [
    {
      id: 'factual_consistency',
      label: 'Consistent Business Facts Across Web',
      description: 'ChatGPT Browse weights consistency of business name, address, and phone across multiple sources.',
      checkFn: (d) => d.gbpVerified && d.canonicalUrlConsistent ? 'present' : 'partial',
      fixGuide: 'Ensure your NAP (Name, Address, Phone) is identical across GBP, your website, Yelp, and all directory listings. Even minor differences (St. vs Street) reduce citation probability.',
      estimatedImpact: 'high',
      linkedLocalVectorFeature: '/dashboard/settings/connections',
    },
    {
      id: 'structured_data',
      label: 'Restaurant/LocalBusiness Schema',
      description: 'ChatGPT Browse uses structured data to verify business category and attributes.',
      checkFn: (d) => d.hasRestaurantSchema ? 'present' : 'missing',
      fixGuide: 'Add complete LocalBusiness or Restaurant JSON-LD schema to your homepage including name, address, telephone, openingHours, and servesCuisine.',
      estimatedImpact: 'high',
      linkedLocalVectorFeature: '/dashboard/agent-readiness',
    },
    {
      id: 'review_recency',
      label: 'Recent Review Activity',
      description: 'ChatGPT incorporates review recency as a freshness signal for local business recommendations.',
      checkFn: (d) => {
        if (!d.lastReviewDate) return 'missing';
        const daysSince = (Date.now() - new Date(d.lastReviewDate).getTime()) / 86400000;
        return daysSince < 30 ? 'present' : daysSince < 90 ? 'partial' : 'missing';
      },
      fixGuide: 'Respond to reviews regularly and encourage recent customers to leave reviews. A review in the last 30 days significantly improves ChatGPT citation frequency.',
      estimatedImpact: 'medium',
      linkedLocalVectorFeature: '/dashboard/reviews',
    },
  ],
  'gemini-flash': [
    {
      id: 'gbp_completeness',
      label: 'Google Business Profile Completeness',
      description: 'Gemini heavily weights GBP completeness — it is the primary data source for Google AI.',
      checkFn: (d) => d.gbpCompleteness >= 80 ? 'present' : d.gbpCompleteness >= 50 ? 'partial' : 'missing',
      fixGuide: 'Complete all GBP fields: description, categories, attributes, photos, services, and product catalog. Use LocalVector\'s data health score to identify gaps.',
      estimatedImpact: 'high',
      linkedLocalVectorFeature: '/dashboard/settings/connections',
    },
    {
      id: 'reserve_action_schema',
      label: 'Reservation Booking Markup',
      description: 'Gemini surfaces ReserveAction schema in AI Overviews for local service queries.',
      checkFn: (d) => d.hasReserveActionSchema ? 'present' : 'missing',
      fixGuide: 'Add ReserveAction JSON-LD to your website and Magic Menu. This enables Gemini to surface your booking link directly in AI Overview results.',
      estimatedImpact: 'high',
      linkedLocalVectorFeature: '/dashboard/agent-readiness',
    },
    {
      id: 'review_rating',
      label: 'Review Rating Quality',
      description: 'Gemini uses average rating as a quality signal for local business recommendations.',
      checkFn: (d) => (d.avgRating ?? 0) >= 4.0 ? 'present' : (d.avgRating ?? 0) >= 3.5 ? 'partial' : 'missing',
      fixGuide: 'Use entity-optimized review responses to improve engagement and encourage follow-up visits that generate positive reviews.',
      estimatedImpact: 'medium',
      linkedLocalVectorFeature: '/dashboard/reviews',
    },
  ],
  'copilot': [
    {
      id: 'bing_places_accuracy',
      label: 'Bing Places Accuracy',
      description: 'Microsoft Copilot uses Bing Places as its primary local business data source.',
      checkFn: (d) => d.hasBingPlacesEntry ? 'present' : 'missing',
      fixGuide: 'Connect and sync your Bing Places listing via LocalVector Connections. Copilot citation probability increases significantly with a verified Bing listing.',
      estimatedImpact: 'high',
      linkedLocalVectorFeature: '/dashboard/settings/connections',
    },
    {
      id: 'entity_graph',
      label: 'Microsoft Entity Graph Presence',
      description: 'Copilot checks the Microsoft Knowledge Graph for entity verification.',
      checkFn: (d) => d.hasBingPlacesEntry && d.canonicalUrlConsistent ? 'present' : 'partial',
      fixGuide: 'Ensure Bing Places name, address, and phone exactly match your website and GBP. Consistency signals entity authority to Microsoft\'s knowledge graph.',
      estimatedImpact: 'medium',
      linkedLocalVectorFeature: '/dashboard/entity-health',
    },
  ],
};
```

---

### Component 3: `lib/playbooks/playbook-engine.ts` — NEW

```typescript
// lib/playbooks/playbook-engine.ts — Sprint 134
//
// Generates a per-engine playbook comparing client vs. top competitor citation rates.
// AI_RULES §171: Estimates are heuristics. Label as "evidence suggests" not "guaranteed".

export interface PlaybookAction {
  signalId: string;
  label: string;           // "Restaurant Schema Markup"
  priority: 'high' | 'medium' | 'low';
  status: SignalStatus;    // 'present' | 'missing' | 'partial'
  description: string;
  fixGuide: string;
  estimatedImpact: 'high' | 'medium' | 'low';
  linkedLocalVectorFeature?: string;
}

export interface Playbook {
  engine: string;            // 'perplexity-sonar'
  engineDisplayName: string; // 'Perplexity'
  clientCitationRate: number; // 0–1: how often we're cited for this engine
  topCompetitorRate: number;  // top competitor's rate
  gapPercent: number;        // (topCompetitorRate - clientCitationRate) * 100
  actions: PlaybookAction[]; // ordered by estimatedImpact then status=missing first
  insufficientData: boolean;  // true when < 20 queries tracked for this engine
  generatedAt: string;
}

/**
 * Generate a playbook for one engine.
 * Reads sov_model_results to compute citation rates.
 * Reads location signals to evaluate ENGINE_SIGNAL_LIBRARIES.
 */
export async function generatePlaybook(
  orgId: string,
  locationId: string,
  engine: string,
  supabase: SupabaseClient,
): Promise<Playbook>
// Implementation:
// 1. Count total sov_model_results rows for this engine → if < 20, set insufficientData=true
// 2. Count cited=true rows → clientCitationRate = cited/total
// 3. Aggregate mentioned_competitors from sov_evaluations → find top competitor by frequency
//    → topCompetitorRate = competitor_appearances / total_queries (rough heuristic)
// 4. Build LocationSignalInput from locations + magic_menus + integrations
// 5. Run each SignalDefinition.checkFn() from ENGINE_SIGNAL_LIBRARIES[engine]
// 6. Build PlaybookAction list ordered by impact (high first) then missing before partial
// 7. Return Playbook

/**
 * Generate all engine playbooks and cache on locations.
 */
export async function generateAllPlaybooks(
  orgId: string,
  locationId: string,
  supabase: SupabaseClient,
): Promise<Record<string, Playbook>>
// Calls generatePlaybook() for each enabled engine.
// Writes result to locations.playbook_cache as { perplexity-sonar: Playbook, ... }
```

---

### Component 4: `app/api/cron/playbook-generation/route.ts` — NEW

```typescript
// Schedule: "0 9 * * 1" (9 AM UTC every Monday)
// Kill switch: PLAYBOOK_CRON_DISABLED=true
// For each Agency org with sufficient SOV data:
//   generateAllPlaybooks(orgId, locationId, supabase)
// Returns { processed, skipped_insufficient_data, errors }
// NOTE: Weekly only — playbook generation is expensive (multiple DB aggregations per engine).
```

---

### Component 5: `app/dashboard/playbooks/page.tsx` — NEW

```typescript
// New page at /dashboard/playbooks
// Reads from locations.playbook_cache.
//
// Layout:
//   Header: "Your AI Engine Playbook"
//   Subtitle: "What each AI engine needs to cite your business more often"
//   Engine tabs: [Perplexity] [ChatGPT] [Gemini] [Copilot] — only show enabled engines
//
// Per engine tab:
//   Citation rate gauge: "You: 34%  |  Top competitor: 67%  |  Gap: 33%"
//   Insufficient data state: "Collecting data... Available [date]" (amber card)
//   Actions list ordered: Missing (high impact first) → Partial → Present
//     Per action card:
//       - Priority badge (🔴 High / 🟡 Medium / 🟢 Low)
//       - Status badge (✅ Done / ⚠️ Partial / ❌ Missing)
//       - Label + description
//       - Fix guide text
//       - "Fix this →" CTA → links to linkedLocalVectorFeature if present
//
// Disclaimer below each tab: "Recommendations are based on observed citation patterns
// and may not reflect all factors influencing AI responses."
//
// Plan gate: Agency only.
// data-testid: "playbooks-page", "engine-tab-[provider]", "action-card-[signalId]"
```

---

### Component 6: `src/__tests__/unit/playbooks.test.ts` — NEW (target: 28 tests)

```typescript
describe('ENGINE_SIGNAL_LIBRARIES — perplexity-sonar', () => {
  it('canonical_url: returns present when canonicalUrlConsistent=true')
  it('canonical_url: returns missing when canonicalUrlConsistent=false')
  it('menu_schema: returns present when hasMenuSchema=true')
  it('menu_schema: returns partial when menuItemCount > 0 but no schema')
  it('menu_schema: returns missing when no menu at all')
})

describe('ENGINE_SIGNAL_LIBRARIES — gpt-4o-mini', () => {
  it('review_recency: present when lastReviewDate < 30 days ago')
  it('review_recency: partial when 30–90 days ago')
  it('review_recency: missing when > 90 days ago')
  it('review_recency: missing when null')
})

describe('ENGINE_SIGNAL_LIBRARIES — gemini-flash', () => {
  it('gbp_completeness: present when score >= 80')
  it('gbp_completeness: partial when 50–79')
  it('gbp_completeness: missing when < 50')
})

describe('ENGINE_SIGNAL_LIBRARIES — copilot', () => {
  it('bing_places_accuracy: present when hasBingPlacesEntry=true')
  it('bing_places_accuracy: missing when hasBingPlacesEntry=false')
})

describe('generatePlaybook', () => {
  it('sets insufficientData=true when < 20 queries for engine')
  it('computes clientCitationRate as cited/total')
  it('orders actions: missing high-impact first')
  it('includes linkedLocalVectorFeature in actions when defined')
  it('sets generatedAt to current ISO timestamp')
  it('returns gapPercent as (topCompetitorRate - clientCitationRate) * 100')
})

describe('generateAllPlaybooks', () => {
  it('generates playbook for each enabled engine')
  it('writes result to locations.playbook_cache')
  it('includes generated_at in cache root')
})

describe('playbook-generation cron', () => {
  it('returns 401 without CRON_SECRET')
  it('returns skipped when kill switch active')
  it('skips orgs without Agency plan')
  it('continues processing when one org fails')
  it('returns processed count in response')
})

describe('playbooks page', () => {
  it('shows insufficient data state when insufficientData=true')
  it('shows citation rate gap when data is sufficient')
  it('orders action cards: missing before partial before present')
})
```

---

## ✅ Definition of Done

- [ ] Migration: `playbook_cache`, `playbook_generated_at` on `locations`
- [ ] `lib/playbooks/engine-signal-library.ts` — signal libraries for all 4 engines
- [ ] `lib/playbooks/playbook-engine.ts` — `generatePlaybook()` + `generateAllPlaybooks()`
- [ ] Weekly cron `playbook-generation` + `vercel.json` updated
- [ ] `app/dashboard/playbooks/page.tsx` — engine tabs + action cards + disclaimer
- [ ] 28 tests passing
- [ ] `npx vitest run` — ALL tests passing, 0 regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 🔮 AI_RULES Addition

```markdown
## §171. Per-Engine Optimization Playbooks (Sprint 134)

Signal library in `lib/playbooks/engine-signal-library.ts`, generation in `lib/playbooks/playbook-engine.ts`.

* **Signal weights are heuristics, not ML outputs.** Always label as "evidence suggests", never "guaranteed to improve".
* **`insufficientData=true` when < 20 queries for engine.** Show collection message, never empty recommendations.
* **Disclaimer required on all playbook pages:** "Recommendations based on observed citation patterns."
* **Weekly generation only** — too expensive for nightly. Cache on `locations.playbook_cache`.
* **Agency-only feature** — Growth and below do not see playbooks.
* **Competing recommendations:** if SGE recommendation conflicts with llms.txt (Sprint 97), flag the conflict explicitly rather than giving contradictory advice.
* **Tests:** 28 Vitest.
```

---

---

# Sprint 135 — Conversational Intent Discovery

> **Claude Code Prompt — First-Pass Ready**
> ⚠️ **Activate after ~April 27, 2026** (same gate as Sprint 134; needs Perplexity history)
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

SOV tracking (Sprint 123) checks queries LocalVector programs. Intent Discovery finds queries **real customers actually type** that the business is missing. Claude generates 50 realistic prompts → Perplexity runs them → gaps surface where competitors appear but the client doesn't → content briefs generated automatically.

**Example discovery for Charcoal N Chill:**
```
Discovered gap: "best place for bachelorette party hookah Alpharetta"
  → Perplexity cited: XYZ Hookah Bar, Atlanta Smoke House
  → Charcoal N Chill: NOT CITED
  → [Generate Content Brief →] → Sprint 86 brief: "Bachelorette Party Hookah Lounge Guide"
```

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                               — All rules, especially §39
Read CLAUDE.md                                      — Architecture
Read lib/services/multi-model-sov.ts                — COMPLETE FILE. Perplexity API pattern
Read lib/config/sov-models.ts                       — COMPLETE FILE. Perplexity sonar config
Read supabase/prod_schema.sql                       — intent_discoveries (new table), locations,
                                                      content_drafts (trigger_type check constraint)
Read lib/supabase/database.types.ts                 — Full Database type (§38)
Read app/dashboard/content-brief-generator/         — ls. Sprint 86 content brief integration point
Read src/__fixtures__/golden-tenant.ts              — GOLDEN_TENANT (§4)
Read vercel.json                                    — Current crons; we add 1 (weekly)
```

---

## 🏗️ Architecture

```
lib/intent/
  ├── intent-types.ts       — IntentGap, IntentDiscovery, IntentTheme types
  ├── prompt-expander.ts    — expandPrompts(location, sampleSize) → string[] via Claude API
  └── intent-discoverer.ts  — discoverIntents(locationId, supabase) → IntentDiscovery

supabase/migrations/20260427000003_intent_discoveries.sql
  └── intent_discoveries table

app/api/cron/intent-discovery/route.ts  — Weekly (different day than playbooks)
app/dashboard/intent-discovery/page.tsx — New page
```

---

## 📐 Component Specs

### Component 1: Migration — `supabase/migrations/20260427000003_intent_discoveries.sql`

```sql
CREATE TABLE IF NOT EXISTS public.intent_discoveries (
  id              uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  prompt          text NOT NULL,
  theme           text NOT NULL CHECK (theme IN ('hours', 'events', 'offerings', 'comparison', 'occasion', 'location', 'other')),
  client_cited    boolean NOT NULL DEFAULT false,
  competitors_cited text[] NOT NULL DEFAULT '{}',
  opportunity_score integer NOT NULL DEFAULT 0 CHECK (opportunity_score BETWEEN 0 AND 100),
  brief_created   boolean NOT NULL DEFAULT false,
  content_draft_id uuid REFERENCES public.content_drafts(id),
  discovered_at   timestamptz NOT NULL DEFAULT now(),
  run_id          uuid NOT NULL,  -- groups all gaps from same discovery run
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intent_discoveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON public.intent_discoveries
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_all" ON public.intent_discoveries
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_intent_gaps ON public.intent_discoveries (org_id, client_cited, opportunity_score DESC)
  WHERE client_cited = false;
CREATE INDEX idx_intent_run ON public.intent_discoveries (org_id, run_id, discovered_at DESC);
```

---

### Component 2: `lib/intent/intent-types.ts` — NEW

```typescript
export type IntentTheme = 'hours' | 'events' | 'offerings' | 'comparison' | 'occasion' | 'location' | 'other';

export interface IntentGap {
  prompt: string;
  theme: IntentTheme;
  clientCited: boolean;
  competitorsCited: string[];   // competitor names found in response
  opportunityScore: number;     // 0–100: higher = more important to fix
  // Scoring: 50 base if not cited + 30 if high competitor count + 20 if occasion/comparison theme
}

export interface IntentDiscovery {
  runId: string;
  totalPromptsRun: number;
  gaps: IntentGap[];           // only prompts where client NOT cited
  covered: IntentGap[];        // prompts where client WAS cited (for confirmation)
  diminishingReturns: boolean; // true if < 5 new gaps found (suggest reducing to monthly)
  costEstimate: string;        // e.g., "50 Perplexity API calls"
}
```

---

### Component 3: `lib/intent/prompt-expander.ts` — NEW

```typescript
// lib/intent/prompt-expander.ts — Sprint 135
//
// Uses Claude API to generate realistic conversational prompts customers
// might ask AI models about businesses in the location's category.
// AI_RULES §172:
//   - Generated prompts are Claude-produced, not sourced from real user data.
//   - Document this clearly (no PII handling needed).
//   - Deduplicate similar prompts before returning.
//   - sampleSize cap: 50. Never exceed.

const MAX_SAMPLE_SIZE = 50;

export async function expandPrompts(
  location: {
    businessName: string;
    city: string;
    state: string;
    categories: string[];
    keyAmenities: string[];
    competitors: string[];  // top competitors from sov_evaluations.mentioned_competitors
  },
  sampleSize = 50,
): Promise<string[]> {
  const actualSize = Math.min(sampleSize, MAX_SAMPLE_SIZE);

  const systemPrompt = `You are generating realistic conversational search prompts that customers might type into AI models (ChatGPT, Perplexity) when looking for local businesses.

Generate exactly ${actualSize} diverse prompts. Each prompt should be something a real person would naturally type — not keyword-stuffed.

Rules:
- Include the city or "near me" in most prompts
- Vary the intent: hours questions, occasion queries (bachelorette, birthday, date night), comparison queries, specific offering queries
- Include the business category prominently  
- Vary length: some short (5 words), some conversational (15 words)
- Do NOT include the business name "${location.businessName}" — we're finding prompts they should appear in

Return ONLY a JSON array of strings. No other text.`;

  const userMessage = `Business category: ${location.categories.join(', ')}
City: ${location.city}, ${location.state}
Key features: ${location.keyAmenities.join(', ')}
Known competitors: ${location.competitors.slice(0, 3).join(', ')}

Generate ${actualSize} prompts.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await res.json() as { content: Array<{ type: string; text: string }> };
    const text = data.content.find(b => b.type === 'text')?.text ?? '[]';
    const prompts = JSON.parse(text.trim()) as string[];

    // Deduplicate: cluster by first 6 words, keep one per cluster
    return deduplicatePrompts(prompts).slice(0, actualSize);
  } catch {
    return [];
  }
}

/**
 * Deduplicate prompts that are semantically near-identical.
 * Simple heuristic: if first 6 words match, keep only the first.
 */
export function deduplicatePrompts(prompts: string[]): string[] {
  const seen = new Set<string>();
  return prompts.filter(p => {
    const key = p.toLowerCase().split(/\s+/).slice(0, 6).join(' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

---

### Component 4: `lib/intent/intent-discoverer.ts` — NEW

```typescript
// lib/intent/intent-discoverer.ts — Sprint 135
//
// Orchestrates prompt expansion → Perplexity coverage audit → gap identification.
// AI_RULES §172:
//   - Batched Perplexity calls with 2-second delay between each (rate-limit aware).
//   - Never exceed 50 prompts per run.
//   - Log run_id + gap count + cost estimate; never log prompt text (verbosity).
//   - Add diminishingReturns flag when < 5 new gaps discovered.

import * as Sentry from '@sentry/nextjs';
import { v4 as uuidv4 } from 'uuid';
import { expandPrompts, deduplicatePrompts } from './prompt-expander';
import type { IntentDiscovery, IntentGap, IntentTheme } from './intent-types';

const PERPLEXITY_DELAY_MS = 2000; // rate-limit safety

/**
 * Classify prompt into theme based on keywords.
 * Pure function — exported for testing.
 */
export function classifyPromptTheme(prompt: string): IntentTheme {
  const p = prompt.toLowerCase();
  if (/open|hours|close|late|early|weekend|sunday/.test(p)) return 'hours';
  if (/birthday|bachelorette|anniversary|date night|special occasion|celebration/.test(p)) return 'occasion';
  if (/vs|versus|better|best|compare|alternative|instead of/.test(p)) return 'comparison';
  if (/near me|in [a-z]+|alpharetta|atlanta|nearby/.test(p)) return 'location';
  if (/event|live|entertainment|show|music|performance/.test(p)) return 'events';
  if (/menu|food|drink|hookah|service|offering|have|serve/.test(p)) return 'offerings';
  return 'other';
}

/**
 * Compute opportunity score for a gap.
 * Higher score = more important to address.
 */
export function computeOpportunityScore(gap: {
  clientCited: boolean;
  competitorCount: number;
  theme: IntentTheme;
}): number {
  if (gap.clientCited) return 0;
  let score = 50; // base for any gap
  if (gap.competitorCount >= 2) score += 30;
  else if (gap.competitorCount === 1) score += 15;
  if (gap.theme === 'occasion' || gap.theme === 'comparison') score += 20;
  return Math.min(score, 100);
}

export async function discoverIntents(
  locationId: string,
  supabase: SupabaseClient,
  sampleSize = 50,
): Promise<IntentDiscovery> {
  const runId = uuidv4();

  try {
    // 1. Fetch location data for prompt expansion
    const { data: location } = await supabase
      .from('locations')
      .select('business_name, city, state, categories, amenities')
      .eq('id', locationId)
      .single();

    if (!location) return emptyDiscovery(runId);

    // 2. Get known competitors from sov_evaluations
    const { data: sovData } = await supabase
      .from('sov_evaluations')
      .select('mentioned_competitors')
      .eq('location_id', locationId)
      .not('mentioned_competitors', 'eq', '[]')
      .limit(50);

    const allCompetitors = (sovData ?? [])
      .flatMap(r => r.mentioned_competitors as string[])
      .filter(Boolean);
    const uniqueCompetitors = [...new Set(allCompetitors)].slice(0, 5);

    const amenities = Object.entries((location.amenities as Record<string, boolean | null>) ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => k.replace(/_/g, ' '));

    // 3. Expand prompts via Claude
    const prompts = await expandPrompts({
      businessName: location.business_name ?? '',
      city: location.city ?? '',
      state: location.state ?? '',
      categories: (location.categories as string[]) ?? [],
      keyAmenities: amenities,
      competitors: uniqueCompetitors,
    }, sampleSize);

    if (prompts.length === 0) return emptyDiscovery(runId);

    // 4. Run each prompt through Perplexity with rate-limit delay
    const gaps: IntentGap[] = [];
    const covered: IntentGap[] = [];

    for (const prompt of prompts) {
      await sleep(PERPLEXITY_DELAY_MS);

      try {
        const result = await runPerplexityQuery(prompt, location.business_name ?? '');
        const theme = classifyPromptTheme(prompt);
        const opportunityScore = computeOpportunityScore({
          clientCited: result.cited,
          competitorCount: result.competitors.length,
          theme,
        });

        const gap: IntentGap = {
          prompt,
          theme,
          clientCited: result.cited,
          competitorsCited: result.competitors,
          opportunityScore,
        };

        if (result.cited) covered.push(gap);
        else gaps.push(gap);
      } catch (err) {
        Sentry.captureException(err, { tags: { sprint: '135', phase: 'perplexity_query' } });
        // Skip this prompt; continue with others
      }
    }

    // 5. Check for previous run to detect diminishing returns
    const { data: prevRun } = await supabase
      .from('intent_discoveries')
      .select('id')
      .eq('location_id', locationId)
      .eq('client_cited', false)
      .order('discovered_at', { ascending: false })
      .limit(50);

    const prevGapCount = prevRun?.length ?? 0;
    const diminishingReturns = gaps.length > 0 && gaps.length < 5 && prevGapCount > 20;

    // 6. Persist gaps to DB
    if (gaps.length > 0) {
      await supabase.from('intent_discoveries').insert(
        gaps.map(g => ({
          org_id: (location as unknown as { org_id: string }).org_id,
          location_id: locationId,
          prompt: g.prompt,
          theme: g.theme,
          client_cited: g.clientCited,
          competitors_cited: g.competitorsCited,
          opportunity_score: g.opportunityScore,
          run_id: runId,
        }))
      );
    }

    return {
      runId,
      totalPromptsRun: prompts.length,
      gaps: gaps.sort((a, b) => b.opportunityScore - a.opportunityScore),
      covered,
      diminishingReturns,
      costEstimate: `${prompts.length} Perplexity API calls`,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'intent-discoverer', sprint: '135' } });
    return emptyDiscovery(runId);
  }
}

async function runPerplexityQuery(
  prompt: string,
  businessName: string,
): Promise<{ cited: boolean; competitors: string[] }> {
  // Reuse Perplexity sonar pattern from sov-engine (lib/services/sov-engine.service.ts)
  // Call with return_citations=true, parse response for businessName mention
  // Return { cited: boolean, competitors: string[] from response }
  throw new Error('Implement using existing Perplexity call pattern from sov-engine.service.ts');
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function emptyDiscovery(runId: string): IntentDiscovery {
  return { runId, totalPromptsRun: 0, gaps: [], covered: [], diminishingReturns: false, costEstimate: '0 calls' };
}
```

---

### Component 5: `app/api/cron/intent-discovery/route.ts` — NEW

```typescript
// Schedule: "0 6 * * 2" (6 AM UTC every Tuesday — different day from playbooks)
// Kill switch: INTENT_DISCOVERY_CRON_DISABLED=true
// Agency orgs only.
// Runs discoverIntents() for primary location per org.
// Returns { processed, totalGaps, diminishingReturns, errors }
//
// Cost documentation (add to MEMORY.md after sprint):
// 50 prompts × 10 Agency locations = 500 Perplexity API calls/week.
// At Perplexity sonar pricing, budget this into Agency plan cost of goods.
```

---

### Component 6: `app/dashboard/intent-discovery/page.tsx` — NEW

```typescript
// New page at /dashboard/intent-discovery
// Reads intent_discoveries WHERE client_cited=false ordered by opportunity_score DESC.
//
// Layout:
//   Header: "Discover What Customers Are Searching For"
//   Subtitle: "AI-generated queries your business isn't appearing in yet"
//
//   Filter bar: [All Themes ▼]  [All Engines ▼]  [Score: High first ▼]
//
//   Diminishing returns notice (if true):
//     "Most gaps identified — consider switching to monthly discovery runs"
//
//   Gap cards (one per intent_discovery row):
//     - Theme badge (🎉 Occasion / 🕐 Hours / 🍽️ Offerings / etc.)
//     - Prompt text
//     - Competitor badges showing who was cited instead
//     - Opportunity score bar
//     - [Generate Brief →] button → calls createBriefFromGap(gapId)
//                                    sets brief_created=true, links content_draft_id
//     - [Dismiss] button (soft delete — sets opportunity_score=0)
//
//   Privacy note at bottom:
//     "These prompts are AI-generated hypotheticals, not real customer searches."
//
// Plan gate: Agency only.
// data-testid: "intent-discovery-page", "gap-card-[id]", "generate-brief-btn-[id]", "theme-filter"
```

---

### Component 7: `src/__tests__/unit/intent-discovery.test.ts` — NEW (target: 26 tests)

```typescript
describe('classifyPromptTheme', () => {
  it('classifies "open late on weekends" as hours')
  it('classifies "bachelorette party hookah" as occasion')
  it('classifies "vs downtown bar" as comparison')
  it('classifies "near me in Alpharetta" as location')
  it('classifies "live music events" as events')
  it('classifies "hookah menu options" as offerings')
  it('returns "other" for unclassified prompts')
})

describe('computeOpportunityScore', () => {
  it('returns 0 when clientCited=true')
  it('returns 50 base when not cited, 0 competitors')
  it('returns 80 when 2+ competitors cited (50 + 30)')
  it('returns 65 when 1 competitor cited (50 + 15)')
  it('adds 20 for occasion theme')
  it('adds 20 for comparison theme')
  it('caps at 100 for maximum signals')
})

describe('deduplicatePrompts', () => {
  it('removes near-duplicate prompts (same first 6 words)')
  it('keeps distinct prompts that differ early')
  it('is case-insensitive for deduplication key')
  it('returns empty array for empty input')
})

describe('expandPrompts', () => {
  it('never exceeds MAX_SAMPLE_SIZE=50')
  it('calls deduplicatePrompts on result')
  it('returns empty array on Claude API error')
})

describe('discoverIntents', () => {
  it('returns empty discovery when location not found')
  it('inserts only non-cited gaps into intent_discoveries')
  it('sets diminishingReturns=true when < 5 new gaps and prev run had > 20')
  it('orders gaps by opportunityScore descending')
  it('sets costEstimate to prompt count + " Perplexity API calls"')
  it('sleeps PERPLEXITY_DELAY_MS between each Perplexity call')
  it('continues when single Perplexity call fails (Sentry logged)')
})

describe('intent-discovery cron', () => {
  it('returns 401 without CRON_SECRET')
  it('returns skipped when kill switch active')
  it('runs only for Agency orgs')
  it('returns totalGaps count in response')
  it('logs diminishingReturns warning in response')
})
```

---

## 🚫 What NOT to Do

1. **DO NOT exceed 50 prompts per run** — `MAX_SAMPLE_SIZE = 50` is absolute. API cost protection.
2. **DO NOT log prompt text** — log run_id, gap count, cost estimate only.
3. **DO NOT run for non-Agency plans** — 500 API calls/week is not viable at lower price tiers.
4. **DO NOT present generated prompts as "real customer searches"** — always show the privacy note.
5. **DO NOT skip the PERPLEXITY_DELAY_MS sleep** — removing it causes rate-limit cascades.
6. **DO NOT re-run discovery for a location more than once per week** — check last run_id date before executing.

---

## ✅ Definition of Done

- [ ] Migration: `intent_discoveries` table with RLS + indexes
- [ ] `lib/intent/intent-types.ts` — all types defined
- [ ] `lib/intent/prompt-expander.ts` — `expandPrompts()` + `deduplicatePrompts()` (exported pure fn)
- [ ] `lib/intent/intent-discoverer.ts` — `classifyPromptTheme()` (exported), `computeOpportunityScore()` (exported), `discoverIntents()`
- [ ] Weekly cron `intent-discovery` (Tuesday) + `vercel.json` updated
- [ ] `app/dashboard/intent-discovery/page.tsx` — gap cards + filters + privacy note
- [ ] `createBriefFromGap()` server action (wires to Sprint 86 content brief generator)
- [ ] MEMORY.md updated with API cost documentation
- [ ] 26 tests passing
- [ ] `npx vitest run` — ALL tests passing, 0 regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 🔮 AI_RULES Addition

```markdown
## §172. Conversational Intent Discovery (Sprint 135)

Prompt expansion in `lib/intent/prompt-expander.ts`, discovery in `lib/intent/intent-discoverer.ts`.

* **MAX_SAMPLE_SIZE = 50 prompts per run.** Never exceed — direct API cost protection.
* **PERPLEXITY_DELAY_MS sleep between each call.** Never remove — prevents rate-limit cascades.
* **Never log prompt text** — log run_id, gap count, cost estimate only.
* **Generated prompts are AI hypotheticals, not real user data.** Always show privacy notice in UI.
* **Diminishing returns flag:** when < 5 new gaps found and prior run > 20 gaps → suggest monthly cadence.
* **Agency-only.** Weekly Tuesday cron.
* **MEMORY.md must document API cost:** 50 prompts × N locations = N×50 Perplexity calls/week.
* **Tests:** 26 Vitest.
```

---

## Wave 4 Execution Summary

| Sprint | Start Gate | Est. Time | Key Dependency |
|--------|-----------|-----------|----------------|
| **133** RAG Chatbot | Menu ≥ 80% complete | 8–10 hrs | Verify per-location before start |
| **134** Engine Playbooks | ~April 27, 2026 | 5–6 hrs | 8 weeks sov_model_results |
| **135** Intent Discovery | ~April 27, 2026 | 5–7 hrs | 8 weeks Perplexity history + budget approval |

**Run 134 before 135** — playbooks use the same sov_model_results aggregation patterns; building 134 first establishes the data access idioms that 135 reuses.
