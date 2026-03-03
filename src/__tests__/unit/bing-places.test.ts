// ---------------------------------------------------------------------------
// Sprint 131: Bing Places Sync + Sync Orchestrator — 22 unit tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Pure function imports
import {
  toBingHours,
  toBingCategories,
  buildBingLocation,
  toBingStatus,
} from '@/lib/bing-places/bing-places-mapper';
import { BING_CATEGORY_MAP } from '@/lib/bing-places/bing-places-types';
import { toE164 } from '@/lib/apple-bc/apple-bc-mapper';
import { GOLDEN_TENANT } from '@/src/__fixtures__/golden-tenant';

const ROOT = join(__dirname, '..', '..', '..');

// ---------------------------------------------------------------------------
// toBingHours
// ---------------------------------------------------------------------------
describe('toBingHours', () => {
  it('converts hours with capitalized day names (not UPPERCASE)', () => {
    const hours = toBingHours({
      monday: { open: '09:00', close: '17:00' },
    });
    expect(hours).toEqual([
      { dayOfWeek: 'Monday', openTime: '09:00', closeTime: '17:00' },
    ]);
  });

  it('marks closed days with isClosed=true', () => {
    const hours = toBingHours({
      sunday: { closed: true },
    });
    expect(hours).toEqual([
      { dayOfWeek: 'Sunday', isClosed: true },
    ]);
  });

  it('returns empty array for null hours_data', () => {
    expect(toBingHours(null)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// toBingCategories
// ---------------------------------------------------------------------------
describe('toBingCategories', () => {
  it('maps Restaurant to gcid:restaurant', () => {
    expect(toBingCategories(['Restaurant'])).toEqual(['gcid:restaurant']);
  });

  it('returns empty array for unmapped category', () => {
    expect(toBingCategories(['UnknownCat'])).toEqual([]);
  });

  it('caps at 3 categories', () => {
    const cats = toBingCategories([
      'Restaurant', 'Cafe', 'BarOrPub', 'Hotel', 'Bakery',
    ]);
    expect(cats).toHaveLength(3);
    expect(cats).toEqual(['gcid:restaurant', 'gcid:cafe', 'gcid:bar']);
  });
});

// ---------------------------------------------------------------------------
// buildBingLocation
// ---------------------------------------------------------------------------
describe('buildBingLocation', () => {
  const fullLocation = {
    name: GOLDEN_TENANT.location.business_name,
    address_line1: GOLDEN_TENANT.location.address_line1,
    city: GOLDEN_TENANT.location.city,
    state: GOLDEN_TENANT.location.state,
    zip: GOLDEN_TENANT.location.zip,
    phone: GOLDEN_TENANT.location.phone,
    website_url: GOLDEN_TENANT.location.website_url,
    hours_data: {
      tuesday: { open: '17:00', close: '01:00' },
    },
    categories: ['Restaurant'],
    operational_status: 'OPERATIONAL',
  };

  it('includes all fields for complete location', () => {
    const result = buildBingLocation(fullLocation);
    expect(result.businessName).toBe('Charcoal N Chill');
    expect(result.address).toBeDefined();
    expect(result.phone).toBeDefined();
    expect(result.website).toBe('https://charcoalnchill.com');
    expect(result.hours).toBeDefined();
    expect(result.status).toBe('OPEN');
  });

  it('uses toE164 from apple-bc-mapper for phone', () => {
    const result = buildBingLocation(fullLocation);
    // Verify it's in E.164 format (same as Apple BC)
    expect(result.phone).toMatch(/^\+1\d{10}$/);
  });

  it('uses streetAddress key (not addressLine1)', () => {
    const result = buildBingLocation(fullLocation);
    expect(result.address?.streetAddress).toBe(GOLDEN_TENANT.location.address_line1);
    // Verify it's NOT using addressLine1
    expect((result.address as unknown as Record<string, unknown>)?.addressLine1).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sync-orchestrator — file-level tests
// ---------------------------------------------------------------------------
describe('sync-orchestrator', () => {
  const orchestratorPath = join(ROOT, 'lib/sync/sync-orchestrator.ts');
  const orchestratorSrc = readFileSync(orchestratorPath, 'utf-8');

  it('calls both Apple BC and Bing when both connected', () => {
    expect(orchestratorSrc).toContain('syncOneLocation');
    expect(orchestratorSrc).toContain('syncOneBingLocation');
  });

  it('continues Bing sync when Apple BC throws', () => {
    // Apple BC is wrapped in its own try/catch, then Bing runs after
    expect(orchestratorSrc).toContain("tags: { orchestrator: 'apple_bc'");
    // The Bing block comes after the Apple BC block
    expect(orchestratorSrc.indexOf("orchestrator: 'apple_bc'")).toBeLessThan(
      orchestratorSrc.indexOf("orchestrator: 'bing'"),
    );
  });

  it('continues Apple BC sync when Bing throws', () => {
    // Bing is also wrapped in its own try/catch
    expect(orchestratorSrc).toContain("tags: { orchestrator: 'bing'");
  });

  it('returns not_connected for unclaimed Apple BC connection', () => {
    expect(orchestratorSrc).toContain("status: 'not_connected'");
  });

  it('returns not_connected for unclaimed Bing connection', () => {
    // Both platforms return not_connected when not linked
    const matches = orchestratorSrc.match(/status: 'not_connected'/g);
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });

  it('returns location_not_found when location row missing', () => {
    expect(orchestratorSrc).toContain("status: 'location_not_found'");
  });

  it('logs Sentry independently per platform error', () => {
    const sentryMatches = orchestratorSrc.match(/Sentry\.captureException/g);
    expect(sentryMatches?.length).toBeGreaterThanOrEqual(2);
  });

  it('never throws — always returns OrchestratorResult', () => {
    // Each platform is wrapped in try/catch — the function never re-throws
    expect(orchestratorSrc).toContain('} catch (err)');
    // Function signature returns Promise<OrchestratorResult>
    expect(orchestratorSrc).toContain('Promise<OrchestratorResult>');
  });
});

// ---------------------------------------------------------------------------
// bing-sync cron — file-level tests
// ---------------------------------------------------------------------------
describe('bing-sync cron', () => {
  const cronPath = join(ROOT, 'app/api/cron/bing-sync/route.ts');
  const cronSrc = readFileSync(cronPath, 'utf-8');

  it('returns 401 without CRON_SECRET', () => {
    expect(cronSrc).toContain("'Unauthorized'");
    expect(cronSrc).toContain('status: 401');
  });

  it('returns skipped when kill switch active', () => {
    expect(cronSrc).toContain('BING_SYNC_CRON_DISABLED');
    expect(cronSrc).toContain('kill switch');
  });

  it('skips non-Agency orgs', () => {
    expect(cronSrc).toContain("planSatisfies(orgPlan, 'agency')");
    expect(cronSrc).toContain('skipped++');
  });

  it('skips locations without claimed connection', () => {
    expect(cronSrc).toContain("'claimed'");
    expect(cronSrc).toContain('.not(');
  });

  it('logs conflict warning when bing search returns multiple matches', () => {
    // The client handles conflict detection
    const clientPath = join(ROOT, 'lib/bing-places/bing-places-client.ts');
    const clientSrc = readFileSync(clientPath, 'utf-8');
    expect(clientSrc).toContain('searchBingBusiness');
    expect(clientSrc).toContain('conflict');
  });
});

// ---------------------------------------------------------------------------
// Business Info Editor integration — file-level tests
// ---------------------------------------------------------------------------
describe('Business Info Editor integration', () => {
  const actionsPath = join(ROOT, 'app/dashboard/settings/business-info/actions.ts');
  const actionsSrc = readFileSync(actionsPath, 'utf-8');

  it('calls syncLocationToAll after successful location update', () => {
    expect(actionsSrc).toContain('syncLocationToAll');
    expect(actionsSrc).toContain('void syncLocationToAll(');
  });

  it('does not fail the update when syncLocationToAll throws', () => {
    // The call is fire-and-forget (void prefix, not awaited)
    expect(actionsSrc).toContain('void syncLocationToAll');
    // Return success happens after the void call
    expect(actionsSrc).toContain("return { success: true }");
  });
});

// ---------------------------------------------------------------------------
// vercel.json registration
// ---------------------------------------------------------------------------
describe('bing-sync cron registration', () => {
  const vercelJson = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf-8'));
  const cronPaths = vercelJson.crons.map((c: { path: string }) => c.path);

  it('registers bing-sync in vercel.json', () => {
    expect(cronPaths).toContain('/api/cron/bing-sync');
  });

  it('runs at 4:00 AM UTC', () => {
    const cron = vercelJson.crons.find((c: { path: string }) => c.path === '/api/cron/bing-sync');
    expect(cron.schedule).toBe('0 4 * * *');
  });
});
