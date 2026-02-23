# LocalVector.ai — Brand Strategy
#### Version: 1.0 | Created: 2026-02-23

---

## 1. Brand Positioning

**One-line:** LocalVector.ai is the world's first AI Defense Layer for local businesses.

**Category:** Cyber-Security for Revenue — not SEO, not reputation management.

**Core fear addressed:** AI models (ChatGPT, Gemini, Perplexity) tell customers a business is permanently closed, has wrong hours, or doesn't exist — costing revenue invisibly and silently.

---

## 2. Brand Voice

| Attribute | Description |
|-----------|-------------|
| **Authoritative** | Speaks with the confidence of a security firm, not a marketing agency |
| **Specific** | Uses dollar amounts, percentages, hours — never vague ("We help you grow") |
| **Urgent** | The damage is happening right now, invisibly |
| **Honest** | Never fabricates scores or results (see AI_RULES §24) |

**Tone examples:**
- ✓ "ChatGPT told 847 customers your restaurant was closed on Mondays. It wasn't."
- ✓ "LocalVector.ai is the world's first AI Defense Layer that detects misinformation and forces the truth."
- ✗ "We help improve your AI visibility with cutting-edge technology."

---

## 3. Visual Identity

| Element | Value |
|---------|-------|
| **Background** | `#050A15` Deep Navy |
| **Primary accent** | `#00F5A0` Signal Green — success, accuracy, protection |
| **Warning accent** | `#FFB800` Alert Amber — risks, hallucinations detected |
| **Danger accent** | `#EF4444` Alert Crimson — confirmed hallucinations, revenue damage |
| **Typography** | Inter / Geist — modern sans-serif, high-tech, authoritative |
| **Animation style** | CSS keyframes only (fill-bar, fade-up, pulse-glow-green, shield-beat, ping-dot) — no Framer Motion |

---

## 4. Proprietary Metrics (Brand Vocabulary)

These are LocalVector-owned terms. Use them consistently across all content:

| Metric | Abbreviation | Definition |
|--------|-------------|------------|
| **AI Visibility Score** | AVS | % of local-intent queries where the business is accurately cited as a top recommendation |
| **Sentiment Index** | SI | Real-time analysis of the tone AI uses to describe the brand (Premium vs. Budget) |
| **Citation Accuracy** | CA | How precisely AI engines reproduce verified hours, address, menu, and pricing |
| **Reality Score** | RS | Composite dashboard score (AVS + SI + CA + data health) |

---

## 5. Landing Page Section Map *(as of Sprint 33)*

| # | Section | Key Message |
|---|---------|-------------|
| 1 | Nav | Logo + Pricing + Sign In + Get Started Free |
| 2 | Hero | Fear hook: "Is AI Hallucinating Your Business Out of Existence?" + free scan CTA |
| 3 | AVS Dashboard | Proprietary metrics — the 3 gauges nobody else tracks |
| 4 | Practice What We Preach | LocalVector scores 100/100; generic SEO firm scores 34 |
| 5 | **US VS THEM** *(Sprint 32)* | "Why Static Listings Aren't Enough" — 4-feature comparison table |
| 6 | The Engine | Active Interrogation → RAG Injection → The Shield |
| 7 | Case Study | $12,000 Steakhouse Hallucination |
| 8 | Pricing | Free Audit / Starter $29 / AI Shield $59 / Brand Fortress Custom |
| 9 | Footer | "Defending the Truth for Local Business. Built for the Generative Age." |

### 5a. Free AI Audit Conversion Flow *(Sprint 34)*

The ViralScanner (§2 Hero CTA) — renamed "Free AI Audit" — routes actionable results to a full
public dashboard at `/scan`, creating a value-creation journey for anonymous users:

```
Landing page ViralScanner ("Free AI Audit")
    ↓  (submit: fail / pass / not_found)
/scan?status=...  (ScanDashboard)
    ↓
Real categoricals (AI Mentions + AI Sentiment) [free, "Live" badge]
    + Locked numerical scores (AVS + CI: ██/100) [plan required]
    + Competitor bars (no fake numbers, My Brand colored bar) [locked overlay]
    + Locked fixes (item 1 = real finding) [items 2–3 blurred]
    + CTA → /signup
```

**Key conversion design principles:**
- Alert banner shows the **real** Perplexity result immediately (no fabrication — AI_RULES §24)
- Real categorical fields (`mentions_volume`, `sentiment`) shown free with "Live" badge — these
  are genuinely from the scan, building immediate trust
- Numerical scores locked as `██/100` — honest that they require continuous monitoring (§26)
- Competitive bars: My Brand shows a colored bar (no fake number); competitors show "—"
- Fixes item 1 is unlocked (real finding from scan); items 2–3 blurred + lock icon
- Primary CTA: "Claim My AI Profile — Start Free" → `/signup`

---

## 6. Pricing Tier Names (Marketing vs. DB)

| Marketing Name | DB `plan_tier` | Price | Headline Feature |
|----------------|---------------|-------|-----------------|
| The Audit | — (free, no account) | $0 | One-time hallucination scan |
| Starter | `starter` | $29/mo | Weekly AI audits, 1 location |
| AI Shield | `growth` | $59/mo | Daily audits + Competitor Intercept |
| Brand Fortress | `agency` | Custom | Multi-location, white-label |

**Note:** The spec originally proposed AI Shield at $99 and Brand Fortress at $299. The product launched with $29 Starter added and AI Shield at $59. Do not revert without a deliberate pricing decision.

---

## 7. Competitive Framing

**We beat:** Enterprise listing tools (Yext, Moz Local, BrightLocal) on every AI-native feature.
**We are not:** An SEO tool. A review platform. A social media manager.

**Four features they lack entirely:**
1. Hallucination Detection
2. AI Sentiment Steering
3. Real-time RAG Updates
4. Localized GEO

**Tagline:** "Static listings were built for Google. AI runs on a completely different trust model."
