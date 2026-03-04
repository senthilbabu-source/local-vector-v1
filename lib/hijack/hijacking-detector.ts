// ---------------------------------------------------------------------------
// lib/hijack/hijacking-detector.ts — P8-FIX-37: Competitive Hijacking Detection
//
// Pure functions that detect when an AI engine confuses a business with a
// competitor. Three hijack types:
//   - competitor_citation: competitor appears instead of our business
//   - address_mix: AI response contains a different street address
//   - attribute_confusion: AI attributes competitor features to our business
//
// All functions are pure (no I/O, no side effects) and testable without mocks.
// AI_RULES §193.
// ---------------------------------------------------------------------------

import { normalizeAddress } from '@/lib/nap-sync/nap-discrepancy-detector';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HijackType = 'attribute_confusion' | 'competitor_citation' | 'address_mix';
export type HijackSeverity = 'critical' | 'high' | 'medium';
export type HijackStatus = 'new' | 'acknowledged' | 'resolved';

export interface HijackingEvent {
  id: string;
  orgId: string;
  locationId: string;
  engine: string;
  queryText: string;
  hijackType: HijackType;
  ourBusiness: string;
  competitorName: string;
  evidenceText: string;
  severity: HijackSeverity;
  detectedAt: string;
  status: HijackStatus;
}

export interface SOVResultInput {
  engine: string;
  queryText: string;
  aiResponse: string;
  cited: boolean;
  mentionedCompetitors: string[];
}

export interface DetectionInput {
  orgId: string;
  locationId: string;
  businessName: string;
  businessAddress: string;
  city: string;
  state: string;
  sovResults: SOVResultInput[];
}

// ---------------------------------------------------------------------------
// Street address regex — matches patterns like "123 Main St" or "11950 Jones Bridge Rd"
// ---------------------------------------------------------------------------

const STREET_ADDRESS_RE = /\d{1,5}\s+\w+(?:\s+\w+)*\s+(?:st|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|pl|place|cir|circle|pkwy|parkway|hwy|highway)\b/gi;

// ---------------------------------------------------------------------------
// Pure detection functions
// ---------------------------------------------------------------------------

/**
 * Classify severity based on hijack type.
 * address_mix → critical (customers go to wrong place)
 * competitor_citation → high (competitor gets our traffic)
 * attribute_confusion → medium (wrong features attributed)
 */
export function classifySeverity(hijackType: HijackType): HijackSeverity {
  switch (hijackType) {
    case 'address_mix':
      return 'critical';
    case 'competitor_citation':
      return 'high';
    case 'attribute_confusion':
      return 'medium';
  }
}

/**
 * Detect competitor_citation: our business is not cited but a competitor is.
 * Returns the first competitor name or null.
 */
export function detectCompetitorCitation(
  competitors: string[],
  cited: boolean,
): string | null {
  if (cited || competitors.length === 0) return null;
  return competitors[0];
}

/**
 * Detect address_mix: the AI response contains a street address that does NOT
 * match our business address (after normalization).
 */
export function detectAddressMix(
  response: string,
  businessAddress: string,
): boolean {
  if (!businessAddress) return false;

  const normalizedOurs = normalizeAddress(businessAddress);
  if (!normalizedOurs) return false;

  const addresses = response.match(STREET_ADDRESS_RE);
  if (!addresses || addresses.length === 0) return false;

  // If any address in the response does not match ours, it's a mix
  for (const addr of addresses) {
    const normalizedFound = normalizeAddress(addr);
    if (normalizedFound && !normalizedOurs.includes(normalizedFound) && !normalizedFound.includes(normalizedOurs)) {
      return true;
    }
  }
  return false;
}

/**
 * Detect attribute_confusion: the AI response mentions our business name
 * but also mentions a competitor in a way that attributes their features to us.
 * Returns the competitor and the evidence snippet, or null.
 */
