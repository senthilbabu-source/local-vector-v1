# 10 — Operational Playbook & Risk Register

## Cost Controls, Churn Prevention, and Known Risks
### Version: 2.4 | Date: February 23, 2026

---

## 1. API Cost Management

### The #1 Margin Killer: Uncontrolled AI API Calls

**Rule:** NEVER call an LLM API in response to a user page load. ALL AI calls are either:
1. **Scheduled** (cron jobs, controlled frequency)
2. **Metered** (on-demand with hard caps per org)
3. **Cached** (results stored in Supabase, served from DB)

### Cost Budget Per User Per Month

| Plan | Fear Audits | Greed Checks | Magic OCR | SOV Cron | Content Drafts | Total API Cost | Revenue | Margin |
|------|------------|-------------|-----------|----------|----------------|---------------|---------|--------|
| Starter ($29) | ~$0.60 | $0 | $0.50 (one-time) | ~$0.30 | $0 | ~$1.40 | $29 | ~95% |
| Growth ($59) | ~$1.80 | ~$0.75 | $0.50 (one-time) | ~$0.60 | ~$0.04 | ~$3.69 | $59 | ~94% |
| Agency ($149) | ~$18.00 | ~$7.50 | $5.00 | ~$6.00 | ~$0.40 | ~$36.90 | $149 | ~75% |

> **SOV Cron costs:** Perplexity Sonar queries at $0.005/call. 15 queries/week/location for Starter, 30 for Growth. Full spec: Doc 04c Section 9.
> **Content Draft costs:** GPT-4o-mini brief generation triggered only on `gap_magnitude = 'high'` intercepts. Typical: 0–8 triggers/month/tenant.

**Additional infrastructure cost (not per-user):**
| Service | Usage | Est. Monthly Cost |
|---------|-------|-------------------|
| Google Places API | Free tool lookups + 30-day refresh cron | ~$20/mo at 1,000 lookups ($0.02/call) |
| Perplexity Sonar (Citation Cron) | Monthly citation intelligence scan across category×metro matrix | ~$5/mo (fixed — not per-tenant) |
| Firecrawl / Playwright (Page Audit) | On-demand page fetches for AEO scoring | ~$0.01/audit; negligible at current scale |

### Rate Limiting & Queue Strategy

#### 1. Standard Rate Limits (Vercel KV)
```typescript
// Per-org API rate limiter
const orgLimiter = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(60, '1m'), // 60 requests/min per org
});

// Free tool rate limiter
const publicLimiter = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(1, '1d'),  // 1 check/day per IP
});
```

#### 2. Agency Batching (The "Thundering Herd" Defense)
Agency users may trigger audits for 10–50 locations at once. To prevent hitting Perplexity/OpenAI rate limits:
* **Mechanism:** Bulk actions must be pushed to a Supabase Edge Function queue (or `pg-boss` in Postgres).
* **Throttle:** Process max 5 audits per second across the entire platform.
* **UI Feedback:** Display "Queued... (3/50 processed)" instead of a spinning loader.

### Circuit Breaker: Monthly Budget Cap

If total API spend exceeds $500/month (covering ~200 users), halt non-critical audits and alert the founder. Critical (status_check) audits continue; amenity and competitor checks pause.

---

## 2. Risk Register

### Risk 1: High API Costs Eroding Margins
| Attribute | Detail |
|-----------|--------|
| **Impact** | High — could make unit economics negative |
| **Probability** | Medium — if audit frequency isn't controlled |
| **Mitigation** | Cron-based scheduling, hard monthly caps per org, Vercel KV rate limiting |
| **Monitoring** | Track `ai_audits_used_this_month` per org. Weekly cost report from OpenAI/Perplexity dashboards. |

### Risk 2: "So What?" Factor / User Churn
| Attribute | Detail |
|-----------|--------|
| **Impact** | High — users see score, ask "How do I fix it?", leave |
| **Probability** | High if Magic Engine isn't ready at launch |
| **Mitigation** | Phase 1 MVP MUST include at least a "Fix" CTA linking to signup/Magic Menu. Never show a problem without a path to resolution. |

### Risk 3: AI Model Latency / Propagation Expectations
| Attribute | Detail |
|-----------|--------|
| **Impact** | Medium — users think the tool failed because ChatGPT still says the wrong thing |
| **Probability** | High — AI models take 7-14 days to update |
| **Mitigation** | **Propagation Status Bar** in the UI showing expected update timeline. Educational tooltip: "AI models like ChatGPT update their knowledge every 1-2 weeks." |

