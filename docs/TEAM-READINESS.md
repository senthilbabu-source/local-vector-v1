# LocalVector.ai — Team & Org Readiness

**Version:** 1.0 — March 5, 2026
**Owner:** Senthilbabu
**Status:** Pre-launch reference. Honest assessment for a solo founder.

---

## How to Use This Document

This is not a corporate org chart. It is a capacity planning document for a solo founder running a bootstrapped SaaS. It answers three practical questions:

1. **Right now:** How do you structure your time across all required functions?
2. **At each milestone:** When do you bring in help, and what kind?
3. **If something goes wrong:** How does the business survive your absence?

Sections 1–3 apply immediately. Section 4 applies at $10K MRR. Section 5 is the continuity plan.

---

## Section 1: Capacity Audit — The Solo Founder Reality

You are currently one person doing the work of five roles. Before launch, be honest about how many hours exist for each function.

### Role inventory

| Role | What It Requires | Hours/Week (Pre-Launch) | Hours/Week (Post-Launch, <$5K MRR) |
|------|-----------------|------------------------|--------------------------------------|
| **Engineering** | Bug fixes, feature work, security patches, cron monitoring | 20–30 | 10–15 |
| **Support** | Responding to Crisp tickets, onboarding calls (Agency), billing questions | 0 | 5–10 |
| **Sales/Growth** | Content creation, community engagement, outbound to agencies, ViralScanner distribution | 5–10 | 5–10 |
| **Finance/Admin** | Stripe reconciliation, invoices, tax prep inputs, vendor invoices | 2 | 2 |
| **Product** | Prioritization, user interview synthesis, roadmap decisions | 5 | 5 |
| **Total** | | **32–47 hrs** | **27–42 hrs** |

**Honest constraint:** You have ~50 usable hours per week. At launch, engineering + support + sales already fills that. Every hour spent on admin is an hour not spent on customers.

**Immediate mitigation:**
- Automate admin: Stripe handles billing, Resend handles email, crons handle data
- Timebox support: respond to tickets in two fixed windows per day (9 AM and 4 PM), not continuously
- Batch sales: dedicate one morning per week exclusively to outreach and content, not scattered throughout the week

---

## Section 2: Weekly Schedule Template

This schedule assumes you are post-launch with 0–20 paying customers. Adjust as volume changes.

