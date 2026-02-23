# 19 — Autopilot Engine
## Closed-Loop Content Pipeline: Trigger Taxonomy, Draft Generation, Approval Workflow, and Publish Integration
### Version: 1.0 | Date: February 23, 2026
### Companion to: 04-INTELLIGENCE-ENGINE.md §3.4, 05-API-CONTRACT.md §13, 06-FRONTEND-UX-SPEC.md §9

---

## ⚠️ Architectural Authority Notice

- **Doc 04 Section 3.4 is authoritative for:** The `triggerContentDraftIfNeeded()` function implementation and the Greed Engine → Autopilot integration point.
- **Doc 05 Section 13 is authoritative for:** All Content Draft API endpoint contracts (request/response shapes, auth, plan gating).
- **Doc 06 Section 9 is authoritative for:** The Content Draft Review UI (component hierarchy, approval flow, publish target selector).
- **This doc (19) is authoritative for:** The complete trigger taxonomy (all sources that create drafts), draft generation prompt engineering, the HITL approval protocol, the publish pipeline (all targets), post-publish measurement, and the Autopilot cron orchestration.

---

## 1. The Closed Loop

The LocalVector product follows a DETECT → DIAGNOSE → ACT → MEASURE cycle. Every engine before Doc 19 handles DETECT and DIAGNOSE:

- Fear Engine: detects hallucinations
- Greed Engine: diagnoses why competitors win
- SOV Engine: measures actual citation share
- Prompt Intelligence: identifies query gaps
- Occasion Engine: detects seasonal opportunities
- Content Grader: diagnoses page-level AEO gaps
- Citation Intelligence: diagnoses platform gaps

The Autopilot Engine closes the loop. It is the ACT layer — converting detected gaps into publishable content, routing that content through human review, and publishing it with a single click.

**The guarantee:** No content ever publishes without explicit human approval. `human_approved: true` and `status: 'approved'` are validated server-side on every publish call. There is no bypass path.

---

## 2. Trigger Taxonomy

The `content_drafts.trigger_type` column supports 5 values. This section defines the conditions, source system, and draft characteristics for each.

### 2.1 `competitor_gap`

**Source:** Greed Engine cron (Doc 04 Section 3.4)
**Condition:** `competitor_intercepts.gap_magnitude = 'high'` on a new intercept result
**Auto-trigger:** Yes (Growth+)
**Draft type:** `faq_page` (default) or `blog_post` depending on `winning_factor` analysis

**Context passed to draft generator:**
- `competitor_name`, `winning_factor`, `query_asked`, `gap_details`
- `your_mentions` vs. `competitor_mentions` (from `gap_analysis` JSONB)

**Idempotency:** `triggerContentDraftIfNeeded()` checks for existing `content_drafts` row with `trigger_id = intercept.id` before inserting. Duplicate calls produce no second draft.

**Throttle:** Max 5 unreviewed `competitor_gap` drafts per org at any time. New drafts suppressed if `pending_count >= 5`. Alert 13 (Doc 10) fires.

---

### 2.2 `occasion`

**Source:** Occasion Engine scheduler (Doc 16 Section 4.1)
**Condition:** All conditions in Doc 16 Section 4.1 are true (within 21-day window, not cited, no existing draft)
**Auto-trigger:** Yes (Growth+)
**Draft type:** `occasion_page`

**Context passed to draft generator:**
- `occasion.name`, `occasion.peakQueryPatterns`, `days_until_peak`
- `competitor_winning`, `competitor_name` (from Greed Engine intercept lookup)
- The full occasion content structure template (Doc 16 Section 4.3)

**Seasonal note:** Occasion drafts have an implicit expiry — a Valentine's Day draft created on Jan 31 is useless if not published by Feb 7. The draft detail view (Doc 06 Section 9.2) shows a "Publish by [date]" urgency indicator when `trigger_type = 'occasion'`.

---

### 2.3 `prompt_missing`

**Source:** Prompt Intelligence gap detector (Doc 15 Section 3) and Content Grader (Doc 17 Section 6.1)
**Condition A (zero-citation cluster):** 3+ tracked queries all returning 0 citations for ≥2 consecutive SOV runs
**Condition B (low page score):** `page_audits.overall_score < 50` for a page that has been audited
**Auto-trigger:** Yes for Condition B (Growth+). Condition A creates a gap alert but requires user to manually initiate draft from `/visibility`.
**Draft type:** `faq_page` (most effective fix for both conditions)

