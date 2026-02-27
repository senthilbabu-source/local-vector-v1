# Sprint 84 — Agent Readiness Score (AAO)

> **Claude Code Prompt — First-Pass Ready**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Build the **AI Agent Readiness Score** — a 0-100 score evaluating whether autonomous AI agents (OpenAI Operator, Google Jarvis, Apple Intelligence Actions) can successfully complete transactions on the business's website. This is **Assistive Agent Optimization (AAO)** — being chosen when no human is in the loop.

**Why it's a BIG WOW in 2026:** The industry is shifting from "AI recommends" to "AI acts." The next frontier isn't "does ChatGPT mention you?" — it's "can ChatGPT's booking agent actually reserve a table at your restaurant?" Nobody else has this for restaurants.

**The user sees:**
```
🤖 AI Agent Readiness Score: 42/100

✅ Structured Hours       — AI agents can check if you're open
✅ Menu Schema            — AI agents can browse your menu
❌ ReserveAction Schema   — AI agents CAN'T book a table
❌ OrderAction Schema     — AI agents CAN'T place an order
⚠️ Accessible Action CTAs — Some buttons are icon-only (not parseable)
❌ CAPTCHA-Free Flows     — Booking flow requires CAPTCHA

"3 of 6 agent capabilities are machine-accessible.
You're missing: reservation schema, ordering schema, CAPTCHA-free checkout."

[Generate ReserveAction Schema →]  [Generate OrderAction Schema →]
```

**Architecture:** Pure scoring service computes readiness from existing data (page audits, schema generator output, location details, menu presence). No new tables, no external API calls in V1. Dashboard page with score ring, capability checklist, and fix guides with schema generators.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                          — All engineering rules (§4, §20, §34.1, §39)
Read CLAUDE.md                                 — Project context + architecture
Read supabase/prod_schema.sql                  — locations, page_audits, magic_menus, location_integrations
Read lib/supabase/database.types.ts            — Full Database type (§38)
Read src/__fixtures__/golden-tenant.ts          — Golden Tenant fixtures (§4)
Read lib/schema-generator/                     — Existing schema generators (§39) — faq, hours, local-business
Read lib/data/schema-generator.ts              — Schema data layer
Read app/dashboard/page-audits/                — Page Audit page (§34.2) — schema_completeness_score reference
Read app/dashboard/entity-health/              — Entity Health page (Sprint 80) — similar score ring pattern
```

---

## 🏗️ Architecture — What to Build

### 6 Agent Capabilities (weighted)

The Agent Readiness Score evaluates 6 capabilities that determine whether an AI agent can transact with the business:

| # | Capability | Weight | What It Checks | Data Source |
|---|-----------|--------|----------------|-------------|
| 1 | **Structured Hours** | 15 pts | `OpeningHoursSpecification` schema or `hours_data` populated | `locations.hours_data` |
| 2 | **Menu Schema** | 15 pts | `Menu` + `MenuItem` JSON-LD present OR published Magic Menu | `magic_menus.is_published`, `magic_menus.json_ld_schema` |
| 3 | **ReserveAction Schema** | 25 pts | `ReserveAction` or booking URL in schema markup | `page_audits.recommendations` (schema audit) |
| 4 | **OrderAction Schema** | 25 pts | `OrderAction` or ordering URL in schema markup | `page_audits.recommendations` (schema audit) |
| 5 | **Accessible Action CTAs** | 10 pts | Action buttons have machine-parseable text labels | Inferred from page audit `entity_clarity_score` |
| 6 | **CAPTCHA-Free Flows** | 10 pts | Transactional flows completeable without human verification | Assumed `incomplete` in V1 (requires live crawl to verify) |

**Scoring: 0-100.** Each capability is `active` (full points), `partial` (50% points), or `missing` (0 points).

**Why these weights:** Actions (Reserve + Order = 50 pts total) matter most for agentic commerce. Structured data (Hours + Menu = 30 pts) enables agent comprehension. UX quality (CTAs + CAPTCHA = 20 pts) determines completion rate.

---

### Component 1: Agent Readiness Service — `lib/services/agent-readiness.service.ts`

Pure functions. No I/O.

```typescript
// ── Types ─────────────────────────────────────────────

export type CapabilityStatus = 'active' | 'partial' | 'missing';

export interface AgentCapability {
  /** Machine ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** What this enables for AI agents */
  description: string;
  /** Current status */
  status: CapabilityStatus;
  /** Max points for this capability */
  maxPoints: number;
  /** Earned points */
  earnedPoints: number;
  /** Status-specific explanation */
  statusDetail: string;
  /** Fix instructions when not fully active */
  fixGuide: string | null;
  /** Schema type to generate (if applicable) */
  schemaAction: string | null;
}

export type ReadinessLevel = 'agent_ready' | 'partially_ready' | 'not_ready';

export interface AgentReadinessResult {
  /** Overall score 0-100 */
  score: number;
  /** Readiness level */
  level: ReadinessLevel;
  /** Human-readable level label */
  levelLabel: string;
  /** Active capabilities out of total */
  activeCount: number;
  /** Total capabilities */
  totalCount: number;
  /** Individual capability assessments */
  capabilities: AgentCapability[];
  /** Top priority fix — highest-impact missing capability */
  topPriority: AgentCapability | null;
  /** Summary text */
  summary: string;
}

