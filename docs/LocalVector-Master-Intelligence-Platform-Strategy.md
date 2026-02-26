# LocalVector.ai — Master Intelligence Platform Strategy

**Date:** February 26, 2026
**Version:** 1.0 — Unified Audit + LLM Strategy + Actionable Vision
**Scope:** Complete blueprint for transforming LocalVector from a monitoring tool into a closed-loop AI visibility growth engine

---

## The Big Idea: The Intelligence Flywheel

Every feature in LocalVector should feed a single continuous cycle. This is the architecture that separates a $29/month dashboard from a $199/month growth engine:

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE INTELLIGENCE FLYWHEEL                     │
│                                                                  │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│   │  MONITOR  │───▶│ IDENTIFY  │───▶│PRESCRIBE │───▶│ GENERATE  │ │
│   │          │    │          │    │          │    │          │ │
│   │ 7 engines│    │ AI gaps  │    │ Ranked   │    │ Snippets │ │
│   │ crawlers │    │ schema   │    │ actions  │    │ content  │ │
│   │ citations│    │ hallucin.│    │ with ROI │    │ schema   │ │
│   │ SOV      │    │ freshness│    │ estimate │    │ posts    │ │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│        ▲                                               │        │
│        │           ┌──────────┐    ┌──────────┐        │        │
│        │           │  PROVE   │◀───│  INJECT   │◀───────┘        │
│        │           │          │    │          │                  │
│        └───────────│ Before/  │    │ 1-click  │                  │
│                    │ After    │    │ publish  │                  │
│                    │ timeline │    │ or copy  │                  │
│                    └──────────┘    └──────────┘                  │
│                                                                  │
│              Every cycle makes the next one smarter              │
└─────────────────────────────────────────────────────────────────┘
```

The flywheel is self-reinforcing: monitoring data feeds identification, identification feeds prescriptions, prescriptions generate assets, assets get injected, and then monitoring measures the impact — which proves ROI and motivates the next cycle.

---

## Part 1: Current State Audit (What We Have, What's Broken)

### Sprint 63-67 Verification — All Clear ✅

| Sprint | Delivered |
|--------|-----------|
| 63 — DB Types | 1,817-line `database.types.ts`, `as any` casts: 118 → 4 (non-Supabase) |
| 64 — Dashboard Extract | `page.tsx`: 447 → 118 lines. Data layer + aggregators extracted. |
| 65 — SOV Precision | Formulas clarified with `toFixed()` equivalents. |
| 66 — README | Boilerplate replaced. `package.json` name fixed. |
| 67 — Critical Tests | Stripe webhook (402 lines) + email service (226 lines) tests added. |

### Critical Bugs Found

**🔴 `ai_audits` table never written to.** The audit cron writes hallucinations to `ai_hallucinations` but never creates the parent `ai_audits` row. The main dashboard reads `ai_audits` for "Last Scan" timestamp — this is permanently `null` for every customer. Every user sees "Last Scan: never" even after their first cron run.

**🔴 AI Assistant not in sidebar.** The `/dashboard/ai-assistant` page exists and works but has no navigation entry. Users can only reach it by typing the URL.

### Dead Infrastructure

**5 orphaned schema tables** with zero code references:

| Table | Purpose (Intended) | Status |
|-------|-------------------|--------|
| `business_info` | Pre-`locations` entity store | Superseded. Drop candidate. |
| `directories` | Track which directories feed AI models | Never wired. Needed for Citation Intelligence v2. |
| `pending_gbp_imports` | GBP OAuth import staging | Phase 8 prereq. Keep. |
| `visibility_scores` | Multi-dimensional scoring | Superseded by `visibility_analytics`. Drop candidate. |
| `crawler_hits` | AI bot crawl tracking | Schema ready but no middleware. Critical future feature. |

**Uncomputed columns:** `visibility_analytics.sentiment_gap` exists but is never written to. `ai_audits.*` entire table is write-orphaned.

**Dead exports:** `buildReferenceLibrary()` in `prompt-intelligence.service.ts` is exported but never called.

### What's Collected but Never Shown

| Data | Stored In | Displayed? | Opportunity |
|------|----------|-----------|-------------|
| Full AI response text per SOV query | `sov_evaluations.raw_response` | ❌ | **"AI Says" Response Library** — the #1 wow feature |
| Per-dimension page audit scores | `page_audits` (5 sub-scores) | ⚠️ Only composite shown | Show individual scores with fix generators |
| Competitor action_status workflow | `competitor_intercepts.action_status` | ⚠️ Shown, no workflow | Add "mark as done" UI |
| Citation query prompts used | `citation_source_intelligence.prompt_used` | ❌ | Show users what prompts were tested |
| Cron run history/health | `cron_run_log` | ❌ | System health dashboard |

### Hygiene Issues

- 39 `console.log` statements in production code
- 8 `: any` types in Chat.tsx component props
- 14 files with hardcoded "Charcoal N Chill" references
- Citation engine has hardcoded `TRACKED_CATEGORIES` and `TRACKED_METROS` (needs to be tenant-derived)
- Billing page `.then(setPlanInfo)` without `.catch()` — swallows errors silently

---

## Part 2: The Engine Architecture — Monitor Everything That Matters

### AI Engine Coverage Strategy

**Current coverage: 4 engines (~83% of market)**

| Engine | Model | Current Use | Market Share |
|--------|-------|------------|-------------|
| OpenAI | GPT-4o / GPT-4o-mini | Fear, Greed, Page Audit | ~60% |
| Perplexity | Sonar | SOV, Greed Stage 1 | ~6% |
| Anthropic | Claude Sonnet 4 | Truth Audit | ~3-4% |
| Google | Gemini 2.0 Flash | Truth Audit | ~13.5% |

**Engines to add (in priority order):**

#### 1. Google AI Overviews (Search Grounding) — THE biggest gap

This isn't a chatbot — it's the AI answer that appears at the top of 47% of Google commercial searches. When someone Googles "best hookah lounge Alpharetta," the AI Overview IS the answer. This is where most humans encounter AI-generated restaurant recommendations.

**Why it's different from Gemini:** Current Gemini queries test what Gemini *thinks* in isolation. Google AI Overviews pull from Google's search index, Google Business Profile, Maps data, and reviews — the full Google ecosystem. A restaurant could score well in isolated Gemini queries but be invisible in actual Google search AI Overviews.

**Unique data:** "Here's what appears when someone Googles your category. Your competitor is in the AI Overview. You're not. Here's why."

**Implementation:** Gemini with Google Search grounding enabled (already supported in Vercel AI SDK), or Google Custom Search API with `ai_overview` parameter.

#### 2. Microsoft Copilot / Bing — 14% market share, different data source

Uses Bing's index (not Google's). For local businesses, Copilot pulls from Bing Places, Yelp, and TripAdvisor — different citation sources than ChatGPT. A restaurant with a complete Google Business Profile but an empty Bing Places listing will have a split personality across AI engines.

**Unique data:** "You're visible in ChatGPT but invisible in Copilot. Your Bing Places listing is missing [hours/photos/description]."

**Implementation:** OpenAI API (same models, different system prompt) or Bing Web Search API.

#### 3. Grok (xAI) — Real-time social signal intelligence

Grok has live access to X/Twitter data. For restaurants, social media mentions are a unique signal that no other engine uses. A viral tweet about your restaurant shows up in Grok recommendations within hours.

**Unique data:** "Your competitor has 4x more social mentions this month — that's why Grok recommends them over you for 'hookah bar near me.'"

**Implementation:** xAI API (grok-2 model). Community Vercel AI SDK support available.

#### 4. DeepSeek + Meta AI — Long-tail and future-proofing

DeepSeek is the cheapest frontier model ($0.14/M tokens) and is being integrated into many third-party apps. Meta AI is embedded in Instagram, Facebook, and WhatsApp — the apps restaurants already use for marketing. Both are premium/agency tier features.

**Recommended tier mapping:**

| Plan | Engines | Pitch |
|------|---------|-------|
| Starter ($49) | OpenAI + Perplexity | "See what the top 2 AI engines say about you" |
| Growth ($149) | + Google AI Overviews + Copilot + Gemini | "Full coverage of 90% of AI traffic" |
| Agency ($299) | + Grok + Claude + DeepSeek | "Every AI engine, every week, every client" |

### AI Crawler Analytics — The BIG WOW Nobody in Local AEO Has

**This is a feature gap across the entire local restaurant AEO market.** Profound and Goodie offer crawler analytics for enterprise brands, but no tool built for local restaurants provides this.

**What it is:** Track which AI bots (GPTBot, ClaudeBot, PerplexityBot, GoogleBot, OAI-SearchBot, Meta-ExternalAgent, Bytespider, Applebot) are crawling your Magic Menu pages, how often, which pages they visit, and whether they get errors.

**Why it's a massive wow for restaurant owners:** "GPTBot visited your menu page 47 times this month. ClaudeBot visited 12 times. PerplexityBot: 0 times — that's why Perplexity doesn't know your menu."

**The insight chain:**
- "GPTBot is crawling your site → ChatGPT knows about you ✅"
- "PerplexityBot has NEVER crawled your site → Perplexity is guessing about you ❌"
- "Here's how to get PerplexityBot to discover your menu: [submit URL / update robots.txt / add llms.txt]"

**Implementation:** You already have the `crawler_hits` table in the schema. The proxy middleware (`proxy.ts`) is the perfect place to detect AI bot user-agent strings and log hits. Add a "Bot Activity" card to the main dashboard showing crawler visit counts over time, with a drill-down page showing per-bot, per-page detail.

**Known AI bot user-agents to track:**
- `GPTBot/1.0` — OpenAI training
- `OAI-SearchBot/1.0` — ChatGPT live search
- `ChatGPT-User/1.0` — ChatGPT browsing
- `ClaudeBot/1.0` — Anthropic training
- `Google-Extended` — Gemini training
- `PerplexityBot/1.0` — Perplexity search
- `meta-externalagent` — Meta AI training
- `Bytespider` — ByteDance/TikTok
- `Amazonbot` — Amazon AI
- `Applebot-Extended` — Apple Intelligence

This is a genuine differentiator. Profound charges $399/month for Agent Analytics. LocalVector can offer it at every tier because the data comes from the customer's own Magic Menu pages (which we host).

---

## Part 3: The Actionable Intelligence Layer — Every Score Gets a Fix

### The "So What? Now What?" Framework

Most AEO tools show dashboards. LocalVector should show dashboards WITH a "Fix This" button on every finding. The framework has 5 stages:

```
DETECT → DIAGNOSE → PRESCRIBE → GENERATE → PROVE
```

### 3A. Schema Intelligence Engine (NEW)

**Current gap:** Page auditor says "FAQ Schema: 0/100" and stops. User has no idea what FAQ schema is or how to add it.

**The full chain:**

| Stage | What Happens | What User Sees |
|-------|-------------|---------------|
| DETECT | Page auditor finds missing FAQPage schema | "❌ No FAQ schema found on your homepage" |
| DIAGNOSE | Compare against competitors + cite research | "Pages with FAQ schema are 3.2x more likely to be cited by AI Overviews. Your competitor has 8 FAQ items. You have zero." |
| PRESCRIBE | Rank which schema types to add by impact | "Priority 1: FAQPage (+est. 15% citation lift). Priority 2: Restaurant with Menu link (+est. 10%). Priority 3: Event for upcoming occasions." |
| GENERATE | Auto-create complete JSON-LD code blocks | Full copy-to-clipboard JSON-LD using the business's ACTUAL data from LocalVector (hours from `locations`, menu from `menu_items`, questions from `target_queries`) |
| PROVE | Track page audit score changes after implementation | "Feb 1: FAQ score 0, SOV 12% → Feb 22: FAQ score 85, SOV 19% (+58%)" |

**Schema types to auto-generate for restaurants:**

| Schema | Data Source in LocalVector | AI Impact |
|--------|---------------------------|-----------|
| `Restaurant` (or `BarOrPub`, `NightClub`) | `locations` table | Core entity identity — AI knows WHAT you are |
| `Menu` + `MenuItem` | `magic_menus` + `menu_items` | Directly cited in "what should I order" queries |
| `OpeningHoursSpecification` | `locations.hours_data` | Fixes the #1 hallucination category (wrong hours) |
| `FAQPage` | Auto-generated from `target_queries` + SOV data | 3.2x higher AI Overview citation rate |
| `LocalBusiness` with `geo` + `areaServed` | `locations` | NAP disambiguation for "near me" queries |
| `Event` | `local_occasions` | Freshness signal — AI weights recent content |
| `Organization` with `sameAs` | `locations` + `location_integrations` | Links entity to Yelp, TripAdvisor, Instagram profiles |
| `AggregateRating` | External (pulled from Google/Yelp) | Trust signal AI uses for recommendations |
| `ReserveAction` / `OrderAction` | `locations.website_url` | Agentic commerce readiness — future AI shopping agents |

**The key innovation:** The FAQ answers are generated from the business's ground truth data already in LocalVector, combined with real prompts from SOV evaluations. The system knows what questions AI engines ask AND what the correct answers are.

### 3B. Hallucination Response Generator

**Current gap:** Alert says "ChatGPT claims you're permanently closed." User panics, doesn't know what to do.

**The full chain:**

| Stage | Output |
|-------|--------|
| DETECT | "OpenAI GPT-4o claims 'Charcoal N Chill appears to be permanently closed.'" |
| DIAGNOSE | "This hallucination appears because your GBP hasn't been updated in 6 months. AI models weight recency — stale profiles get flagged as potentially closed." |
| PRESCRIBE | 3 ranked actions: (1) Update GBP, (2) Publish correction content, (3) Create social proof |
| GENERATE | Pre-written GBP post, website "About" update, social media post, and corrected `llms.txt` entry — all using the business's actual data |
| PROVE | "Feb 1: 'permanently closed' hallucination detected → Feb 15: GPT-4o now says 'actively operating'" |

### 3C. SOV Gap → Content Brief Generator

**Current gap:** "0% SOV for 'birthday party venue Alpharetta'" but no next step.

**The full chain:**

| Stage | Output |
|-------|--------|
| DETECT | "No AI engine mentions you for 'best birthday party venue Alpharetta'" |
| DIAGNOSE | "First Mover opportunity — no competitor dominates either. First business to create authoritative content for this query will own it." |
| PRESCRIBE | "Create a dedicated page targeting this query" |
| GENERATE | Full content brief: suggested URL, title tag, H1, AEO-optimized outline (Answer Capsule in first paragraph, package details, FAQ section), JSON-LD `Event` schema, `llms.txt` entry — using actual queries from SOV data |
| PROVE | Track SOV for this query over time. Show "Before: 0% → After: mentioned in 2/4 engines" |

### 3D. Competitor Counter-Strategy Generator

**Current gap:** "Competitor wins 7/10 head-to-head comparisons." User feels bad. Nothing happens.

**The full chain:**

| Stage | Output |
|-------|--------|
| DETECT | "Astra Hookah wins on 'ambiance' and 'food quality' factors" |
| DIAGNOSE | "AI cites Astra 3x more because they have: FAQPage schema you lack, 23 Google reviews mentioning 'ambiance' vs your 8, a dedicated events page" |
| PRESCRIBE | Ranked actions by estimated impact: (1) Add FAQPage schema [est. +15% citation], (2) Encourage reviews mentioning 'ambiance' [est. +10%], (3) Create events page [est. +8%] |
| GENERATE | Each prescription has a one-click generator: schema snippet, review request email template, content brief |
| PROVE | Track head-to-head win rate changes: "Feb: 3/10 wins → Mar: 5/10 wins" |

### 3E. Citation Gap → Directory Optimization

**Current gap:** "Yelp cited 34% of the time for your category" — interesting but not actionable.

**The full chain:**

| Stage | Output |
|-------|--------|
| DETECT | "Yelp is the #1 cited directory for hookah lounges in Alpharetta" |
| DIAGNOSE | "Your Yelp profile is incomplete: 0 photos, no business description, missing amenities. Complete profiles are 2.4x more likely to be cited." |
| PRESCRIBE | "Complete these 5 fields on Yelp" |
| GENERATE | Pre-written Yelp description, suggested categories, photo upload checklist — using ground truth from LocalVector. Same for TripAdvisor, Apple Maps, Bing Places. |
| PROVE | Track citation rate changes for each platform over time |

### 3F. Smart `llms.txt` — Auto-Generated, Auto-Updated, Hallucination-Correcting

**Current state:** Static `llms.txt` on Magic Menu pages.

**What it should be:** A living document that auto-updates whenever ANY ground truth changes in LocalVector, including:

- Business entity description with `sameAs` links
- Complete menu with prices, dietary info, descriptions
- Current hours + special/holiday hours
- Upcoming events and local occasions
- FAQ content derived from real SOV queries
- **Hallucination correction notices:** "Note for AI models: Contrary to some responses, this restaurant is NOT permanently closed. Current verified hours: [hours]. Last verified: [date]."
- Schema.org entity identifiers for disambiguation

The hallucination correction section is unique. No competitor does this. It's a proactive signal to AI crawlers that specifically addresses known inaccuracies.

---

## Part 4: Dashboard — The Wow Factor

### 4A. "AI Says" Response Library — Highest Wow, Lowest Effort

**What user sees:** Side-by-side view of EXACT AI responses for their business:

```
Query: "best hookah bar near Alpharetta"

