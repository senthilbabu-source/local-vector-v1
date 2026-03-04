# Manual Smoke Test Plan — LocalVector.ai

## Pre-Test Setup

- Local Supabase running on port 54321
- `.env.local` configured with required keys
- Database seeded with golden tenant (`dev@localvector.ai`)
- Run `npm run dev` and open `http://localhost:3000`

---

## 1. Authentication (5 min)

| # | Step | Expected |
|---|------|----------|
| 1 | Navigate to `/login` | Form renders (email + password fields) |
| 2 | Login with `dev@localvector.ai` | Redirects to `/dashboard` |
| 3 | Visit `/login` while logged in | Redirects to `/dashboard` |
| 4 | Click Logout (sidebar footer) | Redirects to `/login`, session cleared |
| 5 | Visit `/dashboard` after logout | Redirects to `/login` |
| 6 | Navigate to `/register` | Registration form renders |
| 7 | Try registering with existing email | Error message shown |
| 8 | Click "Forgot password?" link | `/forgot-password` form renders |

---

## 2. Sidebar & Navigation (5 min)

| # | Step | Expected |
|---|------|----------|
| 1 | Sidebar loads | 5 groups: Overview, How AI Sees You, Content, Insights, Admin |
| 2 | Overview group | Expanded by default |
| 3 | Click chevron on a group | Collapses with CSS animation |
| 4 | Reload page | Collapsed/expanded state persists (localStorage) |
| 5 | Click any nav item | Page loads, item highlighted green |
| 6 | Click locked item (e.g., "Voice Search" on trial plan) | UpgradeModal opens with required plan |
| 7 | Plan badge in footer | Shows current plan name |
| 8 | Location switcher | Hidden if 1 location, visible if multiple |

---

## 3. Dashboard Home (5 min)

| # | Step | Expected |
|---|------|----------|
| 1 | Navigate to `/dashboard` | Cards render: AI Health Score, Top Issues, metrics |
| 2 | First visit | GuidedTour tooltip appears (8 steps) |
| 3 | Click "Next" through tour | Steps advance, final step completes |
| 4 | Reload | Tour doesn't re-appear (localStorage) |
| 5 | Sample data mode (new org) | Blue "SAMPLE DATA" badges + SampleModeBanner |
| 6 | Real data mode (golden tenant) | Actual numbers, no sample badges |
| 7 | Metric card links | "View details" links navigate to correct pages |
| 8 | InfoTooltips | Hover on metric labels → popover with explanation |

---

## 4. Key Dashboard Pages (10 min)

| # | Page | What to verify |
|---|------|---------------|
| 1 | `/dashboard/share-of-voice` | SOV trend chart renders, model breakdown visible |
| 2 | `/dashboard/hallucinations` | Hallucination alerts list, correction form works |
| 3 | `/dashboard/magic-menus` | Menu upload interface, item list, distribution panel |
| 4 | `/dashboard/content-drafts` | Draft posts listed with origin tags |
| 5 | `/dashboard/content-drafts/[id]` | Draft detail view, edit form |
| 6 | `/dashboard/citations` | Platform listing status (Google, Yelp, Bing, etc.) |
| 7 | `/dashboard/compete` | Competitor cards render |
| 8 | `/dashboard/revenue-impact` | Revenue calculator with default values ($55/cover, 1800/mo) |
| 9 | `/dashboard/ai-responses` | AI Says page — what AI models say about the business |
| 10 | `/dashboard/sentiment` | Reputation analysis renders |
| 11 | `/dashboard/entity-health` | Entity data health cards |
| 12 | `/dashboard/benchmarks` | Local comparison percentiles |
| 13 | `/dashboard/crawler-analytics` | Bot visitor chart |
| 14 | `/dashboard/page-audits` | Schema/page audit results |

---

## 5. Settings Pages (5 min)

