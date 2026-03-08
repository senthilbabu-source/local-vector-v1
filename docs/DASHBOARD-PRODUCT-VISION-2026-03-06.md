# LocalVector.ai — Dashboard Product Vision & Engineering Specification
**Date:** 2026-03-06
**Status:** Strategic Reference — Living Document
**Scope:** Dashboard UX, Engine Coverage, Case-Study Loop Architecture, Competitive Differentiation

---

## Table of Contents

1. [Product Philosophy](#1-product-philosophy)
2. [The Promise We Must Keep](#2-the-promise-we-must-keep)
3. [Engine Inventory — What We Collect vs What We Show](#3-engine-inventory)
4. [The Case-Study Loop Framework](#4-the-case-study-loop-framework)
5. [Per-Engine Loop Assessment](#5-per-engine-loop-assessment)
6. [Critical Gaps — The After Half Is Missing](#6-critical-gaps)
7. [The Before/After Architecture](#7-the-beforeafter-architecture)
8. [Priority Implementation Roadmap](#8-priority-implementation-roadmap)
9. [Visualization Standards](#9-visualization-standards)
10. [Gamification Framework](#10-gamification-framework)
11. [Language & UX Standards](#11-language--ux-standards)
12. [Navigation Architecture](#12-navigation-architecture)
13. [Out-of-the-Box Differentiators](#13-out-of-the-box-differentiators)
14. [Success Metrics](#14-success-metrics)

---

## 1. Product Philosophy

LocalVector.ai exists to answer one question for a restaurant owner:

> **"Is AI helping or hurting my business right now — and what exactly do I do about it?"**

Every screen, every number, every chart must serve that question. Nothing else earns screen space.

### What We Are Not

- We are not an analytics platform. Analytics tells you what happened. We tell you what to do.
- We are not a reputation monitoring tool. Monitoring is passive. We are active intervention.
- We are not an SEO tool. SEO is for Google search. We are for the AI layer that is replacing it.

### What Makes Us Genuinely Different

No other product on the market does all four of these simultaneously:

1. **Detects** AI errors about a specific restaurant automatically across 5 AI engines
2. **Quantifies** the revenue cost of each error in dollars
3. **Provides a fix path** with verification that the fix worked
4. **Tracks recovery** — showing the owner how much money they got back

That is the complete loop. Every feature decision must be evaluated against whether it tightens that loop.

---

## 2. The Promise We Must Keep

The landing page case study shows this exact promise:

```
BEFORE LocalVector:
  AI Status:                 "Permanently Closed"  [x]
  Monthly AI Recommendations: 0
  Revenue Impact:            -$4,000/mo
  Time to Discovery:         3 months (by accident)

AFTER LocalVector:
  AI Status:                 "Open, Serving Dinner" [checkmark]
  Monthly AI Recommendations: 47
  Revenue Impact:            +$4,000/mo recovered
  Time to Detection:         < 24 hours
  The fix took 24 hours.
```

This is not just marketing. It is the product specification. Every engine must be capable of producing a real before/after story like this. If an engine can detect a problem but cannot contribute to a verified, measurable resolution, it is incomplete.

### The Loop in Six Steps

```
DETECT → EXPLAIN → GUIDE → FIX → VERIFY → MEASURE
```

| Step | What it means | Restaurant owner experience |
|---|---|---|
| DETECT | Engine automatically finds the problem | "I got an alert" |
| EXPLAIN | Plain English + dollar impact | "I understand why this matters" |
| GUIDE | Specific actionable steps | "I know exactly what to do" |
| FIX | Action taken (in-platform or external) | "I did the thing" |
| VERIFY | System re-checks after fix | "I know it actually worked" |
| MEASURE | Before/after comparison + revenue delta | "I can see what I got back" |

---

## 3. Engine Inventory

### What Every Engine Collects vs What Is Currently Shown

Ordered from highest value-to-restaurant-owner to lowest.

---

#### Engine 1 — AI Accuracy Engine (Hallucination Detection)

**What it collects:**
- `ai_hallucinations`: claim_text, severity (critical/high/medium/low), category, model_provider, correction_status, expected_truth, first_detected_at, last_seen_at, occurrence_count, follow_up_result
- `ai_evaluations`: accuracy_score per engine per location
- `ai_audits`: audit_date, issues_found per run

**Currently shown:**
- Truth score (composite)
- Per-engine accuracy bars
- 3-column triage swimlane (Fix Now / In Progress / Resolved)
- Hallucinations by model chart
- Hijacking alerts (Agency only)

**Not shown but collected:**
- Time-to-fix average (first_detected_at to verified_at — no verified_at column yet)
- Which error category causes most revenue loss
- Recurrence rate (occurrence_count trend)
- Revenue recovered when errors move to "fixed"
- "Before" claim vs "After" correct state side-by-side in Resolved column

**Fix guidance quality:** The platform shows WHAT is wrong but the fix action sends owners off-platform with no step-by-step. Category-specific guidance is missing. See §5 for the per-category fix matrix.

---

#### Engine 2 — Revenue Impact Engine

**What it collects:**
- `revenue_config`: avg_ticket, monthly_searches, local_conversion_rate, walk_away_rate per org
- `revenue_snapshots`: snapshot_date, leak_low, leak_high, breakdown JSONB (12 months)
- Computed: hallucination_cost + sov_gap_cost + competitor_steal_cost

**Currently shown:**
- Annual/monthly loss orb with animation
- Breakdown by category (3 bars)
- Coach Playbook with numbered missions sorted by recovery
- Revenue config form

**Not shown but collected:**
- Revenue recovered over time (snapshots exist — never compared before vs after)
- "You've recovered $X/mo since subscribing" — the most powerful retention metric available
- Benchmark: your revenue loss vs average restaurant in your city
- Recovery velocity: is your leak shrinking?

---

#### Engine 3 — AI Mentions Engine (Share of Voice)

**What it collects:**
- `sov_evaluations`: query_id, engine, rank_position, mentioned_competitors, raw_response, sentiment_data, cited_sources, created_at
- `visibility_analytics`: share_of_voice (0–1), citation_rate, snapshot_date
- `target_queries`: query_text, query_category, is_active

**Currently shown:**
- SOV% with week-over-week delta
- Citation rate
- 12-week trend chart
- Per-engine breakdown (AIVisibilityHero)
- Competitor mentions
- Category breakdown pie chart
- Gap alerts (Growth+ only)

**Not shown but collected:**
- raw_response text for each query — what exactly did AI say?
- Per-query rank position history over time (is this query improving?)
- cited_sources per evaluation — which source URL did AI cite when mentioning you?
- sentiment_data per evaluation — how positively did AI frame the mention?
- Which specific query category is your weakest (food type / occasion / location)?

---

#### Engine 4 — Reality Score Engine

**What it collects:**
- `visibility_scores`: reality_score, visibility_score, accuracy_score, data_health_score, score_delta per snapshot
- Formula: Visibility×0.4 + Accuracy×0.4 + DataHealth×0.2

**Currently shown:**
- Animated score orb
- Delta from previous scan
- 12-week trend chart
- 3-bar component breakdown (with count-up animation)

**Not shown but collected:**
- Why the score changed: which of the 3 components moved and by how much
- Percentile vs other restaurants in city+category (benchmark data exists)
- "Your best score was X on [date]" milestone
- Attribution: "Fixing 2 errors improved your accuracy component by 18 points"

---

#### Engine 5 — Competitor Intercept Engine

**What it collects:**
- `competitors`: competitor_name, competitor_address
- `competitor_intercepts`: query_asked, winner, winner_reason, winning_factor, gap_analysis {competitor_mentions, your_mentions}, gap_magnitude, suggested_action, action_status

**Currently shown:**
- Intercept cards with winner reason
- Gap analysis (mentions count comparison)
- Suggested action per intercept

**Not shown but collected:**
- action_status field exists but has no UI to update it
- No before/after per competitor gap (did your gap close?)
- No trend: are competitors getting stronger or weaker?
- winning_factor aggregation: what do competitors consistently do better? (hours? reviews? menu completeness?)

---

#### Engine 6 — Voice Search Engine (VAIO)

**What it collects:**
- voice_readiness_score (0–100)
- llms_txt_status: generated/not_generated/stale
- AI crawler audit: GPTBot, PerplexityBot, ClaudeBot, Gemini-Bot status vs robots.txt
- voice_queries: query_text, category, citation_rate, last_run_at
- voice_gaps: category, queries[], weeks_at_zero, suggested_content_type, suggested_query_answer
- VoiceContentScore: direct_answer_score, local_specificity_score, action_language_score, spoken_length_score, issues[]
- Score breakdown: llms_txt (25pts), crawler_access (25pts), voice_citation (30pts), content_quality (20pts)

**Currently shown:**
- Score + 4-bar breakdown
- Mission board with pts_gain and steps
- llms.txt generator
- Crawler audit with per-bot status
- Query drawer for 0% queries with suggested answer and "Use this answer"
- Scan overlay with phase transitions

**Not shown but collected:**
- Voice citation rate trend (is it improving?)
- Which category (discovery/action/comparison/information) is weakest
- Time since llms.txt last refreshed (freshness indicator)
- Content quality score per voice query (not just aggregate)

**Note:** Voice is the most complete loop in the platform. The Mission Board + Query Drawer pattern is the gold standard for how all other engines should work. See §8.

---

#### Engine 7 — Sentiment Engine

**What it collects:**
- From `sov_evaluations.sentiment_data`: label (positive/negative/neutral), score (-1 to +1), tone (enthusiastic/cautious/critical/neutral), key_themes[], confidence per engine per evaluation

**Currently shown:**
- Sentiment interpretation panel
- Per-engine sentiment breakdown with label/tone badges

**Not shown but collected:**
- Sentiment trend over time (is AI's tone about you improving?)
- Which specific key_themes are positive vs negative
- Which engine portrays you most favorably vs harshly
- Sentiment correlation with accuracy score (do more errors = worse sentiment?)

---

#### Engine 8 — Citation Intelligence Engine (Platforms)

**What it collects:**
- `citation_source_intelligence`: platform, citation_frequency, sample_query, sample_size, model_provider, measured_at per category+city
- `listings`: sync_status per platform per org

**Currently shown:**
- Platform coverage score
- Per-platform citation frequency bars
- Gap analysis vs market average

**Not shown but collected:**
- Citation frequency trend (is Yelp citation rate for your category improving or declining?)
- Which platform drives the most AI citations for your cuisine+city combo
- After fixing a listing — did citation frequency improve? (before/after comparison)
- Which AI engine most relies on which platform

---

#### Engine 9 — Entity Health Engine (AI Recognition)

**What it collects:**
- Entity presence: confirmed/missing/incomplete/unknown for Google, Bing, Apple Maps, ChatGPT knowledge, Copilot
- Platform-specific metadata per status

**Currently shown:**
- Entity health verdict panel
- Per-platform status icons (confirmed/missing/incomplete)
- Consequence descriptions per missing platform

**Not shown but collected:**
- Entity completeness as a single score (0–100)
- Fix links per platform (direct URL to claim/verify)
- Entity status history (when did it change?)
- Revenue impact of missing entity on specific platform

---

#### Engine 10 — AI Actions Engine (Agent Readiness)

**What it collects:**
- 6 capability scenarios: booking, ordering, Q&A, directions, contact, hours
- ActionAuditResult: schema.org markup analysis, structured data presence, agent_seo_cache, agent_seo_audited_at

**Currently shown:**
- Verdict panel with overall readiness
- Per-scenario pass/fail cards
- AgentSEO tab with structured data audit

**Not shown but collected:**
- Specific missing structured data fields with copy-paste fix
- Revenue estimate: "Adding a booking link would allow AI to book X tables/week"
- Historical capability improvement (which capabilities were added over time)
- Correlation: does enabling AI booking improve revenue impact score?

---

#### Engine 11 — NAP Sync Engine (Business Info Accuracy)

**What it collects:**
- `nap_sync_events`: platform, discrepancy_type, old_value, new_value, sync_status
- Cross-platform consistency: name/address/phone matching across directories

**Currently shown:**
- Data appears in proof-timeline and integrations pages
- NOT prominently surfaced as a standalone metric

**Not shown but collected:**
- NAP consistency score as a single number — absent from main dashboard entirely
- Which field (name/address/phone) has most discrepancies
- Which platform is the most inconsistent source
- Revenue correlation: NAP inconsistency → AI errors → revenue loss chain

**Critical gap:** NAP inconsistency is the root cause of many hallucinations. A wrong phone number on Yelp propagates into AI responses. This causal chain is never shown.

---

#### Engine 12 — Page Audit Engine (Website Checkup)

**What it collects:**
- `page_audits`: page_url, page_type, overall_score, answer_first_score, schema_completeness_score, faq_schema_present, faq_schema_score, entity_clarity_score, aeo_readability_score, recommendations[]

**Currently shown:**
- Audit score overview
- Per-page audit cards with recommendations
- Schema code blocks

**Not shown but collected:**
- Audit score trend (is the score improving after fixes?)
- Estimated citation rate improvement from fixing each recommendation
- Which page type (homepage/menu/faq) most influences AI citation behavior
- Before/after schema analysis when schema is updated

---

#### Engine 13 — Content / Autopilot Engine

**What it collects:**
- `content_drafts`: trigger_type (occasion/first_mover/prompt_missing/competitor_gap), draft_title, draft_content, target_prompt, content_type, aeo_score, status, human_approved, created_at

**Currently shown:**
- Posts page with filter tabs (draft/approved/rejected/published)
- Occasion timeline
- Draft cards with AEO/readiness score
- Copy and export

**Not shown but collected:**
- After a draft is published, did the targeted query improve? (content → SOV feedback loop)
- Which trigger_type generates the highest-quality content (highest aeo_score)
- Publication rate (approved → published): what % of drafts get used?
- Occasion-to-draft ratio: are we generating content for the right occasions?

---

#### Engine 14 — Menu Distribution Engine

**What it collects:**
- `magic_menus`: extracted_menu, content_hash, last_distributed_at
- `propagation_events`: event_type (gbp_pushed/indexnow_pinged/apple_bc_synced/crawl_detected/live_in_ai), source_platform, detected_at, menu_id
- Distribution engine results per platform

**Currently shown:**
- Menu workspace with item editing
- Distribution status panel (4 sections)
- Crawler activity (top 5 bots)

**Not shown but collected:**
- Time-to-propagate per platform (submitted → verified in AI app)
- Menu change diff (what changed since last distribution)
- Which menu items are most often referenced in AI responses
- Distribution success rate per platform

---

#### Engine 15 — Benchmark Engine

**What it collects:**
- Aggregated visibility_scores per city+category
- org_count, city_avg, top_quartile, percentile rank

**Currently shown:**
- Percentile bar on main dashboard
- Full comparison card on /benchmarks

**Not shown but collected:**
- Benchmark trend (is your percentile rank improving over time?)
- Which score component is furthest below city average
- "Restaurants scoring above you typically have X more menu items in AI responses"
- Correction effectiveness benchmark: industry average time-to-fix

---

#### Engine 16 — Hijacking Detection Engine (Agency)

**What it collects:**
- `hijacking_alerts`: alert_type (competitor_citation/address_mix/attribute_confusion), competitor_name, evidence, severity, status, org_id, location_id

**Currently shown:**
- HijackingAlertsSection on AI Mistakes page (Agency only)

**Not shown but collected:**
- Hijacking frequency trend (is it getting worse?)
- Which competitor hijacks most frequently
- Revenue impact of hijacking events
- Fix verification after hijacking is resolved

---

#### Engine 17 — Source Intelligence Engine

**What it collects:**
- Which platforms (Yelp/Google/TripAdvisor/own website) are cited by AI in responses
- Citation frequency per source category: first_party/review_site/directory/competitor/news/social/blog

**Currently shown:**
- Source health summary panel
- Per-source health badge and citation breakdown

**Not shown but collected:**
- Source citation trend over time
- "Your Yelp is being cited 3× more than your website — here's how to fix that imbalance"
- Competitor source analysis: what sources do competitors use that you don't?

---

#### Engine 18 — Intent Discovery Engine

**What it collects:**
- `intent_discoveries`: query_text, intent_category, confidence_score, action_type, priority_score

**Currently shown:**
- /dashboard/intent-discovery page (NO navigation link in sidebar)
- Effectively orphaned

**Critical gap:** This engine is fully built and producing data. It is not discoverable by any user. The priority_score field enables ranking by impact. This should feed directly into the AI Mentions page as "Questions customers are asking that you're missing."

---

## 4. The Case-Study Loop Framework

Every issue identified by any engine must be capable of completing this 7-step loop:

```
D — Detect:       Engine finds the problem automatically
E — Explain:      Plain English description + dollar impact shown
A — Actionable:   Specific steps shown, not vague advice
F — Fix:          Action executable (in-platform or external with direct link)
V — Verify:       System re-checks after fix to confirm resolution
B — Before/After: Original state vs current state stored and displayed
R — ROI:          Revenue recovered or score improvement quantified
```

### Loop Scorecard by Engine

| Engine | Issue Type | D | E | A | F | V | B | R | Grade |
|---|---|---|---|---|---|---|---|---|---|
| AI Accuracy | "Permanently closed" / wrong hours | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ | ⚠️ | C+ |
| AI Accuracy | Wrong menu items / prices | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ | ⚠️ | C+ |
| AI Accuracy | Wrong address / phone | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ | ⚠️ | C+ |
| Revenue Impact | Monthly loss calculation | ✅ | ✅ | ✅ | ❌ | ⚠️ | ❌ | ✅ | C |
| AI Mentions | Not in AI search results | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ❌ | ⚠️ | C |
| AI Mentions | Specific 0% citation query | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ | ❌ | C- |
| Competitor | Competitor wins query over you | ✅ | ✅ | ⚠️ | ❌ | ⚠️ | ❌ | ⚠️ | D+ |
| Voice Search | AI crawlers blocked | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | B |
| Voice Search | llms.txt not generated | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | B |
| Voice Search | Voice query 0% answered | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | B |
| Platforms | Missing from Yelp/TripAdvisor citations | ✅ | ✅ | ⚠️ | ❌ | ✅ | ❌ | ❌ | D |
| AI Recognition | Google/Apple/Bing don't know you | ✅ | ✅ | ⚠️ | ❌ | ✅ | ❌ | ❌ | D |
| AI Actions | AI can't book a table | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ❌ | ❌ | D+ |
| Website Checkup | Missing FAQ schema | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | D+ |
| Business Info (NAP) | Wrong address across directories | ✅ | ⚠️ | ⚠️ | ❌ | ⚠️ | ❌ | ❌ | D- |
| Menu Distribution | Menu not in AI apps | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | B- |
| Content | No content for AI to learn from | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | C |
| Hijacking | Competitor info mixed with yours | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | C- |
| Intent Discovery | Missing query types | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | D (orphaned) |

Legend: ✅ Fully implemented · ⚠️ Partially / indirect · ❌ Missing

---

## 5. Per-Engine Loop Assessment

### 5.1 AI Accuracy Engine — Detailed Gap Analysis

**The Fix Workflow Gap:**

The correction button submits a correction query and sets status to "corrected." But the fix action itself sends the owner off-platform with no specific guidance. The guidance needs to be category-specific:

| Category | Specific Fix Steps | External Link | Typical Fix Time |
|---|---|---|---|
| `hours` | 1. Update Google Business Profile hours. 2. Update Yelp hours. 3. These propagate to ChatGPT/Perplexity in 7–21 days. | GBP → `business.google.com` | 7–14 days |
| `closed` (permanent) | 1. Verify "Permanently Open" in GBP. 2. Post a GBP update confirming you're open. 3. Add recent photos to establish activity. | GBP → `business.google.com/attributes` | 3–7 days |
| `address` | 1. Update GBP address. 2. Correct on Yelp, TripAdvisor, Bing. 3. Submit correction to Apple Business Connect. | Multiple links per platform | 14–21 days |
| `phone` | 1. Update in GBP. 2. Update in Yelp. 3. Check your own website. | Multiple | 7–14 days |
| `menu` | 1. Update GBP food menus. 2. Distribute via LocalVector Menu. 3. Update price on Yelp menu. | GBP Food Menus | 3–14 days |
| `cuisine` | 1. Update primary category in GBP. 2. Verify on Yelp categories. | GBP category editor | 14–21 days |

**The Before/After Gap:**

`claim_text` = what AI was saying wrong (stored)
`expected_truth` = what the correct answer is (stored)
No `fixed_at` column → time-to-fix cannot be computed
No display format showing these side by side in the Resolved column

**Required schema addition:**
```sql
ALTER TABLE ai_hallucinations
  ADD COLUMN fixed_at timestamptz,
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN revenue_recovered_monthly numeric(10,2);
```

`revenue_recovered_monthly` = the revenue impact that was computed when the error was open, preserved at fix time so the "recovered" counter always reflects what was recovered, not a recomputed estimate.

---

### 5.2 Revenue Impact Engine — Detailed Gap Analysis

**The Recovery Tracking Gap:**

`revenue_snapshots` has 12 months of data. Month 1 leak = $2,400. Month 6 leak = $800. The difference ($1,600/mo recovered) is never computed or displayed. This is the single most powerful retention metric available and it's sitting unused in the database.

**Required computation:**
```typescript
interface RecoveryMetrics {
  recoveredMonthly: number;        // first_snapshot.leak_high - current_snapshot.leak_high
  recoveredSinceJoined: number;    // (first_snapshot.leak_high - current) × months
  recoveryVelocity: number;        // avg monthly improvement
  projectedFullRecovery: Date;     // extrapolated
}
```

**The Benchmark Gap:**

An owner seeing "-$1,200/mo" has no context. Is that typical? Terrible? Great?
`visibility_scores` aggregated by city+category enables: "Restaurants in your city and category lose an average of $890/mo to AI errors. You're at $1,200 — $310 above average. Here's why."

---

### 5.3 AI Mentions Engine — Detailed Gap Analysis

**The Per-Query Feedback Loop:**

When a content draft is created from a gap alert (trigger_type='prompt_missing', trigger_id=query_id), and the draft is approved and published, the system should automatically re-evaluate that specific query on the next SOV scan and report: "Your citation rate for 'best hookah near Alpharetta' went from 0% to 40% after publishing this content."

This requires linking: `content_drafts.trigger_id` → `target_queries.id` → `sov_evaluations.rank_position` over time.

**The Raw Response Gap:**

`sov_evaluations.raw_response` contains the full text of what AI said. This is shown in the VAIO QueryDrawer but not on the AI Mentions page. Showing the actual AI response for low-performing queries would immediately communicate to owners why they're not being cited.

---

### 5.4 Competitor Engine — Detailed Gap Analysis

**The Action Completion Gap:**

`competitor_intercepts.action_status` and `suggested_action` are populated by the AI analysis. But there is no UI element to:
1. Mark an action as completed
2. Schedule a re-run for that specific competitor+query
3. Show the before/after gap change

The competitor page needs an "I did this" button per intercept that triggers a targeted re-evaluation and shows the result.

**The Vulnerability Window Gap:**

When a competitor has open AI errors (detectable if they're a tracked competitor), the owner has a strategic window to capture their customers. This is a unique intelligence capability that no tool offers. See §13 for the full specification.

---

### 5.5 Voice Search Engine — Best Practice Reference

The Voice Search (VAIO) engine has the most complete loop in the platform. It serves as the reference implementation for all other engines:

1. **Detect:** VAIO cron runs weekly, detects voice_gaps with weeks_at_zero count
2. **Explain:** Plain-English mission titles with specific pts_gain
3. **Guide:** MissionStep[] with exact numbered steps
4. **Fix:** llms.txt generator in-platform, "Use this answer" copies llms.txt Q&A format
5. **Verify:** VAIO re-runs after each scan, citation_rate tracked per query
6. **Before/After:** Score breakdown shows component points, mission transitions open→done
7. **ROI:** Points gained shown per mission (not yet in $ — gap to close)

**What VAIO still needs:**
- Revenue dollar equivalent for voice score improvement
- Voice citation rate trend chart per query category
- "Before: 0 voice queries answered → After: 8 answered" comparison panel

---

## 6. Critical Gaps

### Gap 1 — Revenue Recovered Is Never Shown

**Data available:** `revenue_snapshots` (12 months), `ai_hallucinations.correction_status`, per-severity revenue multipliers
**Missing:** When a hallucination moves from `open` → `fixed`, the monthly revenue impact is never transferred to "recovered." The owner cannot see what they got back.
**Impact:** This is the single most important retention driver. Owners who can see "you've recovered $1,400/mo since subscribing" don't churn.

### Gap 2 — No `fixed_at` Timestamp

**Data available:** `first_detected_at`, `correction_status` transitions
**Missing:** `fixed_at` and `verified_at` columns — time-to-fix and time-to-verify are uncomputable
**Impact:** The "24 hours" promise on the landing page cannot be validated or shown in-product

### Gap 3 — Before/After State Is Stored But Never Compared

**Data available:** `claim_text` (what AI was saying wrong), `expected_truth` (correct answer), both stored per hallucination
**Missing:** Side-by-side display in the Resolved swimlane
**Impact:** Every fixed issue is a mini case study. Currently the data is thrown away visually.

### Gap 4 — Fix Workflow Sends Owners Off-Platform Without Guidance

**Most impactful issue types that need external action:**
- Entity health (missing from Apple Maps) — no link to Apple Business Connect
- Citation platforms (not on TripAdvisor) — no link to claim listing
- AI Actions (missing booking schema) — no link to schema implementation guide
- NAP discrepancy — no direct links to each platform's edit page

### Gap 5 — Intent Discovery Is Orphaned

The `intent_discoveries` table is fully populated by the intent-discovery cron. The `/dashboard/intent-discovery` page exists. There is no navigation link to it. This engine produces priority_score-ranked queries that customers are asking but you're not answering — which directly feeds content creation and SOV improvement. It should surface on the AI Mentions page.

### Gap 6 — NAP Score Absent from Main Dashboard

Business info consistency across directories is the root cause of many AI hallucinations. A wrong phone number on Yelp becomes a wrong phone number in AI responses. This causal chain is never visualized. The NAP consistency score should appear as a KPI chip on the main dashboard.

### Gap 7 — Content Has No Feedback Loop

A content draft is created because query X has 0% citation rate. The draft is approved. The draft is published. The next SOV scan runs. Did the citation rate for query X improve? The system never makes this connection. Content creation feels disconnected from AI visibility improvement.

### Gap 8 — Score Change Has No Explanation

When the Reality Score changes week over week, the owner sees a number change but never why. `visibility_score`, `accuracy_score`, and `data_health_score` are all stored per snapshot, making component-level attribution computable but never computed.

---

## 7. The Before/After Architecture

### 7.1 The Wins Feed

Every resolved issue should produce a structured "Win" record that serves as the in-product case study generator.

**Schema:**
```typescript
interface Win {
  id: string;
  org_id: string;
  location_id: string;
  win_type: 'hallucination_fixed' | 'sov_improved' | 'competitor_gap_closed' |
            'voice_query_answered' | 'menu_distributed' | 'entity_confirmed';
  occurred_at: string;           // when the win was recorded

  // Before state
  before_value: string;          // "AI said you were permanently closed"
  before_metric: number | null;  // -4000 (revenue impact)

  // After state
  after_value: string;           // "AI now says Open, Serving Dinner"
  after_metric: number | null;   // +4000 (recovered)

  // Time metrics
  detected_at: string;           // when the problem was first found
  fixed_at: string;              // when the fix was submitted
  verified_at: string | null;    // when the fix was confirmed
  days_to_detect: number;        // detected_at - org.created_at (days the problem existed before LocalVector)
  days_to_fix: number;           // fixed_at - detected_at

  // Attribution
  revenue_recovered_monthly: number | null;
  score_improvement: number | null;

  // Shareable
  is_shareable: boolean;
  share_token: string | null;
}
```

**Display:** The main dashboard should show the 3 most recent wins as a "Recent Wins" section, replacing the current static "Your dashboard is ready" empty state. Each win card shows:
- What was wrong (before)
- What it is now (after)
- How much was recovered
- How long it took

### 7.2 The Monthly AI Health Report

Once per month, generate a structured report per org:

```
Your AI Health Report — January 2026
Charcoal N Chill | Alpharetta, GA

WINS THIS MONTH
  3 AI errors fixed
  Revenue recovered: +$480/mo
  AI mentions improved: +12% (was 23%, now 35%)
  Voice search score: +15 pts

STILL OUTSTANDING
  2 open AI errors ($340/mo potential recovery)
  1 platform citation gap (Yelp frequency below city average)

YEAR-TO-DATE
  Total revenue recovered: $2,160
  Errors caught before they cost you: 11
  Avg detection time: 6 days (industry: found by accident in 3+ months)
```

This report is:
1. The most compelling retention tool available
2. Shareable with business partners, investors, accountants
3. The raw material for real case studies on the landing page
4. Generated entirely from data already in the database

---

## 8. Priority Implementation Roadmap

### Tier 1 — Close the Loop (Highest Impact, Lowest Effort)

These do not require new data collection. The data exists. The UI is missing.

**T1-1: Add `fixed_at` and `verified_at` to `ai_hallucinations`**
```sql
-- Migration: 20260307000001_hallucination_fix_timestamps.sql
ALTER TABLE ai_hallucinations
  ADD COLUMN fixed_at timestamptz,
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN revenue_recovered_monthly numeric(10,2);
```
- Set `fixed_at` when correction_status transitions to 'corrected'
- Set `verified_at` when follow_up_result = 'fixed'
- Set `revenue_recovered_monthly` at fix time (snapshot the revenue impact from the open state)
- Test: correction flow sets all three timestamps correctly

**T1-2: Before/After Panel in Resolved Swimlane**
- Modify `TriageSwimlane` (resolved column) to render `BeforeAfterCard` instead of `AlertCard`
- `BeforeAfterCard` shows: claim_text (before) | expected_truth (after) | days_to_fix | revenue_recovered_monthly
- Data already available on every fixed hallucination
- Test: resolved hallucinations render before/after comparison

**T1-3: Category-Specific Fix Guidance**
- Add lookup table: `lib/hallucinations/fix-guidance.ts` keyed by `category`
- Each entry: specific numbered steps + external platform links + estimated fix time
- Render in `AlertCard` below the description for open/verifying alerts
- Test: every known category has guidance, guidance renders correctly

**T1-4: Revenue Recovered Counter**
- Add `getRevenueRecovered()` server action: sum `revenue_recovered_monthly` for all fixed hallucinations
- Display on Lost Sales page alongside current loss
- Display on main dashboard hero as a green counter
- Test: counter updates when hallucination moves to fixed

**T1-5: Score Change Attribution**
- On `PulseScoreOrb`: when score delta ≠ 0, show attribution popover
- Compute: diff `accuracy_score`, `visibility_score`, `data_health_score` between last two snapshots
- Format: "Accuracy fell 15pts (2 new errors found). Visibility up 3pts."
- Test: attribution matches actual snapshot delta calculations

**T1-6: Direct External Links on Entity Health and Citations pages**
- Add `external_fix_url` to `PLATFORM_DESCRIPTIONS` lookup
- For each missing entity, show "Claim on [Platform] →" button
- For each citation gap, show "Get listed on [Platform] →" button
- Test: every platform key has a valid external URL

**T1-7: Surface Intent Discovery in AI Mentions page**
- Add "Questions You're Missing" section to `/dashboard/share-of-voice`
- Query `intent_discoveries` ordered by `priority_score` DESC, limit 5
- For each: show query_text, intent_category, priority_score, link to create content draft
- Test: section renders when intent_discoveries exist

---

### Tier 2 — Complete the Feedback Loops (Medium Effort, High Impact)

**T2-1: Content → SOV Feedback Loop**
- When `content_drafts` status = 'published' and trigger_type = 'prompt_missing':
  - Link `trigger_id` → `target_queries.id`
  - After next SOV scan: compare `rank_position` before and after publish date
  - Display on draft detail page: "This post improved your citation rate for '[query]' from 0% to X%"
- Schema: add `published_at` to `content_drafts`, add `pre_publish_rank` and `post_publish_rank` to `content_drafts`

**T2-2: NAP Score on Main Dashboard**
- Add NAP consistency computation: count of platforms with matching name/address/phone ÷ total platforms
- Display as 4th KPI chip on `WeeklyKPIChips`
- Link to integrations page on click
- Rename all NAP references to "Business Info Accuracy" in UI

**T2-3: Competitor Action Completion**
- Add "I did this" button to `InterceptCard`
- On click: update `action_status` = 'completed', record completed_at
- Schedule targeted re-run for that competitor+query on next cron cycle
- Show before/after mentions count after re-run completes

**T2-4: Wins Feed on Main Dashboard**
- Create `wins` table (schema in §7.1)
- Populate from: hallucination fixed events, SOV improvements >10%, competitor gap closures
- Render "Recent Wins" section on main dashboard (max 3, "See all →" link)
- Each win card: before/after values, revenue impact, time-to-fix badge

**T2-5: Sentiment Trend**
- Add trend chart to Your Reputation page: sentiment score over last 12 weeks
- Data source: `sov_evaluations.sentiment_data` averaged per week
- Annotate drops with "new error detected" markers

---

### Tier 3 — Strategic Differentiation (Higher Effort, Unique Value)

**T3-1: AI Accuracy Degradation Alerts**
See §13.2 for full specification.

**T3-2: Competitor Vulnerability Window**
See §13.3 for full specification.

**T3-3: Revenue Per AI Mention**
See §13.4 for full specification.

**T3-4: Day-of-Week Urgency Engine**
See §13.5 for full specification.

**T3-5: Monthly AI Health Report PDF**
See §7.2 for full specification.

---

## 9. Visualization Standards

### 9.1 Chart Selection Principles

Every chart must answer a specific question a restaurant owner would actually ask. If the chart does not answer a real question, it does not belong.

| Question | Chart Type | Current | Better |
|---|---|---|---|
| How often do AI apps recommend me? | Line chart | SOV Trend (12wk) | ✅ Keep, add annotation on score-change weeks |
| Which AI app is most accurate about me? | Bar chart | Horizontal accuracy bars | Radar/spider across 5 engines — instantly shows weakest AI |
| Where is my revenue going? | Breakdown | 3 bars | Waterfall: potential → minus hallucinations → minus SOV gap → minus competitors → actual |
| Is my AI health improving? | Line chart | Reality Score trend | Stacked area: 3 components stacked, shows which drove change |
| How do I compare locally? | Percentile bar | Percentile bar | Dot plot: 50 grey dots (similar restaurants) + 1 colored dot (you) |
| Which platform citations drive AI? | Grouped bars | Platform frequency bars | Heat map: platform × AI engine — which platform does ChatGPT vs Perplexity use most? |
| Is my competitor gap closing? | None currently | Missing | Side-by-side animated bar: your mentions vs competitor mentions, updates weekly |
| Did my content fix improve anything? | None currently | Missing | Before/after citation rate bar per query |

### 9.2 Number Animations

All key metrics should count up from previous value to current on page load using `requestAnimationFrame` with `easeOutCubic`. This pattern is already implemented on the VAIO score and Reality Score orb — apply consistently:
- Main dashboard KPI chips
- Revenue numbers on Lost Sales page
- All metric cards

When `prefers-reduced-motion` is active, skip animation and show final value immediately.

### 9.3 The Before/After Card Pattern

Standard component for any resolved issue across all engines:

```
┌─────────────────────────────────────────────────────┐
│  [BEFORE]                    [AFTER]                 │
│  "Permanently Closed"   →    "Open, Serving Dinner"  │
│                                                      │
│  Revenue impact: -$180/mo   Recovered: +$180/mo      │
│  Detected: Dec 3             Fixed: Dec 7 (4 days)   │
│  Via: ChatGPT                Verified: Dec 21         │
└─────────────────────────────────────────────────────┘
```

This component should be reusable across: AI Mistakes resolved column, Wins Feed, Monthly Report.

### 9.4 Score Change Attribution Tooltip

When Reality Score changes, the score orb should show a popover on hover/click:

```
Your score changed from 61 → 73 (+12 pts)

  Accuracy component:   +18 pts  (2 errors fixed)
  Visibility component: -3 pts   (SOV dipped slightly)
  Data health:          +3 pts   (menu redistributed)
```

---

## 10. Gamification Framework

Gamification must serve the restaurant owner's business goals, not engagement for its own sake. Every mechanic must directly relate to their AI visibility or revenue.

### 10.1 Health Streak

**Mechanic:** Count consecutive weeks where:
- No new critical/high AI errors detected, OR
- All new errors were fixed within 7 days

**Display:** Flame icon with count on main dashboard. "4-week clean streak"
**Data:** `visibility_scores` snapshots — `accuracy_score ≥ 85` indicates a clean week
**Reset condition:** New critical error that remains open > 7 days
**Effort:** Low — data exists, pure frontend

### 10.2 Score Milestones

**Mechanic:** When Reality Score crosses 50, 60, 70, 80, 90:
- Full-screen confetti overlay for 3 seconds (respects prefers-reduced-motion)
- Milestone card rendered on dashboard for the week
- Optional: shareable "My restaurant just hit 80/100 AI Health Score" image

**Data:** `visibility_scores.reality_score` — compare current to previous
**Effort:** Low — trigger on dashboard load when score_delta crosses threshold

### 10.3 "Fix of the Week" Spotlight

**Mechanic:** When an error moves to "fixed" and `revenue_recovered_monthly > $100`:
- Dashboard shows a green spotlight card for 7 days
- "You recovered $180/mo this week by correcting your hours on ChatGPT"
- Dismissible

**Effort:** Low — query fixed hallucinations where `fixed_at > now()-7days` and revenue_recovered_monthly is set

### 10.4 Publishing Streak (Content Engine)

**Mechanic:** Count consecutive weeks where at least 1 content draft was approved + used
**Display:** On Posts page, small streak counter
**Why it matters:** Consistent content publication is the primary driver of long-term SOV improvement

### 10.5 "You Beat [Competitor]" Alert

**Mechanic:** When your AI mention rate for a query type surpasses a tracked competitor's:
- Toast notification: "Your mention rate for Friday dinner searches just passed [Competitor]"
- Logged as a Win in the Wins Feed

**Data:** `sov_evaluations.mentioned_competitors` vs `target_queries` citation rates
**Effort:** Medium — requires per-query competitive comparison logic

### 10.6 What NOT to Build

The following gamification ideas were considered and rejected:

- **XP / leveling system:** Requires new data model. Adds abstraction layer. Restaurant owners think in dollars, not XP.
- **Leaderboard vs other restaurants:** Privacy concern (other orgs see your score). Benchmark data gives context without exposure.
- **Achievement badges:** Decorative. Does not connect to business outcomes. Skip until product is feature-complete.

---

## 11. Language & UX Standards

### 11.1 Jargon Audit — Required Replacements

| Current Label | Required Replacement | Status |
|---|---|---|
| Share of Voice | AI Mentions | ✅ Done |
| Hallucinations | AI Mistakes | ✅ Done |
| Citation Intelligence | Platforms | ✅ Done |
| Entity Health | AI Recognition | ✅ Done |
| Agent Readiness | AI Actions | ✅ Done |
| Reality Score | AI Health Score | ✅ Done (display) |
| Revenue Impact | Lost Sales | ✅ Done |
| VAIO | Voice Search | ✅ Done (sidebar) |
| AEO Score | Post Quality Score | ❌ Required |
| llms.txt | AI Instruction File | ❌ Required (with tooltip: "A file that tells AI apps what's true about your business") |
| schema markup / JSON-LD | How AI reads your website | ❌ Required |
| propagation events | Menu updates spreading to AI apps | ❌ Required |
| Competitor Intercept (page subtitle) | Where competitors outrank you | ❌ Required |
| Intent Discovery | Questions customers ask that you're not answering | ❌ Required |
| crawler analytics | AI Bot Visits | ❌ Required |
| NAP Sync | Business Info Accuracy | ❌ Required |
| citation_rate | How often AI cites you | ❌ Required (tooltip) |
| share_of_voice | Your mention rate | ❌ Required (tooltip) |

### 11.2 The Restaurant Owner Test

Before any label, chart title, or description is shipped, apply this test:

> "Would a restaurant owner with no tech background understand this in 3 seconds?"

If no: rewrite it. The question to ask when rewriting: "What is this owner trying to accomplish? What would they call this problem in their own words?"

Examples:
- "Schema completeness score" → "How well your website explains your business to AI"
- "Entity authority score" → "How much AI trusts your business information"
- "Hallucination severity: critical" → "This is costing you money right now"

### 11.3 Dollar-First Communication

Wherever possible, lead with dollars not percentages or scores.

| Weak | Strong |
|---|---|
| "Your SOV is 23%" | "AI recommends you 23% of the time — up from 18% last week" |
| "3 open alerts" | "3 AI errors costing you ~$340/mo" |
| "Citation rate: 40%" | "4 of 10 AI searches mention you" |
| "Accuracy score: 71" | "ChatGPT has 2 wrong facts about your business" |

### 11.4 Empty States

Empty states must never be dead ends. Each one must point to the specific action that fills it.

| Empty State | Current | Required |
|---|---|---|
| No hallucinations found | "No issues" | "No AI errors found — your next automated scan runs [date]" + manual scan trigger |
| No SOV data | "No data yet" | "Your first AI mention scan runs Sunday [date]. Here's what we'll check:" + query list preview |
| No competitors | "Add competitors" | "Who are your top 3 local competitors? We'll track whether AI picks them over you." |
| No content drafts | "No drafts" | "You have X unanswered questions customers ask AI. Create your first answer:" |
| No wins yet | — | "Your first win will appear here when an AI error is fixed or your citation rate improves." |

---

## 12. Navigation Architecture

### 12.1 Current State Assessment

The current sidebar lists ~22 items in a roughly alphabetical order grouped as: Overview / How AI Sees You / Content / Insights / Admin. The Insights group buries 8+ pages that a restaurant owner visits rarely.

**Primary problem:** The navigation is organized around features (engines) not outcomes (what the owner wants to accomplish).

### 12.2 Outcome-Based Navigation Proposal

```
TODAY (daily check — 30 seconds)
  Dashboard           ← Score, active errors, this week's wins
  AI Mistakes         ← Fix errors → direct revenue recovery
  Lost Sales          ← See the dollar impact

THIS WEEK (weekly work — 10 minutes)
  AI Mentions         ← How often AI recommends you + gap queries
  Competitors         ← Where you're losing (Growth+)
  Voice Search        ← Siri/Alexa/voice AI readiness (Growth+)
  Menu                ← What AI knows about your food

THIS MONTH (strategic — 30 minutes)
  Posts               ← Content AI can learn from
  Calendar            ← Upcoming occasions for content
  Platforms           ← Are your listings feeding AI correctly?
  AI Recognition      ← Do Google/Apple/Bing know you exist?
  Local Comparison    ← How you rank vs similar restaurants

ADVANCED (rarely visited — collapse by default)
  AI Actions          ← Can AI book for you? (Growth+)
  Website Checkup     ← AI-readability of your web pages (Growth+)
  AI Says             ← Raw AI responses about you
  AI Assistant        ← Ask questions about your AI presence
  Listings            ← Platform connection status
  Business Info       ← Name/Address/Phone accuracy
  Update Tracking     ← Menu distribution timeline
  AI Bot Visits       ← Which AI bots visit your site
  Your Sources        ← What platforms AI reads about you
  Your Position       ← Competitive positioning map
  Playbooks           ← AI-generated action plans
```

### 12.3 Navigation Badge Rules

The current badge system (unseen section indicator) should be extended:
- Red badge: critical error detected since last visit
- Amber badge: improvement opportunity identified
- Green badge: win achieved since last visit

---

## 13. Out-of-the-Box Differentiators

These are features that do not exist in any competitor's product. Each one exploits data that LocalVector uniquely collects.

### 13.1 AI Response Freshness Decay Tracking

**What it is:** AI models cache responses. When you fix an error (e.g., wrong hours), different AI models "forget" the wrong information at different rates. GPT-4o might update in 7 days while Perplexity updates in 3 days and Gemini takes 21 days.

**Why it's unique:** We are querying all 5 engines every week. We have enough data to build the industry's first empirical database of AI model update latency by error type and model.

**What it enables:**
- "Based on 847 corrections across LocalVector users, ChatGPT typically corrects hours errors in 12 days. Perplexity takes 6 days. Gemini takes 18 days."
- Set accurate expectations: "Your correction was submitted 8 days ago. ChatGPT usually updates by day 12. Check back in 4 days."
- This data is a publishable research asset.

**Implementation:** Aggregate `ai_hallucinations` where correction_status transitions from 'corrected' → 'fixed', compute days between `fixed_at` and `verified_at` by `model_provider` and `category`. Build into correction_verifier reporting.

---

### 13.2 AI Accuracy Degradation Alerts

**What it is:** AI models periodically update their training data. When a major model update happens, accuracy scores for restaurants can spike or drop dramatically — not because the restaurant changed anything, but because the AI did.

**Why it's unique:** We track accuracy scores weekly per model. We can detect when a model update causes a batch of new errors across multiple customers simultaneously — and correlate it with known model update dates.

**What it enables:**
- "ChatGPT appears to have updated its knowledge base. 23% of our restaurant customers saw new errors appear this week. Yours included."
- Proactive alert before the owner even logs in
- Distinguishes "you caused this" (needs fixing) from "AI updated and got it wrong again" (needs re-correction)

**Implementation:** Cron: every Monday, compare this week's open_alert_count to 4-week rolling average per org. If delta > 2σ, flag as potential model-update event. Cross-reference against industry-wide spike detection. Alert in TopBar.

---

### 13.3 Competitor Vulnerability Window

**What it is:** When a tracked competitor has open AI errors that LocalVector detects (possible via the competitor intercept analysis), the restaurant owner has a strategic window to capture the competitor's customers with targeted content.

**Why it's unique:** No tool tells you when your competitor is currently being misrepresented by AI. We can infer this from competitor_intercepts where the competitor's winning_reason is verifiably incorrect, or from sov_evaluations where competitor mentions pair with negative context.

**What it enables:**
- "McDonald's on Main St currently has 2 AI accuracy issues — Perplexity is showing wrong hours. Run a targeted post now to capture Friday dinner searches while their AI reputation is down."
- Opportunity window with estimated duration: "This window typically closes in 14 days when they fix it."

**Implementation:** In competitor_intercept pipeline, when a competitor is mentioned with contextual signals of an accuracy issue (hours inconsistency, closed flag), generate a `competitor_vulnerability_alert` with strategic content suggestion. Plan gate: Agency only.

---

### 13.4 Revenue Per AI Mention

**What it is:** Calculate the actual dollar value of a single AI mention for a specific restaurant, based on their revenue configuration and measured conversion rates.

**Formula:**
```
revenue_per_mention = avg_ticket × local_conversion_rate × (1 - walk_away_rate)
```

Using default config: $55 × 0.03 × 0.35 = **$0.58 per mention**

With monthly_searches of 2,000 and SOV at 23%: 460 mentions × $0.58 = **$267/mo from AI mentions**

**Why it's unique:** Every other SOV metric is abstract (%). This converts it to dollars that restaurant owners already understand.

**What it enables:**
- "Your citation rate improved from 18% to 23% this week. That's worth an additional $47/mo."
- "Each of the 5 gap queries we identified represents approximately $14/mo in recoverable revenue if you get cited."
- Every % point of SOV has a dollar value, making the ROI of every fix visible.

**Implementation:** Extend `RevenueConfig` to compute `revenue_per_mention`. Expose in `fetchRevenueImpact()`. Display on AI Mentions page as a contextual callout: "Each additional AI mention is worth ~$X to your business."

---

### 13.5 Day-of-Week Urgency Engine

**What it is:** Restaurant revenue is not uniform across the week. Friday and Saturday nights represent 35–45% of weekly revenue for most full-service restaurants. An AI error detected on Wednesday needs to be treated differently than one detected on Monday — the Friday deadline makes it urgent.

**What it enables:**
- "URGENT: ChatGPT is showing wrong Friday hours. Friday is your highest-revenue night. Fix this before 6pm Thursday."
- Critical errors detected Tuesday–Thursday get a "Fix before weekend" badge
- Lower-priority errors (medium/low severity, Tuesday detection) get normal treatment

**Implementation:** In `AlertCard` rendering, if `severity = 'critical' | 'high'` and `new Date().getDay() in [2,3,4]` (Tue/Wed/Thu), add urgency badge: "Fix before weekend — {Friday revenue estimate} at stake." Revenue estimate = `avg_ticket × monthly_covers / 4 × 0.4` (40% of weekly in Friday+Saturday).

---

### 13.6 AI Shopper — Full Conversation Simulation

**What it is:** Instead of just tracking whether a restaurant is mentioned in a single query, simulate a complete multi-turn customer conversation and capture what AI says throughout.

**The scenario:**
```
Turn 1: "What's a good hookah lounge near Alpharetta?"
Turn 2: "Is Charcoal N Chill good? What are their hours Friday?"
Turn 3: "Can I make a reservation for 8 people?"
Turn 4: "What should I order?"
```

**Why it's unique:** Current SOV engines only test single queries. Real customers have multi-turn conversations. A business might get mentioned in turn 1 but lose the customer in turn 2 when AI gives wrong hours. This is the actual moment of failure that current monitoring misses.

**What it enables:**
- "AI recommends you in turn 1, but gives wrong Friday hours in turn 2. You're losing customers at the reservation step."
- Maps the exact conversation point where you lose customers
- Reveals which specific information failures are most costly (not just "an error exists" but "this error ends the customer journey")

**Implementation:** New cron `app/api/cron/ai-shopper/route.ts`. Per location, run a 4-turn conversation with OpenAI (using conversation history). Score each turn for accuracy. Store in new `ai_shopper_runs` table. Weekly cadence. Plan gate: Growth+.

---

### 13.7 Correction Effectiveness Database (Proprietary Benchmark)

**What it is:** Aggregate anonymized data across all LocalVector customers to build the industry's first empirical database of AI correction effectiveness.

**Data collected (already):**
- Error category (hours/address/phone/menu/status)
- AI model (ChatGPT/Perplexity/Google/Gemini/Copilot)
- Days to fix (`fixed_at - first_detected_at`)
- Days to verify (`verified_at - fixed_at`)
- Whether it recurred (`follow_up_result = 'recurring'`)

**Why it's unique:** No one has this data. After 6 months and 50+ customers, LocalVector will have the most comprehensive empirical dataset on AI accuracy correction timing in existence.

**What it enables:**
- Accurate time estimates per fix: "Correcting hours on ChatGPT takes 11 days on average. Yelp-sourced errors take 19 days."
- Benchmark comparisons: "Your correction verified in 8 days — faster than 73% of corrections we've tracked"
- Publishable research: "The AI Accuracy Report 2026" — marketing flywheel
- Better product promises on the landing page (backed by real data)

**Implementation:** `lib/analytics/correction-benchmark.ts` — aggregate `ai_hallucinations` where `verified_at IS NOT NULL`. Start computing when sample size ≥ 30 corrections. Display in admin panel initially, surface to customers when data is meaningful.

---

### 13.8 Menu Intelligence — AI Demand Signals

**What it is:** Cross-reference which menu items appear in AI query logs (`sov_evaluations.raw_response` containing item names) with the actual menu items in `magic_menus`.

**What it enables:**
- "Your Lamb Chops are mentioned in 8 AI searches per week. Your Salmon is mentioned in 2."
- "Customers ask AI about 'vegetarian options' — you have 4, but they're not prominently described in your menu."
- "Your most AI-searched item is $24. Your highest-margin item is $32 — here's how to make AI recommend the higher-margin option."
- Pricing intelligence: if AI consistently describes a dish at an outdated price, flag for correction

**Implementation:** Text search `sov_evaluations.raw_response` for menu item names from `magic_menus.extracted_menu`. Count occurrences. Sort by frequency. Display in Menu workspace as "AI Search Demand" column per menu item.

---

### 13.9 Cross-Platform Consistency Score

**What it is:** A single 0–100 score representing how consistent your business information is across all AI-relevant platforms. Currently this data is scattered across entity health, NAP sync, citations, and listings.

**Formula:**
```
consistency_score =
  (platforms_with_correct_name / total_platforms) × 30 +
  (platforms_with_correct_address / total_platforms) × 25 +
  (platforms_with_correct_phone / total_platforms) × 20 +
  (platforms_with_correct_hours / total_platforms) × 15 +
  (platforms_with_menu_data / relevant_platforms) × 10
```

**Why it's unique:** Gives a single actionable number for a complex multi-platform problem. Competitors either ignore this or show raw data per platform with no composite view.

**What it enables:**
- Main dashboard KPI: "Consistency: 74/100"
- "Improving your consistency score from 74 to 85 typically reduces AI errors by 40%"
- Before/after: "Was 62 when you joined. Now 74 after fixing Yelp and Bing."

**Implementation:** `lib/services/consistency-score.service.ts`. Inputs: `listings.sync_status`, `nap_sync_events`, `entity_health` result. Compute weekly. Store in new `consistency_scores` table or add to `visibility_scores`.

---

### 13.10 "First 24 Hours" Dashboard Experience

**What it is:** A completely different first-session experience for new customers, designed around the case study promise.

**The concept:**
- When a restaurant first connects their location, LocalVector immediately runs a live scan
- The scan takes 2–3 minutes and shows real-time progress
- At the end: their personal version of the case study card — "BEFORE LocalVector, this is what AI was saying about you"
- The very first dashboard visit is a reveal, not an empty state

**What it shows:**
- "ChatGPT calls you [wrong hours/wrong status/wrong something]"
- "You're mentioned in X of 10 AI searches"
- "Estimated monthly impact: $X"
- "Here are your 3 most important fixes"

**Why it's powerful:** The moment of revelation — "I didn't know AI was saying that about me" — is the emotional hook that drives conversion and retention. Currently this moment is buried in an empty dashboard that fills in "after your first automated scan runs Sunday."

**Implementation:** Extend existing `ScanOverlay.tsx` live scan experience into the onboarding flow. Run scan immediately on first location creation. Show `FirstScanRevealCard` with the before/after frame already populated. This is the product's first impression and it should be unforgettable.

---

## 14. Success Metrics

### 14.1 Product Health Metrics (Internal)

These measure whether the loop is actually closing:

| Metric | How to Compute | Target |
|---|---|---|
| Loop Completion Rate | (hallucinations reaching 'fixed') / (hallucinations detected) per 30 days | > 60% |
| Time to First Fix | `fixed_at - first_detected_at` median | < 14 days |
| Time to Verify | `verified_at - fixed_at` median | < 21 days |
| Recurrence Rate | count where `follow_up_result = 'recurring'` / total verified | < 15% |
| Revenue Recovery Rate | sum(revenue_recovered_monthly) / sum(original_leak_high) | > 40% |
| Content Feedback Rate | content_drafts with measurable SOV improvement / total published | > 25% |

### 14.2 Customer Value Metrics (External)

These are what restaurant owners care about:

| Metric | Restaurant Owner Language | Target |
|---|---|---|
| Errors caught per month | "AI mistakes caught before they cost you" | > 2 per org |
| Revenue protected per month | "Money saved from AI errors" | > $200/mo |
| Revenue recovered per month | "Money you got back by fixing AI errors" | > $150/mo |
| Scan-to-detection latency | "How fast we found the problem" | < 7 days |
| AI mention rate trend | "Getting recommended more often" | +2% MoM for active users |
| Score improvement | "AI Health Score over time" | +5pts per quarter |

### 14.3 Retention Indicators

The following data points correlate with churn risk and should trigger proactive intervention:

| Signal | Meaning | Action |
|---|---|---|
| No login in 14 days | Not seeing value | Weekly digest email with wins |
| 0 errors fixed in 30 days | Loop not closing | In-product nudge + support outreach |
| Score unchanged for 4 weeks | Stuck | Coach brief with specific next action |
| All alerts dismissed (not fixed) | Disengaged | "Fixes take < 5 min — here's the fastest one" |
| Revenue recovered = $0 | No wins yet | Prioritize fastest-to-fix error in coach card |

---

## Appendix A — Database Changes Required

All schema changes needed to fully implement this specification:

```sql
-- 1. Hallucination fix timestamps + revenue recovery
ALTER TABLE ai_hallucinations
  ADD COLUMN fixed_at timestamptz,
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN revenue_recovered_monthly numeric(10,2),
  ADD COLUMN fix_guidance_category text;  -- maps to fix-guidance.ts lookup

-- 2. Wins feed
CREATE TABLE wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id),
  win_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  before_value text,
  before_metric numeric(10,2),
  after_value text,
  after_metric numeric(10,2),
  detected_at timestamptz,
  fixed_at timestamptz,
  verified_at timestamptz,
  days_to_detect int,
  days_to_fix int,
  revenue_recovered_monthly numeric(10,2),
  score_improvement int,
  is_shareable boolean NOT NULL DEFAULT false,
  share_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wins_org_id_idx ON wins(org_id);
CREATE INDEX wins_occurred_at_idx ON wins(occurred_at DESC);
ALTER TABLE wins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON wins FOR SELECT USING (org_id = (SELECT org_id FROM memberships WHERE user_id = auth.uid() LIMIT 1));

-- 3. Consistency scores
CREATE TABLE consistency_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id),
  consistency_score int NOT NULL,
  name_score int,
  address_score int,
  phone_score int,
  hours_score int,
  menu_score int,
  snapshot_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, location_id, snapshot_date)
);
ALTER TABLE consistency_scores ENABLE ROW LEVEL SECURITY;

-- 4. Content draft publish tracking
ALTER TABLE content_drafts
  ADD COLUMN published_at timestamptz,
  ADD COLUMN pre_publish_rank numeric(5,2),
  ADD COLUMN post_publish_rank numeric(5,2);

-- 5. AI Shopper runs (T3-6)
CREATE TABLE ai_shopper_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id),
  run_at timestamptz NOT NULL DEFAULT now(),
  scenario_type text NOT NULL,
  conversation_turns jsonb NOT NULL DEFAULT '[]',
  failure_turn int,
  failure_reason text,
  overall_pass boolean
);
ALTER TABLE ai_shopper_runs ENABLE ROW LEVEL SECURITY;
```

---

## Appendix B — Fix Guidance Lookup Table

```typescript
// lib/hallucinations/fix-guidance.ts

export interface FixGuidance {
  category: string;
  title: string;
  steps: string[];
  platforms: { name: string; url: string }[];
  estimatedDays: number;
  urgencyNote?: string;
}

export const FIX_GUIDANCE: Record<string, FixGuidance> = {
  hours: {
    category: 'hours',
    title: 'Update your business hours',
    steps: [
      'Log into Google Business Profile and update your hours',
      'Update hours on Yelp (business.yelp.com)',
      'Update hours on TripAdvisor if listed',
      'Submit our correction and we will re-verify in ~12 days',
    ],
    platforms: [
      { name: 'Google Business Profile', url: 'https://business.google.com' },
      { name: 'Yelp for Business', url: 'https://biz.yelp.com' },
    ],
    estimatedDays: 12,
    urgencyNote: 'Hours errors cause the highest walk-away rate — customers leave immediately',
  },
  closed: {
    category: 'closed',
    title: 'Tell AI you are open for business',
    steps: [
      'Log into Google Business Profile',
      'Verify your status is NOT marked as "Permanently Closed"',
      'Post a recent update (photo or announcement) to show activity',
      'Verify your hours are current — stale hours signal inactivity to AI',
    ],
    platforms: [
      { name: 'Google Business Profile', url: 'https://business.google.com' },
    ],
    estimatedDays: 7,
    urgencyNote: 'CRITICAL — AI recommending you as closed sends customers elsewhere immediately',
  },
  address: {
    category: 'address',
    title: 'Correct your address across all platforms',
    steps: [
      'Update address in Google Business Profile',
      'Update on Yelp — go to business.yelp.com → Location',
      'Submit correction to Apple Business Connect',
      'Update on TripAdvisor if listed',
      'Check your own website footer and contact page',
    ],
    platforms: [
      { name: 'Google Business Profile', url: 'https://business.google.com' },
      { name: 'Yelp for Business', url: 'https://biz.yelp.com' },
      { name: 'Apple Business Connect', url: 'https://businessconnect.apple.com' },
    ],
    estimatedDays: 14,
  },
  phone: {
    category: 'phone',
    title: 'Update your phone number',
    steps: [
      'Update in Google Business Profile',
      'Update on Yelp',
      'Check your own website — header and contact page',
      'Update on any delivery apps (DoorDash, Uber Eats) if applicable',
    ],
    platforms: [
      { name: 'Google Business Profile', url: 'https://business.google.com' },
      { name: 'Yelp for Business', url: 'https://biz.yelp.com' },
    ],
    estimatedDays: 10,
  },
  menu: {
    category: 'menu',
    title: 'Correct your menu information',
    steps: [
      'Update your menu in LocalVector — changes distribute automatically',
      'Update prices on Google Business Profile Food Menus',
      'Update on Yelp menu section',
      'Update on any delivery apps if prices differ',
    ],
    platforms: [
      { name: 'Google Business Profile', url: 'https://business.google.com' },
    ],
    estimatedDays: 7,
  },
  cuisine: {
    category: 'cuisine',
    title: 'Correct your cuisine type',
    steps: [
      'Update your primary category in Google Business Profile',
      'Update on Yelp — Categories section',
      'Review your website homepage — does it clearly state your cuisine?',
    ],
    platforms: [
      { name: 'Google Business Profile', url: 'https://business.google.com' },
      { name: 'Yelp for Business', url: 'https://biz.yelp.com' },
    ],
    estimatedDays: 18,
  },
};
```

---

## Appendix C — The "First 24 Hours" Reveal Experience Flow

```
User adds location
         ↓
Immediate scan triggered (not Sunday — RIGHT NOW)
         ↓
ScanOverlay shows 3 phases:
  Phase 0: "Connecting to AI networks..."    (0–1.5s)
  Phase 1: "Running 10 AI search queries..." (1.5–3s)
  Phase 2: "Analyzing what AI says about [business_name]..." (3s+)
         ↓
Scan completes (real results OR mock if no API keys)
         ↓
FirstScanRevealCard shown FULL SCREEN with animation:
  ┌──────────────────────────────────────────────┐
  │  Here is what AI says about your business    │
  │  right now — before you do anything.         │
  │                                              │
  │  AI Mentions:     [X]% of searches          │
  │  AI Errors Found: [N] issues                │
  │  Monthly Impact:  -$[X]                     │
  │                                              │
  │  [Most critical error quoted verbatim]       │
  │                                              │
  │  [CTA] See your personalized fix plan →      │
  └──────────────────────────────────────────────┘
         ↓
Owner clicks CTA
         ↓
Full dashboard with onboarding checklist pre-populated
and Coach Brief showing the top 3 fixes
```

This is the product's single most important first impression. It turns the abstract promise ("AI might be hurting you") into a concrete, personal, undeniable reality in the first 5 minutes.

---

## 15. Sprint Execution Plan — S14 through S28

### Sprint Dependency Graph

```
Wave 1 (Foundation — no external deps, run in any order)
  S14 — Fix Timestamps + Category Guidance   [§214]
  S15 — Before/After Panel + Revenue Recovered [§215]
  S16 — Score Attribution + Intent Discovery  [§216]
         ↓
Wave 2 (Feedback Loops — requires Wave 1)
  S17 — Wins Feed + NAP Consistency KPI      [§217]
  S18 — Content→SOV Feedback + Competitor Actions [§218]
  S19 — Revenue Per Mention + Jargon Pass    [§219]
         ↓
Wave 3 (Gamification — requires Wave 2)
  S20 — Health Streak + Milestones + Fix Spotlight [§220]
  S21 — Day-of-Week Urgency + External Fix Links   [§221]
         ↓
Wave 4 (Advanced Intelligence — requires Wave 1-3 + data accumulation)
  S22 — AI Accuracy Degradation Alerts       [§222]
  S23 — Correction Effectiveness Database    [§223]
  S24 — Menu Intelligence Demand Signals     [§224]
  S25 — AI Shopper Simulation                [§225]
  S26 — Competitor Vulnerability Window      [§226]
  S27 — First 24 Hours Reveal + Monthly Report [§227]
  S28 — Consistency Score + Integration Pass [§228]
```

### Shared Engineering Constraints (All Sprints S14–S28)

- All new services in `lib/services/` are pure — callers pass Supabase client
- All new columns on existing tables require a timestamped migration
- Every new cron requires a kill switch env var + `Authorization: Bearer <CRON_SECRET>` + entry in `vercel.json`
- All new tables require RLS with `org_isolation_select` policy
- `npx next build` must pass after every sprint (no `NODE_ENV=development`)
- Test counts: unit tests ≥ 10 per sprint, E2E smoke ≥ 3 scenarios per sprint
- Regression guard: all prior tests pass before merge

---

### S14 — Fix Timestamps + Category-Specific Fix Guidance

**AI_RULES §214** · Wave 1 · No dependencies

**Objective:** Every hallucination fix is timestamped, revenue impact is snapshotted at fix time, and every open alert shows numbered, platform-specific fix steps.

#### Migration

`supabase/migrations/20260501000001_hallucination_fix_tracking.sql`

```sql
ALTER TABLE ai_hallucinations
  ADD COLUMN IF NOT EXISTS fixed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS revenue_recovered_monthly numeric(10,2),
  ADD COLUMN IF NOT EXISTS fix_guidance_category text;

-- Backfill fixed_at from existing corrected rows
UPDATE ai_hallucinations
  SET fixed_at = updated_at
  WHERE correction_status IN ('corrected', 'fixed')
    AND fixed_at IS NULL;

-- Backfill verified_at from existing fixed rows
UPDATE ai_hallucinations
  SET verified_at = follow_up_checked_at
  WHERE correction_status = 'fixed'
    AND follow_up_result = 'fixed'
    AND verified_at IS NULL;
```

#### New Files

- `lib/hallucinations/fix-guidance.ts` — `FixGuidance` interface + `FIX_GUIDANCE` record (6 keys: hours/closed/address/phone/menu/cuisine). Full spec in Appendix B of this document. Export `getFixGuidance(category: string): FixGuidance | null`.
- `app/dashboard/hallucinations/_components/FixGuidancePanel.tsx` — Client component. Renders numbered steps, external platform links (open in new tab with `rel="noopener noreferrer"`), estimated fix time badge. Hidden behind `status === 'open' || status === 'verifying'` guard. Collapsed by default, "Show fix steps" chevron toggle.

#### Modified Files

- `app/dashboard/hallucinations/actions.ts` — In `markHallucinationCorrected()`: set `fixed_at = now()` and `revenue_recovered_monthly` = revenue impact at time of correction (fetch from `revenue_snapshots`, compute for this alert's severity and category, snapshot the value so it never changes).
- `lib/services/correction-verifier.service.ts` — In `checkCorrectionStatus()`: when result = 'fixed', set `verified_at = now()`. When result = 'recurring', clear `fixed_at` (error is back).
- `app/dashboard/hallucinations/_components/AlertCard.tsx` — Import and render `<FixGuidancePanel category={alert.fix_guidance_category} />` below the description block, before the action buttons.

#### Unit Tests

`src/__tests__/unit/hallucination-fix-tracking.test.ts` — **18 tests**

| Test | Description |
|---|---|
| `getFixGuidance('hours')` | Returns guidance with 4 steps, 2 platforms, estimatedDays=12 |
| `getFixGuidance('closed')` | Has urgencyNote |
| `getFixGuidance('address')` | Returns 3 platforms |
| `getFixGuidance('phone')` | Returns guidance |
| `getFixGuidance('menu')` | Returns guidance |
| `getFixGuidance('cuisine')` | Returns guidance |
| `getFixGuidance('unknown')` | Returns null (no crash) |
| `getFixGuidance('')` | Returns null |
| All 6 categories have steps array | Non-empty array |
| All platforms have valid url | Starts with https:// |
| `markHallucinationCorrected` sets fixed_at | Timestamp set on call |
| `markHallucinationCorrected` sets revenue_recovered_monthly | Snapshotted value |
| `checkCorrectionStatus` fixed → sets verified_at | verified_at populated |
| `checkCorrectionStatus` recurring → clears fixed_at | fixed_at null |
| FixGuidancePanel hidden when status=corrected | Not rendered |
| FixGuidancePanel renders steps when open | Steps list visible |
| FixGuidancePanel platform links have noopener | Security attribute |
| fix_guidance_category backfill migration idempotent | Re-running safe |

`src/__tests__/unit/fix-guidance-panel.test.tsx` — **10 tests** (jsdom)

- Renders null when no guidance found
- Collapsed by default (steps hidden)
- Toggle shows/hides steps
- All 4 step items rendered for 'hours'
- Platform links render with correct href
- estimatedDays displayed as "~12 days"
- urgencyNote rendered for 'closed'
- "Fix before weekend" badge not rendered (that's S21)
- data-testid="fix-guidance-panel" present
- data-testid="fix-guidance-platform-link" on each link

#### E2E Smoke Test

`tests/e2e/s14-fix-guidance.spec.ts` — **4 scenarios**

1. Open alert shows "Show fix steps" toggle
2. Clicking toggle reveals numbered steps and platform links
3. Fix steps panel hidden on corrected alert
4. Platform link has target="_blank"

#### Regression Guard

- `src/__tests__/unit/alert-card.test.tsx` — all 14 existing tests pass
- `src/__tests__/unit/hallucinations-page-header.test.tsx` — all 5 pass

#### Definition of Done

- [ ] Migration applied cleanly (idempotent via `IF NOT EXISTS`)
- [ ] `FIX_GUIDANCE` has all 6 categories with non-empty steps and platform links
- [ ] `fixed_at` set when `markHallucinationCorrected()` called
- [ ] `verified_at` set when correction verifier confirms fix
- [ ] `revenue_recovered_monthly` snapshotted at fix time
- [ ] FixGuidancePanel renders and toggles in AlertCard
- [ ] All 28 new unit tests pass
- [ ] All 4 E2E scenarios pass
- [ ] `npx next build` passes

---

### S15 — Before/After Panel + Revenue Recovered Counter

**AI_RULES §215** · Wave 1 · Requires S14 (for `fixed_at` column)

**Objective:** The Resolved swimlane shows what AI was saying wrong vs what it now says correctly, with days-to-fix and money recovered. The Lost Sales page shows a "Revenue Recovered" counter alongside the current loss estimate.

#### New Files

- `app/dashboard/hallucinations/_components/BeforeAfterCard.tsx` — Replaces `AlertCard` in the Resolved column. Two-panel layout: left panel ("AI said") with `claim_text` in red-tinted block; right panel ("Now correct") with `expected_truth` in green-tinted block. Footer: `{days_to_fix} days to fix · ${revenue_recovered_monthly}/mo recovered`. If `revenue_recovered_monthly` is null, show "Revenue recovery pending verification". data-testid="before-after-card-{id}".
- `lib/data/revenue-recovery.ts` — `fetchRevenueRecovery(supabase, orgId): Promise<RevenueRecoveryMetrics>`. Queries `ai_hallucinations WHERE correction_status = 'fixed' AND revenue_recovered_monthly IS NOT NULL`. Returns `{ recoveredMonthly: number, recoveredSinceJoined: number, fixCount: number, avgDaysToFix: number }`. Compute `recoveredSinceJoined` = `SUM(revenue_recovered_monthly * months_since_fixed)` where `months_since_fixed = EXTRACT(MONTH FROM age(now(), fixed_at)) + 1`.
- `app/dashboard/revenue-impact/_components/RevenueRecoveredCard.tsx` — Green card. Shows `+$X/mo recovered` as headline, `{N} AI errors fixed`, `Avg fix time: {N} days`. Has `data-testid="revenue-recovered-card"`. Hidden when `fixCount === 0` (empty state: "Your first recovery will appear here after fixing an AI error").

#### Modified Files

- `app/dashboard/hallucinations/_components/TriageSwimlane.tsx` — Import `BeforeAfterCard`. When `column === 'resolved'`, render `<BeforeAfterCard alert={alert} />` instead of `<AlertCard alert={alert} />`.
- `app/dashboard/revenue-impact/page.tsx` — Add `fetchRevenueRecovery()` to server-side data fetch. Pass `recoveryMetrics` to `LostSalesHero`. Add `<RevenueRecoveredCard metrics={recoveryMetrics} />` below `LostSalesHero`.
- `lib/data/dashboard.ts` — Add `revenueRecoveredMonthly` to dashboard data: sum of `revenue_recovered_monthly` on fixed hallucinations. Display on main dashboard as a green KPI chip in `WeeklyKPIChips`.

#### Unit Tests

`src/__tests__/unit/before-after-card.test.tsx` — **14 tests** (jsdom)

- Renders claim_text in "AI said" panel
- Renders expected_truth in "Now correct" panel
- Shows days_to_fix when fixed_at present
- Shows revenue_recovered_monthly when set
- Shows "Revenue recovery pending" when revenue_recovered_monthly is null
- data-testid="before-after-card-{id}" present
- "AI said" panel has red-tinted class
- "Now correct" panel has green-tinted class
- Renders without crashing when claim_text is null
- Renders without crashing when expected_truth is null
- Not rendered in Fix Now column (TriageSwimlane guard)
- Not rendered in In Progress column (TriageSwimlane guard)
- Rendered in Resolved column (TriageSwimlane guard)
- Long claim_text is not truncated (full context needed)

`src/__tests__/unit/revenue-recovery.test.ts` — **14 tests**

- Returns zero metrics when no fixed hallucinations
- `recoveredMonthly` sums revenue_recovered_monthly correctly
- `fixCount` counts only fixed (not corrected) hallucinations
- `avgDaysToFix` computed from fixed_at timestamps
- `recoveredSinceJoined` = monthly × months since fixed
- Ignores hallucinations where revenue_recovered_monthly is null
- Ignores hallucinations not in 'fixed' status
- Org isolation — only returns org's own hallucinations
- `recoveredSinceJoined` rounds to nearest dollar
- RevenueRecoveredCard hidden when fixCount = 0
- RevenueRecoveredCard shows +$X/mo headline
- RevenueRecoveredCard shows fix count
- RevenueRecoveredCard shows avg days to fix
- data-testid="revenue-recovered-card" present

#### E2E Smoke Test

`tests/e2e/s15-before-after.spec.ts` — **4 scenarios**

1. Resolved column renders BeforeAfterCard (not AlertCard)
2. Before/After panels visible with claim_text and expected_truth
3. Revenue recovered card visible on Lost Sales page
4. Revenue recovered card hidden when no fixes completed

#### Regression Guard

- `src/__tests__/unit/triage-swimlane.test.ts` — all 5 existing tests pass
- `src/__tests__/unit/alert-card.test.tsx` — all 14 still pass (AlertCard still used in Fix Now + In Progress)

#### Definition of Done

- [ ] BeforeAfterCard renders in Resolved column with before/after panels
- [ ] `fetchRevenueRecovery()` returns correct aggregated values
- [ ] RevenueRecoveredCard displays on Lost Sales page
- [ ] Main dashboard WeeklyKPIChips shows recovered amount
- [ ] All 28 unit tests pass
- [ ] All 4 E2E scenarios pass
- [ ] `npx next build` passes

---

### S16 — Score Attribution + Intent Discovery Surface

**AI_RULES §216** · Wave 1 · No hard dependencies (data already exists)

**Objective:** When the AI Health Score changes week-over-week, owners see exactly why. The orphaned Intent Discovery engine becomes discoverable by surfacing its results on the AI Mentions page.

#### New Files

- `lib/services/score-attribution.service.ts` — Pure function `computeScoreAttribution(currentSnapshot, previousSnapshot): ScoreAttribution`. Diffs `accuracy_score`, `visibility_score`, `data_health_score`. Returns `{ accuracyDelta, visibilityDelta, dataHealthDelta, headline, componentBreakdown: Array<{component, delta, reason}> }`. Example output: `{ headline: "Accuracy fell 15pts (2 new errors). Visibility up 3pts (more AI mentions).", componentBreakdown: [...] }`. Reasons are template-based — no AI calls.
- `app/dashboard/_components/ScoreAttributionPopover.tsx` — Renders when `scoreDelta !== 0` and previous snapshot exists. Trigger: info icon next to the delta badge on `PulseScoreOrb`. Uses Radix Popover (same pattern as `InfoTooltip`). Shows each component's delta with directional color (green up, red down, gray flat). data-testid="score-attribution-popover".
- `app/dashboard/share-of-voice/_components/IntentDiscoverySection.tsx` — New section on AI Mentions page. Fetches top 5 `intent_discoveries` ordered by `priority_score DESC`. For each: shows `query_text`, `intent_category` badge, `priority_score` as a relevance bar. "Create Answer →" links to `POST /api/content/generate-brief?query={query_text}`. Empty state: "We'll identify customer questions you're missing after your first week of scans." Shown below GapAlertCard section. plan gate: starter+.

#### Modified Files

- `app/dashboard/page.tsx` — Fetch last two `visibility_scores` snapshots. Pass to `ScoreAttributionPopover`. Add `prevSnapshot` to dashboard data returned by `fetchDashboardData()`.
- `lib/data/dashboard.ts` — Add `prevRealityScoreSnapshot` query: select `accuracy_score, visibility_score, data_health_score` from `visibility_scores` ordered by `snapshot_date DESC` limit 2 (take index[1] = previous).
- `app/dashboard/share-of-voice/page.tsx` — Import and render `<IntentDiscoverySection locationId={location.id} orgId={org.id} />` below GapAlertCard. Add intent_discoveries query to page data fetch.
- `components/layout/Sidebar.tsx` — No new entry needed: Intent Discovery data now surfaces on the existing AI Mentions page. Ensure the sidebar entry for AI Mentions has no `minPlan` (visible to all plans).

#### Unit Tests

`src/__tests__/unit/score-attribution.test.ts` — **16 tests**

- Positive accuracy delta produces "Accuracy improved" reason
- Negative accuracy delta produces "new errors detected" reason
- Positive visibility delta produces "more AI mentions" reason
- Negative visibility delta produces "fewer AI mentions" reason
- Positive data_health delta produces "business info improved" reason
- All zeros: returns flat attribution with no change message
- Headline concatenates non-zero changes only
- componentBreakdown length equals number of non-zero components
- Large negative accuracy (>10pts) produces "critical" urgency flag
- Previous snapshot null → returns null (no attribution)
- ScoreAttributionPopover not rendered when scoreDelta = 0
- ScoreAttributionPopover renders when scoreDelta ≠ 0
- Popover shows 3 component rows
- Popover closes on outside click (Radix default)
- data-testid="score-attribution-popover" present
- Trigger icon is accessible (aria-label)

`src/__tests__/unit/intent-discovery-section.test.tsx` — **12 tests** (jsdom)

- Renders 5 intent discoveries when data present
- Shows query_text for each discovery
- Shows intent_category badge
- "Create Answer →" link present per discovery
- Priority bar visible and non-zero
- Empty state shown when no discoveries
- Starter+ gate: renders for starter plan
- Section has accessible heading
- Each discovery has data-testid="intent-discovery-item-{id}"
- Sorted by priority_score descending
- Truncates query_text at 80 chars
- Does not render for trial plan (empty state instead)

#### E2E Smoke Test

`tests/e2e/s16-score-attribution.spec.ts` — **4 scenarios**

1. Score delta badge visible when score changed from last week
2. Clicking info icon opens attribution popover
3. Intent Discovery section visible on AI Mentions page
4. "Create Answer" link navigates to content area

#### Regression Guard

- `src/__tests__/unit/ai-visibility-panel.test.tsx` — all 10 pass
- `src/__tests__/unit/top-issues-panel.test.tsx` — all 14 pass

#### Definition of Done

- [ ] `computeScoreAttribution()` correctly diffs all 3 components
- [ ] Attribution popover renders on dashboard when score changed
- [ ] Intent Discovery section renders on AI Mentions page (starter+)
- [ ] Top 5 intent discoveries shown sorted by priority_score
- [ ] "Create Answer" links navigate correctly
- [ ] All 28 unit tests pass
- [ ] All 4 E2E scenarios pass
- [ ] `npx next build` passes

---

### S17 — Wins Feed + NAP Consistency KPI

**AI_RULES §217** · Wave 2 · Requires S14 + S15

**Objective:** Every resolved AI error, score milestone, and citation improvement generates a structured Win record. Wins appear in a feed on the main dashboard. The NAP consistency score appears as a KPI chip.

#### Migration

`supabase/migrations/20260501000002_wins_feed.sql`

```sql
CREATE TABLE wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id),
  win_type text NOT NULL,  -- 'error_fixed' | 'score_milestone' | 'citation_improved' | 'competitor_beaten'
  occurred_at timestamptz NOT NULL DEFAULT now(),
  before_value text,
  after_value text,
  before_metric numeric(10,2),
  after_metric numeric(10,2),
  detected_at timestamptz,
  fixed_at timestamptz,
  verified_at timestamptz,
  days_to_detect int,
  days_to_fix int,
  revenue_recovered_monthly numeric(10,2),
  score_improvement int,
  headline text NOT NULL,
  is_shareable boolean NOT NULL DEFAULT false,
  share_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wins_org_id_occurred_idx ON wins(org_id, occurred_at DESC);
ALTER TABLE wins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON wins FOR SELECT
  USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_all" ON wins FOR ALL
  TO service_role USING (true) WITH CHECK (true);
```

#### New Files

- `lib/wins/win-recorder.ts` — `recordWin(supabase, win: CreateWinInput): Promise<void>`. Never throws — catches + Sentry. `generateWinHeadline(win: CreateWinInput): string` — pure function, template-based. Examples: "ChatGPT no longer calls you permanently closed — $180/mo recovered", "Your AI Health Score crossed 80 — top quartile in Alpharetta."
- `lib/wins/wins-feed.ts` — `fetchWinsFeed(supabase, orgId, limit=10): Promise<Win[]>`. Queries `wins` table ordered by `occurred_at DESC`. Returns with `headline`, `win_type`, `revenue_recovered_monthly`, `occurred_at`.
- `app/dashboard/_components/WinsFeed.tsx` — Rendered below `CoachBriefCard` on main dashboard. Shows last 5 wins. Each win: green checkmark icon, `headline` text, relative time. Empty state: "Your first win will appear here after an AI error is fixed or your citation rate improves." data-testid="wins-feed". Hidden in sample mode (sample wins shown instead).
- `lib/services/nap-consistency.service.ts` — Pure `computeNAPConsistency(platforms: PlatformStatus[]): NAPConsistencyScore`. Inputs from `location_integrations + nap_discrepancies`. Formula from §13.9. Returns `{ score: number, nameScore, addressScore, phoneScore, hoursScore, menuScore }`. Note: reads existing `nap_discrepancies` table — no new DB query needed.

#### Modified Files

- `lib/services/correction-verifier.service.ts` — When `follow_up_result = 'fixed'`, call `recordWin(supabase, { win_type: 'error_fixed', headline: generateWinHeadline(...), ... })` with `revenue_recovered_monthly` from hallucination row.
- `app/dashboard/_components/WeeklyKPIChips.tsx` — Add 4th chip: NAP Consistency score. Fetch from `computeNAPConsistency()`. Green ≥80, amber 60–79, red <60. Chip label: "Info Accuracy: X%". Links to `/dashboard/settings/integrations`. Hidden when no platform data (NAP sync not yet run).
- `app/dashboard/page.tsx` — Add `fetchWinsFeed()` and NAP consistency to dashboard data fetch. Pass to `<WinsFeed wins={...} />` and `<WeeklyKPIChips napScore={...} />`.

#### Unit Tests

`src/__tests__/unit/wins-feed.test.ts` — **16 tests**

- `generateWinHeadline` for error_fixed type with revenue
- `generateWinHeadline` for score_milestone type
- `generateWinHeadline` for citation_improved type
- `generateWinHeadline` for competitor_beaten type
- `recordWin` never throws on DB error (fail-open)
- `fetchWinsFeed` returns ordered by occurred_at DESC
- `fetchWinsFeed` respects limit parameter
- Org isolation via RLS (only org's wins returned)
- WinsFeed renders 5 wins
- WinsFeed shows green checkmark icon per win
- WinsFeed shows relative time
- WinsFeed empty state when no wins
- WinsFeed hidden in sample mode
- data-testid="wins-feed" present
- Win type badge displayed per entry
- Revenue recovered shown when set on win

`src/__tests__/unit/nap-consistency.test.ts` — **12 tests**

- All platforms matching = score 100
- 0 platforms matching = score 0
- Partial match computes weighted average correctly
- Name weight 30, address weight 25, phone weight 20
- Hours weight 15, menu weight 10
- Returns score between 0 and 100 (always)
- Empty platforms array = returns score 0 (no crash)
- NAP chip renders with score
- NAP chip green when ≥80
- NAP chip amber when 60-79
- NAP chip red when <60
- NAP chip hidden when no platform data

#### E2E Smoke Test

`tests/e2e/s17-wins-feed.spec.ts` — **4 scenarios**

1. WinsFeed renders on main dashboard
2. Empty state shown when no wins yet
3. NAP consistency chip visible in KPI chips
4. Fixing a hallucination creates a win in the feed

#### Regression Guard

- `src/__tests__/unit/correction-service.test.ts` — all 16 pass
- `src/__tests__/unit/nap-health-score.test.ts` — all 17 pass

#### Kill Switch

`STOP_WIN_RECORDER=true` — disables `recordWin()` calls (wins simply not recorded, no errors)

#### Definition of Done

- [ ] Migration applied with RLS
- [ ] `recordWin()` called by correction verifier on fix
- [ ] WinsFeed component renders on main dashboard
- [ ] NAP consistency chip in WeeklyKPIChips
- [ ] All 28 unit tests pass
- [ ] All 4 E2E scenarios pass
- [ ] `npx next build` passes

---

### S18 — Content→SOV Feedback Loop + Competitor Action Tracking

**AI_RULES §218** · Wave 2 · Requires S17

**Objective:** When a content draft goes live, the next SOV scan detects and displays the citation rate improvement for that specific query. Competitor action items have a "Mark as done" UI so owners track what they've tried.

#### Migration

`supabase/migrations/20260501000003_content_sov_feedback.sql`

```sql
ALTER TABLE content_drafts
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS pre_publish_citation_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS post_publish_citation_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS feedback_checked_at timestamptz;

ALTER TABLE competitor_intercepts
  ADD COLUMN IF NOT EXISTS action_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS action_notes text;
```

#### New Files

- `lib/services/content-feedback.service.ts` — `measureContentImpact(supabase, draftId): Promise<ContentImpactResult>`. Called by weekly SOV cron for drafts where `published_at IS NOT NULL AND feedback_checked_at IS NULL AND published_at < now() - interval '7 days'`. Compares `target_queries.citation_rate` now vs at `pre_publish_citation_rate`. Returns `{ improved: boolean, delta: number, queryText: string }`. Updates `post_publish_citation_rate` and `feedback_checked_at`. Never throws.
- `app/dashboard/share-of-voice/_components/ContentImpactBadge.tsx` — Renders on published `ContentDraftCard` when `post_publish_citation_rate` is set. Shows "↑ Citation improved +X% after publish" in green, or "No change yet — rescan in N days" in muted. data-testid="content-impact-badge".
- `app/dashboard/compete/_components/CompetitorActionItem.tsx` — Per action item on `InterceptCard`. "Mark as done" button sets `action_completed_at = now()`. Renders completed checkmark when done. `action_notes` optional textarea. data-testid="competitor-action-item-{id}".

#### Modified Files

- `app/api/cron/sov/route.ts` — After SOV scan completes per org: iterate drafts with `published_at IS NOT NULL AND feedback_checked_at IS NULL`. Call `measureContentImpact()`. Fire-and-forget, non-critical.
- `app/dashboard/share-of-voice/page.tsx` — Pass `post_publish_citation_rate` data to draft section for ContentImpactBadge.
- `app/dashboard/compete/page.tsx` — Render `CompetitorActionItem` per action within `InterceptCard`.
- `app/dashboard/compete/actions.ts` — Add `markCompetitorActionDone(interceptId, notes?)` server action. Updates `action_completed_at` and `action_notes`. Requires authenticated org member.

#### Unit Tests

`src/__tests__/unit/content-sov-feedback.test.ts` — **16 tests**

- `measureContentImpact` returns improved=true when citation_rate increased
- `measureContentImpact` returns improved=false when no change
- `measureContentImpact` skips drafts published < 7 days ago
- `measureContentImpact` skips drafts already checked
- `measureContentImpact` never throws on DB error
- `measureContentImpact` updates feedback_checked_at after run
- ContentImpactBadge renders improvement when delta > 0
- ContentImpactBadge renders "no change yet" when delta = 0
- ContentImpactBadge not rendered when post_publish_citation_rate null
- ContentImpactBadge data-testid present
- CompetitorActionItem "Mark as done" button present
- CompetitorActionItem renders checkmark when completed
- `markCompetitorActionDone` sets action_completed_at
- `markCompetitorActionDone` rejects unauthenticated
- `markCompetitorActionDone` requires org membership
- SOV cron calls measureContentImpact for qualifying drafts

#### E2E Smoke Test

`tests/e2e/s18-content-feedback.spec.ts` — **4 scenarios**

1. Published draft shows ContentImpactBadge
2. Competitor action "Mark as done" button visible
3. Marking action done shows checkmark
4. Action marked done persists on page refresh

#### Regression Guard

- `src/__tests__/unit/content-drafts-actions.test.ts` — all existing pass
- `src/__tests__/unit/inngest-sov-cron.test.ts` — all existing pass

#### Definition of Done

- [ ] Migration applied
- [ ] `measureContentImpact()` called from SOV cron
- [ ] ContentImpactBadge renders on published drafts
- [ ] CompetitorActionItem tracks completion
- [ ] All 16 unit tests pass
- [ ] All 4 E2E scenarios pass
- [ ] `npx next build` passes

---

### S19 — Revenue Per Mention + Language Integration Pass

**AI_RULES §219** · Wave 2 · Requires S18

**Objective:** Every SOV % point has an explicit dollar value shown in context. All remaining jargon violations from §11.1 are fixed across the codebase.

#### New Files

- `lib/services/revenue-per-mention.service.ts` — Pure function `computeRevenuePerMention(avgTicket: number, monthlyCover: number): RevenuePerMentionResult`. Formula: `revenue_per_mention = avg_ticket × 0.03 × 0.35`. Monthly SOV value: `monthly_searches × sov_rate × revenue_per_mention`. Returns `{ revenuePerMention, monthlyValue, context: string }`. Context template: "Each additional AI mention is worth ~${X} to your business based on your average ticket."
- `app/dashboard/share-of-voice/_components/SOVDollarCallout.tsx` — Inline callout on AI Mentions page below the SOV hero. Shows "At ${X}/mention, your current {N}% mention rate = ${Y}/mo from AI". Green when improving. data-testid="sov-dollar-callout".

#### Modified Files

- `app/dashboard/share-of-voice/page.tsx` — Fetch `avg_customer_value` + `monthly_covers` from location. Compute `computeRevenuePerMention()`. Pass to `<SOVDollarCallout />`.
- Multiple files — Jargon replacement pass (all ❌ items from §11.1):
  - `app/dashboard/page-audits/` — "AEO Score" → "Post Quality Score" (page title, stat panels)
  - `app/dashboard/vaio/` — "llms.txt" → "AI Instruction File" (with tooltip on first occurrence)
  - `app/dashboard/page-audits/` — "schema markup" → "How AI reads your website"
  - `app/dashboard/entity-health/` — "Propagation events" → "Menu updates spreading to AI apps"
  - `app/dashboard/compete/` — Page subtitle "Competitor Intercept" → "Where competitors outrank you"
  - `app/dashboard/share-of-voice/` — Intent Discovery reference → "Questions customers ask that you're not answering"
  - `app/dashboard/crawler-analytics/` — Page title → "AI Bot Visits" (if not already done)
  - `app/dashboard/settings/integrations/` — "NAP Sync" → "Business Info Accuracy"
  - Tooltips on `citation_rate` and `share_of_voice` fields (add to `lib/tooltip-content.tsx`)

#### Unit Tests

`src/__tests__/unit/revenue-per-mention.test.ts` — **12 tests**

- Default config: `$55 × 0.03 × 0.35 = $0.578` per mention
- Monthly value at 23% SOV and 2000 searches = $267
- Custom avg_ticket applied correctly
- Custom monthly_covers applied correctly
- 0% SOV returns $0 monthly value
- 100% SOV returns maximum value
- Context string is human-readable (contains "$")
- SOVDollarCallout renders with computed values
- SOVDollarCallout hidden when location has no revenue config
- SOVDollarCallout data-testid present
- Jargon: "AEO Score" not found in page-audits page title
- Jargon: "llms.txt" not found without tooltip wrapper in vaio page

#### E2E Smoke Test

`tests/e2e/s19-revenue-per-mention.spec.ts` — **4 scenarios**

1. SOVDollarCallout visible on AI Mentions page
2. Dollar amount updates based on current SOV percentage
3. "Post Quality Score" visible (not "AEO Score") on Website Checkup page
4. "AI Instruction File" tooltip present on Voice Search page

#### Regression Guard

- `src/__tests__/unit/sov-verdict-panel.test.tsx` — all 11 pass
- `src/__tests__/unit/vaio-service.test.ts` — all 13 pass

#### Definition of Done

- [ ] `computeRevenuePerMention()` uses correct formula
- [ ] SOVDollarCallout renders on AI Mentions page
- [ ] All 9 jargon violations in §11.1 fixed
- [ ] Tooltips added for citation_rate and share_of_voice
- [ ] All 12 unit tests pass
- [ ] All 4 E2E scenarios pass
- [ ] `npx next build` passes

---

### S20 — Health Streak + Score Milestones + Fix of the Week Spotlight

**AI_RULES §220** · Wave 3 · Requires S17

**Objective:** Three gamification mechanics activate: a clean-week streak counter, a score milestone celebration (confetti at 50/60/70/80/90), and a "Fix of the Week" spotlight for high-value corrections.

#### New Files

- `lib/services/health-streak.service.ts` — Pure `computeHealthStreak(snapshots: VisibilityScore[]): HealthStreak`. A "clean week" = `accuracy_score >= 85`. Streak resets when a week has `accuracy_score < 85`. Returns `{ currentStreak: number, longestStreak: number, isOnStreak: boolean }`. Input: ordered array of weekly snapshots.
- `app/dashboard/_components/HealthStreakBadge.tsx` — Renders flame icon (Lucide `Flame`) + `{N}-week streak` on main dashboard header. Hidden when streak < 2. Tooltip: "No new high-severity AI errors for {N} weeks." data-testid="health-streak-badge". Respects `prefers-reduced-motion` (no animation if set).
- `lib/services/score-milestone.service.ts` — Pure `detectScoreMilestone(current: number, previous: number): Milestone | null`. Milestones: 50, 60, 70, 80, 90. Returns milestone crossed or null. `formatMilestoneMessage(milestone: Milestone): string` — "Your restaurant's AI Health Score just crossed {N}! You're in the top quarter of {city} restaurants."
- `app/dashboard/_components/MilestoneCelebration.tsx` — Client component. When `milestone !== null` (passed from server as prop), shows a full-screen overlay for 3s with confetti animation (CSS keyframes, `canvas-confetti` npm package, or CSS-only fallback). After 3s auto-dismisses. Stores dismissed milestone in `sessionStorage` so it only fires once per session. Respects `prefers-reduced-motion` (static card instead of confetti). data-testid="milestone-celebration".
- `app/dashboard/_components/FixSpotlightCard.tsx` — Shown for 7 days after a fix where `revenue_recovered_monthly >= 100`. "You recovered ${X}/mo this week by correcting [category] on [model]." Green card with trophy icon. Dismissible (localStorage key `lv_fix_spotlight_{id}`). data-testid="fix-spotlight-card".

#### Modified Files

- `app/dashboard/page.tsx` — Compute `computeHealthStreak(realityScoreTrend)`. Detect `detectScoreMilestone(currentScore, previousScore)`. Query fixed hallucinations with `fixed_at > now()-7days AND revenue_recovered_monthly >= 100` for spotlight. Pass all to components.
- `lib/data/dashboard.ts` — `fetchDashboardData()` already returns `realityScoreTrend` (12 months of snapshots) — reuse for streak computation.
- `package.json` — Add `canvas-confetti` dependency (or use CSS-only fallback to avoid bundle increase).

#### Unit Tests

`src/__tests__/unit/health-streak.test.ts` — **16 tests**

- 4 consecutive clean weeks = streak 4
- Gap in clean weeks resets streak
- Single clean week = streak 1
- No clean weeks = streak 0
- `isOnStreak` false when streak < 2
- `longestStreak` tracked independently from currentStreak
- Empty snapshots = streak 0 (no crash)
- Single snapshot clean = streak 1
- HealthStreakBadge hidden when streak < 2
- HealthStreakBadge shows flame icon and count
- HealthStreakBadge data-testid present
- Accuracy score exactly 85 = clean week (boundary)
- Accuracy score 84 = not clean week

`src/__tests__/unit/score-milestone.test.ts` — **14 tests**

- 49→51 crosses milestone 50 → returns milestone 50
- 59→61 crosses milestone 60 → returns milestone 60
- 79→80 crosses milestone 80 → returns milestone 80
- 89→90 crosses milestone 90 → returns milestone 90
- 80→82 (already past milestone) → returns null
- 48→49 (approaching but not crossing) → returns null
- `formatMilestoneMessage` returns non-empty string
- MilestoneCelebration renders when milestone present
- MilestoneCelebration not rendered when milestone null
- MilestoneCelebration auto-dismisses after 3s
- sessionStorage prevents repeat celebration same session
- prefers-reduced-motion shows static card
- FixSpotlightCard renders when high-value fix recent
- FixSpotlightCard not rendered when revenue_recovered < 100

#### E2E Smoke Test

`tests/e2e/s20-gamification.spec.ts` — **4 scenarios**

1. HealthStreakBadge visible when accuracy has been clean 2+ weeks (mock data)
2. FixSpotlightCard renders when high-value fix exists
3. FixSpotlightCard dismissible (click X, refreshes hidden)
4. HealthStreakBadge not rendered when streak = 0

#### Regression Guard

- `src/__tests__/unit/coaching-sprints.test.ts` (if exists) — all pass
- `src/__tests__/unit/reality-score.test.ts` — all pass

#### Definition of Done

- [ ] `computeHealthStreak()` correctly sequences clean weeks
- [ ] `detectScoreMilestone()` returns correct milestone or null
- [ ] HealthStreakBadge renders only when streak ≥ 2
- [ ] MilestoneCelebration fires once per session, respects reduced-motion
- [ ] FixSpotlightCard shows for 7 days, dismissible
- [ ] All 30 unit tests pass
- [ ] All 4 E2E scenarios pass
- [ ] `npx next build` passes

---

### S21 — Day-of-Week Urgency + External Fix Links

**AI_RULES §221** · Wave 3 · Requires S14 + S20

**Objective:** Critical/high errors detected Tuesday–Thursday get a "Fix before weekend" urgency badge. Entity Health and Citations pages gain direct "Claim on [Platform] →" links.

#### New Files

- `lib/hallucinations/urgency.ts` — Pure `computeUrgency(severity: string, detectedAt: string, avgTicket: number, monthlyCover: number): UrgencyResult | null`. Returns `{ badge: 'fix-before-weekend', revenueAtStake: number, deadline: string }` when `severity in ['critical', 'high'] AND day_of_week in [2,3,4] (Tue/Wed/Thu)`. `revenueAtStake` = `avg_ticket × monthly_covers / 4 × 0.4` (Friday+Saturday). Returns null for other days or lower severity.
- `lib/entity-health/platform-fix-links.ts` — `PLATFORM_FIX_LINKS: Record<string, { label: string, url: string }>`. Covers all 7 platforms in entity_checks: Google Knowledge Panel (search console), GBP (business.google.com), Yelp (biz.yelp.com), TripAdvisor (tripadvisor.com/owners), Apple Business Connect (businessconnect.apple.com), Bing Places (bingplaces.com), Wikidata (wikidata.org/wiki/Special:NewItem). Export `getPlatformFixLink(platform: string): { label: string, url: string } | null`.

#### Modified Files

- `app/dashboard/hallucinations/_components/AlertCard.tsx` — Import `computeUrgency`. When `urgencyResult !== null`, render red "Fix before weekend" badge above headline. Show `revenueAtStake` in urgency message: "Fix before Friday — ${X} at stake this weekend." Badge only shown for `status === 'open'`.
- `app/dashboard/entity-health/page.tsx` — For each platform with `status === 'missing'` or `status === 'incomplete'`, show "Claim on [Platform] →" external link button using `getPlatformFixLink()`. Opens in new tab with `rel="noopener noreferrer"`.
- `app/dashboard/citations/_components/` — (Platform citations page) Add `getPlatformFixLink()` for citation gap platforms. "Get listed on [Platform] →" per gap.
- `lib/entity-health/platform-descriptions.ts` — Add `fix_url` field to each platform entry (same data as `PLATFORM_FIX_LINKS`).

#### Unit Tests

`src/__tests__/unit/day-of-week-urgency.test.ts` — **16 tests**

- Tuesday + critical = returns urgency result
- Wednesday + high = returns urgency result
- Thursday + critical = returns urgency result
- Monday + critical = returns null (not urgent window)
- Friday + critical = returns null (already weekend)
- Saturday + critical = returns null
- Sunday + critical = returns null
- Medium severity on Wednesday = returns null
- Low severity on Wednesday = returns null
- `revenueAtStake` = `55 × 1800 / 4 × 0.4` = $9,900 with defaults
- Custom avg_ticket applies to revenueAtStake
- Deadline is "this Friday" when Tuesday
- UrgencyBadge rendered when urgencyResult present
- UrgencyBadge not rendered when null
- UrgencyBadge shows revenueAtStake amount
- UrgencyBadge data-testid present

`src/__tests__/unit/platform-fix-links.test.ts` — **12 tests**

- `getPlatformFixLink('google_business_profile')` returns non-null
- `getPlatformFixLink('yelp')` returns non-null
- `getPlatformFixLink('tripadvisor')` returns non-null
- `getPlatformFixLink('apple_maps')` returns non-null
- `getPlatformFixLink('bing_places')` returns non-null
- `getPlatformFixLink('wikidata')` returns non-null
- `getPlatformFixLink('unknown')` returns null (no crash)
- All platforms have url starting with https://
- All platforms have non-empty label
- Entity Health page renders fix links for missing platforms
- Fix links have target="_blank"
- Fix links have rel="noopener noreferrer"

#### E2E Smoke Test

`tests/e2e/s21-urgency-links.spec.ts` — **4 scenarios**

1. Critical alert on a Wednesday shows "Fix before weekend" badge (mock day)
2. Same alert on a Monday does NOT show urgency badge
3. Entity Health missing platform shows "Claim on [Platform] →" link
4. External fix link has correct href

#### Regression Guard

- `src/__tests__/unit/alert-card.test.tsx` — all 14 pass (urgency badge is additive)
- `src/__tests__/unit/entity-health-verdict-panel.test.tsx` — all 10 pass

#### Definition of Done

- [ ] `computeUrgency()` returns non-null only Tue/Wed/Thu + critical/high
- [ ] Urgency badge renders in AlertCard for qualifying conditions
- [ ] Revenue-at-stake shown in urgency badge
- [ ] `PLATFORM_FIX_LINKS` covers all 7 entity health platforms
- [ ] Entity Health renders "Claim on [Platform] →" for missing platforms
- [ ] All 28 unit tests pass
- [ ] All 4 E2E scenarios pass
- [ ] `npx next build` passes

---

### S22 — AI Accuracy Degradation Alerts

**AI_RULES §222** · Wave 4 · Requires S17 + 4+ weeks of SOV cron data

**Objective:** When multiple orgs simultaneously show new AI errors — indicating an AI model update rather than a business change — owners receive a proactive alert distinguishing "AI changed" from "you changed."

**Gate:** Minimum 20 orgs with ≥ 4 weekly snapshots before enabling. Kill switch default: enabled.

#### Migration

`supabase/migrations/20260502000001_degradation_alerts.sql`

```sql
CREATE TABLE ai_model_degradation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at timestamptz NOT NULL DEFAULT now(),
  model_provider text NOT NULL,
  affected_org_count int NOT NULL,
  avg_alert_spike numeric(5,2) NOT NULL,
  sigma_above_mean numeric(5,2) NOT NULL,
  is_confirmed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Service-role only — no org isolation (cross-org aggregate)
ALTER TABLE ai_model_degradation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON ai_model_degradation_events FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_read" ON ai_model_degradation_events FOR SELECT
  USING (auth.email() = ANY(string_to_array(current_setting('app.admin_emails', true), ',')));
```

#### New Files

- `lib/analytics/degradation-detector.ts` — `detectModelDegradation(supabase, modelProvider?: string): Promise<DegradationEvent[]>`. Cross-org query (service role): fetch last 5 weeks of `open_alert_count` per org. Compute 4-week rolling mean + stddev. Flag orgs where current week is mean + 2σ. If flagged_org_count > 20% of total orgs → generate degradation event. Pure analysis functions: `computeRollingStats(series: number[]): RollingStats`, `isDegraded(current: number, stats: RollingStats): boolean`.
- `app/api/cron/degradation-check/route.ts` — Weekly cron, Monday 10 AM UTC (after SOV runs at 7 AM). CRON_SECRET auth. Kill switch: `STOP_DEGRADATION_CHECK_CRON`. Calls `detectModelDegradation()`, inserts events, sends TopBar alert to affected orgs via `sendDegradationAlert()`. Plan gate: growth+ (alerts only; detection runs for all).
- `lib/email.ts` — Add `sendDegradationAlert(to: string, data: DegradationAlertData): Promise<void>`. Email: "ChatGPT appears to have updated — this is not your fault. {N} businesses on LocalVector saw new errors this week. Here's what to do."
- `app/dashboard/_components/DegradationAlertBanner.tsx` — Amber dismissible banner. "AI Model Alert: ChatGPT appears to have updated its knowledge base. This may have caused your new errors — we are tracking this and will notify you when it resolves." data-testid="degradation-alert-banner". Dismissed per model+week via sessionStorage.

#### Modified Files

- `lib/data/dashboard.ts` — Check `ai_model_degradation_events` for events in last 7 days. If exists, pass to dashboard for `DegradationAlertBanner`.
- `vercel.json` — Add `{ "path": "/api/cron/degradation-check", "schedule": "0 10 * * 1" }`.

#### Unit Tests

`src/__tests__/unit/degradation-detector.test.ts` — **20 tests**

- `computeRollingStats` on 4-element array: correct mean
- `computeRollingStats` correct stddev
- `isDegraded` when current = mean + 2σ → true
- `isDegraded` when current = mean + 1.9σ → false
- `isDegraded` when stddev = 0 (all equal) → false
- `detectModelDegradation` returns empty when < 20% orgs flagged
- `detectModelDegradation` returns event when ≥ 20% orgs flagged
- `detectModelDegradation` never throws (non-critical)
- Event inserted to DB when threshold crossed
- DegradationAlertBanner renders when event present
- DegradationAlertBanner dismissible
- DegradationAlertBanner not rendered when no events
- Amber color class applied
- data-testid present
- sessionStorage dismissal per model+week
- Email sent to affected org owners
- Kill switch disables cron
- Cron registered in vercel.json
- Cron requires CRON_SECRET
- Plan gate: email alert only for growth+, banner for all

#### E2E Smoke Test

`tests/e2e/s22-degradation-alerts.spec.ts` — **3 scenarios**

1. DegradationAlertBanner visible when degradation event exists (mocked)
2. Banner dismissible via X button
3. Banner does not render when no recent degradation events

#### Regression Guard

- `src/__tests__/unit/inngest-sov-cron.test.ts` — all pass
- `src/__tests__/unit/vercel-cron-config.test.ts` — update cron count

#### Kill Switch

`STOP_DEGRADATION_CHECK_CRON=true`

#### Definition of Done

- [ ] `computeRollingStats` and `isDegraded` are pure and tested
- [ ] `detectModelDegradation` runs cross-org with service role
- [ ] Cron registered in vercel.json
- [ ] DegradationAlertBanner renders/dismisses correctly
- [ ] All 20 unit tests pass
- [ ] All 3 E2E scenarios pass
- [ ] `npx next build` passes

---

### S23 — Correction Effectiveness Database

**AI_RULES §223** · Wave 4 · Requires S14 + S15 + 30+ corrections across platform

**Objective:** Aggregate anonymized correction timing data across all orgs to build proprietary benchmarks. Surface to owners: "Your correction is faster than X% of corrections we've tracked."

**Gate:** Enable display when `total_corrections_with_verified_at >= 30`. Admin panel shows raw data from day 1.

#### New Files

- `lib/analytics/correction-benchmark.ts` — `computeCorrectionBenchmarks(supabase): Promise<CorrectionBenchmarkData>`. Service-role query across all orgs: `ai_hallucinations WHERE verified_at IS NOT NULL`. Group by `(model_provider, fix_guidance_category)`. Compute: `avg_days_to_fix`, `median_days_to_fix`, `p75_days_to_fix`, `recurrence_rate`, `sample_size`. Returns keyed by `{model}_{category}`. `getCorrectionPercentile(supabase, orgId, hallucinationId): Promise<number | null>` — for a specific fixed correction, compute its percentile rank against the benchmark. Returns null when sample_size < 30.
- `lib/analytics/correction-benchmark.cache.ts` — `getCachedBenchmarks(): CorrectionBenchmarkData | null` + `setCachedBenchmarks(data)`. Redis cache, 24h TTL, fail-open (null when Redis unavailable).
- `app/api/cron/correction-benchmarks/route.ts` — Weekly cron, Saturday 5 AM UTC. Runs `computeCorrectionBenchmarks()`, caches result. Kill switch: `STOP_CORRECTION_BENCHMARKS_CRON`.
- `app/admin/correction-benchmarks/page.tsx` — Admin page showing benchmark table per model+category. Sample sizes. Avg/median/p75 days. Recurrence rates. Accessible to `ADMIN_EMAILS`. Linked from AdminNav.
- `app/dashboard/hallucinations/_components/CorrectionTimingBadge.tsx` — On `BeforeAfterCard` (Resolved column), when `getCorrectionPercentile()` returns non-null. "Corrected in {N} days — faster than X% of corrections we've tracked." data-testid="correction-timing-badge".

#### Unit Tests

`src/__tests__/unit/correction-benchmark.test.ts` — **18 tests**

- `computeCorrectionBenchmarks` groups by model+category
- `computeCorrectionBenchmarks` computes avg_days_to_fix correctly
- `computeCorrectionBenchmarks` computes median correctly (odd array)
- `computeCorrectionBenchmarks` computes median correctly (even array)
- `computeCorrectionBenchmarks` computes p75 correctly
- `computeCorrectionBenchmarks` computes recurrence_rate correctly
- `computeCorrectionBenchmarks` returns sample_size per group
- `getCorrectionPercentile` returns null when sample_size < 30
- `getCorrectionPercentile` returns 50 for median correction
- `getCorrectionPercentile` returns > 50 for fast correction
- Cache miss returns null (fail-open)
- Cache hit returns cached data
- CorrectionTimingBadge renders when percentile present
- CorrectionTimingBadge not rendered when null
- "faster than X%" copy correct
- Admin page renders benchmark table
- Admin page restricted to ADMIN_EMAILS
- Cron registered in vercel.json

#### E2E Smoke Test

`tests/e2e/s23-correction-benchmark.spec.ts` — **3 scenarios**

1. CorrectionTimingBadge renders on Resolved alert (mocked percentile data)
2. Admin correction benchmarks page loads (admin session)
3. Benchmark table shows model+category rows

#### Kill Switch

`STOP_CORRECTION_BENCHMARKS_CRON=true`

#### Definition of Done

- [ ] `computeCorrectionBenchmarks()` aggregates across all orgs
- [ ] Percentile badge renders on BeforeAfterCard when data available
- [ ] Admin page accessible and renders benchmark data
- [ ] All 18 unit tests pass
- [ ] All 3 E2E scenarios pass
- [ ] `npx next build` passes

---

### S24 — Menu Intelligence — AI Demand Signals

**AI_RULES §224** · Wave 4 · Requires S18 + sufficient SOV data

**Objective:** Each menu item in the Magic Menu workspace shows how often AI searches mention it, turning the menu into a demand intelligence tool.

#### New Files

- `lib/menu-intelligence/demand-analyzer.ts` — `analyzeMenuDemand(supabase, locationId, orgId): Promise<MenuDemandResult[]>`. Fetches `magic_menus` items for location. Fetches last 90 days of `sov_evaluations.raw_response`. For each menu item: case-insensitive substring search on item name (skip items with `name.length < 3`). Count occurrences across all evaluations. Return array sorted by `mention_count DESC`. Pure extraction: `countItemMentions(itemName: string, rawResponses: string[]): number`.
- `app/dashboard/magic-menus/_components/AIDemandBadge.tsx` — Inline badge on each menu item row. Shows "Mentioned {N}× in AI searches" when N > 0, or muted "Not yet in AI searches" when 0. Optional: click reveals which queries mention this item. data-testid="ai-demand-badge-{itemId}".
- `app/dashboard/magic-menus/_components/DemandInsightPanel.tsx` — Panel at top of menu workspace. "Top 3 AI-searched items: [item1], [item2], [item3]. Consider highlighting these in your description." Only shown when at least one item has mention_count > 0.

#### Modified Files

- `app/dashboard/magic-menus/page.tsx` — Add `analyzeMenuDemand()` server-side fetch. Pass demand data as `demandMap: Record<itemId, number>` to menu item list components.

#### Unit Tests

`src/__tests__/unit/menu-demand-analyzer.test.ts` — **16 tests**

- `countItemMentions` case-insensitive match: "Lamb Chops" matches "lamb chops"
- `countItemMentions` counts multiple occurrences correctly
- `countItemMentions` zero when item not in any response
- `countItemMentions` skips items with name.length < 3
- `countItemMentions` partial match: "Salmon" matches "grilled salmon"
- `analyzeMenuDemand` returns items sorted by mention_count DESC
- `analyzeMenuDemand` returns mention_count = 0 for uncited items
- `analyzeMenuDemand` handles empty raw_responses array
- `analyzeMenuDemand` handles empty menu items array
- AIDemandBadge renders "Mentioned N× in AI searches" when N > 0
- AIDemandBadge renders muted state when N = 0
- DemandInsightPanel shows top 3 items
- DemandInsightPanel hidden when no items have demand
- data-testid="ai-demand-badge-{itemId}" present
- 90-day window applied to raw_response query
- Items with name < 3 chars excluded from analysis

#### E2E Smoke Test

`tests/e2e/s24-menu-intelligence.spec.ts` — **3 scenarios**

1. Menu workspace shows AIDemandBadge per item
2. DemandInsightPanel shows top 3 items when demand data present
3. Items with 0 mentions show muted state

#### Regression Guard

- `src/__tests__/unit/vaio-voice-content-scorer.test.ts` — all pass (uses raw_response too)
- Menu-related existing tests — all pass

#### Definition of Done

- [ ] `countItemMentions()` is pure and handles all edge cases
- [ ] `analyzeMenuDemand()` returns correctly sorted demand data
- [ ] AIDemandBadge renders on each menu item row
- [ ] DemandInsightPanel renders when demand data present
- [ ] All 16 unit tests pass
- [ ] All 3 E2E scenarios pass
- [ ] `npx next build` passes

---

### S25 — AI Shopper — Multi-Turn Conversation Simulation

**AI_RULES §225** · Wave 4 · Requires S14 + S16 · Plan gate: Growth+

**Objective:** Simulate a 4-turn customer conversation with OpenAI to identify the exact turn where wrong information causes a customer to walk away. Weekly cron, Growth+ only.

**Gate:** Growth+ plan required. Kill switch default: enabled.

#### Migration

`supabase/migrations/20260502000002_ai_shopper.sql`

```sql
CREATE TABLE ai_shopper_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id),
  run_at timestamptz NOT NULL DEFAULT now(),
  model_provider text NOT NULL DEFAULT 'openai',
  scenario_type text NOT NULL,  -- 'discovery' | 'reservation' | 'menu' | 'hours'
  conversation_turns jsonb NOT NULL DEFAULT '[]',
  -- Each turn: { turn: int, prompt: string, response: string, accuracy_issues: string[], passed: boolean }
  failure_turn int,             -- null = passed all turns
  failure_reason text,
  overall_pass boolean,
  credit_cost int NOT NULL DEFAULT 4
);
CREATE INDEX ai_shopper_runs_org_location_idx ON ai_shopper_runs(org_id, location_id, run_at DESC);
ALTER TABLE ai_shopper_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON ai_shopper_runs FOR SELECT
  USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_all" ON ai_shopper_runs FOR ALL
  TO service_role USING (true) WITH CHECK (true);
```

#### New Files

- `lib/ai-shopper/shopper-scenarios.ts` — `SHOPPER_SCENARIOS: Record<string, ShopperScenario>`. Each scenario: 4 turn templates with `{business_name}`, `{city}`, `{cuisine}` interpolation. Example 'discovery': Turn 1 "What's a good {cuisine} restaurant near {city}?", Turn 2 "Is {business_name} good? What are their hours?", Turn 3 "Can I make a reservation for 8 people?", Turn 4 "What should I order?". Export `buildTurnPrompts(scenario, groundTruth): string[]`.
- `lib/ai-shopper/shopper-evaluator.ts` — Pure `evaluateTurnAccuracy(turn: string, response: string, groundTruth: GroundTruthForVAIO): TurnEvaluation`. Checks response for known wrong facts (hours, address, closed status). Returns `{ passed: boolean, accuracy_issues: string[], confidence: 'high'|'low' }`. `identifyFailureTurn(turns: TurnEvaluation[]): { failureTurn: int | null, failureReason: string | null }`.
- `lib/ai-shopper/shopper-runner.ts` — `runAIShopperScenario(supabase, orgId, locationId, scenarioType): Promise<AIShopperRun>`. Fetches ground truth. Builds turn prompts. Sequentially calls OpenAI chat completions with conversation history (each turn passes prior history). Evaluates each turn. Saves to `ai_shopper_runs`. Credit cost: 4 per run. Non-credit-check failure = skip run, log warning.
- `app/api/cron/ai-shopper/route.ts` — Weekly cron, Wednesday 5 AM UTC. Growth+ orgs only. Runs `runAIShopperScenario()` for 1 scenario per org per week (rotate scenarios). Kill switch: `STOP_AI_SHOPPER_CRON`.
- `app/dashboard/hallucinations/_components/ShopperInsightCard.tsx` — If latest run has `overall_pass = false`: "AI loses your customer at turn {N} — when asked about {failure_reason}." Shows the 4 turns as a collapsible timeline (turn 1 green ✓, turn 2 green ✓, turn 3 red ✗ — "Wrong Friday hours"). data-testid="shopper-insight-card".
- `vercel.json` — Add `{ "path": "/api/cron/ai-shopper", "schedule": "0 5 * * 3" }`.

#### Unit Tests

`src/__tests__/unit/ai-shopper.test.ts` — **20 tests**

- `buildTurnPrompts` interpolates business_name correctly
- `buildTurnPrompts` interpolates city correctly
- `buildTurnPrompts` returns 4 turns
- `evaluateTurnAccuracy` detects wrong hours in response
- `evaluateTurnAccuracy` passes when hours correct
- `evaluateTurnAccuracy` detects wrong closed status
- `evaluateTurnAccuracy` passes when no issues found
- `evaluateTurnAccuracy` returns confidence level
- `identifyFailureTurn` returns first failing turn
- `identifyFailureTurn` returns null when all passed
- `identifyFailureTurn` handles first turn failure
- `identifyFailureTurn` handles last turn failure
- ShopperInsightCard renders failure turn when run.overall_pass = false
- ShopperInsightCard shows passing turns as green
- ShopperInsightCard shows failing turn as red
- ShopperInsightCard not rendered when overall_pass = true
- ShopperInsightCard data-testid present
- Cron registered in vercel.json with correct schedule
- Kill switch disables cron
- Plan gate: Growth+ only

#### E2E Smoke Test

`tests/e2e/s25-ai-shopper.spec.ts` — **3 scenarios**

1. ShopperInsightCard renders on hallucinations page (mocked failure run)
2. Collapsible timeline shows 4 turns
3. ShopperInsightCard not rendered when latest run passed

#### Kill Switch

`STOP_AI_SHOPPER_CRON=true`

#### Definition of Done

- [ ] Migration applied with RLS
- [ ] `runAIShopperScenario()` runs 4-turn conversation and saves result
- [ ] `evaluateTurnAccuracy()` is pure and tested
- [ ] Cron registered, kill switch works
- [ ] ShopperInsightCard renders on hallucinations page
- [ ] All 20 unit tests pass
- [ ] All 3 E2E scenarios pass
- [ ] `npx next build` passes

---

### S26 — Competitor Vulnerability Window

**AI_RULES §226** · Wave 4 · Requires S18 · Plan gate: Agency

**Objective:** When a tracked competitor shows AI accuracy signals consistent with errors, Agency plan owners see a strategic alert with a content opportunity window.

**Gate:** Agency plan required. Kill switch default: enabled.

#### Migration

`supabase/migrations/20260502000003_competitor_vulnerability.sql`

```sql
CREATE TABLE competitor_vulnerability_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id),
  competitor_name text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  vulnerability_type text NOT NULL,  -- 'hours_inconsistency' | 'closed_signal' | 'negative_context'
  evidence_snippet text,
  strategic_suggestion text,
  expires_at timestamptz NOT NULL,  -- detected_at + 14 days
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX competitor_vuln_org_idx ON competitor_vulnerability_alerts(org_id, detected_at DESC);
ALTER TABLE competitor_vulnerability_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON competitor_vulnerability_alerts FOR SELECT
  USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_all" ON competitor_vulnerability_alerts FOR ALL
  TO service_role USING (true) WITH CHECK (true);
```

#### New Files

- `lib/competitor/vulnerability-detector.ts` — `detectCompetitorVulnerabilities(supabase, orgId, locationId): Promise<CompetitorVulnerability[]>`. Reads `sov_evaluations` for this org's queries. Extracts competitor names from `mentioned_competitors`. Scans `raw_response` for vulnerability signals per competitor: hours inconsistency patterns (e.g., "hours may vary", "check before visiting"), closed signals ("permanently closed", "temporarily closed"), negative sentiment context. Returns findings with `evidence_snippet` (first 200 chars of relevant response excerpt). Pure analysis: `analyzeCompetitorContext(competitorName: string, rawResponse: string): VulnerabilitySignal[]`.
- `app/api/cron/competitor-vulnerability/route.ts` — Weekly cron, Tuesday 8 AM UTC (day after SOV). Agency-only orgs. Kill switch: `STOP_COMPETITOR_VULNERABILITY_CRON`.
- `app/dashboard/compete/_components/VulnerabilityAlertCard.tsx` — For each active (non-expired, non-dismissed) vulnerability. Amber card: "[Competitor] appears to have an AI accuracy issue — Perplexity is showing uncertain hours. This window typically closes in 14 days." CTA: "Create targeted content →" links to content brief generator pre-filled with the competitor's gap query. Dismissible. `expires_at` shown as countdown. data-testid="vulnerability-alert-{id}".

#### Modified Files

- `app/dashboard/compete/page.tsx` — Fetch and render `VulnerabilityAlertCard` components above `InterceptCard` list. Agency plan gate via `PlanGate`.

#### Unit Tests

`src/__tests__/unit/competitor-vulnerability.test.ts` — **16 tests**

- `analyzeCompetitorContext` detects "hours may vary" pattern
- `analyzeCompetitorContext` detects "permanently closed" pattern
- `analyzeCompetitorContext` detects negative sentiment context
- `analyzeCompetitorContext` returns empty when no signals
- `analyzeCompetitorContext` extracts evidence_snippet ≤ 200 chars
- `detectCompetitorVulnerabilities` never throws
- Alert expires_at set to detected_at + 14 days
- VulnerabilityAlertCard renders competitor name
- VulnerabilityAlertCard shows days remaining
- VulnerabilityAlertCard dismissible
- VulnerabilityAlertCard not rendered after expires_at
- VulnerabilityAlertCard "Create targeted content" link present
- Agency gate: not rendered for growth plan
- Agency gate: rendered for agency plan
- Cron registered in vercel.json
- Kill switch disables cron

#### E2E Smoke Test

`tests/e2e/s26-competitor-vulnerability.spec.ts` — **3 scenarios**

1. VulnerabilityAlertCard renders on Compete page for agency user (mocked data)
2. Alert card dismissible
3. Non-agency user sees plan gate instead

#### Kill Switch

`STOP_COMPETITOR_VULNERABILITY_CRON=true`

#### Definition of Done

- [ ] Migration applied with RLS
- [ ] `detectCompetitorVulnerabilities()` identifies 3 signal types
- [ ] VulnerabilityAlertCard renders with countdown and CTA
- [ ] Cron registered, Agency plan gate enforced
- [ ] All 16 unit tests pass
- [ ] All 3 E2E scenarios pass
- [ ] `npx next build` passes

---

### S27 — First 24 Hours Reveal + Monthly AI Health Report

**AI_RULES §227** · Wave 4 · Requires S14 + S15 + S17

**Objective:** New users see a personal reveal of what AI is saying about their business within the first 5 minutes. Monthly, every org receives a structured report showing wins, outstanding issues, and year-to-date recovery.

#### New Files

- `app/dashboard/_components/FirstScanRevealCard.tsx` — Full-screen overlay card (shown once, dismissed via localStorage `lv_first_reveal_shown`). Shows: AI Mentions %, AI Errors Found (N issues), Monthly Impact (-$X), most critical error quoted verbatim from `claim_text`. CTA: "See your personalized fix plan →" (dismisses card, scrolls to CoachBriefCard). Smooth fade-in animation (300ms). Respects `prefers-reduced-motion`. data-testid="first-scan-reveal-card".
- `lib/services/monthly-report.service.ts` — `generateMonthlyReport(supabase, orgId, locationId, month: Date): Promise<MonthlyReport>`. Queries: wins in month, fixed hallucinations count, revenue_recovered_monthly sum, reality_score start vs end of month, SOV start vs end of month. Returns structured `MonthlyReport` object with all fields. Pure aggregation, no AI calls.
- `emails/monthly-report.tsx` — React Email template. Sections: "WINS THIS MONTH" (fixed count, revenue recovered, AI mentions improvement), "STILL OUTSTANDING" (open alert count with dollar impact), "YEAR-TO-DATE" (total recovery sum, errors caught, avg detection time). Design: matches existing email theme wrapper. Requires `RESEND_API_KEY`.
- `app/api/cron/monthly-report/route.ts` — Monthly cron, 1st of month 9 AM UTC. Growth+ orgs only. Sends `sendMonthlyReport()` via Resend. Kill switch: `STOP_MONTHLY_REPORT_CRON`. Respects `notify_weekly_digest` org preference (since no separate monthly preference exists yet — add `notify_monthly_report boolean DEFAULT true` to organizations in migration).
- `lib/email.ts` — Add `sendMonthlyReport(to: string, report: MonthlyReport): Promise<void>`.

#### Migration

`supabase/migrations/20260502000004_monthly_report.sql`

```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS notify_monthly_report boolean NOT NULL DEFAULT true;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS first_scan_completed_at timestamptz;
```

#### Modified Files

- `app/dashboard/page.tsx` — Check `first_scan_completed_at IS NULL AND sov_evaluations count > 0` → set `first_scan_completed_at = now()` and pass `isFirstScan = true` to `<FirstScanRevealCard />`. Only renders when `isFirstScan = true AND localStorage key not set`.
- `app/api/cron/sov/route.ts` — After first scan completion per org: update `first_scan_completed_at` if currently null.
- `vercel.json` — Add `{ "path": "/api/cron/monthly-report", "schedule": "0 9 1 * *" }`.

#### Unit Tests

`src/__tests__/unit/monthly-report.test.ts` — **18 tests**

- `generateMonthlyReport` counts wins in current month only
- `generateMonthlyReport` sums revenue_recovered_monthly correctly
- `generateMonthlyReport` computes score delta (end - start of month)
- `generateMonthlyReport` computes SOV delta
- `generateMonthlyReport` counts open alerts
- `generateMonthlyReport` computes year-to-date recovery correctly
- `generateMonthlyReport` handles month with no wins
- `generateMonthlyReport` handles month with no fixed hallucinations
- Email template renders wins section when wins present
- Email template renders outstanding section
- Email template renders year-to-date section
- `sendMonthlyReport` never throws
- FirstScanRevealCard renders on first scan
- FirstScanRevealCard dismissed after first view (localStorage)
- FirstScanRevealCard not rendered when localStorage key set
- FirstScanRevealCard shows verbatim claim_text
- Cron registered in vercel.json
- Kill switch disables cron

#### E2E Smoke Test

`tests/e2e/s27-first-reveal.spec.ts` — **4 scenarios**

1. New user's first dashboard visit shows FirstScanRevealCard (mocked first_scan=true)
2. Dismissing card sets localStorage key
3. Revisiting dashboard does NOT show card (key already set)
4. "See your personalized fix plan" CTA dismisses overlay

#### Kill Switch

`STOP_MONTHLY_REPORT_CRON=true`

#### Definition of Done

- [ ] Migration applied
- [ ] `generateMonthlyReport()` aggregates correctly across all report sections
- [ ] Email template renders all 3 sections
- [ ] Monthly cron registered, Growth+ gate enforced
- [ ] FirstScanRevealCard shown once to new users
- [ ] All 18 unit tests pass
- [ ] All 4 E2E scenarios pass
- [ ] `npx next build` passes

---

### S28 — Cross-Platform Consistency Score + Integration Pass

**AI_RULES §228** · Wave 4 · Requires S17 + S19 + all Wave 1-3 sprints

**Objective:** A single 0–100 score aggregates business info accuracy across all AI-relevant platforms. Full integration pass validates all S14-S28 features work together, with no regressions, and the NAV_ITEMS reflect the new navigation architecture from §12.

#### Migration

`supabase/migrations/20260502000005_consistency_scores.sql`

```sql
CREATE TABLE consistency_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id),
  consistency_score int NOT NULL,
  name_score int NOT NULL DEFAULT 0,
  address_score int NOT NULL DEFAULT 0,
  phone_score int NOT NULL DEFAULT 0,
  hours_score int NOT NULL DEFAULT 0,
  menu_score int NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, location_id, snapshot_date)
);
CREATE INDEX consistency_scores_org_idx ON consistency_scores(org_id, snapshot_date DESC);
ALTER TABLE consistency_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON consistency_scores FOR SELECT
  USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_all" ON consistency_scores FOR ALL
  TO service_role USING (true) WITH CHECK (true);
```

#### New Files

- `lib/services/consistency-score.service.ts` — `computeConsistencyScore(supabase, orgId, locationId): Promise<ConsistencyScoreResult>`. Reads from: `location_integrations` (connected platforms), `nap_discrepancies` (field-level discrepancies), `entity_checks` (confirmed/missing), `listing_snapshots` (latest per platform). Applies formula from §13.9: name×30 + address×25 + phone×20 + hours×15 + menu×10. `writeConsistencySnapshot(supabase, orgId, locationId, result): Promise<void>`.
- `app/dashboard/_components/ConsistencyScoreCard.tsx` — Card on main dashboard (below WeeklyKPIChips). Shows score as a dial (0-100). 5 sub-scores as bars. Trend: vs last week. Tooltip: "How consistently your business info matches across Google, Yelp, Apple Maps, Bing, and other platforms AI uses to learn about you." data-testid="consistency-score-card". Hidden in sample mode.

#### Modified Files

- `app/api/cron/nap-sync/route.ts` — After NAP sync completes per org: call `computeConsistencyScore()` + `writeConsistencySnapshot()`. Fire-and-forget, non-critical.
- `app/dashboard/page.tsx` — Add `fetchConsistencyScore()` to dashboard data. Render `<ConsistencyScoreCard />`.
- `components/layout/Sidebar.tsx` — **Navigation Architecture Pass (§12.2)**: Reorganize NAV_GROUPS to match outcome-based structure: TODAY (Dashboard, AI Mistakes, Lost Sales), THIS WEEK (AI Mentions, Competitors, Voice Search, Menu), THIS MONTH (Posts, Calendar, Platforms, AI Recognition, Local Comparison), ADVANCED (AI Actions, Website Checkup, AI Says, AI Assistant, Listings, Business Info, Update Tracking, AI Bot Visits, Your Sources, Your Position, Playbooks). Admin group remains. Collapsible groups (ADVANCED collapsed by default). Update `localStorage` key from `lv_sidebar_expanded_groups` to preserve backward compat.
- `docs/AI_RULES.md` — Add §214-§228 entries.

#### Integration Pass Tests

`src/__tests__/unit/s14-s28-integration.test.ts` — **20 tests**

- FixGuidance present for all 6 categories (S14 regression)
- BeforeAfterCard renders in Resolved column (S15 regression)
- Score attribution popover renders on score delta (S16 regression)
- WinsFeed renders wins correctly (S17 regression)
- ContentImpactBadge renders on published drafts (S18 regression)
- SOVDollarCallout renders on AI Mentions page (S19 regression)
- HealthStreakBadge renders with correct count (S20 regression)
- MilestoneCelebration triggers on score threshold cross (S20 regression)
- DayOfWeek urgency badge renders Tue-Thu only (S21 regression)
- PlatformFixLinks all have valid https:// URLs (S21 regression)
- DegradationAlertBanner dismisses via sessionStorage (S22 regression)
- CorrectionTimingBadge renders percentile badge (S23 regression)
- AIDemandBadge renders on menu items (S24 regression)
- ShopperInsightCard renders failure turn (S25 regression)
- VulnerabilityAlertCard renders for Agency (S26 regression)
- FirstScanRevealCard dismissed via localStorage (S27 regression)
- ConsistencyScoreCard renders on dashboard (S28)
- Consistency sub-scores sum correctly to weighted total (S28)
- NAV_GROUPS has TODAY/THIS WEEK/THIS MONTH/ADVANCED structure (S28)
- `npx next build` passes — 0 TypeScript errors

`src/__tests__/unit/consistency-score.test.ts` — **14 tests**

- Score 0 when all platforms missing
- Score 100 when all platforms match
- Name mismatch deducts 30pts
- Address mismatch deducts 25pts
- Phone mismatch deducts 20pts
- Hours mismatch deducts 15pts
- Menu missing deducts 10pts
- Partial platforms: weighted by configured platforms
- ConsistencyScoreCard renders with score value
- ConsistencyScoreCard shows 5 sub-score bars
- ConsistencyScoreCard shows trend vs last week
- Tooltip text explains the metric in plain English
- data-testid="consistency-score-card" present
- Hidden in sample mode

#### E2E Smoke Test

`tests/e2e/s28-consistency-integration.spec.ts` — **5 scenarios**

1. ConsistencyScoreCard visible on main dashboard
2. New NAV_GROUPS structure: TODAY/THIS WEEK/THIS MONTH/ADVANCED visible
3. ADVANCED group collapsed by default
4. Full dashboard loads without errors after all S14-S28 changes
5. All existing smoke tests still pass (sprint-g-smoke, sprint-i-smoke, sprint-k-smoke referenced)

#### Regression Guard — Complete Test Suite

All of the following must pass before S28 is merged:

- All 6,200+ existing Vitest tests
- All 160+ Playwright E2E tests (chromium project)
- `npx next build` with no TypeScript errors
- `npm audit` — 0 HIGH vulnerabilities

#### Definition of Done

- [ ] Migration applied
- [ ] `computeConsistencyScore()` uses formula from §13.9
- [ ] `writeConsistencySnapshot()` called from NAP sync cron
- [ ] ConsistencyScoreCard renders on main dashboard
- [ ] Navigation reorganized per §12.2 outcome-based architecture
- [ ] `docs/AI_RULES.md` updated with §214-§228
- [ ] All 34 new unit tests pass (consistency 14 + integration 20)
- [ ] All 5 E2E scenarios pass
- [ ] Zero regressions across full test suite
- [ ] `npx next build` passes

---

### Sprint Summary Table

| Sprint | Section | Wave | New Files | Migrations | Unit Tests | E2E Tests | Plan Gate |
|---|---|---|---|---|---|---|---|
| S14 | §214 | 1 | 2 | 1 | 28 | 4 | All |
| S15 | §215 | 1 | 3 | 0 | 28 | 4 | All |
| S16 | §216 | 1 | 3 | 0 | 28 | 4 | Starter+ (Intent) |
| S17 | §217 | 2 | 4 | 1 | 28 | 4 | All |
| S18 | §218 | 2 | 3 | 1 | 16 | 4 | All |
| S19 | §219 | 2 | 2 | 0 | 12 | 4 | All |
| S20 | §220 | 3 | 5 | 0 | 30 | 4 | All |
| S21 | §221 | 3 | 2 | 0 | 28 | 4 | All |
| S22 | §222 | 4 | 4 | 1 | 20 | 3 | Growth+ (email) |
| S23 | §223 | 4 | 4 | 0 | 18 | 3 | All (data gate) |
| S24 | §224 | 4 | 3 | 0 | 16 | 3 | All |
| S25 | §225 | 4 | 5 | 1 | 20 | 3 | Growth+ |
| S26 | §226 | 4 | 3 | 1 | 16 | 3 | Agency |
| S27 | §227 | 4 | 4 | 1 | 18 | 4 | Growth+ (report) |
| S28 | §228 | 4 | 3 | 1 | 34 | 5 | All |
| **Total** | | | **51** | **8** | **350** | **56** | |

### New Crons Added (S14–S28)

| Cron | Schedule | Sprint | Kill Switch |
|---|---|---|---|
| `/api/cron/degradation-check` | `0 10 * * 1` Mon | S22 | `STOP_DEGRADATION_CHECK_CRON` |
| `/api/cron/correction-benchmarks` | `0 5 * * 6` Sat | S23 | `STOP_CORRECTION_BENCHMARKS_CRON` |
| `/api/cron/ai-shopper` | `0 5 * * 3` Wed | S25 | `STOP_AI_SHOPPER_CRON` |
| `/api/cron/competitor-vulnerability` | `0 8 * * 2` Tue | S26 | `STOP_COMPETITOR_VULNERABILITY_CRON` |
| `/api/cron/monthly-report` | `0 9 1 * *` 1st | S27 | `STOP_MONTHLY_REPORT_CRON` |

**Total crons after S28:** 31 (was 26)

### New Env Vars Added (S14–S28)

Add all of the following to `.env.local.example`:

```
STOP_WIN_RECORDER=            # S17: disable win recording
STOP_DEGRADATION_CHECK_CRON=  # S22: disable AI degradation detection
STOP_CORRECTION_BENCHMARKS_CRON= # S23: disable benchmark computation
STOP_AI_SHOPPER_CRON=         # S25: disable AI shopper simulation
STOP_COMPETITOR_VULNERABILITY_CRON= # S26: disable vulnerability detection
STOP_MONTHLY_REPORT_CRON=     # S27: disable monthly report emails
```

### Engineering Quality Bars

Every sprint in S14–S28 must satisfy all of the following before being marked done:

1. **Zero regressions** — all prior tests pass unchanged
2. **First-pass build** — `npx next build` succeeds with no TypeScript errors
3. **Security** — no new `process.env` references without `.env.local.example` documentation
4. **RLS** — every new table with `org_id` has RLS enabled with `org_isolation_select` policy
5. **Fail-open** — every new integration (DB write, email send, cron side-effect) wraps in try/catch + Sentry, never throws
6. **Pure services** — no service in `lib/services/` creates its own Supabase client
7. **Kill switches** — every new cron has a `STOP_*_CRON` env var checked at the top of the route handler
8. **Accessibility** — every new interactive element has `aria-label` or is wrapped in semantic HTML
9. **Test coverage** — pure functions ≥ 90% branch coverage, UI components tested with jsdom
10. **Cron registration** — every new cron registered in `vercel.json` before the sprint closes

---

### Here is my prompt

DO NOT WRITE CODE YET

Read the Documentation: Ingest and analyze the pertinent document(s) and any relevant existing project files to fully understand the architecture and the goal.

Analyze Existing State: Review the current codebase where changes will be made to understand dependencies and existing functionality.

Propose the Plan: Outline your implementation plan briefly, confirming how you will achieve the goal without introducing regressions.

Phase 2: Execution

Write the Code: Implement the feature following strict engineering best practices. Ensure the code is modular, readable, and highly maintainable.

No Regressions: Double-check your logic against existing functionality. If a change risks breaking an existing feature, stop and find a safer approach.

Phase 3: Validation (Testing)
Write comprehensive tests for all new code before finalizing the task:

Unit Tests: Isolate and test the new functions/components.

E2E Tests: Ensure the user flow works from start to finish.

Smoke Tests: Provide a lightweight test to immediately verify the critical path is functional upon deployment.

Phase 4: Documentation

Update any relevant markdown files, inline comments, or API documentation to reflect the new changes.

Append a summary of your implemented changes, architectural decisions, and the testing strategy used directly into the main pertinent document.

---

*End of document. Next review: 2026-04-06.*
*Owner: Product Engineering. Questions: reference AI_RULES.md §211+*
