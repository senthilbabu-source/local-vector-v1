# 06 — Frontend & UX Specification

## Dashboard Layout, Component Hierarchy, and User Flows
### Version: 2.5 | Date: February 24, 2026

---

## 1. Design Principles

1. **Fear First:** The dashboard leads with what's wrong (Red Alerts), not vanity metrics.
2. **One Task per Screen:** Restaurant owners are busy. Every screen should have one clear CTA.
3. **Mobile-Aware:** Owners check this on their phone between rushes. Core views must work on 375px.
4. **Non-Technical Language:** Never say "Schema" or "JSON-LD" to the user. Say "AI-Readable Menu."

---

## 2. Application Shell

```
┌────────────────────────────────────────────────────────┐
│  Top Bar                                               │
│  [Logo] LocalVector    [Org Name ▼]    [? Help] [👤]   │
├────────────┬───────────────────────────────────────────┤
│ Sidebar    │  Main Content Area                        │
│            │                                           │
│ 📊 Dashboard│                                          │
│ 🚨 Alerts  │  (Rendered based on active sidebar item)  │
│ 🍽️ Menu    │                                           │
│ ⚔️ Compete │                                           │
│ 📍 Listings│                                           │
│ 🤖 AI Asst │                                           │
│ 💬 AI Says │                                           │
│ ⚙️ Settings│                                           │
│ 💳 Billing │                                           │
│            │                                           │
├────────────┴───────────────────────────────────────────┤
│  Footer: AI Visibility Score: 72/100 ▲ +3             │
└────────────────────────────────────────────────────────┘
```

**Sidebar Items by Plan:**

| Item | Trial | Starter | Growth | Agency |
|------|-------|---------|--------|--------|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Alerts (Fear) | ✅ (limited) | ✅ | ✅ | ✅ |
| Menu (Magic) | ❌ | 👁️ Read-Only | ✅ Full | ✅ Full |
| Compete (Greed) | ❌ | ❌ | ✅ | ✅ |
| Listings | ✅ | ✅ | ✅ | ✅ |
| 📡 Visibility (SOV) | ❌ | ✅ (read-only) | ✅ Full | ✅ Full |
| 📝 Content Drafts | ❌ | ❌ | ✅ | ✅ |
| 🤖 AI Assistant | ✅ | ✅ | ✅ | ✅ |
| 💬 AI Says | ❌ | ❌ | ✅ | ✅ |
| Settings | ✅ | ✅ | ✅ | ✅ |
| Billing | ✅ | ✅ | ✅ | ✅ |
| 🏢 Org Switcher | ❌ | ❌ | ❌ | ✅ (top bar) |

---

## 3. Dashboard Home (`/dashboard`)

### Layout

```
┌──────────────────────────────────────────┐
│  Reality Score Card                       │
│  ┌─────────┐  Score: 72/100              │
│  │  🎯 72  │  ▲ +3 from last week       │
│  │ /100    │  Components:                │
│  └─────────┘  Visibility: 65 | Accuracy: 80 | Data Health: 70 │
│  (First-time state: Visibility shows "--  Calculating..." skeleton) │
│                                          │
│  Crawl Health (Last 24h):                │
│  🤖 GPTBot: 2h ago  •  🧠 Perplexity: 5h ago  •  🔍 Google: 1d ago │
├──────────────────────────────────────────┤
│  🚨 Active Alerts (Red Alert Feed)       │
│  ┌──────────────────────────────────┐    │
│  │ 🔴 CRITICAL: ChatGPT says you    │    │
│  │    are Permanently Closed         │    │
│  │    Perplexity · Detected 3 days ago│   │
│  │    [Verify Fix]  [Dismiss]        │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │ 🟡 HIGH: Yelp hours mismatch     │    │
│  │    Google · Detected 1 week ago   │    │
│  │    [Verify Fix]  [Dismiss]        │    │
│  └──────────────────────────────────┘    │
├──────────────────────────────────────────┤
│  Quick Stats Row                         │
│  [ Hallucinations Fixed: 5 ] [ Menu Views: 450 ] [ Listings Synced: 4/7 ] │
├──────────────────────────────────────────┤
│  📈 Score History (Line Chart — 30 days)  │
│  [chart: reality_score over time]        │
└──────────────────────────────────────────┘
```

### Key Interactions

- **"Verify Fix" button:** Calls `POST /hallucinations/:id/verify`. Shows spinner, then updates status.
- **"Dismiss" button:** Opens confirmation modal, then calls `PATCH /hallucinations/:id/dismiss`.
- **Score Card click:** Expands to show component breakdown (Visibility, Accuracy, Data Health).

---

## 4. The Magic Menu Page (`/menu`)

### 4.1 Upload State (No Menu Yet)

```
┌──────────────────────────────────────────┐
│  🍽️ Your AI-Readable Menu                │
│                                          │
│  Your menu is invisible to AI right now. │
│  ChatGPT can't read PDFs or images.      │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │                                  │    │
│  │   📄 Drag & Drop PDF or Image    │    │
│  │   or [Browse Files]              │    │
│  │                                  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Max 10MB · PDF, JPG, or PNG             │
└──────────────────────────────────────────┘
```

### 4.2 Review State (OCR Complete — "Smart Review")

**Design Goal:** Review must feel like 5 seconds, not 5 minutes. The owner should approve the entire menu with one click in the happy path, and only intervene on flagged items.

**Confidence-Based Triage:**
- Items with confidence >= 0.85 → shown with ✅ (auto-approved, collapsed by default)
- Items with confidence 0.60–0.84 → shown with ⚠️ (expanded, yellow highlight, editable)
- Items with confidence < 0.60 → shown with ❌ (expanded, red highlight, MUST edit to proceed)

