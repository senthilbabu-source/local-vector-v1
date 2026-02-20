# 02 — Multi-Tenant Architecture

## Platform: LocalVector.ai
## Stack: Next.js 15 (App Router) | Supabase (PostgreSQL + Auth + Edge Functions) | Vercel | Stripe
### Version: 2.3 | Date: February 16, 2026

---

## 1. Architecture Evolution

### From Single-Tenant Prototype to AI-Native Multi-Tenant SaaS

The original Charcoal N Chill prototype was a simple admin tool with a single database and no concept of "organizations":

```
charcoalnchill.com/admin/listings
│
▼
Single PostgreSQL database
├── business_info (1 row — Charcoal N Chill)
├── directories (100 rows — shared)
├── listings (per directory)
└── (no auth, no tenant isolation)
```

### Target State: Three-Layer Architecture

```
┌─────────────────────┐    ┌──────────────────────────┐
│  app.localvector.ai  │    │  menu.localvector.ai     │
│  (Dashboard Layer)   │    │  (Public Magic Layer)    │
└──────────┬──────────┘    └────────────┬─────────────┘
│                            │
└──────────┬─────────────────┘
│
┌────────────▼────────────┐
│    Next.js Middleware    │  ← Tenant Resolution + Subdomain Routing
└────────────┬────────────┘
│
┌────────────▼────────────┐
│     Supabase Auth       │  ← JWT → org_id via memberships
└────────────┬────────────┘
│
┌─────────────────▼─────────────────┐
│        PostgreSQL (Supabase)      │
│  ┌──────────┐  ┌───────────────┐  │
│  │ Core     │  │ Intelligence  │  │
│  │ Tenant   │  │ (Fear/Greed)  │  │
│  └──────────┘  └───────────────┘  │
│  ┌──────────┐  ┌───────────────┐  │
│  │ Listings │  │ Magic Menus   │  │
│  └──────────┘  └───────────────┘  │
│  ┌──────────┐                     │
│  │ AEO Data │                     │
│  └──────────┘                     │
└─────────────────┬─────────────────┘
│
┌────────────▼────────────┐
│   Cron Job Scheduler    │  ← Cost Control Layer
│   (Edge Functions)      │
└─────┬──────────┬───────┘
│          │
┌──────▼──┐  ┌───▼──────┐
│ LLM APIs│  │ External │
│ OpenAI  │  │ APIs     │
│ Pplxty  │  │ Google   │
└─────────┘  └──────────┘
```

**The Three Layers:**
1. **The Dashboard (App Layer):** Where users manage listings and view risks. Protected by auth.
2. **The Intelligence Engine (Backend):** Scheduled jobs that audit AI models (Fear) and analyze competitors (Greed). Runs asynchronously via cron.
3. **The Magic Layer (Public Edge):** A high-performance hosting layer for menus and schema that AI agents can actually read. No auth required — public by design.

---

## 2. Tenant Isolation Strategy

### Why Row-Level Security (Not Schema-Per-Tenant)

| Approach | Pros | Cons | Our Choice |
|----------|------|------|-----------|
| **Shared DB + `org_id` column** | Simple, cheap, easy migrations | Must enforce `org_id` everywhere | ✅ **Yes** |
| Schema-per-tenant | Stronger isolation | Migration nightmare at scale | ❌ |
| Database-per-tenant | Maximum isolation | Operationally complex, costly | ❌ |

### The Golden Rule

> **Every table that stores tenant data gets an `org_id UUID NOT NULL` column, a foreign key to `organizations(id)`, and a Supabase RLS policy that filters by the authenticated user's organization.**

### Table Classification

| Scoped to `org_id` (Tenant Data) | Global (Shared Reference Data) |
|----------------------------------|-------------------------------|
| `organizations` | `directories` (master list of Big 6) |
| `locations` | `subscription_plans` |
| `business_info` *(DEPRECATED — use `locations`)* | |
| `listings` | |
| `ai_audits` | |
| `ai_hallucinations` **(includes `propagation_events`)** | |
| `competitor_intercepts` | |
| `magic_menus` **(includes `propagation_events`, `llms_txt_content`)** | |
| `menu_items` | |
| **`visibility_analytics` (NEW)** | |

---

## 3. Subdomain & Routing Strategy

### Domain Architecture

