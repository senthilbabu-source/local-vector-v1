# LocalVector.ai — Risk Register

**Version:** 1.0 — March 5, 2026
**Owner:** Senthilbabu
**Status:** Pre-launch. Review at each milestone: first paying customer, $1K MRR, $10K MRR, $50K MRR.

---

## How to Use This Document

- **Founder:** Review the full register monthly. Update probability and impact scores based on new information.
- **Launch gate:** Before accepting the first paying customer, all risks scored P×I ≥ 15 must have a documented mitigation. Risks with no mitigation = launch blocker.
- **Launch-pause criteria:** Section 3 defines specific, objective conditions that would cause an immediate launch pause or product pivot.
- **Scoring:**
  - **Probability:** 1 = Rare (<10%), 2 = Unlikely (10–25%), 3 = Possible (25–50%), 4 = Likely (50–75%), 5 = Almost Certain (>75%)
  - **Impact:** 1 = Negligible, 2 = Minor, 3 = Moderate, 4 = Major, 5 = Catastrophic (kills the business)
  - **Score:** P × I. Color coding: 1–8 = Low (green), 9–14 = Medium (yellow), 15–25 = High (red)

---

## Section 1: Risk Register

### Tier 1 — High Risk (Score 15–25) — Requires active mitigation before launch

| ID | Risk | Category | P | I | Score | Current Mitigation | Residual Risk | Review Trigger |
|----|------|----------|---|---|-------|--------------------|---------------|----------------|
| R-01 | **Google denies or revokes GBP API Basic Access** — Without GBP API, NAP sync cannot push corrections, location import at onboarding breaks, and the core data pipeline loses its primary source. V-1 in PENDING.md is open. | Vendor | 3 | 5 | 15 | Application submitted (charcoalnchill@gmail.com, case 1-7165000040997). Fallback: manual URL entry + scraping-based NAP detection covers ~60% of functionality. | Medium — most features work without GBP API; onboarding is degraded | GBP API response received |
| R-02 | **OpenAI significantly raises API pricing** — OpenAI has changed pricing 3x in 3 years. A 2–3× price increase would destroy the gross margin model at Starter/Growth tiers. Current COGS model: $0.60/mo Starter, $1.53/mo Growth. | Vendor | 3 | 4 | 12 | Multi-model strategy reduces OpenAI dependency. Perplexity, Anthropic, Gemini are alternatives for each use case. Credits system limits per-org consumption. | Medium — migration to cheaper models within 30 days is feasible | OpenAI pricing page changes |
| R-03 | **Restaurant business closure rate exceeds model** — Model assumes 1.4%/month floor churn from closures (NRA data). Urban competitive markets may run 2–3%/month. At 2%/month: blended churn = 3.5–4%, LTV drops to $2,400–$2,700, LTV:CAC ratio narrows to 8–9:1 at scale. | Market | 3 | 4 | 12 | Market-forced churn is not addressable. Mitigation: diversify ICP to include medical/dental (lower closure rate, ~0.3%/month) and marketing agencies (agency plan customers are stickier). | Medium — viable at 2% churn; concerning at 3%+ | Month 6 churn data |
| R-04 | **Google builds native AI visibility dashboard inside GBP** — Google has the data, the distribution, and the incentive. A "Performance → AI Visibility" tab in GBP would directly compete with LocalVector's core value prop. | Competitive | 2 | 5 | 10 | If Google builds it, it only covers Google AI. LocalVector covers ChatGPT, Perplexity, Gemini, Copilot simultaneously. Multi-model monitoring is our defensible moat. Stay ahead on Perplexity/ChatGPT differentiation. | Medium — Google-only coverage is not a complete substitute | Google GBP product announcements |
| R-05 | **AI model vendors change citation behavior** — OpenAI, Perplexity, or Google change how they cite local businesses in responses (e.g., switch from text mentions to structured data only). SOV detection methodology breaks. | Product | 3 | 4 | 12 | `sov-model-normalizer.ts` uses substring citation detection with 3 confidence levels. If citation format changes, normalizer must be updated per model. No lag-free way to detect this. | Medium — 1–2 week fix time, affects data quality during transition | SOV scores dropping unexpectedly for multiple orgs |

