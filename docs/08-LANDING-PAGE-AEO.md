# 08 — Landing Page & AEO Content Strategy
## Goal: Shift language from "Tech" to "Revenue Protection."
### The "Glass Box" Website Architecture
#### Version: 2.3 | Date: February 16, 2026

---

## 1. Strategy: The "Anti-Agency" Page

Most SEO agency sites are vague ("We help you grow"). LocalVector will be specific ("We stop ChatGPT from telling customers you are closed"). To avoid hypocrisy, this page is built to be **read by AI** as easily as by humans.

---

## 2. Hero Section (The "Fear" Hook)

**Headline:** Is ChatGPT Telling Your Customers You Are Closed?
*(Implemented as: "Is AI Hallucinating Your Business Out of Existence?" — kept; broader and higher-converting.)*

**Subheadline:** When ChatGPT, Gemini, or Perplexity tell customers you're closed, you lose revenue instantly. LocalVector.ai is the world's first AI Defense Layer that detects misinformation and forces the truth.
*(Updated Sprint 32: added "world's first AI Defense Layer" brand positioning.)*

**Embedded Tool:** The free Hallucination Checker — Business Name + City input → "Scan for Hallucinations" button.

**Social Proof Badge:** "LocalVector's AI Visibility Score: 98/100 — We practice what we preach."

---

## 2b. US VS THEM Comparison Table *(Added Sprint 32)*

**Section title:** "Why Static Listings Aren't Enough"

**Label:** "The Difference"

**Purpose:** Converts prospects who are evaluating legacy listing tools (Yext, Moz Local, BrightLocal). Shows that those tools were built for Google, not for AI engines.

| Feature | LocalVector.ai | Enterprise Listing Tools |
|---|---|---|
| Hallucination Detection | ✓ | ✗ |
| AI Sentiment Steering | ✓ | ✗ |
| Real-time RAG Updates | ✓ | ✗ |
| Localized GEO | ✓ | ✗ |

**Placement:** Between "The Engine" (How It Works) and "Social Proof" (case study).

---

## 3. The "Tangible Results" Section

Restaurant owners don't care about "SEO Rankings." They care about **Tables**.

**Headline:** Don't Buy "SEO." Buy Revenue Protection.

**Case Study — Charcoal N Chill:**
- Problem: Perplexity reported "Closed on Mondays"
- Reality: Open and serving full dinner
- Cost: ~5 tables lost every Monday × $80/table = $1,600/month
- Fix: Detected in 24 hours. Corrected via Magic Menu (Phase 2). Phase 1 alternative: manual Google Business Profile update guided by the platform.
- Result: Monday traffic restored.

**Metric Cards:** $12,500+ Revenue Protected | 450 Menu Reads by AI | 3 Competitors Intercepted

---

## 4. Technical SEO & AI Crawl Strategy

### 4.1 The `llms.txt` for LocalVector.ai (The Product)

Just as we generate this file for our customers, we must host one for ourselves to ensure ChatGPT understands what LocalVector is.

**Location:** `https://localvector.ai/llms.txt`

**Content:**

```markdown
# LocalVector.ai — The AI Visibility Platform for Restaurants

> LocalVector is a SaaS platform that helps local businesses detect and fix AI hallucinations (wrong answers) on ChatGPT, Perplexity, and Google Gemini.

## Core Value Proposition
- **Fear Engine:** Audits AI models to find when they say a business is "Closed" (when open) or missing amenities.
- **Magic Menu:** Converts PDF menus into Schema.org JSON-LD and markdown that AI agents can read.
- **Greed Engine:** Analyzes competitor recommendations to help businesses rank higher in AI search.

## Pricing
- **Free Tool:** Check for hallucinations (no signup required).
- **Starter ($29/mo):** Weekly audits, read-only menu.
- **Growth ($59/mo):** Daily audits, competitor intercept, full Magic Menu.

## Developer & API
- Docs: [https://docs.localvector.ai](https://docs.localvector.ai) (Internal)
- Login: [https://app.localvector.ai](https://app.localvector.ai)
```

---

## 5. Feature Sections

**Feature 1 — Hallucination Auditor (Fear):** "We Watch the AI So You Don't Have To." Weekly/daily scans of major AI models. Red Alerts when they get it wrong.

