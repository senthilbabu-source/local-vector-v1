// ---------------------------------------------------------------------------
// EnginesSection — Three Engines (How It Works) + Case Study
// ---------------------------------------------------------------------------

import Reveal from '../_components/Reveal';
import { SectionLabel } from './shared';

export default function EnginesSection() {
  return (
    <>
      {/* ── 8. Three Engines — How It Works ───────────────────────────────── */}
      <section
        id="how"
        className="px-4"
        style={{
          background: '#0A1628',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        <div className="lv-section">
          <Reveal><SectionLabel>The Three Engines</SectionLabel></Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white leading-tight mb-14"
              style={{ fontSize: 'clamp(24px,3.5vw,38px)', letterSpacing: '-0.02em' }}
            >
              Detect the lies. Steal the spotlight. Force the truth.
            </h2>
          </Reveal>

          <div className="lv-grid3">
            {([
              {
                num: '01', accent: '#EF4444',
                title: 'The Fear Engine',
                subtitle: 'AI Hallucination Auditor',
                body: 'We interrogate ChatGPT, Perplexity, and Gemini with the same questions your customers ask. Then we compare every answer against your verified data. When AI says you\'re closed and you\'re not — Red Alert.',
                result: 'A priority-ranked feed of every lie AI is telling about you, with severity scores and dollar-cost estimates.',
              },
              {
                num: '02', accent: '#FFB800',
                title: 'The Greed Engine',
                subtitle: 'Competitor Intelligence',
                body: 'We ask AI: "Who\'s the best in your city?" Then we analyze exactly why your competitor won — and you didn\'t. Not vague advice. Specific action items you can execute this week.',
                result: 'Competitor gap analysis showing the exact words and signals costing you recommendations.',
              },
              {
                num: '03', accent: '#00F5A0',
                title: 'The Magic Engine',
                subtitle: 'AI-Readable Menu Generator',
                body: "AI can't read your PDF menu. So it guesses — or pulls prices from DoorDash with their 30% markup. Upload your menu. We convert it into structured data every AI on earth can understand.",
                result: 'Your menu, readable by every AI, hosted on a page you control — with one-click Google injection.',
              },
            ] as const).map((e, i) => (
              <Reveal key={i} delay={i * 150}>
                <div className="lv-card relative overflow-hidden h-full" style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Top accent line */}
                  <div
                    aria-hidden
                    className="absolute top-0 left-0 right-0"
                    style={{ height: 2, background: e.accent, opacity: 0.5 }}
                  />
                  <div
                    aria-hidden
                    className="absolute top-0 left-0"
                    style={{
                      width: 60, height: 2,
                      background: e.accent,
                      animation: 'lv-scan 4s linear infinite',
                      animationDelay: `${i * 600}ms`,
                    }}
                  />

                  <div className="flex items-center gap-3 mb-5">
                    <span
                      className="text-xs font-bold rounded-md px-2 py-0.5"
                      style={{
                        color: e.accent,
                        border: `1px solid ${e.accent}33`,
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                      }}
                    >
                      {e.num}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1">{e.title}</h3>
                  <p
                    className="text-xs font-semibold mb-4"
                    style={{ color: e.accent, fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                  >
                    {e.subtitle}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-400 mb-5 flex-1">{e.body}</p>

                  {/* "What you see" sub-card */}
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderLeft: `2px solid ${e.accent}44`,
                    }}
                  >
                    <p
                      className="text-xs font-semibold uppercase mb-1 text-slate-500"
                      style={{ letterSpacing: '0.08em' }}
                    >
                      What you see
                    </p>
                    <p className="text-xs leading-relaxed text-slate-300">{e.result}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={500}>
            <p className="text-center text-sm font-semibold mt-12" style={{ color: '#00F5A0' }}>
              Every engine runs automatically. Open the dashboard, see the problems, fix them in minutes.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 9. Case Study ─────────────────────────────────────────────────── */}
      <section className="px-4" style={{ backgroundColor: '#050A15' }}>
        <div className="lv-section">
          <Reveal><SectionLabel color="#EF4444">Real Damage. Real Recovery.</SectionLabel></Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white leading-tight mb-12"
              style={{ fontSize: 'clamp(24px,3.5vw,38px)', letterSpacing: '-0.02em' }}
            >
              The $12,000 Steakhouse That Didn&apos;t Exist
            </h2>
          </Reveal>

          <div className="lv-grid2" style={{ gap: 32 }}>
            {/* Narrative */}
            <Reveal delay={120}>
              <div>
                <p className="text-sm leading-relaxed text-slate-400 mb-5">
                  A well-reviewed steakhouse in Dallas ran a thriving Friday night business for 11 years.
                  In September 2025, their revenue started dropping. They blamed the economy. Changed the menu twice.
                </p>
                <p className="text-sm leading-relaxed text-slate-300 mb-5">
                  <strong className="text-white">The actual problem:</strong> ChatGPT had been telling customers
                  the restaurant was &ldquo;permanently closed&rdquo; since August. For three months, every person who asked
                  &ldquo;best steakhouse near downtown Dallas&rdquo; was sent somewhere else.
                </p>
                <p className="text-sm leading-relaxed text-slate-400 mb-7">
                  Nobody told them. No tool flagged it. No alert fired. By the time they found out &mdash; by accident &mdash;
                  they&apos;d lost an estimated <strong style={{ color: '#EF4444' }}>$12,000</strong>.
                </p>
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'rgba(0,245,160,0.12)', borderLeft: '3px solid #00F5A0' }}
                >
                  <p className="text-sm font-semibold" style={{ color: '#00F5A0' }}>
                    The fix took 24 hours.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Before / After cards */}
            <Reveal delay={280}>
              <div className="flex flex-col gap-4">
                {/* Before */}
                <div className="lv-card" style={{ borderLeft: '3px solid #EF4444' }}>
                  <p
                    className="text-xs font-bold uppercase mb-3.5"
                    style={{ color: '#EF4444', letterSpacing: '0.1em' }}
                  >
                    Before LocalVector
                  </p>
                  {([
                    ['AI Status', '"Permanently Closed" \u274C'],
                    ['Monthly AI Recommendations', '0'],
                    ['Revenue Impact', '\u2212$4,000/mo'],
                    ['Time to Discovery', '3 months (by accident)'],
                  ] as const).map(([k, v], i) => (
                    <div
                      key={i}
                      className="flex justify-between py-1.5"
                      style={{ borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    >
                      <span className="text-xs text-slate-500">{k}</span>
                      <span
                        className="text-xs font-semibold text-slate-300"
                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                      >
                        {v}
                      </span>
                    </div>
                  ))}
                </div>

                {/* After */}
                <div className="lv-card" style={{ borderLeft: '3px solid #00F5A0' }}>
                  <p
                    className="text-xs font-bold uppercase mb-3.5"
                    style={{ color: '#00F5A0', letterSpacing: '0.1em' }}
                  >
                    After LocalVector
                  </p>
                  {([
                    ['AI Status', '"Open, Serving Dinner" \u2705'],
                    ['Monthly AI Recommendations', '47'],
                    ['Revenue Recovered', '+$4,000/mo'],
                    ['Time to Detection', '24 hours (automated)'],
                  ] as const).map(([k, v], i) => (
                    <div
                      key={i}
                      className="flex justify-between py-1.5"
                      style={{ borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    >
                      <span className="text-xs text-slate-500">{k}</span>
                      <span
                        className="text-xs font-semibold text-slate-300"
                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                      >
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
