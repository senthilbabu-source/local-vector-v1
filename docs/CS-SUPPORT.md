# LocalVector.ai — CS & Support Setup

**Version:** 1.0 — March 5, 2026
**Owner:** Senthilbabu
**Status:** Pre-launch reference. Activate before first paying customer.

---

## How to Use This Document

- **Section 1:** Helpdesk vendor decision — pick one and execute before beta.
- **Section 2:** Support SLA by plan tier — set expectations on signup page and in onboarding emails.
- **Section 3:** Knowledge base structure — build these 25 articles before soft launch.
- **Section 4:** Onboarding email sequence — 7 emails, Day 0 through Day 21. These are scripts; wire them into Resend using the existing `lib/email.ts` pattern.
- **Section 5:** Escalation paths and founder support rules.
- **Section 6:** Common support triggers and scripted responses.

---

## Section 1: Helpdesk Vendor Decision

### Recommendation: Crisp (crisp.chat)

**Why Crisp over Intercom or Zendesk:**

| Factor | Crisp | Intercom | Zendesk |
|--------|-------|----------|---------|
| Monthly cost (solo founder) | $25/mo (Mini) | $74/mo (Starter) | $55/agent/mo |
| In-app chat widget | Yes | Yes | Limited |
| Knowledge base (self-serve) | Yes | Yes | Yes |
| Email ticketing | Yes | Yes | Yes |
| Product tours / onboarding flows | No (upgrade) | Yes | No |
| Bot / auto-replies | Basic | Advanced | Basic |
| Migration cost if you outgrow it | Low (CSV export) | Medium | Low |
| Verdict | **Start here** | When ARR > $200K | Never for this stage |

**Crisp setup checklist (pre-launch):**
- [ ] Install Crisp widget on dashboard pages (inject script in `app/dashboard/layout.tsx`)
- [ ] Set widget to show only on authenticated pages (pass user email + org plan to Crisp identity)
- [ ] Create Crisp inbox for support@localvector.ai
- [ ] Enable MagicBrowse (lets support see what user sees — critical for restaurant operators)
- [ ] Set auto-reply: "We typically respond within X hours" (match SLA in Section 2)
- [ ] Connect to Slack for real-time support alerts during beta

**Passing user identity to Crisp:**

```typescript
// app/dashboard/layout.tsx (client-side after auth)
window.$crisp.push(["set", "user:email", [user.email]]);
window.$crisp.push(["set", "user:nickname", [org.name]]);
window.$crisp.push(["set", "session:data", [[
  ["plan", org.plan],
  ["org_id", org.id],
  ["locations", locationCount],
]]]);
```

This lets you see which plan a user is on before reading their message — critical for SLA routing.

---

## Section 2: Support SLA by Plan Tier

| Plan | Channel | First Response | Resolution Target | Notes |
|------|---------|---------------|-------------------|-------|
| Trial | Knowledge base + email | 48 hours | Best effort | No live chat. KB self-serve nudge in auto-reply. |
| Starter | Email + KB | 24 hours | 3 business days | |
| Growth (AI Shield) | Email + in-app chat | 8 hours | 2 business days | Chat available Mon–Fri 9 AM–6 PM ET |
| Agency (Brand Fortress) | Email + chat + priority queue | 4 hours | 1 business day | Dedicated onboarding call included |

**Phase 1 (pre-$10K MRR):** You are the support team. Use these SLAs to set expectations, not as legal commitments. Crisp's canned responses + KB will handle 80% of tickets.

**Phase 2 ($10K–$50K MRR):** Hire a part-time support contractor (5–10 hrs/week). Focus on Starter + Growth tickets. Founder retains Agency accounts.

---

## Section 3: Knowledge Base Structure

Build these articles before soft launch. Priority order: P1 = launch blocker, P2 = first week, P3 = first month.

### Category 1: Getting Started

| # | Article Title | Priority | Covers |
|---|--------------|----------|--------|
| 1.1 | What is LocalVector and how does it work? | P1 | Product overview, what AI visibility means, why it matters for restaurants |
| 1.2 | Setting up your account and adding your restaurant | P1 | Signup → onboarding → location setup walkthrough with screenshots |
| 1.3 | Running your first AI health scan | P1 | ViralScanner → full scan → reading the AI Health Score |
| 1.4 | Connecting your Google Business Profile | P1 | GBP OAuth flow, what data we pull, what we do with it |
| 1.5 | Understanding your AI Health Score | P1 | Score breakdown (SOV, accuracy, citations, schema), grade tiers A–F, what moves the score |

