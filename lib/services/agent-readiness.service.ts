// ---------------------------------------------------------------------------
// lib/services/agent-readiness.service.ts — AI Agent Readiness Score (AAO)
//
// Sprint 84: Evaluates whether autonomous AI agents (OpenAI Operator, Google
// Jarvis, Apple Intelligence Actions) can transact with the business.
//
// PURE FUNCTION — no DB, no fetch, no side effects (AI_RULES §39).
//
// 6 capabilities, weighted scoring (total = 100):
//   1. Structured Hours         (15 pts)
//   2. Menu Schema              (15 pts)
//   3. ReserveAction Schema     (25 pts)
//   4. OrderAction Schema       (25 pts)
//   5. Accessible Action CTAs   (10 pts)
//   6. CAPTCHA-Free Flows       (10 pts)
//
// Statuses: active (full pts), partial (50% pts), missing (0 pts).
// Levels: agent_ready >= 70, partially_ready >= 40, not_ready < 40.
// ---------------------------------------------------------------------------

// ── Types ─────────────────────────────────────────────────────────────────

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

// ── Pure computation ──────────────────────────────────────────────────────

/**
 * Compute Agent Readiness Score from input data.
 * Pure function — no I/O, no side effects.
 */
export function computeAgentReadiness(
  input: AgentReadinessInput,
): AgentReadinessResult {
  const capabilities: AgentCapability[] = [
    assessStructuredHours(input),
    assessMenuSchema(input),
    assessReserveAction(input),
    assessOrderAction(input),
    assessAccessibleCTAs(input),
    assessCaptchaFree(),
  ];

  const score = capabilities.reduce((sum, c) => sum + c.earnedPoints, 0);
  const activeCount = capabilities.filter((c) => c.status === 'active').length;
  const totalCount = capabilities.length;

  const level: ReadinessLevel =
    score >= 70
      ? 'agent_ready'
      : score >= 40
        ? 'partially_ready'
        : 'not_ready';

  const levelLabel =
    level === 'agent_ready'
      ? 'Agent Ready'
      : level === 'partially_ready'
        ? 'Partially Ready'
        : 'Not Ready';

  // Top priority: highest maxPoints among missing/partial capabilities
  const topPriority =
    capabilities
      .filter((c) => c.status !== 'active')
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

// ── Capability assessors ──────────────────────────────────────────────────

export function assessStructuredHours(
  input: AgentReadinessInput,
): AgentCapability {
  const base = {
    id: 'structured_hours',
    name: 'Structured Hours',
    description:
      "AI agents can check if you're open before recommending or booking",
    maxPoints: 15,
  };

  const hasHoursData =
    input.location.hoursData !== null &&
    typeof input.location.hoursData === 'object' &&
    Object.keys(input.location.hoursData).length > 0;

  const hasHoursSchema = input.detectedSchemaTypes.some((t) =>
    t.toLowerCase().includes('openinghours'),
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
      fixGuide:
        'Generate OpeningHoursSpecification JSON-LD from your stored hours and add it to your website.',
      schemaAction: 'hours',
    };
  }

  return {
    ...base,
    status: 'missing',
    earnedPoints: 0,
    statusDetail: 'No structured hours data found',
    fixGuide:
      'Add your business hours in the Locations settings, then generate OpeningHoursSpecification schema.',
    schemaAction: 'hours',
  };
}

export function assessMenuSchema(
  input: AgentReadinessInput,
): AgentCapability {
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
      statusDetail:
        'Magic Menu is published but JSON-LD schema needs generation',
      fixGuide: 'Generate Menu + MenuItem JSON-LD from your Magic Menu data.',
      schemaAction: 'menu',
    };
  }

  const hasMenuSchemaDetected = input.detectedSchemaTypes.some((t) =>
    t.toLowerCase().includes('menu'),
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
    statusDetail:
      "No menu schema found — AI agents can't browse your offerings",
    fixGuide:
      'Upload your menu to create a Magic Menu page, then publish with JSON-LD schema.',
    schemaAction: null,
  };
}

export function assessReserveAction(
  input: AgentReadinessInput,
): AgentCapability {
  const base = {
    id: 'reserve_action',
    name: 'ReserveAction Schema',
    description: 'AI booking agents can reserve a table directly',
    maxPoints: 25,
  };

  const hasReserveSchema = input.detectedSchemaTypes.some((t) =>
    t.toLowerCase().includes('reserveaction'),
  );

  if (hasReserveSchema) {
    return {
      ...base,
      status: 'active',
      earnedPoints: 25,
      statusDetail:
        'ReserveAction schema detected — AI agents can initiate reservations',
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
      fixGuide:
        'Add ReserveAction JSON-LD schema pointing to your booking URL so AI agents can find and use it programmatically.',
      schemaAction: 'reserve_action',
    };
  }

  return {
    ...base,
    status: 'missing',
    earnedPoints: 0,
    statusDetail:
      'No reservation capability detected — AI booking agents will skip you',
    fixGuide:
      'Set up online reservations (OpenTable, Resy, or direct) and add ReserveAction schema to your website.',
    schemaAction: 'reserve_action',
  };
}

export function assessOrderAction(
  input: AgentReadinessInput,
): AgentCapability {
  const base = {
    id: 'order_action',
    name: 'OrderAction Schema',
    description: 'AI ordering agents can place food orders directly',
    maxPoints: 25,
  };

  const hasOrderSchema = input.detectedSchemaTypes.some((t) =>
    t.toLowerCase().includes('orderaction'),
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
      fixGuide:
        'Add OrderAction JSON-LD schema pointing to your ordering URL so AI agents can place orders programmatically.',
      schemaAction: 'order_action',
    };
  }

  return {
    ...base,
    status: 'missing',
    earnedPoints: 0,
    statusDetail:
      'No ordering capability detected — AI food ordering agents will skip you',
    fixGuide:
      'Set up online ordering (Toast, Square, DoorDash direct) and add OrderAction schema to your website.',
    schemaAction: 'order_action',
  };
}

export function assessAccessibleCTAs(
  input: AgentReadinessInput,
): AgentCapability {
  const base = {
    id: 'accessible_ctas',
    name: 'Accessible Action CTAs',
    description:
      'Action buttons have machine-parseable text labels (not icon-only)',
    maxPoints: 10,
  };

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
      fixGuide:
        'Ensure all buttons and links have descriptive text labels. Replace icon-only buttons with "Book a Table", "Order Online", "Call Us" text.',
      schemaAction: null,
    };
  }

  return {
    ...base,
    status: 'missing',
    earnedPoints: 0,
    statusDetail:
      clarityScore === null
        ? 'No page audit data — run a page audit to assess'
        : 'Page content has low machine-parseability',
    fixGuide:
      'Run a page audit, then ensure all action buttons have descriptive text labels that AI agents can parse.',
    schemaAction: null,
  };
}

export function assessCaptchaFree(): AgentCapability {
  // V1: Cannot determine remotely. Mark as 'partial' with advisory.
  // Future sprint: Live page crawl to detect CAPTCHA elements.
  return {
    id: 'captcha_free',
    name: 'CAPTCHA-Free Flows',
    description:
      'Transactional flows completeable without human verification',
    maxPoints: 10,
    status: 'partial',
    earnedPoints: 5,
    statusDetail:
      'Unable to verify remotely — check your booking/ordering flows manually',
    fixGuide:
      "AI agents cannot solve CAPTCHAs. If your reservation or ordering flow uses CAPTCHA, consider rate-limiting or bot detection that doesn't block legitimate AI agents.",
    schemaAction: null,
  };
}
