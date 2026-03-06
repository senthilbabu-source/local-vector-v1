// ---------------------------------------------------------------------------
// lib/hallucinations/urgency.ts — S21 (AI_RULES §221)
//
// Pure function: computes weekend urgency for critical/high alerts detected
// Tuesday–Thursday. Returns null for other days or lower severity.
// ---------------------------------------------------------------------------

export interface UrgencyResult {
  badge: 'fix-before-weekend';
  revenueAtStake: number;
  deadline: string;
}

/**
 * Compute urgency for a hallucination alert based on severity and detection day.
 *
 * Returns a result only when:
 *   1. Severity is 'critical' or 'high'
 *   2. Detection day is Tuesday (2), Wednesday (3), or Thursday (4)
 *
 * Revenue at stake = avg_ticket * monthly_covers / 4 * 0.4 (Fri+Sat weekend share)
 */
export function computeUrgency(
  severity: string,
  detectedAt: string,
  avgTicket: number,
  monthlyCover: number,
): UrgencyResult | null {
  if (severity !== 'critical' && severity !== 'high') return null;

  const detectedDate = new Date(detectedAt);
  const dayOfWeek = detectedDate.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

  if (dayOfWeek < 2 || dayOfWeek > 4) return null;

  const revenueAtStake = Math.round(avgTicket * monthlyCover / 4 * 0.4);

  return {
    badge: 'fix-before-weekend',
    revenueAtStake,
    deadline: 'this Friday',
  };
}