**Context passed to draft generator:**
- **Condition A:** `zero_citation_queries` (list of query texts), `category`, `city`
- **Condition B:** `page_audits.recommendations` array (top 3 fixes), `page_url`, `page_type`

---

### 2.4 `first_mover`

**Source:** SOV Engine First Mover Alert pipeline (Doc 04c Section 6)
**Condition:** `sov_first_mover_alerts.status = 'new'` AND user clicks "Create Content" on the alert card
**Auto-trigger:** No — user-initiated only (clicking the CTA creates the draft)
**Draft type:** `faq_page` for discovery queries; `occasion_page` for occasion queries

**Why not auto-triggered:** First Mover alerts are opportunities, not gaps. The tenant may already have relevant content they just need to optimize — an auto-draft without context would be lower quality. The alert CTA gives the user agency.

**Context passed to draft generator:**
- `query_text`, `query_category`, `occasion_tag` (if applicable)
- "No businesses are currently being cited for this query in [city]. Be the first."

---

### 2.5 `manual`

**Source:** User clicks "+ New Draft" in the Content Drafts list view
**Condition:** User-initiated, no system trigger
**Auto-trigger:** N/A
**Draft type:** User selects from dropdown: `faq_page | occasion_page | blog_post | landing_page | gbp_post`

**Manual draft creation form:**
```
Target query / topic: [text input]
Content type: [dropdown]
Location: [location picker, defaults to primary]
Additional context (optional): [textarea — e.g., "We're hosting a DJ on Fridays now"]
```

Manual drafts go through the same GPT-4o-mini generation pipeline as auto-triggered drafts.

---

## 3. Draft Generation Pipeline

### 3.1 `createDraft()` — Master Function

```typescript
// lib/autopilot/create-draft.ts

interface DraftTrigger {
  triggerType: DraftTriggerType;
  triggerId: string | null;
  orgId: string;
  locationId: string;
  context: DraftContext;  // varies by trigger type (see Section 2)
}

interface DraftContext {
  targetQuery?: string;
  competitorName?: string;
  winningFactor?: string;
  occasionName?: string;
  daysUntilPeak?: number;
  zeroCitationQueries?: string[];
  pageRecommendations?: PageAuditRecommendation[];
  additionalContext?: string;  // from manual drafts
}

async function createDraft(trigger: DraftTrigger): Promise<ContentDraft> {
  // 1. Idempotency check (skip if draft already exists for this trigger_id)
  if (trigger.triggerId) {
    const existing = await getDraftByTriggerId(trigger.triggerId);
    if (existing) return existing;
  }

  // 2. Load location context
  const location = await getLocation(trigger.locationId);
  const contentType = determineContentType(trigger);

  // 3. Generate brief via GPT-4o-mini
  const brief = await generateDraftBrief(trigger, location, contentType);

  // 4. Score the generated content
  const aeoScore = await scoreContent(brief.content, brief.targetKeywords);

  // 5. Insert to content_drafts
  const draft = await db.contentDrafts.insert({
    orgId: trigger.orgId,
    locationId: trigger.locationId,
    triggerType: trigger.triggerType,
    triggerId: trigger.triggerId,
    draftTitle: brief.title,
    draftContent: brief.content,
    targetPrompt: trigger.context.targetQuery ?? null,
    contentType,
    aeoScore,
    status: 'draft',
    humanApproved: false,
  });

  return draft;
}
```

### 3.2 `generateDraftBrief()` — GPT-4o-mini Prompt

```typescript
async function generateDraftBrief(
  trigger: DraftTrigger,
  location: Location,
  contentType: DraftContentType
): Promise<{ title: string; content: string; targetKeywords: string[] }> {

  const contextBlock = buildContextBlock(trigger);  // varies by trigger type

  const prompt = `
You are an expert AEO content writer specializing in local business AI visibility.
Generate a ${contentType} content brief for the following business.

Business: ${location.businessName}
Category: ${location.categories[0]}
City: ${location.city}, ${location.state}
Content type: ${contentType}

${contextBlock}

Writing rules:
1. Answer-First structure: first sentence must directly answer the most likely search query
2. Mention "${location.businessName}" and "${location.city}" naturally within the first 50 words
3. Include specific, verifiable details (hours, amenities, atmosphere) — no generic claims
4. End with a clear call-to-action (reservation, directions, contact)
5. Target length: 250–350 words

