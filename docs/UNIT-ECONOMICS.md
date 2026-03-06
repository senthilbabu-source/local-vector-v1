# LocalVector.ai — Unit Economics & Financial Model

**Version:** 1.0 — March 5, 2026
**Owner:** Senthilbabu
**Status:** Working model. Assumptions marked with [A] must be validated with first 10 paying customers.
**Accountant review required for:** Items marked [PENDING-F-*] — see `docs/PENDING.md`.

---

## How to Use This Document

- **Before launch:** Use to set Stripe prices and validate against comparable tools (Section 1).
- **After first 10 customers:** Replace [A] assumptions with real data. Recalculate all derived metrics.
- **Monthly:** Update MRR, churn rate, and CAC actuals. Compare to projections.
- **For investors:** Sections 3–7 contain the standard metrics investors will ask for.

---

## Section 1: Pricing Model

### What's Confirmed in the Codebase

The Stripe price IDs are set via env vars (`STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_GROWTH`, `STRIPE_PRICE_ID_AGENCY_SEAT`). The actual dollar amounts must be set in the Stripe dashboard. One price IS hardcoded:

```
SEAT_PRICE_CENTS (lib/billing/types.ts):
  agency: 1500   →  $15/seat/month for additional seats
```

### Recommended Pricing (Set These in Stripe)

Benchmarked against: BrightLocal ($29–79), Birdeye ($299+), Podium ($249+), Yext ($199–999). LocalVector is more comprehensive than all of them specifically for AI visibility. Priced below Birdeye/Podium to be accessible to single-location operators.

| Plan | Display Name | Monthly Price | Annual Price | What's Included |
|------|-------------|--------------|-------------|-----------------|
| Trial | The Audit | **Free** | Free | 1 location, 25 AI credits/mo, ViralScanner, basic dashboard |
| Starter | Starter | **$49/month** | $39/month | 1 location, 100 credits/mo, GBP connect, basic scans |
| Growth | AI Shield | **$149/month** | $119/month | 1 location, 500 credits/mo, full AI features, 3 competitors tracked |
| Agency | Brand Fortress | **$449/month** | $359/month | 10 locations, 2000 credits/mo, 10 competitors, team seats, white-label |
| Agency seat add-on | — | **$15/seat/month** | $12/seat/month | Additional team member (already in codebase) |

**Agency minimum bill:** $449/month base (5 seats included by default per `seat-plans.ts`).
**Agency at 5 extra seats:** $449 + (5 × $15) = $524/month.

### Annual Discount Logic [A]

Annual plans capture cash upfront and reduce churn. The ~20% discount is standard SaaS.
- Starter: $468/year (vs $588 monthly) — saves $120
- Growth: $1,428/year (vs $1,788 monthly) — saves $360
- Agency: $4,308/year (vs $5,388 monthly) — saves $1,080

**Target:** 30% of customers on annual billing by Month 12 (reduces effective churn significantly).

---

## Section 2: COGS Breakdown (Cost of Goods Sold)

### AI API Costs Per Customer Per Month

Based on cron schedules in vercel.json and credit limits in the codebase:

| Cost Item | Basis | Starter | Growth | Agency |
|-----------|-------|---------|--------|--------|
| SOV cron (4×/month, 20 queries × 3 models) | Weekly cron, 3 AI providers | $0.30 | $0.52 | $3.60 |
| Audit cron (daily, 1 call/location) | Daily cron, GPT-4o-mini | $0.03 | $0.06 | $0.60 |
| Content drafts / AI generation | On-demand, 5 runs/month avg | $0.05 | $0.10 | $0.30 |
| Review intelligence (weekly sync) | Weekly cron, review responses | $0.05 | $0.20 | $1.50 |
| VAIO / Sandbox (monthly) | Monthly cron | $0.10 | $0.50 | $2.50 |
| NAP sync + schema (weekly/monthly) | Multi-platform API calls | $0.05 | $0.10 | $0.80 |
| Embeddings + semantic search | Background, per-document | $0.02 | $0.05 | $0.30 |
| **Total AI API cost** | | **$0.60** | **$1.53** | **$9.60** |

### Infrastructure Costs Per Customer Per Month

Amortized across estimated customer counts. Recalculate at each 10× growth milestone.

