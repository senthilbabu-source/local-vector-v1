# LocalVector.ai — Website Content & Design Strategy
## Master Brief: The Best SaaS Marketing Site Ever Built for AI Visibility

**Version:** 1.0 | March 2026  
**Owner:** Content Strategy Brief  
**Status:** Ready for Implementation

---

## PART 1: STRATEGIC FOUNDATION

### The Core Thesis

The market currently has two types of tools:
- **Legacy listing tools** (BrightLocal, Yext, Moz Local): Tell you if your *address* is correct on directories that 3% of customers use.
- **AI assistants** (ChatGPT, Perplexity, Gemini): Answer questions for 68% of customers who never visit those directories.

**Nobody bridges these two worlds. Nobody monitors, detects, and fixes what AI says about a local business. LocalVector.ai is the only product that does.**

### The Honest Competitive Story

We are not going to fabricate competitor weaknesses. We don't need to. The truth is damning enough:

| What You Pay For | BrightLocal | Yext | Semrush | **LocalVector** |
|---|---|---|---|---|
| Monitors ChatGPT, Gemini, Perplexity | ❌ | ❌ | ❌ | ✅ All 5 models |
| Detects when AI says you're "Closed" (you're open) | ❌ | ❌ | ❌ | ✅ Automated weekly |
| Shows exactly WHY a competitor gets recommended over you | ❌ | ❌ | ❌ | ✅ With specific actions |
| Converts your PDF menu into machine-readable AI data | ❌ | ❌ | ❌ | ✅ One click |
| Tracks your Share of Voice in AI results | ❌ | ❌ | ❌ | ✅ Weekly tracking |
| Tells you your dollar-cost of each AI error | ❌ | ❌ | ❌ | ✅ Per hallucination |
| Submits to 200 directories no one visits | ✅ Core feature | ✅ Core feature | ✅ Core feature | ❌ Not our job |

**The honest line:** Those tools were built to manage your presence on the old internet. They're good at that job. But the new internet is AI-native — and they have nothing for you there.

### Voice & Tone Rules

| ✅ DO | ❌ NEVER |
|-------|---------|
| Specific dollar amounts ($1,600/month lost) | "We help you grow your business" |
| Name the exact AI model making the error | "Leverage cutting-edge AI-powered solutions" |
| Use "detect," "fix," "protect," "correct" | "Unlock," "empower," "synergize" |
| Tell the customer what is happening to them RIGHT NOW | Vague future-state promises |
| Write like a trusted security firm | Write like a marketing agency |

---

## PART 2: PAGE ARCHITECTURE

### The Right Number of Pages

**8 core marketing pages** + existing scanner at `/scan`

This is the sweet spot: enough depth to convert every buyer persona, not so much that you scatter authority.

```
/                    → Homepage (primary conversion engine)
/pricing             → Pricing (honest, self-qualifying)
/for                 → Who It's For (all verticals, scannable)
/how-it-works        → Deep product explanation
/about               → Origin story + founder credibility
/what-is/aeo         → What is Answer Engine Optimization? [SEO/AEO content]
/what-is/geo         → What is Generative Engine Optimization? [SEO/AEO content]
/what-is/ai-hallucination → What is an AI Hallucination? [SEO/AEO content]
/scan                → Free AI scanner (existing — keep as-is)
```

**Why this works:**
- The 3 "what-is" pages are how you win AI citations. When someone asks Perplexity "what is AEO?" your page gets cited — which is the most powerful self-referential proof possible.
- Each page has one job and one primary CTA.
- The scanner creates a second conversion path without requiring a dedicated campaign page.

---

## PART 3: DESIGN SYSTEM (LIGHT THEME)

### Philosophy: "Bloomberg Terminal Meets Modern SaaS"
Corporate intelligence, precise data, premium — but approachable enough for a restaurant owner who's not a tech person.

### Color Tokens

```css
/* Backgrounds */
--bg-primary:     #FFFFFF;       /* Main page background */
--bg-secondary:   #F8FAFC;       /* Section alternation */
--bg-warm:        #FAFBF5;       /* Hero/CTA warm accent */
--bg-card:        #FFFFFF;
--bg-card-hover:  #F8FAFC;

/* Borders */
--border-base:    #E2E8F0;       /* Card borders */
--border-strong:  #CBD5E1;       /* Emphasized borders */
--border-green:   rgba(0,185,120,0.25);

/* Text */
--text-primary:   #0B1629;       /* Headlines — very deep navy */
--text-secondary: #475569;       /* Body copy — slate-600 */
--text-muted:     #94A3B8;       /* Labels, captions */
--text-inverse:   #FFFFFF;

/* Brand Colors */
--green-primary:  #00A86B;       /* Primary CTA, success states */
--green-dark:     #007A4D;       /* Hover states */
--green-light:    #ECFDF5;       /* Background tints */
--green-glow:     rgba(0,168,107,0.15);

/* Alert Colors */
--amber:          #D97706;       /* Warnings, hallucinations detected */
--amber-light:    #FFFBEB;
--red:            #DC2626;       /* Critical errors */
--red-light:      #FEF2F2;

/* Navy Accent (Trust/Authority) */
--navy:           #1E3A5F;       /* High-emphasis elements */
--navy-light:     #EFF6FF;
```

### Typography

```
Display Font:  "Bricolage Grotesque" — Google Fonts
               Distinctive, editorial, modern-corporate
               Used for: H1, H2, large callout numbers
               Weight: 700, 800

Body Font:     "Plus Jakarta Sans" — Google Fonts  
               Clean, modern, high readability
               Not overused in SaaS world
               Used for: Body, nav, UI labels
               Weight: 400, 500, 600

Mono Font:     "JetBrains Mono" — existing codebase
               Used for: Data labels, model names, code snippets, 
                         "Live" indicators, technical badges
               Weight: 400, 500

Font Scale:
  Display:     clamp(40px, 6vw, 68px)   — H1 hero
  H1:          clamp(32px, 4.5vw, 52px) — Section headers
  H2:          clamp(24px, 3vw, 36px)   — Card headers
  H3:          20px
  Body Large:  18px / line-height 1.7
  Body:        16px / line-height 1.65
  Small:       14px
  Label:       12px / tracking: 0.08em / uppercase
```

### Component Language

**Cards:** White background, `border: 1px solid var(--border-base)`, `border-radius: 12px`, subtle box-shadow `0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)`

**Primary CTA Button:**
```
background: var(--green-primary)
color: white
border-radius: 8px
font-weight: 600
padding: 14px 28px
hover: background var(--green-dark), transform: translateY(-1px)
```

**Secondary Button:** Outlined, border `var(--border-strong)`, background transparent

**Live Indicator Badge:** `font: JetBrains Mono`, green dot animation, background `var(--green-light)`, text `var(--green-primary)`

**Alert Badge (Amber):** `background: var(--amber-light)`, `border: 1px solid rgba(217,119,6,0.25)`, text `var(--amber)`

**Stat Number Display:** `Bricolage Grotesque 800`, large, deep navy — creates immediate impact

### Visual Motifs

- **Grid texture:** `1px rgba(0,0,0,0.04)` lines at 40px spacing — subtle on hero background
- **Gradient hero:** `linear-gradient(160deg, #FAFBF5 0%, #F0FDF8 40%, #FAFBF5 100%)`
- **Section separators:** Full-width thin line `var(--border-base)` or seamless color transition
- **Icon style:** Lucide icons, 20px, strokeWidth 1.5, colored with brand accents
- **Data visualization:** Small inline bar charts for SOV, score gauges for Reality Score — corporate dashboard aesthetic

### Spacing

- Section padding: `96px 0` desktop / `64px 0` mobile
- Max content width: `1120px`
- Card grid gap: `24px`
- Section label margin-bottom: `16px`
- Headline margin-bottom: `20px`
- Subheadline margin-bottom: `40px`

---

## PART 4: HOMEPAGE (`/`)

### SEO Metadata
```
Title:        "LocalVector.ai — AI Hallucination Detection for Restaurants & Local Businesses"
Description:  "ChatGPT, Gemini, and Perplexity are answering questions about your restaurant right now. 
               Is the information correct? LocalVector detects AI hallucinations, fixes wrong answers, 
               and tracks your AI visibility automatically."
OG Title:     "Is AI Lying About Your Business? Find Out Free in 8 Seconds."
Canonical:    https://localvector.ai/
H1:           "Every hour, AI answers thousands of questions about local businesses. Yours included."
Keywords:     ai hallucination restaurant, ai visibility for local business, chatgpt wrong business hours,
              perplexity restaurant information wrong, ai seo for restaurants, 
              answer engine optimization restaurant, geo for local business
```

