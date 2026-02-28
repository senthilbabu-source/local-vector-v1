import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type {
  SourceIntelligenceResult,
} from '@/lib/services/source-intelligence.service';

// ---------------------------------------------------------------------------
// SourceHealthSummaryPanel — Sprint I
//
// Summary of the overall source health landscape.
// Shows: total sources, first-party rate, alert count, category distribution.
// Plain-English verdict based on first-party rate and alert severity.
// ---------------------------------------------------------------------------

interface SourceHealthSummaryPanelProps {
  result: SourceIntelligenceResult;
}

export function SourceHealthSummaryPanel({
  result,
}: SourceHealthSummaryPanelProps) {
  const { sources, alerts, firstPartyRate, categoryBreakdown } = result;
  const totalSources = sources.length;

  const firstPartyCount =
    categoryBreakdown.find((c) => c.category === 'first_party')?.count ?? 0;
  const competitorCount =
    categoryBreakdown.find((c) => c.category === 'competitor')?.count ?? 0;
  const reviewSiteCount =
    categoryBreakdown.find((c) => c.category === 'review_site')?.count ?? 0;

  const highAlerts = alerts.filter((a) => a.severity === 'high').length;
  const totalAlerts = alerts.length;

  const firstPartyColor =
    firstPartyRate >= 20
      ? 'text-signal-green'
      : firstPartyRate >= 10
        ? 'text-alert-amber'
        : 'text-alert-crimson';

  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark p-5 space-y-4"
      data-testid="source-health-summary"
    >
      {/* Heading + tooltip */}
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-white">
          {totalSources} source{totalSources !== 1 ? 's' : ''} teaching AI
          about your business
        </h2>
        <InfoTooltip
          content={
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-white">What are sources?</p>
              <p className="text-xs text-slate-300">
                These are websites that AI models read to learn about your business. High-citation sources have the most influence over what AI says.
              </p>
              <p className="text-xs text-slate-400">
                Increase your first-party citation rate by improving your website content and structured data.
              </p>
            </div>
          }
        />
      </div>

      {/* Health grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          className="rounded-lg bg-signal-green/5 border border-signal-green/10 px-3 py-2 text-center"
          data-testid="source-count-first-party"
        >
          <p className="text-lg font-bold font-mono text-signal-green">
            {firstPartyCount}
          </p>
          <p className="text-[10px] text-signal-green/70 leading-tight">
            First-party
            <br />
            sources
          </p>
        </div>
        <div
          className="rounded-lg bg-electric-indigo/5 border border-electric-indigo/10 px-3 py-2 text-center"
          data-testid="source-count-review"
        >
          <p className="text-lg font-bold font-mono text-electric-indigo">
            {reviewSiteCount}
          </p>
          <p className="text-[10px] text-electric-indigo/70 leading-tight">
            Review
            <br />
            sites
          </p>
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-center ${
            competitorCount > 0
              ? 'bg-alert-crimson/5 border border-alert-crimson/10'
              : 'bg-white/[0.02] border border-white/5'
          }`}
          data-testid="source-count-competitor"
        >
          <p
            className={`text-lg font-bold font-mono ${
              competitorCount > 0
                ? 'text-alert-crimson'
                : 'text-slate-600'
            }`}
          >
            {competitorCount}
          </p>
          <p
            className={`text-[10px] leading-tight ${
              competitorCount > 0
                ? 'text-alert-crimson/70'
                : 'text-slate-600'
            }`}
          >
            Competitor
            <br />
            sources
          </p>
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-center ${
            totalAlerts > 0
              ? 'bg-alert-amber/5 border border-alert-amber/10'
              : 'bg-white/[0.02] border border-white/5'
          }`}
          data-testid="source-count-alerts"
        >
          <p
            className={`text-lg font-bold font-mono ${
              totalAlerts > 0 ? 'text-alert-amber' : 'text-slate-600'
            }`}
          >
            {totalAlerts}
          </p>
          <p
            className={`text-[10px] leading-tight ${
              totalAlerts > 0 ? 'text-alert-amber/70' : 'text-slate-600'
            }`}
          >
            Active
            <br />
            alerts
          </p>
        </div>
      </div>

      {/* First-party rate */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">First-party citation rate:</span>
        <span className={`text-sm font-bold font-mono ${firstPartyColor}`}>
          {firstPartyRate}%
        </span>
        {firstPartyRate < 10 && (
          <span className="text-[10px] text-alert-crimson">
            — AI models rarely cite your own website
          </span>
        )}
        {firstPartyRate >= 10 && firstPartyRate < 20 && (
          <span className="text-[10px] text-alert-amber">
            — room to improve
          </span>
        )}
        {firstPartyRate >= 20 && (
          <span className="text-[10px] text-signal-green">
            — healthy
          </span>
        )}
      </div>

      {/* Plain-English verdict */}
      {highAlerts > 0 ? (
        <div
          className="rounded-lg bg-alert-crimson/5 border border-alert-crimson/20 px-4 py-3 text-sm text-alert-crimson"
          data-testid="source-verdict-urgent"
        >
          <span className="font-semibold">
            {highAlerts} high-priority alert{highAlerts !== 1 ? 's' : ''}
          </span>{' '}
          detected in your source landscape. These issues are actively influencing
          how AI models describe your business. Review the alerts below and take
          action on the most impactful ones first.
        </div>
      ) : totalAlerts > 0 ? (
        <p
          className="text-sm text-alert-amber"
          data-testid="source-verdict-minor"
        >
          {totalAlerts} alert{totalAlerts !== 1 ? 's' : ''} detected, but none
          are high priority. Fix your hallucination alerts first, then return to
          address these source-level issues.
        </p>
      ) : firstPartyRate >= 20 ? (
        <p
          className="text-sm text-signal-green font-medium"
          data-testid="source-verdict-clean"
        >
          Your source landscape is healthy — AI models are citing your own
          website and trusted review sites.
        </p>
      ) : (
        <p
          className="text-sm text-slate-400"
          data-testid="source-verdict-low-fp"
        >
          Your first-party citation rate is low. Improving your website content
          and structured data will help AI models cite your website more often.
        </p>
      )}
    </div>
  );
}
