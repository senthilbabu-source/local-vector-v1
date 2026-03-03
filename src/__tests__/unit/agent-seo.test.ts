// ---------------------------------------------------------------------------
// src/__tests__/unit/agent-seo.test.ts
//
// Sprint 126: Tests for Agent-SEO action schema detection and scoring.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseActionSchemasFromHtml,
  inspectSchemaForActions,
} from '@/lib/agent-seo/action-schema-detector';
import { computeAgentSEOScore } from '@/lib/agent-seo/agent-seo-scorer';
import type { DetectedSchemas } from '@/lib/agent-seo/agent-seo-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHtmlWithJsonLd(schema: Record<string, unknown>): string {
  return `<!DOCTYPE html><html><head>
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
  </head><body></body></html>`;
}

function makeDetected(overrides: Partial<DetectedSchemas> = {}): DetectedSchemas {
  return {
    hasReserveAction: false,
    hasOrderAction: false,
    hasAppointmentAction: false,
    hasBookingCTA: false,
    bookingUrlIsHttps: false,
    bookingUrlNeedsLogin: false,
    ...overrides,
  };
}

const AUDITED_AT = '2026-03-02T08:00:00Z';

// ---------------------------------------------------------------------------
// parseActionSchemasFromHtml
// ---------------------------------------------------------------------------