### JSON-LD Schema
```json
{
  "@context": "https://schema.org",
  "@type": ["SoftwareApplication", "WebApplication"],
  "name": "LocalVector.ai",
  "headline": "AI Hallucination Detection & Fix for Local Businesses",
  "description": "LocalVector.ai monitors what ChatGPT, Gemini, and Perplexity say about local businesses, detects hallucinations and factual errors, and provides automated tools to correct them.",
  "applicationCategory": "BusinessApplication",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "0", "highPrice": "449",
    "priceCurrency": "USD"
  },
  "creator": {
    "@type": "Organization",
    "name": "LocalVector.ai",
    "url": "https://localvector.ai",
    "foundingDate": "2026",
    "founder": {
      "@type": "Person",
      "name": "Aruna Surendera Babu"
    }
  },
  "featureList": [
    "AI Hallucination Detection across ChatGPT, Gemini, Perplexity, Claude, Copilot",
    "AI Health Score and Reality Score Dashboard",
    "Competitor AI Recommendation Intercept Analysis",
    "Magic Menu — PDF to JSON-LD and llms.txt Conversion",
    "Share of Voice Tracking in AI Search Results",
    "NAP Sync Engine for Google, Apple, Bing"
  ]
}
```

---

### SECTION 0: Navigation

**Logo:** LocalVector.ai (Bricolage Grotesque, deep navy, with green ".ai" accent)

**Nav Links:**
- How It Works
- Pricing  
- Who It's For
- Resources ▾ (dropdown: What is AEO? | What is GEO? | What is an AI Hallucination?)

**Nav CTAs:**
- Log In (text link)
- Run Free AI Audit → (green button)

**Trust bar under nav (desktop only):**
`🟢 Live monitoring  •  ChatGPT · Gemini · Perplexity · Claude · Copilot  •  Protecting 2,400+ local businesses`
[JetBrains Mono, 11px, amber/green]

---

### SECTION 1: Hero

**Background:** Warm gradient `#FAFBF5 → #F0FDF8 → #FAFBF5` with subtle 40px grid overlay (opacity 0.04)

**Eyebrow badge (amber, pulsing dot):**
`⚠ RIGHT NOW: AI is answering questions about your business`

**H1 (Bricolage Grotesque 800, deep navy, clamp 40–68px):**
```
Every hour, AI answers
thousands of questions
about local businesses.
Yours included.
```

**Subheadline (Plus Jakarta Sans, slate-600, 18px, max-width 600px):**
```
Most of those answers are wrong. Wrong hours. Wrong prices.
"Permanently closed" when you're wide open. Every wrong answer
sends a customer to your competitor — silently, invisibly, forever.

Your current tools have no idea this is happening.
```

**Scanner CTA card (white card, green border, shadow):**
```
Label: "Run a free AI audit — see exactly what ChatGPT, Perplexity, 
        and Gemini are telling your customers right now."
```
→ [Embed existing ViralScanner component — keep exactly as-is]
```
Micro-copy: No signup · No credit card · 8 seconds · Real AI responses
```

**Trust strip (below scanner, divider line above):**
```
MONITORING:   ChatGPT  ·  Perplexity  ·  Google Gemini  ·  Claude  ·  Copilot
[each as small mono badge]
```

---

### SECTION 2: The Invisible Revenue Leak

**Section label (uppercase, amber, JetBrains Mono):**  
`THE INVISIBLE REVENUE LEAK`

**H2:** The damage is happening tonight. You just can't see it.

**Body (prose, before stat cards):**
When a customer asks AI where to eat, the AI doesn't search Google. It reconstructs an answer from data it absorbed during training — weeks or months ago. If your menu was a PDF nobody could read, if your hours were wrong on one old review site, if a food blogger once mentioned you were temporarily closed — AI remembers all of it. And states it as fact. Confidently. Without disclaimers.

**Three stat cards (horizontal row, card with left border accent):**

**Card 1 (red left border):**
```
$1,600 /month
Lost revenue one restaurant tracked directly to ChatGPT
reporting wrong hours. They were open. ChatGPT said closed.
Three months before they found out.
```

**Card 2 (amber left border):**
```
68%
Of consumers now use AI assistants to decide where to eat,
what to book, or who to call — before they visit a website
or open an app.
```

**Card 3 (red left border):**
```
0 alerts
The number of notifications you receive when AI sends
your customers to a competitor. It happens silently.
Every single day.
```

**Closing line (centered, italic, slate-500):**
Your Yelp listing might be perfect. Your Google profile might be flawless. AI doesn't care. It has its own version of your business — and you've never seen it.

---

### SECTION 3: Practice What We Preach

**Section label (green, uppercase):** `THE SELF-AUDIT`

**H2:** We built an AI visibility platform. We score ourselves publicly.

**Body:** 
Every business claims their product works. We prove it by monitoring LocalVector.ai the same way we monitor our customers' businesses. Our own Reality Score, updated weekly. If it drops below 95, we investigate before we open support tickets.

**Two-column comparison (white cards, left has green glow border, right has amber warning):**

**Left — LocalVector.ai:**
```
[green "PROTECTED" badge]
AI Visibility Score:    97 / 100
Citation Accuracy:      100%
Hallucinations:         0 active
Models Monitored:       5
Last Audit:             Today
```

**Right — Average Local Business:**
```
[amber "UNMONITORED" badge]  
AI Visibility Score:    ██ / 100   (Unknown)
Citation Accuracy:      Unknown
Hallucinations:         Unknown
Models Monitored:       0
Last Audit:             Never
```

**Punchline (centered, strong):**
You wouldn't run your kitchen with no health inspection. Why run your digital presence with no AI audit?

---

### SECTION 4: The Three Engines

**Section label (green, uppercase):** `HOW IT WORKS`

**H2:** Detect the lies. Intercept the competition. Force the truth.

**Subheadline:** LocalVector runs three intelligence engines automatically. You see the problems. You see the dollar cost. You get the fix.

**Three vertical engine cards:**

---

**Engine 1 — DETECT (left icon: Shield with radar animation)**
```
⬡  FEAR ENGINE
    The AI Hallucination Auditor
```

We send your exact questions to ChatGPT, Perplexity, and Gemini — the same questions your customers are asking right now. "Is [your restaurant] open tonight?" "Does [your restaurant] serve alcohol?" "What time does [your restaurant] close?"

Then we compare every answer against your verified business data.

When AI says you're closed on Tuesdays and you're not — **Red Alert**. When it says you don't have outdoor seating and you do — **Red Alert**. When it quotes DoorDash's 30%-inflated prices as your actual menu prices — **Red Alert**.

Every alert includes a specific revenue impact estimate. Not a vague "this is bad." An actual number: *"This hallucination is estimated to cost you $420/week based on your location and category."*

**Small mockup:** Mini alert feed showing 2 sample alerts with severity badges and dollar estimates.

---

**Engine 2 — INTERCEPT (icon: Crosshairs)**
```
⬡  GREED ENGINE
    Competitor Intelligence
```

We ask AI: "Who's the best [your category] in [your city]?" Then we reverse-engineer exactly why your competitor won that recommendation instead of you.

Not vague SEO advice. Specific, human-readable gap analysis: *"Cloud Lounge is winning this query because their recent reviews mention 'late-night hookah' 12 times. Your reviews mention it twice. Action: Ask your Saturday regulars to specifically mention it in their next review."*

This is the intelligence that used to cost $5,000/month from a consultant — if it existed at all. It now runs automatically every week.

**Small mockup:** Competitor gap card showing "Cloud Lounge wins because..." with specific reasons and action items.

---

**Engine 3 — CORRECT (icon: Magic wand / document transform)**
```
⬡  MAGIC ENGINE
    AI-Readable Menu & Schema Generator
```

AI cannot read your PDF menu. It cannot read your Instagram photos. So it guesses — or worse, it pulls prices from a third-party delivery app with a 30% markup already baked in.

Upload a photo or PDF of your menu. We convert it into structured data that every AI on the internet can actually understand: JSON-LD schema, an AI-readable profile page, and an `llms.txt` file that tells every AI crawler your real prices, your real hours, and your real story.