### Category 2: Understanding Your Results

| # | Article Title | Priority | Covers |
|---|--------------|----------|--------|
| 2.1 | What are AI Mistakes (Hallucinations)? | P1 | Definition, severity levels, examples (wrong hours, wrong address), why AI gets it wrong |
| 2.2 | How to read your AI Mentions (Share of Voice) report | P1 | What SOV % means, how to read the per-engine breakdown, what "0%" means |
| 2.3 | How the Lost Sales calculator works | P2 | Methodology, how to set your cover count and ticket size, what the estimate means |
| 2.4 | What is the Platforms (Citations) score? | P2 | How AI platforms cite sources, what "covered" vs "gap" means, why it matters |
| 2.5 | What is the AI Visibility Score? | P2 | VAIO breakdown, voice readiness, how to improve each component |
| 2.6 | Understanding competitor comparisons | P3 | How we detect competitor mentions, SOV gap vs SOV advantage |

### Category 3: Taking Action

| # | Article Title | Priority | Covers |
|---|--------------|----------|--------|
| 3.1 | How to fix an AI Mistake (hallucination) | P1 | Mark corrected flow, what triggers a correction brief, how long it takes AI to update |
| 3.2 | How to publish a content draft to your website | P2 | Approve → publish flow, WordPress integration, manual copy option |
| 3.3 | How to fix listing inconsistencies (NAP Sync) | P2 | What NAP is, what platforms we sync, what requires manual action |
| 3.4 | What is the VAIO Mission Board and how do I use it? | P2 | Mission list, priority order, marking complete, score improvement tracking |
| 3.5 | How to run a manual AI scan on demand | P3 | Trigger scan button, what it checks, how often you can run it (plan limits) |

### Category 4: Account & Billing

| # | Article Title | Priority | Covers |
|---|--------------|----------|--------|
| 4.1 | What's included in each plan? | P1 | Plan comparison table (mirrors billing page), which features are Growth vs Agency |
| 4.2 | How billing works — subscriptions, seats, and overages | P1 | Monthly billing cycle, seat definition, overage triggers, proration |
| 4.3 | How to upgrade or downgrade your plan | P1 | Stripe portal link, what happens to data on downgrade, immediate vs next-cycle |
| 4.4 | How to add or remove team members (Agency only) | P2 | Seat billing implications, invite flow, role permissions |
| 4.5 | How to cancel your subscription | P2 | Cancellation steps, data export window (30 days), what is deleted |

### Category 5: Integrations

| # | Article Title | Priority | Covers |
|---|--------------|----------|--------|
| 5.1 | Google Business Profile — what we can and cannot do | P1 | What data we read, what requires manual action, GBP OAuth re-auth |
| 5.2 | Adding your Yelp listing URL | P2 | Manual URL entry, what we check, Yelp data limitations |
| 5.3 | Apple Business Connect (Agency only) | P3 | Setup, what syncs automatically, refresh schedule |

### Category 6: Troubleshooting

| # | Article Title | Priority | Covers |
|---|--------------|----------|--------|
| 6.1 | My AI Health Score hasn't updated — why? | P1 | Scan schedule, manual trigger, common reasons for stale data |
| 6.2 | The AI Mistake scan shows errors I don't recognize | P1 | False positives, how to dismiss, how to report a bad result |
| 6.3 | My Google Business Profile won't connect | P1 | Common OAuth errors, browser compatibility, re-auth steps |
| 6.4 | I'm not seeing my restaurant in any AI results | P2 | What this means, why it happens, action plan (content, citations, NAP) |

---

## Section 4: Onboarding Email Sequence

Wire these 7 emails into `lib/email.ts` using the existing Resend + React Email pattern. Each email has a single CTA. Subject lines are A/B test candidates — test the first two once you have 50 signups.

All emails send from `hello@localvector.ai` with reply-to `support@localvector.ai`.

---

### Email 1 — Welcome + First Action (Day 0, trigger: account created)

**Subject A:** Your AI Health Check is ready — run it now
**Subject B:** [First Name], is AI sending customers to your competitors?

**Send condition:** Immediately on `organizations` row creation (wire into `on_user_created` trigger or onboarding action).

**Body:**

> Hi [First Name],
>
> Welcome to LocalVector. You're set up — now let's find out what AI is saying about [Restaurant Name].
>
> Right now, when someone asks ChatGPT or Google AI "best [cuisine] in [city]," one of three things is happening:
>
> 1. Your restaurant is mentioned — accurately.
> 2. Your restaurant is mentioned — with wrong information (hours, address, or menu).
> 3. Your restaurant isn't mentioned at all, and a competitor is.
>
> The scan takes under 2 minutes. It checks ChatGPT, Perplexity, and Google AI simultaneously.
>
> **[Run Your AI Health Check →]**
>
> — The LocalVector Team