---

### Tier 2 — Medium Risk (Score 9–14) — Monitor; mitigation in place or in progress

| ID | Risk | Category | P | I | Score | Current Mitigation | Residual Risk | Review Trigger |
|----|------|----------|---|---|-------|--------------------|---------------|----------------|
| R-06 | **ICP mismatch — restaurant owners see value but don't convert** — The core assumption is that restaurant operators will pay $49+/month to monitor AI visibility. This is unvalidated at scale. Trial-to-paid conversion may be <5% instead of the modeled 15%. | Market | 3 | 3 | 9 | Revenue Impact Calculator shows dollar loss before asking for credit card — converts the activation moment to urgency. ICP doc (Section 6) defines activation moment: first AI mistake found. If conversion is low, test "pay to unlock corrections" gate. | Medium — addressable with pricing/onboarding changes | First 50 trial signups data |
| R-07 | **CAC dramatically higher than modeled** — Model assumes $175 blended CAC at launch via content + ViralScanner organic. If restaurant owners don't discover the product through search or word-of-mouth, paid CAC via Meta/Google could be $400–$600, compressing margin at Starter tier. | Financial | 3 | 3 | 9 | ViralScanner is the top-of-funnel self-discovery mechanism. Content strategy (ICP doc §12) targets low-CAC channels first (Facebook groups, local restaurant associations, GBP community). Paid channel is a fallback, not a lead channel. | Medium — addressable by doubling down on organic if paid CAC is too high | First 20 paid customer acquisition data |
| R-08 | **Data breach or security incident** — Restaurant operators trust LocalVector with GBP OAuth tokens, Stripe payment methods (via Stripe), and business operational data. A breach would destroy trust with a relationship-driven ICP. | Security | 2 | 5 | 10 | RLS on all tenant tables, CSP headers, scanner blocking, rate limiting, GDPR-compliant deletion, no raw keys stored. S-1 (pentest) scheduled. `SUPABASE_SERVICE_ROLE_KEY` never exposed client-side. | Medium — defensible architecture, pentest will surface gaps | S-1 pentest results |
| R-09 | **Solo founder operational failure** — Single point of failure: one person runs engineering, support, sales, and marketing. Illness, burnout, or personal emergency for 2+ weeks could cause service degradation and customer churn. | Operational | 2 | 4 | 8 | Infrastructure is fully automated (Vercel, Supabase, Stripe, Inngest). Product runs without human intervention for 2–4 weeks. Runbooks documented for emergency handoff. | Low-Medium — product survives founder absence; support queue backlog is the main failure mode | Any health or life event requiring 1+ week absence |
| R-10 | **Legal challenge from competitor or restaurant claiming harm** — A restaurant owner claims LocalVector damaged their reputation by incorrectly reporting their AI presence. Or a competitor claims unfair business practice based on scraping or data usage. | Legal | 2 | 4 | 8 | ToS §8 (AI Features Disclaimer) explicitly states we do not guarantee accuracy. Limitation of Liability caps exposure at 3 months of fees paid. No active scraping of competitor data — we monitor AI responses, not competitor websites. | Medium — ToS provides substantial protection; lawyer sign-off (L-9) still needed | Any legal demand letter or complaint |
| R-11 | **Perplexity or other AI model shuts down or paywalls their API** — Perplexity is a key SOV data source (Growth+ plan). If they exit or heavily restrict API access, multi-model SOV loses its most valuable citation signal. | Vendor | 2 | 3 | 6 | Multiple model fallbacks in `SOV_MODEL_CONFIGS`. OpenAI and Gemini cover the gap. Perplexity is Growth+ only — Starter tier is not affected. | Low — degraded product quality, not broken | Perplexity API changes or outage |
| R-12 | **Restaurant industry seasonal revenue swings affect churn** — Restaurants often close or cut costs in January–February (post-holiday slowdown). Subscription SaaS churn may spike in Q1. | Market | 3 | 2 | 6 | Annual plan discount (20%) incentivizes pre-payment. Monthly plan customers can be targeted with Q4 annual upgrade campaigns. Restaurant closures in January are structural, not preventable. | Low — model accounts for this; annual plans reduce exposure | January cohort renewal rate |
| R-13 | **Stripe pricing dispute — "we collect and remit" tax statement inaccurate** — ToS §5.10 states LocalVector uses Stripe Tax to collect and remit sales tax. If Stripe Tax is not fully configured or if nexus analysis (F-2 in PENDING.md) reveals different obligations, this creates legal exposure. | Legal/Financial | 2 | 3 | 6 | F-2 (tax nexus analysis) is open in PENDING.md. L-8 (Stripe Tax statement accuracy) requires lawyer sign-off. | Medium until resolved — add to pre-launch legal checklist | Tax advisor engagement |