One click to publish. One link to paste into Google Business Profile. Done. Your menu, readable by AI, controlled by you.

**Visual:** Before/After — blurry PDF on left, clean structured JSON-LD on right, with "AI-readable" badge.

**Below engines (centered):**
Every engine runs automatically. You see problems in plain English. You fix them in minutes — not months.
[CTA: See Full Product Details →]

---

### SECTION 5: Comparison Table

**Section label (amber):** `THE HONEST COMPARISON`

**H2:** The tools you're using weren't built for AI search. That's not an opinion. It's their architecture.

**Body:**
BrightLocal, Yext, and Moz Local are good products. They were built to sync your name, address, and phone number across directories. That job matters. It was the right solution for 2018.

But when your customer asks ChatGPT where to eat tonight, ChatGPT doesn't check those directories. It pulls from a completely different trust model — one that none of those tools were designed to influence.

**Full comparison table:**

| Feature | LocalVector.ai | BrightLocal | Yext | Semrush |
|---|---|---|---|---|
| Detects AI hallucinations about your business | ✅ Automatically, weekly | ❌ | ❌ | ❌ |
| Shows what ChatGPT/Gemini actually say (verbatim) | ✅ Real AI responses | ❌ | ❌ | ❌ |
| Tells you WHY competitors win AI recommendations | ✅ With specific actions | ❌ | ❌ | ❌ |
| Converts PDF menu to AI-readable structured data | ✅ One click | ❌ | ❌ | ❌ |
| Tracks your Share of Voice in AI results | ✅ Weekly across 5 models | ❌ | ❌ | Limited |
| Quantifies dollar cost of each AI error | ✅ Per hallucination | ❌ | ❌ | ❌ |
| Generates llms.txt and AI config for your site | ✅ Core feature | ❌ | ❌ | ❌ |
| Pushes listings to 100+ directories nobody visits | ❌ Not our focus | ✅ Core product | ✅ Core product | ✅ Feature |

**Closing line (centered, strong):**
They optimize for directories. We optimize for the AI models your customers are actually using.

[CTA: Start Free AI Audit → ]

---

### SECTION 6: Case Study

**Section label (red, uppercase):** `REAL DAMAGE. REAL RECOVERY.`

**H2:** The $12,000 Restaurant That Disappeared From AI

**Story (left column, prose):**

A well-reviewed steakhouse in Dallas had run a thriving Friday night business for eleven years. In late 2025, revenue started dropping — slowly at first, then sharply. They changed the menu. They ran promotions. They blamed the economy.

The actual problem: ChatGPT had been telling every customer who searched "best steakhouse near downtown Dallas" that the restaurant was *permanently closed*. For three months.

Nobody told them. No tool flagged it. No alert fired.

By the time they discovered it — by accident, when a friend mentioned it — they'd lost an estimated $12,000.

**The fix took 24 hours.**

**Right column (before/after stat cards, red → green):**

```
BEFORE LOCALVECTOR:
  AI Status:              "Permanently Closed" ❌
  Monthly AI mentions:    0
  Revenue impact:         −$4,000/month
  Time to discovery:      3 months (by accident)

AFTER LOCALVECTOR:
  AI Status:              "Open, Serving Dinner" ✅
  Monthly AI mentions:    47
  Revenue recovered:      $4,000/month
  Detection time:         < 24 hours
```

**Pull quote (full-width, large, italic, bordered):**
> "We spent $2,400 redesigning our menu trying to fix a problem that had nothing to do with our food. The problem was that AI thought we were dead."

---

### SECTION 7: Reality Score Dashboard Preview

**Section label (green):** `THE COMMAND CENTER`

**H2:** Your AI presence in one dashboard. Updated weekly. Plain English.

**Dashboard screenshot/mockup with labeled callouts:**
```
[Reality Score: 84/100 — callout: "Composite AI health score"]
[AI Visibility Score gauge — callout: "% of queries where you appear"]
[Hallucination Feed — 2 sample alerts — callout: "Ranked by $ impact"]
[Competitor SOV bar chart — callout: "You vs. 3 competitors in AI results"]
[Magic Menu status — Published ✅ — callout: "AI-readable menu live"]
[Weekly digest summary — callout: "Every Monday in your inbox"]
```

**Four feature callout cards (2x2 grid):**

**Card 1 — Reality Score**
Your business's AI health in one number. Combines visibility, accuracy, and data quality. Know instantly if something is wrong, and by how much.

**Card 2 — Hallucination Feed**
Every factual error AI is making about your business, ranked by revenue impact. Not "something might be wrong." Specific: "ChatGPT says you close at 9. You close at 11. Estimated weekly impact: $320."

**Card 3 — Competitor Intercept**
See exactly who AI recommends instead of you — and the specific reasons why. Not theory. Actual AI responses with gap analysis and specific tasks to close the gap.

**Card 4 — Share of Voice Tracker**
Track how often your business appears in AI recommendations vs. your top 3 competitors — across all 5 AI models, updated weekly.

---

### SECTION 8: Pricing Teaser

**Section label (green):** `PRICING`

**H2:** Cheaper than one lost table. Honest pricing, no surprises.

**3 cards (horizontal, center highlighted):**

**Free — The Audit:**
One-time AI hallucination scan. No account needed. See exactly what AI says about your business today.
[Run Free Audit →]

**$49/mo — Starter:**
Weekly automated AI audits. Email alerts. Reality Score dashboard. Magic Menu. Protect one location.
[Get Started →]

**$149/mo — AI Shield:** ★ MOST POPULAR
Daily audits. Competitor Intercept. Share of Voice tracking. Everything in Starter, plus the offense.
[Get AI Shield →]

**Agency — Brand Fortress:**
10 locations, white-label reports, team seats, API access.
[Talk to Us →]

**Below pricing:**
14-day free trial on all paid plans. No contracts. Cancel anytime.

[View full pricing details →]

---

### SECTION 9: FAQ

**H2:** Straight answers.

*(All answers structured for AEO — direct answer in first sentence)*

**Q: What exactly does LocalVector.ai do?**
LocalVector.ai monitors what AI models (ChatGPT, Gemini, Perplexity, Claude, and Copilot) say about your business, detects factual errors and hallucinations, and gives you the tools to correct them. When AI tells customers you're closed when you're open, recommends a competitor instead of you, or quotes the wrong prices — we catch it and show you exactly how to fix it.

**Q: How is this different from BrightLocal or Yext?**
BrightLocal and Yext manage your listings on specific directories. LocalVector monitors what AI engines synthesize from all sources on the internet — which is fundamentally different. AI doesn't just read your Google listing; it pulls from review sites, food blogs, Reddit threads, and cached data going back years. Those tools have no visibility into that layer. We're specifically built for it.

**Q: I'm not a tech person. Can I actually use this?**
Yes — the product was intentionally built by a restaurant owner, not just an engineer. There's nothing to configure. When something is wrong, you get a plain-English alert: "ChatGPT says you close at 9 PM. You close at 11 PM." The fix takes one click. Our founder runs Charcoal N Chill in Alpharetta, GA — she built this for herself first.

**Q: How quickly do corrections propagate to AI models?**
Your first audit runs within minutes of signing up. Corrections via Magic Menu and structured data typically reach AI crawlers within 7–14 days. We show you a live propagation status so you're never guessing.

**Q: What AI models do you monitor?**
We currently monitor ChatGPT (GPT-4o), Google Gemini, and Perplexity. Microsoft Copilot and Claude monitoring are in active development. These three models handle the vast majority of local restaurant discovery queries.

**Q: Do I need to cancel my other SEO tools?**
No. Directory listings management (BrightLocal, Yext) is still valid — directories still matter. LocalVector adds a layer those tools don't cover: AI answer accuracy. Most customers use both.

**Q: What if AI isn't saying anything wrong about my business?**
Then your dashboard shows "All Clear" — which is good news. But AI models update their training data constantly. A clean audit today doesn't mean you're safe next month. That's why monitoring is ongoing, not one-time.

---

### SECTION 10: Final CTA

**Background:** Warm gradient with green tint, subtle grid  
**H2 (very large, Bricolage Grotesque 800):**
```
Right now, AI is describing
your business to someone.
Is it telling the truth?
```

**Subheadline:**
Find out in 8 seconds. No account required.

[Embedded ViralScanner — second instance]

Micro-copy: Free. Instant. Real results from real AI models.

---

