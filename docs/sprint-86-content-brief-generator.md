# Sprint 86 — SOV Gap → Content Brief Generator

> **Claude Code Prompt — First-Pass Ready**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Build the **SOV Gap → Content Brief Generator** — when a user has 0% SOV for a query, generate a full AEO-optimized content brief: suggested URL, title tag, H1, page outline with Answer Capsule, FAQ section, JSON-LD schema recommendation, and `llms.txt` entry. Then save the brief as a `content_drafts` row for the user to approve and publish.

**The flywheel in action:**
```
1. DETECT:    "0% SOV for 'birthday party venue Alpharetta'"
2. DIAGNOSE:  "First Mover opportunity — no competitor dominates"
3. PRESCRIBE: "Create a dedicated page targeting this query"
4. GENERATE:  Full content brief with AEO-optimized outline ← THIS SPRINT
5. PROVE:     Track SOV: "Before: 0% → After: mentioned in 2/4 engines"
```

**The user sees:**
```
📝 Content Brief: "birthday party venue Alpharetta"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Gap: Not mentioned by any AI engine (0/3)
Opportunity: First Mover — no competitor dominates

Suggested URL:  /birthday-party-venue-alpharetta
Title Tag:      Birthday Party Venue in Alpharetta | Charcoal N Chill
H1:             Private Birthday Party Venue in Alpharetta

Page Outline:
  1. Answer Capsule (40-60 words)
     "Charcoal N Chill offers private birthday party
     packages in Alpharetta featuring hookah, Indo-American
     fusion cuisine, and Versace lounge seating..."

  2. Package Details
     - What's included
     - Pricing tiers
     - Capacity

  3. Why Choose Us
     - Unique atmosphere points
     - Menu highlights

  4. FAQ Section (3-5 questions)
     - "How many guests can you accommodate?"
     - "Do you offer birthday hookah specials?"
     - "Can I bring my own cake?"

  5. Booking CTA

Schema: FAQPage + Event JSON-LD recommended
llms.txt: Entry suggested for AI crawler discovery

[Save as Draft →]  [Generate Full Content →]
```

**Architecture:** Server action triggered by user click (§5). Uses `generateObject` with `gpt-4o-mini` to produce structured content brief from SOV gap data + business ground truth. Saves to `content_drafts` with `trigger_type='prompt_missing'`. Pure brief builder for the deterministic parts (URL slug, schema recommendations), AI for the creative parts (outline, answer capsule, FAQ questions).

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                          — All rules (§4, §5, §19.3, §20, §36.1, §39)
Read CLAUDE.md                                 — Project context + architecture
Read supabase/prod_schema.sql                  — content_drafts, target_queries, sov_evaluations, locations
Read lib/supabase/database.types.ts            — Full Database type (§38)
Read src/__fixtures__/golden-tenant.ts          — Golden Tenant fixtures (§4)
Read lib/ai/providers.ts                       — Model keys (§19.3)
Read lib/ai/schemas.ts                         — Zod schema + zodSchema() wrapper
Read app/dashboard/content-drafts/             — Content Drafts page + actions
Read app/dashboard/share-of-voice/             — SOV page (where gap briefs are triggered FROM)
```

---

## 🏗️ Architecture — What to Build

### Two-Layer Design

**Layer 1: Pure Brief Builder** — deterministic. No AI. Generates URL slug, title tag, schema recommendations, and `llms.txt` entry from ground truth data.

**Layer 2: AI Content Generator** — uses `gpt-4o-mini` via `generateObject` to produce the creative content: answer capsule, page outline sections, FAQ questions. Constrained by Zod schema to produce structured output.

```
User clicks "Generate Content Brief" on SOV gap query
  │
  ▼
Server Action: generateContentBrief()
  │
  ├─► Layer 1: buildBriefStructure()           [PURE — no AI]
  │     ├── slugify(queryText)                  → suggested URL
  │     ├── buildTitleTag(query, businessName)  → title tag
  │     ├── buildH1(query, businessName)        → H1
  │     ├── recommendedSchemas(queryCategory)   → schema types
  │     └── buildLlmsTxtEntry(query, business)  → llms.txt snippet
  │
  ├─► Layer 2: generateBriefContent()           [AI — gpt-4o-mini]
  │     ├── system prompt with business context
  │     ├── generateObject({ schema: ContentBriefSchema })
  │     └── returns: answerCapsule, outlineSections, faqQuestions
  │
  ├─► Assemble full brief
  │
  └─► Save to content_drafts
        trigger_type = 'prompt_missing'
        trigger_id = target_query.id
        content_type = inferred from query_category
        status = 'draft'
```

---

### Component 1: Content Brief Zod Schema — `lib/ai/schemas.ts`

Add to the existing schemas file:

```typescript
import { z } from 'zod';

