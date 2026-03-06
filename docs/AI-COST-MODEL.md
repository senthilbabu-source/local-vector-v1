# LocalVector.ai — AI/ML Cost Model

**Version:** 1.0 — March 5, 2026
**Owner:** Senthilbabu
**Status:** Pre-launch. Validate against real usage data after first 10 paying customers.

---

## How to Use This Document

The UNIT-ECONOMICS.md document contains assumed AI COGS of $0.60/month (Starter), $1.53/month (Growth), and ~$9.50/month (Agency AI-only portion). This document derives those numbers from first principles, identifies where the assumptions can break, and defines the control mechanisms to prevent a runaway COGS scenario.

Read this document:
- Before accepting the first paying customer (confirm your margin model holds)
- After the first 10 paying customers (compare actual vs. modeled)
- When any AI provider changes pricing
- When adding any new LLM-backed feature

---

## Section 1: Model Inventory

All AI calls in the platform, sourced directly from `lib/ai/providers.ts`.

### Model pricing reference (March 2026)

| Provider | Model | Input ($/1M tokens) | Output ($/1M tokens) | Notes |
|----------|-------|--------------------:|--------------------:|-------|
| OpenAI | gpt-4o | $2.50 | $10.00 | Used for high-reasoning tasks only |
| OpenAI | gpt-4o-mini | $0.15 | $0.60 | Default for structured extraction |
| OpenAI | text-embedding-3-small | $0.02 | — | Embeddings only |
| Perplexity | sonar | $1.00 | $1.00 | Live-web queries; ~$0.005/request |
| Google | gemini-2.0-flash | $0.075 | $0.30 | Search-grounded + raw citation |
| Anthropic | claude-sonnet-4 | $3.00 | $15.00 | High-complexity analysis only |
| Anthropic | claude-haiku-4.5 | $0.80 | $4.00 | Streaming, RAG, intent |

### Feature-to-model map

| Feature | Model key | Model | Trigger | Plan gate |
|---------|-----------|-------|---------|-----------|
| SOV evaluation (primary) | `sov-query` | perplexity/sonar | Weekly cron | Starter+ |
| SOV evaluation (2nd model) | `sov-query-gpt` | gpt-4o-mini | Weekly cron | Growth+ |
| SOV evaluation (3rd model) | `sov-query-gemini` | gemini-2.0-flash | Weekly cron | Agency |
| Hallucination detection | `fear-audit` | gpt-4o | Weekly cron (post-SOV) | All (auto) |
| Sentiment extraction | `sentiment-extract` | gpt-4o-mini | Weekly cron (post-SOV) | All (auto) |
| Source mention extraction | `source-extract` | gpt-4o-mini | Weekly cron (post-SOV) | All (auto) |
| Content brief generation | `content-brief` | gpt-4o-mini | User action / autopilot | Growth+ |
| Competitor intercept | `greed-headtohead` | perplexity/sonar | User action | Growth+ |
| Competitor intercept (analysis) | `greed-intercept` | gpt-4o-mini | User action | Growth+ |
| AI answer preview (ChatGPT) | `preview-chatgpt` | gpt-4o-mini | User action | Growth+ |
| AI answer preview (Perplexity) | `preview-perplexity` | perplexity/sonar | User action | Growth+ |
| AI answer preview (Gemini) | `preview-gemini` | gemini-2.0-flash | User action | Growth+ |
| AI chat assistant | `chat-assistant` | gpt-4o | User action | Growth+ |
| Menu OCR (upload) | `menu-ocr` | gpt-4o (vision) | User action | All |
| Menu AI simulation | `simulateAIParsing` | gpt-4o-mini | User action | All |
| FAQ generation | `faq-generation` | gpt-4o-mini | User action (page audit) | Growth+ |
| Authority citation detection | `authority-citation` | perplexity/sonar | Monthly cron | Growth+ |
| Sandbox simulation | `sandbox-simulation` | claude-sonnet-4 | Monthly cron | Agency |
| Streaming content preview | `streaming-preview` | claude-haiku-4.5 | User action | Growth+ |
| Streaming SOV simulate | `streaming-sov-simulate` | claude-haiku-4.5 | User action | Growth+ |
| RAG chatbot | `rag-chatbot` | claude-haiku-4.5 | User action | All |
| Intent discovery | `intent-expand` | claude-haiku-4.5 | Monthly cron | Growth+ |
| Embeddings (backfill + inline) | `text-embedding-3-small` | OpenAI embedding | Inline + nightly cron | All |

