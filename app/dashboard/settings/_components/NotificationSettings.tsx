'use client';

// ---------------------------------------------------------------------------
// NotificationSettings — Sprint 121: Notification preference controls
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import type { OrgSettings } from '@/lib/settings/types';

interface NotificationSettingsProps {
  settings: OrgSettings;
}

export default function NotificationSettings({ settings }: NotificationSettingsProps) {
  const [emailDigest, setEmailDigest] = useState(settings.notify_email_digest);
  const [inApp, setInApp] = useState(settings.notify_in_app);
  const [threshold, setThreshold] = useState(settings.notify_sov_drop_threshold);
  const [webhook, setWebhook] = useState(settings.notify_slack_webhook_url ?? '');
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notify_email_digest: emailDigest,
            notify_in_app: inApp,
            notify_sov_drop_threshold: threshold,
            notify_slack_webhook_url: webhook.trim() || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Save failed');
        }
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    });
  }

  return (
    <div className="space-y-4" data-testid="notification-settings-form">
      <h3 className="text-sm font-semibold text-white">Notification Preferences</h3>

      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={emailDigest}
          onChange={(e) => setEmailDigest(e.target.checked)}
          className="rounded border-white/20 bg-surface-dark"
          data-testid="email-digest-toggle"
        />
        Email digest
      </label>

      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={inApp}
          onChange={(e) => setInApp(e.target.checked)}
          className="rounded border-white/20 bg-surface-dark"
        />
        In-app notifications
      </label>

      <div>
        <label className="block text-xs text-slate-400 mb-1">
          SOV drop alert threshold (%)
        </label>
        <input
          type="number"
          min={1}
          max={20}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-20 rounded-md border border-white/10 bg-surface-dark px-3 py-1.5 text-sm text-white"
          data-testid="sov-threshold-input"
        />
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">
          Slack Webhook URL
        </label>
        <input
          type="url"
          value={webhook}
          onChange={(e) => setWebhook(e.target.value)}
          placeholder="https://hooks.slack.com/services/..."
          className="w-full rounded-md border border-white/10 bg-surface-dark px-3 py-1.5 text-sm text-white placeholder:text-slate-500"
          data-testid="slack-webhook-input"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        data-testid="save-notification-settings-btn"
      >
        {isPending ? 'Saving...' : 'Save Notification Settings'}
      </button>

      {saved && <p className="text-xs text-signal-green">Settings saved.</p>}
      {error && <p className="text-xs text-alert-crimson">{error}</p>}
    </div>
  );
}