export interface AgentReadinessInput {
  /** Location data */
  location: {
    businessName: string;
    websiteUrl: string | null;
    hoursData: Record<string, unknown> | null;
    phone: string | null;
  };

  /** Whether a Magic Menu is published with JSON-LD */
  hasPublishedMenu: boolean;
  hasMenuJsonLd: boolean;

  /** Page audit schema data (from most recent homepage audit) */
  pageAudit: {
    schemaCompletenessScore: number | null;
    faqSchemaPresent: boolean | null;
    entityClarityScore: number | null;
    recommendations: Array<{
      title?: string;
      dimensionKey?: string;
      schemaType?: string;
    }>;
  } | null;

  /** Whether known booking/ordering URLs exist */
  hasBookingUrl: boolean;
  hasOrderingUrl: boolean;

  /** Schema types detected on the website (from page audit schema analysis) */
  detectedSchemaTypes: string[];
}

// ── Constants ─────────────────────────────────────────

const CAPABILITIES = [
  { id: 'structured_hours', name: 'Structured Hours', maxPoints: 15 },
  { id: 'menu_schema', name: 'Menu Schema', maxPoints: 15 },
  { id: 'reserve_action', name: 'ReserveAction Schema', maxPoints: 25 },
  { id: 'order_action', name: 'OrderAction Schema', maxPoints: 25 },
  { id: 'accessible_ctas', name: 'Accessible Action CTAs', maxPoints: 10 },
  { id: 'captcha_free', name: 'CAPTCHA-Free Flows', maxPoints: 10 },
] as const;

// ── Pure computation ──────────────────────────────────

/**
 * Compute Agent Readiness Score from input data.
 * Pure function — no I/O, no side effects.
 */
export function computeAgentReadiness(input: AgentReadinessInput): AgentReadinessResult {
  const capabilities: AgentCapability[] = [
    assessStructuredHours(input),
    assessMenuSchema(input),
    assessReserveAction(input),
    assessOrderAction(input),
    assessAccessibleCTAs(input),
    assessCaptchaFree(input),
  ];

  const score = capabilities.reduce((sum, c) => sum + c.earnedPoints, 0);
  const activeCount = capabilities.filter(c => c.status === 'active').length;
  const totalCount = capabilities.length;

  const level: ReadinessLevel =
    score >= 70 ? 'agent_ready' :
    score >= 40 ? 'partially_ready' :
    'not_ready';

  const levelLabel =
    level === 'agent_ready' ? 'Agent Ready' :
    level === 'partially_ready' ? 'Partially Ready' :
    'Not Ready';

  // Top priority: highest maxPoints among missing/partial capabilities
  const topPriority = capabilities
    .filter(c => c.status !== 'active')
    .sort((a, b) => b.maxPoints - a.maxPoints)[0] ?? null;

  const summary = `${activeCount} of ${totalCount} agent capabilities are machine-accessible.${
    topPriority
      ? ` Top priority: ${topPriority.name.toLowerCase()}.`
      : ' Your business is fully agent-ready!'
  }`;

  return {
    score,
    level,
    levelLabel,
    activeCount,
    totalCount,
    capabilities,
    topPriority,
    summary,
  };
}

// ── Capability assessors ──────────────────────────────

function assessStructuredHours(input: AgentReadinessInput): AgentCapability {
  const base = {
    id: 'structured_hours',
    name: 'Structured Hours',
    description: 'AI agents can check if you\'re open before recommending or booking',
    maxPoints: 15,
  };

  const hasHoursData = input.location.hoursData !== null &&
    typeof input.location.hoursData === 'object' &&
    Object.keys(input.location.hoursData).length > 0;

  const hasHoursSchema = input.detectedSchemaTypes.some(
    t => t.toLowerCase().includes('openinghours')
  );

  if (hasHoursSchema) {
    return {
      ...base,
      status: 'active',
      earnedPoints: 15,
      statusDetail: 'OpeningHoursSpecification detected in schema markup',
      fixGuide: null,
      schemaAction: null,
    };
  }

  if (hasHoursData) {
    return {
      ...base,
      status: 'partial',
      earnedPoints: 8,
      statusDetail: 'Hours data stored but not published as schema markup',
      fixGuide: 'Generate OpeningHoursSpecification JSON-LD from your stored hours and add it to your website.',
      schemaAction: 'hours',
    };
  }

  return {
    ...base,
    status: 'missing',
    earnedPoints: 0,
    statusDetail: 'No structured hours data found',
    fixGuide: 'Add your business hours in the Locations settings, then generate OpeningHoursSpecification schema.',
    schemaAction: 'hours',
  };
}

