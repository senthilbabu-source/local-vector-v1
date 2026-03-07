'use client';

import { useState, useTransition } from 'react';
import {
  DIGEST_FREQUENCIES,
  ALL_DIGEST_SECTIONS,
  getFrequencyLabel,
  getSectionLabel,
  type DigestFrequency,
  type DigestSection,
  type DigestPreferences,
} from '@/lib/services/digest-preferences';

// ---------------------------------------------------------------------------
// S65: DigestPreferencesForm — Frequency + section toggle for weekly digest
// ---------------------------------------------------------------------------

interface DigestPreferencesFormProps {
  initialPreferences: DigestPreferences;
  onSave?: (prefs: DigestPreferences) => Promise<void>;
}

export default function DigestPreferencesForm({
  initialPreferences,
  onSave,
}: DigestPreferencesFormProps) {
  const [frequency, setFrequency] = useState<DigestFrequency>(
    initialPreferences.frequency,
  );
  const [sections, setSections] = useState<DigestSection[]>(
    initialPreferences.sections,
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggleSection(section: DigestSection) {
    // 'score' is always required
    if (section === 'score') return;
    setSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section],
    );
    setSaved(false);
  }

  function handleSave() {
    if (!onSave) return;
    startTransition(async () => {
      await onSave({ frequency, sections });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div data-testid="digest-preferences-form">
      <h3 className="text-sm font-semibold text-white mb-3">
        Digest Email Preferences
      </h3>
      <p className="text-xs text-slate-400 mb-4">
        Control how often you receive your AI visibility digest and which
        sections to include.
      </p>

      {/* Frequency selector */}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-300 mb-2 block">
          Frequency
        </label>
        <div className="flex gap-2">
          {DIGEST_FREQUENCIES.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFrequency(f);
                setSaved(false);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                frequency === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              aria-pressed={frequency === f}
            >
              {getFrequencyLabel(f)}
            </button>
          ))}
        </div>
      </div>

      {/* Section toggles */}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-300 mb-2 block">
          Sections to include
        </label>
        <div className="space-y-2">
          {ALL_DIGEST_SECTIONS.map((s) => (
            <label
              key={s}
              className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={sections.includes(s)}
                disabled={s === 'score'}
                onChange={() => toggleSection(s)}
                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/30"
              />
              <span className={s === 'score' ? 'text-slate-500' : ''}>
                {getSectionLabel(s)}
                {s === 'score' && ' (always included)'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Save button */}
      {onSave && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving...' : saved ? 'Saved' : 'Save preferences'}
        </button>
      )}
    </div>
  );
}