| # | Page | What to verify |
|---|------|---------------|
| 1 | `/dashboard/settings` | All sections load: account, notifications, webhooks, danger zone |
| 2 | Toggle a notification pref | Saves without error |
| 3 | `/dashboard/settings/profile` | Update display name → saves |
| 4 | `/dashboard/settings/business-info` | Hours and amenities editable |
| 5 | `/dashboard/settings/revenue` | Avg customer value + monthly covers inputs |
| 6 | `/dashboard/settings/connections` | Platform OAuth status cards |
| 7 | `/dashboard/settings/theme` | Color/logo pickers (agency plan) |
| 8 | `/dashboard/settings/domain` | Custom domain input + DNS instructions (agency) |
| 9 | `/dashboard/settings/widget` | Chat widget config + embed code (growth+) |

---

## 6. Billing (5 min)

| # | Step | Expected |
|---|------|----------|
| 1 | Navigate to `/dashboard/billing` | Current plan badge visible |
| 2 | Three tier cards | Starter, Growth (green border), Agency |
| 3 | Plan comparison table | 24 features across 4 tiers |
| 4 | Click "Upgrade" | Stripe checkout loads (or demo mode) |
| 5 | Credits section | Shows balance + reset date |
| 6 | "Manage Subscription" button | Opens Stripe Customer Portal (if active sub) |

---

## 7. Team & Invitations (3 min, agency plan)

| # | Step | Expected |
|---|------|----------|
| 1 | `/dashboard/team` | Member list with roles (owner/admin/member) |
| 2 | Invite new member | Email input + role dropdown, sends invite |
| 3 | Pending invitations table | Shows sent invites with resend/cancel |
| 4 | Seat management card | Current seats / max seats |

---

## 8. Admin Pages (5 min, requires ADMIN_EMAILS)

| # | Page | What to verify |
|---|------|---------------|
| 1 | Non-admin visits `/admin` | Redirected to `/dashboard` |
| 2 | `/admin/customers` | Org list with plan, MRR |
| 3 | `/admin/api-usage` | API call counts per org |
| 4 | `/admin/cron-health` | 26 crons listed with last run status |
| 5 | `/admin/revenue` | MRR breakdown |
| 6 | `/admin/distribution-health` | Crawl/citation funnel stats |

---

## 9. Interactive Components (5 min)

| # | Component | What to verify |
|---|-----------|---------------|
| 1 | UpgradeModal | Opens from locked nav items, shows plan + CTA |
| 2 | CookieConsentBanner | Appears on first visit, Accept/Reject dismisses |
| 3 | PositioningBanner | Shows for org < 30 days, dismissible |
| 4 | InfoTooltips | Hover 300ms on metric labels → popover |
| 5 | FirstVisitTooltip | First visit to SOV page → explanatory tooltip |

---

## 10. Mobile Responsiveness (3 min)

| # | Step | Expected |
|---|------|----------|
| 1 | Resize browser to < 1024px | Sidebar hidden |
| 2 | Click hamburger menu | Sidebar slides in |
| 3 | Click a nav item | Sidebar closes, page loads |
| 4 | View tables on mobile | Horizontal scroll works |
| 5 | View forms on mobile | Inputs stack vertically |

---

## 11. Error Handling (2 min)

| # | Step | Expected |
|---|------|----------|
| 1 | Navigate to `/dashboard/nonexistent` | 404 page renders with "Go back" link |
| 2 | Navigate to `/nonexistent` | Global 404 page |
| 3 | `/api/health` (no auth) | Returns 200 with `{ status: 'ok' }` |

---

## 12. API Health Check (2 min)

| # | Step | Expected |
|---|------|----------|
| 1 | `curl localhost:3000/api/health` | 200 OK, Supabase connected |
| 2 | Hit `/api/sov/trigger-manual` without auth | 401 Unauthorized |
| 3 | Hit cron route without CRON_SECRET | 401 Unauthorized |

---

**Total estimated time: ~55 minutes**

**Pass criteria:** All steps complete without console errors, no blank pages, no hydration mismatches, all navigation works, plan gating blocks correctly.
