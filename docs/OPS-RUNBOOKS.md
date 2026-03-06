# LocalVector.ai — Reliability & Ops Runbooks

**Version:** 1.0 — March 5, 2026
**Owner:** Senthilbabu
**Status:** Pre-launch. Review and test before first paying customer.

---

## How to Use This Document

This document is the on-call reference for a solo founder. It is written for the assumption that you are the only person who will execute these runbooks. Each runbook is structured as: detect → assess → mitigate → resolve → prevent.

- **Section 1:** Incident severity levels and response times
- **Section 2:** System dependency map (what breaks when X goes down)
- **Section 3:** Runbooks 1–10 (most likely failure scenarios)
- **Section 4:** Disaster Recovery plan
- **Section 5:** Monitoring checklist — what to watch before launch

---

## Section 1: Incident Severity Levels

| Level | Name | Definition | Response Time | Examples |
|-------|------|-----------|---------------|---------|
| P0 | Critical | All paid customers cannot use the product | Immediate (wake up) | Database down, auth broken, billing failing |
| P1 | High | Core feature broken for all or majority of users | Within 1 hour | AI scans not running, crons silently failing, emails not sending |
| P2 | Medium | Feature degraded or broken for subset of users | Within 4 hours | One AI model down, GBP OAuth expired, specific plan feature broken |
| P3 | Low | Minor degradation, cosmetic, or non-critical | Next business day | Benchmark data stale, UI glitch, slow query |

**Solo founder on-call rule:** P0 and P1 wake you up. P2 and P3 go on the next-morning triage list.

**Incident log:** When you resolve a P0 or P1, write a one-paragraph entry in `docs/DEVLOG.md` under a "Incidents" section. Include: what broke, when, how you found out, what you did, and what you changed to prevent recurrence.

---

## Section 2: System Dependency Map

Understanding what breaks when each service goes down prevents wasted triage time.

| Service | Role | What Breaks if Down | Fail Behavior | Kill Switch |
|---------|------|--------------------|-----------|----|
| **Supabase** | Database + Auth + Storage | Everything — auth, all data reads/writes, RLS | Hard failure, 500s | None — this is P0 |
| **Vercel** | Hosting + Cron execution | All pages + all crons | Hard failure | None — this is P0 |
| **OpenAI** | SOV scans, content generation, FAQ generation, hallucination detection | AI scans fail, content drafts fail | Error recorded in Sentry, scan marked failed | `STOP_SOV_CRON`, `STOP_AUTOPILOT_CRON` |
| **Perplexity** | SOV scans (Growth+ model), citation detection | Multi-model SOV shows 1 fewer model | Error isolated per-model, others continue | Configured in `SOV_MODEL_CONFIGS` |
| **Anthropic** | Sandbox simulation, content ingestion analysis | Sandbox feature broken | Error returned to user | `STOP_VAIO_CRON` |
| **Google Gemini** | SOV scans (Agency model), AI preview | Agency multi-model SOV degraded | Error isolated per-model | Configured in `SOV_MODEL_CONFIGS` |
| **Stripe** | Billing, plan gating | Upgrades/downgrades fail, webhook plan sync breaks | Webhook retry (3x), plan stays as-is | None |
| **Resend** | Transactional email + digest | Users don't receive scan alerts, digest | `.catch()` — never throws, Sentry logs | `STOP_DIGEST_CRON` |
| **Inngest** | Async SOV fan-out, manual scan trigger | SOV runs synchronously (inline fallback active) | Falls back to inline execution | Fallback already coded |
| **Upstash Redis** | Rate limiting, domain resolver cache | Rate limiting fails open (no blocking), cache misses → DB hit | Fail-open — no user impact | None needed |
| **Sentry** | Error monitoring | Errors undetected until user reports | No user impact | None needed |

---

## Section 3: Runbooks

---

### Runbook 1 — Supabase Outage (P0)

**Detection:**
- `/api/health` returns 503 (Supabase connectivity check)
- Sentry alert: `supabase_health_check_failed`
- Vercel function logs: `connect ECONNREFUSED` or `PGRST` errors at high volume
- Users cannot log in