export function detectAttributeConfusion(
  response: string,
  businessName: string,
  competitors: string[],
): { competitor: string; evidence: string } | null {
  if (!businessName || competitors.length === 0) return null;

  const lowerResponse = response.toLowerCase();
  const lowerBusiness = businessName.toLowerCase();

  // Our business must be mentioned in the response
  if (!lowerResponse.includes(lowerBusiness)) return null;

  // Check if any competitor name also appears in the same response
  for (const comp of competitors) {
    const lowerComp = comp.toLowerCase();
    if (lowerComp.length < 3) continue; // skip very short names
    if (lowerResponse.includes(lowerComp)) {
      // Extract evidence: surrounding context where competitor appears
      const idx = lowerResponse.indexOf(lowerComp);
      const start = Math.max(0, idx - 50);
      const end = Math.min(response.length, idx + lowerComp.length + 100);
      const evidence = response.slice(start, end).trim();
      return { competitor: comp, evidence };
    }
  }
  return null;
}

/**
 * Extract the best-matching competitor name from response text.
 * If competitors list is provided, returns the first match found in response.
 * Falls back to first competitor in the list.
 */
export function extractCompetitorName(
  text: string,
  competitors: string[],
): string {
  if (competitors.length === 0) return 'Unknown competitor';

  const lowerText = text.toLowerCase();
  for (const comp of competitors) {
    if (lowerText.includes(comp.toLowerCase())) {
      return comp;
    }
  }
  return competitors[0];
}

/**
 * Main detection orchestrator. Analyzes SOV results and returns hijacking events.
 * Pure function — no I/O, no side effects.
 */
export function detectHijacking(input: DetectionInput): HijackingEvent[] {
  const events: HijackingEvent[] = [];

  for (const result of input.sovResults) {
    // Pattern 1: Competitor Citation — not cited, competitor appears
    const citedCompetitor = detectCompetitorCitation(
      result.mentionedCompetitors,
      result.cited,
    );
    if (citedCompetitor) {
      const hijackType: HijackType = 'competitor_citation';
      events.push({
        id: crypto.randomUUID(),
        orgId: input.orgId,
        locationId: input.locationId,
        engine: result.engine,
        queryText: result.queryText,
        hijackType,
        ourBusiness: input.businessName,
        competitorName: citedCompetitor,
        evidenceText: result.aiResponse.slice(0, 300),
        severity: classifySeverity(hijackType),
        detectedAt: new Date().toISOString(),
        status: 'new',
      });
      continue; // one event per SOV result
    }

    // Pattern 2: Address Mix — wrong address in AI response
    if (result.aiResponse && detectAddressMix(result.aiResponse, input.businessAddress)) {
      const hijackType: HijackType = 'address_mix';
      const competitor = extractCompetitorName(result.aiResponse, result.mentionedCompetitors);
      events.push({
        id: crypto.randomUUID(),
        orgId: input.orgId,
        locationId: input.locationId,
        engine: result.engine,
        queryText: result.queryText,
        hijackType,
        ourBusiness: input.businessName,
        competitorName: competitor,
        evidenceText: result.aiResponse.slice(0, 300),
        severity: classifySeverity(hijackType),
        detectedAt: new Date().toISOString(),
        status: 'new',
      });
      continue;
    }

    // Pattern 3: Attribute Confusion — competitor features attributed to us
    if (result.aiResponse && result.mentionedCompetitors.length > 0) {
      const confusion = detectAttributeConfusion(
        result.aiResponse,
        input.businessName,
        result.mentionedCompetitors,
      );
      if (confusion) {
        const hijackType: HijackType = 'attribute_confusion';
        events.push({
          id: crypto.randomUUID(),
          orgId: input.orgId,
          locationId: input.locationId,
          engine: result.engine,
          queryText: result.queryText,
          hijackType,
          ourBusiness: input.businessName,
          competitorName: confusion.competitor,
          evidenceText: confusion.evidence.slice(0, 300),
          severity: classifySeverity(hijackType),
          detectedAt: new Date().toISOString(),
          status: 'new',
        });
      }
    }
  }

  return events;
}