### SECTION 11: Footer

**Left:** LocalVector.ai logo + tagline: *"Defending the truth for local business. Built for the generative age."*

**Center links:**
Product · Pricing · Who It's For · How It Works · About · Free AI Audit

**Resources links:**
What is AEO? · What is GEO? · What is an AI Hallucination? · Blog

**Legal:**
Privacy Policy · Terms of Service · hello@localvector.ai

**Bottom bar:**
© 2026 LocalVector.ai — The AI Visibility Platform for Local Business

---

## PART 5: PRICING PAGE (`/pricing`)

### SEO Metadata
```
Title:       "Pricing — LocalVector.ai | AI Hallucination Detection for Restaurants"
Description: "Transparent pricing for AI visibility protection. Free audit, $49/month Starter, 
              $149/month AI Shield, and Agency plans. Start with a free AI hallucination scan."
Canonical:   https://localvector.ai/pricing
```

### Page Philosophy
The pricing page has ONE job: **help the right people self-select and buy — and help the wrong people politely disqualify themselves**. No tricks, no gotchas, no hidden features.

---

**Hero text:**
```
Pricing
Cheaper than one lost table.
Honest tiers that match where you are.
```

**Subheadline:**
One AI hallucination costs a restaurant owner a table. One lost table is typically $80–$140. Our monthly price is less than that. And unlike a lost customer, a subscription you can cancel.

---

**Billing toggle:** Monthly / Annual (Save 20%)

---

**Tier 1 — Free: "The Audit"**
Price: $0

Tagline: *Start here. See the damage. No commitment.*

Includes:
- One free AI hallucination scan (business name + city)
- Real-time responses from ChatGPT, Perplexity, and Gemini
- AI Mentions volume analysis
- AI Sentiment snapshot (Positive / Neutral / Negative)
- Accuracy issue highlights (1 finding, detailed)
- No account required

**Not included:** Automated monitoring, Reality Score, Competitor Intercept, Magic Menu

**Who it's for:** Any restaurant owner who wants to know what AI is saying about them before spending a dollar.

[Run Free Audit — No Account Needed →]

---

**Tier 2 — $49/month: "Starter"**
Annual: $39/month

Tagline: *Stop the bleeding. Automated protection for one location.*

Includes:
- ✅ Weekly automated AI audits (ChatGPT, Perplexity, Gemini)
- ✅ Reality Score dashboard — your AI health in one number
- ✅ Email hallucination alerts (within 24hrs of detection)
- ✅ Magic Menu — upload your menu PDF, get AI-readable JSON-LD
- ✅ llms.txt + ai-config.json generation
- ✅ Google Business Profile connection and monitoring
- ✅ NAP Sync — Big 6 listings tracker (Google, Apple, Bing, Yelp, TripAdvisor, Facebook)
- ✅ Weekly email digest
- ✅ 1 location

**Not included:** Daily scans, Competitor Intercept, Share of Voice tracking

**Who it's for:** Restaurant owners who want automated protection and immediate alerts when something goes wrong.

**ROI frame:** *One corrected hallucination pays for 3+ months of Starter.*

[Start Starter — 14 Days Free →]

---

**Tier 3 — $149/month: "AI Shield"** ★ Most Popular
Annual: $119/month

Tagline: *Go on offense. Detect problems AND take the lead from competitors.*

Everything in Starter, plus:
- ✅ **Daily** automated AI audits (vs weekly)
- ✅ Competitor Intercept — see exactly why competitors win AI recommendations
- ✅ Share of Voice tracking — your visibility vs. 3 competitors, weekly
- ✅ AI Sentiment tracking — is AI describing you as "premium" or "budget"?
- ✅ Content action recommendations — specific tasks to improve AI visibility
- ✅ Revenue Impact calculator — dollar cost of every active hallucination
- ✅ Priority email alerts (critical hallucinations flagged within 2hrs)
- ✅ 1 location

**Who it's for:** Competitive restaurant owners who want to monitor AND outperform their competition in AI results.

**ROI frame:** *Recovering from one competitor intercept — one Friday night you weren't getting — pays for 6+ months of AI Shield.*

[Get AI Shield — 14 Days Free →]

---

**Tier 4 — Agency: "Brand Fortress"**
Price: Custom (starts at $449/month)

Tagline: *For agencies and multi-location operators who manage AI presence at scale.*

Everything in AI Shield, plus:
- ✅ Up to 10 locations
- ✅ White-label reporting (your brand, your clients)
- ✅ Team seats with role-based access
- ✅ Agency dashboard — all clients in one view
- ✅ API access (REST + webhooks)
- ✅ Dedicated onboarding and account manager
- ✅ Custom AI query monitoring
- ✅ SLA guarantees
- ✅ Additional locations available (per-location pricing)

**Who it's for:** Digital marketing agencies adding AI visibility as a service line; restaurant groups with 2–10 locations; hospitality brands protecting consistency across locations.

**Agency margin:** Buy at agency rate. Bill clients at your retail rate. The Hallucination Audit alone is a proven new-client acquisition tool — agencies use it to find problems in prospect businesses and close the conversation.

[Talk to Us →]

---

**Compare All Plans Table (expandable):**
Full feature matrix with checkmarks for all 4 tiers.

---

**Pricing FAQ:**

**Q: Is there a free trial?**
Yes. All paid plans include a 14-day free trial, no credit card required. You can also run a one-time free AI audit at any time at no cost.

**Q: What happens after the free trial?**
At the end of 14 days, you'll be prompted to enter payment details to continue. If you don't, your account moves to free tier (audit access only). No charges without your explicit confirmation.

**Q: Can I change plans?**
Yes, at any time. Upgrades take effect immediately. Downgrades take effect at the next billing cycle.

**Q: What does "1 location" mean?**
One Google Business Profile / one business address. If you own two restaurants, you'd need two Starter plans or one Agency plan.

**Q: Is my business data private?**
Yes. Your business data is encrypted, never sold, and never shared with third parties. See our Privacy Policy for full details.

**Q: Do you offer refunds?**
If LocalVector detects zero hallucinations and zero issues with your AI visibility in the first 30 days, we'll refund your first month — no questions asked. We're that confident.

---

## PART 6: WHO IT'S FOR PAGE (`/for`)

### SEO Metadata
```
Title:       "Who LocalVector.ai Is For | AI Visibility for Restaurants, Medical, Home Services & More"
Description: "LocalVector.ai serves restaurants, bars, hookah lounges, medical practices, home service 
              providers, and the agencies that represent them. See if your business is a fit."
Canonical:   https://localvector.ai/for
```

### Page Structure

**Hero:**
```
Who It's For
If AI answers questions about your business —
and it's getting those answers wrong — this is for you.
```

**Body intro:**
LocalVector.ai was built for one specific type of business: any local business where an AI model's wrong answer costs real revenue. That's a broad category. Here's how it maps to specific verticals.

---

**Vertical Section 1: Restaurants & Bars**

**H3:** Restaurants, Bars & Hospitality

The original use case. The highest-risk category. AI answers more local food & drink queries than any other vertical.

**Why the risk is high:**
- "What time does X close?" — Wrong hours = lost customers that night
- "Does X have outdoor seating?" — Wrong amenity data = wrong expectations, negative reviews
- "What's on the menu at X?" — PDF menus are invisible to AI; it guesses from third-party apps
- "Is X good for a date night?" — AI sentiment shapes first impressions before a customer ever visits

**Specific features that matter most for this vertical:**
- Magic Menu (PDF → JSON-LD): Highest priority. Restaurant menus are AI's biggest blind spot.
- Competitor Intercept: "Why does AI recommend the bar down the street for 'late-night drinks'?"
- Hallucination Audit: Hours, alcohol service, vibe attributes, temporarily-closed flags

**Real example:**
*Charcoal N Chill (Alpharetta, GA) — LocalVector's founding customer — was being told by Perplexity that they were "closed on Mondays." They're open. Five Monday-night covers lost per week × $80 average = $1,600/month. Detected and corrected in 24 hours.*

**Who specifically:**
- Independent restaurants (1–3 locations)
- Hookah lounges and social clubs
- Cocktail bars and nightlife venues
- Casual dining and fast-casual
- Brunch spots and coffee houses

[Run Free Audit For Your Restaurant →]

---

**Vertical Section 2: Medical & Dental**

**H3:** Medical Practices, Dental Clinics & Healthcare