**Impact:** Complete product outage. All features broken.

**Immediate mitigation:**
1. Check Supabase status page.
2. If confirmed outage: post a status update on your status page or send a direct email to any active users with "We're experiencing a service interruption and are monitoring the situation."
3. Do not restart Vercel deployments — this will not help.

**Resolution:**
1. Wait for Supabase to resolve. Supabase has a 99.9% SLA on Pro plan.
2. After recovery: verify `/api/health` returns 200.
3. Check `cron_run_log` — any crons that were scheduled during the outage will not have run. Manually trigger affected crons if the data gap matters:
   - SOV cron missed: data is stale but not corrupt. Next Sunday it will run normally.
   - Digest cron missed: no email sent. Not critical.
   - NAP sync missed: Monday 3 AM UTC — skip is fine, runs next week.

**Prevention:**
- Ensure Supabase project is on **Pro plan** before launch (free tier has no SLA).
- Monitor `/api/health` with an external uptime checker (see Section 5).

---

### Runbook 2 — All AI Scans Failing (P1)

**Detection:**
- Sentry: high volume of `OpenAI API error` or `rate_limit_exceeded` errors
- Admin cron health dashboard (`/admin/cron-health`): SOV cron `status=failed` on last run
- User reports: "My AI Health Score hasn't updated"

**Impact:** Weekly SOV scans not running. AI Health Score goes stale. Users on Growth/Agency expect Sunday scans.

**Immediate mitigation:**
1. Check kill switch: ensure `STOP_SOV_CRON` is not set to `true` in Vercel env vars.
2. Check OpenAI status page.
3. Check `api_credits` table — if any org has `credits_used >= credits_limit`, the scan is gated. This is expected behavior.
4. If OpenAI is down: activate kill switch `STOP_SOV_CRON=true` to prevent noisy cron failures from accumulating in logs.

**Resolution:**
1. Once OpenAI is recovered: remove kill switch.
2. Manually trigger SOV scan for affected orgs via admin panel (`/admin/customers/[orgId]` → Force Cron Run → `sov`).
3. Check `cron_run_log` to confirm successful runs.

**Prevention:**
- Each AI model is isolated in `runMultiModelQuery()` — one model failing does not block others.
- Credit limits are fail-open: if credits table is unavailable, scan proceeds.
- Add OpenAI to uptime monitoring.

---

### Runbook 3 — Stripe Webhook Failures (P1)

**Detection:**
- Stripe Dashboard → Webhooks → check for `failed` events
- Sentry: `stripe_webhook_processing_error`
- User reports: "I upgraded but my plan didn't change"

**Impact:** Plan upgrades/downgrades not reflected in DB. Users on wrong plan tier.

**Immediate mitigation:**
1. Go to Stripe Dashboard → Developers → Webhooks → your endpoint → Event log.
2. Identify which events failed and why (usually: endpoint timeout, signature mismatch, or 500 from your handler).
3. For each failed event: click "Resend." Stripe retry is idempotent — `isEventAlreadyProcessed()` prevents double-processing.

**Resolution:**
1. If signature mismatch: check `STRIPE_WEBHOOK_SECRET` env var in Vercel matches the signing secret for your endpoint in Stripe.
2. If handler error: check Sentry for the specific exception. Fix the code and deploy.
3. After resending all failed events: verify `organizations.plan` matches the customer's Stripe subscription in the admin panel.
4. For users stuck on wrong plan: use admin action `adminOverridePlan()` via `/admin/customers/[orgId]` while the webhook issue is resolved.

**Prevention:**
- `isEventAlreadyProcessed()` in `lib/stripe/webhook-idempotency.ts` prevents duplicate processing on retry.
- Webhook endpoint has a 10s timeout — ensure webhook handler completes within this.
- Monitor Stripe webhook health weekly.

---

### Runbook 4 — Email Delivery Failures (P1)

**Detection:**
- Resend Dashboard → Logs → filter for bounced/failed
- Sentry: `resend_send_failed` tagged events
- User reports: "I never received my scan results email"