function assessMenuSchema(input: AgentReadinessInput): AgentCapability {
  const base = {
    id: 'menu_schema',
    name: 'Menu Schema',
    description: 'AI agents can browse your menu items and prices',
    maxPoints: 15,
  };

  if (input.hasMenuJsonLd) {
    return {
      ...base,
      status: 'active',
      earnedPoints: 15,
      statusDetail: 'Menu JSON-LD schema is published via Magic Menu',
      fixGuide: null,
      schemaAction: null,
    };
  }

  if (input.hasPublishedMenu) {
    return {
      ...base,
      status: 'partial',
      earnedPoints: 8,
      statusDetail: 'Magic Menu is published but JSON-LD schema needs generation',
      fixGuide: 'Generate Menu + MenuItem JSON-LD from your Magic Menu data.',
      schemaAction: 'menu',
    };
  }

  const hasMenuSchemaDetected = input.detectedSchemaTypes.some(
    t => t.toLowerCase().includes('menu')
  );
  if (hasMenuSchemaDetected) {
    return {
      ...base,
      status: 'active',
      earnedPoints: 15,
      statusDetail: 'Menu schema detected on website',
      fixGuide: null,
      schemaAction: null,
    };
  }

  return {
    ...base,
    status: 'missing',
    earnedPoints: 0,
    statusDetail: 'No menu schema found — AI agents can\'t browse your offerings',
    fixGuide: 'Upload your menu to create a Magic Menu page, then publish with JSON-LD schema.',
    schemaAction: null,
  };
}

function assessReserveAction(input: AgentReadinessInput): AgentCapability {
  const base = {
    id: 'reserve_action',
    name: 'ReserveAction Schema',
    description: 'AI booking agents can reserve a table directly',
    maxPoints: 25,
  };

  const hasReserveSchema = input.detectedSchemaTypes.some(
    t => t.toLowerCase().includes('reserveaction')
  );

  if (hasReserveSchema) {
    return {
      ...base,
      status: 'active',
      earnedPoints: 25,
      statusDetail: 'ReserveAction schema detected — AI agents can initiate reservations',
      fixGuide: null,
      schemaAction: null,
    };
  }

  if (input.hasBookingUrl) {
    return {
      ...base,
      status: 'partial',
      earnedPoints: 13,
      statusDetail: 'Booking URL exists but no ReserveAction schema markup',
      fixGuide: 'Add ReserveAction JSON-LD schema pointing to your booking URL so AI agents can find and use it programmatically.',
      schemaAction: 'reserve_action',
    };
  }

  return {
    ...base,
    status: 'missing',
    earnedPoints: 0,
    statusDetail: 'No reservation capability detected — AI booking agents will skip you',
    fixGuide: 'Set up online reservations (OpenTable, Resy, or direct) and add ReserveAction schema to your website.',
    schemaAction: 'reserve_action',
  };
}

function assessOrderAction(input: AgentReadinessInput): AgentCapability {
  const base = {
    id: 'order_action',
    name: 'OrderAction Schema',
    description: 'AI ordering agents can place food orders directly',
    maxPoints: 25,
  };

  const hasOrderSchema = input.detectedSchemaTypes.some(
    t => t.toLowerCase().includes('orderaction')
  );

  if (hasOrderSchema) {
    return {
      ...base,
      status: 'active',
      earnedPoints: 25,
      statusDetail: 'OrderAction schema detected — AI agents can initiate orders',
      fixGuide: null,
      schemaAction: null,
    };
  }

  if (input.hasOrderingUrl) {
    return {
      ...base,
      status: 'partial',
      earnedPoints: 13,
      statusDetail: 'Ordering URL exists but no OrderAction schema markup',
      fixGuide: 'Add OrderAction JSON-LD schema pointing to your ordering URL so AI agents can place orders programmatically.',
      schemaAction: 'order_action',
    };
  }

  return {
    ...base,
    status: 'missing',
    earnedPoints: 0,
    statusDetail: 'No ordering capability detected — AI food ordering agents will skip you',
    fixGuide: 'Set up online ordering (Toast, Square, DoorDash direct) and add OrderAction schema to your website.',
    schemaAction: 'order_action',
  };
}

function assessAccessibleCTAs(input: AgentReadinessInput): AgentCapability {
  const base = {
    id: 'accessible_ctas',
    name: 'Accessible Action CTAs',
    description: 'Action buttons have machine-parseable text labels (not icon-only)',
    maxPoints: 10,
  };

  // Infer from entity_clarity_score — higher score means better structured content
  const clarityScore = input.pageAudit?.entityClarityScore ?? null;

  if (clarityScore !== null && clarityScore >= 70) {
    return {
      ...base,
      status: 'active',
      earnedPoints: 10,
      statusDetail: 'Page content is well-structured and machine-parseable',
      fixGuide: null,
      schemaAction: null,
    };
  }

  if (clarityScore !== null && clarityScore >= 40) {
    return {
      ...base,
      status: 'partial',
      earnedPoints: 5,
      statusDetail: 'Some page elements may not be machine-parseable',
      fixGuide: 'Ensure all buttons and links have descriptive text labels. Replace icon-only buttons with "Book a Table", "Order Online", "Call Us" text.',
      schemaAction: null,
    };
  }

  return {
    ...base,
    status: clarityScore === null ? 'missing' : 'missing',
    earnedPoints: 0,
    statusDetail: clarityScore === null
      ? 'No page audit data — run a page audit to assess'
      : 'Page content has low machine-parseability',
    fixGuide: 'Run a page audit, then ensure all action buttons have descriptive text labels that AI agents can parse.',
    schemaAction: null,
  };
}

