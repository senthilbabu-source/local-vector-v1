# LocalVector — Pending External Dependencies

Items in this file are **blocked on an external party or decision** and cannot be self-resolved.
Each item has an owner, a trigger condition for resolution, and a status.

Update status to `RESOLVED` when complete and record the date.

---

## How to Use This File

- Add an item any time work is blocked on an external party (lawyer, accountant, vendor, regulator, customer)
- One item per row in the relevant category table
- When an item is resolved, mark it `RESOLVED` and note what was decided — do not delete it (it's a decision log)
- Reference this file at the start of every pre-launch checklist session

---

## LEGAL

| # | Item | Why It Needs a Lawyer | Priority | Status |
|---|------|-----------------------|----------|--------|
| L-1 | Confirm registered entity name is "LocalVector, Inc." — ToS and Privacy Policy use this name | Must match your actual Delaware registration exactly | Critical | OPEN |
| L-2 | Confirm Delaware is the correct jurisdiction | Correct if Delaware corp; wrong if LLC registered elsewhere | Critical | OPEN |
| L-3 | Arbitration clause enforceability review | Some states restrict mandatory arbitration for B2B; lawyer confirms Delaware choice holds | High | OPEN |
| L-4 | Class action waiver — California compliance | CA courts have specific enforceability requirements even for B2B SaaS | High | OPEN |
| L-5 | AI-generated content IP assignment (ToS §7.4) | US copyright law for AI outputs is unsettled — lawyer advises on defensibility | High | OPEN |
| L-6 | GDPR Article 27 EU Representative requirement | Required if you systematically target EU residents; lawyer confirms your exposure threshold | Medium | OPEN |
| L-7 | Standard Contractual Clauses (SCCs) version confirmation | Must reference 2021 SCCs (not the invalidated 2010 version); confirm in DPA template | Medium | OPEN |
| L-8 | Stripe Tax statement accuracy ("we collect and remit") | Legal must confirm this matches your actual Stripe Tax configuration and nexus obligations | Medium | OPEN |
| L-9 | ToS overall sign-off | Full read-through by counsel before first paying customer | Critical | OPEN |
| L-10 | Privacy Policy overall sign-off | Full read-through by counsel before first paying customer | Critical | OPEN |
| L-11 | Data Processing Agreement (DPA) template creation | Needed for any enterprise buyer or EU customer; self-serve template won't suffice | High | OPEN |
| L-12 | E&O and cyber liability insurance review | Framework §8.2 requires this; lawyer advises on appropriate coverage levels | Medium | OPEN |

---

## FINANCIAL / ACCOUNTING

| # | Item | Blocked On | Priority | Status |
|---|------|-----------|----------|--------|
| F-1 | LTV:CAC model validation | Accountant or financial advisor — confirm assumptions and calculation method | High | OPEN |
| F-2 | Sales tax nexus analysis | Tax advisor — confirm which states require collection given SaaS classification | High | OPEN |
| F-3 | Revenue recognition policy | Accountant — monthly SaaS subscriptions + seat overages + annual plans need clear policy | Medium | OPEN |
| F-4 | Pricing validation — is $49/$149/$449 right? | Pricing interviews with 10 prospects before finalizing; A/B test landing page pricing variants | High | OPEN |
| F-5 | Trial-to-paid conversion rate | Unknown until first 50 signups; current model assumes 15% — validate and adjust CAC accordingly | High | OPEN |
| F-6 | Actual COGS per Agency customer with 10 locations | Monitor first 3 Agency accounts for real AI API + infrastructure costs; model assumes $36.43/month | Medium | OPEN |
| F-7 | Annual discount impact on cash flow | Track plan mix (monthly vs annual) for first 6 months; 20% discount = revenue deferral but better cash upfront | Medium | OPEN |
| F-8 | Restaurant business closure rate in target cities | NRA industry data — model assumes 1.4%/month floor churn from closures; validate before Month 6 | Medium | OPEN |

---

## EXTERNAL VENDORS / SERVICES

| # | Item | Blocked On | Priority | Status |
|---|------|-----------|----------|--------|
| V-1 | Google Basic API Access approval (GBP API) | Google review team (~5 business days after submission) — submitted as charcoalnchill@gmail.com | Critical | OPEN |
| V-2 | Apple Business Connect API approval | Apple partner program — required before Sprint 102 (Apple BC Sync) can execute | High | OPEN |
| V-3 | Bing Places Partner API approval | Bing — required before Sprint 103 (Bing Places Sync) can execute | High | OPEN |
| V-4 | CS / helpdesk vendor selection | Recommended: Crisp (crisp.chat, $25/mo Mini plan). See docs/CS-SUPPORT.md §1 for full comparison and setup checklist. Action: create account + install Crisp widget before first paying customer. | Medium | OPEN |

---

## SECURITY

| # | Item | Blocked On | Priority | Status |
|---|------|-----------|----------|--------|
| S-1 | Third-party penetration test | Recommended vendor: Cobalt (cobalt.io, ~$1,500–$3,000). Complete Phase 1 self-assessment first (docs/SECURITY-PENTEST.md §2), then engage Cobalt T-5 weeks before broad public launch. Critical/High findings are launch blockers. | High | OPEN |

---

## REGULATORY

| # | Item | Blocked On | Priority | Status |
|---|------|-----------|----------|--------|
| R-1 | GDPR adequacy — confirm EU data residency requirements | Legal + infrastructure decision — if EU customers are targeted, Supabase region selection matters | Medium | OPEN |
| R-2 | CCPA compliance confirmation for California users | Legal sign-off that Privacy Policy §10.2 satisfies current CPRA requirements | High | OPEN |

---

## RESOLVED

| # | Item | Resolution | Resolved Date |
|---|------|-----------|---------------|
| — | — | — | — |

---

_Last updated: 2026-03-05_
_Owner: Senthilbabu_
