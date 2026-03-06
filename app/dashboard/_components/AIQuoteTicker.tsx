// ---------------------------------------------------------------------------
// AIQuoteTicker — Live scrolling strip of what AI is actually saying
//
// Shows real claim_text from open hallucination alerts (when present) so
// the owner immediately understands the stakes.  When AI is accurate, shows
// positive placeholder copy instead.
//
// Uses `lv-marquee` CSS keyframe (globals.css).  Content is duplicated so
// the infinite scroll looks seamless.  Pure server component — no JS needed.
// ---------------------------------------------------------------------------

import type { HallucinationRow } from '@/lib/data/dashboard';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AIQuoteTickerProps {
  alerts: HallucinationRow[];
  orgName: string;
}

interface TickerItem {
  model: string;
  text: string;
  isAlert: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MODEL_SHORT: Record<string, string> = {
  'openai-gpt4o':      'ChatGPT',
  'perplexity-sonar':  'Perplexity',
  'google-gemini':     'Gemini',
  'anthropic-claude':  'Claude',
  'microsoft-copilot': 'Copilot',
};

// Shown when there are no active hallucination alerts — positive framing.
const POSITIVE_ITEMS: TickerItem[] = [
  { model: 'ChatGPT',    text: 'AI is showing accurate hours, address, and menu info about your restaurant.', isAlert: false },
  { model: 'Gemini',     text: 'Voice searches for nearby restaurants include your listing today.',            isAlert: false },
  { model: 'Perplexity', text: 'Customers asking AI about your cuisine are seeing correct info.',             isAlert: false },
  { model: 'Copilot',    text: 'Your business facts are consistent across all AI search apps.',               isAlert: false },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildItems(alerts: HallucinationRow[]): TickerItem[] {
  if (alerts.length === 0) return POSITIVE_ITEMS;
  return alerts.slice(0, 6).map((a) => ({
    model: MODEL_SHORT[a.model_provider] ?? a.model_provider,
    text:  a.claim_text.length > 90 ? a.claim_text.slice(0, 90) + '…' : a.claim_text,
    isAlert: true,
  }));
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AIQuoteTicker({ alerts, orgName: _ }: AIQuoteTickerProps) {
  const items    = buildItems(alerts);
  // Duplicate for seamless infinite scroll
  const loopItems = [...items, ...items];
  const hasAlerts = alerts.length > 0;

  const accentColor  = hasAlerts ? '#FFB800' : '#00F5A0';
  const labelText    = hasAlerts ? '⚠ AI Says'  : '✓ AI Says';

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/5 bg-surface-dark"
      aria-label={hasAlerts ? 'AI is currently saying inaccurate things about your restaurant' : 'AI is accurately representing your restaurant'}
      role="region"
    >
      {/* Left label — sits above overflow:hidden so it masks the scroll */}
      <div
        className="absolute left-0 top-0 z-10 flex h-full items-center bg-surface-dark pl-4 pr-2"
        aria-hidden="true"
      >
        <span
          className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', color: accentColor }}
        >
          {labelText}
        </span>
        {/* Fade mask */}
        <div className="absolute right-0 top-0 h-full w-8 bg-gradient-to-r from-surface-dark to-transparent" />
      </div>

      {/* Right fade mask */}
      <div
        className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-surface-dark to-transparent"
        aria-hidden="true"
      />

      {/* Scrolling track */}
      <div className="py-2.5 pl-28 pr-4" aria-hidden="true">
        <div
          className="flex whitespace-nowrap"
          style={{ animation: 'lv-marquee 45s linear infinite' }}
        >
          {loopItems.map((item, i) => (
            <span key={i} className="inline-flex shrink-0 items-center gap-2.5 pr-14">
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', color: accentColor }}
              >
                {item.model}
              </span>
              <span className={`text-xs ${item.isAlert ? 'text-slate-300' : 'text-slate-400'}`}>
                &ldquo;{item.text}&rdquo;
              </span>
              <span className="text-white/10" aria-hidden="true">·</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