---

### Email 2 — Scan Results Nudge (Day 1, trigger: no scan completed)

**Subject:** Did you run your scan yet?
**Send condition:** 24 hours after account creation AND `sov_evaluations` count = 0.

**Body:**

> Hi [First Name],
>
> You haven't run your AI Health Check yet. That's fine — but here's what you're leaving unknown:
>
> When a customer in [City] asks an AI assistant where to eat [cuisine], is your restaurant in the answer? Is the information correct?
>
> Most restaurant owners we talk to had no idea their hours or address were wrong in AI results until a customer told them. Some of them waited months.
>
> The check takes 2 minutes and it's free.
>
> **[Run My AI Health Check →]**

---

### Email 3 — Scan Results Summary (Day 1, trigger: first scan completed)

**Subject:** Your AI Health Score: [Grade] — here's what we found
**Send condition:** First `sov_evaluations` row created for org. Replaces Email 2 if scan is done by Day 1.

**Note:** This is `sendScanCompleteEmail()` already implemented in `lib/email.ts`. Ensure it includes:
- AI Health Score with grade (A/B/C/D/F)
- Top 1–2 issues found (plain English, e.g., "ChatGPT shows your hours as closed on Sundays — this is incorrect")
- Revenue impact estimate (one-line: "Estimated annual impact: $X based on your location's typical traffic")
- Single CTA: "See Full Report"

---

### Email 4 — Education: Why AI Gets It Wrong (Day 3)

**Subject:** Why ChatGPT doesn't know your real hours
**Send condition:** Day 3 after signup. Send regardless of scan status.

**Body:**

> Hi [First Name],
>
> Here's something most restaurant owners don't realize: AI assistants don't pull your hours from Google in real time. They use data that was "baked in" during training — which could be months or years old.
>
> That means if you updated your hours on Google Business Profile last month, ChatGPT may still show the old ones.
>
> The platforms most likely to have outdated information about [Restaurant Name] are:
> - ChatGPT (training data cutoff, slow to update)
> - Bing Copilot (Bing index, not real-time)
> - Apple Intelligence (Apple Maps data, often behind)
>
> The platforms most likely to be accurate:
> - Google AI Overviews (pulls from live GBP data)
> - Perplexity (more frequent crawling)
>
> LocalVector monitors all of them weekly and alerts you when something changes.
>
> **[See What AI Is Saying About You →]**

---

### Email 5 — Revenue Framing (Day 7)

**Subject:** How much is wrong AI information costing [Restaurant Name]?
**Send condition:** Day 7 after signup.

**Body:**

> Hi [First Name],
>
> This is a back-of-envelope calculation that most restaurant owners find uncomfortable:
>
> If AI sends one potential customer per week to a competitor — or causes one potential customer to call and confirm hours (and not come in) — that's roughly:
>
> - 1 cover × $55 average ticket × 52 weeks = **$2,860/year in lost revenue**
>
> That's a conservative estimate. In competitive urban markets where 3–5 AI queries per day mention restaurant recommendations, the number is higher.
>
> Your LocalVector dashboard has a Lost Sales calculator that uses your actual cover count and ticket size. You can set your own numbers.
>
> **[See My Revenue Impact →]**

---

### Email 6 — Trial Ending Warning (Day 14, Trial plan only)

**Subject:** Your free trial ends in 7 days
**Send condition:** Day 14 after signup AND `organizations.plan = 'trial'`. Skip if already upgraded.

**Body:**

> Hi [First Name],
>
> Your LocalVector free trial ends in 7 days.
>
> Here's what happens after the trial:
> - Your AI Health Score and scan history stay in your account
> - Weekly AI scans stop running
> - You won't be alerted if ChatGPT starts showing wrong hours or a competitor overtakes you in AI results
>
> To keep monitoring, the Starter plan is $49/month.
>
> If you have questions about what's right for [Restaurant Name], reply to this email. I read every response.
>
> **[Upgrade to Keep Monitoring →]**
>
> — Senthil, LocalVector Founder

**Note:** Founder signature on this email is intentional. Adds trust with restaurant operators.

---

### Email 7 — Final Upgrade Push / Win-Back (Day 21)

**Subject:** Last chance — your AI monitoring is about to go dark
**Send condition:** Day 21 after signup AND `organizations.plan = 'trial'`. Skip if upgraded.