function assessCaptchaFree(input: AgentReadinessInput): AgentCapability {
  const base = {
    id: 'captcha_free',
    name: 'CAPTCHA-Free Flows',
    description: 'Transactional flows completeable without human verification',
    maxPoints: 10,
  };

  // V1: Cannot determine remotely. Mark as 'partial' with advisory.
  // Future sprint: Live page crawl to detect CAPTCHA elements.
  return {
    ...base,
    status: 'partial',
    earnedPoints: 5,
    statusDetail: 'Unable to verify remotely — check your booking/ordering flows manually',
    fixGuide: 'AI agents cannot solve CAPTCHAs. If your reservation or ordering flow uses CAPTCHA, consider rate-limiting or bot detection that doesn\'t block legitimate AI agents.',
    schemaAction: null,
  };
}
```

---

### Component 2: Schema Generators for Actions — `lib/schema-generator/action-schema.ts`

New pure schema generators for `ReserveAction` and `OrderAction` JSON-LD. Follows §39 — pure functions only.

```typescript
/**
 * Sprint 84 — Action schema generators for AI agent readiness.
 * Pure functions (§39) — no I/O, no side effects.
 */

export interface ActionSchemaInput {
  businessName: string;
  websiteUrl: string;
  phone: string | null;
  address: {
    streetAddress: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

/**
 * Generate ReserveAction JSON-LD for restaurant reservations.
 * Links to the business's booking URL so AI agents can initiate reservations.
 */
export function generateReserveActionSchema(
  input: ActionSchemaInput,
  bookingUrl: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: input.businessName,
    url: input.websiteUrl,
    telephone: input.phone ?? undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: input.address.streetAddress,
      addressLocality: input.address.city,
      addressRegion: input.address.state,
      postalCode: input.address.zip,
      addressCountry: input.address.country,
    },
    potentialAction: {
      '@type': 'ReserveAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: bookingUrl,
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      result: {
        '@type': 'Reservation',
        name: `Reservation at ${input.businessName}`,
      },
    },
  };
}

/**
 * Generate OrderAction JSON-LD for online food ordering.
 * Links to the business's ordering URL so AI agents can place orders.
 */
export function generateOrderActionSchema(
  input: ActionSchemaInput,
  orderingUrl: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: input.businessName,
    url: input.websiteUrl,
    telephone: input.phone ?? undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: input.address.streetAddress,
      addressLocality: input.address.city,
      addressRegion: input.address.state,
      postalCode: input.address.zip,
      addressCountry: input.address.country,
    },
    potentialAction: {
      '@type': 'OrderAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: orderingUrl,
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      deliveryMethod: [
        'http://purl.org/goodrelations/v1#DeliveryModePickUp',
        'http://purl.org/goodrelations/v1#DeliveryModeOwnFleet',
      ],
    },
  };
}
```

---

### Component 3: Data Fetcher — `lib/data/agent-readiness.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  computeAgentReadiness,
  type AgentReadinessInput,
  type AgentReadinessResult,
} from '@/lib/services/agent-readiness.service';

/**
 * Fetch agent readiness data and compute the score.
 */
