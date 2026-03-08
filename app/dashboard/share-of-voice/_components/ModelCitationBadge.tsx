'use client';

// ---------------------------------------------------------------------------
// ModelCitationBadge — Per-model cited / not-cited / inconclusive badge
//
// Sprint 123: Shows citation status for a single AI model.
// ---------------------------------------------------------------------------

import type { SOVModelId } from '@/lib/config/sov-models';
import { SOV_MODEL_CONFIGS } from '@/lib/config/sov-models';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

/** Proxy tooltip text keyed by model ID */
const PROXY_TOOLTIPS: Partial<Record<SOVModelId, string>> = {
  copilot_bing:
    'Microsoft Copilot data is estimated via a Bing-grounded model. Direct Copilot API is not publicly available.',
  grok_xai:
    'Grok results are sourced via the xAI API with native web search grounding.',
  youcom_search:
    'You.com results are sourced via the You.com Research API with native web search.',
};

interface Props {
  model_provider: SOVModelId;
  display_name: string;
  cited: boolean;
  citation_count: number;
  confidence: 'high' | 'medium' | 'low';
}

export default function ModelCitationBadge({
  model_provider,
  display_name,
  cited,
  citation_count,
  confidence,
}: Props) {
  // Determine visual state
  let statusText: string;
  let statusClass: string;
  let dotClass: string;

  if (cited && confidence === 'high') {
    statusText = citation_count > 1 ? `Mentioned ${citation_count}x` : 'Mentioned';
    statusClass = 'text-signal-green';
    dotClass = 'bg-signal-green';
  } else if (cited && confidence === 'medium') {
    statusText = 'Possibly mentioned';
    statusClass = 'text-alert-amber';
    dotClass = 'bg-alert-amber';
  } else {
    statusText = 'Not mentioned';
    statusClass = 'text-[#94A3B8]';
    dotClass = 'bg-[#94A3B8]/50';
  }

  return (
    <div
      className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2"
      data-testid={`model-badge-${model_provider}`}
    >
      {/* Status dot */}
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />

      {/* Model name */}
      <span className="inline-flex min-w-[80px] items-center gap-1 text-xs font-semibold text-white">
        {display_name}
        {SOV_MODEL_CONFIGS[model_provider]?.is_proxy && (
          <>
            <span aria-hidden="true">*</span>
            <InfoTooltip
              content={PROXY_TOOLTIPS[model_provider] ?? 'This model uses a proxy approximation.'}
              label={`${display_name} proxy information`}
            />
          </>
        )}
      </span>

      {/* Citation status */}
      <span className={`text-xs font-medium ${statusClass}`}>
        {statusText}
      </span>
    </div>
  );
}
