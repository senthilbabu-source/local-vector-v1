# LocalVector.ai — Beta Launch & PMF Testing Plan

**Version:** 1.0 — March 5, 2026
**Owner:** Senthilbabu
**Status:** Execute after Steps 1–8 are complete. This is the gate before broad public launch.

---

## How to Use This Document

Beta is not a soft launch. It is a structured experiment with a specific hypothesis, a defined cohort, measurable outcomes, and a go/no-go gate at the end.

**The hypothesis:** Restaurant operators with a claimed Google Business Profile, who have seen their restaurant in (or absent from) an AI response at least once, will find enough value in LocalVector within 7 days to pay $49–$149/month without being pressured.

**Beta goal:** Either confirm or refute this hypothesis with real data before spending money on growth.

- **Section 1:** Beta cohort design — who, how many, where to find them
- **Section 2:** Beta program structure — duration, what to track, what to observe
- **Section 3:** UX testing protocol — running sessions with non-technical restaurant operators
- **Section 4:** PMF measurement — Sean Ellis test, activation funnel, retention signals
- **Section 5:** Feedback collection — structured templates, synthesis process
- **Section 6:** Beta → paid conversion path
- **Section 7:** Go/no-go criteria — specific, objective thresholds for broad launch

---

## Section 1: Beta Cohort Design

### Target cohort size: 10–15 users

10 is the minimum for meaningful patterns. More than 20 creates support overhead that drowns signal in noise. 10–15 is the sweet spot for a solo founder doing qualitative PMF research.

### ICP filter — only invite Tier 1 prospects

Use the qualification framework from `docs/ICP.md §11`. Target score 15–18 (Tier 1). Every beta user should match:
- Full-service restaurant or fast-casual, 1–3 locations
- GBP claimed and verified (they know what GBP is)
- Already paying for at least one digital marketing tool
- Has personally searched for their restaurant on ChatGPT or Perplexity, OR has had a customer report wrong AI info

Do not invite:
- Food trucks, ghost kitchens, delivery-only
- Anyone who says "I don't believe in this AI stuff"
- Anyone you feel obligated to invite (friend, family member) — they will not give honest feedback

### Where to find 10–15 qualified beta users

| Source | How to Approach | Expected Yield |
|--------|-----------------|----------------|
| **LinkedIn — restaurant owners in Atlanta, Austin, Chicago, NYC** | DM: "I'm building a tool that monitors what ChatGPT says about your restaurant. Would you be willing to try it free for 30 days and give me honest feedback?" | 1 yes per 5–10 outreach messages |
| **Local restaurant Facebook groups** | Post: "I found that ChatGPT was showing wrong hours for a local restaurant. Built a tool to detect this. Looking for 10 restaurant owners to beta test — free for 30 days. Who's interested?" | 3–8 responses per post in active groups |
| **ViralScanner users** | Email everyone who completes a ViralScanner scan: "We're launching a full product — would you like early access?" | 15–25% conversion from scan to beta interest |
| **Cold email from GBP data** | If you have a list of restaurants in a target city from Google Maps, direct email to owner address | 1–3% response, but high ICP match |
| **Restaurant associations** | Georgia Restaurant Association, Illinois Restaurant Association — email their member newsletter contact | One press mention or email blast can yield 20+ inquiries |

### What to offer beta users

- **Free for 30 days**, no credit card required
- Growth plan features included (NAP sync, multi-model SOV, content drafts)
- Direct founder access: "You can email me directly — senthil@localvector.ai — during your beta"
- Recognition: "You'll be listed as a founding member on our website" (with permission)
- Honest ask: "In exchange, I need 20 minutes of your time at Day 7 and Day 21 for a quick video call"

Do NOT promise:
- "Your restaurant will show up in ChatGPT" — you cannot guarantee this
- "We'll fix everything in 30 days" — AI corrections take 2–8 weeks
- Any specific feature not yet built

---

## Section 2: Beta Program Structure

### Timeline: 30 days per cohort

