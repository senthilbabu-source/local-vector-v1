# LocalVector AI Audit Tool — Gemini Brainstorm (Organized)

> **Source:** Gemini discussion dump (Feb 2026)
> **Purpose:** Clean reference for Claude Code to follow when implementing LocalVector features
> **Status:** Raw ideas organized — needs cross-referencing with existing `/docs` documentation

---

## Table of Contents

1. [Core Philosophy](#1-core-philosophy)
2. [The Four Hidden Audit Layers](#2-the-four-hidden-audit-layers)
3. [LLM Interrogation Engine — Model Coverage](#3-llm-interrogation-engine--model-coverage)
4. [Three-Phase Audit Blueprint](#4-three-phase-audit-blueprint)
5. [Metrics & Scoring Formulas](#5-metrics--scoring-formulas)
6. [Differentiator Feature: AI Response Simulation](#6-differentiator-feature-ai-response-simulation)
7. [Data Sources & Signals](#7-data-sources--signals)
8. [Implementation Priority Matrix](#8-implementation-priority-matrix)

---

## 1. Core Philosophy

LocalVector must move beyond **monitoring** into **"Influencing the Inference."**

The tool should audit the hidden layers of how Generative Engines (GEO) and Answer Engines (AEO) decide what to trust. Standard SEO audits check what's on the page. LocalVector audits **how AI models perceive, trust, and cite** a brand.

**Key Principle:** If a brand isn't an "Entity" in structured knowledge bases, no amount of on-page SEO will get it cited as a primary source by LLMs.

---

## 2. The Four Hidden Audit Layers

These are the dimensions that current audit tools miss entirely.

### 2A. Entity Salience & Knowledge Graph Health

**What it is:** LLMs don't just read a website — they map the brand as an Entity within a knowledge graph. This layer audits how well the brand exists as a recognized entity.

**Key Metric — Entity Co-occurrence:**
How often is the brand mentioned in the same vector space as the keywords it wants to own?

**Audit Steps:**
- Scan Wikidata, DBpedia, and industry-specific knowledge bases (Yelp for local, G2 for SaaS, etc.)
- Check if the brand exists as a formal Entity in these structured datasets
- Verify Schema.org `sameAs` links connecting the brand to social profiles, local directories, and Wikipedia
- Map entity relationships to competitors and category terms

**Output:** Entity presence score across knowledge bases + gap list of where the brand is missing.

---

### 2B. Information Gain Analysis

**What it is:** In 2026, LLMs prioritize unique data. If content is just a rewrite of what's already in the training set, the LLM will ignore it and synthesize the answer itself.

**Key Metric — Information Gain Score:**
Does the page provide new data, proprietary images, or unique case studies NOT found in the first 10,000 tokens of the LLM's training data on this topic?

**Audit Steps:**
- Cross-reference content against Common Crawl and RefinedWeb datasets
- Identify whether the brand is providing "New Knowledge" vs. repackaged existing info
- Flag pages that are likely to be ignored because they add zero information gain
- Score content uniqueness on a per-page basis

**Output:** Per-page Information Gain Score + recommendations for adding unique data (proprietary stats, original research, case studies, first-party imagery).

---

### 2C. Agentic Accessibility (Agent-SEO)

**What it is:** The shift from "Search" to "Action." AI Agents (OpenAI Operator, Google Jarvis, etc.) will navigate websites to perform tasks like "Book a table for 4 near me." This layer audits whether AI agents can actually USE the website.

**Key Metric — Functional Crawlability:**
Can an AI Agent (not just a traditional crawler) identify and interact with action buttons, forms, and transactional elements?

**Audit Steps:**
- Scan for Schema.org Action types: `OrderAction`, `ReserveAction`, `BuyAction`, etc.
- Verify the UI is "Agent-Readable" — labels that LLMs can parse via vision-language models
- Test whether key actions (reserve, order, contact, schedule) are machine-parseable
- Check that interactive elements have proper ARIA labels, semantic HTML, and clear affordances

**Output:** Agent-readiness score per page + specific list of actions that would fail if an AI Agent tried to execute them.

---

### 2D. Citation Ecosystem Resilience

**What it is:** Not just whether the brand gets cited, but the QUALITY and DURABILITY of those citations over time.

**Key Metric — Citation Velocity & Sentiment Decay:**
How quickly is the brand being dropped from AI answers over a 30-day window? Are citations coming from authoritative or disposable sources?

**Audit Steps:**
- Track citation frequency across AI platforms over rolling 30-day windows
- Classify citation sources by authority tier:
  - **Tier 1 (Primary):** Journalism, government, academic, official brand site
  - **Tier 2 (Trusted):** Major review platforms (Yelp, TripAdvisor, G2), Wikipedia
  - **Tier 3 (Secondary):** Affiliate blogs, SEO-optimized content, aggregator sites
- LLMs are being tuned to ignore Tier 3 in favor of Tier 1 — flag brands over-reliant on Tier 3
- Monitor for sentiment decay (brand mentioned less positively over time)

**Output:** Citation health dashboard showing source authority breakdown, velocity trends, and sentiment trajectory.

---

## 3. LLM Interrogation Engine — Model Coverage

The interrogation engine cannot rely only on the "Big Three" (ChatGPT, Gemini, Perplexity). It must query across the full ecosystem.

### Required Model Categories

| Category | Models | Rationale |
|----------|--------|-----------|
| **Mainstream Consumer** | ChatGPT (GPT-4o), Gemini, Perplexity | What consumers see when they ask for recommendations |
| **Reasoning / Logic** | OpenAI o1-preview, o3 | Analyzes reasoning paths — how does the AI THINK through a recommendation? |
| **Open-Source Ecosystem** | Llama 3.3, DeepSeek V3 | Essential for B2B audits — these power the majority of private RAG systems used by corporations |
| **Real-Time Social** | Grok 3 (X/Twitter) | Only way to audit "hype" and viral sentiment impacting AI perception in real-time |
| **Semantic Nuance** | Claude (Sonnet/Opus) | Best semantic understanding — if Claude doesn't "get" your brand voice, no one will |
| **Local/Maps** | Gemini (Maps integration), Apple Intelligence | For local businesses — map-based AI answer visibility |

### Interrogation Method

**Blind Taste Test Prompt Pattern:**
```
"Recommend a [Service] in [City]. Explain why you chose them over [Competitor Brand]."
```

Run this across all model categories. Compare:
- Whether the brand is mentioned at all
- Position in recommendation list
- Reasoning given for/against
- Factual accuracy of details mentioned
- Sentiment (positive/neutral/negative framing)

---

## 4. Three-Phase Audit Blueprint

### Phase 1: Digital Footprint Reality Check

**Goal:** Establish the brand's current state in AI knowledge systems.

| Audit Component | What to Check |
|-----------------|---------------|
| **Knowledge Graph Integrity** | Schema.org implementation completeness, `sameAs` links to social/directories/Wikipedia |
| **Vector Space Position** | 3D map showing where the brand sits in latent space vs. top 3 competitors |
| **Entity Recognition** | Does the brand exist in Wikidata, DBpedia, industry knowledge bases? |
| **Structured Data Quality** | JSON-LD completeness, accuracy of NAP data, rich snippet eligibility |

---

### Phase 2: LLM Sentiment & Perception (The Interrogation)

**Goal:** Discover how AI models currently perceive and represent the brand.

| Audit Component | What to Check |
|-----------------|---------------|
| **Blind Taste Test** | Query 5+ LLMs with competitive recommendation prompts |
| **Hallucination Risk** | Identify factual gaps where AI makes up info (wrong hours, outdated pricing, nonexistent services) |
| **Sentiment Heatmap** | Aggregate sentiment across Perplexity, Gemini, ChatGPT into a "Brand Trust Index" |
| **Competitive Positioning** | How often competitors are recommended instead, and the reasoning given |

---

### Phase 3: AEO Technical Audit (Visibility Score)

**Goal:** Score the website's technical readiness to be cited by AI systems.

| Audit Component | What to Check |
|-----------------|---------------|
| **RAG-Readiness** | Is content formatted in 300-500 word semantic blocks that RAG systems can chunk? |
| **AVS 2.0 Score** | See formula in Section 5 below |
| **Map-Pack Proxy** | Visibility in Gemini / Apple Intelligence map-based answers |
| **Zero-Click Dominance** | Percentage of queries where the brand is the ONLY cited source |
| **Agent-SEO Readiness** | Can AI agents find and execute key actions on the site? |

---

## 5. Metrics & Scoring Formulas

### AVS 2.0 (AI Visibility Score)

```
AVS = (Mentions × Sentiment) + (Citation Share)
      ─────────────────────────────────────────
              Total Search Volume
```

**Components:**
- **Mentions:** Count of brand appearances across AI platform responses
- **Sentiment:** Weighted sentiment score (-1 to +1) of each mention
- **Citation Share:** Percentage of relevant queries where the brand is cited as a source
- **Total Search Volume:** Estimated total queries in the brand's category/location

### Local KPI Cards

| KPI | Definition |
|-----|------------|
| **Map-Pack Proxy** | Visibility in AI-powered map-based answers (Gemini, Apple Intelligence) |
| **Zero-Click Dominance** | % of queries where brand is the only cited source |
| **Entity Co-occurrence** | Frequency of brand + target keyword appearing in same vector space |
| **Information Gain Score** | Per-page uniqueness score vs. existing training data |
| **Functional Crawlability** | Agent-readiness score for transactional pages |
| **Citation Velocity** | Rate of change in citation frequency over 30-day windows |
| **Brand Trust Index** | Aggregated sentiment across all AI platforms |

---

## 6. Differentiator Feature: AI Response Simulation

### Concept: "Digital Twin" Testing

**Title in report:** *"If an AI Agent were to buy your service today, here is where it would get stuck."*

This is the killer feature that separates LocalVector from every competitor. Instead of just telling clients what's wrong, SHOW them the failure in a simulated agent interaction.

### Example Output

> **Simulation: AI Agent attempting to reserve a table**
>
> 1. ✅ Agent found business on Google Maps
> 2. ✅ Agent identified the website URL
> 3. ✅ Agent found the menu page
> 4. ⚠️ Agent found pricing page but couldn't verify the "Local Veteran Discount" mentioned on Yelp
> 5. ❌ Agent could not find a machine-readable reservation action
> 6. ❌ **Result: Agent recommended Competitor B instead because it had a ReserveAction schema**

### Implementation Approach

- Run synthetic agent journeys against the client's site
- Test common user intents: reserve, order, get pricing, find hours, check reviews
- Document every point of friction or failure
- Compare against competitor sites to show what "success" looks like
- Generate visual step-by-step report showing the agent's decision path

---

## 7. Data Sources & Signals

### Platforms to Monitor for Citations

| Source Type | Platforms |
|-------------|----------|
| **AI Answer Engines** | ChatGPT, Gemini, Perplexity, Copilot, Claude |
| **AI-Powered Search** | Google AI Overviews, Bing Chat, Apple Intelligence |
| **Knowledge Bases** | Wikidata, DBpedia, Google Knowledge Graph |
| **Review Platforms** | Yelp, TripAdvisor, G2, Trustpilot |
| **Social/Community** | Reddit, Quora (heavily weighted by ChatGPT), X/Twitter |
| **Local Directories** | Google Business Profile, Apple Maps, Bing Places, Foursquare |
| **Content Datasets** | Common Crawl, RefinedWeb (for Information Gain analysis) |

### Critical Signal: Reddit & Quora

LLMs (especially ChatGPT) are heavily weighted toward "Human-First" platforms. If a brand is absent from Reddit and Quora discussions, it will eventually disappear from LLM recommendations.

**Audit check:** Search Reddit and Quora for brand mentions. If zero presence → flag as critical gap.

### Citation Authority Tiers

| Tier | Source Type | LLM Trust Weight | Examples |
|------|------------|-------------------|----------|
| **1 — Primary** | Journalism, Government, Academic | Highest | NYT, local news, .gov, .edu, official brand site |
| **2 — Trusted** | Major platforms, Wikipedia | High | Yelp, TripAdvisor, Wikipedia, G2 |
| **3 — Secondary** | Blogs, affiliates, aggregators | Declining | SEO-optimized blogs, affiliate sites, directory scrapers |

**Trend:** LLMs are being tuned to ignore Tier 3 in favor of Tier 1. Brands over-reliant on Tier 3 citations will see declining AI visibility.

---

## 8. Implementation Priority Matrix

Based on impact and feasibility, here's the recommended build order:

### Tier 1 — Build First (Core Differentiators)

| Feature | Why First |
|---------|-----------|
| **Multi-LLM Interrogation Engine** | Foundation of the entire product. Expand beyond Big Three to include reasoning models, open-source, and social. |
| **AVS 2.0 Scoring** | Clients need a single number. The formula gives them that. |
| **Hallucination Detection** | Immediate, tangible value. "Your hours are wrong in ChatGPT" is a sale-closer. |
| **Citation Tracking Dashboard** | Shows the problem over time. Makes the tool sticky (clients check back monthly). |

### Tier 2 — Build Next (Competitive Moat)

| Feature | Why Next |
|---------|----------|
| **Entity Salience Audit** | Knowledge Graph health check. "You don't exist in Wikidata" is a powerful finding. |
| **Agent-SEO Readiness** | Forward-looking. Positions LocalVector as the only tool addressing AI agent accessibility. |
| **AI Response Simulation (Digital Twin)** | The demo feature. This sells the product in pitch meetings. |
| **Citation Authority Tiering** | Helps clients understand WHY their citations are declining. |

### Tier 3 — Build Later (Advanced / R&D)

| Feature | Why Later |
|---------|-----------|
| **Information Gain Analysis** | Requires Common Crawl / RefinedWeb comparison infrastructure. High value but complex. |
| **Vector Space Mapping (3D)** | Visually impressive but technically heavy. Needs embedding model infrastructure. |
| **Real-Time Social Sentiment (Grok)** | Dependent on X/Twitter API access and pricing. |
| **Citation Velocity Trending** | Needs 30+ days of historical data per client before it becomes meaningful. |

---

## Appendix: Open Questions for /docs Cross-Reference

When comparing against existing `/docs` documentation, check for:

1. **Overlap:** Which of these features are already spec'd in the current docs? What's the delta?
2. **Drift:** Has the existing documentation diverged from these ideas (e.g., different scoring formulas, different model lists)?
3. **Gaps:** What's in the Gemini dump that's completely missing from current docs?
4. **Conflicts:** Any contradictions between this document and existing specs (e.g., AVS formula differences)?
5. **Naming:** Are the same concepts called different things across documents?

---

*Document prepared for Claude Code reference. Upload existing `/docs` folder for cross-reference analysis.*
