'use client';
// ---------------------------------------------------------------------------
// ViralScanner — Free Hallucination Checker (Sprint 29: robust business search)
//
// State machine:
//   idle      → name input with debounced Places autocomplete (city hidden)
//   selected  → business locked, verified address shown, city inferred
//   manual    → name editable + city input shown (no autocomplete)
//   scanning  → runFreeScan() in flight
//   result    → final card (fail / pass / not_found / rate_limited)
//
// Autocomplete:
//   • Calls /api/public/places/search (new public endpoint, IP rate-limited)
//   • 300ms debounce, 3-char minimum — matches AddCompetitorForm.tsx pattern
//   • onMouseDown on items (not onClick) — prevents blur closing dropdown early
//   • 429 from Places endpoint → "search unavailable" message in dropdown
//
// FormData sent to runFreeScan():
//   businessName — always present
//   address      — verified Places address (selected mode), or '' (manual mode)
//   city         — manual city input, or '' (selected mode uses address)
// ---------------------------------------------------------------------------

import { useState, useTransition, useEffect, type FormEvent } from 'react';
import { runFreeScan, type ScanResult } from '@/app/actions/marketing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Suggestion = { name: string; address: string };

type Phase = 'idle' | 'selected' | 'manual' | 'scanning' | 'result';

// ---------------------------------------------------------------------------
// ViralScanner
// ---------------------------------------------------------------------------