/**
 * Sprint 86 — Structured output for SOV Gap Content Brief.
 * Used with generateObject + gpt-4o-mini.
 */
export const ContentBriefSchema = z.object({
  answerCapsule: z.string().describe(
    'A 40-60 word direct answer to the target query, written in third person about the business. Must include the business name, location, and key differentiators. This becomes the first paragraph of the page — designed for AI engines to extract as a citation.'
  ),
  outlineSections: z.array(z.object({
    heading: z.string().describe('Section H2 heading'),
    bullets: z.array(z.string()).describe('3-5 content points to cover in this section'),
  })).min(3).max(6).describe(
    'Page content sections after the answer capsule. Should include: details/features, why choose this business, and a booking/action section.'
  ),
  faqQuestions: z.array(z.object({
    question: z.string().describe('A question a potential customer would ask about this topic'),
    answerHint: z.string().describe('1-2 sentence answer hint using the business ground truth data provided'),
  })).min(3).max(5).describe(
    'FAQ questions real customers would ask. Answers should use ONLY the business facts provided — never fabricate details.'
  ),
  metaDescription: z.string().max(160).describe(
    'SEO meta description under 160 characters including target query and business name'
  ),
});

export type ContentBrief = z.infer<typeof ContentBriefSchema>;
```

---

### Component 2: Pure Brief Builder — `lib/services/content-brief-builder.service.ts`

All pure functions. No AI, no I/O.

```typescript
// ── Types ─────────────────────────────────────────────

export interface BriefStructureInput {
  queryText: string;
  queryCategory: string;
  businessName: string;
  city: string;
  state: string;
}

export interface BriefStructure {
  suggestedSlug: string;
  suggestedUrl: string;
  titleTag: string;
  h1: string;
  recommendedSchemas: string[];
  llmsTxtEntry: string;
  contentType: string;
}

// ── Pure functions ────────────────────────────────────

/**
 * Build the deterministic parts of a content brief.
 * Pure function — no AI, no I/O.
 */