The highest-stakes vertical for AI accuracy. A wrong answer about a medical practice can have serious consequences — not just revenue loss.

**Why the risk is high:**
- "Does X accept my insurance?" — Wrong insurance data = patient shows up, gets turned away
- "Is X accepting new patients?" — Open/closed status is critical for new patient acquisition
- "What does X specialize in?" — Scope of practice hallucinations erode trust
- "What are X's hours?" — Appointment scheduling is tied directly to AI-stated availability

**Specific features for this vertical:**
- Reality Score: Especially important for medical — accuracy and trust are inseparable
- NAP Sync: Multiple directories (Healthgrades, Zocdoc, Vitals) compound the hallucination risk
- AI Sentiment: "Premium specialist" vs. "budget clinic" framing affects insurance-class patients

**Who specifically:**
- Dental practices (especially cosmetic and orthodontic)
- Primary care clinics
- Specialty practices (dermatology, optometry, chiropractic)
- Mental health providers
- Urgent care centers

---

**Vertical Section 3: Home Services**

**H3:** Home Services, Contractors & Tradespeople

The "near me" query capital. No vertical gets more AI-assisted "who should I call?" traffic.

**Why the risk is high:**
- "Is X available for emergency plumbing on weekends?" — Wrong on-call data = lost emergency job
- "Does X do HVAC installation or just repair?" — Wrong service scope loses high-ticket work
- "What are X's rates?" — Outdated pricing from old forum posts or Yelp reviews causes wrong expectations
- "Is X licensed in my state?" — Licensing data errors erode trust immediately

**Who specifically:**
- HVAC contractors
- Plumbers and electricians
- General contractors and remodelers
- Lawn care and landscaping
- Pest control and cleaning services

---

**Vertical Section 4: Professional Services**

**H3:** Lawyers, Accountants, Consultants & Professional Services

Trust is the product. AI accuracy about your credentials, specialization, and availability directly affects whether a prospect calls you.