**Impact:** Users miss scan complete alerts, weekly digests, correction follow-up alerts.

**Immediate mitigation:**
1. Check Resend status page.
2. Check Resend dashboard for bounce patterns — if a specific domain is bouncing, it's likely a recipient-side issue.
3. If widespread delivery failure: emails are fire-and-forget — no user data is lost. The next scan cycle will attempt to resend.

**Resolution:**
1. If Resend is down: wait for recovery. Email sends are wrapped in `.catch()` — no cron or action fails due to email error.
2. If specific user is not receiving emails: ask them to check spam. Verify their email in Supabase `auth.users`. Verify `notify_*` preferences in `organizations` table.
3. If FROM domain is flagged: check DNS records for `localvector.ai` — DKIM, SPF, and DMARC must be configured in Resend and verified before launch.

**DNS records required before launch:**
```
SPF:  v=spf1 include:_spf.resend.com ~all
DKIM: resend._domainkey.localvector.ai → provided by Resend
DMARC: _dmarc.localvector.ai → v=DMARC1; p=none; rua=mailto:dmarc@localvector.ai
```

**Prevention:**
- Verify all DNS records in Resend before first production email.
- Test email delivery to Gmail, Outlook, and Apple Mail accounts before launch.

---

### Runbook 5 — GBP OAuth Token Expiry (P2)

**Detection:**
- Sentry: `gbp_token_refresh_failed` or `GBP API 401` errors
- Admin panel: org shows GBP integration `connected` but NAP sync fails
- User reports: "My Google listing data stopped updating"

**Impact:** GBP data reads fail. NAP sync cannot push corrections. Location data goes stale.

**Immediate mitigation:**
1. Check `google_oauth_tokens` table for orgs with `expires_at < now()`.
2. The GBP client has a token refresh flow — check logs for whether auto-refresh succeeded or failed.
3. If auto-refresh fails (e.g., user revoked OAuth): the connection must be re-authorized by the user.

**Resolution:**
1. Send affected user an email: "Your Google Business Profile connection needs to be re-authorized. Please go to Settings → Integrations → Google and reconnect."
2. After re-auth, verify `google_oauth_tokens` has a new `expires_at` > 60 days from now.
3. Manually trigger NAP sync for the affected org.

**Prevention:**
- OAuth tokens typically expire in 1 hour (access) / 6 months (refresh). The refresh token flow handles access token renewal automatically.
- Add a weekly check: query `google_oauth_tokens WHERE expires_at < now() + interval '7 days'` and email affected orgs proactively.

---

### Runbook 6 — Cron Jobs Silently Failing (P1)

**Detection:**
- Admin cron health dashboard (`/admin/cron-health`): any cron showing `status=failed` or last run > expected interval
- Sentry: cron-specific error tags
- No new `sov_evaluations` rows in 8+ days

**Impact:** Depends on which cron. SOV cron failing = stale AI Health Scores for all users. Digest cron failing = no weekly emails.

**Triage order (highest to lowest impact):**
1. `sov` — Sunday 7 AM UTC. Stale scores affect all paid users.
2. `weekly-digest` — Monday 9 AM UTC. Users miss weekly email.
3. `nap-sync` — Monday 3 AM UTC. Listing accuracy stale.
4. `correction-rescan` — Daily 4 AM UTC. Correction follow-ups delayed.
5. All others — monthly or less frequent; lower urgency.

**Resolution for any cron:**
1. Check Vercel function logs for the cron's last execution. Look for the error message.
2. Check for kill switch: ensure `STOP_[CRON_NAME]_CRON` is not `true` in env vars.
3. Check the cron route file for `Authorization: Bearer <CRON_SECRET>` check — confirm `CRON_SECRET` env var is set in Vercel.
4. Use Force Run from `/admin/cron-health` to manually trigger (this uses the same auth pattern as the cron itself).
5. Check `cron_run_log` after manual run to confirm success.

