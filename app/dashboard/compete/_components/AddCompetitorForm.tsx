'use client';

import { useTransition, useState, useRef } from 'react';
import { addCompetitor } from '@/app/dashboard/compete/actions';

interface AddCompetitorFormProps {
  currentCount: number;
  maxAllowed:   number;
}

export default function AddCompetitorForm({ currentCount, maxAllowed }: AddCompetitorFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError]            = useState<string | null>(null);
  const formRef                      = useRef<HTMLFormElement>(null);

  const atLimit = currentCount >= maxAllowed;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name     = (formData.get('competitor_name') as string | null)?.trim() ?? '';
    const address  = (formData.get('competitor_address') as string | null)?.trim() ?? '';

    startTransition(async () => {
      const result = await addCompetitor({
        competitor_name:    name,
        competitor_address: address || undefined,
      });

      if (!result.success) {
        setError(result.error);
      } else {
        formRef.current?.reset();
      }
    });
  }

  if (atLimit) return null;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      data-testid="add-competitor-form"
      className="flex flex-col sm:flex-row gap-2 mt-2"
    >
      <input
        name="competitor_name"
        required
        minLength={2}
        maxLength={255}
        placeholder="e.g. Cloud 9 Lounge"
        disabled={isPending}
        className="flex-1 rounded-lg border border-white/10 bg-midnight-slate px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-electric-indigo disabled:opacity-50"
      />
      <input
        name="competitor_address"
        maxLength={500}
        placeholder="Address (optional)"
        disabled={isPending}
        className="flex-1 rounded-lg border border-white/10 bg-midnight-slate px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-electric-indigo disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-electric-indigo px-4 py-2 text-sm font-semibold text-white hover:bg-electric-indigo/90 disabled:opacity-50 transition whitespace-nowrap"
      >
        {isPending ? 'Adding…' : '+ Add Competitor'}
      </button>

      {error && (
        <p className="w-full text-xs text-red-400 mt-1">{error}</p>
      )}
    </form>
  );
}
