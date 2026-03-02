/**
 * PoweredByToggle — Sprint 115
 *
 * Client component: toggles "Powered by LocalVector" footer visibility.
 * Saves immediately on toggle (no save button needed).
 */

'use client';

import { useState } from 'react';

interface PoweredByToggleProps {
  initialValue: boolean;
  onChange: (value: boolean) => void;
}

export default function PoweredByToggle({ initialValue, onChange }: PoweredByToggleProps) {
  const [checked, setChecked] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    const newValue = !checked;
    setChecked(newValue);
    onChange(newValue);
    setSaving(true);

    try {
      await fetch('/api/whitelabel/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_powered_by: newValue }),
      });
    } catch {
      // Revert on failure
      setChecked(!newValue);
      onChange(!newValue);
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        data-testid="powered-by-toggle"
        type="checkbox"
        checked={checked}
        onChange={handleToggle}
        disabled={saving}
        className="h-4 w-4 rounded border-white/20 bg-[#050A15] text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
      />
      <span className="text-sm text-slate-300">
        Show &quot;Powered by LocalVector&quot; in footer
      </span>
    </label>
  );
}
