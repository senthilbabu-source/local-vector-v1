# 17 — Content Grader
## Site-Wide AEO Scoring, FAQ Auto-Generator, and Inline Fix Delivery
### Version: 1.0 | Date: February 23, 2026
### Companion to: 04-INTELLIGENCE-ENGINE.md, 05-API-CONTRACT.md §14, 06-FRONTEND-UX-SPEC.md §14 (Page Audits)

---

## ⚠️ Architectural Authority Notice

- **Doc 04 Section 4 (Magic Engine) is authoritative for:** Menu OCR pipeline, `MenuExtractedData` schema, JSON-LD generation for `MenuPage` / `RestaurantMenu` schema types.
- **This doc (17) is authoritative for:** Site-wide page auditing beyond the menu (homepage, about, FAQ, events, occasion pages), AEO scoring methodology, FAQ schema auto-generation, page-level fix delivery, the `page_audits` table logic, and the "Content Grader" surface in the dashboard.
- **Relationship:** The Magic Engine grades `menu.localvector.ai/{slug}` pages. The Content Grader grades the tenant's **own website** pages.

---

## 1. What Content Grader Does

The Magic Engine already handles one critical AEO problem: making menu data readable to AI. But a restaurant's menu page is only one of many pages AI crawlers evaluate. A well-optimized homepage, about page, and FAQ page are often *more* influential in AI citations than the menu itself — because AI models synthesize from multiple signals.

The Content Grader:
1. **Fetches** a page URL provided by the tenant
2. **Scores** it against 5 AEO dimensions (Section 3)
3. **Generates** a prioritized fix list with specific, copy-paste-ready recommendations
4. **Optionally triggers** an Autopilot draft if the score is below threshold (Section 6)

---

## 2. Scoring Dimensions

Every page is scored across 5 dimensions, each 0–100. The `overall_score` is a weighted composite.

### 2.1 Dimension Weights

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| Answer-First Structure | 35% | Does the first 100 words directly answer the most likely query for this page type? |
| Schema Completeness | 25% | Are the correct Schema.org types present for this page type? |
| FAQ Schema Presence | 20% | Is a `FAQPage` schema present and populated with ≥3 Q&A pairs? |
| Keyword Density | 10% | Are the business name, city, category, and primary keywords present at adequate frequency? |
| Entity Clarity | 10% | Is the business entity clearly defined (name, address, phone, hours visible in page text)? |

**Formula:** `overall_score = (answer_first × 0.35) + (schema_completeness × 0.25) + (faq_schema × 0.20) + (keyword_density × 0.10) + (entity_clarity × 0.10)`

### 2.2 Answer-First Score (35%)

AI models synthesize answers from the first substantive paragraph they encounter. A page that buries its core proposition under navigation and hero images is invisible to AI — even if the content is accurate.

**Scoring method:**
1. Extract the first 150 words of visible page text (strip HTML, nav, footer, script)
2. Build a target query from `locations` data: `"best {category} in {city} {state}"`
3. Call GPT-4o-mini: *"On a scale of 0–100, how directly does this opening text answer the query '{targetQuery}'? Return only a number."*
4. Cache the score in `page_audits.answer_first_score`

**Fix templates by score range:**

| Range | Diagnosis | Fix Template |
|-------|-----------|-------------|
| 0–30 | Opening text is navigation/hero copy with no substance | "Replace your opening section with: '{BusinessName} is {city}'s [value prop]. [Top differentiator]. [CTA].' Start with the answer." |
| 31–60 | Content exists but doesn't lead with the key claim | "Move your strongest claim to the first sentence. AI reads top-down and stops early." |
| 61–80 | Good but not optimized for the most common query | "Add: 'Serving {city} since [year], {BusinessName} is known for [top 2 attributes].' to your opening paragraph." |
| 81–100 | Strong — no change needed | — |

### 2.3 Schema Completeness Score (25%)

Checks whether the page contains the correct JSON-LD `@type` for its `page_type`, plus required properties.

**Required schemas by page type:**

