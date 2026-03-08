'use client';
// ---------------------------------------------------------------------------
// EmailCaptureForm — Sprint P2-7b: viral scanner email lead capture
//
// Lower-friction CTA between scan results and /signup.
// Captures email + promises the "full report" (all 5 AI models) by email.
//
// States:
//   idle    — shows email input + hidden fields + submit button
//   loading — button disabled, spinner visible
//   success — thank-you message + "Create free account" secondary link
//   error   — inline error + retry allowed
//
// Design matches ScanDashboard.tsx: #050A15 bg, JetBrains Mono labels,
// lv-btn-green / lv-btn-outline classes, no emojis.
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { captureLeadEmail } from '@/app/actions/marketing';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  businessName: string;
  scanStatus:   'fail' | 'pass' | 'not_found';
}

// ---------------------------------------------------------------------------
// EmailCaptureForm
// ---------------------------------------------------------------------------

export default function EmailCaptureForm({ businessName, scanStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<'idle' | 'success' | 'error'>('idle');
  const [email, setEmail] = useState('');
  const [reportId, setReportId] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await captureLeadEmail(fd);
      if (result.ok) {
        setReportId(result.reportId ?? null);
        setState('success');
      } else {
        setState('error');
      }
    });
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <div
        data-testid="email-capture-success"
        className="lv-card text-center"
        style={{ borderLeft: '3px solid #00F5A0' }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-6 w-6 mx-auto mb-3"
          style={{ color: '#00F5A0' }}
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-base font-semibold mb-1" style={{ color: '#F1F5F9' }}>
          Report on its way
        </p>
        <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
          We&apos;ll email your full 5-model AI audit to{' '}
          <span style={{ color: '#F1F5F9' }}>{email}</span>. Check your inbox in a few minutes.
        </p>
        <a
          href="/signup"
          className="lv-btn-green"
          style={{ display: 'inline-block', fontSize: 14, padding: '12px 32px' }}
        >
          Create free account — fix the issues
        </a>
        <p
          className="mt-3"
          style={{ fontSize: 11, color: '#475569', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
        >
          No credit card required &middot; Cancel anytime
        </p>
        {/* Sprint A: shareable report link */}
        {reportId && (
          <p className="mt-4" style={{ fontSize: 12, color: '#475569' }}>
            <a
              href={`/report/scan/${reportId}`}
              style={{ color: '#94A3B8', textDecoration: 'underline', textUnderlineOffset: 2 }}
            >
              Share this report
            </a>
          </p>
        )}
      </div>
    );
  }

  // ── Idle / error state ────────────────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      data-testid="email-capture-form"
      noValidate
    >
      {/* Hidden fields carry scan context to the server action */}
      <input type="hidden" name="businessName" value={businessName} />
      <input type="hidden" name="scanStatus"   value={scanStatus} />

      <p
        className="text-xs font-bold uppercase mb-3 text-center"
        style={{
          color: '#00F5A0',
          letterSpacing: '0.14em',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
        }}
      >
        Get the full report
      </p>
      <p className="text-sm text-center mb-5" style={{ color: '#94A3B8' }}>
        Enter your email and we&apos;ll send you the complete audit across all 5 AI models —
        including your AI Health Score, competitor mentions, and fix recommendations.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@yourrestaurant.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="email-input"
          className="flex-1 rounded-lg border px-4 py-3 text-sm outline-none focus:ring-2"
          style={{
            background:   'rgba(255,255,255,0.04)',
            borderColor:  state === 'error' ? '#EF4444' : 'rgba(255,255,255,0.12)',
            color:        '#F1F5F9',
            fontFamily:   'var(--font-outfit), sans-serif',
            /* Ring on focus */
          }}
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending || !email}
          data-testid="email-submit"
          className="lv-btn-green"
          style={{ padding: '12px 28px', fontSize: 14, whiteSpace: 'nowrap' }}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              Sending&hellip;
            </span>
          ) : (
            'Email me the full report'
          )}
        </button>
      </div>

      {state === 'error' && (
        <p
          className="text-xs text-center"
          style={{ color: '#EF4444', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
          data-testid="email-error"
          role="alert"
        >
          Something went wrong. Please try again.
        </p>
      )}

      <p
        className="text-xs text-center"
        style={{ color: '#475569', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >
        One email, no spam &middot; Unsubscribe anytime
      </p>
    </form>
  );
}
