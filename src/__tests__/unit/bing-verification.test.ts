// ---------------------------------------------------------------------------
// src/__tests__/unit/bing-verification.test.ts — Sprint M (C2 Phase 2)
//
// Tests for Bing verification route helper functions:
//   findBestBingMatch — fuzzy name matching against Bing results
//   formatBingAddress — Bing address field assembly
//
// Also validates that detectDiscrepancies (from Sprint L) handles Bing
// response shapes correctly.
//
// Pure function tests — no jsdom needed.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  findBestBingMatch,
  formatBingAddress,
} from '@/app/api/integrations/verify-bing/route';
import { detectDiscrepancies } from '@/lib/integrations/detect-discrepancies';

// ---------------------------------------------------------------------------
// findBestBingMatch
// ---------------------------------------------------------------------------

describe('findBestBingMatch', () => {
  const resources = [
    { name: 'Pizza Palace', PhoneNumber: '555-1234', Address: { addressLine: '123 Main St' } },
    { name: 'Charcoal N Chill', PhoneNumber: '555-5678', Address: { addressLine: '456 Oak Ave' } },
    { name: 'Best Bites Cafe', PhoneNumber: '555-9999', Address: { addressLine: '789 Elm St' } },
  ] as Record<string, unknown>[];

  it('returns the matching resource when name matches exactly', () => {
    const result = findBestBingMatch(resources, 'Charcoal N Chill');
    expect(result).toBeDefined();
    expect(result!.name).toBe('Charcoal N Chill');
  });

  it('returns a fuzzy match when name has minor differences', () => {
    // "Charcoal and Chill" should match "Charcoal N Chill" (fuzzy: strips "and"/"n")
    const result = findBestBingMatch(resources, 'Charcoal and Chill');
    expect(result).toBeDefined();
    expect(result!.name).toBe('Charcoal N Chill');
  });

  it('falls back to first resource when no name match found', () => {
    const result = findBestBingMatch(resources, 'Totally Unknown Restaurant');
    expect(result).toBeDefined();
    expect(result!.name).toBe('Pizza Palace');
  });

  it('returns null for an empty array', () => {
    const result = findBestBingMatch([], 'Any Name');
    expect(result).toBeNull();
  });

  it('handles case-insensitive matching', () => {
    const result = findBestBingMatch(resources, 'pizza palace');
    expect(result).toBeDefined();
    expect(result!.name).toBe('Pizza Palace');
  });
});

// ---------------------------------------------------------------------------
// formatBingAddress
// ---------------------------------------------------------------------------

describe('formatBingAddress', () => {
  it('assembles all address fields correctly', () => {
    const addr = {
      addressLine: '123 Main St',
      locality: 'Atlanta',
      adminDistrict: 'GA',
      postalCode: '30301',
    };
    expect(formatBingAddress(addr)).toBe('123 Main St, Atlanta, GA, 30301');
  });

  it('handles missing fields without "undefined" in output', () => {
    const addr = {
      addressLine: '123 Main St',
      locality: 'Atlanta',
    } as Record<string, string>;
    const result = formatBingAddress(addr);
    expect(result).toBe('123 Main St, Atlanta');
    expect(result).not.toContain('undefined');
  });

  it('returns empty string for null/undefined input', () => {
    expect(formatBingAddress(null)).toBe('');
    expect(formatBingAddress(undefined)).toBe('');
  });

  it('returns empty string when all fields are missing', () => {
    expect(formatBingAddress({})).toBe('');
  });
});

// ---------------------------------------------------------------------------
// detectDiscrepancies with Bing-shaped data
// ---------------------------------------------------------------------------

describe('detectDiscrepancies with Bing data', () => {
  it('returns empty array when name and phone match', () => {
    const result = detectDiscrepancies(
      { name: 'Charcoal N Chill', phone: '+14045551234' },
      { business_name: 'Charcoal N Chill', phone: '(404) 555-1234' },
    );
    expect(result).toEqual([]);
  });

  it('flags name mismatch between Bing and local data', () => {
    const result = detectDiscrepancies(
      { name: 'Best Bites Cafe', phone: '+14045551234' },
      { business_name: 'Charcoal N Chill', phone: '(404) 555-1234' },
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((d) => d.field === 'Business name')).toBe(true);
  });

  it('flags phone digit mismatch', () => {
    const result = detectDiscrepancies(
      { name: 'Charcoal N Chill', phone: '+14045559999' },
      { business_name: 'Charcoal N Chill', phone: '(404) 555-1234' },
    );
    expect(result.some((d) => d.field === 'Phone number')).toBe(true);
  });

  it('fuzzy name match avoids false positive — "Charcoal N Chill" vs "Charcoal & Chill"', () => {
    const result = detectDiscrepancies(
      { name: 'Charcoal & Chill' },
      { business_name: 'Charcoal N Chill' },
    );
    // Should NOT flag as a discrepancy — these are the same business
    const nameDisc = result.filter((d) => d.field === 'Business name');
    expect(nameDisc).toHaveLength(0);
  });

  it('phone normalization handles +1 prefix without false positives', () => {
    const result = detectDiscrepancies(
      { name: 'Test Biz', phone: '+1 404-555-1234' },
      { business_name: 'Test Biz', phone: '4045551234' },
    );
    const phoneDisc = result.filter((d) => d.field === 'Phone number');
    expect(phoneDisc).toHaveLength(0);
  });
});