export function buildBriefStructure(input: BriefStructureInput): BriefStructure {
  const slug = slugify(input.queryText);
  const contentType = inferContentType(input.queryCategory);

  return {
    suggestedSlug: slug,
    suggestedUrl: `/${slug}`,
    titleTag: buildTitleTag(input.queryText, input.businessName),
    h1: buildH1(input.queryText, input.businessName),
    recommendedSchemas: recommendSchemas(input.queryCategory),
    llmsTxtEntry: buildLlmsTxtEntry(input.queryText, input.businessName, input.city, input.state),
    contentType,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function buildTitleTag(query: string, businessName: string): string {
  // Capitalize each word in query
  const capitalizedQuery = query
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return `${capitalizedQuery} | ${businessName}`;
}

function buildH1(query: string, businessName: string): string {
  const capitalizedQuery = query
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  // Prepend business-relevant qualifier
  return `${capitalizedQuery} at ${businessName}`;
}

function inferContentType(queryCategory: string): string {
  const map: Record<string, string> = {
    occasion: 'occasion_page',
    discovery: 'landing_page',
    comparison: 'blog_post',
    near_me: 'landing_page',
    custom: 'blog_post',
  };
  return map[queryCategory] ?? 'blog_post';
}

function recommendSchemas(queryCategory: string): string[] {
  const schemas = ['FAQPage']; // Always recommend FAQ schema

  if (queryCategory === 'occasion') {
    schemas.push('Event');
  }
  if (queryCategory === 'discovery' || queryCategory === 'near_me') {
    schemas.push('LocalBusiness');
  }

  return schemas;
}

function buildLlmsTxtEntry(
  query: string,
  businessName: string,
  city: string,
  state: string,
): string {
  return [
    `## ${query}`,
    `${businessName} in ${city}, ${state} is relevant for "${query}".`,
    `See the dedicated page for full details.`,
  ].join('\n');
}
```

---

### Component 3: AI Content Generator — `lib/services/content-brief-generator.service.ts`

Uses `generateObject` with `gpt-4o-mini` to produce structured content.

```typescript
import { generateObject } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import { ContentBriefSchema, zodSchema } from '@/lib/ai/schemas';
import type { ContentBrief } from '@/lib/ai/schemas';

export interface ContentBriefGeneratorInput {
  queryText: string;
  queryCategory: string;
  businessName: string;
  city: string;
  state: string;
  /** Business context for grounding */
  businessContext: {
    cuisineType: string | null;
    amenities: string[];
    categories: string[];
    hoursDescription: string | null;
    phone: string | null;
    websiteUrl: string | null;
  };
  /** How many engines are missing this business */
  missingEngineCount: number;
  totalEngineCount: number;
  /** Competitor names that DO appear for this query */
  competitorsMentioned: string[];
}

/**
 * Generate the AI-powered creative content for a content brief.
 * Uses gpt-4o-mini via generateObject (§19.3).
 * Returns null if no API key available (fallback to structure-only brief).
 */
export async function generateBriefContent(
  input: ContentBriefGeneratorInput,
): Promise<ContentBrief | null> {
  if (!hasApiKey('openai')) return null;

  const competitorContext = input.competitorsMentioned.length > 0
    ? `Competitors currently mentioned: ${input.competitorsMentioned.join(', ')}. The content should position ${input.businessName} as a strong alternative.`
    : `No competitor dominates this query — this is a First Mover opportunity.`;

  const systemPrompt = `You are an AEO (Answer Engine Optimization) content strategist for local restaurants.
Your job is to create a content brief that will make a restaurant appear in AI engine responses for a specific query.

KEY AEO PRINCIPLES:
- Answer Capsule: The first 40-60 words MUST directly answer the query. AI engines extract this as a citation.
- Entity clarity: Use the business name, exact location, and category early and naturally.
- FAQ format: AI engines heavily weight FAQ content for citation.
- Ground truth only: Use ONLY the business facts provided. Never fabricate details, prices, menu items, or hours.

BUSINESS FACTS (use these, do not invent others):
- Name: ${input.businessName}
- Location: ${input.city}, ${input.state}
- Cuisine/Type: ${input.businessContext.cuisineType ?? 'not specified'}
- Categories: ${input.businessContext.categories.join(', ') || 'not specified'}
- Amenities: ${input.businessContext.amenities.join(', ') || 'not specified'}
- Hours: ${input.businessContext.hoursDescription ?? 'not specified'}
- Phone: ${input.businessContext.phone ?? 'not specified'}
- Website: ${input.businessContext.websiteUrl ?? 'not specified'}

COMPETITIVE CONTEXT:
${competitorContext}
${input.missingEngineCount} of ${input.totalEngineCount} AI engines do not mention this business for "${input.queryText}".`;

  const { object } = await generateObject({
    model: getModel('content-brief'),
    schema: zodSchema(ContentBriefSchema),
    system: systemPrompt,
    prompt: `Generate a content brief for the query: "${input.queryText}"

The brief should help ${input.businessName} appear in AI engine responses for this query.
Category: ${input.queryCategory}`,
  });

  return object;
}
```

**New model key needed in `lib/ai/providers.ts`:**

```typescript
// Add to model registry
'content-brief': openai('gpt-4o-mini'),  // Low cost, structured output
```

---

### Component 4: Server Action — `app/dashboard/share-of-voice/brief-actions.ts`

Server action triggered by "Generate Content Brief" button on the SOV page.

```typescript
'use server';

import { getSafeAuthContext } from '@/lib/auth-context';
import { createClient } from '@/lib/supabase/server';
import { buildBriefStructure } from '@/lib/services/content-brief-builder.service';
import { generateBriefContent } from '@/lib/services/content-brief-generator.service';
import type { Json } from '@/lib/supabase/database.types';
import { revalidatePath } from 'next/cache';

export interface GenerateBriefResult {
  success: boolean;
  draftId?: string;
  error?: string;
}

/**
 * Generate a content brief for an SOV gap query.
 * User-initiated (§5) — triggered by button click.
 */
export async function generateContentBrief(
  queryId: string,
): Promise<GenerateBriefResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  // Fetch query + latest SOV data
  const [queryResult, locationResult] = await Promise.all([
    supabase
      .from('target_queries')
      .select('id, query_text, query_category, location_id')
      .eq('id', queryId)
      .eq('org_id', ctx.orgId)
      .single(),
    supabase
      .from('locations')
      .select('business_name, city, state, phone, website_url, categories, amenities, hours_data')
      .eq('org_id', ctx.orgId)
      .eq('is_primary', true)
      .single(),
  ]);

  if (queryResult.error || !queryResult.data) {
    return { success: false, error: 'Query not found' };
  }
  if (locationResult.error || !locationResult.data) {
    return { success: false, error: 'Location not found' };
  }

  const query = queryResult.data;
  const location = locationResult.data;

  // Check for existing draft with this trigger
  const { data: existingDraft } = await supabase
    .from('content_drafts')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('trigger_type', 'prompt_missing')
    .eq('trigger_id', queryId)
    .in('status', ['draft', 'approved'])
    .maybeSingle();

  if (existingDraft) {
    return { success: false, error: 'A draft already exists for this query' };
  }

  // Fetch SOV gap data for this query
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: sovEvals } = await supabase
    .from('sov_evaluations')
    .select('engine, rank_position, mentioned_competitors')
    .eq('query_id', queryId)
    .eq('org_id', ctx.orgId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  const evals = sovEvals ?? [];
  const totalEngines = new Set(evals.map(e => e.engine)).size;
  const missingEngines = evals.filter(e => e.rank_position === null).length;

  // Collect competitor names mentioned across evaluations
  const competitorsMentioned = new Set<string>();
  for (const e of evals) {
    const competitors = (e.mentioned_competitors as Array<{ name?: string }>) ?? [];
    for (const c of competitors) {
      if (c.name) competitorsMentioned.add(c.name);
    }
  }

  // Layer 1: Pure brief structure
  const structure = buildBriefStructure({
    queryText: query.query_text,
    queryCategory: query.query_category,
    businessName: location.business_name,
    city: location.city ?? '',
    state: location.state ?? '',
  });

  // Layer 2: AI content generation
  const categories = (location.categories as string[]) ?? [];
  const amenities = (location.amenities as Record<string, boolean | undefined>) ?? {};
  const amenityList = Object.entries(amenities)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  const briefContent = await generateBriefContent({
    queryText: query.query_text,
    queryCategory: query.query_category,
    businessName: location.business_name,
    city: location.city ?? '',
    state: location.state ?? '',
    businessContext: {
      cuisineType: categories[0] ?? null,
      amenities: amenityList,
      categories,
      hoursDescription: location.hours_data ? 'See location settings for details' : null,
      phone: location.phone,
      websiteUrl: location.website_url,
    },
    missingEngineCount: missingEngines,
    totalEngineCount: totalEngines,
    competitorsMentioned: [...competitorsMentioned],
  });

  // Assemble draft content
  const draftContent = assembleDraftContent(structure, briefContent);

  // Save to content_drafts
  const { data: draft, error: insertError } = await supabase
    .from('content_drafts')
    .insert({
      org_id: ctx.orgId,
      location_id: query.location_id,
      trigger_type: 'prompt_missing',
      trigger_id: queryId,
      draft_title: structure.titleTag,
      draft_content: draftContent,
      target_prompt: query.query_text,
      content_type: structure.contentType,
      status: 'draft',
    })
    .select('id')
    .single();

  if (insertError || !draft) {
    return { success: false, error: 'Failed to save draft' };
  }

  revalidatePath('/dashboard/content-drafts');
  revalidatePath('/dashboard/share-of-voice');

  return { success: true, draftId: draft.id };
}

/**
 * Assemble the draft content from structure + AI-generated content.
 * If AI content is null (no API key), produces structure-only brief.
 */
function assembleDraftContent(
  structure: ReturnType<typeof buildBriefStructure>,
  aiContent: Awaited<ReturnType<typeof generateBriefContent>>,
): string {
  const sections: string[] = [];

  // Header
  sections.push(`# ${structure.h1}`);
  sections.push('');

  // URL and meta
  sections.push(`**Suggested URL:** ${structure.suggestedUrl}`);
  sections.push(`**Title Tag:** ${structure.titleTag}`);
  sections.push('');

  // Answer Capsule
  if (aiContent?.answerCapsule) {
    sections.push('## Answer Capsule');
    sections.push(aiContent.answerCapsule);
    sections.push('');
  } else {
    sections.push('## Answer Capsule');
    sections.push('_[Write a 40-60 word direct answer to the query here. Include your business name, location, and key differentiator.]_');
    sections.push('');
  }

  // Meta description
  if (aiContent?.metaDescription) {
    sections.push(`**Meta Description:** ${aiContent.metaDescription}`);
    sections.push('');
  }

  // Outline sections
  if (aiContent?.outlineSections) {
    for (const section of aiContent.outlineSections) {
      sections.push(`## ${section.heading}`);
      for (const bullet of section.bullets) {
        sections.push(`- ${bullet}`);
      }
      sections.push('');
    }
  } else {
    sections.push('## Details & Features');
    sections.push('_[Add content about your offerings for this query]_');
    sections.push('');
    sections.push('## Why Choose Us');
    sections.push('_[Highlight unique differentiators]_');
    sections.push('');
  }

  // FAQ section
  sections.push('## Frequently Asked Questions');
  if (aiContent?.faqQuestions) {
    for (const faq of aiContent.faqQuestions) {
      sections.push(`### ${faq.question}`);
      sections.push(faq.answerHint);
      sections.push('');
    }
  } else {
    sections.push('_[Add 3-5 FAQ questions customers would ask about this topic]_');
    sections.push('');
  }

  // Schema recommendations
  sections.push('---');
  sections.push(`**Recommended Schema:** ${structure.recommendedSchemas.join(', ')}`);
  sections.push('');
  sections.push('**llms.txt Entry:**');
  sections.push('```');
  sections.push(structure.llmsTxtEntry);
  sections.push('```');

  return sections.join('\n');
}
```

---

### Component 5: SOV Gap Brief Button — Modify SOV Page

Add a "Generate Content Brief" button to SOV gap queries on the Share of Voice page.

**Location:** Wherever SOV queries are displayed with null rank (gap queries). Add a button/CTA:

```typescript
// Client component for the brief generation button
'use client';

import { useState } from 'react';
import { generateContentBrief } from './brief-actions';
import { useRouter } from 'next/navigation';

interface GenerateBriefButtonProps {
  queryId: string;
  queryText: string;
  /** Whether a draft already exists for this query */
  hasDraft: boolean;
}

export function GenerateBriefButton({ queryId, queryText, hasDraft }: GenerateBriefButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (hasDraft) {
    return (
      <a
        href="/dashboard/content-drafts"
        className="text-sm text-blue-600 hover:underline"
      >
        View Draft →
      </a>
    );
  }

  async function handleClick() {
    setLoading(true);
    try {
      const result = await generateContentBrief(queryId);
      if (result.success && result.draftId) {
        router.push('/dashboard/content-drafts');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
      data-testid={`generate-brief-${queryId}`}
    >
      {loading ? 'Generating…' : 'Generate Brief →'}
    </button>
  );
}
```

---

### Component 6: Content Calendar Integration

Sprint 83's Content Calendar already generates SOV gap recommendations with CTAs linking to `/dashboard/content-drafts?trigger_type=prompt_missing&query=...`. This sprint provides the actual generation backend those CTAs invoke. No changes needed to the Calendar — it already links correctly.

---

### Component 7: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

```typescript
import type { ContentBrief } from '@/lib/ai/schemas';
import type { BriefStructureInput } from '@/lib/services/content-brief-builder.service';

/**
 * Sprint 86 — Canonical BriefStructureInput for "private event venue Alpharetta".
 */
export const MOCK_BRIEF_STRUCTURE_INPUT: BriefStructureInput = {
  queryText: 'private event venue Alpharetta',
  queryCategory: 'discovery',
  businessName: 'Charcoal N Chill',
  city: 'Alpharetta',
  state: 'GA',
};

/**
 * Sprint 86 — Mock AI-generated ContentBrief for testing.
 */
export const MOCK_CONTENT_BRIEF: ContentBrief = {
  answerCapsule: 'Charcoal N Chill in Alpharetta, GA offers private event hosting with premium hookah service, Indo-American fusion dining, and Versace lounge seating for groups of up to 80 guests in an upscale atmosphere.',
  outlineSections: [
    {
      heading: 'Private Event Packages',
      bullets: [
        'Full venue rental for exclusive events',
        'Customizable hookah and dining packages',
        'Capacity for groups from 20 to 80 guests',
        'AV equipment and music coordination available',
      ],
    },
    {
      heading: 'Why Choose Charcoal N Chill',
      bullets: [
        'Unique Indo-American fusion menu not available elsewhere in Alpharetta',
        'Premium Versace lounge seating creates memorable photo opportunities',
        'Experienced event coordination team',
      ],
    },
    {
      heading: 'Book Your Event',
      bullets: [
        'Contact us to discuss your event needs',
        'Flexible scheduling for weekday and weekend events',
        'Custom menu planning available',
      ],
    },
  ],
  faqQuestions: [
    {
      question: 'How many guests can Charcoal N Chill accommodate for private events?',
      answerHint: 'Charcoal N Chill can host private events for groups of 20 to 80 guests in Alpharetta, GA.',
    },
    {
      question: 'Does Charcoal N Chill offer hookah for private events?',
      answerHint: 'Yes, Charcoal N Chill offers premium hookah service as part of private event packages.',
    },
    {
      question: 'What type of food is available for private events?',
      answerHint: 'Charcoal N Chill serves Indo-American fusion cuisine for private events.',
    },
  ],
  metaDescription: 'Book a private event at Charcoal N Chill in Alpharetta, GA. Premium hookah, Indo-American fusion dining, and Versace lounge seating for 20-80 guests.',
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/content-brief-builder.test.ts`

**Target: `lib/services/content-brief-builder.service.ts`**

```
describe('buildBriefStructure')
  1.  generates slug from query text
  2.  lowercases and hyphenates slug
  3.  removes special characters from slug
  4.  truncates slug to 80 characters
  5.  builds suggested URL with leading slash
  6.  builds title tag with capitalized query + business name
  7.  builds H1 with "at" business name pattern
  8.  recommends FAQPage schema for all categories
  9.  recommends Event schema for occasion queries
  10. recommends LocalBusiness for discovery queries
  11. recommends LocalBusiness for near_me queries
  12. infers landing_page content type for discovery
  13. infers occasion_page content type for occasion
  14. infers blog_post content type for comparison
  15. infers blog_post content type for unknown category
  16. builds llms.txt entry with query, business name, city, state
  17. produces valid structure from MOCK_BRIEF_STRUCTURE_INPUT
```

**17 tests total. Pure functions — no mocks.**

### Test File 2: `src/__tests__/unit/content-brief-generator.test.ts`

**Target: `lib/services/content-brief-generator.service.ts`**

```
describe('generateBriefContent')
  1.  returns null when no API key
  2.  calls generateObject with content-brief model
  3.  passes business context in system prompt
  4.  passes query text in user prompt
  5.  includes competitor context when competitors exist
  6.  includes First Mover message when no competitors
  7.  returns ContentBrief object on success
  8.  includes business name in system prompt
  9.  includes city and state in system prompt
```

**9 tests total. Mock AI SDK (§4).**

### Test File 3: `src/__tests__/unit/brief-actions.test.ts`

**Target: `app/dashboard/share-of-voice/brief-actions.ts`**

```
describe('generateContentBrief')
  1.  returns Unauthorized when no auth context
  2.  fetches query and location in parallel
  3.  returns error when query not found
  4.  returns error when location not found
  5.  checks for existing draft before generating
  6.  returns error when draft already exists
  7.  fetches SOV evaluations for gap data
  8.  calls buildBriefStructure with correct input
  9.  calls generateBriefContent with business context
  10. inserts content_draft with trigger_type prompt_missing
  11. sets trigger_id to query ID
  12. sets content_type from brief structure
  13. returns draftId on success
  14. revalidates content-drafts and share-of-voice paths
  15. handles generateBriefContent returning null (no API key)
  16. still saves draft with structure-only content when AI unavailable
```

**16 tests total. Mock Supabase + AI SDK.**

### Test File 4: `src/__tests__/unit/content-brief-assembly.test.ts`

**Target: `assembleDraftContent` (exported for testing or tested via action)**

```
describe('assembleDraftContent')
  1.  includes H1 from structure
  2.  includes suggested URL
  3.  includes title tag
  4.  includes answer capsule when AI content provided
  5.  includes placeholder when AI content is null
  6.  includes meta description from AI content
  7.  includes outline sections with headings and bullets
  8.  includes FAQ questions and answer hints
  9.  includes schema recommendations
  10. includes llms.txt entry in code block
  11. produces valid markdown output
```

**11 tests total. Pure function.**

### Test File 5: `src/__tests__/unit/generate-brief-button.test.ts`

**Target: `GenerateBriefButton` component**

```
describe('GenerateBriefButton')
  1.  renders "Generate Brief →" button when no draft
  2.  renders "View Draft →" link when draft exists
  3.  shows loading state when clicked
  4.  has correct test-id
```

**4 tests total.**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/ai/schemas.ts` | **MODIFY** | Add `ContentBriefSchema` Zod schema |
| 2 | `lib/ai/providers.ts` | **MODIFY** | Add `content-brief` model key (gpt-4o-mini) |
| 3 | `lib/services/content-brief-builder.service.ts` | **CREATE** | Pure brief structure — slug, title, H1, schemas, llms.txt (~120 lines) |
| 4 | `lib/services/content-brief-generator.service.ts` | **CREATE** | AI content generation — answer capsule, outline, FAQ (~100 lines) |
| 5 | `app/dashboard/share-of-voice/brief-actions.ts` | **CREATE** | Server action — orchestrates generation + saves draft |
| 6 | `app/dashboard/share-of-voice/_components/GenerateBriefButton.tsx` | **CREATE** | Client button component |
| 7 | `app/dashboard/share-of-voice/` | **MODIFY** | Add GenerateBriefButton to SOV gap queries |
| 8 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add MOCK_BRIEF_STRUCTURE_INPUT + MOCK_CONTENT_BRIEF |
| 9 | `src/__tests__/unit/content-brief-builder.test.ts` | **CREATE** | 17 tests — pure builder |
| 10 | `src/__tests__/unit/content-brief-generator.test.ts` | **CREATE** | 9 tests — AI generation |
| 11 | `src/__tests__/unit/brief-actions.test.ts` | **CREATE** | 16 tests — server action |
| 12 | `src/__tests__/unit/content-brief-assembly.test.ts` | **CREATE** | 11 tests — markdown assembly |
| 13 | `src/__tests__/unit/generate-brief-button.test.ts` | **CREATE** | 4 tests — component |

**Expected test count: 57 new tests across 5 files.**

---

## 🚫 What NOT to Do

1. **DO NOT trigger AI calls on page load** (§5). Content brief generation is user-initiated via button click.
2. **DO NOT fabricate business details in the AI prompt.** The system prompt provides only ground truth from the location record. The AI is instructed to use ONLY these facts.
3. **DO NOT use `generateText` for the AI call.** Use `generateObject` with the `ContentBriefSchema` — structured output ensures consistent, parseable briefs.
4. **DO NOT bypass the existing `content_drafts` table.** Briefs are saved as drafts with `trigger_type='prompt_missing'` and `trigger_id=target_query.id`. The existing Content Drafts page handles review, approval, and publishing.
5. **DO NOT add a new model key for a high-cost model.** Use `gpt-4o-mini` — content briefs don't need frontier reasoning, just structured content generation. ~500 tokens per brief ≈ $0.0001/brief.
6. **DO NOT forget the fallback.** If no OpenAI API key is available (`hasApiKey('openai')` returns false), the brief still generates with structure-only content (placeholders instead of AI text). The draft is still saved.
7. **DO NOT modify `content_drafts` table schema.** The existing columns (trigger_type, trigger_id, draft_title, draft_content, target_prompt, content_type, status) are sufficient.
8. **DO NOT add plan gating.** Content brief generation is available to all tiers that have SOV data. The AI generation layer gracefully degrades without an API key.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `ContentBriefSchema` added to `lib/ai/schemas.ts`
- [ ] `content-brief` model key added to `lib/ai/providers.ts` (gpt-4o-mini)
- [ ] `buildBriefStructure()` pure function — slug, title, H1, schemas, llms.txt
- [ ] `generateBriefContent()` using `generateObject` with business context grounding
- [ ] `generateContentBrief()` server action — orchestrates, checks duplicates, saves draft
- [ ] `assembleDraftContent()` produces markdown with AI content or structure-only fallback
- [ ] `GenerateBriefButton` on SOV page for gap queries
- [ ] Duplicate prevention (checks existing drafts by trigger_type + trigger_id)
- [ ] Fallback when no API key (structure-only brief, still saved)
- [ ] Golden Tenant: MOCK_BRIEF_STRUCTURE_INPUT + MOCK_CONTENT_BRIEF
- [ ] 57 tests passing across 5 files
- [ ] `npx vitest run` — ALL tests passing, no regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-28 — Sprint 86: SOV Gap → Content Brief Generator (Completed)

**Goal:** Build a Content Brief Generator that turns SOV gap queries (0% visibility) into AEO-optimized content briefs. Two-layer design: pure brief structure (URL, title, H1, schema recommendations, llms.txt) + AI-powered content (answer capsule, outline sections, FAQ questions via gpt-4o-mini generateObject). Saves to content_drafts with trigger_type='prompt_missing'. Closes the growth loop: DETECT gap → GENERATE fix.

**Scope:**
- `lib/ai/schemas.ts` — **MODIFIED.** Added `ContentBriefSchema` (Zod): answerCapsule (string 40-60 words), outlineSections (3-6 with heading + bullets), faqQuestions (3-5 with question + answerHint), metaDescription (≤160 chars).
- `lib/ai/providers.ts` — **MODIFIED.** Added `content-brief` model key → gpt-4o-mini.
- `lib/services/content-brief-builder.service.ts` — **NEW.** ~120 lines, all pure. `buildBriefStructure()`: `slugify()` (lowercase, hyphenate, 80-char max), `buildTitleTag()` (capitalized query + business name), `buildH1()` (query + "at" + business), `inferContentType()` (category → content_type mapping), `recommendSchemas()` (always FAQPage, + Event for occasion, + LocalBusiness for discovery/near_me), `buildLlmsTxtEntry()`.
- `lib/services/content-brief-generator.service.ts` — **NEW.** ~100 lines. `generateBriefContent()` — `generateObject` with `gpt-4o-mini`, `ContentBriefSchema`. System prompt includes business ground truth (name, city, state, cuisine, amenities, categories, hours, phone, website) + competitive context. Returns null when no API key.
- `app/dashboard/share-of-voice/brief-actions.ts` — **NEW.** `generateContentBrief(queryId)` server action. Parallel fetch (target_query + location), duplicate check (existing draft with same trigger), SOV eval fetch for gap/competitor data, calls builder + generator, `assembleDraftContent()` produces markdown, inserts to `content_drafts`. Graceful fallback: structure-only brief when AI unavailable.
- `app/dashboard/share-of-voice/_components/GenerateBriefButton.tsx` — **NEW.** Client component. Shows "Generate Brief →" or "View Draft →" based on `hasDraft`. Loading state during generation. Navigates to content-drafts on success.
- SOV page — **MODIFIED.** Added GenerateBriefButton to gap query rows.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_BRIEF_STRUCTURE_INPUT` + `MOCK_CONTENT_BRIEF`.

**Tests added:**
- `src/__tests__/unit/content-brief-builder.test.ts` — **N tests.** Slug, title, H1, schemas, content type, llms.txt, MOCK integration.
- `src/__tests__/unit/content-brief-generator.test.ts` — **N tests.** API key check, model call, system prompt contents.
- `src/__tests__/unit/brief-actions.test.ts` — **N tests.** Auth, parallel fetch, duplicate check, insert, fallback.
- `src/__tests__/unit/content-brief-assembly.test.ts` — **N tests.** Markdown assembly with/without AI content.
- `src/__tests__/unit/generate-brief-button.test.ts` — **N tests.** Render states, loading, test-id.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/content-brief-builder.test.ts       # N tests passing
npx vitest run src/__tests__/unit/content-brief-generator.test.ts     # N tests passing
npx vitest run src/__tests__/unit/brief-actions.test.ts               # N tests passing
npx vitest run src/__tests__/unit/content-brief-assembly.test.ts      # N tests passing
npx vitest run src/__tests__/unit/generate-brief-button.test.ts       # N tests passing
npx vitest run                                                         # All tests passing
```

**Note:** Replace N with actual test counts verified via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `content_drafts` table + trigger system | Sprint 61 (§36.1) | Draft storage with trigger_type/trigger_id |
| `target_queries` per-org | Sprint 41+ | Query text + category for brief generation |
| `sov_evaluations` per-engine | Sprint 41+ | Gap detection + competitor mentions |
| `locations` ground truth | Base schema | Business data for AI grounding |
| AI SDK model keys (§19.3) | Sprint 68+ | `getModel()` + `hasApiKey()` pattern |
| Zod schemas (§19.3) | Sprint 68+ | `zodSchema()` wrapper for `generateObject` |
| Content Drafts page | Sprint 61 | Existing UI for draft review/approval/publish |
| Content Calendar (Sprint 83) | Sprint 83 | SOV gap recommendations link to this generator |

---

## 🧠 Edge Cases

1. **No API key (OpenAI not configured):** `generateBriefContent()` returns null. Brief still generates with structure-only content (placeholder text). Draft saved normally — user fills in the creative content manually.
2. **Draft already exists for query:** Server action checks for existing draft with same `trigger_type='prompt_missing'` + `trigger_id`. Returns error "A draft already exists for this query." Button shows "View Draft →" instead.
3. **Query has no SOV evaluations yet:** `missingEngineCount = 0`, `totalEngineCount = 0`. Brief still generates — the gap is inferred from the user clicking "Generate Brief" on a query they know they're missing.
4. **Very long query text:** Slug truncated to 80 characters. Title tag and H1 use full text. AI handles long queries naturally.
5. **Special characters in query:** `slugify()` strips everything except `a-z0-9\s-`. Query text preserved in title and AI prompt.
6. **Location missing city/state:** Falls back to empty strings. AI brief will be less location-specific but still valid.
7. **AI returns malformed response:** `generateObject` with Zod schema validation ensures structured output. If validation fails, `generateBriefContent` throws — server action catches and returns error.
8. **Concurrent generation attempts:** Duplicate check queries `content_drafts` before insert. Race condition is possible but benign — worst case is two drafts for the same query (user can archive one).

---

## 🔮 AI_RULES Updates

Add new rule:

```markdown
## 49. 📝 SOV Gap → Content Brief Generator (Sprint 86)

Generates AEO-optimized content briefs for SOV gap queries.

* **Two-layer design:**
  - **Layer 1 (pure):** `buildBriefStructure()` — slug, title tag, H1, schema recommendations, llms.txt entry. No AI, no I/O.
  - **Layer 2 (AI):** `generateBriefContent()` — `generateObject` with `gpt-4o-mini` + `ContentBriefSchema`. Produces answer capsule, outline sections, FAQ questions. System prompt includes business ground truth from `locations` table.
* **Model key:** `content-brief` → gpt-4o-mini (§19.3).
* **Schema:** `ContentBriefSchema` in `lib/ai/schemas.ts`. Required fields: answerCapsule, outlineSections (3-6), faqQuestions (3-5), metaDescription.
* **Server action:** `generateContentBrief(queryId)` — user-initiated (§5). Checks for duplicate drafts. Saves to `content_drafts` with `trigger_type='prompt_missing'`, `trigger_id=query.id`.
* **Fallback:** When no API key, generates structure-only brief with placeholder content. Draft still saved.
* **Ground truth only:** AI prompt includes ONLY facts from `locations` record. Never fabricates prices, menu items, hours.
* **Content Calendar integration:** Sprint 83 SOV gap recommendations already link to this generator.
```
