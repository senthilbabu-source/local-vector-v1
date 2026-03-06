# LocalVector.ai — Feedback Infrastructure

**Version:** 1.0 — March 5, 2026
**Owner:** Senthilbabu
**Status:** Implement before first paying customer. Expand at $5K MRR.

---

## How to Use This Document

Customer feedback is only valuable if it is captured in a structured way, synthesized across sources, and connected to explicit product decisions. This document defines the system for doing that as a solo founder with a bootstrapped SaaS.

There are three phases:

1. **Beta (0–15 users):** High-touch. Manual capture. Every conversation goes into a structured note.
2. **Early launch (1–50 paying customers):** Medium-touch. Structured Crisp tagging + weekly synthesis.
3. **Growth ($5K+ MRR):** Low-touch. Automated routing + monthly synthesis. Expand tooling.

This document covers Phases 1 and 2 in full. Phase 3 is sketched.

---

## Section 1: Feedback Sources

### All sources you will receive feedback from

| Source | Volume | Signal Quality | Lag |
|--------|--------|----------------|-----|
| **Beta video calls (Day 7 + Day 21)** | 20–30 sessions | Highest — observed behavior | None |
| **Crisp support tickets** | 2–15/week | High — user is blocked or confused | Real-time |
| **Sean Ellis survey (Day 7 + Day 21)** | 10–30 responses | High — structured PMF signal | 1 week |
| **Churn exit reasons** | Low — 0–5/month | Highest for retention | After loss |
| **In-product usage data (Supabase)** | Continuous | High — behavioral, not stated | Real-time |
| **Email replies to onboarding sequence** | 2–10/week | High — self-selected | Real-time |
| **ViralScanner scan completions** | High | Low-medium — pre-customer | Real-time |
| **LinkedIn DMs / community comments** | Occasional | Medium — pre-sales signal | Varies |
| **Agency onboarding calls** | 1–2/month | High — high-value segment | Real-time |

### What you are NOT monitoring in Phase 1–2

- App store reviews (no mobile app)
- Reddit / Hacker News mentions (monitor at $1M ARR, not now)
- Twitter/X brand mentions (set up a saved search, but do not spend time on it)

---

## Section 2: Capture System

### The capture principle

Every piece of feedback must end up in one place within 24 hours. The format must be consistent so that you can detect patterns across sources and users.

**Single source of truth:** A Notion database called **LocalVector Feedback Log**.

If you do not have Notion, use a plain CSV or Airtable. The fields matter more than the tool.

---

### Feedback Log schema

Each row represents one discrete piece of feedback from one person.

| Field | Type | Values / Notes |
|-------|------|----------------|
| `date` | Date | Date the feedback was received |
| `user_id` | Text | Supabase org_id or "pre-signup" |
| `user_type` | Select | beta / trial / starter / growth / agency / prospect / churned |
| `source` | Select | crisp / video_call / survey / email / churn_interview / usage_data / social |
| `category` | Select | onboarding / activation / core_value / ui_confusion / missing_feature / pricing / performance / bug / churn_reason |
| `verbatim` | Long text | Exact words from the user — never paraphrase in this field |
| `summary` | Text | One sentence in your own words |
| `sentiment` | Select | positive / neutral / negative / mixed |
| `severity` | Select | blocker / friction / nice_to_have / praise |
| `action_taken` | Select | fixed / added_to_backlog / declined / no_action / under_review |
| `sprint_reference` | Text | If tied to a product decision: sprint number or doc reference |
| `pattern_tag` | Multi-select | Free tags for pattern detection across rows (see Section 4) |

### Minimum capture per source

| Source | What to capture | When |
|--------|-----------------|------|
| Video call (beta) | 3-paragraph summary per call (Section 5 of BETA-PMF.md) + 3–5 verbatim quotes entered as separate rows | Within 2 hours of call |
| Crisp ticket (resolved) | Severity + category + verbatim of the user's opening message | When ticket is closed |
| Sean Ellis survey | Import every response as one row (category = "survey", source = "survey") | Day of receipt |
| Churn (any plan cancel) | Mandatory exit survey (see Section 3) — every row from that survey | Within 24h of cancellation |
| Email reply | Copy verbatim into log; add category + sentiment | Same day |
| Usage anomaly | One row describing the behavior pattern (e.g., "3 users never reached Step 5 in week 2") | Weekly review |

---

## Section 3: Churn Exit Process

Churn is the most important feedback you will receive. Do not treat it as a failure — treat it as a required data collection event.

### Automatic exit survey (Stripe cancellation webhook)