| Day | Event | Owner |
|-----|-------|-------|
| Day 0 | Beta user signs up. Receives Email 1 (Welcome — from onboarding sequence). Founder sends a personal welcome email separately. | Founder |
| Day 1 | Founder checks: did they complete the scan? If not, sends a personal nudge: "Hey — did you have a chance to run the scan? Takes 2 min." | Founder |
| Day 3 | Scheduled check-in email (Email 4 from onboarding sequence — "Why AI gets it wrong"). | Automated |
| Day 7 | **Video call (20 min) — UX observation session.** Founder watches the user navigate the product and asks 5 questions (see Section 3). Also sends Sean Ellis survey (see Section 4). | Founder |
| Day 14 | Check-in: "Anything change in your scan results?" If they found a hallucination, ask if they initiated a correction. | Founder |
| Day 21 | **Video call (20 min) — PMF interview.** Founder asks conversion and retention questions (see Section 5). Second Sean Ellis survey sent. | Founder |
| Day 28 | Beta users who indicate willingness to pay receive a payment link. Offer: convert at their plan at no charge for their first month as a thank-you. | Founder |
| Day 30 | Beta closes. Go/no-go analysis (see Section 7). | Founder |

### What you are testing

| Question | How to Measure |
|----------|----------------|
| Can users activate (find their first AI mistake) without help? | Log: does `ai_hallucinations` row exist for their org within 24h of signup? |
| Do users return after Day 1? | Log: `sov_evaluations` count per org at Day 3, Day 7, Day 14 |
| Do users understand what the product is telling them? | Observe: Day 7 UX session — can they explain one finding in their own words? |
| Do users take a recommended action (correction, VAIO mission, content draft)? | Log: `ai_hallucinations.status` transitions, VAIO mission completions, `content_drafts.status` changes |
| Would users pay? | Ask directly at Day 21. Track conversion at Day 28. |

### What you are NOT testing in beta

- Scale (you only have 10–15 users)
- SEO / marketing channels (traffic to ViralScanner, conversion from ads)
- Agency plan features (test with a separate 2–3 agency cohort in Week 5–6 if primary cohort results are positive)
- New feature ideas from beta users (write them down, validate pattern across 3+ users, then build after launch)

---

## Section 3: UX Testing Protocol

Restaurant operators are not technology evaluators. They will not tell you "the information architecture is confusing" — they will just stop using the product. Your job in the Day 7 session is to watch where they hesitate and where they succeed without guidance.

### Setting up the UX session

- Use Zoom with screen share + recording (ask permission first)
- Do NOT share your screen. Watch them drive.
- Open with: "I'm going to ask you to use the product the way you normally would. I want to watch and learn from you. Please think out loud — say what you're trying to do as you do it. There are no wrong answers. The product is being tested, not you."
- Duration: 20 minutes. Have a hard stop.

### Tasks to assign (in order)

| Task | What You're Observing |
|------|----------------------|
| "Show me your AI Health Score" | Can they find the dashboard? Do they understand the score grade? |
| "Walk me through what this score means for your restaurant" | Can they translate data to business meaning? |
| "Find the specific AI mistake that bothered you most" | Can they navigate to AI Mistakes? Can they read an alert card? |
| "What would you do about that mistake?" | Do they find the correction workflow? Do they understand the action required? |
| "Show me where you'd find out if a competitor is being mentioned by AI more than you" | Can they find SOV / AI Mentions? Can they interpret the competitor gap? |

### What good looks like vs. what to fix

| Observation | Interpretation | Action |
|-------------|---------------|--------|
| User completes all 5 tasks under 15 min, no hesitation | Strong UX — product is intuitive | No change needed |
| User completes task but says "I'm not sure what this means" | Jargon problem — label or tooltip insufficient | Fix the label or tooltip before broad launch |
| User cannot find a section without help | Navigation problem — sidebar label or information architecture issue | Fix before broad launch |
| User completes task but says "I'd never do this" | Workflow mismatch — the action we're asking for doesn't fit their mental model | Deeper problem — requires design rethink |
| User says "Can it do X?" (X is not in the product) | Feature gap or expectation misalignment | Log the request. If 3+ users ask for the same X, prioritize. |

### 5 follow-up questions for Day 7

Ask after the task walkthrough. Listen for the specific words they use — these become your marketing copy.

