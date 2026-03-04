'use client';

// ---------------------------------------------------------------------------
// Widget Settings Form — Sprint 133
//
// Client component for widget customization: enable/disable, color, position,
// greeting, embed code. Updates via server action.
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { updateWidgetSettings } from '../actions';

interface WidgetSettingsFormProps {
  locationId: string;
  widgetEnabled: boolean;
  canEnable: boolean;
  color: string;
  position: string;
  greeting: string;
  publicSlug: string | null;
  appUrl: string;
}

export default function WidgetSettingsForm({
  locationId,
  widgetEnabled,
  canEnable,
  color: initialColor,
  position: initialPosition,
  greeting: initialGreeting,
  publicSlug,
  appUrl,
}: WidgetSettingsFormProps) {
  const [enabled, setEnabled] = useState(widgetEnabled);
  const [color, setColor] = useState(initialColor);
  const [position, setPosition] = useState(initialPosition);
  const [greeting, setGreeting] = useState(initialGreeting);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const embedCode = publicSlug
    ? `<script src="${appUrl}/api/widget/${publicSlug}/embed" async></script>`
    : null;

  function handleSave() {
    startTransition(async () => {
      await updateWidgetSettings(locationId, {
        widget_enabled: enabled,
        widget_settings: { color, position, greeting },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function handleCopy() {
    if (embedCode) {
      navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-5">
      {/* Enable toggle */}
      <div className="rounded-2xl border border-white/5 bg-surface-dark p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-white">
              Enable Widget
            </span>
            {!canEnable && (
              <p className="text-xs text-amber-400 mt-0.5">
                Complete data requirements first (80%+ completeness)
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={!canEnable}
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-electric-indigo' : 'bg-white/10'
            } ${!canEnable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            data-testid="widget-enable-toggle"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Color picker */}
        <div>
          <label className="text-xs text-slate-400">Button Color</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-8 rounded border-0 bg-transparent p-0 cursor-pointer"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
            />
          </div>
        </div>

        {/* Position */}
        <div>
          <label className="text-xs text-slate-400">Widget Position</label>
          <div className="mt-1 flex gap-2">
            {['bottom-right', 'bottom-left'].map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setPosition(pos)}
                className={`rounded-lg px-3 py-1.5 text-xs ${
                  position === pos
                    ? 'bg-electric-indigo text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {pos === 'bottom-right' ? 'Bottom Right' : 'Bottom Left'}
              </button>
            ))}
          </div>
        </div>

        {/* Greeting */}
        <div>
          <label className="text-xs text-slate-400">Greeting Message</label>
          <input
            type="text"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            maxLength={200}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400"
            placeholder="Ask us anything!"
          />
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-xl bg-electric-indigo px-5 py-2 text-sm font-semibold text-white transition hover:bg-electric-indigo/90 disabled:opacity-50"
          data-testid="widget-save"
        >
          {isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* Embed code */}
      {embedCode && enabled && (
        <div className="rounded-2xl border border-white/5 bg-surface-dark p-5 space-y-3">
          <span className="text-sm font-medium text-white">Embed Code</span>
          <p className="text-xs text-slate-400">
            Add this snippet to your website before the closing{' '}
            <code className="text-electric-indigo">&lt;/body&gt;</code> tag.
          </p>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-xs text-green-400">
              {embedCode}
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-2 top-2 rounded bg-white/10 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/20"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Live preview */}
      {publicSlug && enabled && (
        <div className="rounded-2xl border border-white/5 bg-surface-dark p-5 space-y-3">
          <span className="text-sm font-medium text-white">Live Preview</span>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <iframe
              src={`${appUrl}/widget/${publicSlug}`}
              className="h-[400px] w-full"
              title="Widget preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
