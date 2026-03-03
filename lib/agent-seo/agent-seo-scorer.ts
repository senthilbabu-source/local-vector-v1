// ---------------------------------------------------------------------------
// lib/agent-seo/agent-seo-scorer.ts — Agent-SEO Scoring (Pure Function)
//
// Sprint 126: 5 capabilities x fixed max points (25+25+20+20+10 = 100).
// AI_RULES §165: Jargon-free labels only. Never show "JSON-LD" in UI.
// ---------------------------------------------------------------------------

import type {
  DetectedSchemas,
  ActionAuditResult,
  ActionCapability,
  AuditStatus,
  ActionAuditLevel,
} from './agent-seo-types';

/**
 * Compute the Agent-SEO action readiness score.
 *
 * Checks both live website HTML (DetectedSchemas) AND magic_menus JSON-LD
 * for LocalVector-generated action schemas.
 */
export function computeAgentSEOScore(
  detected: DetectedSchemas | null,
  magicMenuJsonLd: Record<string, unknown> | null,
  websiteUrl: string | null,
  auditedAt: string,
): ActionAuditResult {
  // No website → score 0
  if (!websiteUrl) {
    return buildNoWebsiteResult(auditedAt);
  }

  // Merge detected schemas with magic_menus schemas
  const merged = mergeWithMagicMenus(detected, magicMenuJsonLd);

  const capabilities: ActionCapability[] = [
    assessReserveAction(merged),
    assessOrderAction(merged),
    assessBookingCTA(merged),
    assessBookingCrawlable(merged),
    assessAppointmentAction(merged),
  ];

  const score = capabilities.reduce((sum, c) => sum + c.earnedPoints, 0);

  const level: ActionAuditLevel =
    score >= 80
      ? 'agent_action_ready'
      : score >= 40
        ? 'partially_actionable'
        : 'not_actionable';

  // topPriority: highest maxPoints capability with status != 'pass'
  const nonPassing = capabilities.filter(c => c.status !== 'pass');
  const topPriority = nonPassing.length > 0
    ? nonPassing.reduce((best, c) => c.maxPoints > best.maxPoints ? c : best)
    : null;

  return {
    score,
    level,
    capabilities,
    topPriority,
    auditedUrl: websiteUrl,
    auditedAt,
  };
}

// ---------------------------------------------------------------------------
// Individual assessors
// ---------------------------------------------------------------------------

function assessReserveAction(detected: DetectedSchemas): ActionCapability {
  const pass = detected.hasReserveAction;
  return {
    id: 'reserve_action',
    label: 'Reservation Booking',
    description: 'Can AI book a reservation for a customer?',
    status: pass ? 'pass' : 'fail',
    maxPoints: 25,
    earnedPoints: pass ? 25 : 0,
    statusDetail: pass
      ? 'AI agents can make reservations for customers through your booking system.'
      : 'AI agents cannot book reservations — customers must call or visit your website directly.',
    fixGuide: pass ? null : 'Add a reservation booking link to your website or enable the reservation schema through LocalVector.',
    schemaTypeToAdd: pass ? undefined : 'ReserveAction',
  };
}

function assessOrderAction(detected: DetectedSchemas): ActionCapability {
  const pass = detected.hasOrderAction;
  return {
    id: 'order_action',
    label: 'Online Ordering',
    description: 'Can AI place an order for a customer?',
    status: pass ? 'pass' : 'fail',
    maxPoints: 25,
    earnedPoints: pass ? 25 : 0,
    statusDetail: pass
      ? 'AI agents can place food orders directly through your online ordering system.'
      : 'AI agents cannot place orders — customers must use your website or call.',
    fixGuide: pass ? null : 'Add an online ordering link to your website or enable the ordering schema through LocalVector.',
    schemaTypeToAdd: pass ? undefined : 'OrderAction',
  };
}