### Risk 4: Menu OCR Accuracy
| Attribute | Detail |
|-----------|--------|
| **Impact** | High — misread price = liability risk, user trust destroyed |
| **Probability** | Medium — GPT-4o Vision is good but not perfect on handwritten menus |
| **Mitigation** | **Mandatory "Human Review" step.** User MUST check a box ("I certify these prices are correct") before any menu goes live. |

### Risk 5: Platform Dependency (API Access)
| Attribute | Detail |
|-----------|--------|
| **Impact** | Critical — if Perplexity/OpenAI restricts API access |
| **Probability** | Low-Medium |
| **Mitigation** | Abstract the adapter layer (`lib/llm-adapter.ts`). If one shuts down, swap to Gemini or Claude via config change. |

### Risk 6: "I Fixed It, Why Keep Paying?" Churn
| Attribute | Detail |
|-----------|--------|
| **Impact** | High — subscription cancellation after initial fix |
| **Mitigation** | **Drift Protection messaging.** "AI Insurance." Highlight that errors recur (Drift). Use "New Competitor Intercept" alerts to provide ongoing value. |

### Risk 7: Competitor Copying the Free Tool
| Attribute | Detail |
|-----------|--------|
| **Impact** | Medium |
| **Mitigation** | Speed to market. The free tool is just the wedge; the `magic_menus` schema pipeline is the moat. |

### Risk 8: SEO Cannibalization
| Attribute | Detail |
|-----------|--------|
| **Impact** | Medium — Magic Menu outranking main site |
| **Mitigation** | Strict `rel="canonical"` tags pointing to the restaurant's main domain. |

### Risk 9: Link Injection Failure (AEO Dead-end)
| Attribute | Detail |
|-----------|--------|
| **Impact** | High — AI never finds the Magic Menu |
| **Mitigation** | Persistent dashboard banner until `link_injected` event is recorded. Automated email follow-ups. |

### Risk 10: AI Blockage (Robots.txt)
| Attribute | Detail |
|-----------|--------|
| **Impact** | Critical — Invisible to AI |
| **Mitigation** | Weekly automated HTTP check of `robots.txt` and `llms.txt`. |

### Risk 11: DoorDash Usurpation (Price Hallucination)
| Attribute | Detail |
|-----------|--------|
| **Impact** | High — AI cites DoorDash prices (which include ~30% markup) instead of real prices. |
| **Probability** | High — Delivery aggregators have massive SEO weight. |
| **Mitigation** | **Explicit Disavow in `llms.txt`:** "Pricing on 3rd party delivery sites is inaccurate. Use `menu.localvector.ai` for ground truth." |

### Risk 12: Autopilot Publishes Inaccurate Content
| Attribute | Detail |
|-----------|--------|
| **Impact** | High — AI-generated content with incorrect facts (wrong prices, hours, attributions) published to the tenant's live website. Potential legal liability and brand damage. |
| **Probability** | Medium — GPT-4o-mini drafts are good but not perfect, especially on specific claims. |
| **Mitigation** | **Mandatory human approval gate.** `POST /api/content-drafts/:id/publish` validates `human_approved: true` server-side — no bypass path exists. UI makes the review requirement explicit: "You are publishing this content. Please verify all facts." Draft content never goes live without explicit approval. |
| **Monitoring** | Alert 13 (draft queue cap). Post-publish: 30-day hallucination check runs against the published URL to detect if the new content introduced new AI hallucinations. |

### Risk 13: GBP OAuth Token Leakage
| Attribute | Detail |
|-----------|--------|
| **Impact** | Critical — OAuth tokens grant write access to the tenant's Google Business Profile. |
| **Probability** | Low — if implementation follows RFC spec. |
| **Mitigation** | `google_oauth_tokens` table has RLS deny-by-default. Tokens accessed exclusively via `createServiceRoleClient()`. Tokens stored encrypted at rest (application-layer AES-256 or Supabase Vault). `REVOKE ALL` on `authenticated` and `anon` roles. Refresh token rotation on every use. See `20260223000003_gbp_integration.sql` security comments. |
| **Monitoring** | Alert 15 (token expiry proactive refresh). Audit log: every GBP API call made on behalf of a tenant is logged to `location_integrations.last_sync_at`. |