Return JSON only — no markdown, no preamble:
{
  "title": "Page title (max 60 chars, includes business name and city)",
  "content": "Full page content following the Answer-First structure",
  "estimated_aeo_score": <number 60-90>,
  "target_keywords": ["array", "of", "5-8", "key phrases"]
}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,  // Lower temperature = more consistent, factual output
    response_format: { type: 'json_object' },
  });

  const raw = JSON.parse(response.choices[0].message.content!);
  return {
    title: raw.title,
    content: raw.content,
    targetKeywords: raw.target_keywords,
  };
}
```

### 3.3 Context Block Builder (per trigger type)

```typescript
function buildContextBlock(trigger: DraftTrigger): string {
  const ctx = trigger.context;

  switch (trigger.triggerType) {
    case 'competitor_gap':
      return `
Competitive gap context:
- Query we're losing: "${ctx.targetQuery}"
- Competitor winning: ${ctx.competitorName}
- Why they're winning: ${ctx.winningFactor}
- Goal: Create content that positions ${location.businessName} as the better choice for this query.`;

    case 'occasion':
      return `
Occasion context:
- Occasion: ${ctx.occasionName} (${ctx.daysUntilPeak} days away)
- Target queries: ${trigger.context.zeroCitationQueries?.join(', ')}
${ctx.competitorName ? `- Competitor already winning: ${ctx.competitorName}` : '- No competitor currently winning — First Mover opportunity'}
- Goal: Rank in AI answers for "${ctx.occasionName}" queries in ${location.city} before the occasion.`;

    case 'prompt_missing':
      if (ctx.zeroCitationQueries?.length) {
        return `
Content gap context:
- Queries returning zero citations: ${ctx.zeroCitationQueries.join(', ')}
- Goal: Create a page that directly answers these queries and establishes the business as the authoritative local source.`;
      }
      return `
Page improvement context:
- Top recommendations from page audit:
${ctx.pageRecommendations?.slice(0, 3).map(r => `  • ${r.issue}: ${r.fix}`).join('\n')}
- Goal: Address the top scoring gaps in a new optimized page.`;

    case 'first_mover':
      return `
First mover opportunity:
- Query: "${ctx.targetQuery}"
- Current state: No local business is cited for this query in ${location.city}
- Goal: Publish first and own this query before competitors.`;

    case 'manual':
      return ctx.additionalContext
        ? `Additional context provided by user:\n${ctx.additionalContext}`
        : 'No additional context — generate based on business profile alone.';
  }
}
```

---

## 4. HITL Approval Protocol

### 4.1 The Rules (Non-Negotiable)

1. **No auto-publish.** Every draft starts at `status: 'draft'`, `human_approved: false`.
2. **Approval is irrevocable-forward.** Once `status: 'approved'`, the draft cannot be edited without first rejecting it (which returns it to `status: 'draft'`).
3. **Server-side enforcement.** `POST /api/content-drafts/:id/publish` validates both conditions server-side — returns `403` if either fails. No client-side bypass possible.
4. **Factual disclaimer.** The publish flow shows: *"You are publishing AI-generated content. Please verify all facts (prices, hours, amenities) before publishing."*

### 4.2 State Machine

```
draft ──────────────────────────────────────────────────────────► archived
  │                                                                  ▲
  ├──[approve]──► approved ──[publish]──► published                  │
  │                   │                                              │
  │               [reject]                                           │
  │                   │                                              │
  └───────────────────┴──► draft (back to editable)                  │
                                                                     │
         Any state ──[manual archive]──────────────────────────────►─┘