function assessBookingCTA(detected: DetectedSchemas): ActionCapability {
  const pass = detected.hasBookingCTA;
  return {
    id: 'booking_cta',
    label: 'Visible Booking Button',
    description: 'Is there a clear booking or ordering button on your website?',
    status: pass ? 'pass' : 'fail',
    maxPoints: 20,
    earnedPoints: pass ? 20 : 0,
    statusDetail: pass
      ? 'Your website has a visible booking or ordering button that AI can detect.'
      : 'No visible booking or ordering button found — AI may not find how to take action.',
    fixGuide: pass ? null : 'Add a clearly labeled "Book Now", "Order Online", or "Make a Reservation" button to your homepage.',
  };
}

function assessBookingCrawlable(detected: DetectedSchemas): ActionCapability {
  // No booking URL found at all → skipped (neutral 10 pts)
  const hasUrl = detected.reserveActionUrl || detected.orderActionUrl;

  if (!hasUrl) {
    return {
      id: 'booking_crawlable',
      label: 'Booking Link Accessible',
      description: 'Can AI follow your booking link without barriers?',
      status: 'skipped',
      maxPoints: 20,
      earnedPoints: 10,
      statusDetail: 'No booking link detected — this check is neutral.',
      fixGuide: null,
    };
  }

  if (!detected.bookingUrlIsHttps) {
    return {
      id: 'booking_crawlable',
      label: 'Booking Link Accessible',
      description: 'Can AI follow your booking link without barriers?',
      status: 'fail',
      maxPoints: 20,
      earnedPoints: 0,
      statusDetail: 'Your booking link uses HTTP instead of HTTPS — AI agents may refuse to follow it.',
      fixGuide: 'Upgrade your booking page to HTTPS for secure access.',
    };
  }

  if (detected.bookingUrlNeedsLogin) {
    return {
      id: 'booking_crawlable',
      label: 'Booking Link Accessible',
      description: 'Can AI follow your booking link without barriers?',
      status: 'partial',
      maxPoints: 20,
      earnedPoints: 10,
      statusDetail: 'Your booking link requires a login — AI agents may not complete the booking.',
      fixGuide: 'Allow guest booking without requiring account creation.',
    };
  }

  return {
    id: 'booking_crawlable',
    label: 'Booking Link Accessible',
    description: 'Can AI follow your booking link without barriers?',
    status: 'pass',
    maxPoints: 20,
    earnedPoints: 20,
    statusDetail: 'Your booking link is accessible via HTTPS without login barriers.',
    fixGuide: null,
  };
}

function assessAppointmentAction(detected: DetectedSchemas): ActionCapability {
  const pass = detected.hasAppointmentAction;
  return {
    id: 'appointment_action',
    label: 'Appointment Scheduling',
    description: 'Can AI schedule an appointment for a customer?',
    status: pass ? 'pass' : 'fail',
    maxPoints: 10,
    earnedPoints: pass ? 10 : 0,
    statusDetail: pass
      ? 'AI agents can schedule appointments through your system.'
      : 'AI agents cannot schedule appointments — relevant for medical/service businesses.',
    fixGuide: pass ? null : 'If applicable, add appointment scheduling markup to your website.',
    schemaTypeToAdd: pass ? undefined : 'AppointmentAction',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mergeWithMagicMenus(
  detected: DetectedSchemas | null,
  magicMenuJsonLd: Record<string, unknown> | null,
): DetectedSchemas {
  const base: DetectedSchemas = detected ?? {
    hasReserveAction: false,
    hasOrderAction: false,
    hasAppointmentAction: false,
    hasBookingCTA: false,
    bookingUrlIsHttps: false,
    bookingUrlNeedsLogin: false,
  };

  if (!magicMenuJsonLd) return base;

  // Check if magic_menus JSON-LD contains action schemas
  try {
    const jsonStr = JSON.stringify(magicMenuJsonLd);
    if (jsonStr.includes('ReserveAction')) base.hasReserveAction = true;
    if (jsonStr.includes('OrderAction')) base.hasOrderAction = true;
    if (jsonStr.includes('MedicalAppointment') || jsonStr.includes('BuyAction')) {
      base.hasAppointmentAction = true;
    }
  } catch (_err) {
    // Ignore parse errors
  }

  return base;
}

function buildNoWebsiteResult(auditedAt: string): ActionAuditResult {
  return {
    score: 0,
    level: 'not_actionable',
    capabilities: [],
    topPriority: null,
    auditedUrl: null,
    auditedAt,
  };
}