---

### Tier 3 — Low Risk (Score 1–8) — Monitor passively

| ID | Risk | Category | P | I | Score | Notes |
|----|------|----------|---|---|-------|-------|
| R-14 | Vercel pricing increases significantly | Vendor | 2 | 2 | 4 | Infrastructure cost is a small portion of COGS. Self-hosting or Railway are alternatives if needed. |
| R-15 | Supabase pricing increases or changes free tier | Vendor | 2 | 2 | 4 | Pro plan at $25/mo is stable. Enterprise pricing only kicks in at significant scale. |
| R-16 | Negative press or viral social media post | Reputation | 1 | 3 | 3 | Small product with small footprint. Unlikely to attract significant negative attention pre-$1M ARR. |
| R-17 | Competitor copies the ViralScanner | Competitive | 3 | 2 | 6 | ViralScanner is a top-of-funnel lead magnet. The moat is the full platform, not the scanner. A copied scanner drives awareness, not a complete product. |
| R-18 | Restaurant marketing agencies prefer building in-house | Market | 2 | 2 | 4 | Agencies buying wholesale is the secondary ICP, not the primary path. |
| R-19 | GDPR enforcement action for EU residents | Regulatory | 1 | 3 | 3 | Product is US-only at launch. GDPR exposure is low until EU expansion. R-1 in PENDING.md covers if this changes. |

---

## Section 2: Top 5 Risks — Founder Action Items

These are the five risks that require your active attention before launch, ranked by urgency:

**1. R-01 — GBP API Access (OPEN, V-1)**
- Status: Waiting on Google (~5 business days from submission).
- If denied: switch onboarding to manual business info entry. Document the degraded onboarding flow before first paying customer.
- Decision needed: Will you launch without GBP API, or wait for approval?

**2. R-08 — Security pentest (S-1 in PENDING.md)**
- Schedule the pentest now — T-5 weeks before broad public launch.
- Low-cost options: Cobalt (self-service pentests, ~$500–$1,500), HackerOne (bug bounty as alternative), or Synack Red Team for lightweight web app assessment.
- Do not launch to > 50 customers without at least a self-service pentest.

**3. R-10 — Legal sign-off (L-9, L-10 in PENDING.md)**
- ToS and Privacy Policy are drafted and ready for lawyer review.
- Schedule the lawyer review now — budget $1,500–$3,000 for a SaaS startup attorney (1–3 hours of review).
- This is a launch blocker.

**4. R-06 — ICP conversion validation**
- Before spending money on growth, validate conversion: run 10 restaurant owners through the product manually (beta cohort).
- Goal: confirm at least 3 of 10 would pay $49/month unprompted.
- If fewer than 3 of 10 express willingness to pay: the product or pricing needs iteration before growth investment.

**5. R-13 — Tax nexus (F-2)**
- Engage a tax advisor before the first payment. This is lower stakes at launch (few customers, few states) but gets complicated fast.
- Stripe Tax is already integrated — confirm it is turned on in the Stripe dashboard and configured for SaaS/digital services classification.

