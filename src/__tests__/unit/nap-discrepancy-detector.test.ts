/**
 * Sprint 105 — NAP Discrepancy Detector unit tests.
 * Target: lib/nap-sync/nap-discrepancy-detector.ts
 * Pure functions — zero mocks needed.
 */

import { describe, it, expect } from 'vitest';
import {
  detectDiscrepancies,
  diffNAPData,
  normalizePhone,
  normalizeAddress,
  computeSeverity,
  generateFixInstructions,
} from '@/lib/nap-sync/nap-discrepancy-detector';
import {
  MOCK_GROUND_TRUTH,
  MOCK_GBP_NAP_RESULT,
  MOCK_YELP_NAP_RESULT,
  MOCK_APPLE_MAPS_NAP_RESULT,
  MOCK_BING_NAP_RESULT,
} from '@/__fixtures__/golden-tenant';
import type { AdapterResult, NAPField, GroundTruth } from '@/lib/nap-sync/types';

describe('detectDiscrepancies', () => {
  it('returns empty discrepant_fields when all NAP data matches ground truth', () => {
    const result = detectDiscrepancies(MOCK_GROUND_TRUTH, [MOCK_GBP_NAP_RESULT]);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('match');
    expect(result[0].discrepant_fields).toEqual([]);
  });

  it('detects phone discrepancy (Yelp stale phone scenario)', () => {
    const result = detectDiscrepancies(MOCK_GROUND_TRUTH, [MOCK_YELP_NAP_RESULT]);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('discrepancy');
    expect(result[0].discrepant_fields.some((f) => f.field === 'phone')).toBe(true);
  });

  it('detects name discrepancy (casing differences are normalized)', () => {
    const adapter: AdapterResult = {
      status: 'ok',
      platform: 'yelp',
      data: { ...MOCK_GBP_NAP_RESULT.status === 'ok' ? MOCK_GBP_NAP_RESULT.data : {}, name: 'CHARCOAL N CHILL' },
      fetched_at: '2026-03-01T03:00:00.000Z',
    };
    const result = detectDiscrepancies(MOCK_GROUND_TRUTH, [adapter]);
    // Casing should be normalized — should be a match
    expect(result[0].status).toBe('match');
  });

  it('detects address discrepancy (abbreviation normalization: "Rd" vs "Road")', () => {
    const adapter: AdapterResult = {
      status: 'ok',
      platform: 'yelp',
      data: { name: 'Charcoal N Chill', address: '11950 Jones Bridge Rd Ste 103', phone: '(470) 546-4866' },
      fetched_at: '2026-03-01T03:00:00.000Z',
    };
    const result = detectDiscrepancies(MOCK_GROUND_TRUTH, [adapter]);
    // "Road" vs "Rd" should normalize to the same thing
    expect(result[0].discrepant_fields.some((f) => f.field === 'address')).toBe(false);
  });

  it('detects website discrepancy (trailing slash normalization)', () => {
    const adapter: AdapterResult = {
      status: 'ok',
      platform: 'yelp',
      data: { name: 'Charcoal N Chill', phone: '(470) 546-4866', website: 'https://charcoalnchill.com/' },
      fetched_at: '2026-03-01T03:00:00.000Z',
    };
    const result = detectDiscrepancies(MOCK_GROUND_TRUTH, [adapter]);
    // Trailing slash should normalize
    expect(result[0].discrepant_fields.some((f) => f.field === 'website')).toBe(false);
  });

  it("status 'unconfigured' adapter produces discrepancy with status 'unconfigured'", () => {
    const result = detectDiscrepancies(MOCK_GROUND_TRUTH, [MOCK_APPLE_MAPS_NAP_RESULT]);
    expect(result[0].status).toBe('unconfigured');
    expect(result[0].discrepant_fields).toEqual([]);
  });

  it("status 'api_error' adapter produces discrepancy with status 'api_error'", () => {
    const adapter: AdapterResult = {
      status: 'api_error',
      platform: 'yelp',
      message: 'Rate limited',
      http_status: 429,
    };
    const result = detectDiscrepancies(MOCK_GROUND_TRUTH, [adapter]);
    expect(result[0].status).toBe('api_error');
    expect(result[0].discrepant_fields).toEqual([]);
  });

  it("status 'not_found' adapter produces discrepancy with status 'not_found'", () => {
    const result = detectDiscrepancies(MOCK_GROUND_TRUTH, [MOCK_BING_NAP_RESULT]);
    expect(result[0].status).toBe('not_found');
    expect(result[0].discrepant_fields).toEqual([]);
  });

  it('GBP match has auto_correctable = true', () => {
    const result = detectDiscrepancies(MOCK_GROUND_TRUTH, [MOCK_GBP_NAP_RESULT]);
    expect(result[0].auto_correctable).toBe(true);
  });

  it('Yelp discrepancy has auto_correctable = false', () => {
    const result = detectDiscrepancies(MOCK_GROUND_TRUTH, [MOCK_YELP_NAP_RESULT]);
    expect(result[0].auto_correctable).toBe(false);
  });

  it('Apple Maps discrepancy has auto_correctable = false', () => {
    const result = detectDiscrepancies(MOCK_GROUND_TRUTH, [MOCK_APPLE_MAPS_NAP_RESULT]);
    expect(result[0].auto_correctable).toBe(false);
  });

  it('Bing discrepancy has auto_correctable = false', () => {
    const result = detectDiscrepancies(MOCK_GROUND_TRUTH, [MOCK_BING_NAP_RESULT]);
    expect(result[0].auto_correctable).toBe(false);
  });

  it("MOCK_YELP_ADAPTER_RESULT produces severity 'critical' (phone wrong)", () => {
    const result = detectDiscrepancies(MOCK_GROUND_TRUTH, [MOCK_YELP_NAP_RESULT]);
    expect(result[0].severity).toBe('critical');
  });

  it('processes 4 adapters in parallel, returns 4 PlatformDiscrepancy objects', () => {
    const result = detectDiscrepancies(MOCK_GROUND_TRUTH, [
      MOCK_GBP_NAP_RESULT,
      MOCK_YELP_NAP_RESULT,
      MOCK_APPLE_MAPS_NAP_RESULT,
      MOCK_BING_NAP_RESULT,
    ]);
    expect(result).toHaveLength(4);
  });
});