| Service | Monthly Bill [A] | At 100 Customers | Per Customer |
|---------|-----------------|-----------------|-------------|
| Supabase Pro | $25 | $0.25 | Scales with DB size |
| Vercel Pro | $20 | $0.20 | Scales with requests |
| Inngest | $50 | $0.50 | Scales with job volume |
| Resend | $20 | $0.20 | ~500 emails/customer/year |
| Upstash Redis | $10 | $0.10 | Rate limiting overhead |
| Sentry | $26 | $0.26 | Error monitoring |
| **Total infrastructure** | **$151** | **$1.51** | **Per 100 customers** |

### Stripe Transaction Fees

| Plan | Monthly Revenue | Stripe Fee (2.9% + $0.30) | Net After Stripe |
|------|----------------|--------------------------|-----------------|
| Starter | $49 | $1.72 | $47.28 |
| Growth | $149 | $4.62 | $144.38 |
| Agency | $449 | $13.32 | $435.68 |

### Support Cost Per Customer [A]

| Stage | Customers | Support model | Cost/customer/month |
|-------|-----------|--------------|-------------------|
| 0–50 customers | Founder-handled | Async email only | $5 |
| 50–200 customers | Founder + part-time | Email + occasional call | $12 |
| 200–500 customers | 1 CS hire ($60K/yr) | 300 customers per CS rep | $17 |
| 500+ customers | Scaled CS team | Self-serve + ticketing | $12 |

### Total COGS Summary

| Plan | AI API | Infrastructure | Stripe | Support | **Total COGS** | **Gross Margin** |
|------|--------|---------------|--------|---------|---------------|-----------------|
| Starter ($49) | $0.60 | $1.51 | $1.72 | $5.00 | **$8.83** | **82%** |
| Growth ($149) | $1.53 | $1.51 | $4.62 | $5.00 | **$12.66** | **91.5%** |
| Agency ($449) | $9.60 | $1.51 | $13.32 | $12.00 | **$36.43** | **91.9%** |

> **Target gross margin: >85%.** All plans exceed this. SaaS benchmarks: good = 70%+, great = 80%+, best-in-class = 90%+. LocalVector is best-in-class driven by low AI API costs per customer.

---

## Section 3: Customer Mix and Blended ARPU

### Assumed Plan Mix [A]

Based on typical SMB SaaS distribution. Validate against actual signups.

| Plan | % of Paying Customers | Monthly Revenue | Contribution to ARPU |
|------|----------------------|----------------|---------------------|
| Starter | 35% | $49 | $17.15 |
| Growth | 50% | $149 | $74.50 |
| Agency | 15% | $449 | $67.35 |
| **Blended** | 100% | — | **$159/month ARPU** |

### Blended COGS and Gross Margin

```
Blended COGS = (0.35 × $8.83) + (0.50 × $12.66) + (0.15 × $36.43)
             = $3.09 + $6.33 + $5.46
             = $14.88/customer/month

Blended gross margin = ($159 - $14.88) / $159 = 90.6%
Blended contribution margin = $159 - $14.88 = $144.12/customer/month
```

---

## Section 4: Customer Acquisition Cost (CAC)

### CAC by Channel [A]

| Channel | Estimated CAC | Volume Potential | Notes |
|---------|--------------|-----------------|-------|
| ViralScanner inbound (self-serve) | $30–60 | High | Tool does the selling; mostly infrastructure cost |
| Content / SEO | $50–100 | Medium (slow build) | Time investment upfront; compounds over time |
| Restaurant owner communities (Facebook, Reddit) | $80–150 | Medium | Peer trust; requires authentic presence |
| Agency partner referrals | $150–300 | Medium | Relationship-intensive; high LTV customers |
| Restaurant association events | $100–200 | Low volume | High trust; warm leads |
| Paid social (Instagram/Facebook) | $200–400 | High | Restaurant owners active on Instagram |
| Paid search (Google) | $300–600 | Medium | "restaurant AI visibility" — low search volume today |
| Direct outbound (email/LinkedIn) | $100–250 | Medium | Trigger-based works best (new openings) |

### CAC Targets by Stage

| Stage | Blended CAC Target | Primary Channels |
|-------|-------------------|-----------------|
| Beta (0–50 customers) | <$100 | ViralScanner, communities, outreach |
| Early growth (50–200) | <$200 | Content, agency partners, events |
| Scale (200–500) | <$300 | Paid + organic mix |
| Mature (500+) | <$400 | Paid acquisition + brand |

