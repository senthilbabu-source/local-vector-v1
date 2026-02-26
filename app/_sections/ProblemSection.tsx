// ---------------------------------------------------------------------------
// ProblemSection — The Invisible Revenue Leak + AVS Proprietary Metrics
// ---------------------------------------------------------------------------

import Reveal from '../_components/Reveal';
import Counter from '../_components/Counter';
import { Eye, Star, TrendingUp } from 'lucide-react';
import { SectionLabel, MetricCard } from './shared';

export default function ProblemSection() {
  return (
    <>
      {/* ── 4. The Invisible Revenue Leak ─────────────────────────────────── */}
      <section
        className="px-4"
        style={{
          background: '#0A1628',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        <div className="lv-section">
          <Reveal>
            <SectionLabel color="#FFB800">The Invisible Revenue Leak</SectionLabel>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white leading-tight mb-12"
              style={{ fontSize: 'clamp(24px,3.5vw,40px)', letterSpacing: '-0.02em', maxWidth: 700 }}
            >
              AI doesn&apos;t guess. It states. And when it&apos;s wrong,
              customers don&apos;t verify &mdash; they leave.
            </h2>
          </Reveal>

          <div className="lv-grid3">
            {([
              { val: 1600, prefix: '$', suffix: '/month', desc: "Revenue one restaurant lost because ChatGPT said they were closed on Mondays. They weren't.", border: '#EF4444' },
              { val: 68, prefix: '', suffix: '%', desc: 'Of consumers now use AI assistants to decide where to eat — before they ever see your website.', border: '#FFB800' },
              { val: 0, prefix: '', suffix: ' alerts', desc: 'How many notifications you get when AI sends customers to your competitor. It happens silently. Every day.', border: '#EF4444' },
            ] as const).map((c, i) => (
              <Reveal key={i} delay={i * 120}>
                <div
                  className="lv-card"
                  style={{ borderLeft: `3px solid ${c.border}`, position: 'relative', overflow: 'hidden' }}
                >
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                      background: `linear-gradient(90deg, transparent, ${c.border}44, transparent)`,
                      animation: 'lv-scan 3s linear infinite',
                      animationDelay: `${i * 1000}ms`,
                      opacity: 0.5,
                    }}
                  />
                  <div
                    className="font-extrabold text-white mb-2"
                    style={{
                      fontSize: 'clamp(32px,4vw,48px)',
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                    }}
                  >
                    {c.val === 0
                      ? <>0<span className="text-2xl font-normal">{c.suffix}</span></>
                      : <Counter end={c.val} prefix={c.prefix} suffix={c.suffix} />
                    }
                  </div>
                  <p className="text-sm leading-relaxed text-slate-400">{c.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={400}>
            <p className="text-center text-sm text-slate-500 mt-10 max-w-xl mx-auto">
              Traditional SEO tools check if your address is right on Yelp.
              They never check if ChatGPT is telling customers you don&apos;t exist.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 5. AVS — Proprietary Metrics ──────────────────────────────────── */}
      <section
        className="px-4"
        style={{ backgroundColor: '#050A15' }}
      >
        <div className="lv-section">
          <Reveal><SectionLabel>Proprietary Intelligence</SectionLabel></Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white leading-tight mb-3"
              style={{ fontSize: 'clamp(24px,3.5vw,38px)', letterSpacing: '-0.02em' }}
            >
              The AI Visibility Score (AVS) Dashboard
            </h2>
            <p className="text-slate-400 max-w-xl mb-12">
              Three signals that tell you exactly how AI engines perceive your business —
              and precisely what to fix.
            </p>
          </Reveal>

          <div className="lv-grid3">
            <Reveal delay={0}>
              <MetricCard
                icon={<Eye className="h-5 w-5" />}
                iconColor="text-signal-green"
                title="AI Visibility Score"
                subtitle="AVS"
                score={98}
                outOf={100}
                barColor="#00F5A0"
                description="How often your business is accurately cited when users ask AI about businesses like yours."
              />
            </Reveal>
            <Reveal delay={150}>
              <MetricCard
                icon={<TrendingUp className="h-5 w-5" />}
                iconColor="text-electric-indigo"
                title="Sentiment Index"
                subtitle="SI"
                score={87}
                outOf={100}
                barColor="#6366f1"
                description="Whether AI mentions of your business are positive, neutral, or damaging your reputation."
              />
            </Reveal>
            <Reveal delay={300}>
              <MetricCard
                icon={<Star className="h-5 w-5" />}
                iconColor="text-alert-amber"
                title="Citation Accuracy"
                subtitle="CA"
                score={94}
                outOf={100}
                barColor="#FFB800"
                description="How precisely AI engines reproduce your hours, address, menu, and pricing."
              />
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
