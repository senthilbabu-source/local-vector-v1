'use client';
// ---------------------------------------------------------------------------
// ViralScanner — Free AI Audit (Sprint 34: AI Audit naming + real fields)
//
// State machine:
//   idle      → name/URL input with debounced Places autocomplete (city hidden)
//   selected  → business locked, verified address shown, city inferred
//   manual    → name editable + city input shown (no autocomplete)
//   scanning  → runFreeScan() in flight — shows diagnostic animation
//   result    → inline result card (unavailable / rate_limited only)
//               fail / pass / not_found redirect to /scan dashboard
//
// Smart Search (Sprint 33 Part 1):
//   • Auto-detects URL input (http://, or domain.com pattern)
//   • URL mode: disables Places autocomplete, passes url to runFreeScan()
//   • Name mode: Places autocomplete (unchanged from Sprint 29)
//
// Diagnostic Screen (Sprint 33 Part 2):
//   • Full panel overlay during scanning with cycling messages + fill-bar
//   • Uses existing CSS keyframes (fill-bar, fade-up, ping-dot) — no Framer Motion
//
// Redirect (Sprint 33 Part 3):
//   • fail / pass / not_found → router.push('/scan?...') with result encoded
//   • unavailable / rate_limited → stay inline
//
// AI_RULES §24: scan messages describe the process — never fabricated results.
// ---------------------------------------------------------------------------