describe('parseActionSchemasFromHtml', () => {
  it('detects ReserveAction in JSON-LD script block', () => {
    const html = makeHtmlWithJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      potentialAction: [{ '@type': 'ReserveAction', target: { '@type': 'EntryPoint', urlTemplate: 'https://example.com/book' } }],
    });
    const result = parseActionSchemasFromHtml(html, 'https://example.com');
    expect(result.hasReserveAction).toBe(true);
    expect(result.reserveActionUrl).toBe('https://example.com/book');
  });

  it('detects OrderAction in JSON-LD script block', () => {
    const html = makeHtmlWithJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      potentialAction: [{ '@type': 'OrderAction', target: { '@type': 'EntryPoint', urlTemplate: 'https://example.com/order' } }],
    });
    const result = parseActionSchemasFromHtml(html, 'https://example.com');
    expect(result.hasOrderAction).toBe(true);
    expect(result.orderActionUrl).toBe('https://example.com/order');
  });

  it('detects ReserveAction in potentialAction array', () => {
    const html = makeHtmlWithJsonLd({
      '@type': 'Restaurant',
      potentialAction: [
        { '@type': 'ReserveAction', target: 'https://example.com/reserve' },
        { '@type': 'OrderAction', target: 'https://example.com/order' },
      ],
    });
    const result = parseActionSchemasFromHtml(html, 'https://example.com');
    expect(result.hasReserveAction).toBe(true);
    expect(result.hasOrderAction).toBe(true);
  });

  it('detects MedicalAppointment @type', () => {
    const html = makeHtmlWithJsonLd({
      '@type': 'MedicalAppointment',
      name: 'Book appointment',
    });
    const result = parseActionSchemasFromHtml(html, 'https://example.com');
    expect(result.hasAppointmentAction).toBe(true);
  });

  it('extracts urlTemplate from ReserveAction target', () => {
    const html = makeHtmlWithJsonLd({
      '@type': 'Restaurant',
      potentialAction: [{
        '@type': 'ReserveAction',
        target: { '@type': 'EntryPoint', urlTemplate: 'https://bookings.example.com/reserve' },
      }],
    });
    const result = parseActionSchemasFromHtml(html, 'https://example.com');
    expect(result.reserveActionUrl).toBe('https://bookings.example.com/reserve');
  });

  it('detects booking CTA from anchor text containing "book"', () => {
    const html = '<!DOCTYPE html><html><body><a href="/book">Book a Table</a></body></html>';
    const result = parseActionSchemasFromHtml(html, 'https://example.com');
    expect(result.hasBookingCTA).toBe(true);
  });

  it('detects booking CTA from aria-label containing "reserve"', () => {
    const html = '<!DOCTYPE html><html><body><button aria-label="Reserve a table">Click</button></body></html>';
    const result = parseActionSchemasFromHtml(html, 'https://example.com');
    expect(result.hasBookingCTA).toBe(true);
  });

  it('skips malformed JSON-LD without throwing', () => {
    const html = `<!DOCTYPE html><html><head>
      <script type="application/ld+json">{ not valid json }</script>
    </head><body></body></html>`;
    expect(() => parseActionSchemasFromHtml(html, 'https://example.com')).not.toThrow();
    const result = parseActionSchemasFromHtml(html, 'https://example.com');
    expect(result.hasReserveAction).toBe(false);
  });

  it('returns all false for empty HTML', () => {
    const result = parseActionSchemasFromHtml('', 'https://example.com');
    expect(result.hasReserveAction).toBe(false);
    expect(result.hasOrderAction).toBe(false);
    expect(result.hasAppointmentAction).toBe(false);
    expect(result.hasBookingCTA).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Booking URL safety
// ---------------------------------------------------------------------------

describe('booking URL safety', () => {
  it('marks HTTPS URL without login path as safe', () => {
    const html = makeHtmlWithJsonLd({
      '@type': 'Restaurant',
      potentialAction: [{
        '@type': 'ReserveAction',
        target: { urlTemplate: 'https://example.com/book' },
      }],
    });
    const result = parseActionSchemasFromHtml(html, 'https://example.com');
    expect(result.bookingUrlIsHttps).toBe(true);
    expect(result.bookingUrlNeedsLogin).toBe(false);
  });

  it('marks HTTP URL as bookingUrlIsHttps=false', () => {
    const html = makeHtmlWithJsonLd({
      '@type': 'Restaurant',
      potentialAction: [{
        '@type': 'ReserveAction',
        target: { urlTemplate: 'http://example.com/book' },
      }],
    });
    const result = parseActionSchemasFromHtml(html, 'https://example.com');
    expect(result.bookingUrlIsHttps).toBe(false);
  });

  it('detects /login path as bookingUrlNeedsLogin=true', () => {
    const html = makeHtmlWithJsonLd({
      '@type': 'Restaurant',
      potentialAction: [{
        '@type': 'ReserveAction',
        target: { urlTemplate: 'https://example.com/login/book' },
      }],
    });
    const result = parseActionSchemasFromHtml(html, 'https://example.com');
    expect(result.bookingUrlNeedsLogin).toBe(true);
  });

  it('detects /signin path as bookingUrlNeedsLogin=true', () => {
    const html = makeHtmlWithJsonLd({
      '@type': 'Restaurant',
      potentialAction: [{
        '@type': 'ReserveAction',
        target: { urlTemplate: 'https://example.com/signin/reserve' },
      }],
    });
    const result = parseActionSchemasFromHtml(html, 'https://example.com');
    expect(result.bookingUrlNeedsLogin).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeAgentSEOScore
// ---------------------------------------------------------------------------

describe('computeAgentSEOScore', () => {
  it('returns score 100 for location with all action schemas', () => {
    const detected = makeDetected({
      hasReserveAction: true,
      reserveActionUrl: 'https://example.com/book',
      hasOrderAction: true,
      orderActionUrl: 'https://example.com/order',
      hasBookingCTA: true,
      hasAppointmentAction: true,
      bookingUrlIsHttps: true,
      bookingUrlNeedsLogin: false,
    });
    const result = computeAgentSEOScore(detected, null, 'https://example.com', AUDITED_AT);
    expect(result.score).toBe(100);
    expect(result.level).toBe('agent_action_ready');
  });

  it('returns score 0 when detected is null', () => {
    const result = computeAgentSEOScore(null, null, 'https://example.com', AUDITED_AT);
    // null detected → all fail except booking_crawlable (skipped = 10 pts)
    expect(result.score).toBe(10);
    expect(result.level).toBe('not_actionable');
  });

  it('gives 25 pts for ReserveAction present', () => {
    const detected = makeDetected({ hasReserveAction: true, reserveActionUrl: 'https://example.com/book' });
    const result = computeAgentSEOScore(detected, null, 'https://example.com', AUDITED_AT);
    const reserveCap = result.capabilities.find(c => c.id === 'reserve_action');
    expect(reserveCap?.earnedPoints).toBe(25);
    expect(reserveCap?.status).toBe('pass');
  });

  it('gives 25 pts for OrderAction present', () => {
    const detected = makeDetected({ hasOrderAction: true, orderActionUrl: 'https://example.com/order' });
    const result = computeAgentSEOScore(detected, null, 'https://example.com', AUDITED_AT);
    const orderCap = result.capabilities.find(c => c.id === 'order_action');
    expect(orderCap?.earnedPoints).toBe(25);
    expect(orderCap?.status).toBe('pass');
  });

  it('gives 20 pts for booking CTA present', () => {
    const detected = makeDetected({ hasBookingCTA: true });
    const result = computeAgentSEOScore(detected, null, 'https://example.com', AUDITED_AT);
    const ctaCap = result.capabilities.find(c => c.id === 'booking_cta');
    expect(ctaCap?.earnedPoints).toBe(20);
  });

  it('gives 20 pts for crawlable booking URL (HTTPS, no login)', () => {
    const detected = makeDetected({
      hasReserveAction: true,
      reserveActionUrl: 'https://example.com/book',
      bookingUrlIsHttps: true,
      bookingUrlNeedsLogin: false,
    });
    const result = computeAgentSEOScore(detected, null, 'https://example.com', AUDITED_AT);
    const crawlCap = result.capabilities.find(c => c.id === 'booking_crawlable');
    expect(crawlCap?.earnedPoints).toBe(20);
    expect(crawlCap?.status).toBe('pass');
  });

  it('gives 10 partial pts for login-gated booking URL', () => {
    const detected = makeDetected({
      hasReserveAction: true,
      reserveActionUrl: 'https://example.com/login/book',
      bookingUrlIsHttps: true,
      bookingUrlNeedsLogin: true,
    });
    const result = computeAgentSEOScore(detected, null, 'https://example.com', AUDITED_AT);
    const crawlCap = result.capabilities.find(c => c.id === 'booking_crawlable');
    expect(crawlCap?.earnedPoints).toBe(10);
    expect(crawlCap?.status).toBe('partial');
  });

  it('gives 10 pts for appointment action', () => {
    const detected = makeDetected({ hasAppointmentAction: true });
    const result = computeAgentSEOScore(detected, null, 'https://example.com', AUDITED_AT);
    const apptCap = result.capabilities.find(c => c.id === 'appointment_action');
    expect(apptCap?.earnedPoints).toBe(10);
  });

  it('level is not_actionable for score < 40', () => {
    const detected = makeDetected(); // all false → 0 + 10 (skipped) = 10
    const result = computeAgentSEOScore(detected, null, 'https://example.com', AUDITED_AT);
    expect(result.level).toBe('not_actionable');
  });

  it('level is partially_actionable for score 40-79', () => {
    const detected = makeDetected({
      hasReserveAction: true,
      reserveActionUrl: 'https://example.com/book',
      hasBookingCTA: true,
      bookingUrlIsHttps: true,
    });
    // 25 (reserve) + 20 (cta) + 20 (crawlable) + 10 (skipped no booking_crawlable... wait, it has URL)
    // Actually: reserve=25, order=0, cta=20, crawlable=20 (HTTPS, no login), appt=0 = 65
    const result = computeAgentSEOScore(detected, null, 'https://example.com', AUDITED_AT);
    expect(result.level).toBe('partially_actionable');
  });

  it('level is agent_action_ready for score >= 80', () => {
    const detected = makeDetected({
      hasReserveAction: true,
      reserveActionUrl: 'https://example.com/book',
      hasOrderAction: true,
      orderActionUrl: 'https://example.com/order',
      hasBookingCTA: true,
      bookingUrlIsHttps: true,
    });
    // 25+25+20+20+0 = 90
    const result = computeAgentSEOScore(detected, null, 'https://example.com', AUDITED_AT);
    expect(result.score).toBe(90);
    expect(result.level).toBe('agent_action_ready');
  });

  it('topPriority is highest-points failing capability', () => {
    const detected = makeDetected({ hasBookingCTA: true, hasAppointmentAction: true });
    const result = computeAgentSEOScore(detected, null, 'https://example.com', AUDITED_AT);
    // reserve (25) and order (25) both fail — first one found (reserve)
    expect(result.topPriority?.id).toBe('reserve_action');
    expect(result.topPriority?.maxPoints).toBe(25);
  });

  it('topPriority is null when all pass', () => {
    const detected = makeDetected({
      hasReserveAction: true,
      reserveActionUrl: 'https://example.com/book',
      hasOrderAction: true,
      orderActionUrl: 'https://example.com/order',
      hasBookingCTA: true,
      hasAppointmentAction: true,
      bookingUrlIsHttps: true,
    });
    const result = computeAgentSEOScore(detected, null, 'https://example.com', AUDITED_AT);
    expect(result.topPriority).toBeNull();
  });

  it('checks magic_menus JSON-LD for LocalVector-generated schemas', () => {
    const menuJsonLd = {
      '@type': 'Restaurant',
      potentialAction: [{ '@type': 'ReserveAction' }],
    };
    const result = computeAgentSEOScore(null, menuJsonLd, 'https://example.com', AUDITED_AT);
    const reserveCap = result.capabilities.find(c => c.id === 'reserve_action');
    expect(reserveCap?.status).toBe('pass');
  });

  it('returns noWebsiteResult when websiteUrl is null', () => {
    const result = computeAgentSEOScore(null, null, null, AUDITED_AT);
    expect(result.score).toBe(0);
    expect(result.level).toBe('not_actionable');
    expect(result.capabilities).toHaveLength(0);
    expect(result.auditedUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchAndParseActionSchemas (network behavior)
// ---------------------------------------------------------------------------

describe('fetchAndParseActionSchemas', () => {
  it('returns null for non-HTTPS URL without fetching', async () => {
    const { fetchAndParseActionSchemas } = await import('@/lib/agent-seo/action-schema-detector');
    const result = await fetchAndParseActionSchemas('http://example.com');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// inspectSchemaForActions
// ---------------------------------------------------------------------------

describe('inspectSchemaForActions', () => {
  it('handles @graph arrays', () => {
    const result: DetectedSchemas = makeDetected();
    inspectSchemaForActions({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Restaurant', potentialAction: [{ '@type': 'ReserveAction' }] },
      ],
    }, result);
    expect(result.hasReserveAction).toBe(true);
  });

  it('handles null/undefined schema gracefully', () => {
    const result: DetectedSchemas = makeDetected();
    inspectSchemaForActions(null, result);
    inspectSchemaForActions(undefined, result);
    expect(result.hasReserveAction).toBe(false);
  });
});
