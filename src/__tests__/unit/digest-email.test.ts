// ---------------------------------------------------------------------------
// src/__tests__/unit/digest-email.test.ts
//
// Sprint 117: Tests for the WeeklyDigest React Email template and the
// formatWeekOf pure helper exported from emails/WeeklyDigest.tsx.
//
// Renders the component via @react-email/components render() and asserts
// on the resulting HTML string.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render } from '@react-email/components';
import WeeklyDigest, { formatWeekOf } from '@/emails/WeeklyDigest';
import { MOCK_WEEKLY_DIGEST_PAYLOAD } from '@/__fixtures__/golden-tenant';
import type { WeeklyDigestPayload } from '@/lib/digest/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render the WeeklyDigest template to an HTML string. */
async function renderDigest(overrides: Partial<WeeklyDigestPayload> = {}): Promise<string> {
  const payload: WeeklyDigestPayload = {
    ...MOCK_WEEKLY_DIGEST_PAYLOAD,
    ...overrides,
  };
  return render(WeeklyDigest({ payload }));
}

// ---------------------------------------------------------------------------
// WeeklyDigest email rendering
// ---------------------------------------------------------------------------

describe('WeeklyDigest email rendering', () => {
  it('renders without crashing with mock payload', async () => {
    const html = await renderDigest();
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(0);
  });

  it('contains org name in output', async () => {
    const html = await renderDigest();
    expect(html).toContain('Charcoal N Chill');
  });

  it('contains SOV score as percentage', async () => {
    const html = await renderDigest();
    // current_sov is 42 in the fixture → should appear as "42%"
    expect(html).toContain('42%');
  });

  it('trend up → contains upward arrow', async () => {
    const html = await renderDigest({
      sov_trend: {
        ...MOCK_WEEKLY_DIGEST_PAYLOAD.sov_trend,
        trend: 'up',
        delta: 5,
      },
    });
    // Unicode ↑ = \u2191
    expect(html).toContain('\u2191');
  });

  it('trend down → contains downward arrow', async () => {
    const html = await renderDigest({
      sov_trend: {
        ...MOCK_WEEKLY_DIGEST_PAYLOAD.sov_trend,
        trend: 'down',
        delta: -3,
        current_sov: 34,
        previous_sov: 37,
      },
    });
    // Unicode ↓ = \u2193
    expect(html).toContain('\u2193');
  });

  it('trend flat → contains rightward arrow (no directional arrow)', async () => {
    const html = await renderDigest({
      sov_trend: {
        ...MOCK_WEEKLY_DIGEST_PAYLOAD.sov_trend,
        trend: 'flat',
        delta: 0,
        current_sov: 42,
        previous_sov: 42,
      },
    });
    // Unicode → = \u2192
    expect(html).toContain('\u2192');
    // Should NOT contain ↑ or ↓
    expect(html).not.toContain('\u2191');
    expect(html).not.toContain('\u2193');
  });

  it('citations section renders query_text values', async () => {
    const html = await renderDigest();
    // Fixture has two citations
    expect(html).toContain('best hookah lounge near Alpharetta');
    expect(html).toContain('upscale hookah bar Atlanta');
  });

  it('missed_queries section renders query_text values', async () => {
    const html = await renderDigest();
    // Fixture has two missed queries
    expect(html).toContain('hookah bar with private events');
    expect(html).toContain('Indian fusion restaurant Alpharetta');
  });

  it('first_mover_alert section renders when alert present', async () => {
    const html = await renderDigest({
      first_mover_alert: {
        query_text: 'hookah lounge open late night',
        detected_at: '2026-03-01T10:00:00Z',
        action_url: '/dashboard/content/new?query=hookah+lounge+open+late+night',
      },
    });
    expect(html).toContain('First Mover Opportunity');
    expect(html).toContain('hookah lounge open late night');
  });

  it('first_mover_alert section absent when alert = null', async () => {
    const html = await renderDigest({
      first_mover_alert: null,
    });
    expect(html).not.toContain('First Mover Opportunity');
  });

  it('unsubscribe link contains unsubscribe_token', async () => {
    const html = await renderDigest();
    // The token from the fixture
    expect(html).toContain(MOCK_WEEKLY_DIGEST_PAYLOAD.unsubscribe_token);
    expect(html).toContain('Unsubscribe from weekly reports');
  });

  it('org_primary_color applied to header', async () => {
    const html = await renderDigest({
      org_primary_color: '#ff5500',
    });
    // The DigestHeader uses primaryColor as backgroundColor inline style
    expect(html).toContain('#ff5500');
  });

  it('org_logo_url present → img tag rendered', async () => {
    const logoUrl = 'https://example.com/logo.png';
    const html = await renderDigest({
      org_logo_url: logoUrl,
    });
    // DigestHeader renders an <Img> when logoUrl is truthy
    expect(html).toContain('<img');
    expect(html).toContain(logoUrl);
  });
});

// ---------------------------------------------------------------------------
// formatWeekOf — pure
// ---------------------------------------------------------------------------

describe('formatWeekOf — pure', () => {
  it("'2026-03-02' → 'March 2, 2026'", () => {
    expect(formatWeekOf('2026-03-02')).toBe('March 2, 2026');
  });

  it("'2026-01-01' → 'January 1, 2026'", () => {
    expect(formatWeekOf('2026-01-01')).toBe('January 1, 2026');
  });

  it("'2026-12-28' → 'December 28, 2026'", () => {
    expect(formatWeekOf('2026-12-28')).toBe('December 28, 2026');
  });
});