| Day | Morning (4 hrs) | Afternoon (4 hrs) |
|-----|-----------------|-------------------|
| Monday | Support ticket triage + responses (last week's backlog). Admin: review Stripe, Sentry, cron health. | Engineering: bug fixes and maintenance only. |
| Tuesday | Engineering: product work (new feature or improvement). | Engineering: continued. |
| Wednesday | Engineering: product work. | Support: respond to new tickets from Tue/Wed. |
| Thursday | Sales/Growth: content writing, community posts, outreach emails. | Sales/Growth: continued. Agency channel follow-ups. |
| Friday | Product review: what shipped this week, what's next week's priority. | Buffer: catch-up on anything delayed. Weekly ops review (15 min). |

**Rules:**
- No support tickets during dedicated engineering time. Crisp auto-reply sets expectations.
- No engineering during dedicated sales time. Context switching is the enemy.
- Friday product review is non-negotiable — it prevents work from accumulating invisibly.

---

## Section 3: Decision Framework — Solo

Without a co-founder or board, certain decisions accumulate and get deferred. Use this to make them faster.

### Product prioritization

When a user requests a feature or you have an idea, evaluate against three questions:

1. **Does it fix a bug or unblock a paying customer?** → Do it this week.
2. **Does it directly improve trial-to-paid conversion or reduce churn?** → Do it this month.
3. **Does it make the product more complete for the ICP?** → Add to backlog, prioritize at next monthly review.
4. **Everything else:** → Decline or defer until $10K MRR.

Never add features because they are interesting. Add them because at least one paying customer has asked for them and at least two others would benefit.

### Pricing and discounting

- Never discount from listed price in the first 6 months. You need clean pricing data.
- Exception: annual plan discount (20%) — this is pre-priced and automated.
- If a prospect says "too expensive": ask "compared to what?" before changing anything. The answer tells you whether it's a budget problem or an ICP mismatch.

### "Should I build this?" decision rule

For any engineering task over 4 hours: write one sentence explaining which paying customer requested it and what they said exactly. If you can't write that sentence, the task is not a priority.

---

## Section 4: Hiring Plan by Milestone

### Phase 0 — Launch to $5K MRR: No hires. Contractors only.

| Function | Solution | Cost/Month |
|----------|----------|------------|
| Bookkeeping | Bench.co or local bookkeeper | $200–$500 |
| Legal counsel | Engage now for ToS/PP review (one-time), then on-call | $1,500 one-time, then as needed |
| Tax preparation | CPA with SaaS/Delaware experience for annual filing | $800–$1,500/year |
| UI/UX design | Freelancer via Contra or Toptal for landing page and email templates (one-time) | $500–$1,500 one-time |
| Pentest | Cobalt one-time engagement | $1,500–$3,000 one-time |

Total recurring overhead at this phase: ~$300–$700/month. This is manageable even at 10 paying customers.

---

### Phase 1 — $5K to $15K MRR: First contractor hire.

**Trigger:** When weekly support + onboarding time exceeds 10 hours/week, or when you miss a sales follow-up because of engineering work.

**First hire: Part-time Customer Success Contractor**

| Attribute | Target |
|-----------|--------|
| Role | Customer Success / Support (10–15 hrs/week) |
| What they do | Handle Tier 1 support tickets (KB-answerable), assist Agency plan onboarding calls, document new support patterns |
| What they don't do | Engineering, billing decisions, sales strategy |
| Cost | $25–$40/hr → $1,000–$2,400/month at 10–15 hrs/week |
| Where to find | Contra.com (fractional), LinkedIn (SaaS support contractor), X/Twitter communities |
| Background needed | 1–2 years SaaS support experience. Restaurant industry background is a bonus, not required. |
| Payback | Frees 10 hrs/week of founder time → redirected to sales = estimated $2K–$5K/month new MRR within 60 days |

**Onboarding this person:**
- Give them access to Crisp (agent seat)
- Give them read-only access to Supabase admin (no write access)
- Walk them through the KB articles (docs/CS-SUPPORT.md §3) — these are their reference
- First 2 weeks: shadow your support responses, then handle independently with your review
- SLA accountability: ensure all Tier 1 tickets are responded to within the plan SLA

---

### Phase 2 — $15K to $50K MRR: Second hire or promotion.

**Trigger:** When you cannot personally handle all Agency plan onboarding calls and relationship management. Agency accounts are $449+/month — losing one is $5K+ ARR.

**Second hire: Part-time Agency Partnerships / Sales**

| Attribute | Target |
|-----------|--------|
| Role | Agency Channel Development (15–20 hrs/week) |
| What they do | Identify and reach out to restaurant marketing agencies, run agency demos, manage agency account relationships, maintain a CRM (even a simple Notion database) |
| Cost | Commission-based + base: $1,500/month base + 10% of first-year ARR they close |
| Background needed | Restaurant marketing agency experience, or SaaS sales experience with SMB focus |

**At this revenue level:** Also hire a part-time fractional CFO (5 hrs/month) to validate the unit economics model, review COGS as you scale, and prepare for any fundraising or acquisition conversations.

---

### Phase 3 — $50K+ MRR: First full-time hire.

At $50K MRR (~$600K ARR), gross profit is ~$30K/month. A full-time hire at $80K–$100K/year is economically justifiable.

**First full-time hire: Head of Customer Success / Operations**

This person takes over everything that isn't engineering and product. They own: all support, all onboarding, all Agency relationships, internal operations, and vendor management. This frees the founder to focus on product vision and the next growth phase (either fundraising, vertical expansion, or team scaling).

---

## Section 5: Advisory Network

You don't need a formal board at this stage. You need 3–5 advisors who will take a call once a month. The right advisors for LocalVector:

| Advisor Type | What They Provide | How to Find | Compensation |
|-------------|-------------------|-------------|--------------|
| **Restaurant operator** (owns 2–5 locations) | ICP validation, product feedback, intro to other operators | Local restaurant association, LinkedIn, cold email to operators you admire | Dinner + a free Agency plan |
| **Restaurant marketing agency owner** | Agency channel feedback, potential first agency partner, referral network | LinkedIn search "restaurant marketing agency owner", local digital marketing meetups | Commission on referrals if they send paying customers |
| **SaaS founder at $1M–$5M ARR** | Pricing, retention, hiring, operational patterns — someone who's solved the problems you're about to face | Twitter/X SaaS communities, Indie Hackers, founder slack groups | Equity (0.1–0.25%) or pay-it-forward with your future help |
| **AI/SEO practitioner** | Product credibility, early content distribution, technical validation | AI community on Twitter/X, SEO Twitter, LinkedIn | Free Growth plan + public credit |

**How to approach advisors:**
- Never ask for a standing commitment. Ask for: "Could I send you a voice memo once a month with 3 specific questions? I'll keep it to 15 minutes."
- Show the product first. A restaurant operator who sees the ViralScanner find a real mistake about their restaurant is already an advisor in their head.
- Don't give equity until someone has given you substantive value. Earn-in over 6 months.

---

## Section 6: Continuity Plan

What happens if you are unavailable for 2–4 weeks (illness, emergency, travel)?

### Infrastructure (handles itself)
- All 25+ crons run automatically on Vercel — no intervention needed
- Supabase backups run automatically — no intervention needed
- Stripe billing processes automatically — no intervention needed
- Sentry collects errors — no intervention needed

### What degrades
| Function | Degradation | Impact |
|----------|-------------|--------|
| Support tickets | Unanswered after 48h | Trial churn risk; Growth/Agency customers frustrated |
| Bug fixes | No new fixes deployed | Known bugs persist |
| SOV scan failures | No manual resolution | Data stale for affected orgs |
| Stripe disputes | No response | Chargeback loss |

### Minimum continuity actions

Before any planned absence of 1+ week, complete:

1. **Set a Crisp auto-reply:** "We're experiencing reduced support capacity and will respond within [X] business days. For billing issues, email billing@localvector.ai." Redirect billing@ to Stripe's dispute portal link.
2. **Activate all non-critical cron kill switches:** Prevent noisy failures from accumulating. Leave SOV, digest, and correction-rescan running.
3. **Pre-write 2 support responses** for the most common tickets (wrong data, GBP disconnect, billing question). Leave in Crisp as saved replies.
4. **Document current open issues** in a `HANDOFF.md` file (not committed — keep locally or in a password manager note): active bugs, any user escalations, pending Stripe disputes.

### Emergency contact chain (for unplanned absence)

Document this privately (not in this repo):
- Who has access to Vercel (can they redeploy or roll back)? → _______________
- Who has access to Supabase (can they query or restore)? → _______________
- Who has access to Stripe (can they handle a dispute)? → _______________
- Who would respond to support tickets? → _______________

This person does not need to understand the codebase. They need to know: "If the site is down, go to Vercel and click Instant Rollback. If a user is asking about a billing charge, direct them to Stripe's customer portal. Do not make any DB changes."

---

## Section 7: Communication & Transparency Norms

Even as a solo founder, establish these norms now. They become critical when you hire.

**Public-facing:**
- Status page: Set up a simple status page (Betterstack or a simple Vercel-hosted static page) before launch. Link from the footer. Even if it's rarely updated, its existence signals operational maturity to agency buyers.
- Changelog: Maintain a public changelog at `localvector.ai/changelog`. One entry per meaningful product update. This drives re-engagement from trial users who haven't activated.

**Internal:**
- `docs/DEVLOG.md` is the source of record for what was built and when. Keep it current.
- All decisions with lasting consequences (pricing changes, ICP pivots, vendor changes) get a one-paragraph decision log added to `docs/DEVLOG.md` with: what was decided, why, and what triggered it.
- `docs/PENDING.md` is reviewed at the start of every week. If an item has been open for 30+ days with no progress, either resolve it or explicitly defer it with a new target date.

---

_Last updated: 2026-03-05_
_Owner: Senthilbabu_
_Next review: First paying customer. Update Section 4 hiring triggers based on actual support load._
