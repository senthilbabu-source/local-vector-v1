// ---------------------------------------------------------------------------
// CoachBriefCard — "Your Coach" weekly mission card
//
// Pure server component.  No state or effects — just Links and JSX.
//
// Derives 1–2 actionable missions from live dashboard data in this order:
//   1. Critical / high hallucinations  → "Fix [model]'s wrong info"
//   2. Medium / low hallucinations     → "Review N AI accuracy issues"
//   3. Pending content drafts          → "Publish N AI-written posts"
//   4. Score < 60 with no other tasks  → "Run a fresh AI scan"
//   5. All clear (default)             → Proactive menu / season task
//
// Design:
//   • lv-scan sweep decoration on top edge (2 px accent line)
//   • Warm "coach" framing: avatar + name + coaching voice in copy
//   • Each mission is a full-click Link card with urgency dot + time est.
//   • One accent per card rule: electric-indigo on coach avatar ring
// ---------------------------------------------------------------------------

import Link from 'next/link';
import type { HallucinationRow } from '@/lib/data/dashboard';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CoachBriefCardProps {
  alerts: HallucinationRow[];
  draftsPending: number;
  score: number | null;
  firstName: string;
}

interface Mission {
  title: string;
  why: string;
  href: string;
  estimatedMins: number;
  urgency: 'high' | 'medium' | 'low';
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MODEL_SHORT: Record<string, string> = {
  'openai-gpt4o':      'ChatGPT',
  'perplexity-sonar':  'Perplexity',
  'google-gemini':     'Gemini',
  'anthropic-claude':  'Claude',
  'microsoft-copilot': 'Copilot',
};

const URGENCY: Record<Mission['urgency'], { dot: string; badge: string; badgeText: string }> = {
  high:   { dot: 'bg-alert-crimson',  badge: 'bg-alert-crimson/10 ring-alert-crimson/25 text-alert-crimson',  badgeText: 'Urgent' },
  medium: { dot: 'bg-alert-amber',    badge: 'bg-alert-amber/10   ring-alert-amber/25   text-alert-amber',    badgeText: 'This week' },
  low:    { dot: 'bg-truth-emerald',  badge: 'bg-truth-emerald/10 ring-truth-emerald/25 text-truth-emerald',  badgeText: 'When you can' },
};

// ─── Mission derivation ──────────────────────────────────────────────────────

function deriveMissions(
  alerts: HallucinationRow[],
  draftsPending: number,
  score: number | null,
): Mission[] {
  const missions: Mission[] = [];

  // 1. Critical / high — most urgent
  const topPriority = alerts.filter((a) => a.severity === 'critical' || a.severity === 'high');
  if (topPriority.length > 0) {
    const top   = topPriority[0];
    const model = MODEL_SHORT[top.model_provider] ?? 'an AI app';
    missions.push({
      title:         `Fix ${model}'s wrong info about you`,
      why:           `Every customer who asks ${model} about your restaurant sees the wrong answer until this is fixed.`,
      href:          '/dashboard/hallucinations',
      estimatedMins: 2,
      urgency:       'high',
    });
  }

  // 2. Medium / low hallucinations (if no critical, or as second task)
  const mediumAlerts = alerts.filter((a) => a.severity === 'medium' || a.severity === 'low');
  if (missions.length < 2 && mediumAlerts.length > 0 && topPriority.length === 0) {
    missions.push({
      title:         `Review ${alerts.length} AI accuracy ${alerts.length === 1 ? 'issue' : 'issues'}`,
      why:           'Small inaccuracies compound over time and quietly cost you customers.',
      href:          '/dashboard/hallucinations',
      estimatedMins: 5,
      urgency:       'medium',
    });
  }

  // 3. Pending drafts
  if (missions.length < 2 && draftsPending > 0) {
    missions.push({
      title:         `Publish ${draftsPending} AI-written post${draftsPending > 1 ? 's' : ''}`,
      why:           'Fresh, published content is the fastest way to improve how often AI mentions you.',
      href:          '/dashboard/content-drafts',
      estimatedMins: 3,
      urgency:       'medium',
    });
  }

  // 4. Low score, nothing else to do
  if (missions.length === 0 && score !== null && score < 60) {
    missions.push({
      title:         'Run a fresh AI visibility scan',
      why:           'Your score needs attention — a new scan shows exactly what to improve first.',
      href:          '/dashboard',
      estimatedMins: 1,
      urgency:       'medium',
    });
  }

  // 5. All clear / default proactive task
  if (missions.length === 0) {
    missions.push({
      title:         'Add this season\'s specials to your menu',
      why:           'Restaurants with up-to-date menus get mentioned by AI more often in local searches.',
      href:          '/dashboard/magic-menus',
      estimatedMins: 5,
      urgency:       'low',
    });
  }

  return missions.slice(0, 2);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CoachBriefCard({
  alerts,
  draftsPending,
  score,
  firstName,
}: CoachBriefCardProps) {
  const missions    = deriveMissions(alerts, draftsPending, score);
  const isUrgent    = missions[0]?.urgency === 'high';
  const headerLine  = isUrgent
    ? `Heads up, ${firstName} — action needed`
    : `Here's your focus this week, ${firstName}`;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface-dark px-6 py-5 flex flex-col"
      data-testid="coach-brief-card"
    >
      {/* Accent scan-sweep decoration on top edge */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden rounded-t-2xl"
        aria-hidden="true"
      >
        <div
          className="h-full w-1/3 bg-gradient-to-r from-transparent via-electric-indigo to-transparent"
          style={{ animation: 'lv-scan 4s linear infinite' }}
        />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-center gap-3">
        {/* AI coach avatar */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-electric-indigo/12 ring-1 ring-electric-indigo/30"
          aria-hidden="true"
        >
          <span
            className="text-xs font-bold text-electric-indigo"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            AI
          </span>
        </div>
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            Your Coach
          </p>
          <p className="text-sm font-semibold leading-tight text-white">
            {headerLine}
          </p>
        </div>
      </div>

      {/* ── Mission list ─────────────────────────────────────────────────── */}
      <ul className="flex-1 space-y-3" aria-label="Weekly coaching missions">
        {missions.map((mission, i) => {
          const u = URGENCY[mission.urgency];
          return (
            <li key={i}>
              <Link
                href={mission.href}
                className="group flex items-start gap-3 rounded-xl border border-white/5 bg-midnight-slate/60 px-4 py-3.5 transition-all hover:border-white/15 hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-indigo"
              >
                {/* Urgency dot */}
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${u.dot}`}
                  aria-hidden="true"
                />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-white transition-colors group-hover:text-signal-green">
                    {mission.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {mission.why}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${u.badge}`}
                      style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                    >
                      {u.badgeText}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      · ~{mission.estimatedMins} min
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <span
                  className="mt-1 shrink-0 text-lg leading-none text-slate-600 transition-colors group-hover:text-white"
                  aria-hidden="true"
                >
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* ── All-clear state ───────────────────────────────────────────────── */}
      {missions.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <p className="text-2xl" aria-hidden="true">🎉</p>
          <p className="mt-2 text-sm font-semibold text-signal-green">
            You&apos;re on a roll, {firstName}!
          </p>
          <p className="mt-1 text-xs text-slate-400">
            No urgent tasks this week. Keep it up.
          </p>
        </div>
      )}
    </div>
  );
}