```
┌───────────────────────┬──────────────────────┐
│  Original (Left)       │  Extracted (Right)    │
│  [PDF/Image Preview]   │                      │
│                        │  📊 AEO Readability: 85/100 (Good)   │
│                        │  [Tips: Add 'vegan' to descriptions] │
│                        │                      │
│                        │  ✅ 38 items look good │
│                        │  [▸ Show all items]   │
│                        │                      │
│                        │  ⚠️ 3 items need review│
│                        │  ┌────────────────┐  │
│                        │  │ ⚠️ Lamb Chops   │  │
│                        │  │ $28.99 → $38.99?│  │
│                        │  │ [Keep $28.99]   │  │
│                        │  │ [Change to ] │  │
│                        │  └────────────────┘  │
│                        │  ┌────────────────┐  │
│                        │  │ ❌ Chef Special  │  │
│                        │  │ Price: ???      │  │
│                        │  │ [Enter price]│  │
│                        │  └────────────────┘  │
├────────────────────────┴──────────────────────┤
│  ☐ I certify these prices and items are       │
│    factually correct.                         │
│                                              │
│  [Publish to AI] (disabled until all ❌ fixed │
│   AND checkbox checked)                       │
└──────────────────────────────────────────────┘
```

**Fallback — Manual Entry Mode:**

If OCR confidence is below 0.40 overall (unreadable PDF, handwritten menu, heavily stylized fonts):

```
┌──────────────────────────────────────────────┐
│  ⚠️ We couldn't read this menu well enough.   │
│                                              │
│  This usually happens with handwritten or    │
│  heavily designed menus.                     │
│                                              │
│  Options:                                    │
│  [📷 Upload a clearer photo instead]          │
│  [⌨️ Enter menu items manually]               │
│  [💬 Request human-assisted digitization]     │
│                                              │
│  (Manual entry still generates full AI code) │
└──────────────────────────────────────────────┘
```

Manual entry provides a simple category → item → price form that still outputs the same JSON-LD schema. The "Magic" is the schema output, not the OCR.

### 4.3 Published State & Link Injection (The "Last Mile")

```
┌──────────────────────────────────────────┐
│  ✅ Your menu is live and AI-readable     │
│                                          │
│  Public URL: menu.localvector.ai/charcoal│
│  [📋 Copy & Inject Link]  [↗️ Open]       │
│                                          │
│  Stats: 450 page views · Last crawled by │
│  Googlebot: Feb 15 · Perplexitybot: Feb 14│
│                                          │
│  [🔄 Re-upload Menu]  [✏️ Edit Items]     │
└──────────────────────────────────────────┘
```

**Interaction: "Copy & Inject Link" Modal**
When clicked, open a modal with this specific workflow:

1.  **Headline:** "Final Step: Force AI to See This"
2.  **Instruction:** "AI crawlers look at your Google Business Profile first. You must paste this link there."
3.  **Action 1:** [Copy Link] (Copies `https://menu.localvector.ai/...`)
4.  **Action 2:** [Open Google Business Profile] (Opens `https://business.google.com`)
5.  **Confirmation:** "Did you paste the link?"
    * [ ] Yes, I pasted it.
    * [Confirm] → Calls `POST /magic-menu/:id/track-injection`.

### 4.4 Propagation Timeline (Shown on Dashboard + Menu Page After Any Fix)

**Design Goal:** Prevent the #1 support ticket: "I published my menu / fixed the hallucination but ChatGPT still says the wrong thing." This component sets expectations BEFORE the user gets frustrated.

**When shown:** After ANY action that expects AI model updates — publishing a menu, verifying a hallucination fix, updating business hours.

```
┌──────────────────────────────────────────────┐
│  📡 AI Update Status                          │
│                                              │
│  Your changes are live. AI models are now    │
│  picking up the new data.                    │
│                                              │
│  ●━━━━━━━━○─────────────○─────────────○      │
│  Published   Crawled      Indexed      Live   │
│  Feb 16 ✅   ~Feb 18      ~Feb 23     ~Mar 2  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ ℹ️ Why does this take time?             │  │
│  │                                        │  │
│  │ AI models like ChatGPT don't check     │  │
│  │ every website in real-time. They update │  │
│  │ their knowledge every 1-2 weeks.       │  │
│  │                                        │  │
│  │ Your AI-readable menu is live NOW at   │  │
│  │ your public URL. When models refresh,  │  │
│  │ they'll get the correct data.          │  │
│  │                                        │  │
│  │ We'll notify you when we detect the    │  │
│  │ update has propagated. Average: 10 days│  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [Run a fresh check now →]                   │
└──────────────────────────────────────────────┘
```

**Timeline States:**

| Stage | Icon | Estimated Time | How We Detect |
|-------|------|---------------|---------------|
| Published | ✅ Green | Instant | Menu live or fix applied |
| Crawled | 🔄 Pulsing | 1-3 days | Bot user-agent detected in page analytics |
| Indexed | ⏳ Yellow | 3-7 days | Next scheduled audit shows partial correction |
| Live in AI | ✅ Green | 7-14 days | Audit confirms AI response matches ground truth |

**Data Mapping (Frontend ↔ Schema):**
The timeline circles are rendered based on the `propagation_events` JSONB array (Doc 03):

| UI State | Logic Check |
|----------|-------------|
| **Published** | `events.some(e => e.event === 'published')` |
| **Link Injected** | `events.some(e => e.event === 'link_injected')` |
| **Crawled** | `events.some(e => e.event === 'crawled')` (from crawler logs) |
| **Live in AI** | `events.some(e => e.event === 'live_in_ai')` (from audit confirmation) |

**Proactive Email Sequence (triggered on publish/fix):**
- Day 0: "Your changes are live. Here's what happens next." (Sets expectation)
- Day 3: "AI crawlers have visited your page." (Momentum)
- Day 7: "We're running a fresh check to see if the update landed." (Progress)
- Day 14: "Update confirmed! AI now shows the correct info." OR "Still propagating — we'll keep checking." (Resolution)

---

## 5. The Competitor Intercept Page (`/compete`)

### Layout

