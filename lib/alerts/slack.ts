// ---------------------------------------------------------------------------
// lib/alerts/slack.ts — Slack Webhook Integration (Sprint 118)
//
// Internal operational alerts for the LocalVector team.
// Never throws. Missing SLACK_WEBHOOK_URL = silent no-op.
// ---------------------------------------------------------------------------

export interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
  elements?: { type: string; text: string }[];
}

export interface SlackAlertResult {
  sent: boolean;
  reason?: string;
}

export interface SOVDropAlertParams {
  org_name: string;
  org_id: string;
  current_score: number;
  previous_score: number;
  delta: number;
  week_of: string;
}

export interface FirstMoverAlertParams {
  org_name: string;
  query_text: string;
  count: number;
}

/**
 * Alert fires when delta <= -SOV_DROP_THRESHOLD.
 * Configurable via SLACK_SOV_DROP_THRESHOLD env var. Defaults to 5.
 */
export const SOV_DROP_THRESHOLD = parseInt(
  process.env.SLACK_SOV_DROP_THRESHOLD ?? '5',
  10,
);

/**
 * Builds a Slack message for an SOV score drop alert.
 * Pure function — no side effects.
 */
export function buildSOVDropAlert(params: SOVDropAlertParams): SlackMessage {
  return {
    text: `\u26a0\ufe0f SOV Drop Alert: ${params.org_name}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `\u26a0\ufe0f SOV Drop Alert: ${params.org_name}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Current Score:*\n${params.current_score}` },
          { type: 'mrkdwn', text: `*Previous Score:*\n${params.previous_score}` },
          { type: 'mrkdwn', text: `*Delta:*\n${params.delta}` },
          { type: 'mrkdwn', text: `*Week Of:*\n${params.week_of}` },
        ],
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Org ID: ${params.org_id}` }],
      },
    ],
  };
}

/**
 * Builds a Slack message for first mover opportunities.
 * Pure function — no side effects.
 */
export function buildFirstMoverAlert(params: FirstMoverAlertParams): SlackMessage {
  return {
    text: `\ud83d\ude80 ${params.count} new first mover opportunities for ${params.org_name}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `\ud83d\ude80 ${params.count} new first mover opportunities for ${params.org_name}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `Query: _${params.query_text}_` },
      },
    ],
  };
}

/**
 * Sends a message to the configured Slack webhook.
 *
 * Never throws. On any error (network, timeout, missing config),
 * returns { sent: false } with an optional reason.
 * 5-second timeout via AbortController.
 */
export async function sendSlackAlert(message: SlackMessage): Promise<SlackAlertResult> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    return { sent: false, reason: 'no_webhook_url' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[slack] Webhook returned ${response.status}`);
      return { sent: false, reason: `http_${response.status}` };
    }

    return { sent: true };
  } catch (err) {
    console.warn('[slack] Alert send failed:', err);
    return { sent: false, reason: err instanceof Error ? err.message : 'unknown' };
  }
}