**Working assumption for this model:** $175 blended CAC at launch, $300 at scale.

---

## Section 5: Customer Lifetime Value (LTV)

### Churn Rate Assumptions [A]

Restaurant SaaS has a structural churn floor: ~17% of restaurants close annually (~1.4% monthly baseline). Build that in.

| Scenario | Monthly Churn | Avg Lifetime | Notes |
|----------|--------------|-------------|-------|
| Optimistic | 2.0% | 50 months | Strong product-market fit, low churn |
| Base case | 3.0% | 33 months | Industry average for SMB SaaS |
| Conservative | 5.0% | 20 months | Poor retention or wrong ICP |

### LTV Calculation

```
LTV (base case, 3% churn):
  Avg lifetime = 1 / 0.03 = 33 months
  LTV (revenue) = $159 ARPU × 33 months = $5,247
  LTV (gross profit) = $5,247 × 90.6% gross margin = $4,754

LTV (optimistic, 2% churn):
  Avg lifetime = 50 months
  LTV (gross profit) = $159 × 50 × 90.6% = $7,203

LTV (conservative, 5% churn):
  Avg lifetime = 20 months
  LTV (gross profit) = $159 × 20 × 90.6% = $2,881
```

### LTV by Plan (Base Case, 3% Churn)

| Plan | ARPU | Gross Margin | Gross Profit LTV | Notes |
|------|------|-------------|-----------------|-------|
| Starter | $49 | 82% | $49 × 33 × 82% = **$1,326** | Low LTV — needs upgrade path |
| Growth | $149 | 91.5% | $149 × 33 × 91.5% = **$4,502** | Core LTV driver |
| Agency | $449 | 91.9% | $449 × 33 × 91.9% = **$13,618** | Anchor customers |

> **Starter LTV is marginal.** At $1,326 LTV vs $175 CAC = 7.6:1. Acceptable, but the upgrade path from Starter → Growth is critical. Design the product to make users feel the Starter ceiling within 60 days.

---

## Section 6: LTV:CAC Ratio and Payback Period

### LTV:CAC Ratio

| Scenario | Gross Profit LTV | CAC | LTV:CAC | Verdict |
|----------|-----------------|-----|---------|---------|
| Launch (optimistic, $100 CAC) | $4,754 | $100 | **47.5:1** | Exceptional |
| Launch (base, $175 CAC) | $4,754 | $175 | **27.2:1** | Exceptional |
| Scale (base, $300 CAC) | $4,754 | $300 | **15.8:1** | Excellent |
| Scale (conservative, $400 CAC) | $2,881 | $400 | **7.2:1** | Good |
| Stress test (5% churn, $600 CAC) | $2,881 | $600 | **4.8:1** | Acceptable |

**Minimum requirement: >3:1.** All scenarios clear this significantly. The model is structurally sound at any realistic CAC up to ~$900 (base case) before breaking the 3:1 threshold.

**Maximum sustainable CAC (base case):** $4,754 / 3 = **$1,585** — you could spend up to this before unit economics break.

### Payback Period

```
Payback period = CAC / (ARPU × Gross Margin)
              = CAC / Contribution margin per month

At $175 CAC, $144 contribution margin:  175 / 144 = 1.2 months
At $300 CAC, $144 contribution margin:  300 / 144 = 2.1 months
At $400 CAC, $144 contribution margin:  400 / 144 = 2.8 months
```

**Industry benchmark:** Good = <12 months, great = <6 months, exceptional = <3 months.
**LocalVector:** Exceptional at all realistic CAC levels. Cash-flow positive on each customer within 3 months of acquisition.

---

## Section 7: Break-Even Analysis

### Fixed Monthly Costs (Bootstrap Scenario)

| Cost Item | Monthly | Notes |
|-----------|---------|-------|
| Infrastructure (base tier, <50 customers) | $150 | Supabase Free, Vercel Hobby, etc. |
| Infrastructure (Pro tier, 50+ customers) | $500 | Supabase Pro, Vercel Pro |
| Tools (Sentry, analytics, email) | $200 | Fixed regardless of customers |
| Legal / accounting (amortized) | $300 | One-time costs spread over 12 months |
| Marketing tools (SEO, social scheduling) | $200 | Content production tools |
| Domain, SSL, misc | $50 | Fixed |
| **Total fixed (pre-scale)** | **$1,250** | Founder salary = $0 initially |
| **Total fixed (at 50+ customers)** | **$1,550** | Infrastructure upgrades |