```
┌──────────────────────────────────────────┐
│  ⚔️ Competitor Intercept                  │
│                                          │
│  Your Competitors (3/3):                 │
│  [Cloud 9 Lounge] [Blue Hookah] [+ Add] │
│                                          │
├──────────────────────────────────────────┤
│  Latest Intercepts                       │
│  ┌──────────────────────────────────┐    │
│  │ Query: "Best hookah in Alpharetta"│   │
│  │ Winner: Cloud 9 Lounge ❌         │   │
│  │                                  │    │
│  │ Why they won:                    │    │
│  │ "15 more review mentions of      │    │
│  │  'late night atmosphere'"        │    │
│  │                                  │    │
│  │ 🎯 Your Action:                   │    │
│  │ "Ask 3 customers to mention      │    │
│  │  'late night' in a review"       │    │
│  │                                  │    │
│  │ [ ✅ Mark Complete ] [ Skip ]     │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

---

## 6. Listings Page (`/listings`)

```
┌──────────────────────────────────────────┐
│  📍 Your Listings — The Big 6             │
│                                          │
│  ┌──────────┬─────────┬────────┬───────┐ │
│  │ Directory│ Status  │ Score  │Action │ │
│  ├──────────┼─────────┼────────┼───────┤ │
│  │ Google   │ ✅ Synced│  95   │ View  │ │
│  │ Yelp     │ ⚠️ Mis. │  70   │ Fix   │ │
│  │ Apple    │ ✅ Synced│  90   │ View  │ │
│  │ Facebook │ ❌ None  │  --   │Connect│ │
│  │ TripAdv. │ ✅ Synced│  85   │ View  │ │
│  │ Bing     │ ✅ Synced│  95   │ View  │ │
│  └──────────┴─────────┴────────┴───────┘ │
│                                          │
│  Overall NAP Consistency: 87/100         │
└──────────────────────────────────────────┘
```

---

## 7. Onboarding Flow (New User)

```
Step 1: Sign Up → Email/Google OAuth
↓
Step 2: Onboarding Guard (Loading State)

UI: Show "Setting up your workspace..." spinner.

Logic: Poll GET /auth/context every 1s until org_id is not null.

Why: Waits for PostgreSQL trigger to create the org.
↓
Step 2.5: Truth Calibration (The "Ground Truth" Wizard)

Headline: "Teach AI the Truth About Your Business"

Form:

Business Name & Address (Pre-filled if possible)

Amenities Check:
[ ] We serve Alcohol
[ ] We have Outdoor Seating
[ ] We take Reservations
[ ] We have Live Music

Hours: Simple M-F / Sat / Sun entry.

Action: Calls PATCH /locations/primary.

Why: Sets the baseline for the Fear Engine. If user skips "Alcohol", we can't detect "No Alcohol" hallucinations.
↓
Step 3: "Let's check your AI visibility" (auto-run first audit)

Show loading animation: "Asking ChatGPT about your business..."

Display results: Pass/Fail per model
↓
Step 4: "Upload your menu" (optional, can skip)

Drag & drop PDF
↓
Step 5: Dashboard (with first audit results populated)
```

---

## 8. SOV Dashboard (`/visibility`)

> **API:** Doc 05 §12 — SOV Engine endpoints
> **Plan Gate:** All plans can view; Growth+ can add custom queries
> **Sidebar item:** 📡 Visibility

### 8.1 Page Layout

```
┌──────────────────────────────────────────────────────┐
│  📡 Your AI Visibility                                 │
│                                                      │
│  ┌────────────────────────────┬───────────────────┐  │
│  │  SOV Score Ring            │  This Week        │  │
│  │                            │                   │  │
│  │      ┌───────┐             │  Queries Run: 13  │  │
│  │      │  18.5 │             │  Times Cited: 3   │  │
│  │      │   %   │             │  Citation Rate: 42%│  │
│  │      └───────┘             │                   │  │
│  │   ▲ +3.1 vs last week      │  [▸ View Report]  │  │
│  └────────────────────────────┴───────────────────┘  │
│                                                      │
├──────────────────────────────────────────────────────┤
│  🚀 First Mover Opportunities (2)                     │
│  ┌──────────────────────────────────────────────┐    │
│  │ 🚀 "hookah open late Alpharetta"             │    │
│  │    AI isn't recommending anyone for this.    │    │
│  │    Be the first to own it.                   │    │
│  │    [Create Content]  [Dismiss]               │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
├──────────────────────────────────────────────────────┤
│  📊 SOV Trend (8 weeks)                               │
│  [Line chart: share_of_voice over time]              │
│  [Secondary line: citation_rate]                     │
│                                                      │
├──────────────────────────────────────────────────────┤
│  🔍 Your Query Library                                │
│                                                      │
│  System queries (13)          [+ Add Custom Query]   │
│  ─────────────────────────────────────────────────── │
│  ✅ "best hookah lounge Alpharetta GA"  Last: cited   │
│  ❌ "hookah open now Alpharetta"        Last: missed  │
│  ✅ "best place for date night Alpharetta" Last: cited│
│  ❌ "bachelorette party venue Alpharetta" Last: missed│
│  [▸ Show all 13 queries]                             │
└──────────────────────────────────────────────────────┘
```

### 8.2 SOV Score Ring — `SOVScoreRing` Component

**Props:**
```typescript
interface SOVScoreRingProps {
  shareOfVoice: number | null;   // null = calculating state
  citationRate: number | null;
  weekOverWeekDelta: number | null;
  state: 'ready' | 'calculating';
}
```

**Calculating state (null shareOfVoice):**

```
┌─────────────────────────────┐
│        📡                   │
│    ┌─────────┐               │
│    │   --    │               │
│    │         │  Calculating  │
│    └─────────┘               │
│                              │
│  Your first AI visibility    │
│  scan runs Sunday at 2 AM.  │
│  Check back Monday.          │
└─────────────────────────────┘
```

**Agent Rule:** When `state === 'calculating'`, render the skeleton state above. Never render `0%` — it implies the business has zero presence, which may be false and will mislead the user before data exists.

**Rendering rules:**
- Ring color: >=40% → `--success` green, 20–39% → amber `#F59E0B`, <20% → `--destructive` red
- Delta arrow: positive → ▲ green, negative → ▼ red, zero → → gray
- `citationRate` shown as secondary metric below the ring, labeled "Citation Rate"