**Prevention:**
- All 25+ crons write to `cron_run_log` on completion. The system-health dashboard at `/dashboard/system-health` shows run status.
- Every cron has a kill switch for emergency shutdown.
- `/api/health` checks Supabase connectivity — use this as the first step before deeper cron triage.

---

### Runbook 7 — Inngest Job Queue Failures (P2)

**Detection:**
- Sentry: `inngest_function_failed` or `inngest_step_error`
- Inngest dashboard: failed runs visible in function run history
- SOV cron completes but per-org processing doesn't happen (fan-out broken)

**Impact:** SOV fan-out may fall back to inline processing. Manual scan trigger (Growth+) may not execute asynchronously.

**Immediate mitigation:**
1. The SOV cron has an inline fallback — if Inngest fails, the cron processes orgs synchronously. This is slower but correct.
2. Check Inngest dashboard for failed runs and the error reason.

**Resolution:**
1. If Inngest environment variables are missing or wrong: check `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in Vercel env vars.
2. If a specific function is in a retry loop: Inngest retries automatically up to the configured limit. Let it exhaust retries, then investigate the root cause in Sentry.
3. For manual scan trigger failures: the user can retry from the dashboard. The status polling route (`GET /api/sov/trigger-manual`) will show the current state.

**Prevention:**
- Inline fallback in SOV cron ensures no data loss even when Inngest is degraded.
- Test Inngest function execution in staging before launch.

---

### Runbook 8 — Vercel Deployment Failure (P0 if blocking release, P2 if rollback available)

**Detection:**
- Vercel dashboard: deployment status = `Failed`
- Build logs show TypeScript errors or Next.js build failures
- `/api/health` returns 503 after deployment

**Immediate mitigation:**
1. In Vercel dashboard: click "Instant Rollback" to the previous successful deployment. This is available for all deployments.
2. Do not attempt to fix and redeploy under pressure — rollback first, fix in a branch.

**Resolution:**
1. Run `npx next build` locally to reproduce the failure. See build rules in `CLAUDE.md` — build must run without `NODE_ENV=development`.
2. Fix the build error.
3. Verify: `npx next build` exits with code 0, TypeScript has 0 errors.
4. Push to a staging branch first if available.

**Prevention:**
- CI/CD pipeline (`.github/workflows/test.yml`) runs lint + build on every push. This catches build failures before they reach Vercel.
- Never merge to `main` with failing CI.

---

### Runbook 9 — AI Rate Limits Exceeded (P2)

**Detection:**
- Sentry: `rate_limit_exceeded` from OpenAI/Perplexity/Anthropic
- `api_credits` table: `credits_used >= credits_limit` for multiple orgs
- SOV scans partial — some orgs processed, others skipped

**Impact:** Some AI features temporarily unavailable. Scans for affected orgs fail or skip until credits reset.

**Immediate mitigation:**
1. Check which provider is rate-limiting (OpenAI vs Perplexity vs Anthropic).
2. For OpenAI: check your usage tier and rate limits in the OpenAI platform dashboard.
3. For per-org API credits: `api_credits` auto-resets monthly. No action needed — next reset will restore access.

**Resolution:**
1. If hitting OpenAI tier limits: request a rate limit increase in OpenAI platform.
2. If a specific org is hammering the API (e.g., many manual scan triggers): check their `credits_used` and `credits_limit`. The credit system caps this automatically.
3. For immediate relief: increase `credits_limit` for affected orgs via direct DB update or the `adminGrantCredits()` action.

**Prevention:**
- Credit system (`lib/credits/credit-service.ts`) limits per-org consumption automatically.
- SOV cron processes orgs sequentially with a delay between models (configurable in `SOV_MODEL_CONFIGS`).
- Consider adding a global OpenAI daily spend alert in the OpenAI billing dashboard.

---

### Runbook 10 — User Reports Wrong Data in Dashboard (P2)

**Detection:**
- User support ticket: "My AI Health Score is wrong" or "The scan shows I'm closed but I'm open"
- This is not a system failure — it is an AI accuracy question or a data freshness issue.

**Triage:**
1. **Stale data?** Check `visibility_analytics.created_at` for the org. If > 8 days, the SOV cron may have missed them.
2. **Real AI mistake?** The AI actually said something wrong about the restaurant. This is expected — it is the product's core value prop. Respond: "This is exactly what LocalVector is designed to catch. The scan is accurate — AI is showing incorrect information. Here's how to fix it: [link to KB article 3.1]."
3. **Sample data showing?** If org is < 14 days old and `realityScore = null`, they're in sample mode. Explain this and encourage running the first full scan.
4. **Scanner false positive?** If the restaurant believes the AI result is actually correct: check by manually querying ChatGPT or Perplexity for the restaurant. If you agree with the user, mark the hallucination as dismissed.

**Resolution:**
- For stale data: force-run SOV cron for the org via `/admin/customers/[orgId]`.
- For false positives: use admin `adminOverridePlan()` or direct DB update to dismiss the hallucination record.
- For persistent wrong AI data (not a scanner bug): this is an AI propagation delay — inform the user corrections take 2–8 weeks.

---

## Section 4: Disaster Recovery Plan

### Scope

This DR plan covers data loss or corruption requiring restore from backup. It does not cover AI model changes (not in our control) or third-party API outages (covered in runbooks above).

### Recovery Objectives

| Metric | Target | Notes |
|--------|--------|-------|
| RTO (Recovery Time Objective) | < 4 hours | Time to restore service after a disaster |
| RPO (Recovery Point Objective) | < 24 hours | Maximum acceptable data loss |

### Backup Strategy

**Supabase backups:**
- **Free tier:** Daily backups retained for 7 days. No point-in-time recovery.
- **Pro tier ($25/mo):** Daily backups retained for 30 days + point-in-time recovery (1-day granularity).
- **Action required before launch:** Upgrade to Supabase Pro to enable PITR. This is not optional for a product with paying customers.

**What Supabase backs up:** All PostgreSQL tables, including RLS policies, functions, and storage bucket metadata. Storage objects (e.g., org logos in `org-logos` bucket) are included in storage backups separately.

**What is NOT backed up by Supabase:** Supabase Auth settings (SMTP config, OAuth providers) — document these separately.

### DR Procedure

**Scenario: Accidental data deletion (e.g., wrong org deleted, migration gone wrong)**

1. Immediately stop all writes to the affected table. If necessary: activate relevant kill switches to pause crons.
2. In Supabase dashboard: go to **Settings → Database → Backups**.
3. Identify the most recent backup before the incident.
4. For small table corruption: use Supabase PITR to restore to a specific timestamp (Pro plan only).
5. For full restore: restore entire project to a new project instance, extract the affected data, re-insert into production.
6. Verify data integrity: row counts, FK constraints, RLS policies still in place.
7. Resume crons and normal operation.

**Scenario: Compromised service role key**

1. Immediately rotate `SUPABASE_SERVICE_ROLE_KEY` in Supabase dashboard.
2. Update env var in Vercel immediately.
3. Rotate `SUPABASE_ANON_KEY` as well if any exposure.
4. Audit `cron_run_log` and `activity_log` for any unexpected writes in the previous 24 hours.
5. Review Sentry for unusual error patterns that might indicate misuse.

**Scenario: Vercel environment compromise**

1. Immediately revoke and rotate all secret env vars: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `CRON_SECRET`, `RESEND_API_KEY`.
2. Rotate at the source (Supabase, Stripe, OpenAI, Resend, etc.) before updating Vercel — compromised keys that are still valid elsewhere are still a risk.
3. Review Stripe webhook logs for unexpected subscription changes.
4. Review Supabase `activity_log` for unexpected team or billing changes.

### DR Test Schedule

Before launch: complete DR test #1. After launch: quarterly tests.

| Test | Procedure | Pass Criteria |
|------|-----------|---------------|
| Backup restore test | Restore Supabase to new project from yesterday's backup | Restore completes, row counts match, `/api/health` returns 200 on new instance |
| Key rotation test | Rotate `CRON_SECRET` and update Vercel env var | All crons fire successfully on next scheduled run |
| Rollback test | Deploy a deliberately broken build to a preview URL, then instant-rollback | Rollback completes in < 2 minutes, no downtime on production |
| Kill switch test | Set `STOP_SOV_CRON=true`, confirm cron skips, then remove | Cron logs show kill switch activation; re-enables cleanly |

---

## Section 5: Monitoring Checklist — Pre-Launch

Set up all of these before the first paying customer.

### External Uptime Monitoring

Use **Better Uptime** (free tier covers 10 monitors) or **UptimeRobot** (free tier, 5-minute intervals).

| Monitor | URL | Alert Threshold | Alert Channel |
|---------|-----|-----------------|---------------|
| Health endpoint | `https://app.localvector.ai/api/health` | 2 consecutive failures | Email + SMS |
| Dashboard login page | `https://app.localvector.ai/login` | 2 consecutive failures | Email |
| Marketing homepage | `https://localvector.ai` | 2 consecutive failures | Email |