ChatGPT: "Charcoal N Chill is a popular hookah lounge in
         Alpharetta known for its premium atmosphere and
         Indo-American fusion cuisine..."

Perplexity: "Several hookah bars operate in the Alpharetta
            area. Based on recent reviews, options include..."

Gemini: [Not mentioned]

Copilot: [Not mentioned]
```

**Why it's the #1 wow feature:** Restaurant owners can literally READ what AI tells their customers. They screenshot it, send it to their business partners, show it to their staff. It makes AI visibility REAL in a way no score or chart can. It also makes the problem tangible — seeing "Not mentioned" next to a competitor's glowing review creates urgency that drives action.

**Implementation cost:** Near-zero. You're already storing `sov_evaluations.raw_response`. Build a read page.

### 4B. AI Health Score — One Number to Rule Them All

**What user sees:** A single 0-100 score broken into 5 weighted components:

| Component | Weight | Source | What It Measures |
|-----------|--------|--------|-----------------|
| Accuracy | 25% | Truth Score (multi-engine eval) | "Is AI telling the truth about you?" |
| Visibility | 25% | SOV across all engines | "How often does AI recommend you?" |
| Structure | 20% | Page audit scores + schema check | "Can AI understand your website?" |
| Freshness | 15% | GBP age, content recency, last edit | "Is your data current enough for AI?" |
| Authority | 15% | Citation rate, directory presence, reviews | "Does AI trust you?" |

**Why it matters:** Restaurant owners don't want to learn AEO theory. They want one number — "am I healthy or sick?" — and one action — "what's the single most impactful thing I can do this week?"

The score includes a "Top Recommendation" that surfaces the highest-impact action: "Your biggest opportunity: Add FAQ schema (+est. 8 points). [Generate Schema →]"

### 4C. Revenue Impact Calculator — Turn Scores Into Dollars

**What user sees:** "Your AI visibility gaps are costing you an estimated $2,400/month."

The math (using data already in LocalVector):
- SOV shows competitor is recommended 23% more often
- Revenue config has avg customer value ($45) and monthly covers
- Calculate: (competitor_advantage × estimated_ai_queries × avg_value) = monthly opportunity

**Why it drives renewals:** Abstract "visibility scores" don't renew subscriptions. Dollar amounts do. "LocalVector identified $2,400/month in lost revenue and helped you recover 60% of it" is a testimonial that writes itself.

### 4D. AI Crawler Dashboard — "Who's Reading Your Menu?"

**What user sees:** A card on the main dashboard:

```
🤖 AI Bot Activity (Last 30 Days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GPTBot          47 visits  ✅ ChatGPT knows you
OAI-SearchBot   23 visits  ✅ ChatGPT Search active
ClaudeBot       12 visits  ✅ Claude indexing
PerplexityBot    0 visits  ❌ Perplexity blind spot
GoogleExtended  89 visits  ✅ Gemini training
Applebot         3 visits  ✅ Siri/Apple Intelligence
Meta-External    0 visits  ❌ Meta AI blind spot

[2 blind spots detected → See fix recommendations]
```

**Why it's a wow:** No local restaurant AEO tool offers this. Profound charges $399/month for Agent Analytics targeting enterprise brands. LocalVector can offer this at every tier because the Magic Menu pages are hosted on our infrastructure — we control the middleware.

The drill-down shows per-page, per-bot detail with timestamps, and the "blind spot" detection automatically generates fix recommendations (submit to search engines, update robots.txt, add sitemap entries).

### 4E. Before/After Proof Timeline

**What user sees:** A visual timeline showing:

```
Feb 1  │ FAQ Schema: 0    SOV: 12%   AI Health: 54
       │ ↓ User added FAQ schema (generated by LocalVector)
Feb 8  │ FAQ Schema: 85   SOV: 12%   AI Health: 62
       │ ↓ GPTBot re-crawled menu page
Feb 15 │ FAQ Schema: 85   SOV: 17%   AI Health: 71
       │ ↓ First mention in Perplexity detected!
Feb 22 │ FAQ Schema: 85   SOV: 19%   AI Health: 74
       │
       │ 📈 +58% SOV improvement in 3 weeks
```

**Why it proves ROI:** This is the retention engine. "I did what LocalVector told me and my visibility went up 58%" converts to: testimonials, referrals, and renewals. The timeline also shows customers that the product WORKS — they're not just paying for dashboards, they're paying for outcomes.

### 4F. Weekly "AI Snapshot" Email

**What user receives (without logging in):**

```
📊 Your AI Visibility This Week
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI Health Score: 67 (+3 from last week) ▲

🔴 New Issue: GPT-4o thinks you close at 10pm
   (actual: 12am midnight)
   [Generate correction content →]

🟢 Win: Perplexity now mentions you for
   "hookah near Alpharetta" — first time!

🟡 Opportunity: Add FAQ schema for +est. 8 points
   [Generate FAQ schema →]

💰 Estimated Monthly Impact: $2,400 recoverable
```

**Why the email IS the product:** Many restaurant owners won't log into a dashboard regularly. The weekly email keeps them engaged, shows value every 7 days, and drives them back to the dashboard with specific CTAs. Every email is a renewal justification.

---

## Part 5: Missing BIG WOW Features (Not in Either Previous Document)

### 5A. 🏆 AI Shopping Agent Readiness Score

**What it is:** Evaluate whether autonomous AI agents (OpenAI Operator, Google Jarvis, Apple Intelligence Actions) can successfully complete a transaction on the customer's website — book a table, place an order, buy a gift card.

**Why it's a BIG WOW in 2026:** The industry is shifting from "AI recommends" to "AI acts." The next frontier isn't "does ChatGPT mention you?" — it's "can ChatGPT's booking agent actually reserve a table at your restaurant?" This is what Search Engine Land calls "Assistive Agent Optimization (AAO)" — being chosen when no human is in the loop.

**What to check:**
- Does the website have `ReserveAction` schema? (Can AI agent find the booking link?)
- Does the website have `OrderAction` schema? (Can AI agent place a food order?)
- Are action buttons labeled with machine-parseable text? (Not just an icon)
- Is the booking/ordering flow completeable without CAPTCHA or complex JS?
- Are prices, availability, and hours structured in schema?

**Scoring:** 0-100 "Agent Readiness" score. Show: "3 out of 5 AI agent capabilities are machine-accessible. You're missing: online ordering schema, reservation action schema."

**Why nobody else has it for restaurants:** Enterprise AEO tools (Profound, Scrunch) don't go vertical. Generic AEO tools don't test transactional flows. LocalVector, with its restaurant-specific knowledge, is uniquely positioned to build this.

### 5B. 🏆 Entity Knowledge Graph Health Monitor

**What it is:** Check whether the business exists as a recognized "entity" across the knowledge sources that AI models actually use — Wikidata, Google Knowledge Graph, Yelp's entity database, Apple Maps Connect, Bing Places, TripAdvisor.

**Why it's a BIG WOW:** Most restaurant owners don't know that AI models don't just read websites — they build knowledge graphs. If your restaurant isn't an "entity" in these graphs, AI has to GUESS about you based on web scraping. Entities get cited. Non-entities get hallucinated about.

**What to show:**

```
🏢 Entity Presence Check
━━━━━━━━━━━━━━━━━━━━━
Google Knowledge Panel  ✅ Active (4.3★, 287 reviews)
Google Business Profile ✅ Verified, updated 3 days ago
Yelp Entity            ✅ Claimed (4.0★, 156 reviews)
TripAdvisor            ❌ Not found — AI models can't
                          verify you via TripAdvisor
Apple Maps Connect     ❌ Not claimed — Siri won't
                          recommend you
Bing Places            ⚠️ Found but incomplete (no hours)
Wikidata               ❌ No entity — advanced AEO step

Entity Health: 3/6 platforms ● "At Risk"
[See fix guide for each platform →]
```

**For each missing platform**, generate a step-by-step claiming guide using the business data already in LocalVector (name, address, phone, hours, categories).

### 5C. 🏆 Real-Time AI Sentiment Tracker

**What it is:** Not just "does AI mention you?" but "HOW does AI describe you?" Track the emotional tone and specific adjectives AI engines use when discussing the business.

**Why it's different from SOV:** SOV tells you frequency. Sentiment tells you quality. A restaurant mentioned in 60% of queries but described as "mediocre" or "overpriced" has a sentiment problem that SOV alone won't reveal.

**What to track:**
- Positive descriptors used ("popular," "premium," "highly rated")
- Negative descriptors used ("inconsistent," "overpriced," "slow service")
- Neutral descriptors ("located in," "offers")
- Trend over time: Is sentiment improving or declining?

**Implementation:** Parse `sov_evaluations.raw_response` through a lightweight sentiment analysis pass. You're already storing the full text — just need to extract and categorize the adjectives used about the business.

**Why it's wow:** "ChatGPT describes your competitor as 'premium and trendy.' It describes you as 'affordable but inconsistent.' Here's a content strategy to shift that narrative."

### 5D. 🏆 AI Citation Source Intelligence — "What AI Reads About You"

**What it is:** Identify which specific web pages, review sites, articles, and social posts each AI engine uses as sources when generating answers about your business.

**Why it matters:** If ChatGPT's answer about your restaurant is based on a 2-year-old Yelp review that mentions "slow service," you need to know that. If Perplexity is citing your competitor's blog post comparing themselves favorably to you, you need to know that too.

**What to show:**

```
Sources AI Uses for "best hookah bar Alpharetta"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ChatGPT cites:
  1. Yelp review page (3 mentions of "atmosphere")
  2. Google Maps listing
  3. Competitor's blog post (!)

Perplexity cites:
  1. Your website homepage ✅
  2. TripAdvisor listing
  3. Local food blog review

🔴 Alert: Your competitor's blog ranks as a ChatGPT
   source for YOUR brand queries. Recommended action:
   Create authoritative first-party content to outrank.
```

**Implementation:** When Perplexity and Copilot return responses, they include citation URLs. Parse and store these. For ChatGPT, use the `raw_response` text to identify referenced sources (often mentioned by name even if not linked).

### 5E. 🏆 Proactive Content Calendar — AI-Driven Publishing Schedule

**What it is:** Instead of reacting to problems, proactively tell the customer WHEN to publish WHAT content based on: upcoming local occasions (already detected by Occasion Engine), seasonal query trends, competitor content gaps, and freshness decay signals.

**What user sees:**

```
📅 AI-Recommended Publishing Calendar
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This Week:
  📝 Publish: "Valentine's Day Hookah Experience"
     (Occasion Engine: Valentine's queries peak in 4 days)
     [View content brief →] [Generate draft →]

Next Week:
  📝 Update: Menu page (last updated 45 days ago)
     (Freshness signal declining — GPTBot visits dropped 30%)
     [See recommended changes →]

In 2 Weeks:
  📝 Create: "Private Events at Charcoal N Chill"
     (SOV Gap: 0% for "private event venue Alpharetta")
     [View content brief →]
```

**Why it's wow:** Transforms LocalVector from a rearview mirror ("here's what happened") into a windshield ("here's what to do next"). The content calendar is driven by actual data from every engine in the platform — occasions, SOV gaps, freshness decay, competitor moves.

---

## Part 6: Data Flow Architecture — How It All Connects

```
EXTERNAL SIGNALS                    LOCALVECTOR ENGINES                ACTIONABLE OUTPUTS
━━━━━━━━━━━━━━━                    ━━━━━━━━━━━━━━━━━━                ━━━━━━━━━━━━━━━━━
                                                                      
AI Engine Responses ──────────────▶ SOV Engine ──────────────────────▶ "AI Says" Library
  (ChatGPT, Perplexity,             │                                  SOV Trend Charts
   Gemini, Copilot, Grok)           │                                  First Mover Alerts
                                     │                                  Content Briefs
                                     ▼                                  
AI Engine Accuracy ──────────────▶ Fear Engine ─────────────────────▶ Hallucination Alerts
  (4 models verify truth)           │                                  Correction Content
                                     │                                  GBP Post Drafts
                                     ▼                                  llms.txt Corrections
                                     
Competitor AI Responses ─────────▶ Greed Engine ────────────────────▶ Intercept Reports
                                     │                                  Counter-Strategy
                                     │                                  Gap Analysis Actions
                                     ▼                                  
                                     
Website HTML + Schema ───────────▶ Page Auditor ────────────────────▶ AEO Score × 5 dims
                                     │                                  Schema Fix Generator
                                     │                                  JSON-LD Code Blocks
                                     ▼                                  
                                     
Citation Sources ────────────────▶ Citation Engine ─────────────────▶ Platform Rankings
                                     │                                  Directory Checklists
                                     │                                  Profile Optimization
                                     ▼
                                     
AI Bot Server Logs ──────────────▶ Crawler Tracker ─────────────────▶ Bot Activity Dashboard
  (GPTBot, ClaudeBot, etc.)          │   (NEW)                         Blind Spot Alerts
                                     │                                  robots.txt Fixes
                                     ▼
                                     
Location + Menu + Hours ─────────▶ Schema Generator ────────────────▶ Complete JSON-LD
  (ground truth in DB)               │   (NEW)                         Copy-to-clipboard
                                     │                                  Developer instructions
                                     ▼
                                     
Local Events + Seasons ──────────▶ Occasion Engine ─────────────────▶ Content Calendar
                                     │                                  Draft Generation
                                     │                                  Publish Reminders
                                     ▼
                                     
All Engines + Scores ────────────▶ AI Health Score ─────────────────▶ Single 0-100 Number
                                     │   (NEW)                         Top Recommendation
                                     │                                  Revenue Impact ($)
                                     ▼
                                     
Historical Snapshots ────────────▶ Proof Engine ────────────────────▶ Before/After Timeline
                                        (NEW)                          Weekly Email Report
                                                                       ROI Documentation
```

### The Closed Loop

Every engine feeds the next. Here's a concrete example of the full cycle:

1. **MONITOR:** SOV Engine finds "0% SOV for 'birthday party venue Alpharetta'"
2. **IDENTIFY:** Prompt Intelligence classifies this as a First Mover opportunity
3. **PRESCRIBE:** System ranks this as the #2 action item (behind FAQ schema)
4. **GENERATE:** Content Brief Generator creates a full AEO-optimized page spec with JSON-LD
5. **INJECT:** Customer creates the page (or we generate it via Autopilot)
6. **MONITOR:** Next SOV scan detects the business now appears for this query
7. **PROVE:** Before/After Timeline shows "0% → 25% SOV in 2 weeks"
8. **REVENUE:** Revenue Impact Calculator shows "$180/month recovered from this single query"
9. **RETAIN:** Weekly email includes "🟢 Win: You now appear for 'birthday party venue Alpharetta'"

That's the flywheel. Every cycle makes the business more visible, generates proof of ROI, and justifies the subscription.

---

## Part 7: Implementation Roadmap

### Sprint Priority Order

| Sprint | Feature | Flywheel Stage | Effort | Impact |
|--------|---------|---------------|--------|--------|
| **68** | Fix `ai_audits` bug + add AI Assistant to sidebar | Foundation | S | Critical bug |
| **69** | "AI Says" Response Library (display raw_response) | MONITOR | M | Highest wow-per-effort |
| **70** | Schema Generator (FAQ + Restaurant + Menu JSON-LD) | GENERATE | L | Core differentiation |
| **71** | Per-dimension Page Audit scores + fix recommendations | IDENTIFY → PRESCRIBE | M | Makes audits actionable |
| **72** | AI Health Score composite + Top Recommendation | IDENTIFY | M | Single-number clarity |
| **73** | AI Crawler Analytics (wire crawler_hits in middleware) | MONITOR | M | Unique differentiator |
| **74** | Google AI Overview monitoring (Gemini + search grounding) | MONITOR | M | Covers #1 AI surface |
| **75** | Hallucination → Correction Content Generator | PRESCRIBE → GENERATE | M | Closes fear loop |
| **76** | Before/After Proof Timeline | PROVE | M | Retention engine |
| **77** | SOV Gap → Content Brief Generator | PRESCRIBE → GENERATE | M | Closes growth loop |
| **78** | Weekly "AI Snapshot" Email with CTAs | PROVE | M | Engagement without login |
| **79** | Copilot/Bing monitoring | MONITOR | S | +14% market coverage |
| **80** | Entity Knowledge Graph Health Monitor | IDENTIFY | L | Wow + differentiation |
| **81** | AI Sentiment Tracker | IDENTIFY | M | Quality vs just quantity |
| **82** | Citation Source Intelligence ("What AI Reads") | IDENTIFY | M | Source-level insights |
| **83** | Proactive Content Calendar | PRESCRIBE | L | Windshield vs rearview |
| **84** | Agent Readiness Score (AAO) | IDENTIFY | L | Future-proofing |
| **85** | Revenue Impact Calculator | PROVE | M | Dollar-driven retention |

### The Competitive Moat

| What Competitors Do | What LocalVector Does |
|--------------------|----------------------|
| Monitor AI mentions | Monitor + show exact AI responses |
| Flag visibility gaps | Flag + auto-generate fix content |
| Score schema completeness | Score + generate complete JSON-LD from ground truth |
| Track citations | Track + identify which specific sources AI reads |
| Dashboard only | Dashboard + weekly actionable email |
| Monitor website | Monitor website + track AI bot crawl behavior |
| Report problems | Report problems + measure improvement after fix |
| Generic for all businesses | Purpose-built for restaurants with menu, hours, events intelligence |

**LocalVector's unique position:** It's the only platform that combines AI visibility monitoring WITH the ground truth data (menus, hours, amenities) needed to auto-generate fixes. Profound can tell you "your FAQ schema is missing" — but only LocalVector can generate the FAQ answers because it already has your business data.

---

## Appendix: Glossary of AEO/GEO/AAO Terms

| Term | Definition |
|------|-----------|
| **AEO** | Answer Engine Optimization — being the answer AI gives |
| **GEO** | Generative Engine Optimization — content AI can parse and cite |
| **AAO** | Assistive Agent Optimization — being chosen when AI acts autonomously |
| **SOV** | Share of Voice — % of relevant queries where AI mentions you |
| **Entity Salience** | How strongly a brand exists as a recognized entity in knowledge graphs |
| **Information Gain** | Whether content provides unique data not already in AI training data |
| **Answer Capsule** | 40-60 word summary answering a query directly (AEO best practice) |
| **Fan-out Queries** | Sub-queries AI generates from a complex question |
| **Zero-click Search** | When user gets the answer without visiting any website |
| **Agent Analytics** | Tracking AI bot crawler behavior on your website |
| **`llms.txt`** | Proposed web standard for providing AI crawlers structured site info |
| **E-E-A-T** | Experience, Expertise, Authoritativeness, Trustworthiness — Google's quality framework |