export async function fetchAgentReadiness(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
): Promise<AgentReadinessResult> {
  const [locationResult, menuResult, pageAuditResult] = await Promise.all([
    // Location details
    supabase
      .from('locations')
      .select('business_name, website_url, hours_data, phone, attributes')
      .eq('id', locationId)
      .eq('org_id', orgId)
      .single(),

    // Latest published Magic Menu
    supabase
      .from('magic_menus')
      .select('id, is_published, json_ld_schema')
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Most recent homepage page audit
    supabase
      .from('page_audits')
      .select('schema_completeness_score, faq_schema_present, entity_clarity_score, recommendations')
      .eq('org_id', orgId)
      .eq('page_type', 'homepage')
      .order('last_audited_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const location = locationResult.data;
  const menu = menuResult.data;
  const audit = pageAuditResult.data;

  // Extract detected schema types from page audit recommendations
  const recommendations = (audit?.recommendations as Array<{
    title?: string;
    dimensionKey?: string;
    schemaType?: string;
  }>) ?? [];

  // Infer detected schema types from schema_completeness_score and recommendations
  // High schema score + specific recommendation schemaTypes indicate presence
  const detectedSchemaTypes = extractDetectedSchemaTypes(
    audit?.schema_completeness_score ?? null,
    recommendations,
    location?.attributes as Record<string, unknown> | null,
  );

  // Check for booking/ordering URLs in location attributes or website
  const attributes = (location?.attributes ?? {}) as Record<string, unknown>;
  const hasBookingUrl = !!(
    attributes.reservation_url ||
    attributes.booking_url ||
    attributes.opentable_url
  );
  const hasOrderingUrl = !!(
    attributes.ordering_url ||
    attributes.order_url ||
    attributes.doordash_url ||
    attributes.uber_eats_url
  );

  const input: AgentReadinessInput = {
    location: {
      businessName: location?.business_name ?? 'Unknown',
      websiteUrl: location?.website_url ?? null,
      hoursData: location?.hours_data as Record<string, unknown> | null,
      phone: location?.phone ?? null,
    },
    hasPublishedMenu: menu?.is_published === true,
    hasMenuJsonLd: menu?.json_ld_schema !== null && menu?.json_ld_schema !== undefined,
    pageAudit: audit ? {
      schemaCompletenessScore: audit.schema_completeness_score,
      faqSchemaPresent: audit.faq_schema_present,
      entityClarityScore: audit.entity_clarity_score,
      recommendations,
    } : null,
    hasBookingUrl,
    hasOrderingUrl,
    detectedSchemaTypes,
  };

  return computeAgentReadiness(input);
}

/**
 * Infer which schema types are present from audit data.
 * In V1 this is heuristic-based. Future: live schema crawl.
 */
function extractDetectedSchemaTypes(
  schemaScore: number | null,
  recommendations: Array<{ schemaType?: string }>,
  attributes: Record<string, unknown> | null,
): string[] {
  const types: string[] = [];

  // If schema score is high, likely has basic schemas
  if (schemaScore !== null && schemaScore >= 60) {
    types.push('LocalBusiness');
  }

  // Schema types mentioned in recommendations as "missing" → NOT present
  // Schema types NOT mentioned as missing + high score → likely present
  const missingSchemaTypes = recommendations
    .filter(r => r.schemaType)
    .map(r => r.schemaType!.toLowerCase());

  // If hours recommendations not flagged AND hours data exists → likely has OpeningHours
  if (!missingSchemaTypes.includes('openinghoursspecification') && schemaScore !== null && schemaScore >= 50) {
    types.push('OpeningHoursSpecification');
  }

  // Check attributes for booking/ordering schema signals
  if (attributes?.has_reserve_action === true) types.push('ReserveAction');
  if (attributes?.has_order_action === true) types.push('OrderAction');

  return types;
}
```

---

### Component 4: Dashboard Page — `app/dashboard/agent-readiness/page.tsx`

Server Component.

```
Page Layout:
┌──────────────────────────────────────────────────────┐
│ 🤖 AI Agent Readiness                               │
│ Can AI agents transact with your business?           │
├──────────────────────────────────────────────────────┤
│                                                      │
│ ┌─── Score Ring ─────────────────────────────────┐   │
│ │           ┌───────┐                             │   │
│ │           │  42   │   Partially Ready           │   │
│ │           └───────┘                             │   │
│ │   3 of 6 agent capabilities are accessible     │   │
│ └────────────────────────────────────────────────┘   │
│                                                      │
│ ┌─── Top Priority ───────────────────────────────┐   │
│ │ ⚡ ReserveAction Schema (25 pts)               │   │
│ │    AI booking agents will skip you without it  │   │
│ │    [Generate ReserveAction Schema →]           │   │
│ └────────────────────────────────────────────────┘   │
│                                                      │
│ ── Capability Checklist ──────────────────────────   │
│                                                      │
│ ✅ Structured Hours          15/15 pts              │
│    OpeningHoursSpecification detected               │
│                                                      │
│ ✅ Menu Schema               15/15 pts              │
│    Menu JSON-LD published via Magic Menu            │
│                                                      │
│ ❌ ReserveAction Schema       0/25 pts              │
│    No reservation capability detected               │
│    → Set up online reservations and add             │
│      ReserveAction schema                           │
│    [Generate Schema →]                              │
│                                                      │
│ ❌ OrderAction Schema         0/25 pts              │
│    No ordering capability detected                  │
│    → Set up online ordering and add                 │
│      OrderAction schema                             │
│    [Generate Schema →]                              │
│                                                      │
│ ⚠️ Accessible Action CTAs    5/10 pts               │
│    Some page elements may not be parseable          │
│    → Ensure buttons have descriptive text           │
│                                                      │
│ ⚠️ CAPTCHA-Free Flows        5/10 pts               │
│    Unable to verify remotely                        │
│    → Check booking/ordering flows manually          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Sub-Components:**

**`AgentScoreRing`** — Reuses SVG score ring pattern from Sprint 58A (§34.1 Citation Gap). Colors: green ≥70, amber ≥40, red <40. Shows level label (Agent Ready / Partially Ready / Not Ready) and summary text.

**`TopPriorityCard`** — Highlighted card for the highest-impact missing capability. Shows capability name, points available, and schema generation CTA if applicable.

**`CapabilityChecklist`** — List of 6 capabilities. Each shows:
- Status icon: ✅ active, ⚠️ partial, ❌ missing
- Capability name + earned/max points
- Status detail text
- Fix guide (expandable accordion) for partial/missing
- "Generate Schema →" button linking to schema generator when `schemaAction` is set

**`SchemaPreviewModal`** — When user clicks "Generate Schema", show generated JSON-LD in a copy-to-clipboard code block. Uses existing schema generator pattern from §39. Available for: `hours` (existing), `reserve_action` (new), `order_action` (new).

---

### Component 5: Error Boundary + Sidebar

`app/dashboard/agent-readiness/error.tsx` — Standard error boundary.

Sidebar entry:
```typescript
{
  label: 'Agent Readiness',
  href: '/dashboard/agent-readiness',
  icon: Bot,  // from lucide-react
  testId: 'nav-agent-readiness',
}
```

---

### Component 6: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

```typescript
import type { AgentReadinessInput } from '@/lib/services/agent-readiness.service';

/**
 * Sprint 84 — Canonical AgentReadinessInput for Charcoal N Chill.
 * Mixed status: hours + menu active, actions missing, CTAs partial.
 * Expected score: 15 + 15 + 0 + 0 + 5 + 5 = 40 (Partially Ready)
 */
export const MOCK_AGENT_READINESS_INPUT: AgentReadinessInput = {
  location: {
    businessName: 'Charcoal N Chill',
    websiteUrl: 'https://charcoalnchill.com',
    hoursData: {
      monday: { open: '16:00', close: '00:00' },
      tuesday: { open: '16:00', close: '00:00' },
      wednesday: { open: '16:00', close: '00:00' },
      thursday: { open: '16:00', close: '02:00' },
      friday: { open: '16:00', close: '02:00' },
      saturday: { open: '14:00', close: '02:00' },
      sunday: { open: '14:00', close: '00:00' },
    },
    phone: '(770) 555-1234',
  },
  hasPublishedMenu: true,
  hasMenuJsonLd: true,
  pageAudit: {
    schemaCompletenessScore: 55,
    faqSchemaPresent: false,
    entityClarityScore: 52,
    recommendations: [
      { title: 'Add FAQ Schema', dimensionKey: 'faqSchema', schemaType: 'FAQPage' },
    ],
  },
  hasBookingUrl: false,
  hasOrderingUrl: false,
  detectedSchemaTypes: ['OpeningHoursSpecification', 'LocalBusiness'],
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/agent-readiness-service.test.ts`

**Target: `lib/services/agent-readiness.service.ts`**

```
describe('computeAgentReadiness')
  Score calculation:
  1.  computes total score from all capability earned points
  2.  returns 0 when all capabilities missing
  3.  returns 100 when all capabilities active
  4.  returns correct score for mixed statuses

  Readiness level:
  5.  level is agent_ready when score >= 70
  6.  level is partially_ready when score 40-69
  7.  level is not_ready when score < 40

  Active count:
  8.  counts only 'active' status capabilities
  9.  does not count 'partial' as active

  Top priority:
  10. selects highest maxPoints missing capability
  11. returns null when all capabilities active
  12. prefers missing over partial for same weight

  Summary:
  13. includes active count in summary
  14. includes top priority name in summary

describe('assessStructuredHours')
  15. active when OpeningHoursSpecification in detectedSchemaTypes
  16. partial when hoursData present but no schema
  17. missing when no hours data at all
  18. active earns 15 points
  19. partial earns 8 points

describe('assessMenuSchema')
  20. active when hasMenuJsonLd is true
  21. partial when hasPublishedMenu but no JSON-LD
  22. active when Menu in detectedSchemaTypes
  23. missing when no menu at all
  24. active earns 15 points

describe('assessReserveAction')
  25. active when ReserveAction in detectedSchemaTypes
  26. partial when hasBookingUrl but no schema
  27. missing when no booking capability
  28. active earns 25 points
  29. partial earns 13 points
  30. missing has schemaAction 'reserve_action'

describe('assessOrderAction')
  31. active when OrderAction in detectedSchemaTypes
  32. partial when hasOrderingUrl but no schema
  33. missing when no ordering capability
  34. active earns 25 points
  35. partial earns 13 points

describe('assessAccessibleCTAs')
  36. active when entityClarityScore >= 70
  37. partial when entityClarityScore 40-69
  38. missing when entityClarityScore < 40
  39. missing when no page audit data

describe('assessCaptchaFree')
  40. always returns partial in V1
  41. earns 5 points

describe('MOCK_AGENT_READINESS_INPUT integration')
  42. produces score of 40 from mock input
  43. produces level partially_ready
  44. top priority is reserve_action (25 pts)
  45. has 2 active capabilities (hours + menu)
```

**45 tests total. All pure functions — no mocks needed.**

### Test File 2: `src/__tests__/unit/action-schema.test.ts`

**Target: `lib/schema-generator/action-schema.ts`**

```
describe('generateReserveActionSchema')
  1.  returns object with @type Restaurant
  2.  includes ReserveAction in potentialAction
  3.  sets booking URL as urlTemplate
  4.  includes PostalAddress
  5.  omits telephone when null

describe('generateOrderActionSchema')
  6.  returns object with @type Restaurant
  7.  includes OrderAction in potentialAction
  8.  sets ordering URL as urlTemplate
  9.  includes deliveryMethod
  10. includes address from input
```

**10 tests total. Pure functions.**

### Test File 3: `src/__tests__/unit/agent-readiness-data.test.ts`

**Target: `lib/data/agent-readiness.ts`**

```
describe('fetchAgentReadiness')
  1.  runs 3 parallel queries (location, menu, page audit)
  2.  scopes queries by org_id and location_id
  3.  extracts detected schema types from audit data
  4.  checks location attributes for booking/ordering URLs
  5.  handles null page audit gracefully
  6.  handles null menu gracefully
  7.  returns AgentReadinessResult on happy path
```

**7 tests total.**

### Test File 4: `src/__tests__/unit/agent-readiness-page.test.ts`

**Target: Dashboard page + sidebar**

```
describe('Agent Readiness page')
  1.  renders score ring with readiness level
  2.  renders top priority card
  3.  renders 6 capability items
  4.  renders status icons (✅ ⚠️ ❌) correctly
  5.  renders fix guide for non-active capabilities
  6.  renders "Generate Schema" button when schemaAction present

describe('Sidebar')
  7.  shows Agent Readiness link with test-id nav-agent-readiness
```

**7 tests total.**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/services/agent-readiness.service.ts` | **CREATE** | Pure scoring — 6 capability assessors, weighted score, level thresholds (~350 lines) |
| 2 | `lib/schema-generator/action-schema.ts` | **CREATE** | ReserveAction + OrderAction JSON-LD generators (§39 — pure, no I/O) |
| 3 | `lib/data/agent-readiness.ts` | **CREATE** | Data fetcher — 3 parallel queries, schema type inference |
| 4 | `app/dashboard/agent-readiness/page.tsx` | **CREATE** | Dashboard — score ring, top priority, capability checklist |
| 5 | `app/dashboard/agent-readiness/error.tsx` | **CREATE** | Error boundary |
| 6 | `app/dashboard/_components/` | **MODIFY** | Sidebar — add Agent Readiness link |
| 7 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add MOCK_AGENT_READINESS_INPUT |
| 8 | `src/__tests__/unit/agent-readiness-service.test.ts` | **CREATE** | 45 tests — pure scoring |
| 9 | `src/__tests__/unit/action-schema.test.ts` | **CREATE** | 10 tests — schema generators |
| 10 | `src/__tests__/unit/agent-readiness-data.test.ts` | **CREATE** | 7 tests — data layer |
| 11 | `src/__tests__/unit/agent-readiness-page.test.ts` | **CREATE** | 7 tests — page + sidebar |

**Expected test count: 69 new tests across 4 files.**

---

## 🚫 What NOT to Do

1. **DO NOT make external API calls in V1.** Agent readiness is computed entirely from existing tables (page audits, menu, location). Live page crawling for CAPTCHA detection is a future sprint.
2. **DO NOT create a new table.** Score is computed at page load from existing data.
3. **DO NOT violate §39.** Schema generators in `lib/schema-generator/` are pure functions — no Supabase, no fetch, no I/O. The data layer (`lib/data/`) is the only file that touches the database.
4. **DO NOT hardcode business data** (§20). All capability assessments use data from the org's own tables.
5. **DO NOT add plan gating.** Agent Readiness is available to all tiers — it drives upgrade motivation ("you're at 42, upgrade to unlock schema generators").
6. **DO NOT use `as any` on Supabase clients** (§38.2).
7. **DO NOT trigger AI calls on page load** (§5). Schema generation is on-demand (user clicks "Generate").
8. **DO NOT duplicate existing schema generators.** Hours schema already exists in `lib/schema-generator/hours-schema.ts`. Reuse it. Only create NEW generators for ReserveAction and OrderAction.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `computeAgentReadiness()` pure function with 6 capability assessors
- [ ] Weighted scoring (Hours=15, Menu=15, Reserve=25, Order=25, CTAs=10, CAPTCHA=10)
- [ ] Readiness levels: agent_ready (≥70), partially_ready (≥40), not_ready (<40)
- [ ] `generateReserveActionSchema()` + `generateOrderActionSchema()` pure generators
- [ ] `fetchAgentReadiness()` with 3 parallel queries
- [ ] Dashboard at `/dashboard/agent-readiness` — score ring, top priority, capability checklist
- [ ] Schema generation CTAs linking to generators
- [ ] Sidebar entry "Agent Readiness" (test-id: `nav-agent-readiness`)
- [ ] Golden Tenant: MOCK_AGENT_READINESS_INPUT (score=40, partially ready)
- [ ] 69 tests passing across 4 files
- [ ] `npx vitest run` — ALL tests passing, no regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-28 — Sprint 84: Agent Readiness Score (AAO) (Completed)

**Goal:** Build an AI Agent Readiness Score (0-100) evaluating whether autonomous AI agents can transact with the business. Evaluates 6 weighted capabilities: structured hours, menu schema, ReserveAction, OrderAction, accessible CTAs, and CAPTCHA-free flows. The Assistive Agent Optimization (AAO) metric no competitor offers for restaurants.

**Scope:**
- `lib/services/agent-readiness.service.ts` — **NEW.** ~350 lines, all pure functions. `computeAgentReadiness()` entry point. 6 assessors: `assessStructuredHours()` (15pts — schema detection + hours_data fallback), `assessMenuSchema()` (15pts — JSON-LD + published menu), `assessReserveAction()` (25pts — schema + booking URL fallback), `assessOrderAction()` (25pts — schema + ordering URL fallback), `assessAccessibleCTAs()` (10pts — inferred from entity_clarity_score), `assessCaptchaFree()` (10pts — always partial in V1). Three statuses: active (full), partial (50%), missing (0). Levels: agent_ready ≥70, partially_ready ≥40, not_ready <40. Top priority selection by highest maxPoints among non-active.
- `lib/schema-generator/action-schema.ts` — **NEW.** Pure generators (§39). `generateReserveActionSchema()` + `generateOrderActionSchema()` — produce JSON-LD with Restaurant type, potentialAction, EntryPoint with urlTemplate. No I/O.
- `lib/data/agent-readiness.ts` — **NEW.** `fetchAgentReadiness()` — 3 parallel queries (location, magic_menus, page_audits). Infers detected schema types from audit scores. Checks location attributes for booking/ordering URLs. Assembles `AgentReadinessInput`.
- `app/dashboard/agent-readiness/page.tsx` — **NEW.** Server Component. AgentScoreRing (reuses SVG pattern from §34.1), TopPriorityCard, CapabilityChecklist (6 items with status icons, points, fix guides, schema CTAs).
- `app/dashboard/agent-readiness/error.tsx` — **NEW.** Standard error boundary.
- Sidebar — **MODIFIED.** Added "Agent Readiness" link (test-id: nav-agent-readiness).
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_AGENT_READINESS_INPUT` (hours + menu active, actions missing, score=40, partially_ready).

**Tests added:**
- `src/__tests__/unit/agent-readiness-service.test.ts` — **N tests.** Score calculation, levels, active count, top priority, all 6 assessors, MOCK integration.
- `src/__tests__/unit/action-schema.test.ts` — **N tests.** ReserveAction + OrderAction generators.
- `src/__tests__/unit/agent-readiness-data.test.ts` — **N tests.** Parallel queries, schema inference, attribute extraction.
- `src/__tests__/unit/agent-readiness-page.test.ts` — **N tests.** Score ring, capability checklist, sidebar.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/agent-readiness-service.test.ts     # N tests passing
npx vitest run src/__tests__/unit/action-schema.test.ts               # N tests passing
npx vitest run src/__tests__/unit/agent-readiness-data.test.ts        # N tests passing
npx vitest run src/__tests__/unit/agent-readiness-page.test.ts        # N tests passing
npx vitest run                                                         # All tests passing
```

**Note:** Replace N with actual test counts verified via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| Schema generators (§39) | Sprint 70 | Pure function pattern, existing `hours-schema.ts`, `local-business-schema.ts` |
| Page Audits (§34.2) | Sprint 58 | `schema_completeness_score`, `entity_clarity_score`, `recommendations` |
| Magic Menus | Sprint 66 | `is_published`, `json_ld_schema` |
| Locations table | Base schema | `hours_data`, `website_url`, `phone`, `attributes` |
| Score Ring SVG | Sprint 58A (§34.1) | Reusable circular score visualization |
| Entity Health pattern | Sprint 80 | Similar capability checklist UI pattern |

---

## 🧠 Edge Cases

1. **Brand new org (no page audits):** `pageAudit` is null. entityClarityScore is null → CTAs = missing (0 pts). Schema detection returns empty → hours/reserve/order may be missing unless data exists elsewhere. Score will be low — drives action.
2. **No Magic Menu:** `hasPublishedMenu = false`, `hasMenuJsonLd = false`. Menu capability = missing (0 pts) unless website already has menu schema.
3. **No website URL:** `websiteUrl = null`. Most schema checks still work from stored data. ReserveAction/OrderAction can't generate schemas without a URL — fixGuide tells user to set up a website first.
4. **Hours data exists but not in schema:** Partial credit (8/15). Recommends generating OpeningHoursSpecification — links to existing hours schema generator from Sprint 70.
5. **All capabilities active:** Score = 100, level = agent_ready. Top priority = null. Summary says "fully agent-ready!"
6. **CAPTCHA detection (V1 limitation):** Always returns partial (5/10 pts). This is honest — we can't verify remotely. Future sprint adds live page crawl.
7. **Booking/ordering URLs in attributes:** Some locations store these in the JSONB `attributes` field. The data fetcher checks common keys (`reservation_url`, `booking_url`, `opentable_url`, `ordering_url`, `order_url`, `doordash_url`, `uber_eats_url`).

---

## 🔮 AI_RULES Updates

Add new rule:

```markdown
## 47. 🤖 Agent Readiness Score — AAO (Sprint 84)

Evaluates whether AI agents can transact with the business. 6 capabilities, weighted scoring (total = 100):

* **Structured Hours** (15 pts): OpeningHoursSpecification schema or `hours_data` populated.
* **Menu Schema** (15 pts): Menu JSON-LD or published Magic Menu.
* **ReserveAction Schema** (25 pts): ReserveAction in markup or booking URL detected.
* **OrderAction Schema** (25 pts): OrderAction in markup or ordering URL detected.
* **Accessible CTAs** (10 pts): Inferred from `entity_clarity_score` in page audits.
* **CAPTCHA-Free Flows** (10 pts): Always partial in V1 (requires live crawl for real detection).

Statuses: active (full pts), partial (50% pts), missing (0 pts). Levels: agent_ready ≥70, partially_ready ≥40, not_ready <40.

* **Schema generators:** `lib/schema-generator/action-schema.ts` — pure functions (§39). `generateReserveActionSchema()` + `generateOrderActionSchema()`.
* **No external API calls in V1.** Computed from existing tables.
* **No plan gating.** Available to all tiers.
```