| Page Type | Required Schema | Required Properties |
|-----------|----------------|-------------------|
| `homepage` | `LocalBusiness` or subtype | `name`, `address`, `telephone`, `openingHours`, `priceRange` |
| `menu` | `MenuPage` + `Restaurant` | `hasMenu`, `servesCuisine`, `menu` items |
| `about` | `LocalBusiness` | `name`, `description`, `foundingDate`, `employee` (optional) |
| `faq` | `FAQPage` | `mainEntity` array with ≥3 `Question`/`acceptedAnswer` pairs |
| `events` | `Event` | `name`, `startDate`, `location`, `organizer` |
| `occasion` | `LocalBusiness` + `FAQPage` | Full `LocalBusiness` + occasion-specific FAQ |

**Scoring method:** Parse `<script type="application/ld+json">` blocks. Check for required `@type`. Check for required properties. Score = (present properties / required properties) × 100.

### 2.4 FAQ Schema Presence (20%)

`FAQPage` schema is the single highest-impact addition for AI citation probability. AI models like Perplexity and ChatGPT directly extract Q&A pairs from `FAQPage` schema and quote them verbatim in answers.

**Scoring:**
- `FAQPage` present with ≥5 Q&A pairs: 100
- `FAQPage` present with 3–4 Q&A pairs: 75
- `FAQPage` present with 1–2 Q&A pairs: 40
- `FAQPage` absent: 0

### 2.5 Keyword Density Score (10%)

Checks for the presence (not stuffing) of business-critical terms in visible page text.

**Required terms (sourced from `locations` table):**
- Business name (exact match + possessive variant)
- City name
- State abbreviation
- Primary category (from `locations.categories[0]`)
- At least 2 amenity descriptors (from `locations.amenities`)

**Scoring:** (present terms / required terms) × 100. Cap at 100.

### 2.6 Entity Clarity Score (10%)

Checks whether AI can extract the complete business entity from this page alone — without needing to follow links to GBP or other sources.

**Required entity signals in page text:**
- Business name visible in `<h1>` or prominent text
- Full address (at minimum city + state)
- Phone number
- Hours (at minimum day range + time range)

**Scoring:** (present signals / 4) × 100.

---

## 3. Page Auditor Implementation

### 3.1 `lib/page-audit/auditor.ts`

```typescript
// lib/page-audit/auditor.ts

interface PageAuditInput {
  pageUrl: string;
  pageType: PageType;
  locationId: string;
}

interface PageAuditResult {
  overallScore: number;
  answerFirstScore: number;
  schemaCompletenessScore: number;
  faqSchemaPresent: boolean;
  faqSchemaScore: number;
  keywordDensityScore: number;
  entityClarityScore: number;
  recommendations: PageAuditRecommendation[];
}

async function auditPage(input: PageAuditInput): Promise<PageAuditResult> {
  // 1. Fetch page HTML
  const response = await fetch(input.pageUrl, {
    headers: { 'User-Agent': 'LocalVector-AuditBot/1.0 (+https://localvector.ai/bot)' },
    signal: AbortSignal.timeout(10_000),  // 10s timeout
  });
  if (!response.ok) throw new PageFetchError(response.status, input.pageUrl);

  const html = await response.text();

  // 2. Extract visible text and JSON-LD blocks
  const visibleText = extractVisibleText(html);    // strip nav, footer, scripts
  const jsonLdBlocks = extractJsonLd(html);
  const location = await getLocation(input.locationId);

  // 3. Score all dimensions in parallel
  const [answerFirst, schemaSCore, faqScore, keywordScore, entityScore] = await Promise.all([
    scoreAnswerFirst(visibleText, location),
    scoreSchemaCompleteness(jsonLdBlocks, input.pageType),
    scoreFaqSchema(jsonLdBlocks),
    scoreKeywordDensity(visibleText, location),
    scoreEntityClarity(visibleText, html, location),
  ]);

  // 4. Build recommendations
  const recommendations = buildRecommendations({
    answerFirst, schemaScore: schemaSCore, faqScore, keywordScore, entityScore,
    pageType: input.pageType, location, jsonLdBlocks, visibleText,
  });

  const overallScore = Math.round(
    (answerFirst.score * 0.35) +
    (schemaSCore.score * 0.25) +
    (faqScore.score * 0.20) +
    (keywordScore.score * 0.10) +
    (entityScore.score * 0.10)
  );

  return {
    overallScore,
    answerFirstScore: answerFirst.score,
    schemaCompletenessScore: schemaSCore.score,
    faqSchemaPresent: faqScore.present,
    faqSchemaScore: faqScore.score,
    keywordDensityScore: keywordScore.score,
    entityClarityScore: entityScore.score,
    recommendations: recommendations.sort((a, b) => b.impactPoints - a.impactPoints),
  };
}
```

