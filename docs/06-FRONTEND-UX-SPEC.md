# 06 — Frontend & UX Specification

## Dashboard Layout, Component Hierarchy, and User Flows
### Version: 2.3 | Date: February 16, 2026

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
- Items with confidence ≥ 0.85 → shown with ✅ (auto-approved, collapsed by default)
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

## 8. Visual Identity & Design Tokens

To ensure a "best-in-class," professional aesthetic, all components must strictly adhere to the "Deep Night & Neon Insight" palette. This creates a high-contrast, futuristic feel that signals authority to the restaurant owner.

### 8.1 The "Reality Engine" Palette
| Role | Color Name | Hex Code | Tailwind Variable |
| :--- | :--- | :--- | :--- |
| **Primary** | Electric Indigo | `#6366F1` | `--primary` |
| **Fear/Danger** | Alert Crimson | `#EF4444` | `--destructive` |
| **Truth/Success**| Truth Emerald | `#10B981` | `--success` |
| **Background** | Midnight Slate | `#0F172A` | `--background` |
| **Muted** | Cloud White | `#F8FAFC` | `--muted` |

### 8.2 Design Tokens & Constants
* **Typography:** Use **Geist Sans** for primary UI and **Geist Mono** for price/data strings.
* **Tracking:** Apply `tracking-tight` to all headings (Semi-bold weight).
* **Corner Radius:** Universal `0.75rem` (rounded-xl) for cards; `0.5rem` (rounded-lg) for buttons.
* **Borders:** Use subtle borders instead of shadows: `border-slate-200/50`.
* **Glassmorphism:** Navigation and Status bars must use `bg-white/80 backdrop-blur-md`.

### 8.3 Tabular Data Rule
All numerical displays (Reality Score, Menu Prices) MUST use `font-variant-numeric: tabular-nums` to prevent layout jumping during updates.

---

## 9. Component Library (shadcn/ui based)

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

---

## 9.1 Critical Component: PlanGate (The Upsell Modal)

**Purpose:** Intercepts user action when they attempt to access a feature not available in their current tier.
**Visual Style:** High-blur backdrop (`backdrop-blur-xl`) with a centered, glowing pricing card.

**Props Interface:**
```typescript
interface PlanGateProps {
  featureId: 'competitor_analysis' | 'magic_menu_publish' | 'daily_audit';
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

**CTA Action:** Calls `POST /billing/checkout` with the target plan, redirects to Stripe Checkout.

---

## 10. Key UI States

| State | How It Looks |
|-------|-------------|
| **Loading** | Skeleton shimmer on cards. "Checking AI models..." text. |
| **Empty (No Audits Yet)** | Illustration + "Run Your First Audit" CTA button. |
| **All Clear (No Hallucinations)** | Green banner: "All clear! No AI lies detected." |
| **Critical Alert** | Red pulsing border on AlertCard. Badge count on sidebar. |
| **Plan Upgrade Required** | Blurred content + centered "Upgrade to Growth" modal. |
| **Processing (Menu OCR)** | Progress bar + "AI is reading your menu..." |
| **Propagation Pending** | Yellow banner: "Your fix has been submitted. AI models typically update in 7–14 days." |