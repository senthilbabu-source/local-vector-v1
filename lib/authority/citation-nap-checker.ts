// ---------------------------------------------------------------------------
// lib/authority/citation-nap-checker.ts — Citation NAP Consistency Checker
//
// Sprint 211: Extends authority mapping to check NAP data on discovered
// long-tail directory pages (Foursquare, OpenTable, TripAdvisor, etc.).
// Fetches sameas-candidate citation URLs, extracts JSON-LD structured data,
// diffs against golden record using existing Sprint 105 pure functions.
// Fail-open — any fetch/parse error skips that URL silently.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { CitationSource, GroundTruth } from './types';
import type { NAPData, NAPField } from '@/lib/nap-sync/types';
import {
  diffNAPData,
  computeSeverity,
  normalizePhone,
} from '@/lib/nap-sync/nap-discrepancy-detector';

// ── Public result type ───────────────────────────────────────────────────────

export interface CitationNAPResult {
  url: string;
  domain: string;
  discrepant_fields: NAPField[];
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  fix_instructions: string;
}

// ── JSON-LD extraction ───────────────────────────────────────────────────────

const PHONE_REGEX = /\+?1?\s*[.\-]?\s*\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/;

function parseJsonLd(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch (_err) {
    return null;
  }
}

function extractNAPFromJsonLd(obj: Record<string, unknown>): Partial<NAPData> {
  const result: Partial<NAPData> = {};

  // Handle @graph array (common in restaurant sites)
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph'] as unknown[]) {
      if (typeof item === 'object' && item !== null) {
        const candidate = extractNAPFromJsonLd(item as Record<string, unknown>);
        if (Object.keys(candidate).length > 0) return candidate;
      }
    }
  }

  const type = obj['@type'];
  const isRelevantType =
    type === 'Restaurant' ||
    type === 'FoodEstablishment' ||
    type === 'LocalBusiness' ||
    (Array.isArray(type) &&
      (type.includes('Restaurant') ||
        type.includes('FoodEstablishment') ||
        type.includes('LocalBusiness')));

  if (!isRelevantType) return result;

  if (typeof obj['name'] === 'string') {
    result.name = obj['name'];
  }

  if (typeof obj['telephone'] === 'string') {
    result.phone = obj['telephone'];
  }

  const addr = obj['address'];
  if (typeof addr === 'object' && addr !== null) {
    const a = addr as Record<string, unknown>;
    if (typeof a['streetAddress'] === 'string' && a['streetAddress']) {
      result.address = a['streetAddress'];
    }
    if (typeof a['addressLocality'] === 'string') result.city = a['addressLocality'];
    if (typeof a['addressRegion'] === 'string') result.state = a['addressRegion'];
    if (typeof a['postalCode'] === 'string') result.zip = a['postalCode'];
  } else if (typeof addr === 'string' && addr) {
    result.address = addr;
  }

  if (typeof obj['url'] === 'string') result.website = obj['url'];

  return result;
}

/**
 * Extracts NAP data from raw HTML page content.
 * Tries JSON-LD structured data first, falls back to phone regex.
 * Returns partial — only fields found in the page are included.
 */
export function extractNAPFromPage(html: string): Partial<NAPData> {
  // 1. Try all JSON-LD blocks
  const scriptRegex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    const obj = parseJsonLd(raw);
    if (!obj) continue;

    const extracted = extractNAPFromJsonLd(obj);
    if (Object.keys(extracted).length > 0) return extracted;
  }

  // 2. Phone regex fallback — useful for pages without structured data
  const phoneMatch = html.match(PHONE_REGEX);
  if (phoneMatch) {
    return { phone: normalizePhone(phoneMatch[0]) };
  }

  return {};
}

// ── Fix instructions ─────────────────────────────────────────────────────────

function buildFixInstructions(
  domain: string,
  url: string,
  fields: NAPField[],
): string {
  const steps = [
    `1. Visit your listing on ${domain}: ${url}`,
    `2. Find the "Claim" or "Edit" option for your business`,
    `3. Update the following fields:`,
  ];

  let i = 4;
  for (const f of fields) {
    steps.push(
      `${i}. ${f.field}: change "${f.platform_value ?? 'missing'}" → "${f.ground_truth_value ?? 'N/A'}"`,
    );
    i++;
  }

  steps.push(`${i}. Save and submit for review if required`);
  return steps.join('\n');
}

// ── Main checker ─────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 8_000;
const RATE_LIMIT_DELAY_MS = 500;

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (_err) {
    return url;
  }
}

/**
 * Checks NAP consistency on discovered sameas-candidate citation URLs.
 *
 * Fetches each `is_sameas_candidate` URL, extracts structured data (JSON-LD),
 * diffs against the golden record using Sprint 105 pure functions.
 *
 * Fail-open: any fetch/parse error → Sentry.captureException + skip.
 * Rate-limited: 500ms delay between requests.
 *
 * @returns Only results with at least one discrepant field.
 */
export async function checkCitationNAP(
  citations: CitationSource[],
  groundTruth: GroundTruth,
): Promise<CitationNAPResult[]> {
  const candidates = citations.filter((c) => c.is_sameas_candidate);
  if (candidates.length === 0) return [];

  const results: CitationNAPResult[] = [];

  for (const citation of candidates) {
    try {
      const response = await fetch(citation.url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': 'LocalVector-Bot/1.0 (+https://localvector.ai/bot)',
          Accept: 'text/html',
        },
      });

      if (!response.ok) continue;

      const html = await response.text();
      const scrapedNAP = extractNAPFromPage(html);

      if (Object.keys(scrapedNAP).length === 0) continue;

      const diffs = diffNAPData(
        {
          name: groundTruth.name,
          address: groundTruth.address,
          phone: groundTruth.phone,
          website: groundTruth.website,
        },
        scrapedNAP,
      );

      if (diffs.length === 0) continue;

      const domain = extractDomain(citation.url);

      results.push({
        url: citation.url,
        domain,
        discrepant_fields: diffs,
        severity: computeSeverity(diffs),
        fix_instructions: buildFixInstructions(domain, citation.url, diffs),
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { file: 'citation-nap-checker.ts', sprint: '211' },
        extra: { url: citation.url, locationId: groundTruth.location_id },
      });
      // Fail-open: continue to next citation
    }

    // Rate-limit between fetches (same pattern as website-crawler.ts)
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
  }

  return results;
}