When `customer.subscription.deleted` fires in the Stripe webhook (`app/api/webhooks/stripe/route.ts`), the existing `handleSubscriptionDeleted()` handler sets `plan = 'trial'`. Extend this to also send a one-question exit email via Resend.

**Exit email template:**

> Subject: One question before you go
>
> Hi [Name],
>
> Your LocalVector subscription has been cancelled. Before you go, would you take 30 seconds to help me understand?
>
> **What's the main reason you're cancelling?**
>
> - [I didn't find AI mistakes about my restaurant →]
> - [The product was confusing →]
> - [The price wasn't worth it →]
> - [I found a better alternative →]
> - [My restaurant closed or changed →]
> - [Other — I'll reply to this email →]
>
> Each answer is a 1-click link that logs the reason to a simple webhook endpoint.
>
> — Senthil

**Implementation:** Create `app/api/internal/churn-reason/route.ts` (no auth — reasons are logged by token). Add `churn_reason` + `churned_at` columns to `organizations` (migration needed before launch). Wire into `handleSubscriptionDeleted()`.

### If the cancellation is from a Growth or Agency plan customer

Do not rely on the automated survey. Send a personal email within 24 hours:

> Subject: Was it something I missed?
>
> Hi [Name],
>
> I saw you cancelled LocalVector. I won't try to change your mind — but I'd genuinely like to understand what I missed.
>
> If you have 10 minutes for a quick call, I'd be grateful: [Calendly link]
>
> Or just reply to this email if that's easier.
>
> — Senthil, LocalVector founder

One call with a churned Growth customer is worth 10 survey responses.

---

## Section 4: Pattern Detection

The feedback log accumulates value when you look across rows, not at individual ones.

### Weekly pattern review (15 minutes, every Friday)

Part of the Friday product review block (see TEAM-READINESS.md §2). Steps:

1. Open the Feedback Log and filter by `date >= last 7 days`.
2. Scan for any `category` with 2+ new rows.
3. Scan for any `pattern_tag` appearing 2+ times.
4. If a pattern appears: write one sentence naming it and the count. Add to the top of the Feedback Log as a "Week of [date]: [Pattern] — N instances."
5. If a pattern appeared for 3+ consecutive weeks: it is no longer noise. It is a product decision trigger.

### Pattern-to-action thresholds

| Pattern | Threshold for action | Action |
|---------|---------------------|--------|
| Onboarding confusion (same step) | 3 users in 30 days | Fix the step this week |
| Feature request (same feature) | 3 different users in any period | Add to backlog with user count |
| Pricing friction ("too expensive") | 3 users in 30 days | Run pricing experiment (see UNIT-ECONOMICS.md §12) |
| Core value not found | 3 users never reach activation | Audit the activation funnel (Step 6 in BETA-PMF.md §4) |
| Praise for specific feature | 5+ users cite same feature | Amplify in marketing copy |
| Churn reason concentration | 2 of last 5 churns cite same reason | Treat as P0 — fix immediately |

### Pattern tags to start with

These are the most common patterns in early-stage B2B SaaS. Add more as you discover new ones.

```
onboarding_step_2_confusion
onboarding_step_3_confusion
onboarding_step_4_confusion
activation_not_reached
hallucination_value_resonated
hallucination_value_missed
pricing_too_high
pricing_fair
correction_workflow_confusion
sov_confusing
sov_clear
missing_feature_request
performance_slow
data_not_accurate
competitor_mention
would_refer
agency_potential
```

---

## Section 5: Roadmap Connection

Feedback only has value if it changes what you build. This section defines the exact mechanism for that connection.

### The decision test

Before adding any feature to the backlog (not just building it), write this sentence:

> **"[N] users in [source] reported [exact problem], with verbatim: '[quote]'."**

If you cannot write this sentence, do not add the feature. This prevents the backlog from filling with founder-imagined features that no user has asked for.

### Backlog states

The product backlog is not a wish list. It has four states:

| State | Criteria | Action |
|-------|----------|--------|
| **This week** | Paying customer is blocked; fixes a P0/P1 bug; or go/no-go criterion is at risk | Build now, no review needed |
| **This month** | 3+ users have requested it; directly improves conversion or reduces churn | Review on Friday; assign to next available sprint |
| **Reviewed — next milestone** | Validated pattern but not urgent; requires design or infrastructure work | Review at $5K MRR or next major milestone |
| **Declined** | Interesting but <3 users, not ICP-aligned, or conflicts with product simplicity | Log the decline reason so you remember why |

### Monthly product review (30 minutes, 1st of month)

On the 1st of each month, review the full feedback log for the prior month:

1. Count feedback rows by `category`. Any category with 5+ rows in a month is a signal.
2. Review all "This month" backlog items. Promote to "This week" if still valid. Decline if stale.
3. Review all "Declined" items. If a previously declined feature now has 3 new user requests, move to "Reviewed — next milestone."
4. Add a one-paragraph summary to `docs/DEVLOG.md` under "Feedback Synthesis — [Month]":
   - Top 3 feedback themes this month
   - One feature added to backlog (with user count)
   - One feature declined (with reason)
   - One pattern still monitoring

---

## Section 6: In-Product Feedback (Phase 2)

Once you have 10+ paying customers, add passive in-product feedback collection. These are low-friction inputs that do not require a video call.

### Thumbs rating on key actions

Add a simple 👍 / 👎 inline after three high-value moments:

| Moment | Location | What it measures |
|--------|----------|-----------------|
| After first AI mistake found | AI Mistakes page, after first hallucination alert card | Core value activation satisfaction |
| After correction initiated | After user clicks "Mark as Corrected" | Correction workflow satisfaction |
| After weekly digest viewed | Bottom of weekly digest email | Digest value satisfaction |

**Implementation:** One-column table `user_feedback_signals` (org_id, signal_type, value, created_at). No plan gate. RLS: org-scoped. Server action `logFeedbackSignal()` (fire-and-forget). Admin dashboard shows aggregate 👍/👎 ratio per signal type.

### NPS via email (monthly, Phase 2)

At Month 2 and every 3 months after, send a simple 1-question NPS email to all paying customers:

> "On a scale of 0–10, how likely are you to recommend LocalVector to another restaurant owner?"

Link goes to a single-page form. Response logged to `user_feedback_signals` as `signal_type='nps'`, `value` = integer 0–10.

**NPS formula:** % promoters (9–10) minus % detractors (0–6). Track trend, not absolute score. Any score above 0 at launch is acceptable. Target: +30 by Month 6.

Do not send this during the beta. It inflates NPS if beta users are self-selected enthusiasts.

---

## Section 7: Tooling by Phase

### Phase 1 — Beta (Weeks 1–6)

| Tool | Purpose | Cost |
|------|---------|------|
| Notion (free tier) | Feedback log database | Free |
| Zoom | Video calls + recording | $15/mo |
| Typeform (free tier) | Sean Ellis survey | Free |
| Personal email | Exit conversations | Free |

Total: ~$15/month.

### Phase 2 — Early Launch (1–50 customers)

| Tool | Purpose | Cost |
|------|---------|------|
| Notion (free tier) | Feedback log database | Free |
| Crisp Mini | Support + tag feedback by category | $25/mo |
| Custom `user_feedback_signals` table | Thumbs + NPS signals | $0 (in-product) |
| Calendly (free) | Exit interview scheduling | Free |

Total: ~$25/month.

### Phase 3 — Growth ($5K+ MRR)

At $5K MRR, add:

| Tool | Purpose | Cost |
|------|---------|------|
| Canny.io | Public feature request board + voting | $99/mo |
| Mixpanel or PostHog | Behavioral analytics (funnel, retention, feature usage) | $20–$80/mo |
| Dovetail | Video call transcription + synthesis at scale | $29/mo |

**Canny integration consideration:** Do not add a public voting board before 50 paying customers. Public boards attract feature requests from non-ICP users and create expectation debt. Run your internal feedback log until the pattern recognition work is done.

---

## Section 8: Privacy and Data Handling

Feedback data contains personal information (emails, names, verbatim quotes). Treat it accordingly.

- **Video call recordings:** Store in Google Drive or Zoom cloud, not in the repo. Delete after 90 days unless the recording contains a quote you specifically want to preserve — in that case, extract the quote to the Feedback Log and delete the video.
- **Survey responses:** Typeform and Google Forms both retain data on their servers. Export to your Feedback Log within 7 days of collection.
- **Verbatim quotes in marketing:** Always ask permission before using a customer's words in marketing copy or on the website. The request can be brief: "Would you mind if I used this in our marketing?"
- **Exit interview notes:** Do not store full interview transcripts in a shared tool. Keep in a local `HANDOFF.md` or password manager note. Only the synthesized pattern goes in the Feedback Log.

---

_Last updated: 2026-03-05_
_Owner: Senthilbabu_
_Next action: (1) Create Notion Feedback Log database with the schema from Section 2 before first beta user. (2) Build `churn_reason` column + exit email flow before first paying customer. (3) Add `user_feedback_signals` table at 10 paying customers._