### Two cost categories

**Automated (cron-driven):** Run on schedule regardless of user interaction. Not credit-gated. Direct COGS. Cannot be limited by the credit system.

**User-initiated (credit-gated):** Require a user to take an action. Consumed against the monthly credit limit. When the limit is reached, the action is blocked (fail-open returns cached or blank state). This is the cost control mechanism.

---

## Section 2: Per-Plan Monthly Cost Model

### Assumptions

- **Queries per location:** 15 target queries (median from seed data; `target_queries` table)
- **Weeks per month:** 4.33
- **Starter:** 1 location, 1 SOV model
- **Growth:** 1 location, 2 SOV models, autopilot active
- **Agency:** 10 locations, 3 SOV models, all engines active
- **User credit utilization:** Starter 30%, Growth 20%, Agency 30% (conservative — most users don't hit the limit)
- **Token estimates:** based on actual prompt templates in `lib/services/` and observed output lengths

---

### Starter Plan — 1 location, 15 queries

#### Automated (cron) costs

| Feature | Frequency | Requests | Tokens (in/out) | Model | Cost/month |
|---------|-----------|----------|-----------------|-------|------------|
| SOV evaluation | 60/month (15q × 4w) | 60 | ~1,200 / 300 | perplexity/sonar | $0.30 |
| Hallucination audit | ~20 checks/month | 20 | ~2,500 / 400 | gpt-4o | $0.06 |
| Sentiment extraction | 60/month | 60 | ~800 / 150 | gpt-4o-mini | $0.006 |
| Source extraction | 60/month | 60 | ~600 / 100 | gpt-4o-mini | $0.005 |
| Embeddings (inline) | ~30 new rows/month | 30 | ~300 / — | embedding-3-small | $0.000 |
| **Automated subtotal** | | | | | **~$0.37** |

#### User-initiated (credits) costs

Starter plan: 100 credits/month. At 30% utilization = 30 credits used.

| Action | Avg credits/session | Sessions/month | Model mix | Avg cost/credit | Cost |
|--------|---------------------|----------------|-----------|-----------------|------|
| Menu OCR | 1 | 1 | gpt-4o-vision ~3,000 tokens | $0.03 | $0.03 |
| Menu simulation | 1 | 2 | gpt-4o-mini ~2,000 tokens | $0.003 | $0.006 |
| RAG chatbot | 1 | 5 | claude-haiku ~1,500 tokens | $0.006 | $0.03 |
| Remaining 22 credits | mixed | — | mostly gpt-4o-mini | $0.002 avg | $0.044 |
| **User subtotal** | | | | | **~$0.11** |

**Starter monthly AI COGS: ~$0.48**
Model assumption: $0.60. **Headroom: $0.12. Assumption holds.**

---

### Growth Plan — 1 location, 15 queries, full feature set

#### Automated costs

| Feature | Frequency | Requests | Tokens (in/out) | Model | Cost/month |
|---------|-----------|----------|-----------------|-------|------------|
| SOV: perplexity | 60/month | 60 | ~1,200 / 300 | perplexity/sonar | $0.30 |
| SOV: gpt-4o-mini (2nd) | 60/month | 60 | ~1,200 / 300 | gpt-4o-mini | $0.022 |
| Hallucination audit | ~20/month | 20 | ~2,500 / 400 | gpt-4o | $0.06 |
| Sentiment extraction | 120/month | 120 | ~800 / 150 | gpt-4o-mini | $0.011 |
| Source extraction | 120/month | 120 | ~600 / 100 | gpt-4o-mini | $0.009 |
| Autopilot content drafts | ~8/month | 8 | ~3,500 / 800 | gpt-4o-mini | $0.008 |
| Authority citation | 5/month (monthly cron) | 5 | ~1,500 / 300 | perplexity/sonar | $0.025 |
| VAIO scan | 1/month | 1 | ~5,000 / 1,000 | claude-haiku-4.5 | $0.008 |
| Intent discovery | ~10/month | 10 | ~1,200 / 400 | claude-haiku-4.5 | $0.018 |
| Embeddings | ~50/month | 50 | ~300 / — | embedding-3-small | $0.000 |
| **Automated subtotal** | | | | | **~$0.46** |

#### User-initiated costs

Growth plan: 500 credits/month. At 20% utilization = 100 credits used.

| Action | Avg credits | Sessions | Cost/session | Subtotal |
|--------|-------------|----------|--------------|---------|
| AI answer preview (3 models) | 3 | 5 | $0.015 total | $0.075 |
| Content brief manual | 1 | 3 | $0.003 | $0.009 |
| Streaming content preview | 1 | 5 | $0.004 | $0.020 |
| Competitor intercept | 2 | 3 | $0.010 | $0.030 |
| Chat assistant | 1 | 10 | $0.010 | $0.100 |
| RAG chatbot | 1 | 15 | $0.006 | $0.090 |
| Remaining ~50 credits | mixed | — | $0.002 avg | $0.100 |
| **User subtotal** | | | | **~$0.42** |

**Growth monthly AI COGS: ~$0.88**
Model assumption: $1.53. **Well inside margin. Assumption is conservative.**

> Note: The assumption was built conservatively. Actual AI costs for Growth run ~$0.90/month at current utilization rates, not $1.53. This means the growth margin is better than modeled — but validate against real data before revising UNIT-ECONOMICS.md upward.

---

### Agency Plan — 10 locations, full feature set

#### Automated costs

| Feature | Frequency | Requests | Model | Cost/month |
|---------|-----------|----------|-------|------------|
| SOV: perplexity (10 loc × 60) | 600/month | 600 | perplexity/sonar | $3.00 |
| SOV: gpt-4o-mini (10 loc × 60) | 600/month | 600 | gpt-4o-mini | $0.22 |
| SOV: gemini-flash (10 loc × 60) | 600/month | 600 | gemini-2.0-flash | $0.05 |
| Hallucination audit (10 loc) | 200/month | 200 | gpt-4o | $0.60 |
| Sentiment extraction (3 models × 600) | 1,800/month | 1,800 | gpt-4o-mini | $0.22 |
| Source extraction | 1,800/month | 1,800 | gpt-4o-mini | $0.16 |
| Autopilot drafts (10 loc × 10/mo) | 100/month | 100 | gpt-4o-mini | $0.06 |
| Authority citation (10 loc × 5/mo) | 50/month | 50 | perplexity/sonar | $0.25 |
| VAIO scan (10 loc/mo) | 10/month | 10 | claude-haiku-4.5 | $0.08 |
| Sandbox simulation (10 loc/mo) | 10/month | 10 | claude-sonnet-4 | $0.75 |
| Intent discovery (10 loc) | 100/month | 100 | claude-haiku-4.5 | $0.13 |
| Embeddings (10 loc × 100 rows) | 1,000/month | 1,000 | embedding-3-small | $0.006 |
| **Automated subtotal** | | | | **~$5.52** |

#### User-initiated costs

Agency plan: 2,000 credits/month. At 30% utilization = 600 credits used.

Assuming an agency account manager running the product for clients is more active than a solo restaurant owner:

| Action | Sessions/month | Cost/session | Subtotal |
|--------|----------------|--------------|---------|
| AI answer preview (3 models × 10 clients) | 30 | $0.015 | $0.45 |
| Chat assistant (multi-location queries) | 20 | $0.012 | $0.24 |
| Streaming content preview | 30 | $0.004 | $0.12 |
| Content brief generation | 20 | $0.003 | $0.06 |
| Competitor intercept | 15 | $0.010 | $0.15 |
| RAG chatbot | 40 | $0.006 | $0.24 |
| Remaining ~445 credits | — | $0.002 avg | $0.89 |
| **User subtotal** | | | | **~$2.15** |

**Agency monthly AI COGS: ~$7.67**
COGS model assumption (AI-only component): ~$9.50. **Assumption holds with 19% margin.**

---

## Section 3: Aggregate Cost at Scale

This is the critical section. Your margin model is only safe if AI COGS do not grow disproportionately as customer count scales.

### Cost at customer milestones

Assumptions: plan mix = 70% Starter, 20% Growth, 10% Agency (early skew toward Starter).

| Milestone | Customers | Starter | Growth | Agency | AI COGS/month | Revenue/month | AI as % of Revenue |
|-----------|-----------|---------|--------|--------|---------------|---------------|-------------------|
| 10 customers | 10 | 7 | 2 | 1 | ~$15 | ~$690 | 2.2% |
| 50 customers | 50 | 35 | 10 | 5 | ~$80 | ~$3,495 | 2.3% |
| 100 customers | 100 | 70 | 20 | 10 | ~$160 | ~$6,990 | 2.3% |
| 250 customers | 250 | 150 | 70 | 30 | ~$450 | ~$20,220 | 2.2% |
| 500 customers | 500 | 300 | 140 | 60 | ~$900 | ~$40,440 | 2.2% |

**Conclusion: AI COGS is stable at ~2.2–2.3% of revenue across all scale milestones with this plan mix.**

The business is not at risk from AI pricing at current scale. The margin model is stable.

### What breaks this model

| Scenario | Trigger | Impact |
|----------|---------|--------|
| OpenAI raises gpt-4o pricing 3× | gpt-4o used for fear-audit (cron) + chat-assistant (credits) | Hallucination audit cost triples. Agency automated COGS rises by ~$1.80/month. Manageable — substitute gpt-4o-mini for fear-audit. |
| Perplexity raises sonar pricing 3× | SOV primary model for all tiers | Starter COGS doubles from $0.48→$0.90. Growth COGS rises from $0.88→$1.50. Agency rises by ~$9.00. Manageable — switch SOV primary to gpt-4o-mini, demote Perplexity to Growth+. |
| Agency customers hit full credit utilization (100%) | 2,000 credits used vs. modeled 600 | Agency user-initiated costs triple to ~$6.45. Total Agency AI COGS: ~$12. Still inside the margin model at $449/month ARPU. |
| All plans hit full credit utilization | Viral growth or heavy users | At 100% utilization, Starter rises to $0.75, Growth to $2.10, Agency to $12. Margin compresses at Starter tier to 82%. Acceptable but worth monitoring. |
| Sandbox simulation cost spike | Claude Sonnet 4 price increase 2× | Agency automated rises ~$0.75/month. Low risk. Sandbox can be downgraded to claude-haiku-4.5 at the cost of output quality. |

---

## Section 4: High-Risk Cost Vectors

These are the specific features that carry the most cost risk. Monitor these first.

### Risk 1: SOV cron volume (CRITICAL to monitor)

The SOV cron is the single largest cost driver. It runs weekly per org and scales with:
- Number of locations per org
- Number of target queries per location
- Number of SOV models enabled by plan

An Agency customer with 20 locations and 30 queries per location would generate:
- 20 × 30 × 4 × 3 models = 7,200 requests/month
- Perplexity cost alone: 3,600 × $0.005 = $18/month

This is 2× the modeled Agency cost. The current model assumes 10 locations and 15 queries.

**Control already in place:** `target_queries` table has `is_active` column — inactive queries are skipped. The SOV cron only processes `is_active = true` queries.

**Additional control needed:** Cap active queries per location by plan:
- Starter: max 20 active queries
- Growth: max 40 active queries
- Agency: max 100 active queries per location (current limit: unlimited)

Document this cap in `lib/plan-enforcer.ts` before launch. This is a launch requirement.

### Risk 2: Chat assistant (gpt-4o) usage

The chat assistant uses `gpt-4o` at $2.50/$10.00 per 1M tokens — the most expensive model in the stack. A heavy user running 50+ chat sessions/month at 2,000 tokens/session costs $0.50+ in chat alone.

The credit system caps this: 1 credit per chat message. At 500 credits (Growth), a user cannot exceed ~500 chat messages/month. Even at maximum usage, the cost is bounded by the credit limit.

**Verify:** `app/api/chat/route.ts` — confirm it consumes 1 credit per message (not per session) and that Upstash rate limiting (20 req/hr) is enforced in addition to the credit system.

### Risk 3: Sandbox simulation (claude-sonnet-4)

The sandbox simulation uses Claude Sonnet 4 — the second most expensive model at $3.00/$15.00 per 1M tokens. It runs monthly per location for Agency plans.

At 10 locations per Agency customer, a single sandbox run costs ~$0.75. If the simulation generates long outputs (>3,000 tokens), cost rises to $1.50+.

**Control:** The sandbox cron has `STOP_SANDBOX_CRON` kill switch. If per-Agency sandbox costs exceed $2.00/month, evaluate downgrading the model to `claude-haiku-4.5` for preliminary analysis and reserving Claude Sonnet only for the final synthesis step.

### Risk 4: Menu OCR (gpt-4o vision)

Menu OCR uses gpt-4o vision. A large PDF menu with 10+ pages generates 20,000+ input tokens = $0.05 per upload. This is credit-gated (1 credit per upload) but the token cost per credit is 10–15× higher than average.

At Starter plan (25 credits, 30% utilization = 7 credits used), if all 7 are menu OCR = $0.35 in OCR costs alone — nearly equal to all automated cron costs.

**Control already in place:** Menu OCR is credit-gated. Starter plan's 25-credit limit naturally bounds this.

**Monitor:** Track `api_credits.credit_usage_log` for `action='uploadMenuFile'` to see actual token distribution.

---

## Section 5: Cost Control Architecture

Controls currently implemented in the codebase:

| Control | Implementation | Protects Against |
|---------|---------------|-----------------|
| Monthly credit limits | `lib/credits/credit-limits.ts` | User-initiated cost runaway |
| Credit fail-open pattern | `checkCredit()` returns allowed=true when Redis unavailable | Revenue loss from Redis outage (cost accepted) |
| Rate limiting (Upstash) | `proxy.ts` + `app/api/chat/route.ts` | Burst attack on expensive models |
| SOV kill switches | `STOP_SOV_CRON` etc. in env vars | Emergency cost shutoff |
| `is_active` query flag | `target_queries.is_active` | Unused queries don't burn tokens |
| Multi-model plan gating | `PLAN_SOV_MODELS` in `lib/config/sov-models.ts` | Cheaper plans don't run expensive multi-model SOV |
| Credit consumption logging | `credit_usage_log` table | Auditing + cost anomaly detection |

### Missing controls (add before launch)

| Control | Why Needed | Where to Implement |
|---------|-----------|-------------------|
| Active query cap by plan | Prevents unlimited query growth per location | `lib/plan-enforcer.ts` new fn `getMaxActiveQueriesPerLocation()`. Check in `target_queries` insert action. |
| Per-org monthly AI spend alert | Early warning before credits exhaust | Admin cron: if `credits_used > 0.85 × credits_limit`, log to Sentry + send admin alert email |
| SOV model count validation | Ensures cron doesn't run more models than plan allows | Already in `getEnabledModels()` — verify it's called before the cron loop, not after |
| Sandbox max output tokens | Claude Sonnet output cost is the variable risk | Add `maxTokens: 2000` to `sandbox-simulation` model call |

---

## Section 6: OpenAI / Provider Pricing Sensitivity

Model your exposure to a provider pricing change. These are the key dependencies:

### OpenAI dependency

OpenAI models used: gpt-4o, gpt-4o-mini, text-embedding-3-small.

OpenAI COGS share:
- Starter: ~15% (fear-audit + credits mix)
- Growth: ~35% (fear-audit + more credits)
- Agency: ~20% (diluted by Perplexity SOV dominance)

**Mitigation:** gpt-4o-mini can substitute for gpt-4o in most uses except:
- `fear-audit` (hallucination detection) — downgrade risk: lower hallucination detection accuracy
- `chat-assistant` — downgrade risk: lower response quality for complex queries

Switching `fear-audit` from gpt-4o to gpt-4o-mini saves ~$0.55/month on Agency, reduces fear-audit cost by 15×. Trade-off: hallucination false negative rate may increase. Acceptable to test at launch.

### Perplexity dependency

Perplexity is the **primary SOV model** for all paid plans. It is the highest-cost automated line item.

If Perplexity raises prices 3×:
- Starter automated COGS: $0.37 → $0.97 (still inside $0.60 is wrong — this breaks Starter margin)
- Growth automated COGS: $0.46 → $1.36
- Agency automated COGS: $5.52 → $14.52

**Mitigation if Perplexity pricing changes:**
1. Downgrade Starter SOV from Perplexity to gpt-4o-mini (`sov-query-gpt` key already exists)
2. Promote gpt-4o-mini to primary for Growth
3. Keep Perplexity only for Growth+ (live-web differentiation)
4. The `SOV_MODEL_CONFIGS` in `lib/config/sov-models.ts` is the SSOT — one config change affects all tiers

This migration can be executed in under 1 hour.

### Anthropic dependency

Anthropic (Claude Sonnet 4) is used for sandbox simulation only. If Anthropic raises pricing:
- Impact: Agency automated COGS rises ~$0.75/month per pricing doubling
- Mitigation: Downgrade to claude-haiku-4.5 for sandbox prelim; keep Sonnet for final synthesis only

Low risk. Do not pre-optimize this.

---

## Section 7: Monitoring Alerts

Set these up before the first paying customer. Use Sentry for implementation.

### Alert 1: Per-org AI cost anomaly

**Condition:** Any single org's `credits_used` reaches 90% of their `credits_limit` before the 25th of the month.

**Implementation:** Add to the weekly digest cron — after processing all orgs, run:

```sql
SELECT org_id, credits_used, credits_limit,
  (credits_used::float / credits_limit) as utilization_ratio
FROM api_credits
WHERE reset_date > NOW()
  AND (credits_used::float / credits_limit) > 0.9;
```

If any row exists, send an admin alert via Sentry `captureMessage`. Do not alert the user — let the credit block handle that.

### Alert 2: SOV cron cost spike

**Condition:** Weekly SOV cron processes more than 1,000 total evaluations in a single run (indicates a customer with excessive query volume).

**Implementation:** In `app/api/cron/sov/route.ts`, count total evaluations written in the run. If `totalEvaluations > 1000`, log via `Sentry.captureMessage('SOV cost spike', { extra: { count, topOrgs } })`.

### Alert 3: OpenAI spend tracker

**Implementation:** On the 1st of each month, run `npm run ai:cost-report` (create this script). It reads the Sentry log of `consumeCredit()` calls tagged by model and produces a per-model cost estimate. Compare against this document's projections.

Until that script exists, manually check the OpenAI / Perplexity / Anthropic / Google billing dashboards on the 1st of each month. Set billing alerts in each provider's dashboard at these levels:

| Provider | Alert 1 (warning) | Alert 2 (action required) |
|----------|------------------|--------------------------|
| OpenAI | $50/month | $150/month |
| Perplexity | $30/month | $100/month |
| Anthropic | $20/month | $75/month |
| Google AI | $10/month | $40/month |

These thresholds correspond to approximately 200 paying customers at expected utilization. If any alert fires before 200 customers, investigate for a cost anomaly.

---

## Section 8: Validation After First 10 Paying Customers

Run this analysis after 10 paying customers have completed their first full billing month.

### Data to pull

```sql
-- Actual credit utilization by plan
SELECT
  o.plan,
  COUNT(*) as orgs,
  AVG(ac.credits_used) as avg_credits_used,
  AVG(ac.credits_limit) as avg_credits_limit,
  AVG(ac.credits_used::float / ac.credits_limit) as avg_utilization
FROM api_credits ac
JOIN organizations o ON o.id = ac.org_id
WHERE ac.reset_date > NOW()
GROUP BY o.plan;

-- Credit consumption by action type
SELECT action_type, COUNT(*) as calls, SUM(credits_consumed) as total_credits
FROM credit_usage_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY action_type
ORDER BY total_credits DESC;

-- SOV evaluation volume by org
SELECT org_id, COUNT(*) as evals_30d
FROM sov_evaluations
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY org_id
ORDER BY evals_30d DESC;
```

### Validation criteria

| Metric | Model assumption | Action if wrong |
|--------|-----------------|-----------------|
| Starter AI COGS | < $0.75/month | If >$0.75: cap active queries at 20 |
| Growth AI COGS | < $2.00/month | If >$2.00: add max query cap for Growth |
| Agency AI COGS | < $12.00/month | If >$12.00: enable sandbox token cap + query cap |
| Credit utilization (Starter) | < 40% | If >40%: credits are fine, no action |
| Credit utilization (Growth) | < 30% | If >30%: fine — model was conservative |
| Credit utilization (Agency) | < 40% | If >40%: monitor closely |
| Top credit action | menu-ocr or chat | If chat-assistant is dominant: reduce chat credit cost per message |

### Update UNIT-ECONOMICS.md after this analysis

After the 10-customer validation, update the AI COGS line items in `docs/UNIT-ECONOMICS.md` with actual numbers. Note the date and sample size in the update.

---

_Last updated: 2026-03-05_
_Owner: Senthilbabu_
_Next action: (1) Add `getMaxActiveQueriesPerLocation()` to `lib/plan-enforcer.ts` before launch. (2) Set billing alerts in OpenAI / Perplexity / Anthropic / Google dashboards. (3) Run Section 8 validation after first 10 paying customers complete Month 1._
