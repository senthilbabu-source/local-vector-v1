// ---------------------------------------------------------------------------
// lib/services/medical-copy-guard.ts — HIPAA Copy Guard (Sprint 127)
//
// Validates AI-generated copy for medical/dental contexts.
// Flags claims that could constitute medical advice or create legal exposure.
// Used by content generation pipelines when isMedicalCategory()=true.
//
// PURE FUNCTION — no I/O, no DB, no side effects.
// AI_RULES §161
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Forbidden patterns — claims that constitute medical advice
// ---------------------------------------------------------------------------

const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bwe (diagnose|treat|cure|heal|prescribe)\b/i,
  /\bguarantee[sd]?\b/i,
  /\b100% success\b/i,
  /\bno side effects\b/i,
  /\bbest (doctor|dentist|practice) in\b/i,
  /\bpainless\b/i,
  /\brisk[- ]free\b/i,
  /\bmiracle\b/i,
];

// ---------------------------------------------------------------------------
// Disclaimer triggers — copy is allowed but needs a disclaimer
// ---------------------------------------------------------------------------

const DISCLAIMER_REQUIRED_PATTERNS: RegExp[] = [
  /\btreatment\b/i,
  /\bprocedure\b/i,
  /\bdiagnosis\b/i,
  /\bmedication\b/i,
  /\bsurgery\b/i,
  /\btherapy\b/i,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CopyGuardResult {
  approved: boolean;
  violations: string[];
  requiresDisclaimer: boolean;
  suggestionToAdd?: string;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Checks AI-generated copy against medical content rules.
 * Returns approval status, any violations, and disclaimer requirements.
 */
export function checkMedicalCopy(text: string): CopyGuardResult {
  const violations: string[] = [];

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Forbidden pattern: ${pattern.toString()}`);
    }
  }

  const requiresDisclaimer = DISCLAIMER_REQUIRED_PATTERNS.some((p) =>
    p.test(text),
  );

  return {
    approved: violations.length === 0,
    violations,
    requiresDisclaimer,
    suggestionToAdd: requiresDisclaimer
      ? 'Results may vary. Consult with our team to discuss your specific needs.'
      : undefined,
  };
}
