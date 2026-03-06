'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// S22: AI Model Degradation Alert Banner
//
// Amber dismissible banner shown when an AI model degradation event was
// detected in the last 7 days. Dismissed per model+week via sessionStorage.
// ---------------------------------------------------------------------------

export interface DegradationAlertData {
  model_provider: string;
  detected_at: string;
  affected_org_count: number;
}

interface DegradationAlertBannerProps {
  event: DegradationAlertData | null;
}

function getStorageKey(event: DegradationAlertData): string {
  const weekOf = new Date(event.detected_at);
  const weekNum = Math.floor(weekOf.getTime() / (7 * 24 * 60 * 60 * 1000));
  return `lv_degradation_dismissed_${event.model_provider}_${weekNum}`;
}

function getModelDisplayName(provider: string): string {
  if (provider.includes('openai') || provider.includes('gpt')) return 'ChatGPT';
  if (provider.includes('perplexity')) return 'Perplexity';
  if (provider.includes('gemini') || provider.includes('google')) return 'Gemini';
  if (provider.includes('claude') || provider.includes('anthropic')) return 'Claude';
  if (provider.includes('copilot') || provider.includes('microsoft')) return 'Copilot';
  return provider;
}

export default function DegradationAlertBanner({ event }: DegradationAlertBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!event) return;
    const key = getStorageKey(event);
    const wasDismissed = sessionStorage.getItem(key) === '1';
    setDismissed(wasDismissed);
  }, [event]);

  if (!event || dismissed) return null;

  const modelName = getModelDisplayName(event.model_provider);

  function handleDismiss() {
    if (!event) return;
    sessionStorage.setItem(getStorageKey(event), '1');
    setDismissed(true);
  }

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 flex items-start gap-3"
      data-testid="degradation-alert-banner"
      role="alert"
    >
      <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-300">
          AI Model Alert: {modelName} appears to have updated its knowledge base
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {event.affected_org_count} businesses on LocalVector saw new errors this week.
          This may have caused your new errors — we are tracking this and will notify you when it resolves.
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 transition"
        aria-label="Dismiss degradation alert"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