| Domain | Purpose | Auth Required |
|--------|---------|---------------|
| `localvector.ai` | Marketing site + free hallucination checker | No |
| `app.localvector.ai` | Dashboard (SaaS application) | Yes (Supabase Auth) |
| `menu.localvector.ai/{location_slug}` | Public Magic Menu for a specific location | No (public) |
| **`menu.localvector.ai/{slug}/llms.txt`** | **AI Agent Profile (Markdown)** | **No (public)** |
| **`menu.localvector.ai/{slug}/ai-config.json`** | **GEO Configuration File** | **No (public)** |
| `api.localvector.ai/v1/*` | API endpoints (if separated later) | Yes (Bearer token) |

### Vercel Configuration

```
Vercel Project Settings > Domains:
  - localvector.ai          (marketing)
  - app.localvector.ai      (dashboard)  
  - *.localvector.ai        (wildcard — covers menu.localvector.ai)
```

### Next.js Middleware (Routing Logic)

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // Route: menu.localvector.ai/{location_slug} → /menus/{location_slug}
  // Logic: The slug represents a specific LOCATION (e.g. 'charcoal-alpharetta').
  // The page component at /menus/[slug] must handle the lookup.
  if (hostname.startsWith('menu.')) {
    const slug = url.pathname.split('/')[1];
    if (slug) {
      url.pathname = `/menus/${slug}`;
      return NextResponse.rewrite(url);
    }
  }

  // Route: app.localvector.ai → /dashboard/*
  if (hostname.startsWith('app.')) {
    // Auth check handled by Supabase middleware (update to match Supabase Auth helpers)
    return NextResponse.next();
  }

  // Default: marketing site
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|static|favicon.ico).*)'],
};
```
---

## 4. Authentication & Authorization

### Auth Flow
```
User Signs Up (Email/Google OAuth)
  │
  ▼
Supabase Auth creates auth.users entry
  │
  ▼
Trigger 1: handle_auth_user_created()          ← on auth.users INSERT
  │
  └── Copies row into public `users` table
      (auth_provider_id, email, full_name)
  │
  ▼
Trigger 2: handle_new_user()                   ← on public.users INSERT
  │
  ├── Creates row in `organizations` (name = user's email prefix)
  └── Creates row in `memberships` (role = 'owner')
  │
  ▼
User lands on Dashboard (Onboarding Guard Active)
  │
  ▼
Frontend checks /auth/context for org_id
  │  (Polls until trigger completes)
  ▼
Step 1: Truth Calibration Wizard
  │  (User explicitly confirms amenities & hours)
  ▼
Dashboard Loads with Valid Ground Truth
  │
  ▼
RLS policies resolve org_id via memberships table

⚠️ Race Condition Warning: Both triggers fire sequentially but asynchronously
from the client's perspective. The frontend MUST use the Onboarding Guard pattern
(Doc 06, Section 7) to poll GET /auth/context until org_id is present.
CRITICAL: Do not allow the user to proceed to "Truth Calibration" until the
org is confirmed created.

⚠️ Trigger Chain Dependency: Trigger 2 (handle_new_user) fires on public.users
INSERT, which is itself created by Trigger 1 (handle_auth_user_created) on
auth.users INSERT. If Trigger 1 fails, the entire signup chain silently breaks.
Monitor for orphaned auth.users rows with no matching public.users record.
```

### Auth Context Helper (Server-Side)

```typescript
// lib/auth.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export interface AuthContext {
  userId: string;
  orgId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  org: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    plan_status: string;
    audit_frequency: string;
    max_locations: number;
    onboarding_completed: boolean;
  };
}

export async function getAuthContext(): Promise<AuthContext> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) throw new Error('Unauthorized');

  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id, role, organizations(*)')
    .eq('user_id', user.id)
    .single();

  if (!membership) throw new Error('No organization found');

  return {
    userId: user.id,
    orgId: membership.org_id,
    role: membership.role as AuthContext['role'],
    org: membership.organizations as AuthContext['org'],
  };
}

**🤖 Agent Rule:** The `getAuthContext()` helper above is for **API routes** — it throws if no org exists. For the **dashboard page loader** and the `GET /api/v1/auth/context` endpoint (Doc 05, Section 1.1), use a non-throwing variant that returns `org_id: null` instead of throwing. This enables the Onboarding Guard polling pattern (Doc 06, Section 3).

