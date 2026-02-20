# 07 — Go-to-Market & Growth Playbook

## The "Fear & Fix" Launch Strategy
### Version: 2.3 | Date: February 16, 2026

---

## 1. Core Strategy: Sell the "Fix", Not the Tool

We are NOT launching another "SEO Dashboard." We are launching an **Insurance Policy against AI Hallucinations**.

- **Old Hook:** "Manage your listings on 100 directories." (Boring, commoditized)
- **New Hook:** "Stop ChatGPT from telling customers you are closed." (Urgent, emotional)
- **Conversion Logic:** Fear gets them in the door. Magic keeps them paying.

---

## 2. The Viral Wedge: The Free Hallucination Checker

**Concept:** A free, no-login tool at `localvector.ai/check`.

**Flow:**
1. User enters Business Name + City
2. We look up the business via Google Places API to establish Ground Truth (hours, status)
3. One live Perplexity check runs against that Ground Truth (cost ~$0.01)
4. Hallucination Report Card displayed
   - **PASS:** "You're safe... for now." → Capture email for weekly alerts
   - **FAIL:** "AI is lying about your hours." → Upsell to fix

**Why This Works:** Zero friction, emotionally charged, shareable ("Look what ChatGPT says about us!"), cost-controlled (1 check/IP/day, ~$30/month at 100 checks/day).

---

## 3. Pricing Strategy

| Tier | Price | Emotional Hook | Target | Key Feature |
|------|-------|---------------|--------|-------------|
| **Free** | $0 | "Am I safe?" | Curious owner | 1 hallucination check |
| **Starter** | $29/mo | "Protect me" | Worried owner | Weekly audits + Basic Menu |
| **Growth** | $59/mo | "Help me win" | Competitive owner | Daily audits + Competitor Intercept + Full Menu |
| **Agency** | $149/mo | "Help me sell" | SEO agencies | 10 locations + White-label reports |

**Why these prices:** $29 = cheaper than one lost table. $59 = cheaper than one lost Friday night. $149 = agency cost basis for a $500+/month service.

## 3.1 The Trial Expiration Loop
**Concept:** Transitioning users from the free "Fear" hook to the paid "Fix/Magic" retention.

- **Threshold:** Trial users are capped at 1 audit and 0 Magic Menu publishes.
- **UI State:** Upon hitting the limit, all CTA buttons trigger the `PlanGate` component (Doc 06).
- **Messaging:** "You’ve detected a hallucination. Now protect your revenue. Upgrade to Starter to publish your AI-readable menu."

---

## 4. Acquisition Channels

1. **Viral Checker** (Months 1-3): SEO content targeting "ChatGPT restaurant hours wrong"
2. **Restaurant Owner Communities** (Months 1-6): Facebook Groups, Reddit, with authentic founder posts from Aruna
3. **Build in Public** (Months 2-6): Twitter/LinkedIn weekly updates, real hallucination screenshots
4. **Menu Rescue Campaign** (Month 3+): "Free PDF-to-AI conversion for the first 50 restaurants"
5. **Agency Empowerment** (Months 6-9): White-label "Hallucination Report" as a sales tool for agencies

---

## 5. Content Strategy

**"Definitions Library" (AEO Play):** Create authoritative pages for terms AI will cite:
- `localvector.ai/what-is/ai-hallucination`
- `localvector.ai/what-is/aeo`
- `localvector.ai/what-is/geo`

**Case Studies:**
- "How Charcoal N Chill recovered $1,600/month by fixing one ChatGPT hallucination"
- "We turned an invisible PDF menu into 450 AI reads per month"

---

## 6. Retention Strategy

- **"Insurance" framing:** Position as ongoing protection, not a one-time fix.
- **Link Injection Campaign:** "The Magic Menu only works if Google knows about it." Aggressive in-app prompts and email follow-ups to get users to paste the link into their Google Business Profile. **Metric:** % of published menus with `link_injected` event.
- **Weekly email:** "Your AI Status: All Clear" (reinforces value even when nothing is wrong).
- **Propagation Status Bar:** Show 7-14 day AI update timeline so users don't think the tool failed.
- **Drift Protection messaging:** "AI models update constantly. Errors return without monitoring."
- **Monthly report:** "2 hallucinations caught, 1 competitor intercepted, 450 menu reads."

---

## 7. Success Metrics by Phase

| Phase | Timeline | Metric | Target |
|-------|----------|--------|--------|
| Viral Wedge | Months 1-3 | Free Checks | 1,000 |
| Conversion | Months 2-4 | Free → Paid rate | 5% |
| Retention | Months 3-6 | Monthly churn | < 8% |
| Upsell | Months 4-6 | Starter → Growth | 20% |
| MRR | Month 12 | Revenue | $10,000 |

---

## 8. The Agency Trojan Horse Strategy

**Goal:** Turn LocalVector into a sales enablement tool for Marketing Agencies.

**The Problem:** Agencies struggle to prove immediate value to skeptical restaurant owners.
**The Solution:** The "Hallucination Audit" is a tangible, terrifying problem that the agency can "find" for free and "fix" for a retainer.

### 8.1 The "Foot-in-the-Door" Script
*Use this when pitching a new restaurant client.*

> **Agent:** "I ran a quick check on how AI recommends your restaurant. Did you know ChatGPT currently tells people you're closed on Tuesdays?"
>
> **Owner:** "What? No, we're open."
>
> **Agent:** "Yeah, it's an AI hallucination. It's hurting your search traffic. I generated a report showing exactly what it says and which competitors are winning instead."
>
> **The Close:** "I can fix this for you as part of our SEO package. I'll monitor it weekly so it never happens again."

### 8.2 The "Value-Add" Upsell
*Use this for existing clients to increase retention.*

> "We've added a new 'AI Reputation Protection' service to your package at no extra cost. We now monitor exactly what ChatGPT, Perplexity, and SearchGPT say about your menu items to ensure they aren't recommending competitors."

---

## 9. Automated Email Drip Campaigns

**Goal:** Automate retention and activation.

### 9.1 The "Fear to Fix" Sequence (Free Users)
*Trigger: User runs a free scan that detects a hallucination but doesn't sign up.*

| Time | Subject Line | Body Concept |
|------|-------------|--------------|
| **0h** | "🚨 Alert: AI is reporting incorrect info about {Business}" | "Here is the exact hallucination. Click here to fix it." |
| **24h** | "Did you fix that hour mismatch?" | "ChatGPT still thinks you are closed. You might be losing customers right now." |
| **3d** | "Your competitors are winning these queries" | "While AI gets your info wrong, it's recommending {Competitor} instead." |
| **7d** | "Last chance to claim your AI Audit" | "We are wiping this report in 24 hours." |

### 9.2 The "Magic Menu" Activation (Paid Users)
*Trigger: User subscribes but hasn't uploaded a menu.*

| Time | Subject Line | Body Concept |
|------|-------------|--------------|
| **0h** | "Welcome to the inner circle" | "First step: Upload your menu PDF. It takes 30 seconds." |
| **3d** | "Your menu is invisible to AI" | "Right now, your PDF is a black box. Let's turn it into data AI can read." |
| **7d** | "See what a Magic Menu looks like" | Show a case study of a beautiful `llms.txt` file. |

### 9.3 The "Drift" Defense (Churn Prevention)
*Trigger: User cancels subscription.*

> **Subject:** "Warning: Your AI protection is turning off"
>
> **Body:** "By canceling, you stop the weekly scans. AI models drift over time—if a hallucination returns next week, you won't be notified. Are you sure you want to fly blind?"
>
> **CTA:** [Keep My Protection]