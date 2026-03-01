// ---------------------------------------------------------------------------
// lib/nap-sync/nap-discrepancy-detector.ts — Pure discrepancy detection
//
// Sprint 105: Compares Ground Truth with live platform data.
// Pure function — no I/O, no side effects.
// ---------------------------------------------------------------------------

import type {
  GroundTruth,
  AdapterResult,
  PlatformDiscrepancy,
  NAPField,
  NAPData,
  PlatformId,
} from './types';

// ── Phone normalization ─────────────────────────────────────────────────────

/**
 * Normalizes a phone number for comparison.
 * Strips all non-digit characters, then takes last 10 digits.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

// ── Address normalization ───────────────────────────────────────────────────

const ADDRESS_ABBREVIATIONS: Record<string, string> = {
  'st': 'street',
  'rd': 'road',
  'blvd': 'boulevard',
  'ave': 'avenue',
  'dr': 'drive',
  'ln': 'lane',
  'ct': 'court',
  'ste': 'suite',
  'pkwy': 'parkway',
  'pl': 'place',
  'cir': 'circle',
  'hwy': 'highway',
};

/**
 * Normalizes an address string for fuzzy comparison.
 * Lowercases, strips punctuation, expands common abbreviations.
 */
export function normalizeAddress(address: string): string {
  let normalized = address.toLowerCase().replace(/[.,#\-]/g, ' ');

  // Expand abbreviations (word-boundary safe)
  for (const [abbr, full] of Object.entries(ADDRESS_ABBREVIATIONS)) {
    normalized = normalized.replace(new RegExp(`\\b${abbr}\\.?\\b`, 'g'), full);
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

// ── Website normalization ───────────────────────────────────────────────────

function normalizeWebsite(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .trim();
}

// ── Name normalization ──────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/['']/g, "'").replace(/\s+/g, ' ').trim();
}

// ── Field diffing ───────────────────────────────────────────────────────────

/**
 * Compares two NAPData objects and returns the differing fields.
 * Normalizes values before comparison.
 * Fields undefined in platformData are ignored (not flagged as wrong).
 */
export function diffNAPData(
  groundTruth: Partial<NAPData>,
  platformData: NAPData,
): NAPField[] {
  const diffs: NAPField[] = [];

  // Name
  if (platformData.name !== undefined && groundTruth.name !== undefined) {
    if (normalizeName(groundTruth.name) !== normalizeName(platformData.name)) {
      diffs.push({
        field: 'name',
        ground_truth_value: groundTruth.name,
        platform_value: platformData.name,
      });
    }
  }

  // Address
  if (platformData.address !== undefined && groundTruth.address !== undefined) {
    if (normalizeAddress(groundTruth.address) !== normalizeAddress(platformData.address)) {
      diffs.push({
        field: 'address',
        ground_truth_value: groundTruth.address,
        platform_value: platformData.address,
      });
    }
  }

  // Phone
  if (platformData.phone !== undefined && groundTruth.phone !== undefined) {
    if (normalizePhone(groundTruth.phone) !== normalizePhone(platformData.phone)) {
      diffs.push({
        field: 'phone',
        ground_truth_value: groundTruth.phone,
        platform_value: platformData.phone,
      });
    }
  }

  // Website
  if (platformData.website !== undefined && groundTruth.website !== undefined) {
    if (normalizeWebsite(groundTruth.website) !== normalizeWebsite(platformData.website)) {
      diffs.push({
        field: 'website',
        ground_truth_value: groundTruth.website,
        platform_value: platformData.website,
      });
    }
  }

  // Operational status
  if (
    platformData.operational_status !== undefined &&
    groundTruth.operational_status !== undefined
  ) {
    const gtStatus = (groundTruth.operational_status ?? '').toLowerCase();
    const platStatus = (platformData.operational_status ?? '').toLowerCase();
    if (gtStatus !== platStatus) {
      diffs.push({
        field: 'operational_status',
        ground_truth_value: groundTruth.operational_status ?? null,
        platform_value: platformData.operational_status ?? null,
      });
    }
  }

  // Hours — count differing days
  if (platformData.hours !== undefined && groundTruth.hours !== undefined) {
    const gtHours = groundTruth.hours;
    const platHours = platformData.hours;
    const allDays = new Set([...Object.keys(gtHours), ...Object.keys(platHours)]);

    let hoursDifferent = false;
    for (const day of allDays) {
      const gtDay = gtHours[day];
      const platDay = platHours[day];
      if (!gtDay && !platDay) continue;
      if (!gtDay || !platDay) {
        hoursDifferent = true;
        break;
      }
      if (
        gtDay.open !== platDay.open ||
        gtDay.close !== platDay.close ||
        gtDay.closed !== platDay.closed
      ) {
        hoursDifferent = true;
        break;
      }
    }

    if (hoursDifferent) {
      diffs.push({
        field: 'hours',
        ground_truth_value: JSON.stringify(gtHours),
        platform_value: JSON.stringify(platHours),
      });
    }
  }

  return diffs;
}

// ── Severity computation ────────────────────────────────────────────────────

/**
 * Computes severity from a list of discrepant fields.
 *
 * Severity rules:
 * - 'critical'  — phone or address wrong
 * - 'high'      — name or operational_status wrong
 * - 'medium'    — hours wrong
 * - 'low'       — website wrong
 * - 'none'      — no discrepant fields
 */
export function computeSeverity(
  discrepantFields: NAPField[],
): PlatformDiscrepancy['severity'] {
  if (discrepantFields.length === 0) return 'none';

  const fieldNames = new Set(discrepantFields.map((f) => f.field));

  if (fieldNames.has('phone') || fieldNames.has('address')) return 'critical';
  if (fieldNames.has('name') || fieldNames.has('operational_status')) return 'high';
  if (fieldNames.has('hours')) return 'medium';
  if (fieldNames.has('website')) return 'low';

  return 'none';
}

// ── Fix instructions ────────────────────────────────────────────────────────

const PLATFORM_FIX_URLS: Record<PlatformId, string> = {
  google: 'https://business.google.com',
  yelp: 'https://biz.yelp.com',
  apple_maps: 'https://mapsconnect.apple.com',
  bing: 'https://www.bingplaces.com',
};

const PLATFORM_NAMES: Record<PlatformId, string> = {
  google: 'Google Business Profile',
  yelp: 'Yelp for Business',
  apple_maps: 'Apple Maps Connect',
  bing: 'Bing Places',
};

/**
 * Generates human-readable fix instructions for a non-GBP platform discrepancy.
 */
export function generateFixInstructions(
  platform: PlatformId,
  discrepantFields: NAPField[],
  _groundTruth: GroundTruth,
): string {
  const platformName = PLATFORM_NAMES[platform];
  const fixUrl = PLATFORM_FIX_URLS[platform];

  const steps: string[] = [
    `1. Log into ${platformName} at ${fixUrl}`,
    `2. Find your business listing`,
    `3. Edit the business information`,
  ];

  let stepNum = 4;
  for (const field of discrepantFields) {
    const fieldLabel = field.field === 'operational_status' ? 'status' : field.field;
    steps.push(
      `${stepNum}. Update ${fieldLabel} from "${field.platform_value ?? 'missing'}" to "${field.ground_truth_value ?? 'N/A'}"`,
    );
    stepNum++;
  }

  steps.push(`${stepNum}. Save your changes`);

  return steps.join('\n');
}

// ── Main detector ───────────────────────────────────────────────────────────

/**
 * Detects discrepancies between LocalVector Ground Truth and platform live data.
 * Pure function — no side effects.
 */
export function detectDiscrepancies(
  groundTruth: GroundTruth,
  adapterResults: AdapterResult[],
): PlatformDiscrepancy[] {
  const now = new Date().toISOString();

  return adapterResults.map((result): PlatformDiscrepancy => {
    const base = {
      platform: result.platform,
      location_id: groundTruth.location_id,
      org_id: groundTruth.org_id,
      detected_at: now,
    };

    if (result.status === 'unconfigured') {
      return {
        ...base,
        status: 'unconfigured',
        discrepant_fields: [],
        severity: 'none',
        auto_correctable: false,
      };
    }

    if (result.status === 'api_error') {
      return {
        ...base,
        status: 'api_error',
        discrepant_fields: [],
        severity: 'none',
        auto_correctable: false,
      };
    }

    if (result.status === 'not_found') {
      return {
        ...base,
        status: 'not_found',
        discrepant_fields: [],
        severity: 'none',
        auto_correctable: false,
      };
    }

    // status === 'ok' — compare data
    const gtNAPData: Partial<NAPData> = {
      name: groundTruth.name,
      address: groundTruth.address,
      phone: groundTruth.phone,
      website: groundTruth.website,
      operational_status: groundTruth.operational_status as NAPData['operational_status'],
    };
    if (groundTruth.hours_data) {
      gtNAPData.hours = groundTruth.hours_data;
    }

    const diffs = diffNAPData(gtNAPData, result.data);
    const severity = computeSeverity(diffs);
    const autoCorrectable = result.platform === 'google';

    if (diffs.length === 0) {
      return {
        ...base,
        status: 'match',
        discrepant_fields: [],
        severity: 'none',
        auto_correctable: autoCorrectable,
      };
    }

    const fixInstructions =
      result.platform !== 'google'
        ? generateFixInstructions(result.platform, diffs, groundTruth)
        : undefined;

    return {
      ...base,
      status: 'discrepancy',
      discrepant_fields: diffs,
      severity,
      auto_correctable: autoCorrectable,
      fix_instructions: fixInstructions,
    };
  });
}
