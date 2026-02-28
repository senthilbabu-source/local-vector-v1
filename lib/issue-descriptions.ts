/**
 * lib/issue-descriptions.ts
 *
 * Converts raw hallucination alert and technical finding data into
 * plain-English consequence sentences written for business owners.
 *
 * Design rule: every sentence must answer "what does this mean for my business?"
 * not "what did the system detect?"
 *
 * Sprint G — Human-Readable Dashboard.
 */

import type { HallucinationRow } from '@/lib/data/dashboard';

// ─── Types ──────────────────────────────────────────────────────────────────

export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface IssueDescription {
  /** One-line plain-English consequence sentence */
  headline: string;
  /** Optional: one additional sentence of context */
  subtext?: string;
  /** Severity level — drives badge color */
  severity: IssueSeverity;
  /** Where to go to fix this */
  fixHref: string;
  /** Label for the fix CTA */
  fixLabel: 'Fix with AI' | 'How to fix →' | 'View details →';
  /** True if "Fix with AI" uses a credit */
  costsCredit: boolean;
  /** Category tag shown as a small badge */
  category: 'AI search' | 'Site health' | 'Listings' | 'Content';
}

// ─── Model display names ──────────────────────────────────────────────────

const MODEL_NAMES: Record<string, string> = {
  'openai-gpt4o': 'ChatGPT',
  'openai-gpt4o-mini': 'ChatGPT',
  'perplexity-sonar': 'Perplexity',
  'google-gemini': 'Gemini',
  'anthropic-claude': 'Claude',
  'microsoft-copilot': 'Microsoft Copilot',
};

export function getModelName(modelProvider: string | null | undefined): string {
  if (!modelProvider) return 'An AI model';
  return MODEL_NAMES[modelProvider] ?? modelProvider;
}

// ─── Severity mapping ─────────────────────────────────────────────────────
// DB uses critical/high/medium/low; UI uses critical/warning/info

export function mapSeverity(
  dbSeverity: 'critical' | 'high' | 'medium' | 'low' | string,
): IssueSeverity {
  if (dbSeverity === 'critical' || dbSeverity === 'high') return 'critical';
  if (dbSeverity === 'medium') return 'warning';
  return 'info';
}

// ─── Alert → description ─────────────────────────────────────────────────

/**
 * Converts a HallucinationRow into a plain-English IssueDescription.
 * Category values from DB: 'status', 'hours', 'amenity', 'menu', 'address', 'phone'.
 */
export function describeAlert(alert: HallucinationRow): IssueDescription {
  const modelName = getModelName(alert.model_provider);
  const category = (alert.category ?? '').toLowerCase();
  const severity = mapSeverity(alert.severity);

  switch (category) {
    case 'hours':
      return {
        headline: alert.claim_text && alert.expected_truth
          ? `${modelName} says "${alert.claim_text}" — the truth is "${alert.expected_truth}"`
          : `${modelName} is showing incorrect business hours`,
        severity,
        fixHref: '/dashboard/hallucinations',
        fixLabel: 'Fix with AI',
        costsCredit: true,
        category: 'AI search',
      };

    case 'address':
      return {
        headline: alert.claim_text
          ? `${modelName} is sending customers to the wrong address: "${alert.claim_text}"`
          : `${modelName} is showing an incorrect location for your business`,
        subtext: 'Customers following these directions will never arrive.',
        severity,
        fixHref: '/dashboard/hallucinations',
        fixLabel: 'Fix with AI',
        costsCredit: true,
        category: 'AI search',
      };

    case 'phone':
      return {
        headline: alert.claim_text
          ? `${modelName} is showing the wrong phone number: "${alert.claim_text}"`
          : `${modelName} has an incorrect phone number for your business`,
        severity,
        fixHref: '/dashboard/hallucinations',
        fixLabel: 'Fix with AI',
        costsCredit: true,
        category: 'AI search',
      };

    case 'menu':
      return {
        headline: alert.claim_text
          ? `${modelName} has wrong menu information: "${alert.claim_text}"`
          : `${modelName} is showing incorrect menu or pricing information`,
        severity,
        fixHref: '/dashboard/hallucinations',
        fixLabel: 'Fix with AI',
        costsCredit: true,
        category: 'AI search',
      };

    case 'status':
      return {
        headline: alert.claim_text
          ? `${modelName} claims "${alert.claim_text}" — ${alert.expected_truth ? `the truth: "${alert.expected_truth}"` : 'this is incorrect'}`
          : `${modelName} is showing incorrect business status`,
        subtext: 'Customers who see this will go somewhere else.',
        severity,
        fixHref: '/dashboard/hallucinations',
        fixLabel: 'Fix with AI',
        costsCredit: true,
        category: 'AI search',
      };

    case 'amenity':
      return {
        headline: alert.claim_text
          ? `${modelName} says "${alert.claim_text}" — ${alert.expected_truth ? `the truth: "${alert.expected_truth}"` : 'this is wrong'}`
          : `${modelName} has incorrect information about your amenities`,
        severity,
        fixHref: '/dashboard/hallucinations',
        fixLabel: 'Fix with AI',
        costsCredit: true,
        category: 'AI search',
      };

    default:
      // Fallback — a new category was added without a template.
      return {
        headline: alert.claim_text
          ? `${modelName} states "${alert.claim_text}" — this is incorrect`
          : `${modelName} found an issue with your business information`,
        severity,
        fixHref: '/dashboard/hallucinations',
        fixLabel: 'View details →',
        costsCredit: false,
        category: 'AI search',
      };
  }
}

// ─── Technical finding descriptions ──────────────────────────────────────

export type TechnicalFindingType =
  | 'bot_blind_spot'
  | 'content_thin'
  | 'schema_missing';

export interface TechnicalFindingInput {
  type: TechnicalFindingType;
  affectedCount?: number;
  botName?: string;
}

export function describeTechnicalFinding(
  finding: TechnicalFindingInput,
): IssueDescription {
  switch (finding.type) {
    case 'bot_blind_spot':
      return {
        headline: `${finding.botName ?? 'An AI crawler'} can't reach your website — it's relying on outdated sources`,
        subtext: finding.affectedCount
          ? `${finding.affectedCount.toLocaleString()} expected visits in the last 30 days, but none recorded.`
          : undefined,
        severity: 'warning',
        fixHref: '/dashboard/crawler-analytics',
        fixLabel: 'How to fix →',
        costsCredit: false,
        category: 'Site health',
      };

    case 'content_thin':
      return {
        headline:
          'Your website pages have too little text — AI models are guessing about your business',
        severity: 'info',
        fixHref: '/dashboard/source-intelligence',
        fixLabel: 'View details →',
        costsCredit: false,
        category: 'Site health',
      };

    case 'schema_missing':
      return {
        headline:
          'Your website is missing structured data that AI models use to understand your business',
        severity: 'info',
        fixHref: '/dashboard/magic-menus',
        fixLabel: 'How to fix →',
        costsCredit: false,
        category: 'AI search',
      };
  }
}