**Why the risk is high:**
- Practice area hallucinations (AI says "family law" when you're "criminal defense")
- "Is X currently accepting clients?" — Especially important for solo practitioners
- Firm size and structure errors confuse enterprise vs. SMB prospects
- Location data errors for firms with multiple offices

**Who specifically:**
- Law firms and solo attorneys
- CPA and accounting firms
- Financial advisors
- Business consultants
- Real estate agents and brokers

---

**Vertical Section 5: Agencies**

**H3:** Digital Marketing Agencies

A different kind of customer: you're not using LocalVector for yourself — you're using it to add a new, high-margin service line and win new clients with a tool that finds real, visible problems in 8 seconds.

**The agency pitch:**
Your restaurant clients are asking "what are you doing about AI search?" You now have an answer.

Run the ViralScanner on any prospect's restaurant. Find a hallucination in 8 seconds (you likely will — 60–70% of scans find one). Show the client. Close the conversation. Then use LocalVector to fix it and monitor it indefinitely.

**The math:**
- Buy LocalVector Agency plan at $449/month (10 locations)
- Bill each client an "AI Visibility" service at $200–500/month/location
- Gross margin: 70–90%
- Single-client payback period: Week 1

**Specific agency features:**
- White-label reports under your brand
- Multi-location dashboard (all clients in one view)
- Team seats with role-based access (give account managers client-specific access)
- API access for custom integrations and reporting
- The Hallucination Audit as a standalone prospecting tool

**The agency script (use this verbatim):**
*"I ran a quick check on how AI is representing your restaurant. Did you know ChatGPT currently tells customers you're closed on Tuesdays? That's an AI hallucination. I found it in 8 seconds. I can monitor and fix these automatically as part of your existing package."*

[Explore Agency Plan →]

---

**Bottom section: "Is it right for you?" Self-qualifier**

Quick checklist:
```
LocalVector is a strong fit if:
✅ You have a Google Business Profile (even if not fully optimized)
✅ You have at least one physical location customers visit
✅ You're in a competitive market with 3+ similar businesses nearby
✅ You've ever searched for your business on ChatGPT or Perplexity
✅ You're already paying for at least one other digital marketing tool

It's probably not for you if:
❌ You're delivery-only with no dine-in (AI location accuracy matters less)
❌ You haven't claimed your Google Business Profile yet
❌ You don't believe AI is influencing customer decisions (you'll find this hard to prove to yourself without running a scan first)
```

[Run Free Audit To Find Out →]

---

## PART 7: HOW IT WORKS PAGE (`/how-it-works`)

### SEO Metadata
```
Title:       "How LocalVector.ai Works | AI Hallucination Detection for Local Business"
Description: "LocalVector.ai uses three intelligence engines to detect, analyze, and fix what AI models 
              say about your business. Here's the technical and practical explanation of how it works."
Canonical:   https://localvector.ai/how-it-works
```

### Page Structure

**Hero:**
```
How It Works
A complete loop: detect the lies,
intercept the competition, force the truth.
```

**Intro:**
Most local business tools are dashboards. You log in, see a number, wonder what it means, and log out. LocalVector is a feedback loop. It detects a specific problem. It quantifies the cost. It gives you a specific fix. It verifies the fix worked. It shows you the revenue you recovered.

Here's how each layer works.

---

**Layer 1: Ground Truth**

Before we can detect errors, we need to know what's correct. This is the step other tools skip.

When you sign up and connect your Google Business Profile, LocalVector establishes your **Ground Truth** — the verified, authoritative record of your business. Hours, address, phone, amenities, menu items, price range, cuisine type, atmosphere attributes. This is your canonical data.

Ground Truth is what we compare every AI response against. If ChatGPT says your hours are 11–10 and your Ground Truth says 12–11, that's a hallucination. Not an opinion — a measurable, verifiable error.

---

**Layer 2: The Fear Engine (Hallucination Detection)**

On a weekly schedule (daily for AI Shield customers), our system sends targeted queries to ChatGPT, Perplexity, and Google Gemini:

- "Is [business name] open right now?"
- "What are [business name]'s hours on [day]?"
- "Does [business name] serve [attribute from your data]?"
- "Is [business name] still open? I heard they might have closed."

Each response is parsed against your Ground Truth. Discrepancies are classified:

- **Critical** (wrong hours / closed status) — immediate alert, revenue impact calculated
- **High** (wrong pricing, wrong cuisine, wrong amenities) — included in weekly report
- **Medium** (sentiment drift, incomplete data) — tracked over time

Every alert includes an estimated weekly revenue impact based on your location's typical foot traffic and average ticket. Not a guess — a calculation based on your actual data.

---

**Layer 3: The Greed Engine (Competitor Intelligence)**

Once per week, we ask AI the question your customers are asking: "What's the best [your category] in [your city/neighborhood]?"

We record who AI recommends — and who it doesn't.

Then we analyze the AI responses for the winning competitors to understand what signals drove the recommendation. Review volume mentioning specific attributes. Structured menu data presence. Recent content freshness. Schema markup quality. `llms.txt` existence.

The output is a gap list: specific, ranked things your business should do to close the recommendation gap. Not "improve your online presence." Actual tasks: *"Add 'private event space' to your Google Business Profile attributes. Cloud Lounge has it; you don't. AI uses this attribute when answering 'best restaurant for corporate events.'"*

---

**Layer 4: The Magic Engine (Structured Data Generator)**

AI models cannot read PDF menus. They cannot interpret Instagram photo captions as menu data. When AI guesses at your menu, it either omits it entirely or pulls from delivery app pages that list third-party-inflated prices.

Magic Menu solves this:

1. Upload a photo or PDF of your menu
2. Our AI extracts all menu items, prices, descriptions, and categories
3. We generate `JSON-LD` structured data (Schema.org/Menu format)
4. We build an AI-readable page hosted at your subdomain
5. We generate an `llms.txt` file — the emerging standard for AI crawler control
6. We generate an `ai-config.json` — machine-readable business configuration for AI agents
7. You paste one link into your Google Business Profile
8. AI crawlers pick it up within 7–14 days

After publish, your Magic Menu page becomes the canonical source of your menu data for all AI models. When they get a question about your prices or what you serve, they read your data — not a third party's outdated guess.

---

**Layer 5: NAP Sync (Listing Foundation)**

AI accuracy starts with consistent foundational data. If your Name, Address, and Phone number are different across Google, Apple, Bing, Yelp, TripAdvisor, and Facebook — AI has conflicting data and will average or guess.

LocalVector monitors your NAP consistency across the Big 6 platforms and flags discrepancies. For critical mismatches, we provide direct-link fix instructions for each platform. We don't claim to push to directories on your behalf — we believe in transparency. You make the correction; we verify it propagated.

---

**Layer 6: Share of Voice Tracking**

Every week, we run a standardized set of 20 queries relevant to your business category and location. We track which businesses appear in AI responses — and how often. That's your Share of Voice.

Over time, you see your trajectory: are you winning more AI recommendations, or fewer? After you make a change (publish Magic Menu, get more reviews, add a new attribute), you can see if it moved your SOV.

This is the measurement layer that closes the loop: **detect → fix → verify → measure**.

---

**The Full Loop:**
```
DETECT: AI error found about [your business]
   ↓
EXPLAIN: This costs you approximately $420/week
   ↓  
GUIDE: Here are 3 specific steps to fix it
   ↓
FIX: You publish Magic Menu / update GBP / fix NAP
   ↓
VERIFY: We confirm AI has updated its response (7-14 days)
   ↓
MEASURE: Your Reality Score improves. SOV trending up.
```

**No other tool on the market completes this full loop for local businesses.**

[Start Your First AI Audit →]

---

## PART 8: ABOUT PAGE (`/about`)

### SEO Metadata
```
Title:       "About LocalVector.ai | Built by a Restaurant Owner, for Restaurant Owners"
Description: "LocalVector.ai was built by Aruna, the owner of Charcoal N Chill in Alpharetta, GA, after 
              discovering that ChatGPT was sending customers to a closed restaurant that was actually open."
Canonical:   https://localvector.ai/about
```

### Page Structure

**Hero:**
```
We didn't build LocalVector
because we thought it would be a good idea.
We built it because we had to.
```

---

**Origin Story Section:**

In 2025, Aruna — the founder of LocalVector.ai — was sitting at the bar of Charcoal N Chill, her hookah lounge and Indo-American fusion restaurant in Alpharetta, Georgia.

Monday nights had always been slower, but not this slow. She'd been losing tables for months. The reviews were strong. The food was the same. The team was the same.

On a whim, she typed into ChatGPT: *"Is Charcoal N Chill open on Mondays?"*

The response: *"Charcoal N Chill appears to be closed on Mondays."*

She was sitting in the restaurant. It was open.

She went back through reservation data. Estimated how many customers had likely asked that question, seen that answer, and gone somewhere else. The number was uncomfortable.

Aruna is a data person — she's spent 18 years as a Lead SAS Programmer and Data Manager working in public health analytics for the CDC. She knows what to do with a data problem. She built a tool to detect the issue, track it across multiple AI models, and fix it.

That internal tool — battle-tested on Charcoal N Chill as "Tenant Zero" — is now LocalVector.ai.

---

**What Makes This Different:**

*Most SaaS products are built by engineers who interview restaurant owners.*

*LocalVector was built by a restaurant owner who happens to be an engineer.*

Every feature was tested on a real business, in a real competitive market, with real revenue at stake. Charcoal N Chill still runs as LocalVector's living laboratory — every feature ships to Alpharetta first.

This means:
- The alerts are designed for someone who has 47 other things to do that day
- The fixes are designed to take under 5 minutes
- The ROI framing is designed for someone counting covers, not clicks

---

**Mission:**

LocalVector.ai exists to ensure that the AI search era is fair for independent local businesses. The businesses that can afford enterprise tools — the chains, the franchises, the venture-backed concepts — will figure out AI visibility eventually. The independent restaurant owner who runs two locations and manages payroll on a Saturday night needs the same protection, at a price that makes sense.

AI will become the primary way customers find local businesses. That's already happening. The businesses that are AI-visible in 2026 will have a durable advantage for years.

LocalVector exists to make sure that advantage isn't only available to the big guys.

---

**Charcoal N Chill:**

Charcoal N Chill is located at 11950 Jones Bridge Rd, Alpharetta, GA. 50+ premium hookah flavors, Indo-American fusion cuisine, live entertainment, and a full bar. They're open Monday through Sunday (ChatGPT now knows this). They were LocalVector's first customer. They're still the test environment for every new feature before it ships.

If you're in the Atlanta metro area and want to see the product in action on the business that inspired it, come in. Order the butter chicken. Ask the staff about the Monday night incident.

---

**The Founder:**

**Aruna Surendera Babu**

18+ years in public health data analytics. Lead SAS Programmer and Data Manager for CDC surveillance programs. Published researcher in AIDS & Behavior and AJPH. Also: restaurant owner, staffing firm founder, and serial builder of tools that solve problems she personally experienced.

LocalVector.ai is the fourth product she's built. It's the first one that started with a ChatGPT hallucination.

hello@localvector.ai

---

**Trust Signals:**

- Built on Vercel + Supabase infrastructure
- Data encrypted at rest and in transit
- SOC-2 aligned security practices
- AI responses stored with full audit trail
- Never sells or shares customer business data

---

## PART 9: AEO CONTENT PAGE — "What is AEO?" (`/what-is/aeo`)

### SEO Metadata
```
Title:       "What is Answer Engine Optimization (AEO)? | LocalVector.ai"
Description: "Answer Engine Optimization (AEO) is the practice of structuring your business content so AI 
              assistants like ChatGPT, Perplexity, and Gemini accurately recommend and describe your business. 
              Here's what it means and how it works for local businesses."
Canonical:   https://localvector.ai/what-is/aeo
H1:          "What is Answer Engine Optimization (AEO)?"
```

### JSON-LD
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is Answer Engine Optimization (AEO)?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Answer Engine Optimization (AEO) is the practice of structuring and distributing your business's digital content so that AI assistants like ChatGPT, Perplexity, and Google Gemini can accurately find, understand, and recommend your business when users ask relevant questions."
      }
    },
    {
      "@type": "Question",
      "name": "How is AEO different from SEO?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Traditional SEO optimizes for search engine ranking pages (SERPs) — getting your website to appear in Google results. AEO optimizes for AI-generated answers — ensuring that when AI is asked 'best restaurant near me' or 'is X business open?', it accurately cites your business with correct information."
      }
    }
  ]
}
```

### Content

**Definition (first paragraph — optimized for AI citation):**
**Answer Engine Optimization (AEO)** is the practice of structuring your business's digital content so that AI assistants — including ChatGPT, Perplexity, Google Gemini, and Microsoft Copilot — accurately understand, represent, and recommend your business when users ask relevant questions.

AEO emerged as a distinct discipline in 2024–2025 as AI-powered search assistants began replacing traditional search results for a growing category of queries, particularly local intent queries like "best restaurant near me," "what time does X open," and "does X have outdoor seating."

**How AEO differs from traditional SEO:**

Traditional SEO focuses on Google search rankings — getting your website to appear prominently in search results when users type a query. AEO addresses a different channel: the AI-generated answer that increasingly appears before any search results, or replaces the search entirely.

The distinction matters because these two channels use different trust signals:

- **SEO** trusts: Backlinks, domain authority, keyword density, page speed, structured data
- **AEO** trusts: Factual accuracy across multiple sources, machine-readable structured data, consistency between your official data and third-party data, recent crawl freshness

A business can rank #1 on Google and still be described inaccurately by AI — because AI is synthesizing from a different layer of data.

**The three components of AEO for local businesses:**

1. **Accuracy** — Ensuring AI has access to correct, current information about your hours, location, services, prices, and attributes. The primary mechanism: fixing incorrect data at the source (Google Business Profile, Yelp, directory listings), and publishing machine-readable data via JSON-LD schema, `llms.txt`, and structured menu data.

2. **Visibility** — Ensuring AI is aware your business exists and chooses to include it in relevant answers. The primary mechanism: Share of Voice tracking, competitive gap analysis, and targeted content that answers the questions AI uses to evaluate recommendation worthiness.

3. **Framing** — Ensuring AI describes your business accurately in terms of positioning (premium vs budget, family-friendly vs adult, romantic vs casual). The primary mechanism: Sentiment tracking, review quality monitoring, and attribute optimization.

**Why AEO matters for restaurants specifically:**

"Where should I eat tonight?" is one of the most common AI queries. When 68% of consumers use AI assistants to decide where to eat, being accurately represented in AI answers is no longer optional — it's a revenue function.

Restaurants face unique AEO challenges:
- Menu data is typically in unstructured PDF format (invisible to AI)
- Hours change seasonally and aren't always updated across all platforms
- "Vibe" and atmosphere attributes are critical for AI recommendations but rarely structured
- Price range data pulled from third-party delivery apps includes markup that distorts AI's representation of your pricing

**AEO tools and platforms:**

Most existing SEO tools — BrightLocal, Yext, Semrush — were built before AEO existed as a discipline. They manage directory listings and search rankings but do not monitor or optimize for AI answer accuracy.

LocalVector.ai was built specifically for AEO — monitoring what AI models say about your business, detecting factual errors, and providing the structured data infrastructure (Magic Menu, `llms.txt`, JSON-LD schema) that improves AI accuracy.

**Related terms:** GEO (Generative Engine Optimization), AI Hallucination, Share of Voice, llms.txt, JSON-LD Schema

[→ Run a free AEO audit for your business]
[→ What is GEO?]
[→ What is an AI Hallucination?]

---

## PART 10: AEO CONTENT PAGE — "What is GEO?" (`/what-is/geo`)

### SEO Metadata
```
Title:       "What is Generative Engine Optimization (GEO)? | LocalVector.ai"
Description: "GEO (Generative Engine Optimization) is the practice of structuring your digital presence so 
              large language models can accurately parse, cite, and recommend your business. Here's what it 
              means for local businesses."
