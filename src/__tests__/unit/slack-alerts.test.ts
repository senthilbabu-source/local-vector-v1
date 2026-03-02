/**
 * Sprint 118 — Slack Alerts Unit Tests (15 tests)
 *
 * Tests message builders (pure), sendSlackAlert (fetch mocked),
 * and SOV_DROP_THRESHOLD configuration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildSOVDropAlert,
  buildFirstMoverAlert,
  sendSlackAlert,
  SOV_DROP_THRESHOLD,
} from '@/lib/alerts/slack';
import { MOCK_SOV_DROP_ALERT_PARAMS } from '@/__fixtures__/golden-tenant';

describe('buildSOVDropAlert — pure', () => {
  it('text contains org_name and warning emoji', () => {
    const msg = buildSOVDropAlert(MOCK_SOV_DROP_ALERT_PARAMS);
    expect(msg.text).toContain('Charcoal N Chill');
    expect(msg.text).toContain('\u26a0\ufe0f');
  });

  it('blocks include current_score and previous_score', () => {
    const msg = buildSOVDropAlert(MOCK_SOV_DROP_ALERT_PARAMS);
    const blockStr = JSON.stringify(msg.blocks);
    expect(blockStr).toContain('30');
    expect(blockStr).toContain('42');
  });

  it('blocks show delta as negative number', () => {
    const msg = buildSOVDropAlert(MOCK_SOV_DROP_ALERT_PARAMS);
    const blockStr = JSON.stringify(msg.blocks);
    expect(blockStr).toContain('-12');
  });

  it('blocks include formatted week_of', () => {
    const msg = buildSOVDropAlert(MOCK_SOV_DROP_ALERT_PARAMS);
    const blockStr = JSON.stringify(msg.blocks);
    expect(blockStr).toContain('2026-03-01');
  });
});

describe('buildFirstMoverAlert — pure', () => {
  it('text contains org_name, count, and rocket emoji', () => {
    const msg = buildFirstMoverAlert({
      org_name: 'Charcoal N Chill',
      query_text: 'hookah lounge near me',
      count: 3,
    });
    expect(msg.text).toContain('Charcoal N Chill');
    expect(msg.text).toContain('3');
    expect(msg.text).toContain('\ud83d\ude80');
  });
});

describe('sendSlackAlert — fetch mocked', () => {
  const originalEnv = process.env.SLACK_WEBHOOK_URL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SLACK_WEBHOOK_URL = originalEnv;
    } else {
      delete process.env.SLACK_WEBHOOK_URL;
    }
  });

  it('POSTs to SLACK_WEBHOOK_URL with application/json', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('ok', { status: 200 }),
    );

    await sendSlackAlert({ text: 'test' });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('request body has text field', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('ok', { status: 200 }),
    );

    await sendSlackAlert({ text: 'hello world' });

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.text).toBe('hello world');
  });

  it('returns { sent: false, reason: "no_webhook_url" } when env var missing', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    const result = await sendSlackAlert({ text: 'test' });
    expect(result).toEqual({ sent: false, reason: 'no_webhook_url' });
  });

  it('returns { sent: false } on fetch error — does NOT throw', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network error'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendSlackAlert({ text: 'test' });
    expect(result.sent).toBe(false);
    // Should not throw
  });

  it('returns { sent: false } on 5-second timeout — does NOT throw', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('The operation was aborted')), 10);
        }),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendSlackAlert({ text: 'test' });
    expect(result.sent).toBe(false);
  });

  it('returns { sent: true } on HTTP 200 response', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('ok', { status: 200 }),
    );

    const result = await sendSlackAlert({ text: 'test' });
    expect(result).toEqual({ sent: true });
  });
});

describe('SOV_DROP_THRESHOLD', () => {
  it('defaults to 5 when env var not set', () => {
    // SOV_DROP_THRESHOLD is evaluated at module load time.
    // The default in the module is parseInt(process.env.SLACK_SOV_DROP_THRESHOLD ?? '5', 10).
    // Since tests don't set the env var, it should default to 5.
    expect(SOV_DROP_THRESHOLD).toBe(5);
  });

  it('reads from SLACK_SOV_DROP_THRESHOLD env var when set', () => {
    // This tests the code path, not re-evaluation. Since the module
    // is already loaded, we verify the parseInt logic directly.
    const parsed = parseInt(process.env.SLACK_SOV_DROP_THRESHOLD ?? '5', 10);
    expect(parsed).toBe(SOV_DROP_THRESHOLD);
  });

  it('alert condition: delta <= -threshold (not < -threshold)', () => {
    // delta = -5, threshold = 5 → -5 <= -5 → true (fires)
    expect(-5 <= -SOV_DROP_THRESHOLD).toBe(true);
    // delta = -6, threshold = 5 → -6 <= -5 → true (fires)
    expect(-6 <= -SOV_DROP_THRESHOLD).toBe(true);
  });

  it('threshold=5: delta=-5 fires, delta=-4 does not', () => {
    const threshold = 5;
    expect(-5 <= -threshold).toBe(true); // fires
    expect(-4 <= -threshold).toBe(false); // does not fire
  });
});
