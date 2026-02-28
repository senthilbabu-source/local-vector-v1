// ---------------------------------------------------------------------------
// HallucinationsPageHeader — Sprint H: Verdict-first header for triage view.
// ---------------------------------------------------------------------------

interface HallucinationsPageHeaderProps {
  openCount: number;
  resolvedCount: number;
}

export default function HallucinationsPageHeader({
  openCount,
  resolvedCount,
}: HallucinationsPageHeaderProps) {
  return (
    <div>
      {openCount === 0 ? (
        <p
          className="mt-1 text-sm text-signal-green font-medium"
          data-testid="alerts-verdict-clean"
        >
          No wrong facts detected — AI models are describing your business correctly.
          {resolvedCount > 0 && (
            <span className="ml-1 text-muted-foreground font-normal">
              {resolvedCount} issue{resolvedCount !== 1 ? 's' : ''} previously fixed.
            </span>
          )}
        </p>
      ) : (
        <p className="mt-1 text-sm text-foreground" data-testid="alerts-verdict-issues">
          <span className="font-semibold text-alert-crimson">
            {openCount} wrong fact{openCount !== 1 ? 's' : ''}
          </span>{' '}
          detected across AI models.{' '}
          <span className="text-muted-foreground">
            Fix these to stop customers receiving incorrect information.
          </span>
        </p>
      )}
    </div>
  );
}
