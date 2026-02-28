'use client';

// ---------------------------------------------------------------------------
// ListingVerificationRow — Sprint L (C2 Phase 2)
//
// Renders a verification section below PlatformRow for platforms that support
// API-based verification (currently Yelp). Shows what the platform is
// displaying about the business and flags any discrepancies.
//
// Deep Night theme — matches PlatformRow styling.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import type { VerificationResult, Discrepancy } from '@/lib/integrations/detect-discrepancies';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ListingVerificationRowProps {
  platform: string;
  platformLabel: string;
  claimUrl: string;
  cachedResult: VerificationResult | null;
  locationId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ListingVerificationRow({
  platform,
  platformLabel,
  claimUrl,
  cachedResult,
  locationId,
}: ListingVerificationRowProps) {
  const [result, setResult] = useState<VerificationResult | null>(cachedResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/verify-${platform}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(body.error ?? 'Verification failed');
        return;
      }
      const { result: newResult } = await res.json();
      setResult(newResult);
    } catch (_err) {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  const hasDiscrepancies = result?.discrepancies && result.discrepancies.length > 0;
  const notFound = result?.found === false;
  const verified = result?.found === true && !hasDiscrepancies;

  return (
    <div
      className="border-t border-white/5 px-5 py-3 space-y-3"
      data-testid={`listing-verification-${platform}`}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-slate-400">
            Data Verification
          </p>
          {!result && (
            <span className="text-[10px] text-slate-600">Not yet verified</span>
          )}
          {notFound && (
            <span className="text-[10px] text-amber-400">Not found on this platform</span>
          )}
          {verified && (
            <span className="text-[10px] text-emerald-400">Verified — data matches</span>
          )}
          {hasDiscrepancies && (
            <span className="text-[10px] text-red-400">
              {result!.discrepancies.length} discrepanc{result!.discrepancies.length === 1 ? 'y' : 'ies'} found
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Status icon */}
          {notFound && (
            <AlertCircle
              className="h-3.5 w-3.5 text-amber-400"
              data-testid={`${platform}-status-not-found`}
            />
          )}
          {verified && (
            <CheckCircle2
              className="h-3.5 w-3.5 text-emerald-400"
              data-testid={`${platform}-status-ok`}
            />
          )}
          {hasDiscrepancies && (
            <XCircle
              className="h-3.5 w-3.5 text-red-400"
              data-testid={`${platform}-status-discrepancy`}
            />
          )}

          {/* Verify / Re-verify button */}
          <button
            type="button"
            onClick={handleVerify}
            disabled={loading}
            className={[
              'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
              loading
                ? 'border-slate-700 bg-slate-800 text-slate-500 cursor-wait'
                : 'border-electric-indigo/30 bg-electric-indigo/5 text-electric-indigo hover:bg-electric-indigo/10',
            ].join(' ')}
            data-testid={`${platform}-verify-btn`}
          >
            <RefreshCw
              className={['h-3 w-3', loading ? 'animate-spin' : ''].join(' ')}
              aria-hidden="true"
            />
            {loading ? 'Checking\u2026' : result ? 'Re-verify' : 'Verify now'}
          </button>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <p className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {/* ── Verified data — what the platform shows ────────────────────── */}
      {result?.found && (
        <div className="rounded-md border border-white/5 bg-midnight-slate px-3 py-2 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            What {platformLabel} is showing
          </p>
          <div className="space-y-1 text-xs">
            {result.platformName && (
              <div className="flex gap-2">
                <span className="w-20 shrink-0 text-slate-500">Name</span>
                <span className="text-slate-300">{result.platformName}</span>
              </div>
            )}
            {result.platformAddress && (
              <div className="flex gap-2">
                <span className="w-20 shrink-0 text-slate-500">Address</span>
                <span className="text-slate-300">{result.platformAddress}</span>
              </div>
            )}
            {result.platformPhone && (
              <div className="flex gap-2">
                <span className="w-20 shrink-0 text-slate-500">Phone</span>
                <span className="text-slate-300">{result.platformPhone}</span>
              </div>
            )}
            {result.platformRating !== undefined && (
              <div className="flex gap-2">
                <span className="w-20 shrink-0 text-slate-500">Rating</span>
                <span className="text-slate-300">
                  {result.platformRating}/5 ({result.platformReviewCount ?? 0} reviews)
                </span>
              </div>
            )}
          </div>
          {result.platformUrl && (
            <a
              href={result.platformUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-electric-indigo hover:text-electric-indigo/80"
            >
              View on {platformLabel}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* ── Discrepancies ──────────────────────────────────────────────── */}
      {hasDiscrepancies && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
            Discrepancies found
          </p>
          {result!.discrepancies.map((d: Discrepancy, i: number) => (
            <div key={i} className="text-xs space-y-0.5">
              <p className="font-medium text-red-300">{d.field}</p>
              <p className="text-red-400/80">
                {platformLabel} shows:{' '}
                <span className="font-medium text-red-300">{d.platformValue}</span>
              </p>
              <p className="text-slate-500">
                Your data:{' '}
                <span className="font-medium text-slate-400">{d.localValue}</span>
              </p>
            </div>
          ))}
          <a
            href={claimUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-red-400 underline hover:text-red-300"
            data-testid={`${platform}-claim-link`}
          >
            Fix on {platformLabel}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* ── Not found ──────────────────────────────────────────────────── */}
      {notFound && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300/80">
          Your business wasn&apos;t found on {platformLabel} by phone number. You may not have a
          listing yet, or your phone number may differ.{' '}
          <a
            href={claimUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-200"
            data-testid={`${platform}-claim-link`}
          >
            Claim your {platformLabel} listing &rarr;
          </a>
        </div>
      )}

      {/* ── Last verified ──────────────────────────────────────────────── */}
      {result?.verifiedAt && (
        <p className="text-[10px] text-slate-600">
          Last checked:{' '}
          {new Date(result.verifiedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  );
}