```
### API Route Pattern (All Routes Must Follow This)

```typescript
// app/api/v1/hallucinations/route.ts
import { getAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  const auth = await getAuthContext();
  const supabase = createClient();

  // RLS handles filtering, but we add explicit org_id for defense-in-depth
  const { data, error } = await supabase
    .from('ai_hallucinations')
    .select('*')
    .eq('org_id', auth.orgId)
    .eq('correction_status', 'open')
    .order('detected_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ hallucinations: data });
}
```
---

## 5. Billing Architecture (Stripe)

### Plan Definitions

```typescript
// lib/plans.ts
export const PLANS = {
  trial: {
    name: 'Free Trial',
    priceMonthly: 0,
    stripePriceId: null,
    features: {
      auditFrequency: 'weekly',
      maxAuditsPerMonth: 4,
      magicMenu: false,
      competitorIntercept: false,
      maxLocations: 1,
      whiteLabel: false,
    },
  },
  starter: {
    name: 'Starter',
    priceMonthly: 2900, // $29.00 in cents
    stripePriceId: 'price_starter_monthly',
    features: {
      auditFrequency: 'weekly',
      maxAuditsPerMonth: 8,    // ~2 per week
      magicMenu: 'read-only',
      competitorIntercept: false,
      maxLocations: 1,
      whiteLabel: false,
    },
  },
  growth: {
    name: 'Growth',
    priceMonthly: 5900, // $59.00
    stripePriceId: 'price_growth_monthly',
    features: {
      auditFrequency: 'daily',
      maxAuditsPerMonth: 60,   // ~2 per day
      magicMenu: 'full-access',
      competitorIntercept: true,
      maxLocations: 1,
      whiteLabel: false,
    },
  },
  agency: {
    name: 'Agency',
    priceMonthly: 14900, // $149.00
    stripePriceId: 'price_agency_monthly',
    features: {
      auditFrequency: 'daily',
      maxAuditsPerMonth: 200,
      magicMenu: 'full-access',
      competitorIntercept: true,
      maxLocations: 10,
      whiteLabel: true,
    },
  },
} as const;
```

### Stripe Webhook Handler

```typescript
// app/api/webhooks/stripe/route.ts
import Stripe from 'stripe';
import { PLANS } from '@/lib/plans';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServiceRoleClient(); // Bypasses RLS

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const planKey = session.metadata?.plan as keyof typeof PLANS;
      const plan = PLANS[planKey];

      await supabase.from('organizations').update({
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plan: planKey,
        plan_status: 'active',
        audit_frequency: plan.features.auditFrequency,
        max_locations: plan.features.maxLocations,
        max_ai_audits_per_month: plan.features.maxAuditsPerMonth,
      }).eq('id', session.metadata?.org_id);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await supabase.from('organizations').update({
        plan_status: 'past_due',
      }).eq('stripe_customer_id', invoice.customer as string);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await supabase.from('organizations').update({
        plan: 'trial',
        plan_status: 'canceled',
        audit_frequency: 'weekly',
        max_locations: 1,
      }).eq('stripe_subscription_id', sub.id);
      break;
    }
  }

  return Response.json({ received: true });
}
```
---

## 6. Infrastructure & Cost Model

### Deployment Architecture

```
Vercel (Next.js 15)
├── Frontend (SSR + Client Components)
├── API Routes (/api/v1/*)
├── Cron Triggers (Vercel Cron → Supabase Edge Functions)
├── Edge Middleware (subdomain routing)
│
Supabase
├── PostgreSQL (primary database, RLS-enabled)
├── Auth (user management, JWT issuance)
├── Storage (PDF menu uploads, max 10MB per file)
├── Edge Functions (Deno — audit logic, OCR pipeline)
├── Realtime (future: live dashboard updates)
│
External APIs
├── OpenAI GPT-4o Vision (Menu OCR & structured extraction)
├── OpenAI GPT-4o-mini (Competitor analysis reasoning)
├── Perplexity Sonar API (Live web search for hallucination checks)
├── Google Places API (Ground Truth verification)
├── Resend (Transactional email — Red Alert notifications)
├── Stripe (Billing & subscription management)

```
### Cost Estimates (at ~200 customers)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Vercel Pro | $20 | Hosting, edge functions, cron |
| Supabase Pro | $25 | Database, auth, storage |
| OpenAI API | ~$100 | Menu parsing is one-time per update, not recurring |
| Perplexity API | ~$200 | Controlled by cron frequency. ~$1/user/month |
| Google Places API | $50–100 | $17 per 1,000 Place Detail calls. Includes free tool lookups + 30-day detail refresh cron (ToS compliance — see Doc 10, Section 4). |
| Resend | $20 | Transactional emails |
| Stripe | 2.9% + $0.30 | Per transaction |
| **Total Fixed** | **~$415–465** | **Before Stripe % fees** |

**Unit Economics:**
- Starter ($29/mo): API cost ~$2/mo → ~93% gross margin
- Growth ($59/mo): API cost ~$5/mo → ~91% gross margin
- **Target: >85% blended gross margin**

---

## 7. Environment Variable Manifest
**Goal:** Document the new Kill Switch variable.

```env
# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=[https://xxxx.supabase.co](https://xxxx.supabase.co)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # Server-only, never exposed to client

# === OpenAI ===
OPENAI_API_KEY=sk-...

# === Perplexity ===
PERPLEXITY_API_KEY=pplx-...

# === Google ===
GOOGLE_PLACES_API_KEY=AIza...

# === Stripe ===
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# === Resend ===
RESEND_API_KEY=re_...

# === Vercel KV (Rate Limiting) ===
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...

# === App Config ===
NEXT_PUBLIC_APP_URL=[https://app.localvector.ai](https://app.localvector.ai)
NEXT_PUBLIC_MENU_URL=[https://menu.localvector.ai](https://menu.localvector.ai)
NEXT_PUBLIC_MARKETING_URL=[https://localvector.ai](https://localvector.ai)
# Kill Switches
STOP_GOOGLE_REFRESH=false  # Set to 'true' to instantly halt Google API spending

# === AEO Configuration ===
# Controls the "Contact for Hallucinations" link in ai-config.json
NEXT_PUBLIC_AEO_REPORT_URL=[https://app.localvector.ai/report](https://app.localvector.ai/report)
```

### Test Environment Variables (`.env.test`)

```env
# Supabase Local (from `npx supabase start` output)
SUPABASE_LOCAL_URL=http://localhost:54321
SUPABASE_LOCAL_ANON_KEY=eyJ...            # Provided by supabase start
SUPABASE_LOCAL_SERVICE_ROLE_KEY=eyJ...    # Provided by supabase start

# Test User Credentials (seeded in test setup)
TEST_USER_EMAIL=test-owner@charcoalnchill.com
TEST_USER_PASSWORD=TestPassword123!
TEST_RIVAL_EMAIL=test-rival@cloud9lounge.com

# Mock API Keys (MSW intercepts these — never hit real APIs in tests)
OPENAI_API_KEY=sk-test-mock
PERPLEXITY_API_KEY=pplx-test-mock

# Stripe Test Mode
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

> **CRITICAL:** Never commit .env.test with real keys. The test suite uses MSW (Mock Service Worker) to intercept all external API calls. Real keys are only needed for the local Supabase instance.

---

## 8. Migration Path: Prototype → Multi-Tenant

| Step | Action | Validates |
|------|--------|-----------|
| 1 | Deploy Supabase with full schema from Doc 03 | Database stands up cleanly |
| 2 | Seed "Charcoal N Chill" as Golden Tenant. All JSONB fields (`hours_data`, `amenities`, `extracted_data`) must conform to the TypeScript interfaces in Doc 03, Section 15 and Doc 04, Section 2.1. | First org exists with real, schema-validated data |
| 3 | Implement auth middleware + RLS policies | Tenant isolation works |
| 4 | Build Stripe integration (test mode) | Payment flow works end-to-end |
| 5 | Configure Vercel wildcard DNS | `menu.localvector.ai` resolves |
| 6 | Build Magic Menu public renderer | AI crawlers can read schema |
| 7 | Build Fear Engine Edge Function | Hallucination detection runs on cron |
| 8 | Connect Dashboard UI to API | Users can see and act on data |

The existing Charcoal N Chill data becomes the first tenant. All existing data gets an org_id assigned to the CNC organization. Nothing breaks.
