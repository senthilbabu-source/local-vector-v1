'use client';

import { useTransition, useState, useRef, useEffect } from 'react';
import { addCompetitor } from '@/app/dashboard/compete/actions';

interface AddCompetitorFormProps {
  currentCount: number;
  maxAllowed:   number;
}

type Suggestion = {
  name:    string;
  address: string;
};

export default function AddCompetitorForm({ currentCount, maxAllowed }: AddCompetitorFormProps) {
  const [isPending,     startTransition] = useTransition();
  const [error,         setError]         = useState<string | null>(null);
  const formRef                           = useRef<HTMLFormElement>(null);

  // ── Autocomplete state ─────────────────────────────────────────────────
  const [nameInput,     setNameInput]     = useState('');
  const [addressInput,  setAddressInput]  = useState('');
  const [suggestions,   setSuggestions]   = useState<Suggestion[]>([]);
  const [isSearching,   setIsSearching]   = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Suggestion | null>(null);
  const [showDropdown,  setShowDropdown]  = useState(false);

  const atLimit = currentCount >= maxAllowed;

  // ── Debounced Places lookup (300 ms) ───────────────────────────────────
  useEffect(() => {
    if (selectedPlace) return;                     // already picked — skip
    if (nameInput.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const id = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res  = await fetch(
          `/api/v1/places/search?q=${encodeURIComponent(nameInput.trim())}`
        );
        const data = await res.json() as { suggestions?: Suggestion[] };
        const list = data.suggestions ?? [];
        setSuggestions(list);
        setShowDropdown(list.length > 0);
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(id);
  }, [nameInput, selectedPlace]);

  // ── Suggestion selection ───────────────────────────────────────────────
  function handleSelect(s: Suggestion) {
    setNameInput(s.name);
    setAddressInput(s.address);
    setSelectedPlace(s);
    setShowDropdown(false);
    setSuggestions([]);
  }

  // ── Clear selection (restore free-text mode) ───────────────────────────
  function handleClear() {
    setNameInput('');
    setAddressInput('');
    setSelectedPlace(null);
    setSuggestions([]);
    setShowDropdown(false);
  }

  // ── Form submit ────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const name    = nameInput.trim();
    const address = addressInput.trim();

    startTransition(async () => {
      const result = await addCompetitor({
        competitor_name:    name,
        competitor_address: address || undefined,
      });

      if (!result.success) {
        setError(result.error);
      } else {
        handleClear();
        formRef.current?.reset();
      }
    });
  }

  if (atLimit) return null;

  return (
    <div className="relative mt-2">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        data-testid="add-competitor-form"
        className="flex flex-col sm:flex-row gap-2"
      >
        {/* Competitor name — controlled, drives autocomplete */}
        <div className="relative flex-1">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            required
            minLength={2}
            maxLength={255}
            placeholder={isSearching ? 'Searching…' : 'e.g. Cloud 9 Lounge'}
            disabled={isPending}
            readOnly={!!selectedPlace}
            className={`w-full rounded-lg border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 disabled:opacity-50 ${
              selectedPlace
                ? 'border-electric-indigo/60 bg-midnight-slate/80 cursor-default'
                : 'border-white/10 bg-midnight-slate focus:ring-electric-indigo'
            }`}
          />

          {/* Autocomplete dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <ul
              data-testid="places-suggestions"
              className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-white/10 bg-[#1a1f2e] py-1 shadow-xl"
            >
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  onMouseDown={() => handleSelect(s)}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-white/5"
                >
                  <span className="block font-medium text-white">{s.name}</span>
                  <span className="block truncate text-xs text-slate-400">{s.address}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Address — read-only when a place is selected */}
        <input
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          maxLength={500}
          placeholder="Address (optional)"
          disabled={isPending}
          readOnly={!!selectedPlace}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 disabled:opacity-50 ${
            selectedPlace
              ? 'border-electric-indigo/60 bg-midnight-slate/80 cursor-default'
              : 'border-white/10 bg-midnight-slate focus:ring-electric-indigo'
          }`}
        />

        {/* Clear selection button (visible only when a place is selected) */}
        {selectedPlace && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isPending}
            data-testid="places-clear-btn"
            className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-400 hover:text-white hover:border-white/40 disabled:opacity-50 transition whitespace-nowrap"
          >
            Change
          </button>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-electric-indigo px-4 py-2 text-sm font-semibold text-white hover:bg-electric-indigo/90 disabled:opacity-50 transition whitespace-nowrap"
        >
          {isPending ? 'Adding…' : '+ Add Competitor'}
        </button>
      </form>

      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
