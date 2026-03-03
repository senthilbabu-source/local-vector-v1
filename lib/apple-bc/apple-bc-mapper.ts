// lib/apple-bc/apple-bc-mapper.ts — Sprint 130
// Maps LocalVector locations row → Apple BC format.
// PURE FUNCTIONS — no I/O.

import type { ABCLocation, ABCHours } from './apple-bc-types';
import { APPLE_CATEGORY_MAP } from './apple-bc-types';

/**
 * Format a phone number to E.164 format.
 * Input: any format. Output: +1XXXXXXXXXX or undefined if cannot convert.
 */
export function toE164(phone: string | null): string | undefined {
  if (!phone) return undefined;
  // Strip everything except digits and leading +
  const digits = phone.replace(/[^\d+]/g, '');
  // US numbers: 10 digits → +1XXXXXXXXXX
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  // Already E.164
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  // 11 digits starting with 1 → +1XXXXXXXXXX
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return undefined; // Cannot convert — omit field
}

/**
 * Convert LocalVector hours_data JSONB to ABC regularHours array.
 */
export function toABCHours(
  hours_data: Record<string, { open?: string; close?: string; closed?: boolean } | null> | null,
): ABCHours[] {
  if (!hours_data) return [];

  const dayMap: Record<string, ABCHours['dayOfWeek']> = {
    monday: 'MONDAY', tuesday: 'TUESDAY', wednesday: 'WEDNESDAY',
    thursday: 'THURSDAY', friday: 'FRIDAY', saturday: 'SATURDAY', sunday: 'SUNDAY',
  };

  const result: ABCHours[] = [];
  for (const [day, hours] of Object.entries(hours_data)) {
    const abcDay = dayMap[day.toLowerCase()];
    if (!abcDay) continue;

    if (!hours || hours.closed) {
      result.push({ dayOfWeek: abcDay, isClosed: true });
    } else if (hours.open && hours.close) {
      result.push({ dayOfWeek: abcDay, openTime: hours.open, closeTime: hours.close });
    }
  }

  return result;
}

/**
 * Map LocalVector categories JSONB array to Apple BC category IDs.
 * Returns up to 3 Apple category IDs.
 */
export function toABCCategories(categories: unknown[] | null): string[] {
  if (!Array.isArray(categories) || categories.length === 0) return [];

  return categories
    .map(cat => APPLE_CATEGORY_MAP[String(cat)] ?? null)
    .filter((c): c is string => c !== null)
    .slice(0, 3);
}

/**
 * Map LocalVector operational_status to ABC status.
 */
export function toABCStatus(
  operational_status: string | null,
): 'OPEN' | 'CLOSED_PERMANENTLY' | 'CLOSED_TEMPORARILY' {
  switch (operational_status?.toUpperCase()) {
    case 'CLOSED_PERMANENTLY': return 'CLOSED_PERMANENTLY';
    case 'CLOSED_TEMPORARILY': return 'CLOSED_TEMPORARILY';
    default: return 'OPEN';
  }
}

/**
 * Build an ABCLocation from a LocalVector locations row.
 * Only includes non-null fields (partial update safety).
 */
export function buildABCLocation(loc: {
  name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website_url: string | null;
  hours_data: unknown;
  categories: unknown;
  operational_status: string | null;
}): Partial<ABCLocation> {
  const result: Partial<ABCLocation> = {};

  result.displayName = loc.name;

  if (loc.address_line1 && loc.city && loc.state) {
    result.address = {
      addressLine1: loc.address_line1,
      city: loc.city,
      stateOrProvince: loc.state,
      postalCode: loc.zip ?? '',
      country: 'US',
    };
  }

  const phone = toE164(loc.phone);
  if (phone) result.telephone = phone;

  if (loc.website_url) result.websiteUrl = loc.website_url;

  const hours = toABCHours(loc.hours_data as Record<string, { open?: string; close?: string; closed?: boolean } | null>);
  if (hours.length > 0) result.regularHours = hours;

  const cats = toABCCategories(loc.categories as unknown[]);
  if (cats.length > 0) result.categories = cats;

  result.status = toABCStatus(loc.operational_status);

  return result;
}
