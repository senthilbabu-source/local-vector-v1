'use client';

// ---------------------------------------------------------------------------
// ApiKeySettings — Sprint 121: Agency API key management
// Agency plan: key list + generate + revoke.
// Non-agency: upgrade prompt.
// AI_RULES §59: raw_key shown ONCE in modal.
// ---------------------------------------------------------------------------

import { useEffect, useState, useTransition } from 'react';
import type { OrgApiKey } from '@/lib/settings/types';

interface ApiKeySettingsProps {
  isAgencyPlan: boolean;
}

export default function ApiKeySettings({ isAgencyPlan }: ApiKeySettingsProps) {
  const [keys, setKeys] = useState<OrgApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTimer, setShowTimer] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAgencyPlan) return;
    fetch('/api/settings/api-keys')
      .then((r) => r.json())
      .then((data) => setKeys(data.keys ?? []))
      .catch(() => {});
  }, [isAgencyPlan]);

  // Timer for close button enable
  useEffect(() => {
    if (rawKey && showTimer > 0) {
      const t = setTimeout(() => setShowTimer((s) => s - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [rawKey, showTimer]);

  if (!isAgencyPlan) {
    return (
      <div data-testid="api-keys-section">
        <h3 className="text-sm font-semibold text-white">API Keys</h3>
        <p className="mt-1 text-xs text-slate-400">
          API key management is available on the Agency plan.
        </p>
      </div>
    );
  }

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/settings/api-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newKeyName.trim() }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Failed to generate key');
        }
        const data = await res.json();
        setRawKey(data.raw_key);
        setKeys((prev) => [...prev, data.api_key]);
        setNewKeyName('');
        setShowTimer(10);
        setCopied(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    });
  }

  function handleRevoke(keyId: string) {
    startTransition(async () => {
      await fetch(`/api/settings/api-keys/${keyId}`, { method: 'DELETE' });
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    });
  }

  async function handleCopy() {
    if (rawKey) {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
    }
  }

  return (
    <div className="space-y-4" data-testid="api-keys-section">
      <h3 className="text-sm font-semibold text-white">API Keys</h3>

      {/* Key list */}
      {keys.length > 0 && (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-surface-dark px-4 py-2.5"
              data-testid={`api-key-row-${key.id}`}
            >
              <div>
                <span className="text-sm font-medium text-white">{key.name}</span>
                <span className="ml-3 text-xs text-slate-500 font-mono">{key.key_prefix}...</span>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(key.id)}
                className="text-xs text-alert-crimson hover:text-alert-crimson/80"
                data-testid={`revoke-api-key-${key.id}`}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Generate */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name (e.g., Production)"
          className="flex-1 rounded-md border border-white/10 bg-surface-dark px-3 py-1.5 text-sm text-white placeholder:text-slate-500"
          data-testid="new-key-name-input"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending || !newKeyName.trim()}
          className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          data-testid="generate-api-key-btn"
        >
          Generate
        </button>
      </div>

      {error && <p className="text-xs text-alert-crimson">{error}</p>}

      {/* Raw key modal */}
      {rawKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-card p-6 space-y-4">
            <h4 className="text-sm font-semibold text-white">Your API Key</h4>
            <p className="text-xs text-alert-amber">
              Copy this key now. It will not be shown again.
            </p>
            <code
              className="block w-full break-all rounded-md bg-surface-dark p-3 text-xs text-signal-green font-mono"
              data-testid="raw-key-display"
            >
              {rawKey}
            </code>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                data-testid="copy-key-btn"
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
              <button
                type="button"
                onClick={() => setRawKey(null)}
                disabled={!copied && showTimer > 0}
                className="rounded-md px-4 py-2 text-xs text-slate-400 hover:text-white disabled:opacity-50"
                data-testid="confirm-saved-key-btn"
              >
                {showTimer > 0 && !copied
                  ? `Close (${showTimer}s)`
                  : "I've saved the key — Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