Canonical:   https://localvector.ai/what-is/geo
H1:          "What is Generative Engine Optimization (GEO)?"
```

### Content

**Definition:**
**Generative Engine Optimization (GEO)** is the practice of structuring your business's digital presence — website content, schema markup, AI-readable files, and data consistency — so that large language models (LLMs) can accurately parse, cite, and recommend your business in AI-generated responses.

GEO emerged in 2025 as businesses realized that traditional SEO practices were insufficient to influence how AI systems represented them. While SEO focuses on Google's indexing algorithm, GEO addresses the retrieval and synthesis process that AI models use when generating answers.

**How GEO works:**

AI models generate answers by retrieving relevant information from their training data and, increasingly, from real-time retrieval-augmented generation (RAG) pipelines. GEO optimizes for both:

1. **Training data quality** — ensuring that the sources AI models learned from (websites, review platforms, news articles, directories) contain accurate, consistent information about your business

2. **Real-time retrieval** — ensuring that when AI runs a live search to supplement its answer, it finds machine-readable, structured data that it can parse and cite accurately

**The GEO toolkit for local businesses:**

- **`llms.txt`** — An emerging standard (analogous to `robots.txt` for traditional crawlers) that provides AI systems with explicit, structured information about a business: hours, menu, services, location, attributes, FAQs
- **JSON-LD Schema** — Structured data vocabulary (Schema.org) that marks up your website content in a format AI systems can reliably parse
- **`ai-config.json`** — Machine-readable business configuration for AI agents and assistants
- **Structured menu data** — Converting PDF or image menus into machine-readable format that AI can accurately cite for price and availability queries
- **NAP consistency** — Ensuring your Name, Address, and Phone are identical across all platforms AI might reference

**GEO vs SEO vs AEO:**

| Discipline | Optimizes For | Primary Mechanism | Primary Metric |
|---|---|---|---|
| SEO | Google search rankings | Keywords, backlinks, page speed | SERP position |
| AEO | AI-generated answer accuracy | Structured data, factual consistency | Citation accuracy, Share of Voice |
| GEO | AI model comprehension and retrieval | llms.txt, JSON-LD, data consistency | AI parsing accuracy, RAG citation |

In practice, AEO and GEO overlap significantly and are often used interchangeably. The distinction is one of emphasis: AEO emphasizes the answer quality and accuracy; GEO emphasizes the technical infrastructure that enables AI to understand your business.

**Why GEO is urgent in 2026:**

AI models are updated regularly. A model that accurately represented your business last month may not accurately represent it next month if its training data has drifted or if a competitor has published better-structured data that the model prefers to cite.

GEO is not a one-time project — it's an ongoing infrastructure maintenance discipline. Just as you wouldn't update your website once and assume it would rank forever, you can't publish an `llms.txt` once and assume AI visibility is permanently secured.

[→ Run a free GEO audit for your business]
[→ What is AEO?]
[→ What is an AI Hallucination?]

---

## PART 11: AEO CONTENT PAGE — "What is an AI Hallucination?" (`/what-is/ai-hallucination`)

### SEO Metadata
```
Title:       "What is an AI Hallucination? | Impact on Local Business | LocalVector.ai"
Description: "An AI hallucination is when an AI model states false information as fact. For local businesses, 
              this means AI telling customers wrong hours, wrong prices, or that you're 'permanently closed' 
              when you're not. Here's what it means and how to detect it."