import { useState, useTransition, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { runFreeScan, type ScanResult } from '@/app/actions/marketing';
import { buildScanParams } from '@/app/scan/_utils/scan-params';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Suggestion = { name: string; address: string };

type Phase = 'idle' | 'selected' | 'manual' | 'scanning' | 'result';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** UI copy describing the scan process (AI_RULES §24 — process description, not data) */
const SCAN_MESSAGES = [
  'Initializing LLM Interrogation Engine...',
  'Scanning ChatGPT-4o Knowledge Graph...',
  'Analyzing Sentiment on Perplexity & Gemini...',
  'Cross-referencing 50+ Local RAG Sources...',
  'Calculating AI Health Score...',
  'Finalizing AI Audit Report...',
] as const;

// ---------------------------------------------------------------------------
// URL detection helper (module-private, not exported)
// ---------------------------------------------------------------------------

function looksLikeUrl(input: string): boolean {
  return (
    /^https?:\/\//i.test(input) ||
    /^(www\.)?[\w-]+\.(com|net|org|io|co|ai|app|biz|us)\b/i.test(input)
  );
}

// ---------------------------------------------------------------------------
// ViralScanner
// ---------------------------------------------------------------------------

export default function ViralScanner({ variant = 'dark' }: { variant?: 'dark' | 'light' } = {}) {
  const isLight = variant === 'light';
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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
  const [scanError,     setScanError]     = useState<string | null>(null);

  // ── URL mode (Smart Search — Sprint 33) ─────────────────────────────────
  const [isUrlMode, setIsUrlMode] = useState(false);

  // ── Selected business ────────────────────────────────────────────────────
  const [selectedPlace, setSelectedPlace] = useState<Suggestion | null>(null);

  // ── Manual mode ──────────────────────────────────────────────────────────
  const [cityInput, setCityInput] = useState('');

  // ── Diagnostic overlay message index (Sprint 33) ─────────────────────────
  const [msgIndex, setMsgIndex] = useState(0);

  // ── Message cycling while scanning ────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'scanning') {
      setMsgIndex(0);
      return;
    }
    const id = setInterval(() => {
      setMsgIndex((i) => Math.min(i + 1, SCAN_MESSAGES.length - 1));
    }, 800);
    return () => clearInterval(id);
  }, [phase]);

  // ── Debounced Places autocomplete (idle phase, name mode only) ───────────
  useEffect(() => {
    if (phase !== 'idle') return;
    if (selectedPlace) return;       // already picked — skip
    if (isUrlMode) {                 // URL mode — no autocomplete
      setSuggestions([]);
      setShowDropdown(false);
      setNoResults(false);
      setSearchError(false);
      return;
    }
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
      } catch (err) {
        Sentry.captureException(err, { tags: { component: 'ViralScanner', surface: 'landing-page', sprint: 'A' } });
        setSuggestions([]);
        setShowDropdown(false);
        setNoResults(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(id);
  }, [nameInput, selectedPlace, phase, isUrlMode]);

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
    setScanError(null);
    setCityInput('');
    setIsUrlMode(false);
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
    setScanError(null);
    const fd = new FormData();
    fd.append('businessName', nameInput.trim() || 'Your Business');
    fd.append('address',      selectedPlace?.address ?? '');
    fd.append('city',         phase === 'manual' ? cityInput.trim() : '');
    fd.append('url',          isUrlMode ? nameInput.trim() : '');

    setPhase('scanning');
    startTransition(async () => {
      try {
        const scanResult = await runFreeScan(fd);

        // Redirect actionable results to /scan dashboard (Sprint 33 Part 3)
        if (
          scanResult.status === 'fail' ||
          scanResult.status === 'pass' ||
          scanResult.status === 'not_found'
        ) {
          const params = buildScanParams(scanResult, nameInput.trim());
          router.push(`/scan?${params.toString()}`);
        } else {
          // unavailable / rate_limited: stay inline
          setResult(scanResult);
          setPhase('result');
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { component: 'ViralScanner', surface: 'landing-page', sprint: 'A' } });
        setScanError('Our AI scanner is temporarily unavailable — please try again in a moment.');
        setPhase('idle');
      }
    });
  }

  // ── Diagnostic overlay (scanning phase — Sprint 33 Part 2) ───────────────

  if (phase === 'scanning') {
    return (
      <div className={`w-full rounded-2xl p-6 space-y-5 ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-midnight-slate border border-signal-green/20'}`}>
        {/* Header with ping dot */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isLight ? 'bg-[#00A86B]' : 'bg-signal-green'}`}
              style={{ animation: 'ping-dot 1.5s cubic-bezier(0,0,0.2,1) infinite' }}
            />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${isLight ? 'bg-[#00A86B]' : 'bg-signal-green'}`} />
          </span>
          <p className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-[#00A86B]' : 'text-signal-green'}`}>
            Running AI Audit
          </p>
        </div>

        {/* Progress bar — 4 s fill using existing fill-bar keyframe */}
        <div className={`h-1 w-full rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
          <div
            className={`h-full rounded-full ${isLight ? 'bg-[#00A86B]' : 'bg-signal-green'}`}
            style={{
              '--bar-w': '100%',
              animation: 'fill-bar 4s cubic-bezier(0.4,0,0.2,1) forwards',
            } as React.CSSProperties}
          />
        </div>

        {/* Cycling message — key change forces re-mount → retriggeres fade-up */}
        <p
          key={msgIndex}
          className={`text-sm min-h-[1.25rem] ${isLight ? 'text-slate-600' : 'text-slate-300'}`}
          style={{ animation: 'fade-up 0.3s ease-out both' }}
        >
          {SCAN_MESSAGES[msgIndex]}
        </p>

        <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Powered by LocalVector · Typically 5–10 seconds</p>
      </div>
    );
  }

  // ── Inline result cards (unavailable / rate_limited only) ─────────────────

  if (phase === 'result' && result?.status === 'rate_limited') {
    return (
      <div data-testid="rate-limited-card" className={`w-full rounded-2xl border-2 border-yellow-500/40 p-6 space-y-4 text-center ${isLight ? 'bg-amber-50' : 'bg-surface-dark'}`}>
        <p className={`text-base font-semibold ${isLight ? 'text-amber-700' : 'text-yellow-400'}`}>Daily scan limit reached</p>
        <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          You&apos;ve used your 5 free scans for today.
          {result.retryAfterSeconds > 0
            ? ` Try again in ${Math.ceil(result.retryAfterSeconds / 3600)} hour(s).`
            : ' Try again tomorrow.'}
        </p>
        <a href="/login" className={`inline-block text-sm underline underline-offset-2 ${isLight ? 'text-[#00A86B]' : 'text-electric-indigo'}`}>
          Sign up for unlimited scans →
        </a>
      </div>
    );
  }

  if (phase === 'result' && result?.status === 'unavailable') {
    return (
      <div data-testid="unavailable-card" className={`w-full rounded-2xl border-2 border-yellow-500/40 p-6 space-y-4 text-center ${isLight ? 'bg-amber-50' : 'bg-surface-dark'}`}>
        <p className={`text-base font-semibold ${isLight ? 'text-amber-700' : 'text-yellow-400'}`}>Scan Unavailable</p>
        <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          {result.reason === 'no_api_key'
            ? 'This scanner requires configuration. Contact support if this persists.'
            : "We couldn\u2019t complete this scan right now. Please try again in a moment."}
        </p>
        <button
          type="button"
          onClick={handleReset}
          className={`text-sm underline underline-offset-2 ${isLight ? 'text-[#00A86B]' : 'text-electric-indigo'}`}
        >
          Try again →
        </button>
      </div>
    );
  }

  // ── Scan form (idle | selected | manual) ───────────────────────────────────

  // ── Style helpers ────────────────────────────────────────────────────────────
  const formBg = isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-surface-dark border border-white/10';
  const inputClass = isLight
    ? 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#00A86B]/50 focus:ring-1 focus:ring-[#00A86B]/20 transition'
    : 'w-full rounded-xl border border-white/10 bg-midnight-slate px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-electric-indigo/50 transition';
  const inputSelectedClass = isLight
    ? 'border-[#00A86B]/40 bg-green-50/50 cursor-default'
    : 'border-electric-indigo/60 bg-midnight-slate/80 cursor-default';
  const linkClass = isLight ? 'text-[#00A86B]' : 'text-electric-indigo';
  const mutedClass = isLight ? 'text-slate-500' : 'text-slate-400';
  const submitClass = isLight
    ? 'flex items-center justify-center gap-2 w-full rounded-xl bg-[#00A86B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#007A4D] disabled:opacity-60 disabled:cursor-not-allowed transition'
    : 'flex items-center justify-center gap-2 w-full rounded-xl bg-electric-indigo px-4 py-2.5 text-sm font-semibold text-white hover:bg-electric-indigo/90 disabled:opacity-60 disabled:cursor-not-allowed transition';

  return (
    <div className={`w-full rounded-2xl p-6 ${formBg}`}>
      <p className={`text-sm font-semibold mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
        Free AI Audit
      </p>
      <p className={`text-xs mb-4 ${mutedClass}`}>
        No signup required. See how AI models describe your business right now.
      </p>

      {scanError && (
        <div data-testid="viral-scanner-error" className={`mb-3 rounded-lg border p-4 text-center ${isLight ? 'border-red-200 bg-red-50' : 'border-destructive/30 bg-destructive/5'}`}>
          <p className={`text-sm ${isLight ? 'text-red-700' : 'text-destructive'}`}>{scanError}</p>
          <button
            type="button"
            data-testid="viral-scanner-retry"
            onClick={() => { setScanError(null); handleReset(); }}
            className={`mt-2 text-xs underline ${isLight ? 'text-slate-500 hover:text-slate-700' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Try again
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">

        {/* ── Business name / URL with autocomplete ────────────────────── */}
        <div className="relative">
          <input
            name="businessName"
            type="text"
            required
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setIsUrlMode(looksLikeUrl(e.target.value));
              if (selectedPlace) {
                setSelectedPlace(null);
                setPhase('idle');
              }
            }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            readOnly={phase === 'selected'}
            placeholder={isSearching ? 'Searching…' : 'Business Name or Website URL'}
            disabled={isPending}
            className={[
              phase === 'selected' ? inputSelectedClass : '',
              phase !== 'selected' ? inputClass : inputClass,
              isPending ? 'opacity-50' : '',
            ].join(' ')}
          />

          {/* Autocomplete dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <ul
              data-testid="places-suggestions"
              className={`absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border py-1 shadow-2xl ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-[#1a1f2e]'}`}
            >
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  onMouseDown={() => handleSelect(s)}
                  className={`cursor-pointer px-4 py-2.5 text-sm transition ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                >
                  <span className={`block font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{s.name}</span>
                  <span className={`block truncate text-xs ${mutedClass}`}>{s.address}</span>
                </li>
              ))}
            </ul>
          )}

          {/* URL mode indicator */}
          {isUrlMode && phase === 'idle' && (
            <p className={`mt-1.5 text-xs ${isLight ? 'text-[#00A86B]/70' : 'text-signal-green/70'}`}>
              Scanning as website URL
            </p>
          )}

          {/* No results / search error hints */}
          {!isUrlMode && !isSearching && noResults && nameInput.trim().length >= 3 && phase === 'idle' && (
            <p className={`mt-1.5 text-xs ${mutedClass}`}>
              No results.{' '}
              <button type="button" onClick={handleManualMode} className={`${linkClass} underline underline-offset-2`}>
                Enter manually →
              </button>
            </p>
          )}
          {searchError && (
            <p className={`mt-1.5 text-xs ${mutedClass}`}>
              Search unavailable.{' '}
              <button type="button" onClick={handleManualMode} className={`${linkClass} underline underline-offset-2`}>
                Enter manually →
              </button>
            </p>
          )}
        </div>

        {/* ── Selected: show verified address + change link ─────────────── */}
        {phase === 'selected' && selectedPlace && (
          <div className={`flex items-start justify-between gap-2 rounded-xl border px-4 py-2.5 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/5 bg-midnight-slate'}`}>
            <p className={`text-xs leading-relaxed truncate ${mutedClass}`}>{selectedPlace.address}</p>
            <button
              type="button"
              onClick={handleReset}
              className={`shrink-0 text-xs underline underline-offset-2 whitespace-nowrap ${linkClass}`}
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
              disabled={isPending}
              className={`${inputClass} disabled:opacity-50`}
            />
            <button
              type="button"
              onClick={handleReset}
              className={`text-xs underline underline-offset-2 ${mutedClass}`}
            >
              ← Search for business instead
            </button>
          </>
        )}

        {/* ── Manual fallback link (idle, no error, empty input) ────────── */}
        {phase === 'idle' && !noResults && !searchError && !isUrlMode && nameInput.trim().length === 0 && (
          <button
            type="button"
            onClick={handleManualMode}
            className={`text-xs underline underline-offset-2 ${mutedClass}`}
          >
            Enter business name and city manually →
          </button>
        )}

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={isPending}
          className={submitClass}
        >
          Run Free AI Audit →
        </button>
      </form>
    </div>
  );
}