### 8.3 First Mover Alert Card — `FirstMoverAlertCard` Component

Renders one card per `sov_first_mover_alerts` row where `status = 'new'`.

**[Create Content] button behavior:**
1. Calls `POST /sov/alerts/:id/action` with `{ "action": "actioned" }`
2. Navigates to `/content-drafts/new?trigger=first_mover&query_id={id}` (pre-fills the new draft form — Phase 6)
3. Until Phase 6, shows modal: "Content draft created! Find it in Content Drafts → Review & Publish."

**[Dismiss] button behavior:**
1. Calls `POST /sov/alerts/:id/action` with `{ "action": "dismissed" }`
2. Card slides out with exit animation (`framer-motion` fade + slide-up)

### 8.4 Query Library Table — `SOVQueryTable` Component

Displays all `sov_target_queries` rows. Columns: Query Text | Category | Last Run | Status (Cited / Missed / Pending).

**"+ Add Custom Query" button (Growth+ only):**
- For Starter: clicking renders `<PlanGate featureId="sov_custom_queries" minPlan="growth" />`
- For Growth: opens inline add-query form:

```
┌────────────────────────────────────────────────┐
│  Add a Custom Query                             │
│                                                │
│  Query: [________________________]             │
│  Category: [Discovery ▼]                       │
│  Occasion tag (optional): [____________]       │
│                                                │
│  [Cancel]  [Add Query]                         │
│                                                │
│  5 custom queries remaining (Growth plan)      │
└────────────────────────────────────────────────┘
```

Calls `POST /sov/queries`. On `409 Conflict` (duplicate), shows inline error: "This query is already being tracked." On `422` (limit reached), shows `<PlanGate>` modal.

---

## 9. Content Draft Review UI (`/content-drafts`)

> **API:** Doc 05 §13 — Content Draft endpoints
> **Plan Gate:** View drafts on Growth+; Starter sees upgrade prompt
> **Sidebar item:** 📝 Content Drafts (with amber badge count when drafts are pending)

### 9.1 Draft List View

```
┌──────────────────────────────────────────────────────┐
│  📝 Content Drafts                                     │
│                                           [+ New Draft]│
│                                                      │
│  Pending Review (1)                                  │
│  ┌──────────────────────────────────────────────┐    │
│  │ ⚠️ Why Charcoal N Chill is Alpharetta's Best │    │
│  │    Late-Night Hookah Experience              │    │
│  │                                              │    │
│  │  Trigger: Competitor Gap (Cloud 9 Lounge)    │    │
│  │  Type: FAQ Page  •  AEO Score: 74/100        │    │
│  │  Target: "best hookah lounge Alpharetta..."  │    │
│  │  Created: Feb 23, 2026                       │    │
│  │                                              │    │
│  │  [Review & Approve]  [Reject]               │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Published (3)                [▸ Show published]     │
└──────────────────────────────────────────────────────┘
```

**Draft status badges:**
- `draft` → amber ⚠️ "Awaiting Review"
- `approved` → blue 🔵 "Approved — Ready to Publish"
- `published` → green ✅ "Published"
- `rejected` → red 🔴 "Rejected — Needs Revision"

### 9.2 Draft Detail / Review View (`/content-drafts/:id`)