1. "What surprised you most about what you found?"
2. "Before today, what did you think was happening when someone searched for your restaurant on ChatGPT?"
3. "If you had to explain this product to another restaurant owner in one sentence, what would you say?"
4. "What would need to be different about this product for you to use it every week?"
5. "On a scale of 1–10, how likely are you to recommend this to another restaurant owner you know? What would make it a 10?"

---

## Section 4: PMF Measurement

### The Sean Ellis Test

Send this survey at Day 7 (after first scan) and Day 21 (after full month). Use a simple Typeform or Google Form with one primary question and follow-ups.

**Primary question:**
> "How would you feel if you could no longer use LocalVector?"
> - Very disappointed
> - Somewhat disappointed
> - Not disappointed (it really isn't that useful)

**Follow-up questions (shown to all):**
1. What type of person would benefit most from this product? (open-ended — reveals who they think the ICP is)
2. What is the primary benefit you receive from LocalVector? (open-ended — reveals your actual value prop)
3. How could we improve LocalVector for you? (open-ended — product feedback)

**PMF threshold:** >40% "very disappointed" = product-market fit signal. 20–40% = promising but needs iteration. <20% = ICP or product problem.

At 10–15 beta users, you need 4–6 "very disappointed" responses to cross the threshold. That is a low bar statistically — treat it as a directional signal, not a proof.

---

### Activation Funnel

Track each beta user through these steps in sequence. The funnel shows you where people fall off.

```
Step 1: Signed up                         → target: 100% (they're invited)
Step 2: Added restaurant location          → target: 90%
Step 3: Connected GBP OR entered address   → target: 75%
Step 4: First SOV scan completed           → target: 70%
Step 5: Viewed AI Health Score             → target: 65%
Step 6: Found first AI mistake (hallucination exists in DB) → target: 50%
Step 7: Initiated correction OR shared result → target: 30%
```

**The activation moment is Step 6.** Every user who reaches Step 6 has experienced the core value. Users who drop between Steps 1–5 have an onboarding problem. Users who reach Step 6 but drop at Step 7 have a workflow problem.

**How to track this:** Query `sov_evaluations` and `ai_hallucinations` tables per org in the admin dashboard. You can see each org's funnel state in real time.

---

### Retention Signals

After Day 7, track for each beta user:

| Signal | Positive | Concerning |
|--------|----------|------------|
| Dashboard logins per week | 2+ logins/week | 0 logins after Day 3 |
| Scan trigger (manual) | Used manual scan trigger | Never touched it |
| Content draft action | At least 1 draft approved or edited | All drafts ignored |
| Correction initiated | Marked at least 1 hallucination corrected | No corrections initiated |
| Email digest opened | Opens weekly digest | Unsubscribes within 14 days |

A user who logs in 2x/week AND opens the digest AND has initiated at least one correction is a high-confidence converting user. A user who logged in once and never returned is a strong churn signal even before the 30 days ends.

---

## Section 5: Feedback Collection

### Day 21 PMF Interview (20 min)

By Day 21, the user has had a full month. Ask:

**Retention questions:**
1. "How often have you been checking the dashboard?"
2. "Has anything changed in what AI says about your restaurant since you started?"
3. "Have you done anything differently as a result of what you learned in LocalVector?"

**Conversion questions:**
4. "When the beta ends, the product is $49/month for the Starter plan. Does that feel right for the value you got? What would feel right?"
5. "If I gave you a discount code for your first month, would you sign up today?"
6. "Is there anyone else you've talked to about this — other restaurant owners who would benefit?"

**Key insight to capture:** Question 5 is the moment of truth. If they hesitate, ask "What's the hesitation?" The answer tells you whether it's price, ICP mismatch, or feature gap.

### Feedback synthesis

After each video call, write a 3-paragraph summary in your personal notes:
- Paragraph 1: What they found valuable (in their words)
- Paragraph 2: What confused or frustrated them
- Paragraph 3: Their exact words about pricing and whether they'd pay

After all Day 21 interviews, create a simple table:

| User | Industry | Locations | "Very disappointed"? | Would pay? | Activation step reached | Key quote |
|------|---------|-----------|---------------------|-----------|------------------------|-----------|
| Restaurant A | Italian | 1 | Yes | Yes ($149) | Step 6 | "I had no idea ChatGPT said I was closed on Sundays" |
| ... | | | | | | |

This table is your product's first evidence base. It goes in `docs/DEVLOG.md` after the beta closes.

---

## Section 6: Beta → Paid Conversion Path

### Timing

- Do not ask for payment before Day 7. They haven't seen enough value yet.
- The right moment to ask is after the Day 7 scan results have landed and they've expressed a reaction (surprise, concern, or excitement about a finding).
- If they say something like "I can't believe ChatGPT said X" — that is the conversion moment. Ask: "Would you want this running automatically and alerting you every week?"

### Conversion offer

At Day 28 (or earlier if they express willingness):

**Email template:**
> Subject: Ready to keep LocalVector running for [Restaurant Name]?
>
> Hi [Name],
>
> Your 30-day beta is wrapping up next week. Here's what we found for [Restaurant Name]:
>
> - AI Health Score: [Grade]
> - AI Mistakes found: [N]
> - AI platforms scanning you weekly: ChatGPT, Perplexity, Gemini, Copilot
>
> To keep weekly scans running and get alerts when anything changes, the Starter plan is $49/month.
>
> As a beta founding member, your first month is free — you'll be billed starting [date + 30 days].
>
> [Upgrade to Starter →]   [Upgrade to AI Shield (Growth) →]
>
> If you have questions, just reply to this email.
>
> — Senthil

### What not to do

- Do not discount below listed price (offer the free month instead — same economic result, preserves pricing)
- Do not pressure. A user who needs to be pressured to pay in beta will churn in Month 2.
- Do not offer lifetime deals or one-time pricing. This attracts deal hunters, not ICP users.

---

## Section 7: Go/No-Go Criteria for Broad Public Launch

All six criteria must be met before opening broad public signup (ViralScanner → full product CTA, paid acquisition, public announcement).

| Criteria | Threshold | Pass | Fail Action |
|----------|-----------|------|-------------|
| **Sean Ellis PMF score** | ≥35% "very disappointed" at Day 21 | | Run a second beta cohort with refined messaging or changed onboarding |
| **Activation rate** | ≥50% of beta users reach Step 6 (first AI mistake found) | | Fix onboarding — the scan → hallucination pipeline may be failing silently |
| **Conversion rate** | ≥3 of 10 beta users pay voluntarily by Day 28 | | Test pricing down ($29/$99/$299) OR test a different ICP segment |
| **Time-to-activation** | Median TTA ≤ 8 minutes from signup to first hallucination found | | Redesign onboarding — reduce friction in Steps 2–4 |
| **Support ticket rate** | Fewer than 2 tickets per user per week averaged across cohort | | Product is not learnable enough — fix before scaling |
| **Zero P0/P1 bugs** | No critical bugs found in beta | | Fix before any paid acquisition begins |

### What "broad public launch" means

The go/no-go criteria govern:
- Turning the ViralScanner CTA from "Join Waitlist" to "Start Free Trial"
- Running any paid advertising (Meta, Google, LinkedIn)
- Making any public announcement (Product Hunt, press, restaurant trade publications)
- Cold outreach to agencies at scale

A beta cohort that fails one criterion is not a failure — it is information. Most first beta cohorts fail at least one criterion. The value is knowing which criterion and why.

---

## Section 8: Agency Beta (Parallel Track)

If the primary restaurant operator beta shows positive results, run a 2–3 user agency beta in parallel during Weeks 5–6.

**Agency beta criteria:**
- 1–20 person digital marketing agency
- 3+ restaurant clients on retainer
- Currently has no answer when clients ask "what are you doing about AI search?"

**What to test:** Can an agency account manager run the product on behalf of a client restaurant? Does the white-label setup work? Is the multi-location dashboard clear enough for an account manager who doesn't own the restaurant?

**Agency beta offer:** Free for 30 days on Agency plan (10 locations), with a call to discuss agency partner pricing after.

---

_Last updated: 2026-03-05_
_Owner: Senthilbabu_
_Go/no-go review date: [Set when beta cohort Day 30 completes]_
_Next action after go/no-go pass: Steps 10–12 (Feedback Infrastructure, AI Cost Modeling, PLG Mechanics)_