Canonical:   https://localvector.ai/what-is/ai-hallucination
H1:          "What is an AI Hallucination?"
```

### Content

**Definition (optimized for AI citation):**
An **AI hallucination** is when an artificial intelligence model generates information that is factually incorrect, but presents it with the same confidence as accurate information. The term comes from the model's tendency to "fill in gaps" in its knowledge with plausible-sounding but false information.

For large language models (LLMs) like ChatGPT, Gemini, and Perplexity, hallucinations occur most commonly when the model lacks reliable data about a specific topic and extrapolates from patterns in its training data rather than verified facts.

**Why AI hallucinations affect local businesses:**

For most factual queries about well-documented topics (history, science, major public figures), AI hallucination rates are relatively low. For local business data — hours, prices, menus, services, current availability — hallucination rates are significantly higher.

Why? Because local business data:
- Changes frequently (hours, menus, prices change regularly)
- Is often inconsistent across sources (your GBP says one thing; an old Yelp review says another)
- Is frequently stored in unstructured formats AI can't parse (PDF menus, Instagram photos)
- Comes from lower-quality training sources (user reviews, cached pages, outdated directories)

**Common AI hallucinations about local businesses:**

- **Closed business error** — AI states a business is "temporarily closed" or "permanently closed" when it's actively operating
- **Wrong hours** — AI states incorrect opening or closing times based on stale or conflicting data
- **Wrong price range** — AI quotes delivery app pricing (which includes third-party markups) as the business's actual prices
- **Missing amenities** — AI omits accurate amenities ("no outdoor seating" when you have a large patio) because the attribute wasn't in its training data
- **Wrong cuisine or category** — AI misidentifies the type of business (e.g., "sports bar" instead of "hookah lounge")
- **Staff or ownership errors** — AI attributes the wrong owner or key staff to a business

**The economic impact:**

AI hallucinations about local businesses are not minor inconveniences — they're revenue events.

A customer who asks ChatGPT "is [restaurant] open tonight?" and receives "it appears to be closed" will not typically verify that answer. They'll go somewhere else. They won't call. They won't check Google. The AI answered with confidence.

Estimated impact: A single "closed" hallucination that runs for 30 days costs a typical full-service restaurant $1,400–$2,000 in lost revenue, based on average weekly covers and average ticket size. This estimate is conservative.

**How to detect AI hallucinations about your business:**

The most direct method: query the AI models yourself. Type your business name into ChatGPT, Perplexity, and Gemini and ask: "Is [business name] currently open?" "What are [business name]'s hours?" "Does [business name] serve [attribute]?"

The problem with manual checking: it's a point-in-time snapshot. AI models update constantly. A model that's accurate today may not be accurate next month. And manual checking across 5 AI models, weekly, for every question a customer might ask — is not a realistic task for a business owner.

LocalVector.ai automates this process: running standardized queries against multiple AI models weekly, comparing responses against your verified Ground Truth, and alerting you immediately when a discrepancy is detected.

**How to fix an AI hallucination:**

AI models don't have a "submit correction" button. Fixing a hallucination requires addressing the underlying data that AI is drawing from:

1. **Update your Google Business Profile** — this is the highest-trust source for AI when querying local business data
2. **Publish structured data** — JSON-LD schema and `llms.txt` give AI explicit, machine-readable information that supersedes inferred guesses
3. **Correct inconsistencies across directories** — if your Yelp listing says different hours than your GBP, AI has conflicting data and may use either
4. **Publish AI-readable menu data** — converting PDF menus to structured format prevents menu hallucinations specifically

After corrections are made, AI models typically update within 7–14 days as crawlers refresh their data.

[→ Run a free AI hallucination scan on your business]
[→ What is AEO?]
[→ What is GEO?]

---

## PART 12: SEO / AEO / GEO STRATEGY

### Keyword Architecture

**Primary keywords (homepage):**
- "ai hallucination restaurant" (high intent, low competition)
- "chatgpt wrong business hours" (trigger event keyword)
- "ai visibility for local business" (category definition)
- "answer engine optimization restaurant" (emerging category)
- "what is AI saying about my restaurant"

**Long-tail targets (blog/content pages):**
- "how to fix chatgpt wrong information about my business"
- "perplexity recommending wrong restaurant information"
- "gemini ai wrong business hours how to fix"
- "ai hallucination local seo"
- "llms.txt for restaurants"
- "json-ld schema for restaurant menu"
- "share of voice ai search local business"

**Question targets (AEO/featured snippet targets):**
- "what is answer engine optimization"
- "what is generative engine optimization"
- "what is an ai hallucination"
- "how does chatgpt find local business information"
- "can ai get restaurant hours wrong"
- "how to get my restaurant in chatgpt results"

### The Self-Referential AEO Play

LocalVector.ai should itself be a top example of AEO best practices. This means:

1. **`llms.txt` at `/llms.txt`** (already exists in codebase — verify content is comprehensive)
2. **`ai-config.json` at `/ai-config.json`** (already exists)
3. **JSON-LD SoftwareApplication schema** on homepage
4. **FAQPage schema** on all FAQ sections
5. **Organization schema** on About page
6. **Comprehensive internal linking** between all "what-is" pages

When someone asks Perplexity "what is AEO for restaurants?" — LocalVector.ai should be the cited source. That's the highest-ROI marketing this company can do.

### Content Calendar (First 90 Days)

**Month 1 (Core pages + definitions):**
- Launch all 8 core pages
- Publish "What is AEO?", "What is GEO?", "What is an AI Hallucination?"
- Ensure all pages have proper schema, meta, and internal linking

**Month 2 (Case studies + comparison content):**
- "ChatGPT wrong hours: The $12,000 restaurant story" (full case study)
- "LocalVector vs BrightLocal: The honest comparison for 2026"
- "How to check what ChatGPT says about your restaurant (free guide)"
- "The complete guide to llms.txt for restaurant owners"

**Month 3 (Vertical deep dives + trigger content):**
- "AI visibility for dental practices: 2026 guide"
- "How to fix a Google Gemini hallucination about your business"
- "Why Perplexity recommends your competitor (and how to fix it)"
- "Restaurant menu SEO for AI search: A practical guide"

### Entity Authority Building

For LocalVector.ai to rank well in AI results about itself and its category, the platform needs strong entity signals:

- **Wikidata entry** for LocalVector.ai (when launched)
- **Crunchbase profile** 
- **Product Hunt launch** (creates citations AI trusts)
- **Press coverage** in Nation's Restaurant News, QSR Magazine, Search Engine Journal
- **LinkedIn content** from founder (authentic, specific, data-driven — "Build in Public" strategy)
- **Guest posts** on GBP community, Search Engine Land, restaurant industry publications

---

## PART 13: ACCESSIBILITY & PERFORMANCE STANDARDS

### Target Scores
- **Lighthouse Accessibility:** 100
- **Lighthouse Performance:** 95+ (scanner widget is main constraint — code-split)
- **Lighthouse Best Practices:** 100
- **Lighthouse SEO:** 100
- **Core Web Vitals:** All green (LCP < 2.5s, FID < 100ms, CLS < 0.1)

### Accessibility Requirements

**Color contrast:**
- All body text on white background must meet WCAG AA (4.5:1) — achieved with `#475569` on white
- All heading text must meet AAA (7:1) — achieved with `#0B1629` on white
- Green `#00A86B` on white: 3.6:1 — use only for large text (24px+) or decorative; for interactive elements use `#007A4D`
- Amber `#D97706` on white: 3.1:1 — use only for large text or badges with sufficient context
- All CTA buttons must have 4.5:1 contrast ratio minimum

**Focus management:**
- All interactive elements must have visible focus styles (2px solid `#00A86B` outline, 2px offset)
- Tab order must follow visual reading order
- Modal/dialog components (scanner results) must trap focus
- Keyboard navigation must be complete for all interactive elements

**Semantic HTML:**
- One `<h1>` per page (the hero headline)
- Logical heading hierarchy (h1 → h2 → h3, no skipping)
- All navigation must use `<nav>` with `aria-label`
- All stats/data tables must use proper `<table>` elements with `<caption>` and `<th>` headers
- All icons used decoratively must have `aria-hidden="true"`
- All functional icons must have `aria-label` or adjacent visible text
- All images must have descriptive `alt` text (or `alt=""` if purely decorative)

**Form accessibility (Scanner widget):**
- Input field must have associated `<label>` (can be visually hidden with `sr-only` if design requires)
- Error messages must use `role="alert"` for screen reader announcement
- Success/fail results must be announced via `aria-live` region
- Loading state must be communicated via `aria-busy="true"` on the results container

**Reduced motion:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Skip navigation:**
`<a class="skip-link" href="#main-content">Skip to main content</a>` — first focusable element on every page

**ARIA landmarks:**
- `<header role="banner">`
- `<nav aria-label="Primary navigation">`
- `<main id="main-content">`
- `<footer role="contentinfo">`

### Performance Requirements

**Font loading strategy:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- Preload only above-fold font weights -->
<link rel="preload" href="bricolage-grotesque-800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="plus-jakarta-sans-400.woff2" as="font" type="font/woff2" crossorigin>
```
Use `font-display: swap` for all web fonts.

**Image optimization:**
- All images in WebP format with JPEG/PNG fallback
- `<img loading="lazy">` for all below-fold images
- All images must have explicit `width` and `height` to prevent CLS
- Use `srcset` and `sizes` for responsive images

**JavaScript strategy:**
- Scanner component: dynamic import with loading skeleton (prevents blocking above-fold paint)
- All below-fold sections: dynamic imports (already implemented in current page.tsx)
- No render-blocking scripts in `<head>` except critical CSS

**Critical CSS:**
Inline critical above-fold CSS in `<head>`. Navigation + hero section styles must be inlined.

**Caching:**
- Static assets: `Cache-Control: public, max-age=31536000, immutable`
- HTML pages: `Cache-Control: no-cache` (or short max-age with revalidation)
- API responses from scanner: Do not cache (real-time results)

---

## PART 14: IMPLEMENTATION PRIORITY ORDER

### Phase 1 — Homepage Redesign (Week 1)
Complete overhaul of homepage to light theme with new design system. Keep scanner component exactly as-is. Replace dark color system with new light tokens.

### Phase 2 — Pricing Page (Week 1)
Redesign to match new system. Update pricing to match unit economics document ($49/$149/$449).

### Phase 3 — Who It's For + How It Works (Week 2)
New pages, high SEO value, help convert consideration-stage visitors.

### Phase 4 — AEO Content Pages (Week 2-3)
Three "what-is" pages. Highest priority for AEO — these are the pages that get LocalVector cited by the AI models it's monitoring.

### Phase 5 — About Page (Week 3)
Trust builder. The founder story is uniquely compelling. Founder-market fit is a real purchase signal.

### Phase 6 — Performance & Accessibility Audit (Week 4)
Run Lighthouse against all pages. Target all 100 scores. Fix everything below 95.

---

## QUICK REFERENCE: The Honest Competitor Hierarchy

**(For use throughout all marketing copy — always factual, never fabricated)**

| When a visitor says... | Honest response |
|---|---|
| "I already use BrightLocal" | "Great — keep it. BrightLocal manages your directory listings. LocalVector monitors what AI models say about you, which is a completely different layer BrightLocal doesn't touch. Most of our customers use both." |
| "I already use Yext" | "Yext syncs your data to directories. It doesn't monitor what ChatGPT or Perplexity says about your business. Those are separate systems with different trust models." |
| "I have an SEO agency" | "Your agency is likely doing great work on Google. Ask them: 'What is ChatGPT saying about us right now?' If they don't know, that's the gap LocalVector fills." |
| "I just Google myself" | "Manual searches are snapshots. AI models update constantly — you'd need to check 5 models, 20 queries, weekly, to catch what LocalVector catches automatically." |
| "This seems expensive" | "$49/month is less than one lost table. One corrected hallucination — ChatGPT saying you're open when it thought you were closed — recovers that in one night." |

---

*End of LocalVector.ai Website Content Strategy v1.0*
*Next step: Design System component library + Homepage prototype*
