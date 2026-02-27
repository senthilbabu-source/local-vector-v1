'use client';

import { useState } from 'react';
import { updateRevenueConfig } from '../actions';

interface RevenueConfigFormProps {
  locationId: string;
  avgCustomerValue: number;
  monthlyCovers: number;
  isDefaultConfig: boolean;
}

export default function RevenueConfigForm({
  locationId,
  avgCustomerValue,
  monthlyCovers,
  isDefaultConfig,
}: RevenueConfigFormProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    formData.set('locationId', locationId);
    const result = await updateRevenueConfig(formData);
    setSaving(false);
    if (result.success) {
      setMessage('Settings saved');
    } else {
      setMessage(result.error);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        <div className="flex-1">
          <label
            htmlFor="avgCustomerValue"
            className="block text-xs font-medium text-slate-400 mb-1"
          >
            Avg customer value ($)
          </label>
          <input
            id="avgCustomerValue"
            name="avgCustomerValue"
            type="number"
            min={1}
            max={10000}
            step={0.01}
            defaultValue={avgCustomerValue}
            className="w-full rounded-lg border border-white/10 bg-midnight-slate px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-electric-indigo focus:outline-none focus:ring-1 focus:ring-electric-indigo"
          />
        </div>
        <div className="flex-1">
          <label
            htmlFor="monthlyCovers"
            className="block text-xs font-medium text-slate-400 mb-1"
          >
            Monthly covers
          </label>
          <input
            id="monthlyCovers"
            name="monthlyCovers"
            type="number"
            min={1}
            max={100000}
            step={1}
            defaultValue={monthlyCovers}
            className="w-full rounded-lg border border-white/10 bg-midnight-slate px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-electric-indigo focus:outline-none focus:ring-1 focus:ring-electric-indigo"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-electric-indigo px-4 py-2 text-sm font-semibold text-white hover:bg-electric-indigo/90 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
      {isDefaultConfig && !message && (
        <p className="text-xs text-slate-500">
          Using default estimates. Customize for more accurate projections.
        </p>
      )}
      {message && (
        <p
          className={`text-xs ${message === 'Settings saved' ? 'text-green-400' : 'text-alert-crimson'}`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