### Break-Even Calculation

```
Break-even customers = Fixed costs / Contribution margin per customer

At $1,250 fixed costs:   1,250 / $144 = 9 paying customers
At $1,550 fixed costs:   1,550 / $144 = 11 paying customers
```

**Break-even: 9–11 paying customers.**
This is achievable within the first 30–60 days of a beta with active outreach.

---

## Section 8: Revenue Projections

### Trial-to-Paid Conversion Assumption [A]

ViralScanner free → account signup → trial → paid:
- ViralScanner completion rate: ~60% of visitors who start it
- Signup rate post-scan: ~20% [A]
- Trial-to-paid conversion: ~8% [A]
- Blended: ~1% of ViralScanner visitors become paying customers

Industry benchmark for PLG SaaS: 3–15% trial-to-paid. Using 8% as conservative estimate.

### Base Case Projections

Assumes primary growth from ViralScanner + content + community. No paid ads until Month 7.

| Period | Paying Customers | Monthly Churn | Net New | MRR | ARR |
|--------|-----------------|--------------|---------|-----|-----|
| Month 1–3 (beta) | 5–15 | <1 lost | +5/month avg | $795–$2,385 | $10K–$29K |
| Month 4–6 | 15–50 | 1–2 lost | +12/month avg | $2,385–$7,950 | $29K–$95K |
| Month 7–12 | 50–150 | 2–5 lost | +20/month avg | $7,950–$23,850 | $95K–$286K |
| Month 13–18 | 150–350 | 5–11 lost | +33/month avg | $23,850–$55,650 | $286K–$668K |
| Month 19–24 | 350–600 | 11–18 lost | +50/month avg | $55,650–$95,400 | $668K–$1.14M |

**Month 24 milestone: $1M ARR with 600 customers.**

### Sensitivity Analysis (Month 18 MRR)

| Churn Rate | Growth Rate | Customers | MRR |
|-----------|------------|-----------|-----|
| 2% (optimistic) | 40/month | 480 | $76,320 |
| 3% (base) | 33/month | 350 | $55,650 |
| 5% (conservative) | 25/month | 200 | $31,800 |

### Optimistic Case (Paid + Agency Channel)

Assumes agency partner program launches Month 6; each agency brings 5 restaurant clients.

| Period | Customers | MRR |
|--------|-----------|-----|
| Month 12 | 200 | $31,800 |
| Month 18 | 500 | $79,500 |
| Month 24 | 1,000 | $159,000 |

**Month 24 optimistic: $1.9M ARR.**

---

## Section 9: Burn Rate and Runway

### Bootstrap Scenario (No External Funding)

| Period | Monthly Burn | Monthly Revenue | Net Cash Flow | Cumulative |
|--------|-------------|----------------|--------------|-----------|
| Month 1–3 | $1,250 | $0–$2,385 | -$1,250 to +$1,135 | -$3,750 to -$380 |
| Month 4 | $1,550 | ~$3,000 | +$1,450 | Profitable |
| Month 7–12 | $3,000 (+ paid marketing) | $7,950–$23,850 | +$4,950 to +$20,850 | Cash accumulating |

**Break-even month:** Month 4–5 (9–11 paying customers at ~$150 each).

### With Seed Funding ($100K)

| Scenario | Monthly Burn | Runway |
|----------|-------------|--------|
| Lean (no salary, no paid ads) | $1,550 | 64 months |
| Moderate ($3K paid ads, no salary) | $4,000 | 25 months |
| Aggressive ($5K ads + $5K part-time salary) | $8,500 | 11.8 months |

**Recommendation:** Stay lean until Month 6 (validate PMF), then increase paid acquisition spend once LTV:CAC is confirmed with real customer data.

---

## Section 10: COGS Per Customer at Scale

As the customer base grows, infrastructure costs per customer decline significantly:

| Customer Count | Infra/customer | AI API/customer | Support/customer | Total COGS | Gross Margin |
|----------------|---------------|----------------|-----------------|-----------|-------------|
| 50 | $3.02 | $1.53 | $5.00 | $13.17 | 91.7% |
| 200 | $0.76 | $1.53 | $12.00 | $18.41 | 88.4% |
| 500 | $0.30 | $1.53 | $12.00 | $17.95 | 88.7% |
| 1,000 | $0.15 | $1.53 | $8.00 | $13.80 | 91.3% |

