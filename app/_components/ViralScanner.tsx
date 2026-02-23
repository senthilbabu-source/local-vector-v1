'use client';
// ViralScanner — Free Hallucination Checker (Doc 07 §2, Doc 08 §2)
//
// Renders a two-input form (Business Name + City). On submit it calls the
// `runFreeScan` Server Action with a 2-second mock delay, then replaces
// the form with a "Red Alert" card showing the hallucination details and
// a CTA to /login.
//
// `useTransition` manages the isPending flag so no extra useState is needed.

import { useState, useTransition, type FormEvent } from 'react';
import { runFreeScan, type ScanResult } from '@/app/actions/marketing';

// ---------------------------------------------------------------------------
// ViralScanner
// ---------------------------------------------------------------------------

export default function ViralScanner() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const scanResult = await runFreeScan(formData);
      setResult(scanResult);
    });
  }

  // ── Rate-limited card ──────────────────────────────────────────────────
  if (result?.status === 'rate_limited') {
    return (
      <div data-testid="rate-limited-card" className="w-full rounded-2xl bg-surface-dark border-2 border-yellow-500/40 p-6 space-y-4 text-center">
        <p className="text-base font-semibold text-yellow-400">Daily scan limit reached</p>
        <p className="text-sm text-slate-400">
          You&apos;ve used your 5 free scans for today.
          {result.retryAfterSeconds > 0
            ? ` Try again in ${Math.ceil(result.retryAfterSeconds / 3600)} hour(s).`
            : ' Try again tomorrow.'}
        </p>
        <a
          href="/login"
          className="inline-block text-sm text-electric-indigo underline underline-offset-2"
        >
          Sign up for unlimited scans →
        </a>
      </div>
    );
  }

  // ── Hallucination result card ───────────────────────────────────────────
  if (result?.status === 'fail') {
    return (
      <div data-testid="hallucination-card" className="w-full rounded-2xl bg-surface-dark border-2 border-alert-crimson p-6 space-y-5">

        {/* Pulsing alert header */}
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-alert-crimson opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-alert-crimson" />
          </span>
          <p className="text-base font-bold text-alert-crimson">
            AI Hallucination Detected
          </p>
          <span className="ml-auto rounded-full bg-alert-crimson/15 px-2.5 py-0.5 text-xs font-semibold text-alert-crimson uppercase tracking-wide">
            {result.severity}
          </span>
        </div>

        {/* Business + engine */}
        <div className="rounded-xl bg-midnight-slate border border-white/5 px-4 py-3 space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Business</p>
          <p className="text-sm font-semibold text-white">{result.business_name}</p>
        </div>

        {/* Claim vs. reality */}
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

        {/* Context note */}
        <p className="text-xs text-slate-400 leading-relaxed">
          {result.engine} is currently telling potential customers that your business is{' '}
          <span className="text-alert-crimson font-semibold">{result.claim_text.toLowerCase()}</span>.
          Every customer who sees this hallucination may visit a competitor instead.
        </p>

        {/* CTA */}
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

  // ── Scan form ──────────────────────────────────────────────────────────
  return (
    <div className="w-full rounded-2xl bg-surface-dark border border-white/10 p-6">
      <p className="text-sm font-semibold text-white mb-1">
        Free AI Hallucination Scan
      </p>
      <p className="text-xs text-slate-500 mb-4">
        No signup required. See what ChatGPT says about your business right now.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="businessName"
          type="text"
          required
          placeholder="Business Name"
          disabled={isPending}
          className="w-full rounded-xl bg-midnight-slate border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-electric-indigo/50 disabled:opacity-50 transition"
        />
        <input
          name="city"
          type="text"
          required
          placeholder="City, State"
          disabled={isPending}
          className="w-full rounded-xl bg-midnight-slate border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-electric-indigo/50 disabled:opacity-50 transition"
        />
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-electric-indigo px-4 py-2.5 text-sm font-semibold text-white hover:bg-electric-indigo/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {isPending ? (
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
