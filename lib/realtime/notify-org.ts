import { createServiceRoleClient } from '@/lib/supabase/server';
import { buildOrgChannelName, type NotificationPayload, type NotificationEventType } from './types';

/**
 * Server-side broadcast utility.
 * Uses service role client to send a notification to all org members.
 * Never import in browser code.
 *
 * Never throws — on error logs a warning only.
 */
export async function notifyOrg(
  orgId: string,
  payload: NotificationPayload,
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const channelName = buildOrgChannelName(orgId);

    await supabase.channel(channelName).send({
      type: 'broadcast',
      event: 'notification',
      payload,
    });
  } catch (err) {
    console.warn('[realtime] notifyOrg failed:', err);
  }
}

/**
 * Pure factory for cron notification payloads.
 */
export function buildCronNotification(
  event: NotificationEventType,
  message: string,
  refresh_keys: string[],
): NotificationPayload {
  return {
    event,
    message,
    refresh_keys,
    sent_at: new Date().toISOString(),
  };
}