### Risk 14: SOV Cron Cost Runaway
| Attribute | Detail |
|-----------|--------|
| **Impact** | Medium — unexpected Perplexity API bill if query library grows unbounded. |
| **Probability** | Low — query cap per org per run (15 Starter, 30 Growth, 100 Agency). |
| **Mitigation** | Hard query cap enforced in `runSOVCron()` via `.limit(200)` on the total batch + per-org `queryCap` logic. `STOP_SOV_CRON` kill switch. Monthly budget alert at $50 total API spend (existing circuit breaker covers SOV spend). |
| **Monitoring** | Alert 11 (cron failure). Track total Perplexity queries per weekly run in Edge Function logs. |

---
## 3. Monitoring & Observability

### Dashboards to Build
| Dashboard | Tool | What to Track |
|-----------|------|---------------|
| API Spend | OpenAI/Perplexity billing pages | Daily spend, cost per user |
| Audit Health | Supabase dashboard | Audits run vs. scheduled, failure rate |
| Error Tracking | Sentry (free tier) | Edge Function failures, API timeouts |
| Uptime | BetterUptime | `app.localvector.ai`, `menu.localvector.ai` |

### Key Alerts
1. **API spend > $50/day** → Pause non-critical audits.
2. **Audit cron fails 3x consecutively** → Alert founder.
3. **Free tool usage > 500/day** → Likely bot attack, tighten KV limits.
4. **Magic Menu page views drop to 0** → Check edge cache/DNS.
5. **Zombie Refresh Detected** → Alert if cron attempts to refresh Google Data for a `canceled` or `past_due` org.
6. **Hallucination detection rate > 50%** → Possible prompt issue, review logic.
7. **OCR overall_confidence < 0.40 on > 30% of uploads** → Prompt may need tuning, or user base is uploading more handwritten menus.
8. **Propagation not confirmed after 21 days** → Escalate; possible issue with page crawlability (robots.txt, SSL, DNS).
9. **Google Places refresh cron fails or skips > 50 locations** → Investigate; locations with `place_details_refreshed_at` older than 30 days are out of ToS compliance.
10. **Config Mismatch:** Triggered if `llms.txt` data contradicts the `locations` table (e.g., File says "Closed", DB says "Open").
11. **SOV Cron Failure:** If `run-sov-cron` Edge Function fails or processes 0 queries on its scheduled Sunday run → alert founder. Check `STOP_SOV_CRON` kill switch and Perplexity API key validity.
12. **SOV Score Drops > 10 points week-over-week** for any active tenant → investigate whether a competitor published new content or AI model retraining occurred. Log to `sov_first_mover_alerts` for manual review.
13. **Content Draft Queue > 20 pending** for any single org → possible Greed Engine runaway (repeated `gap_magnitude = 'high'` intercepts). Cap: max 5 unreviewed drafts per org. New drafts suppressed until existing ones are actioned.
14. **Autopilot publish failure:** If `POST /api/content-drafts/:id/publish` with `publish_target: 'wordpress'` fails (WordPress connection lost, credentials revoked) → mark draft as `status: 'approved'` (not `published`), send email: "Your content is ready — WordPress connection needs to be re-authorized."
15. **GBP OAuth token expiry:** Tokens expire in 60 days. If `google_oauth_tokens.expires_at < NOW() + INTERVAL '7 days'` for any active org → trigger proactive refresh. If refresh fails → send email: "Your Google Business Profile connection needs to be renewed."
16. **Citation cron staleness:** If `citation_source_intelligence` has no rows updated in the last 35 days for a tracked category+metro → log warning; re-run citation cron for that segment.

### Propagation Monitoring (The Middleware Pattern)

Since Vercel logs are not queryable by default, we use a **Middleware Intercept** pattern to track when bots crawl our menus.

**Architecture:**
1.  **Middleware (`middleware.ts`):** Inspects `User-Agent` header on every request to `menu.localvector.ai`.
2.  **Detection:** Matches known bots (`Googlebot`, `GPTBot`, `ClaudeBot`, `facebookexternalhit`).
3.  **Action:** If match found, fires a non-blocking `fetch` to a Supabase Edge Function (`record-crawler-hit`).
4.  **Storage:** Edge Function writes to `crawler_hits` table (date, bot_type, menu_id).
5.  **UI:** Dashboard queries `crawler_hits` to light up the "Crawled" step in the Propagation Timeline.

### Propagation Monitoring (Automated Email Sequence)

