// ---------------------------------------------------------------------------
// lib/integrations/detect-discrepancies.ts — Sprint L (C2 Phase 2)
//
// Pure function that compares platform business data against local (org)
// verified data. Returns an array of discrepancies found.
//
// No I/O — suitable for server and test environments.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Discrepancy {
  field: string;
  platformValue: string;
  localValue: string;
  severity: 'high' | 'low';
}

export interface VerificationResult {
  found: boolean;
  platformName?: string;
  platformAddress?: string;
  platformPhone?: string;
  platformUrl?: string;
  platformRating?: number;
  platformReviewCount?: number;
  discrepancies: Discrepancy[];
  verifiedAt: string;
}

export interface PlatformBusiness {
  name: string;
  address?: string;
  phone?: string;
}

export interface LocalLocation {
  business_name?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip to lowercase alphanumeric for fuzzy name comparison.
 * Removes common connecting words (and, the, of, n, &) to handle
 * variations like "Charcoal N Chill" vs "Charcoal and Chill".
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(and|the|of|n|&)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Strip to last 10 digits for phone comparison. */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

/**
 * Extract the first two meaningful words from a street address for
 * loose comparison. Handles common patterns like "123 Main St".
 */
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 2)
    .join(' ');
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Compare platform business data against local verified data.
 *
 * - Name: fuzzy match via substring inclusion on alphanumeric-only strings.
 *   "Charcoal N Chill" vs "Charcoal and Chill" → match (substring overlap).
 * - Address: first 2 words, case-insensitive.
 * - Phone: last 10 digits, exact match.
 */
export function detectDiscrepancies(
  platformBusiness: PlatformBusiness,
  location: LocalLocation,
): Discrepancy[] {
  const issues: Discrepancy[] = [];

  // ── Name check (fuzzy) ──────────────────────────────────────────────
  const localName = location.business_name ?? '';
  if (localName && platformBusiness.name) {
    const platformNorm = normalizeName(platformBusiness.name);
    const localNorm = normalizeName(localName);

    // Fuzzy: if neither contains the other, it's a discrepancy
    if (
      platformNorm &&
      localNorm &&
      !platformNorm.includes(localNorm) &&
      !localNorm.includes(platformNorm)
    ) {
      issues.push({
        field: 'Business name',
        platformValue: platformBusiness.name,
        localValue: localName,
        severity: 'high',
      });
    }
  }

  // ── Address check ───────────────────────────────────────────────────
  const localAddr = location.address_line1 ?? '';
  const platformAddr = platformBusiness.address ?? '';
  if (localAddr && platformAddr) {
    const platformAddrNorm = normalizeAddress(platformAddr);
    const localAddrNorm = normalizeAddress(localAddr);

    if (
      platformAddrNorm &&
      localAddrNorm &&
      !platformAddrNorm.includes(localAddrNorm) &&
      !localAddrNorm.includes(platformAddrNorm)
    ) {
      issues.push({
        field: 'Street address',
        platformValue: platformAddr,
        localValue: localAddr,
        severity: 'high',
      });
    }
  }

  // ── Phone check (digits only) ───────────────────────────────────────
  const localPhone = location.phone ?? '';
  const platformPhone = platformBusiness.phone ?? '';
  if (localPhone && platformPhone) {
    const platformPhoneNorm = normalizePhone(platformPhone);
    const localPhoneNorm = normalizePhone(localPhone);

    if (
      platformPhoneNorm.length >= 10 &&
      localPhoneNorm.length >= 10 &&
      platformPhoneNorm !== localPhoneNorm
    ) {
      issues.push({
        field: 'Phone number',
        platformValue: platformPhone,
        localValue: localPhone,
        severity: 'high',
      });
    }
  }

  return issues;
}