**Body:**

> Hi [First Name],
>
> Your LocalVector trial ended a week ago.
>
> A few things may have changed since your last scan:
> - AI platforms update their data continuously. What was accurate a week ago may not be accurate today.
> - Competitor restaurants don't stop showing up in AI results just because you stopped monitoring.
>
> If LocalVector isn't the right fit right now, no problem — your data stays in your account for 30 days if you want to export it.
>
> If you want to stay ahead of AI search, the Starter plan ($49/month) gets you weekly scans and email alerts.
>
> **[Resume Monitoring →]**
> **[Export My Data (free)]**

---

## Section 5: Escalation Paths

### Tier 1 — Self-serve (handle with KB + canned responses)
- "How do I connect Google?" → KB article 5.1
- "My score went down" → KB article 6.1 + explanation email
- "I don't understand the Lost Sales number" → KB article 2.3

### Tier 2 — Founder response required
- Any complaint about AI accuracy ("your scan is wrong about my restaurant") → Manual investigation. Run the scan yourself and document what you find.
- Any cancellation request from a Growth or Agency customer → Founder call within 24 hours. This is retention, not just support.
- Any data breach concern → Respond within 2 hours. Refer to Privacy Policy breach notification section.

### Tier 3 — External party required
- Payment disputes → Stripe dispute portal
- Data deletion requests → GDPR/CCPA workflow via `/api/settings/danger/delete-org`
- Legal notices → Forward to lawyer immediately (see PENDING.md L-9, L-10)

---

## Section 6: Common Support Triggers + Scripted Responses

### "The AI still shows wrong hours even after I connected Google"

> Thanks for flagging this. There are two separate systems at work here: (1) Google AI Overviews, which pulls from your live Google Business Profile and usually updates within 24–48 hours of a GBP change, and (2) other AI platforms like ChatGPT and Perplexity, which have longer update cycles and rely on crawled data. For ChatGPT and Perplexity, corrections can take 2–8 weeks to propagate after we submit the correction signals. We'll email you when we detect the update has gone through.

### "I'm not showing up in any AI results"

> This is actually the most common situation for restaurants that haven't done AI optimization work yet — so you're in the right place. The three fastest ways to improve your AI visibility are: (1) make sure your Google Business Profile is 100% complete with accurate hours, categories, and photos — this is the primary data source for most AI platforms; (2) publish at least one piece of content that directly answers "best [cuisine] in [city]" on your website; (3) get your restaurant mentioned on a third-party review platform that AI engines trust (TripAdvisor, Yelp, OpenTable). Your VAIO Mission Board in LocalVector has a prioritized checklist for exactly this.

### "I was charged for a seat I didn't add"

> I'm sorry for the confusion. Seat billing in LocalVector works as follows: you are billed for each team member you invite who accepts their invitation. If you have [N] active team members in your account, that accounts for the seat charge. To see your current seat usage, go to Settings → Team. If you believe this is an error, reply here with your account email and I'll investigate the billing record directly.

### "Can you guarantee my restaurant will show up in ChatGPT?"

> We can't guarantee placement in any specific AI platform's responses — that's controlled entirely by each AI company. What we do guarantee is that we will (1) monitor what every major AI platform is saying about you weekly, (2) alert you immediately when something is wrong or changes, and (3) give you specific, prioritized actions that are proven to improve AI visibility over time. Most customers see measurable improvement in their AI Health Score within 30–60 days of following the VAIO Mission Board recommendations.

---

## Section 7: Onboarding Call Script (Agency Plan Only)

Agency customers get a 30-minute onboarding call. This is a product adoption call, not a sales call — they've already paid.

**Agenda (30 min):**

1. (5 min) Introductions — understand their current situation. How many locations? Do they have a marketing manager or is it all the owner?
2. (10 min) Screen share — walk through their AI Health Score together. Find the first hallucination. This is the "activation moment" from the ICP doc. Make it real.
3. (5 min) Set up the VAIO Mission Board together. Pick the top 3 missions. Write down who owns each one on their team.
4. (5 min) Explain the weekly scan email. Set expectations: "Every Monday you'll get an email showing what changed. If something breaks, you'll know before your customers do."
5. (5 min) Open questions + next steps.

**What NOT to do on the onboarding call:**
- Don't give a product tour of every feature. They won't remember it.
- Don't talk about roadmap features that don't exist yet.
- Don't promise things the platform can't do today.

---

_Last updated: 2026-03-05_
_Owner: Senthilbabu_
_Next review: After first 10 paying customers. Update KB article priorities based on actual support ticket volume._
