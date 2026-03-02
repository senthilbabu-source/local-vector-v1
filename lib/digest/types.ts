// ---------------------------------------------------------------------------
// lib/digest/types.ts — Weekly Digest Types (Sprint 117)
//
// Types for the enhanced weekly digest email with org branding, citations,
// missed queries, first mover alerts, and unsubscribe support.
// ---------------------------------------------------------------------------

export interface DigestSovTrend {
  /** e.g. 42.0 */
  current_sov: number;
  /** Previous week */
  previous_sov: number;
  /** current - previous (can be negative) */
  delta: number;
  /** up if delta >= 2, down if <= -2, flat otherwise */
  trend: 'up' | 'down' | 'flat';
  total_queries: number;
  cited_count: number;
}

export interface DigestCitation {
  query_text: string;
  cited_at: string;
}

export interface DigestMissedQuery {
  query_text: string;
  /** Name of competitor that was cited, if any */
  competitor_cited: string | null;
}

export interface DigestFirstMoverAlert {
  query_text: string;
  detected_at: string;
  /** Link to create content for this query */
  action_url: string;
}

export interface WeeklyDigestPayload {
  org_id: string;
  org_name: string;
  recipient_email: string;
  recipient_name: string | null;
  unsubscribe_token: string;
  /** ISO date string for the week start (Monday) */
  week_of: string;
  sov_trend: DigestSovTrend;
  /** Where the business was cited this week (max 5) */
  citations: DigestCitation[];
  /** Top missed queries (max 3) */
  missed_queries: DigestMissedQuery[];
  /** null if none this week */
  first_mover_alert: DigestFirstMoverAlert | null;
  /** Org logo URL from org_themes (Sprint 115) */
  org_logo_url: string | null;
  /** Default '#6366f1' */
  org_primary_color: string;
  /** Default '#ffffff' */
  org_text_on_primary: string;
}

export interface DigestSendResult {
  sent: boolean;
  skipped: boolean;
  skip_reason?: 'unsubscribed' | 'send_gate_not_met' | 'no_sov_data' | 'resend_error';
  message_id?: string;
}
