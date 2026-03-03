// ---------------------------------------------------------------------------
// lib/rag/rag-readiness-check.ts — RAG Data Completeness Gate (Sprint 133)
//
// Pure function. Checks whether a location's ground truth is complete enough
// for the RAG chatbot widget. Score >= 80 required to enable widget.
//
// AI_RULES §166: Never allow widget enable when completeness < 80.
// ---------------------------------------------------------------------------

export interface RAGReadinessResult {
  ready: boolean;
  completenessScore: number; // 0–100
  gaps: string[]; // human-readable list of what's missing
}

export interface RAGReadinessInput {
  menuItemCount: number;
  amenitiesSetCount: number;
  amenitiesTotal: number;
  hoursDataComplete: boolean; // all 7 days present
  operationalStatusSet: boolean;
}

/**
 * Checks if a location's ground truth is complete enough for RAG.
 * Pure function — no I/O, no side effects.
 *
 * Scoring:
 *   Menu items (≥5):       40 pts
 *   Amenities (≥50% set):  20 pts
 *   Hours (all 7 days):    25 pts
 *   Operational status:    15 pts
 *   ─────────────────────────────
 *   Total:                100 pts
 *   Ready threshold:       80 pts
 */
export function checkRAGReadiness(input: RAGReadinessInput): RAGReadinessResult {
  const gaps: string[] = [];
  let score = 0;

  // Menu: 40 pts — need at least 5 items as minimum viable bar
  if (input.menuItemCount >= 5) {
    score += 40;
  } else {
    gaps.push(
      `Menu needs at least 5 items (currently ${input.menuItemCount})`,
    );
  }

  // Amenities: 20 pts — at least 50% set (not null)
  const amenityCompleteness =
    input.amenitiesTotal > 0
      ? input.amenitiesSetCount / input.amenitiesTotal
      : 0;
  if (amenityCompleteness >= 0.5) {
    score += 20;
  } else {
    gaps.push(
      `Amenities: ${Math.round(amenityCompleteness * 100)}% set (need 50%+)`,
    );
  }

  // Hours: 25 pts
  if (input.hoursDataComplete) {
    score += 25;
  } else {
    gaps.push('Hours data incomplete (need all 7 days)');
  }

  // Operational status: 15 pts
  if (input.operationalStatusSet) {
    score += 15;
  } else {
    gaps.push('Operational status not set');
  }

  return { ready: score >= 80, completenessScore: score, gaps };
}
