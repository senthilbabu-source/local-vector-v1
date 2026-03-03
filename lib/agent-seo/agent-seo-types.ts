// ---------------------------------------------------------------------------
// lib/agent-seo/agent-seo-types.ts — Agent-SEO Action Readiness Types
//
// Sprint 126: Shared types for action schema detection and scoring.
// AI_RULES §165: Jargon-free labels only. Never expose "ReserveAction" in UI.
// ---------------------------------------------------------------------------

export type AuditStatus = 'pass' | 'partial' | 'fail' | 'skipped';

export type ActionCapabilityId =
  | 'reserve_action'
  | 'order_action'
  | 'booking_cta'
  | 'booking_crawlable'
  | 'appointment_action';

export interface ActionCapability {
  id: ActionCapabilityId;
  label: string;           // jargon-free label (never "ReserveAction")
  description: string;     // "Can AI book a reservation for a customer?"
  status: AuditStatus;
  maxPoints: number;
  earnedPoints: number;
  statusDetail: string;
  fixGuide: string | null;
  schemaTypeToAdd?: string;  // for "Generate Schema" CTA
}

export type ActionAuditLevel =
  | 'agent_action_ready'
  | 'partially_actionable'
  | 'not_actionable';

export interface ActionAuditResult {
  score: number;
  level: ActionAuditLevel;
  capabilities: ActionCapability[];
  topPriority: ActionCapability | null;
  auditedUrl: string | null;
  auditedAt: string;
}

export interface DetectedSchemas {
  hasReserveAction: boolean;
  reserveActionUrl?: string;
  hasOrderAction: boolean;
  orderActionUrl?: string;
  hasAppointmentAction: boolean;
  hasBookingCTA: boolean;
  bookingUrlIsHttps: boolean;
  bookingUrlNeedsLogin: boolean;
}