> **Infrastructure costs become negligible at scale.** The dominant cost driver at 200+ customers becomes support, not AI APIs or hosting. Investing in self-serve documentation, onboarding, and in-product guidance (already built) is the highest-leverage cost reduction lever.

---

## Section 11: Key Metrics Dashboard

Track these monthly. Review quarterly against projections.

| Metric | Formula | Launch Target | Month 12 Target |
|--------|---------|--------------|----------------|
| MRR | Σ(active subscriptions) | $1,500 | $20,000 |
| ARR | MRR × 12 | $18,000 | $240,000 |
| ARPU | MRR / paying customers | $159 | $159 (validate) |
| Monthly churn rate | Lost MRR / prior MRR | <5% | <3% |
| Trial-to-paid conversion | Paid signups / trials started | >5% | >10% |
| Blended CAC | Total sales+mktg spend / new customers | <$200 | <$300 |
| Gross margin | (Revenue - COGS) / Revenue | >85% | >88% |
| LTV:CAC | Gross profit LTV / CAC | >10:1 | >8:1 |
| Payback period | CAC / (ARPU × gross margin) | <3 months | <4 months |
| Net Revenue Retention | MRR this month / MRR 12 months ago (same cohort) | >95% | >100% |

> **Net Revenue Retention (NRR) >100%** means expansion revenue (Starter → Growth upgrades, Agency seat adds) more than offsets churn. This is the signal that the business grows on its own. Target this by Month 18.

---

## Section 12: Structural Risks to Unit Economics

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Restaurant churn floor (business closures) | High — ~17%/yr baseline | Monthly churn floor of ~1.4% even with perfect CS | Accept it; price LTV model with 3% minimum |
| AI API cost spike | Medium — OpenAI/Perplexity pricing can change | +$5–10/customer/month if costs double | Credits system already limits usage per customer; fail-open design |
| Free-to-paid conversion below 5% | Medium | Doubles effective CAC | ViralScanner must deliver the activation moment in <5 min |
| Competitors lower price | Medium | Compresses ARPU | Moat is data + integrations + AI accuracy, not price |
| Agency plan underpriced | Low-medium | If support cost for 10-location accounts is $50+/month, margin compresses | Monitor support tickets per plan type; raise Agency price if needed |
| Annual discount abuse | Low | If >60% go annual, cash is great but monthly MRR looks lower | A good problem to have; structure investor reporting on ARR not MRR |

---

## Section 13: Pricing Actions Required Before Launch

| Action | What to Do | Where |
|--------|-----------|-------|
| Set Starter price | Create $49/month price in Stripe dashboard | Stripe → Products → Create price |
| Set Growth price | Create $149/month price in Stripe dashboard | Stripe → Products → Create price |
| Set Agency seat price | Confirm $15/seat/month (already in codebase) | Already in `lib/billing/types.ts` — just confirm in Stripe |
| Set Agency base | Create $449/month price (5 seats base) | Stripe → Products → Create price |
| Set annual prices | Create annual variants at 20% discount | Stripe → same products, annual billing interval |
| Add price IDs to env | Set `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_GROWTH`, `STRIPE_PRICE_ID_AGENCY_SEAT` | `.env.local` and Vercel env vars |
| Test billing lifecycle | Run upgrade → downgrade → cancel → reactivate in Stripe test mode | Before any real customer touches billing |

---

## Open Questions (Add to PENDING.md)

| # | Question | Who Answers It |
|---|----------|---------------|
| F-4 | Is $49/$149/$449 the right pricing, or should we A/B test? | Pricing interviews with 10 prospects before launch |
| F-5 | What is the actual trial-to-paid conversion rate? | Only answered by running beta (target: first 50 signups) |
| F-6 | What is actual COGS per Agency customer with 10 locations? | Monitor Supabase + AI API costs for first 3 agency accounts |
| F-7 | Does the annual discount drive enough cash to justify the revenue deferral? | Track monthly vs annual mix in first 6 months |
| F-8 | What is actual restaurant business closure rate in target cities? | Industry data (NRA reports) — affects churn floor assumption |

---

_Last updated: 2026-03-05_
_Next review: After first 10 paying customers — replace all [A] assumptions with actuals._
