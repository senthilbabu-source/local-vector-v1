// ---------------------------------------------------------------------------
// entity-auto-detect.test.ts — Unit tests for Entity Auto-Detection
//
// Sprint 80: 8 tests — pure function, no mocks needed.
//
// Run:
//   npx vitest run src/__tests__/unit/entity-auto-detect.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { autoDetectEntityPresence } from '@/lib/services/entity-auto-detect';

// ---------------------------------------------------------------------------
// autoDetectEntityPresence
// ---------------------------------------------------------------------------

describe('autoDetectEntityPresence', () => {
  it('1. sets google_knowledge_panel=confirmed when google_place_id exists', () => {
    const result = autoDetectEntityPresence(
      { google_place_id: 'ChIJtest123', gbp_integration_id: null },
      [],
    );
    expect(result.google_knowledge_panel).toBe('confirmed');
  });

  it('2. does not set google_knowledge_panel when google_place_id is null', () => {
    const result = autoDetectEntityPresence(
      { google_place_id: null, gbp_integration_id: null },
      [],
    );
    expect(result.google_knowledge_panel).toBeUndefined();
  });

  it('3. sets google_business_profile=confirmed when GBP integration is connected', () => {
    const result = autoDetectEntityPresence(
      { google_place_id: null, gbp_integration_id: null },
      [{ platform: 'google', status: 'connected', external_id: 'ext-1' }],
    );
    expect(result.google_business_profile).toBe('confirmed');
  });

  it('4. sets google_business_profile=confirmed when gbp_integration_id exists', () => {
    const result = autoDetectEntityPresence(
      { google_place_id: null, gbp_integration_id: 'int-uuid-1' },
      [],
    );
    expect(result.google_business_profile).toBe('confirmed');
  });

  it('5. sets yelp=confirmed when yelp integration is connected', () => {
    const result = autoDetectEntityPresence(
      { google_place_id: null, gbp_integration_id: null },
      [{ platform: 'yelp', status: 'connected', external_id: 'yelp-1' }],
    );
    expect(result.yelp).toBe('confirmed');
  });

  it('6. does not set yelp when no yelp integration exists', () => {
    const result = autoDetectEntityPresence(
      { google_place_id: null, gbp_integration_id: null },
      [{ platform: 'google', status: 'connected', external_id: null }],
    );
    expect(result.yelp).toBeUndefined();
  });

  it('7. returns empty object when no data matches', () => {
    const result = autoDetectEntityPresence(
      { google_place_id: null, gbp_integration_id: null },
      [],
    );
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('8. handles empty integrations array', () => {
    const result = autoDetectEntityPresence(
      { google_place_id: 'ChIJ123', gbp_integration_id: null },
      [],
    );
    expect(result.google_knowledge_panel).toBe('confirmed');
    expect(result.google_business_profile).toBeUndefined();
    expect(result.yelp).toBeUndefined();
  });
});