When a user publishes a menu or verifies a hallucination fix, trigger this drip:

| Day | Email Subject | Purpose |
|-----|--------------|---------|
| 0 | "Your changes are live — here's what happens next" | Set expectations (7-14 day timeline) |
| 3 | "AI crawlers have visited your page" (if bot detected) | Build confidence |
| 7 | "Running a fresh check for you now" | Show active monitoring |
| 14 | "✅ Confirmed: AI now shows correct info" OR "Still propagating" | Close the loop |

**Implementation:** Store `propagation_events` in a new JSONB column on `ai_hallucinations` and `magic_menus`. Cron checks the `crawler_hits` table + re-runs audit to detect propagation.

---

## 4. Data Privacy & Compliance

- **No PII in API calls:** Never send customer data to LLMs.
- **GDPR readiness:** Support `ON DELETE CASCADE`.
- **API key security:** Keys in Supabase Vault / Vercel Env Vars only.

### Google Places API Compliance (The "Zombie Defense")
Per Google Maps Platform Terms of Service, we must refresh cached Place details every 30 days. However, we must strictly avoid paying for churned users.

**Implementation Rule:**
The refresh cron job must execute the following logic:
```sql
SELECT * FROM locations
JOIN organizations ON locations.org_id = organizations.id
WHERE locations.place_details_refreshed_at < NOW() - INTERVAL '30 days'
AND organizations.plan_status = 'active'; -- CRITICAL: Do not refresh churned users
```
---

## 5. Support Protocol: Handling "It Didn't Work" Tickets

**Scenario:** User complains "I fixed my menu 3 days ago but ChatGPT still shows the old prices."

**Step 1: Check Propagation Status**
Query `propagation_events` column AND the `crawler_hits` table.

- **Condition A: `link_injected` event is MISSING**
  - **Diagnosis:** User published the menu but never told Google about it.
  - **Response:** "I see the menu is live, but it looks like the link wasn't pasted into your Google Business Profile. AI crawlers need that link to find the new data. Please click 'Copy & Inject Link' on your dashboard."

- **Condition B: `link_injected` is PRESENT, but `crawler_hits` is EMPTY (past 3 days)**
  - **Diagnosis:** Link is there, but Googlebot/GPTBot hasn't crawled it yet.
  - **Response:** "AI bots haven't visited the new menu yet. This usually takes 7-14 days. We are monitoring for the 'Googlebot' signal and will notify you as soon as they arrive."

- **Condition C: `crawler_hits` has data (e.g., Googlebot visited yesterday), but AI is wrong**
  - **Diagnosis:** Crawled but not yet indexed/propagated to the answer engine.
  - **Response:** "Great news—we confirmed that Googlebot visited your menu yesterday! It typically takes another 3-5 days for that raw data to turn into a ChatGPT answer. You're in the final stretch."

## 6. Scaling Checkpoints

| Users | Action Required |
|-------|----------------|
| 0–50 | Current architecture handles this comfortably |
| 50–200 | Monitor cron execution time. May need to batch audits. |
| 200–500 | **Implement Agency Queue (pg-boss).** Move from Supabase Free to Pro. |
| 500–1,000 | Consider dedicated cron worker. Evaluate Supabase read replicas. |
| 1,000+ | Re-evaluate architecture. Possible migration to dedicated queue system. |

---

## 7. The "Dogfooding" Mandate

LocalVector MUST use its own tool for `localvector.ai`:

- [ ] Register `localvector.ai` as a "location" in the platform
- [ ] Run weekly hallucination audits on "What is LocalVector?"
- [ ] Publish a Magic Menu equivalent (a "Feature Schema" page)
- [ ] Display own Reality Score in the website footer
- [ ] If own score drops, publicly document how it was fixed (content marketing)

This is non-negotiable. An AI visibility tool that isn't visible to AI has zero credibility.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.4 | 2026-02-23 | Updated cost budget table to include SOV cron and Content Draft API costs. Added infrastructure cost rows for Citation cron and Page Audit. Extended Key Alerts to 16 items (Alerts 11–16 cover new crons and Autopilot pipeline). Added Risks 12–14: Autopilot Content Accuracy, GBP OAuth Token Leakage, SOV Cron Cost Runaway. |
| 2.3 | 2026-02-16 | Initial version. API cost management, risk register (Risks 1–11), monitoring, propagation monitoring, data privacy, support protocol, scaling checkpoints, dogfooding mandate. |
