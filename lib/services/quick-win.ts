// ---------------------------------------------------------------------------
// lib/services/quick-win.ts — S39: Quick Win Widget
//
// Pure function that picks the single highest-impact action for the dashboard.
// Priority: critical hallucination > hours mismatch > no menu > low SOV.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuickWin {
  action: string;
  timeEstimate: string;
  estimatedRecovery: number;
  href: string;
  ctaText: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface QuickWinAlert {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string | null;
  model_provider: string;
  claim_text: string;
  revenue_recovered_monthly: number | null;
}

export interface QuickWinConfig {
  menuPublished: boolean;
  napScore: number | null;
  sovPercent: number | null;
  avgCustomerValue?: number;
  monthlyCovers?: number;
}

// ---------------------------------------------------------------------------
// Pure function
// ---------------------------------------------------------------------------

const MODEL_DISPLAY: Record<string, string> = {
  'openai-gpt4o': 'ChatGPT',
  'perplexity-sonar': 'Perplexity',
  'google-gemini': 'Gemini',
  'anthropic-claude': 'Claude',
  'microsoft-copilot': 'Copilot',
};

function modelName(provider: string): string {
  return MODEL_DISPLAY[provider] ?? provider;
}

/**
 * Picks the single highest-impact action from available data.
 * Returns null when nothing is actionable.
 */
export function pickQuickWin(
  alerts: QuickWinAlert[],
  config: QuickWinConfig,
): QuickWin | null {
  // 1. Critical/high hallucination with highest revenue
  const criticalAlerts = alerts
    .filter((a) => a.severity === 'critical' || a.severity === 'high')
    .sort((a, b) => (b.revenue_recovered_monthly ?? 0) - (a.revenue_recovered_monthly ?? 0));

  if (criticalAlerts.length > 0) {
    const top = criticalAlerts[0];
    const category = top.category ?? 'info';
    return {
      action: `Fix wrong ${category} on ${modelName(top.model_provider)}`,
      timeEstimate: '~2 min',
      estimatedRecovery: top.revenue_recovered_monthly ?? 0,
      href: '/dashboard/hallucinations',
      ctaText: 'Fix now',
      severity: top.severity,
    };
  }

  // 2. Hours mismatch (NAP score < 80)
  if (config.napScore !== null && config.napScore < 80) {
    return {
      action: 'Update your business hours across platforms',
      timeEstimate: '~5 min',
      estimatedRecovery: Math.round((config.avgCustomerValue ?? 55) * (config.monthlyCovers ?? 1800) * 0.01),
      href: '/dashboard/entity-health',
      ctaText: 'Fix hours',
      severity: 'high',
    };
  }

  // 3. No published menu
  if (!config.menuPublished) {
    return {
      action: 'Upload your menu so AI can recommend your dishes',
      timeEstimate: '~10 min',
      estimatedRecovery: 0,
      href: '/dashboard/magic-menus',
      ctaText: 'Upload menu',
      severity: 'medium',
    };
  }

  // 4. Low SOV (< 20%)
  if (config.sovPercent !== null && config.sovPercent < 20) {
    return {
      action: 'Your AI visibility is low — run a scan to find gaps',
      timeEstimate: '~1 min',
      estimatedRecovery: 0,
      href: '/dashboard/share-of-voice',
      ctaText: 'Run scan',
      severity: 'low',
    };
  }

  return null;
}