### Sentry Alerts

Configure these alert rules in your Sentry project before launch:

| Alert | Condition | Notification |
|-------|-----------|--------------|
| New P0 error spike | >10 new errors per 5 minutes, first seen | Immediate email |
| Stripe webhook error | Any error tagged `stripe_webhook` | Immediate email |
| SOV cron failure | Any error tagged `cron:sov` | Email within 1 hour |
| Email send failure | Any error tagged `resend` | Daily digest |

### Vercel Monitoring

- Enable **Vercel Speed Insights** (free) before launch — captures Core Web Vitals automatically.
- Set a Vercel deployment notification to email you on every production deployment (success or failure).
- Review Vercel function logs for `/api/cron/*` routes after every scheduled execution in the first 2 weeks.

### Stripe Alerts

Configure in Stripe Dashboard → Alerts:
- **Failed payment alert:** Email when any invoice payment fails
- **Subscription cancellation alert:** Email when any subscription is canceled
- **Revenue drop alert:** Email if MRR drops > 20% week-over-week (for when you have revenue)

### Weekly Ops Review (every Monday, 15 minutes)

```
1. Check /admin/cron-health — any crons in failed/degraded state?
2. Check Sentry → Issues → sort by "First seen" — any new error categories?
3. Check Stripe → Dashboard — any failed payments or disputed charges?
4. Check Supabase → Database → Backups — last backup successful?
5. Check api_credits table — any orgs approaching limit unexpectedly?
6. Check cron_run_log for last 7 days — any crons with duration_ms > 60000 (slow)?
```