```
┌──────────────────────────────────────────────────────┐
│  ← Back to Drafts                                     │
│                                                      │
│  Why Charcoal N Chill is Alpharetta's Best           │
│  Late-Night Hookah Experience                        │
│                                                      │
├──────────────────────┬───────────────────────────────┤
│  Context             │  Content                      │
│                      │                               │
│  📌 Why this draft   │  [Editable text area]         │
│  was created:        │                               │
│  Cloud 9 Lounge is   │  Looking for the best hookah │
│  winning "best       │  lounge open late in          │
│  hookah late night   │  Alpharetta? Charcoal N Chill │
│  Alpharetta" because │  stays open until 2 AM on     │
│  of 15 more review   │  weekends, featuring...       │
│  mentions of late    │                               │
│  night atmosphere.   │  [Edit ✏️] (inline toggle)   │
│                      │                               │
│  🎯 Target Prompt:   │                               │
│  "best hookah        ├───────────────────────────────┤
│  lounge Alpharetta   │  AEO Score: 74/100            │
│  late night"         │                               │
│                      │  ✅ Answer-First: 85           │
│  🏷️ Type: FAQ Page   │  ⚠️ Keyword Density: 70       │
│                      │  ⚠️ Structure: 65             │
│                      │                               │
│                      │  Tip: Add FAQ schema to push  │
│                      │  score above 80.              │
├──────────────────────┴───────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐ │
│  │ ✅ [Approve & Ready to Publish]                  │ │
│  │ ❌ [Reject — Send Back for Revision]             │ │
│  │ 📥 [Download as HTML]                           │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 9.3 Key Interactions

**[Approve & Ready to Publish]:**
1. Calls `POST /content-drafts/:id/approve`
2. Button label changes to "✅ Approved" (disabled, green)
3. "Publish" button appears:

```
┌────────────────────────────────────────────┐
│  ✅ Draft Approved — Ready to Publish       │
│                                            │
│  Publish to:                               │
│  ○ Download as HTML/Markdown               │
│  ○ Post to WordPress  [Connect WordPress]  │
│  ○ Google Business Profile post            │
│                                            │
│  [Publish Now]                             │
└────────────────────────────────────────────┘
```

Calls `POST /content-drafts/:id/publish`. On success, shows:

```
✅ Published!
View at: [https://charcoalnchill.com/alpharetta-late-night-hookah ↗]
```

**[Reject — Send Back for Revision]:**
1. Opens modal asking for rejection reason (textarea, optional)
2. Calls `POST /content-drafts/:id/reject`
3. Draft card returns to `draft` status with rejection note shown

**Inline Edit toggle:**
- Clicking [Edit ✏️] converts the content area to an editable `<textarea>`
- Auto-saves on blur via `PATCH /content-drafts/:id`
- AEO Score recalculates client-side as user types (debounced, 500ms)

### 9.4 Empty State

When no drafts exist yet (Autopilot hasn't triggered any):

```
┌─────────────────────────────────────────────┐
│                                             │
│         📝                                  │
│                                             │
│  No content drafts yet.                    │
│                                             │
│  When the Compete engine finds a gap,      │
│  or when a First Mover opportunity is      │
│  detected, AI-generated drafts will        │
│  appear here for your review.              │
│                                             │
│  Run a competitor check to generate        │
│  your first draft.                         │
│                                             │
│  [Go to Competitor Intercept →]            │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 10. Occasion Alert Feed (Seasonal Opportunities)

> **API:** Doc 05 §12 SOV alerts + Doc 16 Occasion Engine (planned)
> **Placement:** Surfaced on Dashboard home as a collapsible "Seasonal Opportunities" card, and as a dedicated tab within the `/visibility` page
> **Plan Gate:** All plans see occasion alerts; Content draft generation from alerts requires Growth+

Occasion alerts fire 28 days before peak occasions (Valentine's Day, Bachelorette season, etc.) when the tenant doesn't have content targeting the occasion's peak queries.

### 10.1 Dashboard Placement

The Occasion Alert Feed inserts below the Active Alerts section and above Quick Stats on the Dashboard home — but only when at least one occasion alert is active. It does not appear if the tenant already has published content for all upcoming occasions.

```
├──────────────────────────────────────────────────────┤
│  🗓️ Upcoming Opportunities (2)                        │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ 💕 Valentine's Day — Feb 14                  │    │
│  │    14 days away                              │    │
│  │    AI isn't citing anyone for:               │    │
│  │    • "romantic hookah dinner Alpharetta"     │    │
│  │    • "date night hookah lounge Alpharetta"   │    │
│  │                                              │    │
│  │    [Create Valentine's Page]  [Remind Later] │    │
│  └──────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────┐    │
│  │ 🎉 Bachelorette Season — peaks Apr–Jun       │    │
│  │    42 days to early peak                     │    │
│  │    AI cites competitors for:                 │    │
│  │    • "bachelorette party venue Alpharetta"   │    │
│  │      → Cloud 9 Lounge currently winning      │    │
│  │                                              │    │
│  │    [Create Bachelorette Page]  [Remind Later]│    │
│  └──────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────┤
```

### 10.2 Alert Card Anatomy

Each `OccasionAlertCard` has two modes:

**Uncontested mode** (no business cited for occasion queries — First Mover opportunity):
- Icon: 🚀 blue
- Headline: "{Occasion} — {N} days away"
- Body: "AI isn't recommending anyone for these searches. Be the first."
- Query list: bullet list of peak_query_patterns from `local_occasions`
- CTA: "Create {Occasion} Page" → triggers Autopilot draft + navigates to `/content-drafts`

**Contested mode** (competitor already winning occasion queries):
- Icon: ⚠️ amber
- Headline: "{Occasion} — {Competitor} is already winning"
- Body: "{Competitor} appears in AI answers for {query}. You can still compete."
- CTA: "Create {Occasion} Page" → same draft flow

**[Remind Later] behavior:** Snoozes the alert for 7 days. Implemented via `localStorage` key (no server call needed — snoozed state is local preference only).

### 10.3 Occasion Badge on Sidebar

When 1+ occasion alerts are active, the "📡 Visibility" sidebar item shows a seasonal indicator:

```
📡 Visibility  🗓️ 2
```

The badge clears when all active occasion alerts are actioned or dismissed.

---

## 11. Citation Gap Finder (Listings Page Enhancement)

> **API:** Doc 05 §15 — Citation Gap Intelligence endpoints
> **Placement:** New tab within the existing `/listings` page — "AI Citation Map" tab alongside the existing "Directory Status" tab
> **Plan Gate:** Growth+ only; Starter sees teaser with upgrade prompt

### 11.1 Updated Listings Page Layout

```
┌──────────────────────────────────────────────────────┐
│  📍 Your Listings                                      │
│                                                      │
│  [Directory Status]  [AI Citation Map ✨ Growth]      │
│                                                      │
│  ── Directory Status tab (existing §6 layout) ──     │
└──────────────────────────────────────────────────────┘
```

### 11.2 AI Citation Map Tab (`CitationPlatformMap` Component)

```
┌──────────────────────────────────────────────────────┐
│  [Directory Status]  [AI Citation Map ✨]             │
│                                                      │
│  Which platforms does AI cite for                    │
│  "hookah lounge" in Alpharetta, GA?                  │
│                                              Perplexity ▼│
│                                                      │
│  ┌──────────────┬────────────────┬─────────────────┐ │
│  │ Platform     │ AI Cites This  │ You're Listed?  │ │
│  ├──────────────┼────────────────┼─────────────────┤ │
│  │ 🔍 Google    │ ████████ 94%   │ ✅ Listed        │ │
│  │ ⭐ Yelp      │ ███████  87%   │ ✅ Listed        │ │
│  │ 🌍 TripAdv.  │ █████    62%   │ ❌ Not Listed    │ │
│  │              │                │ → Claim listing  │ │
│  │ 📘 Facebook  │ ████     48%   │ ✅ Listed        │ │
│  │ 🔶 Reddit    │ ███      31%   │ ❌ Not monitored │ │
│  └──────────────┴────────────────┴─────────────────┘ │
│                                                      │
│  🎯 Citation Gap Score: 68/100                        │
│                                                      │
│  Your biggest opportunity:                          │
│  TripAdvisor is cited in 62% of AI answers for      │
│  hookah lounges in Alpharetta. You're not listed.   │
│                                                      │
│  [Claim TripAdvisor Listing →]                       │
└──────────────────────────────────────────────────────┘
```

### 11.3 Component Props

```typescript
interface CitationPlatformMapProps {
  category: string;            // "hookah lounge"
  city: string;
  state: string;
  platforms: CitationPlatform[];
  gapScore: number;
  modelProvider: string;
  onModelProviderChange: (provider: string) => void;
}

interface CitationPlatform {
  platform: string;
  citationFrequency: number;   // 0-1
  orgListed: boolean;
  orgListingUrl: string | null;
  gap: boolean;
  gapAction: string | null;
}
```

### 11.4 `CitationGapBadge` on Directory Status Tab

When `gap: true` for a platform, the existing `ListingRow` component gains a `CitationGapBadge`:

```
│ TripAdvisor │ ❌ None  │  --   │ Connect │ 🎯 AI cites 62% │
```

The badge appears as a small amber pill on the right of the Action column. Clicking it switches to the AI Citation Map tab with that platform highlighted.

### 11.5 Starter Plan Teaser

On Starter plan, the "AI Citation Map" tab is visible but blurred:

```
┌──────────────────────────────────────────────────────┐
│  [Directory Status]  [AI Citation Map ✨ Growth]      │
│                                                      │
│  ╔════════════════════════════════════════════════╗  │
│  ║          [blurred platform map]                ║  │
│  ║                                                ║  │
│  ║  🔒 See which platforms AI actually cites      ║  │
│  ║     for hookah lounges in Alpharetta.          ║  │
│  ║                                                ║  │
│  ║  [Upgrade to Growth — $59/mo]                  ║  │
│  ╚════════════════════════════════════════════════╝  │
└──────────────────────────────────────────────────────┘
```

**Implementation:** Call `GET /citations/platform-map` regardless of plan. For Starter, render the `CitationPlatformMap` component with `blur-sm` + `pointer-events-none` wrapper + `<PlanGate featureId="citation_intelligence" minPlan="growth" />` overlay. This shows real data is available without unlocking it — higher conversion than hiding the tab entirely.

---

## 12. Visual Identity & Design Tokens

To ensure a "best-in-class," professional aesthetic, all components must strictly adhere to the "Deep Night & Neon Insight" palette. This creates a high-contrast, futuristic feel that signals authority to the restaurant owner.

### 12.1 The "Reality Engine" Palette
| Role | Color Name | Hex Code | Tailwind Variable |
| :--- | :--- | :--- | :--- |
| **Primary** | Electric Indigo | `#6366F1` | `--primary` |
| **Fear/Danger** | Alert Crimson | `#EF4444` | `--destructive` |
| **Truth/Success**| Truth Emerald | `#10B981` | `--success` |
| **Background** | Midnight Slate | `#0F172A` | `--background` |
| **Muted** | Cloud White | `#F8FAFC` | `--muted` |

### 12.2 Design Tokens & Constants
* **Typography:** Use **Geist Sans** for primary UI and **Geist Mono** for price/data strings.
* **Tracking:** Apply `tracking-tight` to all headings (Semi-bold weight).
* **Corner Radius:** Universal `0.75rem` (rounded-xl) for cards; `0.5rem` (rounded-lg) for buttons.
* **Borders:** Use subtle borders instead of shadows: `border-slate-200/50`.
* **Glassmorphism:** Navigation and Status bars must use `bg-white/80 backdrop-blur-md`.

### 12.3 Tabular Data Rule
All numerical displays (Reality Score, Menu Prices) MUST use `font-variant-numeric: tabular-nums` to prevent layout jumping during updates.

---

## 13. Component Library (shadcn/ui based)

| Component | Usage | shadcn Base |
|-----------|-------|-------------|
| `RealityScoreCard` | Dashboard hero metric | Card + custom gauge |
| `AlertCard` | Individual hallucination alert | Alert variant |
| `AlertFeed` | List of AlertCards | ScrollArea |
| `MenuUploader` | Drag & drop file upload | Input + DropZone |
| `MenuPreview` | Side-by-side OCR review | ResizablePanel |
| `InterceptCard` | Competitor analysis result | Card |
| `ActionTask` | Suggested task with checkbox | Checkbox + Card |
| `ListingRow` | Single directory status | TableRow |
| `ScoreChart` | 30-day trend line | Recharts LineChart |
| `PlanGate` | "Upgrade to unlock" overlay | Dialog |
| `OrgSwitcher` | Agency multi-org dropdown | Select |
| `SOVScoreRing` | SOV score + week-over-week delta | Card + custom ring |
| `SOVQueryTable` | Query library with last_cited status | Table |
| `FirstMoverAlertCard` | Uncontested prompt opportunity card | Alert variant |
| `ContentDraftCard` | Draft with AEO score + approve/reject actions | Card |
| `ContentDraftEditor` | Inline markdown editor for draft review | Textarea + Preview |
| `PageAuditRow` | Single page score with expand/collapse recs | TableRow + Collapsible |
| `CitationPlatformMap` | Platform coverage heatmap | Card grid |
| `CitationGapBadge` | Gap indicator on Listings row | Badge |
| `OccasionAlertFeed` | Seasonal opportunity alert list | ScrollArea |
| `SOVTrendChart` | 8-week SOV + citation rate line chart | Recharts LineChart |
| `MetricCard` | Single KPI with trend arrow | Card |
| `HallucinationsByModel` | Bar chart of hallucinations by AI model | Recharts BarChart |
| `CompetitorComparison` | Side-by-side gap magnitude chart | Recharts BarChart |
| `ChatMessage` | Single chat bubble (user or assistant) | Card variant |
| `ToolResultCard` | Rich UI card for AI tool results | Card |
| `ChatInput` | Message input bar with send button | Input + Button |

---

## 13.1 Critical Component: PlanGate (The Upsell Modal)

**Purpose:** Intercepts user action when they attempt to access a feature not available in their current tier.
**Visual Style:** High-blur backdrop (`backdrop-blur-xl`) with a centered, glowing pricing card.

**Props Interface:**
```typescript
interface PlanGateProps {
  featureId: 'competitor_analysis' | 'magic_menu_publish' | 'daily_audit' | 'sov_custom_queries' | 'content_drafts' | 'page_audits' | 'citation_intelligence';
  minPlan: 'starter' | 'growth' | 'agency';
  isOpen: boolean;
  onClose: () => void;
}
```

**Trigger Logic:** Any component that requires a higher plan than the user's current `org.plan` calls:
```typescript
const { org } = useAuthContext();
const canAccess = planHierarchy[org.plan] >= planHierarchy[minPlan];
if (!canAccess) return <PlanGate featureId="magic_menu_publish" minPlan="starter" isOpen={true} onClose={onClose} />;
```

**Content per `featureId`:**

| `featureId` | Headline | Body | CTA |
|---|---|---|---|
| `competitor_analysis` | "See Why They're Winning" | "Upgrade to Growth to unlock Competitor Intercept." | "Upgrade to Growth — $59/mo" |
| `magic_menu_publish` | "Make Your Menu AI-Readable" | "Upgrade to Starter to publish your Magic Menu." | "Upgrade to Starter — $29/mo" |
| `daily_audit` | "Monitor AI Every Day" | "Upgrade to Growth for daily hallucination checks." | "Upgrade to Growth — $59/mo" |
| `sov_custom_queries` | "Track More AI Queries" | "Upgrade to Growth to add custom prompts to your tracking library." | "Upgrade to Growth — $59/mo" |
| `content_drafts` | "Auto-Generate Content That Wins" | "Upgrade to Growth to unlock AI-generated content drafts." | "Upgrade to Growth — $59/mo" |
| `citation_intelligence` | "See Which Platforms AI Cites" | "Upgrade to Growth to unlock Citation Gap Finder." | "Upgrade to Growth — $59/mo" |
| `page_audits` | "Audit Your Full Website" | "Starter includes 1 homepage audit/month. Upgrade to Growth for 10 full-site audits/month." | "Upgrade to Growth — $59/mo" |

**CTA Action:** Calls `POST /billing/checkout` with the target plan, redirects to Stripe Checkout.

---

## 14. Key UI States

| State | How It Looks |
|-------|-------------|
| **Loading** | Skeleton shimmer on cards. "Checking AI models..." text. |
| **Empty (No Audits Yet)** | Illustration + "Run Your First Audit" CTA button. |
| **All Clear (No Hallucinations)** | Green banner: "All clear! No AI lies detected." |
| **Critical Alert** | Red pulsing border on AlertCard. Badge count on sidebar. |
| **Plan Upgrade Required** | Blurred content + centered "Upgrade to Growth" modal. |
| **Processing (Menu OCR)** | Progress bar + "AI is reading your menu..." |
| **Propagation Pending** | Yellow banner: "Your fix has been submitted. AI models typically update in 7–14 days." |
| **SOV Calculating** | Visibility ring shows `--` with skeleton shimmer and copy: "Calculating... results appear Monday." |
| **First Mover Alert** | Blue pulsing border on AlertCard with 🚀 icon. Badge count on sidebar Visibility item. |
| **Draft Pending Approval** | Amber badge on "Content Drafts" sidebar item. Draft card shows amber "Review" CTA. |
| **Draft Published** | Green checkmark on draft card. `published_url` shown as clickable link. |
| **AI Assistant Loading** | Pulsing dots animation in chat area while tool executes. |
| **AI Tool Result** | Rich card (ScoreCard, TrendList, AlertList, CompetitorList) rendered inline in chat. |

---

## 15. Dashboard Charts (`/dashboard`)

> **Implementation:** `app/dashboard/_components/` — 4 recharts-based components
> **Dependency:** `recharts@^2.15.3`
> **Spec:** `.cursorrules` §23

### 15.1 Chart Components

Four chart components are rendered on the Dashboard home page below the Quick Stats row. All use `recharts` and follow the design tokens in §12.

**`SOVTrendChart`** — 8-week line chart showing SOV % and citation rate over time.

```typescript
interface SOVTrendChartProps {
  data: { date: string; sov: number; citationRate: number }[];
}
```

- Primary line: `share_of_voice` in Electric Indigo (`#6366F1`)
- Secondary line: `citation_rate` in Truth Emerald (`#10B981`)
- X-axis: week labels (e.g., "Feb 9", "Feb 16")
- Y-axis: percentage (0–100%)
- Empty state: gray dashed placeholder with "No data yet — first scan runs Sunday"
- Data source: `GET /sov/report` → `trend` array

**`MetricCard`** — Single KPI display with value, label, and trend arrow.

```typescript
interface MetricCardProps {
  label: string;
  value: number | string;
  trend?: number;          // positive = up, negative = down
  format?: 'percent' | 'number' | 'score';
}
```

- Trend arrow: ▲ green for positive, ▼ red for negative, omitted if undefined
- Uses `tabular-nums` for value display (§12.3)
- Rendered in a 2x2 grid: Reality Score, SOV %, Open Hallucinations, Citation Rate

**`HallucinationsByModel`** — Horizontal bar chart of hallucination counts grouped by AI model.

```typescript
interface HallucinationsByModelProps {
  data: { model: string; count: number; severity: string }[];
}
```

- Bars colored by severity: critical → Alert Crimson, high → amber, medium → gray
- Grouped by model (Perplexity, ChatGPT, Gemini)
- Empty state: "No hallucinations detected" with checkmark
- Data source: `GET /hallucinations` → grouped client-side

**`CompetitorComparison`** — Grouped bar chart comparing your SOV vs competitors per query.

```typescript
interface CompetitorComparisonProps {
  data: { query: string; you: number; competitor: number; competitorName: string }[];
}
```

- Your bar: Electric Indigo; Competitor bar: slate-400
- Shows top 5 queries sorted by gap magnitude
- Empty state: "Add competitors to see comparison" with link to `/compete`
- Data source: `GET /competitors/intercepts` → transformed client-side

### 15.2 Chart Layout on Dashboard

Charts render in a responsive grid below the existing Quick Stats row (§3):

```
├──────────────────────────────────────────┤
│  Quick Stats Row                         │
│  [ Hallucinations Fixed: 5 ] [ ... ]    │
├──────────────────────────────────────────┤
│  ┌──────────────────┬──────────────────┐ │
│  │  MetricCard Grid │  MetricCard Grid │ │
│  │  (2x2)           │                  │ │
│  ├──────────────────┴──────────────────┤ │
│  │  SOVTrendChart (full width)         │ │
│  ├──────────────────┬──────────────────┤ │
│  │  Hallucinations  │  Competitor      │ │
│  │  ByModel         │  Comparison      │ │
│  └──────────────────┴──────────────────┘ │
├──────────────────────────────────────────┤
│  📈 Score History (existing — 30 days)    │
└──────────────────────────────────────────┘
```

### 15.3 Recharts Note

recharts logs a `defaultProps` deprecation warning with React 19. This is cosmetic, non-blocking, and will resolve in a future recharts release. Do not attempt to suppress or patch it.

---

## 16. AI Assistant Page (`/dashboard/ai-assistant`)

> **API:** Doc 05 §16.4 — AI Chat endpoint
> **Implementation:** `app/dashboard/ai-assistant/page.tsx`, `app/dashboard/ai-assistant/_components/Chat.tsx`
> **Spec:** `.cursorrules` §25
> **Sidebar item:** 🤖 AI Asst (all plans)

### 16.1 Page Structure

The AI Assistant is a full-page chat interface within the dashboard shell. It uses the `useChat()` hook from `@ai-sdk/react` connected to `POST /api/chat`.

```
┌──────────────────────────────────────────────────────┐
│  🤖 AI Assistant                                       │
│  Your AI visibility expert                            │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [Chat message area — scrollable]                    │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ 🤖 Welcome! I'm your AI visibility assistant. │    │
│  │    I can check your scores, find              │    │
│  │    hallucinations, and analyze competitors.   │    │
│  │                                              │    │
│  │    Try asking:                               │    │
│  │    • "What's my visibility score?"           │    │
│  │    • "Show me open hallucinations"           │    │
│  │    • "How am I doing vs competitors?"        │    │
│  │    • "Show my SOV trend"                     │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [Type your message...                     ] [Send]  │
└──────────────────────────────────────────────────────┘
```

### 16.2 Empty State (First Visit)

On first visit, the chat area shows the welcome message with 4 clickable starter prompts. Clicking a prompt inserts it into the input and auto-sends.

**Starter prompts:**
1. "What's my visibility score?" → triggers `getVisibilityScore` tool
2. "Show me open hallucinations" → triggers `getHallucinations` tool
3. "How am I doing vs competitors?" → triggers `getCompetitorComparison` tool
4. "Show my SOV trend" → triggers `getSOVTrend` tool

### 16.3 Message Rendering

Messages render as chat bubbles with role-based alignment:
- **User messages:** Right-aligned, Electric Indigo background (`#6366F1`), white text
- **Assistant text:** Left-aligned, Midnight Slate background (`#1E293B`), white text
- **Tool results:** Left-aligned, rendered as rich UI cards (not plain text)

The `Chat.tsx` component iterates `message.parts` and renders based on part type:
- `type: 'text'` → standard chat bubble
- `type: 'tool-invocation'` with `result` → `<ToolResultCard>` selected by `result.type`

### 16.4 Tool Result Card Types

Each tool returns a `type` field used to select the renderer:

| `result.type` | Component | Visual |
|---------------|-----------|--------|
| `visibility_score` | `ScoreCard` | Reality Score ring + SOV + Accuracy + open hallucination count |
| `sov_trend` | `TrendList` | Compact 8-week sparkline with current SOV highlighted |
| `hallucinations` | `AlertList` | Scrollable list of hallucination cards (severity badge + model + claim) |
| `competitor_comparison` | `CompetitorList` | Competitor cards with gap analysis and recommendation |

All tool result cards follow the design tokens in §12 (Midnight Slate cards, Electric Indigo accents, rounded-xl corners).

### 16.5 Loading State

While a tool is executing (between sending the request and receiving the result):
- Show pulsing dots animation (`...`) in a gray chat bubble
- Text: "Checking your data..."
- Duration is typically 1-3 seconds (Supabase queries, not LLM calls for tool execution)

### 16.6 Input Bar

- Full-width text input with placeholder: "Ask about your AI visibility..."
- Send button (arrow icon) enabled only when input is non-empty
- `Enter` key sends; `Shift+Enter` for newline
- Input clears after send
- Disabled while assistant is responding (streaming state)

### 16.7 Design Tokens (Chat-Specific)

| Element | Style |
|---------|-------|
| User bubble | `bg-indigo-500 text-white rounded-2xl rounded-br-md px-4 py-2` |
| Assistant bubble | `bg-slate-800 text-slate-100 rounded-2xl rounded-bl-md px-4 py-2` |
| Tool result card | `bg-slate-800/50 border border-slate-700 rounded-xl p-4` |
| Input bar | `bg-slate-900 border border-slate-700 rounded-xl` |
| Send button | `bg-indigo-500 hover:bg-indigo-600 rounded-lg p-2` |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.5 | 2026-02-24 | Added §15 (Dashboard Charts — 4 recharts components with layout spec). Added §16 (AI Assistant page — chat interface, tool result cards, empty state, design tokens). Updated sidebar to include AI Assistant item. Updated component library table with 7 new components (SOVTrendChart, MetricCard, HallucinationsByModel, CompetitorComparison, ChatMessage, ToolResultCard, ChatInput). Updated Key UI States with AI Assistant states. |
| 2.4 | 2026-02-23 | Added §8 (SOV Dashboard `/visibility`), §9 (Content Draft Review UI `/content-drafts`), §10 (Occasion Alert Feed), §11 (Citation Gap Finder — Listings page enhancement). Renumbered former §8–10 to §12–14. Updated sidebar table, component library, PlanGate `featureId` list, and Key UI States. |
| 2.3 | 2026-02-16 | Initial version. Design principles, shell, dashboard, magic menu, competitor intercept, listings, onboarding, visual identity, component library, key UI states. |