### 3.2 Cost Control

Page audits consume one GPT-4o-mini call (Answer-First scoring) plus one HTTP fetch per page. No other API calls.

| Trigger | Frequency | Cost per audit |
|---------|-----------|----------------|
| On-demand (user clicks "Audit") | User-triggered | ~$0.002 (GPT-4o-mini) |
| Monthly drift cron (`POST /cron/page-audits`) | Monthly | Same |
| Autopilot post-publish check | After each publish | Same |

**Plan limits:**
- Starter: 1 homepage audit per month (on-demand)
- Growth: 10 page audits per month
- Agency: 50 page audits per month across all locations

---

## 4. FAQ Auto-Generator

The highest-impact fix for most pages is adding `FAQPage` schema. The Content Grader auto-generates a schema-ready FAQ set when `faqSchemaPresent === false`.

### 4.1 FAQ Generation Prompt

```typescript
const faqGenerationPrompt = `
Generate 5 FAQ questions and answers for a ${pageType} page for this business:

Business: ${businessName}
Category: ${primaryCategory}
City: ${city}, ${state}
Hours: ${formatHours(hoursData)}
Key amenities: ${formatAmenities(amenities)}
Page purpose: ${pageType}

Requirements:
- Questions must be realistic queries a customer would type into ChatGPT or Perplexity
- Answers must be direct (Answer-First), factual, and ≤ 50 words
- Include the business name and city naturally in at least 2 answers
- For FAQ pages: mix of operational questions (hours, parking, reservations) and experiential ("What is the vibe at...")
- For homepage: mix of discovery ("Is ${businessName} good for...") and practical

Return JSON only:
{
  "faqs": [
    { "question": "...", "answer": "..." },
    ...
  ]
}
`;
```

### 4.2 Generated FAQ Schema Output

The auto-generator produces ready-to-paste JSON-LD:

```typescript
function buildFaqSchema(faqs: { question: string; answer: string }[]): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
  };
  return JSON.stringify(schema, null, 2);
}
```

The recommendation object for missing FAQ schema includes the complete JSON-LD as the `fix` field — the user can paste it directly into their `<head>`.

### 4.3 FAQ Auto-Generator in Content Drafts

When the Autopilot Engine (Doc 19) creates a draft with `content_type = 'faq_page'`, it calls `generateFaqSet()` as part of the brief generation and appends the FAQ schema to `draft_content`.

---

## 5. Recommendation Delivery

Every recommendation in `page_audits.recommendations` is a structured object, not free-form text. This ensures the UI can render actionable copy-paste fixes, not vague suggestions.

### 5.1 Recommendation Object

```typescript
interface PageAuditRecommendation {
  issue: string;         // Short diagnosis: "Missing FAQ schema"
  fix: string;           // Specific, actionable: "Add this <script> block to your <head>:" + code
  impactPoints: number;  // How many overall_score points this fix adds if implemented
  priority: 'high' | 'medium' | 'low';
  fixType: 'copy_paste' | 'content_edit' | 'technical' | 'structural';
  codeSnippet?: string;  // Ready-to-use HTML/JSON-LD (for copy_paste fixes)
}
```

### 5.2 Fix Type Taxonomy

| fixType | Description | Example |
|---------|-------------|---------|
| `copy_paste` | User pastes code into their website `<head>` or CMS | Full JSON-LD schema block |
| `content_edit` | User edits their homepage/about text | "Rewrite opening paragraph to: '...'" with suggested copy |
| `technical` | Requires website access (plugin, theme edit) | "Install Yoast SEO and enable LocalBusiness schema" |
| `structural` | Page architecture change | "Add a dedicated FAQ section above the fold" |

**Priority rule:** `copy_paste` fixes are always `high` priority because they're lowest friction. `structural` fixes are always `medium` or `low` (high friction, even if high impact).

### 5.3 Score Impact Estimation