---

## Section 3: Launch-Pause Criteria

These are specific, objective conditions that would trigger an immediate launch pause, a product hold, or a strategic pivot. Define them now, before emotions are involved.

### Launch Pause — Stop accepting new customers immediately

| Trigger | Condition | Action |
|---------|-----------|--------|
| Security incident | Any confirmed unauthorized access to customer data | Stop accepting new signups, notify affected customers per Privacy Policy §17 (72h breach notification for GDPR-in-scope), engage security response |
| Legal demand letter | Cease-and-desist or legal notice received | Pause all marketing, consult lawyer within 24 hours, do not respond directly |
| Platform dependency failure | Google revokes GBP API access with no restoration path | Audit what features are broken, update marketing to reflect degraded state, pause Growth+ plan sales if NAP sync is non-functional |
| Stripe account suspended | Stripe freezes payouts or account | Do not accept new subscribers, resolve with Stripe immediately, notify existing customers of potential billing disruption |

### Product Pivot Signal — Rethink ICP or positioning

| Trigger | Condition | Action |
|---------|-----------|--------|
| Low trial-to-paid conversion | < 5% conversion after 50 trials | Run pricing interviews with churned trials. Test "pay to unlock corrections" vs "pay for weekly monitoring." Consider dropping Starter tier and going Growth-only at $99. |
| High churn in first 90 days | > 10% monthly churn after Month 3 | Segmentation analysis: are churners single-location operators? Specific cuisines? Run exit interviews. If systemic, ICP is wrong. |
| Revenue Impact framing fails | Users don't cite the Lost Sales calculator as a purchase reason in exit surveys | Re-test with accuracy/reputation framing vs revenue framing. One of them is the dominant conversion driver. |
| Agency channel outperforms direct 3:1 | Agency plan ARPU + lower CAC makes single-operator plan uneconomical | Deprioritize Starter plan marketing, double down on agency onboarding, consider removing Starter tier from public pricing. |

### Strategic Pivot — Fundamentally reconsider the business

| Trigger | Condition | Action |
|---------|-----------|--------|
| Google natively ships AI visibility in GBP | Google Business Profile adds "AI Search Performance" dashboard with ChatGPT + Perplexity coverage | Pivot to: (1) multi-location and agency use case where GBP native is insufficient, (2) industry verticals Google doesn't prioritize (medical, legal), (3) white-label for agencies. Do not compete with Google's GBP natively. |
| OpenAI prohibits commercial use for competitive monitoring | OpenAI ToS change explicitly prohibiting using API to build products that monitor AI responses | Switch to Perplexity + Gemini as primary SOV engines, deprecate OpenAI-based SOV models, maintain OpenAI for content generation only. |
| AI search share drops unexpectedly | Industry data shows restaurant discovery via AI drops below 5% of searches in 12 months | This is a macro market risk. Pivot product framing from "AI search" to "everywhere your restaurant shows up online" including AI. Broader positioning buys time. |

---

## Section 4: Risk Review Schedule

| Milestone | Action |
|-----------|--------|
| Before first paying customer | Review all Tier 1 + Tier 2 risks. Confirm R-08 (pentest) and R-10 (legal sign-off) are resolved. |
| 10 paying customers | Add real churn data to R-03, R-06. Update R-07 with actual CAC numbers. |
| $1K MRR | Full register review. Add new risks discovered from customer feedback. |
| $10K MRR | Risk scores likely shift significantly. R-04 (Google competition) becomes more relevant at higher visibility. |
| $50K MRR | Engage a fractional CFO to review R-02, R-03, R-07 with real financial data. |

---

_Last updated: 2026-03-05_
_Owner: Senthilbabu_
_Score methodology: Probability (1–5) × Impact (1–5). 15+ = High (launch blocker or active mitigation required). 9–14 = Medium (monitor). 1–8 = Low (passive)._