```

### 4.3 Edit → Re-Score Flow

When a user edits draft content (via `PATCH /api/content-drafts/:id`), the AEO score is recalculated:

- **Client-side:** Real-time AEO score estimate updates as user types (debounced 500ms). Uses a lightweight scoring heuristic (keyword presence, length, answer-first check) — not an LLM call.
- **Server-side:** On `PATCH` save, trigger an async GPT-4o-mini re-score if `draft_content` changed. Update `aeo_score` in the background. UI refreshes on next polling cycle (or websocket push if implemented).

---

## 5. Publish Pipeline

### 5.1 `download` Target (Phase 5 — available first)

Returns the draft content as a downloadable HTML file with proper meta tags and JSON-LD schema pre-injected.

```typescript
async function publishAsDownload(draft: ContentDraft, location: Location): Promise<PublishResult> {
  const schema = buildLocalBusinessSchema(location);
  const faqSchema = draft.contentType === 'faq_page'
    ? await buildFaqSchemaFromContent(draft.draftContent)
    : null;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${draft.draftTitle}</title>
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  ${faqSchema ? `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>` : ''}
</head>
<body>
  <h1>${draft.draftTitle}</h1>
  ${markdownToHtml(draft.draftContent)}
</body>
</html>`;

  // Return as base64 for download; update draft status
  return {
    publishedUrl: null,  // no URL for downloads
    downloadPayload: Buffer.from(html).toString('base64'),
    status: 'published',
  };
}
```

### 5.2 `wordpress` Target (Phase 6)

Uses WordPress REST API with Application Password authentication. Creates a `draft` post in WordPress — user approves in WP admin before it goes live (second approval layer).

```typescript
async function publishToWordPress(
  draft: ContentDraft,
  wpConfig: { siteUrl: string; username: string; appPassword: string }
): Promise<PublishResult> {
  const endpoint = `${wpConfig.siteUrl}/wp-json/wp/v2/pages`;

  const body = {
    title: draft.draftTitle,
    content: `<!-- wp:paragraph -->\n<p>${draft.draftContent.replace(/\n/g, '</p>\n<!-- /wp:paragraph -->\n<!-- wp:paragraph -->\n<p>')}</p>\n<!-- /wp:paragraph -->`,
    status: 'draft',  // Always create as draft — user approves in WP
    slug: slugify(draft.draftTitle),
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${wpConfig.username}:${wpConfig.appPassword}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new WordPressPublishError(response.status, await response.text());

  const wpPost = await response.json();
  return {
    publishedUrl: wpPost.link,
    status: 'published',
  };
}
```

**WordPress connection settings stored in:** `location_integrations` table (existing) with `integration_type: 'wordpress'` and `credentials` JSONB (encrypted).

### 5.3 `gbp_post` Target (Phase 6)

Uses the GBP API (Google Business Profile v1) to create a `LOCAL_POST` update. GBP posts are surface in Maps and Search results — a lightweight way to publish occasion and announcement content without a full website page.

```typescript
async function publishToGBP(
  draft: ContentDraft,
  oauthToken: GoogleOAuthToken
): Promise<PublishResult> {
  // GBP posts are limited to 1500 chars; truncate with ellipsis if needed
  const summary = draft.draftContent.slice(0, 1490).trim() + '…';

  const post = {
    languageCode: 'en-US',
    summary,
    topicType: 'STANDARD',
    callToAction: {
      actionType: 'CALL',
      url: null,  // CTA type can be CALL, BOOK, ORDER, SHOP, SIGN_UP, LEARN_MORE
    },
  };

  const locationName = await getGBPLocationName(draft.locationId);

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${oauthToken.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(post),
    }
  );

  if (!response.ok) {
    await refreshGBPTokenIfNeeded(oauthToken);
    throw new GBPPublishError(response.status, await response.text());
  }

  const gbpPost = await response.json();
  return {
    publishedUrl: gbpPost.searchUrl ?? null,
    status: 'published',
  };
}
```

---

## 6. Post-Publish Measurement

### 6.1 SOV Re-Check (14 days post-publish)

After a draft is published, schedule a SOV re-check for the `target_prompt` query 14 days later:

```typescript
async function schedulePostPublishMeasurement(draft: ContentDraft) {
  if (!draft.targetPrompt) return;

  // Schedule via Vercel Cron + KV queue, or use pg-boss in Supabase
  await scheduleTask({
    taskType: 'sov_recheck',
    targetDate: addDays(new Date(), 14),
    payload: {
      draftId: draft.id,
      locationId: draft.locationId,
      targetQuery: draft.targetPrompt,
    },
  });
}
```

When the re-check fires:
1. Run `runSOVQuery(draft.targetPrompt)` against Perplexity
2. Compare result to pre-publish SOV data
3. If `cited: true` (was `false` before): send "🎉 It's working! AI is now citing you for '${targetPrompt}'" email
4. If `cited: false`: send "Still waiting for AI to index this — we'll check again next week" email

### 6.2 Content Grader Re-Audit (48 hours post-publish)

For `trigger_type: 'prompt_missing'` drafts linked to a `page_audits` row:

After publishing to `wordpress` or `download`, schedule a Content Grader re-audit of the page URL after 48 hours (allowing time for the page to go live and be indexed). Compare `overall_score` before vs. after.

### 6.3 Reality Score Impact

Post-publish SOV improvements automatically feed into the weekly SOV cron result. No additional wiring needed — the cron runs every Sunday and picks up the improved citation status for the tracked query.

---

## 7. Autopilot Cron Orchestration

The Autopilot Engine doesn't have its own standalone cron. Its trigger points are wired into existing crons:

| Trigger Type | Cron That Fires It | Timing |
|-------------|-------------------|--------|
| `competitor_gap` | Greed Engine cron (daily, Growth+) | After `writeInterceptResult()` |
| `occasion` | SOV cron (weekly, Sunday 2AM) | After `checkOccasionAlerts()` |
| `prompt_missing` | SOV cron (weekly) | After `detectQueryGaps()` for zero-citation clusters |
| `prompt_missing` | Page Audit cron (monthly) | After `auditPage()` for low-score pages |
| `first_mover` | User-initiated | On "Create Content" button click |
| `manual` | User-initiated | On "+ New Draft" form submit |

Post-publish measurement tasks are queued separately (Section 6.1).

---

## 8. Draft Queue Management

### 8.1 Pending Draft Cap

Maximum 5 unreviewed (`status: 'draft'`) drafts per org at any time. When the cap is hit:
- Auto-trigger sources (Greed, Occasion, Prompt Missing) suppress new drafts
- Alert 13 (Doc 10) fires
- Dashboard sidebar shows amber badge: "📝 Content Drafts (5 — Review needed)"

### 8.2 Draft Expiry

Drafts with `trigger_type: 'occasion'` that were not published before the occasion peak date are automatically archived:

```sql
-- Runs daily at midnight
UPDATE content_drafts
SET status = 'archived'
WHERE trigger_type = 'occasion'
  AND status IN ('draft', 'approved')
  AND trigger_id IN (
    SELECT id FROM local_occasions
    WHERE annual_date IS NOT NULL
      AND TO_DATE(annual_date, 'MM-DD') < CURRENT_DATE
  );
```

Archived drafts are visible in the Content Drafts list with an "Expired — occasion passed" badge. They can be unarchived and repurposed for next year.

---

## 9. Integration Points

| System | Integration |
|--------|-------------|
| Greed Engine (Doc 04 §3.4) | `triggerContentDraftIfNeeded()` — creates `competitor_gap` drafts |
| Occasion Engine (Doc 16 §4) | `createOccasionDraft()` — creates `occasion` drafts |
| Prompt Intelligence (Doc 15 §3) | `zero_citation_cluster` gaps → user-initiated `first_mover` or auto `prompt_missing` |
| Content Grader (Doc 17 §6) | Low-score page audits → auto `prompt_missing` drafts; post-publish re-audit |
| SOV Engine (Doc 04c) | `target_prompt` re-checks after publish measure improvement |
| GBP OAuth (Doc 09 Phase 8) | `google_oauth_tokens` provides credentials for `gbp_post` publish target |
| Content Draft UI (Doc 06 §9) | Review, edit, approve, reject, publish — full UX spec there |
| Content Draft API (Doc 05 §13) | All endpoint contracts defined there |

---

## 10. TypeScript Interfaces

Full `ContentDraft` and `ContentDraftWithContext` in Doc 03 Section 15.13. Autopilot-specific types:

```typescript
// src/lib/types/autopilot.ts

export interface DraftTrigger {
  triggerType: DraftTriggerType;
  triggerId: string | null;
  orgId: string;
  locationId: string;
  context: DraftContext;
}

export interface DraftContext {
  targetQuery?: string;
  competitorName?: string;
  winningFactor?: string;
  occasionName?: string;
  daysUntilPeak?: number;
  zeroCitationQueries?: string[];
  pageRecommendations?: PageAuditRecommendation[];
  additionalContext?: string;
}

export interface PublishResult {
  publishedUrl: string | null;
  status: DraftStatus;
  downloadPayload?: string;  // base64 HTML for download target
}

export interface PostPublishMeasurementTask {
  taskType: 'sov_recheck' | 'page_reaudit';
  targetDate: string;
  payload: {
    draftId: string;
    locationId: string;
    targetQuery?: string;
    pageUrl?: string;
    baselineScore?: number;
  };
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-23 | Initial spec. Complete trigger taxonomy (5 trigger types with conditions, auto/manual flags, idempotency rules). `createDraft()` master function. `generateDraftBrief()` with GPT-4o-mini prompt. Context block builder (per trigger type). HITL approval protocol (4 rules + state machine). Edit → re-score flow (client-side heuristic + async GPT-4o-mini). Publish pipeline: download (Phase 5), WordPress (Phase 6), GBP Post (Phase 6). Post-publish measurement: SOV re-check at 14 days, Content Grader re-audit at 48 hours. Draft queue management: cap at 5 pending, occasion expiry archiver. Integration points. TypeScript interfaces. |