---

## Section 6: Stripe Pricing Actions Required Before Launch

These are blocking items from `docs/UNIT-ECONOMICS.md` Section 13. The product is built but prices are not yet set in Stripe.

| Action | Where | What to Set |
|--------|-------|------------|
| Create Starter plan price | Stripe → Products → New | $49/month recurring, `nickname=starter_monthly` |
| Create Growth plan price | Stripe → Products → New | $149/month recurring, `nickname=growth_monthly` |
| Create Agency plan price | Stripe → Products → New | $449/month recurring, `nickname=agency_monthly` |
| Create Agency seat add-on | Stripe → Products → New | $15/month per seat, `nickname=agency_seat` |
| Create annual variants (optional) | As above with yearly interval | 20% discount: $470/$1430/$4310/yr |
| Set env vars | Vercel → Settings → Env Vars | `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_GROWTH`, `STRIPE_PRICE_ID_AGENCY`, `STRIPE_PRICE_ID_AGENCY_SEAT` |
| Configure portal | Run `npx ts-node scripts/setup-stripe-portal.ts` | Sets `STRIPE_PORTAL_CONFIGURATION_ID` |
| Test billing lifecycle | Stripe test mode → create customer → subscribe → upgrade → cancel | Webhook events fire, `organizations.plan` updates correctly |

---

_Last updated: 2026-03-05_
_Owner: Senthilbabu_
_Next review: After first P0 or P1 incident. Update runbooks based on real failure modes._