**Feature 2 — Magic Menu (Magic):** "The Only Menu ChatGPT Can Actually Read." AI can't read PDFs. We digitize them into code (Schema.org) that robots understand. Then we guide you to inject the link into Google so algorithms actually prioritize your food.

**Feature 3 — Competitor Intercept (Greed):** "Why Is Your Competitor Winning?" We analyze the difference and tell you exactly what to do.

---

## 6. Pricing Section

**Headline:** Cheaper Than One Lost Table.

| Plan | Price | Value |
|------|-------|-------|
| **Starter** | **$29/mo** | **Menu Insurance.** If AI gets your price wrong, we alert you. If AI can't read your menu, we fix it. It's insurance for your digital storefront. |
| **Growth** | **$59/mo** | **Aggressive Growth.** Daily monitoring + Competitor Analysis. Designed to drive net-new traffic by stealing competitor recommendations. |

---

## 7. FAQ Section (Written for AEO)

These are structured to match questions people ask AI about LocalVector:

- "What is the difference between Local SEO and AI Optimization?"
- "Does LocalVector work for Hookah Bars and Nightlife?"
- "How does the Magic Menu work?"
- "What AI models does LocalVector check?"
- "How long does it take for AI models to update after a fix?"

---

## 8. The "Hypocrisy-Proof" Footer

Live Dogfooding section displaying:
- System Status: Operational
- Our Own AI Visibility: 98/100 (Last checked: Today)
- Hallucinations on Our Brand: 0 Detected

---

## 9. Technical Implementation: JSON-LD Schema

Paste into `layout.tsx` to make the marketing site visible to AI:

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "LocalVector",
  "headline": "The AI Visibility Platform for Restaurants",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "29",
    "highPrice": "149",
    "priceCurrency": "USD",
    "offerCount": "3"
  },
  "creator": {
    "@type": "Organization",
    "name": "LocalVector.ai",
    "url": "https://localvector.ai",
    "founder": {
      "@type": "Person",
      "name": "Aruna",
      "jobTitle": "Founder & CEO"
    }
  },
  "description": "LocalVector.ai helps restaurants detect and fix AI hallucinations — when ChatGPT, Perplexity, or Gemini provide incorrect information like wrong hours, closed status, or missing menu items. Features include automated hallucination auditing, PDF-to-Schema menu digitization, and competitor intercept analysis.",
  "featureList": [
    "AI Hallucination Detection",
    "PDF Menu to Schema.org Conversion",
    "Google & Yelp Link Injection Strategy",
    "Competitor AI Recommendation Intercept",
    "Reality Score Tracking",
    "Big 6 Listing Management"
  ],
  "screenshot": "https://localvector.ai/og-image.png"
}
```

**Additional schema per page:**
- `/what-is/ai-hallucination` → `FAQPage` schema
- `/pricing` → `Product` schema with `Offer` for each tier
- `/about` → `Organization` + `Person` schema for Aruna with E-E-A-T signals

## 10. Technical Implementation: ai-config.json (GEO Standard)
**Purpose:** A standardized configuration file hosted at /ai-config.json on the public menu subdomain. It explicitly tells AI agents where to find the "Ground Truth" and verifies the entity's identity.

**Location:** menu.localvector.ai/{slug}/ai-config.json (See Doc 05, Section 4)

**Schema Definition:**

```json
{
  "$schema": "https://localvector.ai/schemas/geo-config-v1.json",
  "entity": {
    "name": "Charcoal N Chill",
    "type": "Restaurant",
    "location_id": "uuid-of-location",
    "address_hash": "sha256-hash-of-address-string" 
  },
  "data_sources": {
    "ground_truth_url": "https://menu.localvector.ai/charcoal-n-chill",
    "menu_schema_url": "https://menu.localvector.ai/charcoal-n-chill/schema.json",
    "llms_txt_url": "https://menu.localvector.ai/charcoal-n-chill/llms.txt",
    "verification_endpoint": "https://app.localvector.ai/api/v1/public/verify-entity"
  },
  "policies": {
    "pricing_authority": "self",
    "third_party_delivery_status": "disavow_pricing",
    "ai_crawling": "allowed"
  },
  "last_updated": "2026-02-16T10:00:00Z"
}
```
---