export default function ViralScanner() {
  const [isPending, startTransition] = useTransition();

  // ── Phase / result state ─────────────────────────────────────────────────
  const [phase,  setPhase]  = useState<Phase>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);

  // ── Autocomplete state ───────────────────────────────────────────────────
  const [nameInput,     setNameInput]     = useState('');
  const [suggestions,   setSuggestions]   = useState<Suggestion[]>([]);
  const [isSearching,   setIsSearching]   = useState(false);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [noResults,     setNoResults]     = useState(false);
  const [searchError,   setSearchError]   = useState(false); // 429 from Places

  // ── Selected business ────────────────────────────────────────────────────
  const [selectedPlace, setSelectedPlace] = useState<Suggestion | null>(null);

  // ── Manual mode ──────────────────────────────────────────────────────────
  const [cityInput, setCityInput] = useState('');

  // ── Debounced Places autocomplete (idle phase only) ──────────────────────
  useEffect(() => {
    if (phase !== 'idle') return;
    if (selectedPlace) return;                 // already picked — skip
    if (nameInput.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      setNoResults(false);
      setSearchError(false);
      return;
    }

    setNoResults(false);
    setSearchError(false);

    const id = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res  = await fetch(
          `/api/public/places/search?q=${encodeURIComponent(nameInput.trim())}`
        );
        if (res.status === 429) {
          setSearchError(true);
          setSuggestions([]);
          setShowDropdown(false);
          return;
        }
        const data = await res.json() as { suggestions?: Suggestion[] };
        const list = data.suggestions ?? [];
        setSuggestions(list);
        setShowDropdown(list.length > 0);
        setNoResults(list.length === 0);
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
        setNoResults(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(id);
  }, [nameInput, selectedPlace, phase]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleSelect(s: Suggestion) {
    setNameInput(s.name);
    setSelectedPlace(s);
    setSuggestions([]);
    setShowDropdown(false);
    setNoResults(false);
    setPhase('selected');
  }

  function handleReset() {
    setNameInput('');
    setSelectedPlace(null);
    setSuggestions([]);
    setShowDropdown(false);
    setNoResults(false);
    setSearchError(false);
    setCityInput('');
    setPhase('idle');
    setResult(null);
  }

  function handleManualMode() {
    setSuggestions([]);
    setShowDropdown(false);
    setNoResults(false);
    setSearchError(false);
    setPhase('manual');
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('businessName', nameInput.trim() || 'Your Business');
    fd.append('address',      selectedPlace?.address ?? '');
    fd.append('city',         phase === 'manual' ? cityInput.trim() : '');

    setPhase('scanning');
    startTransition(async () => {
      const scanResult = await runFreeScan(fd);
      setResult(scanResult);
      setPhase('result');
    });
  }

  // ── Result cards ─────────────────────────────────────────────────────────

  if (phase === 'result' && result?.status === 'rate_limited') {
    return (
      <div data-testid="rate-limited-card" className="w-full rounded-2xl bg-surface-dark border-2 border-yellow-500/40 p-6 space-y-4 text-center">
        <p className="text-base font-semibold text-yellow-400">Daily scan limit reached</p>
        <p className="text-sm text-slate-400">
          You&apos;ve used your 5 free scans for today.
          {result.retryAfterSeconds > 0
            ? ` Try again in ${Math.ceil(result.retryAfterSeconds / 3600)} hour(s).`
            : ' Try again tomorrow.'}
        </p>
        <a href="/login" className="inline-block text-sm text-electric-indigo underline underline-offset-2">
          Sign up for unlimited scans →
        </a>
      </div>
    );
  }

  if (phase === 'result' && result?.status === 'not_found') {
    return (
      <div data-testid="not-found-card" className="w-full rounded-2xl bg-surface-dark border-2 border-slate-600 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-slate-400" aria-hidden>
            <path d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" />
          </svg>
          <p className="text-base font-bold text-slate-300">Not Found in AI Search</p>
        </div>
        <div className="rounded-xl bg-midnight-slate border border-white/5 px-4 py-3 space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Business</p>
          <p className="text-sm font-semibold text-white">{result.business_name}</p>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {result.engine} has no coverage for this business yet. This means customers
          searching AI assistants won&apos;t find you — which may be costing you revenue.
          Set up monitoring to get indexed and stay visible.
        </p>
        <a
          href="/signup"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-600 transition"
        >
          Start Free Monitoring
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
            <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
          </svg>
        </a>
      </div>
    );
  }

  if (phase === 'result' && result?.status === 'pass') {
    return (
      <div data-testid="no-hallucination-card" className="w-full rounded-2xl bg-surface-dark border-2 border-truth-emerald p-6 space-y-4">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-truth-emerald" aria-hidden>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          <p className="text-base font-bold text-truth-emerald">No AI Hallucinations Found</p>
        </div>
        <div className="rounded-xl bg-midnight-slate border border-white/5 px-4 py-3 space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Business</p>
          <p className="text-sm font-semibold text-white">{result.business_name}</p>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {result.engine} currently shows accurate information about your business.
          AI hallucinations can appear at any time — set up monitoring so you&apos;re
          the first to know if that changes.
        </p>
        <a
          href="/signup"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-truth-emerald/10 border border-truth-emerald/30 px-4 py-3 text-sm font-semibold text-truth-emerald hover:bg-truth-emerald/20 transition"
        >
          Start Free Monitoring
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
            <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
          </svg>
        </a>
      </div>
    );
  }

  if (phase === 'result' && result?.status === 'fail') {
    return (
      <div data-testid="hallucination-card" className="w-full rounded-2xl bg-surface-dark border-2 border-alert-crimson p-6 space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-alert-crimson opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-alert-crimson" />
          </span>
          <p className="text-base font-bold text-alert-crimson">AI Hallucination Detected</p>
          <span className="ml-auto rounded-full bg-alert-crimson/15 px-2.5 py-0.5 text-xs font-semibold text-alert-crimson uppercase tracking-wide">
            {result.severity}
          </span>
        </div>
        <div className="rounded-xl bg-midnight-slate border border-white/5 px-4 py-3 space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Business</p>
          <p className="text-sm font-semibold text-white">{result.business_name}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-alert-crimson/10 border border-alert-crimson/20 px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">{result.engine} Claims</p>
            <p className="text-sm font-semibold text-alert-crimson">{result.claim_text}</p>
          </div>
          <div className="rounded-xl bg-truth-emerald/10 border border-truth-emerald/20 px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">Reality</p>
            <p className="text-sm font-semibold text-truth-emerald">{result.expected_truth}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {result.engine} is currently telling potential customers that your business is{' '}
          <span className="text-alert-crimson font-semibold">{result.claim_text.toLowerCase()}</span>.
          Every customer who sees this hallucination may visit a competitor instead.
        </p>
        <a
          href="/login"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-alert-crimson px-4 py-3 text-sm font-semibold text-white hover:bg-alert-crimson/90 transition"
        >
          Claim Your Profile to Fix This Now
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
            <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
          </svg>
        </a>
      </div>
    );
  }

  // ── Scan form (idle | selected | manual | scanning) ────────────────────

  return (
    <div className="w-full rounded-2xl bg-surface-dark border border-white/10 p-6">
      <p className="text-sm font-semibold text-white mb-1">
        Free AI Hallucination Scan
      </p>
      <p className="text-xs text-slate-500 mb-4">
        No signup required. See what ChatGPT says about your business right now.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">

        {/* ── Business name with autocomplete ──────────────────────────── */}
        <div className="relative">
          <input
            name="businessName"
            type="text"
            required
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              if (selectedPlace) {
                // user started editing after selection → reset to idle
                setSelectedPlace(null);
                setPhase('idle');
              }
            }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            readOnly={phase === 'selected'}
            placeholder={
              isSearching ? 'Searching…' : 'Business Name'
            }
            disabled={isPending || phase === 'scanning'}
            className={[
              'w-full rounded-xl border px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition',
              phase === 'selected'
                ? 'border-electric-indigo/60 bg-midnight-slate/80 cursor-default'
                : 'border-white/10 bg-midnight-slate focus:border-electric-indigo/50',
              isPending || phase === 'scanning' ? 'opacity-50' : '',
            ].join(' ')}
          />

          {/* Autocomplete dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <ul
              data-testid="places-suggestions"
              className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-white/10 bg-[#1a1f2e] py-1 shadow-2xl"
            >
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  onMouseDown={() => handleSelect(s)}
                  className="cursor-pointer px-4 py-2.5 text-sm hover:bg-white/5 transition"
                >
                  <span className="block font-medium text-white">{s.name}</span>
                  <span className="block truncate text-xs text-slate-500">{s.address}</span>
                </li>
              ))}
            </ul>
          )}

          {/* No results / search error hints */}
          {!isSearching && noResults && nameInput.trim().length >= 3 && phase === 'idle' && (
            <p className="mt-1.5 text-xs text-slate-500">
              No results.{' '}
              <button type="button" onClick={handleManualMode} className="text-electric-indigo underline underline-offset-2">
                Enter manually →
              </button>
            </p>
          )}
          {searchError && (
            <p className="mt-1.5 text-xs text-slate-500">
              Search unavailable.{' '}
              <button type="button" onClick={handleManualMode} className="text-electric-indigo underline underline-offset-2">
                Enter manually →
              </button>
            </p>
          )}
        </div>

        {/* ── Selected: show verified address + change link ─────────────── */}
        {phase === 'selected' && selectedPlace && (
          <div className="flex items-start justify-between gap-2 rounded-xl border border-white/5 bg-midnight-slate px-4 py-2.5">
            <p className="text-xs text-slate-400 leading-relaxed truncate">{selectedPlace.address}</p>
            <button
              type="button"
              onClick={handleReset}
              className="shrink-0 text-xs text-electric-indigo underline underline-offset-2 whitespace-nowrap"
            >
              Use different
            </button>
          </div>
        )}

        {/* ── Manual mode: city input + back link ───────────────────────── */}
        {phase === 'manual' && (
          <>
            <input
              name="city"
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="City, State"
              disabled={isPending || phase === 'scanning'}
              className="w-full rounded-xl border border-white/10 bg-midnight-slate px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-electric-indigo/50 disabled:opacity-50 transition"
            />
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-500 underline underline-offset-2"
            >
              ← Search for business instead
            </button>
          </>
        )}

        {/* ── Manual fallback link (idle, no error, typing active) ──────── */}
        {phase === 'idle' && !noResults && !searchError && nameInput.trim().length === 0 && (
          <button
            type="button"
            onClick={handleManualMode}
            className="text-xs text-slate-500 underline underline-offset-2"
          >
            Enter business name and city manually →
          </button>
        )}

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={isPending || phase === 'scanning'}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-electric-indigo px-4 py-2.5 text-sm font-semibold text-white hover:bg-electric-indigo/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {isPending || phase === 'scanning' ? (
            <>
              <SpinnerIcon />
              Scanning AI Models&hellip;
            </>
          ) : (
            'Scan for Hallucinations →'
          )}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpinnerIcon
// ---------------------------------------------------------------------------

function SpinnerIcon() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
