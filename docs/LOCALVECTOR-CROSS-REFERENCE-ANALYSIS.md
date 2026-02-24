# LocalVector Documentation × Gemini Ideas — Cross-Reference Analysis

> **Analyst:** Claude Code
> **Date:** February 23, 2026
> **Inputs:** 26 `/docs` files, `AI_RULES.md`, `DEVLOG.md` (34 sprints), `LOCALVECTOR-GEMINI-IDEAS-ORGANIZED.md`
> **Recovery checkpoint:** `/home/claude/analysis/CHECKPOINT_1.md`

---

## Executive Summary

The existing `/docs` suite (v2.6, 19 numbered documents + supporting files) is **remarkably well-structured** — it's build-ready, agent-friendly, and internally consistent. The Gemini brainstorm introduces ideas across four categories:

| Category | Count | Action Required |
|----------|-------|-----------------|
| **Already covered** in existing docs | 7 ideas | No new docs. Minor enhancements to existing docs. |
| **Partially covered** — concept exists but Gemini adds depth | 5 ideas | Enhance existing docs with specific sections. |
| **Genuine gaps** — new ideas not in any doc | 6 ideas | Add to `roadmap.md` as future phases. One idea merits a new doc. |
| **Conflicts/drift** — Gemini contradicts existing specs | 2 items | Resolve in favor of existing docs (they're more grounded). |

**Bottom line:** The Gemini dump does NOT require a documentation overhaul. It requires targeted patches to 4 existing documents + an expansion of `roadmap.md` + one new companion document for future-phase features.

---

## Section 1: What's Fully Covered (No Action Needed)

These Gemini ideas already have complete, build-ready specifications in the existing docs. No changes required.

| Gemini Idea | Existing Coverage | Notes |
|-------------|-------------------|-------|
| **Hallucination Detection** | Doc 04 §2 (Fear Engine) | Fully spec'd with prompts, classification, cron, severity tiers. Implemented through Sprint 34. |
| **Citation Authority Tiering** | Doc 18 §4 (Platform Priority Tiers) | Already has Tier 1/2/3 classification with frequency thresholds. Matches Gemini's Primary/Trusted/Secondary framing exactly. |
| **Reddit/Quora Monitoring** | Doc 18 §6 (Reddit & Nextdoor) | Reddit API monitoring spec'd. Nextdoor flagged as manual. Quora not mentioned but low priority (Nextdoor is higher value for local). |
| **Schema.org Implementation** | Doc 04 §4 (Magic Engine) + Doc 17 §2.3 | `LocalBusiness`, `MenuPage`, `Restaurant`, `FAQPage`, `Event` schemas all spec'd with required properties per page type. |
| **RAG-Readiness / Content Chunkability** | Doc 17 (Content Grader) | Answer-First scoring, 5-dimension AEO model, FAQ auto-generator. Different framing than Gemini's "300-500 word blocks" but solves the same problem. |
| **First Mover Alerts** | Doc 04c §6 | Complete pipeline: detection logic, table DDL, UI spec, Autopilot integration. |
| **Closed-Loop Content Pipeline** | Doc 19 (Autopilot Engine) | DETECT → DIAGNOSE → ACT → MEASURE cycle fully spec'd with 5 trigger types, HITL approval, publish targets. |

---

## Section 2: Partially Covered — Enhancement Patches Needed

These ideas exist conceptually in the docs but the Gemini dump adds meaningful depth worth incorporating.

### 2A. Multi-LLM Interrogation (Gemini adds breadth)

**Current state:** Docs spec only **Perplexity Sonar** for Fear Engine audits and SOV queries. OpenAI GPT-4o-mini for Greed Engine analysis. Two providers total.

**Gemini adds:** A 6-category model matrix (Mainstream Consumer, Reasoning, Open-Source, Social, Semantic Nuance, Local/Maps) covering ChatGPT, o1/o3, Llama, DeepSeek, Grok, Claude, Gemini Maps, Apple Intelligence.

**Assessment:** The Gemini model matrix is aspirational but not practical for the current build stage. Perplexity Sonar is the right choice for MVP because it already aggregates across models. However, the CONCEPT of multi-model querying should be documented as the Phase 9+ evolution of the SOV Engine.

**Recommended patch:**
- **Doc 04c (SOV Engine)** — Add a new Section 12: "Multi-Model SOV Expansion (Phase 9+)" listing the target model categories from Gemini, with a note that the current implementation uses Perplexity as a proxy for multi-model coverage, and future phases will add direct model queries.
- **`roadmap.md`** — Add to Tier 3 or Tier 4 with cost estimates per model API.

---

### 2B. Citation Velocity & Sentiment Decay (Gemini adds time dimension)

**Current state:** Doc 18 (Citation Intelligence) tracks which platforms AI cites and at what frequency. The cron runs monthly. No trending/decay analysis.

**Gemini adds:** "Citation Velocity & Sentiment Decay" — tracking how quickly a brand is being dropped from AI answers over a 30-day window.

**Assessment:** This is a valuable enhancement to Doc 18. The infrastructure already exists (monthly cron writes `citation_frequency` to `citation_source_intelligence`). Adding a velocity calculation requires storing historical frequency values and computing deltas — straightforward.

**Recommended patch:**
- **Doc 18 (Citation Intelligence)** — Add Section 5.4: "Citation Velocity Tracking (Phase 8+)". Define `velocity = (current_frequency - previous_frequency) / previous_frequency`. Flag brands where velocity < -20% as "Citation Decay Alert." Store `previous_citation_frequency` on the table or compute from historical snapshots.

---

### 2C. AI Answer Simulation / Digital Twin (Gemini adds concrete framing)

**Current state:** `roadmap.md` #17 mentions "AI Answer Simulation Sandbox" as a Tier 3 upsell. No detailed spec exists.

**Gemini adds:** The "Digital Twin" concept — a step-by-step simulation showing where an AI agent would get stuck trying to use a business's website. "If an AI Agent were to buy your service today, here is where it would get stuck."

**Assessment:** This is the single strongest differentiator idea in the Gemini dump. It deserves more than a roadmap line item. It should become a new companion doc (Doc 20) when the team is ready to build it. For now, the concept should be fleshed out in the roadmap with the Gemini framing.

**Recommended patch:**
- **`roadmap.md`** — Expand #17 from one line to a full subsection using Gemini's "Digital Twin" framing, step-by-step simulation example, and the agent-failure reporting format.
- **Future: Create Doc 20 — AI Response Simulation Engine** when Phase 9+ planning begins.

---

### 2D. Entity Clarity / Knowledge Graph (Gemini adds external KB dimension)

**Current state:** Doc 17 §2.6 has an "Entity Clarity Score" that checks if the business entity is extractable from a single page (name, address, phone, hours in visible text). This is on-page entity verification only.

**Gemini adds:** "Entity Salience & Knowledge Graph Health" — checking Wikidata, DBpedia, and industry knowledge bases for the brand as a formal entity. Entity co-occurrence in vector space.

**Assessment:** These are different things. Doc 17's Entity Clarity = "can AI extract your NAP from your own page?" Gemini's Entity Salience = "does AI know you exist as a concept across the internet?" Both matter. The Gemini concept is a Phase 9+ feature that requires external API integrations (Wikidata, DBpedia queries).

**Recommended patch:**
- **`roadmap.md`** — Expand #12 ("Entity & Knowledge Graph Management") to include Gemini's specific audit steps: Wikidata entity check, DBpedia presence, `sameAs` link validation, entity co-occurrence scoring.
- **Doc 17** — Add a brief note in Section 2.6 distinguishing on-page Entity Clarity from external Entity Salience (roadmap reference).

---

### 2E. Blind Taste Test / Competitive Interrogation (Gemini adds structure)

**Current state:** Doc 04c §4.2 (SOV prompt) asks Perplexity to list businesses it would recommend. Doc 04 §2.D (Recommendation Check) asks "Who is the best {category} in {city}?" Both are competitive queries.

**Gemini adds:** A specific "Blind Taste Test" prompt pattern: *"Recommend a [Service] in [City]. Explain why you chose them over [Your Brand]."* Run across 5+ models.

**Assessment:** The Gemini prompt is more targeted than the existing SOV prompt — it explicitly asks "why not [Brand]?" which extracts competitive reasoning. This is a better prompt for the Greed Engine specifically (not SOV).

**Recommended patch:**
- **Doc 04 §3 (Greed Engine)** — Add the Gemini "Blind Taste Test" prompt as an alternative interrogation template for competitive analysis. Note that this prompt should be run across multiple models when multi-model support is added (Phase 9+).

---

## Section 3: Genuine Gaps — New Ideas to Add

These ideas from the Gemini dump have no equivalent in existing docs and represent genuine feature opportunities.

### 3A. Agentic Accessibility / Agent-SEO (★ HIGH VALUE)

**What it is:** Auditing whether AI Agents (OpenAI Operator, Google Jarvis) can navigate and execute actions on a business's website — not just read it. Checking for Schema.org `OrderAction`, `ReserveAction`, `BuyAction`, agent-readable UI labels.

**Why it matters:** This is the direction the industry is heading. The existing Content Grader (Doc 17) checks if AI can READ the site. Agent-SEO checks if AI can ACT on the site. No competitor tool does this.

**Current coverage:** `roadmap.md` #19 ("Agentic Commerce Readiness Score") mentions the concept in one line. No spec exists.

**Recommendation:**
- **`roadmap.md`** — Expand #19 into a full subsection with Gemini's specific audit steps: Schema.org Action types scan, functional crawlability testing, ARIA label verification, agent-journey simulation.
- **Long-term:** This becomes Doc 20 or Doc 21 when the team builds it. It naturally extends Doc 17 (Content Grader) with an "Agent-Readiness" dimension.

---

### 3B. Information Gain Analysis (★ TECHNICALLY COMPLEX)

**What it is:** Scoring whether a page provides NEW data vs. repackaged existing knowledge. Cross-referencing content against Common Crawl / RefinedWeb datasets.

**Current coverage:** `roadmap.md` #14 ("Original Data & Research Amplification Module") touches this but doesn't define how to measure information gain.

**Recommendation:**
- **`roadmap.md`** — Merge Gemini's "Information Gain Score" concept into #14. Add the measurement methodology: compare page content against existing model training data (proxy: use LLM to assess "would this be new information to you?"). Flag this as Tier 4 (requires significant R&D — Common Crawl comparison is non-trivial at scale).

---

### 3C. Map-Pack Proxy / Local Maps Visibility

**What it is:** Tracking visibility in Gemini/Apple Intelligence map-based AI answers specifically.

**Current coverage:** None. The SOV Engine queries text-based AI responses only. Map-based answers are a different surface.

**Recommendation:**
- **`roadmap.md`** — Add as new item #21: "Map-Based AI Answer Tracking." Note that this requires Gemini API access (for map-integrated queries) and Apple Intelligence monitoring (no public API yet). Flag as Tier 4.

---

### 3D. Zero-Click Dominance Metric

**What it is:** Percentage of queries where the brand is the ONLY cited source in the AI answer.

**Current coverage:** The SOV Engine tracks whether the brand is cited at all (binary: yes/no). It does NOT track exclusive citation.

**Recommendation:**
- **Doc 04c (SOV Engine)** — Add to Section 4.3 as an enhancement. When writing SOV results, also store `exclusive_citation` (boolean: was our business the ONLY one mentioned?). Calculate `zero_click_dominance = exclusive_citations / total_cited_queries * 100`. This is a low-effort, high-value metric addition.

---

### 3E. Vector Space Mapping (3D Visualization)

**What it is:** A 3D map showing where the brand sits in "latent space" compared to top competitors.

**Current coverage:** None.

**Recommendation:**
- **`roadmap.md`** — Add as Tier 4 item. This requires embedding model infrastructure, dimensionality reduction (UMAP/t-SNE), and a 3D visualization library. Impressive for demos but low practical value for restaurant owners. Low priority.

---

### 3F. Real-Time Social Sentiment via Grok

**What it is:** Using Grok 3 (X/Twitter) for real-time AI mention tracking and viral sentiment analysis.

**Current coverage:** None. X/Twitter is not in the current monitoring stack.

**Recommendation:**
- **`roadmap.md`** — Add as Tier 3 item under "Social Intelligence." Note API access dependency and cost uncertainty. Lower priority than Reddit monitoring (already spec'd in Doc 18).

---

## Section 4: Conflicts & Drift

### 4A. AVS / Reality Score Formula

**Gemini proposes:**
```
AVS = (Mentions × Sentiment) + (Citation Share) / Total Search Volume
```

**Existing docs define (Doc 04 §6):**
```
Reality Score = (Visibility × 0.4) + (Accuracy × 0.4) + (DataHealth × 0.2)
  where Visibility = (share_of_voice × 0.6) + (citation_rate × 0.4)
```

**Resolution:** The existing formula is more comprehensive and already implemented in code. The Gemini "AVS" is a simpler metric that could serve as a PUBLIC-FACING score (for the free scan/marketing site), while the Reality Score remains the INTERNAL product metric. These are complementary, not conflicting.

**Recommendation:**
- **Doc 08 (Landing Page)** — Consider adding Gemini's AVS formula as the simplified "Free Tier" score shown on the public scan dashboard. Keep Reality Score as the full paid-tier metric. This resolves the tension: AVS is the marketing hook, Reality Score is the product depth.

---

### 4B. Cron Architecture: Edge Functions vs. Route Handlers

**Gemini dump references:** "Edge Functions" and Deno throughout.

**Existing docs + AI_RULES §6:** All crons are Next.js Route Handlers at `app/api/cron/*/route.ts`. AI_RULES explicitly states: "Do NOT create files under `supabase/functions/`. Supabase Edge Functions (Deno) are not used."

**Resolution:** The Gemini dump was written without awareness of this architectural decision. No action needed — the existing docs are authoritative. The Gemini reference doc I created already uses generic language, but if it's handed to a coding agent, the agent should follow AI_RULES §6.

**Recommendation:**
- **LOCALVECTOR-GEMINI-IDEAS-ORGANIZED.md** — Add a header note: "Implementation note: All cron jobs are Next.js Route Handlers per AI_RULES §6. Ignore any references to 'Edge Functions' or 'Deno' from the original Gemini discussion."

---

## Section 5: Recommended Action Plan

### Immediate (Before Next Build Sprint)

| # | Action | File to Edit | Effort |
|---|--------|-------------|--------|
| 1 | Add "Multi-Model SOV Expansion (Phase 9+)" section | `docs/04c-SOV-ENGINE.md` §12 | 30 min |
| 2 | Add "Zero-Click Dominance" metric to SOV results writer | `docs/04c-SOV-ENGINE.md` §4.3 | 15 min |
| 3 | Add "Citation Velocity Tracking" section | `docs/18-CITATION-INTELLIGENCE.md` §5.4 | 20 min |
| 4 | Add "Blind Taste Test" prompt template | `docs/04-INTELLIGENCE-ENGINE.md` §3 | 10 min |
| 5 | Add implementation note to Gemini reference | `LOCALVECTOR-GEMINI-IDEAS-ORGANIZED.md` | 5 min |
| 6 | Expand `roadmap.md` with 6 Gemini gap items | `docs/roadmap.md` | 45 min |

### Before Phase 5 Build

| # | Action | File | Effort |
|---|--------|------|--------|
| 7 | Add Entity Clarity vs. Entity Salience distinction | `docs/17-CONTENT-GRADER.md` §2.6 | 10 min |
| 8 | Expand AI Answer Simulation section in roadmap | `docs/roadmap.md` #17 | 20 min |

### When Phase 9+ Planning Begins

| # | Action | New File | Effort |
|---|--------|----------|--------|
| 9 | Create Doc 20: AI Response Simulation Engine | `docs/20-AI-RESPONSE-SIMULATION.md` | 2-3 hrs |
| 10 | Create Doc 21: Agent-SEO Readiness | `docs/21-AGENT-SEO.md` | 2-3 hrs |

---

## Section 6: What NOT to Do

Based on the analysis, these Gemini ideas should NOT be added to the documentation right now:

| Idea | Why Not |
|------|---------|
| **Common Crawl / RefinedWeb comparison** | Requires massive infrastructure. Not feasible for a solo-dev build. Keep as Tier 4 vision item only. |
| **3D Vector Space Mapping** | Impressive demo but zero practical value for restaurant owners. Tier 4 at best. |
| **Querying Llama/DeepSeek directly** | These power private RAG systems — querying them directly doesn't help. The insight (B2B clients use open-source models) is noted in the roadmap but doesn't change the product architecture. |
| **Grok integration** | X API pricing is unpredictable. Reddit monitoring (Doc 18) covers social signals for now. |
| **Renaming Reality Score to AVS** | Reality Score is already implemented, tested, and referenced across 8+ documents. Renaming creates unnecessary churn. AVS can be the marketing name for the public-facing simplified version. |

---

## Appendix: Document Health Summary

| Doc | Version | Last Updated | Build Status | Health |
|-----|---------|-------------|-------------|--------|
| 00-INDEX | 2.7 | Feb 23 | N/A (index) | ✅ Current |
| 01-MARKET-POSITIONING | 2.3 | Feb 16 | N/A (strategy) | ✅ Current |
| 02-MULTI-TENANT | 2.3 | Feb 16 | Implemented | ✅ Current |
| 03-DATABASE-SCHEMA | 2.4 | Feb 23 | Implemented | ✅ Current |
| 04-INTELLIGENCE-ENGINE | 2.4 | Feb 23 | Partially implemented | ⚠️ Needs Gemini patches |
| 04b-MAGIC-MENU | 3.0 | Feb 22 | Implemented | ✅ Current |
| 04c-SOV-ENGINE | 1.0 | Feb 23 | Spec'd, not built | ⚠️ Needs Gemini patches |
| 05-API-CONTRACT | 2.4 | Feb 23 | Partially implemented | ✅ Current |
| 06-FRONTEND-UX | 2.4 | Feb 23 | Partially implemented | ✅ Current |
| 07-GO-TO-MARKET | 2.0 | Feb 16 | N/A (strategy) | ✅ Current |
| 08-LANDING-PAGE | 2.2 | Feb 16 | Implemented | ⚠️ Consider AVS addition |
| 09-BUILD-PLAN | 2.4 | Feb 23 | Phases 0-4 complete | ✅ Current |
| 10-OPERATIONAL | 2.4 | Feb 23 | Active | ✅ Current |
| 11-TESTING | 2.3 | Feb 16 | Active (336 tests) | ✅ Current |
| 13-CORE-LOOP | 1.0 | Feb 23 | Reference | ✅ Current |
| 14-TESTING-LIVE | 1.0 | Feb 23 | Active | ✅ Current |
| 15-PROMPT-INTELLIGENCE | 1.0 | Feb 23 | Spec'd, not built | ✅ Current |
| 16-OCCASION-ENGINE | 1.0 | Feb 23 | Spec'd, not built | ✅ Current |
| 17-CONTENT-GRADER | 1.0 | Feb 23 | Spec'd, not built | ⚠️ Needs entity note |
| 18-CITATION-INTELLIGENCE | 1.0 | Feb 23 | Spec'd, not built | ⚠️ Needs velocity section |
| 19-AUTOPILOT | 1.0 | Feb 23 | Spec'd, not built | ✅ Current |
| roadmap.md | — | — | Backlog | ⚠️ Needs major expansion |
| AI_RULES.md | — | Feb 23 | Active (25 rules) | ✅ Current |

**Legend:** ✅ = No changes needed | ⚠️ = Patch recommended from this analysis