describe('diffNAPData', () => {
  it('returns empty array when all fields match', () => {
    const gt = { name: 'Test', phone: '+14705551234' };
    const platform = { name: 'Test', phone: '+14705551234' };
    expect(diffNAPData(gt, platform)).toEqual([]);
  });

  it("returns [{ field: 'phone' }] when phone differs", () => {
    const gt = { name: 'Test', phone: '+14705551234' };
    const platform = { name: 'Test', phone: '+14705559999' };
    const result = diffNAPData(gt, platform);
    expect(result).toHaveLength(1);
    expect(result[0].field).toBe('phone');
  });

  it("returns [{ field: 'name' }] when name differs", () => {
    const gt = { name: 'Test Business' };
    const platform = { name: 'Wrong Business' };
    const result = diffNAPData(gt, platform);
    expect(result).toHaveLength(1);
    expect(result[0].field).toBe('name');
  });

  it('returns multiple fields when multiple differ', () => {
    const gt = { name: 'Test', phone: '+14705551234', website: 'https://test.com' };
    const platform = { name: 'Wrong', phone: '+14705559999', website: 'https://other.com' };
    const result = diffNAPData(gt, platform);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('ignores fields that are undefined in platformData', () => {
    const gt = { name: 'Test', phone: '+14705551234', website: 'https://test.com' };
    const platform = { name: 'Test' }; // phone and website not present
    const result = diffNAPData(gt, platform);
    expect(result).toEqual([]);
  });
});

describe('normalizePhone', () => {
  it("'+1 (470) 555-0123' → '4705550123'", () => {
    expect(normalizePhone('+1 (470) 555-0123')).toBe('4705550123');
  });

  it("'470-555-0123' → '4705550123'", () => {
    expect(normalizePhone('470-555-0123')).toBe('4705550123');
  });

  it("'+14705550123' → '4705550123'", () => {
    expect(normalizePhone('+14705550123')).toBe('4705550123');
  });

  it("'(470) 555.0123' → '4705550123'", () => {
    expect(normalizePhone('(470) 555.0123')).toBe('4705550123');
  });

  it("'4705550123' → '4705550123'", () => {
    expect(normalizePhone('4705550123')).toBe('4705550123');
  });
});

describe('normalizeAddress', () => {
  it('lowercases and strips punctuation', () => {
    const result = normalizeAddress('11950 Jones Bridge Road, Ste 103');
    expect(result).toBe('11950 jones bridge road suite 103');
  });

  it("'Rd.' → 'road'", () => {
    expect(normalizeAddress('Main Rd.')).toContain('road');
  });

  it("'St.' → 'street'", () => {
    expect(normalizeAddress('Main St.')).toContain('street');
  });

  it("'Blvd.' → 'boulevard'", () => {
    expect(normalizeAddress('Main Blvd.')).toContain('boulevard');
  });

  it("'Ave.' → 'avenue'", () => {
    expect(normalizeAddress('Main Ave.')).toContain('avenue');
  });

  it('ignores extra whitespace', () => {
    const result = normalizeAddress('11950  Jones   Bridge   Road');
    expect(result).toBe('11950 jones bridge road');
  });
});

describe('computeSeverity', () => {
  it("phone field discrepancy → 'critical'", () => {
    const fields: NAPField[] = [{ field: 'phone', ground_truth_value: 'a', platform_value: 'b' }];
    expect(computeSeverity(fields)).toBe('critical');
  });

  it("address field discrepancy → 'critical'", () => {
    const fields: NAPField[] = [{ field: 'address', ground_truth_value: 'a', platform_value: 'b' }];
    expect(computeSeverity(fields)).toBe('critical');
  });

  it("name field discrepancy → 'high'", () => {
    const fields: NAPField[] = [{ field: 'name', ground_truth_value: 'a', platform_value: 'b' }];
    expect(computeSeverity(fields)).toBe('high');
  });

  it("hours discrepancy → 'medium'", () => {
    const fields: NAPField[] = [{ field: 'hours', ground_truth_value: '{}', platform_value: '{}' }];
    expect(computeSeverity(fields)).toBe('medium');
  });

  it("website discrepancy only → 'low'", () => {
    const fields: NAPField[] = [{ field: 'website', ground_truth_value: 'a', platform_value: 'b' }];
    expect(computeSeverity(fields)).toBe('low');
  });

  it("no discrepant fields → 'none'", () => {
    expect(computeSeverity([])).toBe('none');
  });
});

describe('generateFixInstructions', () => {
  const gt: GroundTruth = { ...MOCK_GROUND_TRUTH };

  it('generates Yelp-specific instructions for phone discrepancy', () => {
    const fields: NAPField[] = [{ field: 'phone', ground_truth_value: gt.phone, platform_value: '+14705559999' }];
    const result = generateFixInstructions('yelp', fields, gt);
    expect(result).toContain('Yelp');
    expect(result).toContain('biz.yelp.com');
  });

  it('generates Bing-specific instructions for name discrepancy', () => {
    const fields: NAPField[] = [{ field: 'name', ground_truth_value: gt.name, platform_value: 'Wrong Name' }];
    const result = generateFixInstructions('bing', fields, gt);
    expect(result).toContain('Bing Places');
  });

  it('generates Apple Maps-specific instructions for address discrepancy', () => {
    const fields: NAPField[] = [{ field: 'address', ground_truth_value: gt.address, platform_value: 'Wrong Addr' }];
    const result = generateFixInstructions('apple_maps', fields, gt);
    expect(result).toContain('Apple Maps');
  });

  it('instructions contain the ground_truth_value', () => {
    const fields: NAPField[] = [{ field: 'phone', ground_truth_value: gt.phone, platform_value: '+14705559999' }];
    const result = generateFixInstructions('yelp', fields, gt);
    expect(result).toContain(gt.phone);
  });

  it('instructions contain the platform_value', () => {
    const fields: NAPField[] = [{ field: 'phone', ground_truth_value: gt.phone, platform_value: '+14705559999' }];
    const result = generateFixInstructions('yelp', fields, gt);
    expect(result).toContain('+14705559999');
  });
});
