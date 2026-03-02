// ---------------------------------------------------------------------------
// SampleDataBanner.tsx — "You're viewing sample data" banner (Sprint 117)
//
// Pure display component. No state. No API calls.
// Rendered when has_real_data = false. Disappears automatically when real
// data arrives (first_scan step completes).
// ---------------------------------------------------------------------------

export default function SampleDataBanner() {
  return (
    <div
      data-testid="sample-data-banner"
      className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3"
    >
      <p className="text-sm text-amber-200">
        <span className="mr-1.5 text-base">{'\uD83D\uDCCA'}</span>
        <strong>You&apos;re viewing sample data.</strong>{' '}
        Your real AI visibility data will appear here after your first scan
        (runs every Sunday).
      </p>
    </div>
  );
}
