/**
 * Sprint 105 — NAP Push Corrections unit tests.
 * Target: lib/nap-sync/nap-push-corrections.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildGBPPatchBody } from '@/lib/nap-sync/nap-push-corrections';
import { MOCK_GROUND_TRUTH } from '@/__fixtures__/golden-tenant';
import type { NAPField, GroundTruth } from '@/lib/nap-sync/types';

const gt: GroundTruth = { ...MOCK_GROUND_TRUTH };

describe('buildGBPPatchBody', () => {
  it("phone correction → body has phoneNumbers.primaryPhone, updateMask includes 'phoneNumbers'", () => {
    const corrections: NAPField[] = [
      { field: 'phone', ground_truth_value: gt.phone, platform_value: '+14705559999' },
    ];
    const { body, updateMask } = buildGBPPatchBody(corrections, gt);
    expect(body.phoneNumbers?.primaryPhone).toBe(gt.phone);
    expect(updateMask).toContain('phoneNumbers');
  });

  it("name correction → body has title, updateMask includes 'title'", () => {
    const corrections: NAPField[] = [
      { field: 'name', ground_truth_value: gt.name, platform_value: 'Wrong Name' },
    ];
    const { body, updateMask } = buildGBPPatchBody(corrections, gt);
    expect(body.title).toBe(gt.name);
    expect(updateMask).toContain('title');
  });

  it("address correction → body has storefrontAddress, updateMask includes 'storefrontAddress'", () => {
    const corrections: NAPField[] = [
      { field: 'address', ground_truth_value: gt.address, platform_value: 'Wrong Address' },
    ];
    const { body, updateMask } = buildGBPPatchBody(corrections, gt);
    expect(body.storefrontAddress?.addressLines).toContain(gt.address);
    expect(body.storefrontAddress?.locality).toBe(gt.city);
    expect(body.storefrontAddress?.administrativeArea).toBe(gt.state);
    expect(body.storefrontAddress?.postalCode).toBe(gt.zip);
    expect(updateMask).toContain('storefrontAddress');
  });

  it("website correction → body has websiteUri, updateMask includes 'websiteUri'", () => {
    const corrections: NAPField[] = [
      { field: 'website', ground_truth_value: gt.website!, platform_value: 'https://wrong.com' },
    ];
    const { body, updateMask } = buildGBPPatchBody(corrections, gt);
    expect(body.websiteUri).toBe(gt.website);
    expect(updateMask).toContain('websiteUri');
  });

  it('multiple corrections → updateMask is comma-separated, body has all fields', () => {
    const corrections: NAPField[] = [
      { field: 'name', ground_truth_value: gt.name, platform_value: 'Wrong' },
      { field: 'phone', ground_truth_value: gt.phone, platform_value: 'Wrong' },
      { field: 'website', ground_truth_value: gt.website!, platform_value: 'Wrong' },
    ];
    const { body, updateMask } = buildGBPPatchBody(corrections, gt);
    expect(body.title).toBe(gt.name);
    expect(body.phoneNumbers?.primaryPhone).toBe(gt.phone);
    expect(body.websiteUri).toBe(gt.website);
    expect(updateMask.split(',')).toHaveLength(3);
  });

  it('hours field is NEVER included in patch body', () => {
    const corrections: NAPField[] = [
      { field: 'hours', ground_truth_value: '{}', platform_value: '{}' },
    ];
    const { body, updateMask } = buildGBPPatchBody(corrections, gt);
    expect(updateMask).toBe('');
    expect(Object.keys(body)).toHaveLength(0);
  });

  it('operational_status field is NEVER included in patch body', () => {
    const corrections: NAPField[] = [
      { field: 'operational_status', ground_truth_value: 'open', platform_value: 'closed' },
    ];
    const { body, updateMask } = buildGBPPatchBody(corrections, gt);
    expect(updateMask).toBe('');
    expect(Object.keys(body)).toHaveLength(0);
  });
});
