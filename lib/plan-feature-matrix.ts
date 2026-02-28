// ---------------------------------------------------------------------------
// lib/plan-feature-matrix.ts — Sprint B (M3)
//
// Static feature matrix derived from lib/plan-enforcer.ts gating functions.
// Each row represents a feature, with plan columns indicating availability.
//
// IMPORTANT: If plan-enforcer.ts changes (new gates, changed tiers),
// update this file to match. These two files must stay in sync.
//
// Plans: trial | starter | growth | agency
// Display names: The Audit | Starter | AI Shield | Brand Fortress
// ---------------------------------------------------------------------------

export interface FeatureRow {
  label: string;
  category: 'Core' | 'AI Monitoring' | 'Competitive' | 'Content' | 'Integrations' | 'Support';
  trial:   boolean | string;
  starter: boolean | string;
  growth:  boolean | string;
  agency:  boolean | string;
}

export const PLAN_FEATURE_MATRIX: FeatureRow[] = [
  // ── Core ──────────────────────────────────────────────────────────────────
  { category: 'Core',          label: 'Reality Score',                trial: true,    starter: true,    growth: true,    agency: true    },
  { category: 'Core',          label: 'Weekly hallucination scan',    trial: true,    starter: true,    growth: true,    agency: true    },
  { category: 'Core',          label: 'Daily hallucination scan',     trial: false,   starter: false,   growth: true,    agency: true    },
  { category: 'Core',          label: 'Hallucination alerts',         trial: true,    starter: true,    growth: true,    agency: true    },
  { category: 'Core',          label: 'Weekly digest email',          trial: false,   starter: true,    growth: true,    agency: true    },

  // ── AI Monitoring ──────────────────────────────────────────────────────────
  { category: 'AI Monitoring', label: 'ChatGPT monitoring',           trial: true,    starter: true,    growth: true,    agency: true    },
  { category: 'AI Monitoring', label: 'Perplexity monitoring',        trial: true,    starter: true,    growth: true,    agency: true    },
  { category: 'AI Monitoring', label: 'Gemini monitoring',            trial: true,    starter: true,    growth: true,    agency: true    },
  { category: 'AI Monitoring', label: 'Multi-model SOV',              trial: false,   starter: false,   growth: true,    agency: true    },
  { category: 'AI Monitoring', label: 'Share of Voice tracking',      trial: false,   starter: false,   growth: true,    agency: true    },

  // ── Competitive ────────────────────────────────────────────────────────────
  { category: 'Competitive',   label: 'Competitor tracking',          trial: false,   starter: false,   growth: '3 max', agency: '10 max' },
  { category: 'Competitive',   label: 'Competitor intercept analysis',trial: false,   starter: false,   growth: true,    agency: true    },
  { category: 'Competitive',   label: 'Cluster map analysis',         trial: false,   starter: false,   growth: true,    agency: true    },
  { category: 'Competitive',   label: 'Citation gap dashboard',       trial: false,   starter: false,   growth: true,    agency: true    },

  // ── Content ────────────────────────────────────────────────────────────────
  { category: 'Content',       label: 'Magic Menu schema generation', trial: false,   starter: true,    growth: true,    agency: true    },
  { category: 'Content',       label: 'AI content drafts',            trial: false,   starter: false,   growth: true,    agency: true    },
  { category: 'Content',       label: 'AEO page audit',               trial: false,   starter: false,   growth: true,    agency: true    },
  { category: 'Content',       label: 'Occasion engine',              trial: false,   starter: false,   growth: true,    agency: true    },
  { category: 'Content',       label: 'CSV/PDF export',               trial: false,   starter: false,   growth: true,    agency: true    },
  { category: 'Content',       label: 'llms.txt regeneration',        trial: false,   starter: false,   growth: true,    agency: true    },

  // ── Integrations ──────────────────────────────────────────────────────────
  { category: 'Integrations',  label: 'Google Business Profile sync', trial: false,   starter: true,    growth: true,    agency: true    },
  { category: 'Integrations',  label: 'Webhook alerts (Slack/Zapier)',trial: false,   starter: false,   growth: false,   agency: true    },
  { category: 'Integrations',  label: 'Multiple locations',           trial: '1',     starter: '1',     growth: '1',     agency: '10'    },
  { category: 'Integrations',  label: 'Team seats',                   trial: '1',     starter: '1',     growth: '1',     agency: '5'     },
];