`impactPoints` is calculated based on the dimension weight and current gap:

```typescript
function estimateImpactPoints(
  dimension: string,
  currentScore: number,
  expectedScoreAfterFix: number,
  weight: number
): number {
  const scoreDelta = expectedScoreAfterFix - currentScore;
  return Math.round(scoreDelta * weight);
}

// Example: FAQ schema missing (score 0 → 100, weight 0.20)
// impactPoints = (100 - 0) × 0.20 = 20 points to overall score
```

---

## 6. Autopilot Integration

The Content Grader feeds Autopilot (Doc 19) in two ways:

### 6.1 Low-Score Trigger

When `POST /api/pages/audits/run` completes and `overall_score < 50`, automatically call `createAutopilotDraft()` with:
- `trigger_type: 'prompt_missing'`
- `trigger_id: page_audit.id`
- `content_type: 'faq_page'` (FAQ page is the highest-ROI fix for most low-scoring pages)
- Context: pass `recommendations` array to the Autopilot brief generator so the draft addresses the specific gaps

**Plan gate:** Only Growth+ orgs trigger auto-drafts. Starter orgs see the audit results without auto-drafts.

### 6.2 Post-Publish Re-Audit

When a Content Draft with `trigger_type = 'prompt_missing'` is published, schedule a re-audit of the linked `page_url` after 48 hours. Compare `overall_score` before vs. after:
- Score improved ≥10 points → send "Your AEO score improved!" email
- Score unchanged → send "Your changes may not have propagated yet — we'll check again in 7 days"

---

## 7. Monthly Drift Detection Cron

**Endpoint:** `POST /cron/page-audits` (Doc 05 Section 14)
**Schedule:** First Sunday of each month, 4 AM EST (after SOV cron at 2 AM)

Logic:
1. Fetch all `page_audits` rows where `last_audited_at < NOW() - INTERVAL '28 days'`
2. Group by `org_id` — respect plan audit limits (Growth: 10/month, Agency: 50/month)
3. Re-audit each page; compare `overall_score` to previous run
4. If score dropped ≥10 points: add `drift_detected` flag to audit result + trigger alert email

**Drift alert email subject:** `⚠️ Your AI readiness score dropped on {page_url}`
**Body:** Score before vs. after + top 2 new recommendations.

---

## 8. Integration Points

| System | Integration |
|--------|-------------|
| Magic Engine (Doc 04 §4) | Complementary — Magic Engine grades `menu.localvector.ai` pages; this engine grades the tenant's own website |
| Autopilot Engine (Doc 19) | Low-score trigger (Section 6.1); post-publish re-audit feedback loop (Section 6.2) |
| Prompt Intelligence (Doc 15) | Zero-citation clusters identified by SOV → Content Grader identifies which page is responsible → Autopilot creates fix |
| Page Audits API (Doc 05 §14) | All endpoints defined there; implementation notes in this doc |
| Dashboard (Doc 06 §8) | Page audit scores appear in `/visibility` as secondary score cards below SOV ring |

---

## 9. TypeScript Interfaces

Full `PageAudit` interface in Doc 03 Section 15.14. This section adds the scorer-internal types.

```typescript
// src/lib/types/content-grader.ts

export type FixType = 'copy_paste' | 'content_edit' | 'technical' | 'structural';

export interface ScoredDimension {
  score: number;        // 0–100
  evidence: string;     // What the auditor found (for debugging)
  gaps: string[];       // What's missing
}

export interface FaqGenerationResult {
  faqs: Array<{ question: string; answer: string }>;
  schemaJson: string;   // ready-to-paste JSON-LD
}

export interface AuditScoreBreakdown {
  answerFirst: ScoredDimension;
  schemaCompleteness: ScoredDimension;
  faqSchema: ScoredDimension & { present: boolean };
  keywordDensity: ScoredDimension;
  entityClarity: ScoredDimension;
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-23 | Initial spec. 5-dimension AEO scoring model with weights. Answer-First score via GPT-4o-mini. Schema completeness rules per page type. FAQ Auto-Generator with ready-to-paste JSON-LD. Recommendation delivery taxonomy (fixType, impactPoints). Autopilot integration (low-score trigger + post-publish re-audit). Monthly drift cron. TypeScript interfaces. |
