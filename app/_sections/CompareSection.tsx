// ---------------------------------------------------------------------------
// CompareSection — Practice What We Preach + Comparison Table
// ---------------------------------------------------------------------------

import Reveal from '../_components/Reveal';
import Counter from '../_components/Counter';
import Bar from '../_components/Bar';
import { SectionLabel } from './shared';

export default function CompareSection() {
  return (
    <>
      {/* ── 6. Practice What We Preach ────────────────────────────────────── */}
      <section
        className="px-4"
        style={{
          background: '#0A1628',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        <div className="lv-section">
          <Reveal><SectionLabel>Practice What We Preach</SectionLabel></Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white leading-tight mb-12"
              style={{ fontSize: 'clamp(24px,3.5vw,38px)', letterSpacing: '-0.02em' }}
            >
              We built an AI Visibility platform. So we score ourselves.
            </h2>
          </Reveal>

          <div className="lv-grid2">
            {/* Our score */}
            <Reveal delay={100}>
              <div
                className="lv-card relative overflow-hidden"
                style={{ border: '1px solid rgba(0,245,160,0.2)' }}
              >
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ opacity: 0.04, background: 'radial-gradient(circle at 30% 30%, #00F5A0, transparent 60%)' }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm font-bold text-white">LocalVector.ai</span>
                    <span
                      className="text-xs font-semibold rounded-md px-2.5 py-1"
                      style={{ color: '#00F5A0', background: 'rgba(0,245,160,0.12)' }}
                    >
                      Fully Protected
                    </span>
                  </div>
                  {([
                    { label: 'AI Visibility Score', val: 97, color: '#00F5A0', isZero: false },
                    { label: 'Citation Accuracy', val: 100, color: '#00F5A0', isZero: false },
                    { label: 'Hallucinations Detected', val: 0, color: '#00F5A0', isZero: true },
                  ] as const).map((r, i) => (
                    <div key={i} className="mb-4">
                      <div className="flex justify-between mb-1.5 text-sm text-slate-400">
                        <span>{r.label}</span>
                        <span
                          className="font-bold text-white"
                          style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                        >
                          {r.isZero ? '0' : <Counter end={r.val} />}
                          {!r.isZero && '/100'}
                        </span>
                      </div>
                      <Bar pct={r.isZero ? 100 : r.val} color={r.color} delay={i * 200} />
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Average business */}
            <Reveal delay={250}>
              <div
                className="lv-card relative overflow-hidden"
                style={{ border: '1px solid rgba(239,68,68,0.12)' }}
              >
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ opacity: 0.03, background: 'radial-gradient(circle at 70% 70%, #EF4444, transparent 60%)' }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm font-bold text-white">Average Local Business</span>
                    <span
                      className="text-xs font-semibold rounded-md px-2.5 py-1"
                      style={{ color: '#FFB800', background: 'rgba(255,184,0,0.12)' }}
                    >
                      Flying Blind
                    </span>
                  </div>
                  {([
                    { label: 'AI Visibility Score', display: 'Unknown' },
                    { label: 'Citation Accuracy', display: 'Unknown' },
                    { label: 'Hallucinations Detected', display: 'Unknown' },
                  ] as const).map((r, i) => (
                    <div key={i} className="mb-4">
                      <div className="flex justify-between mb-1.5 text-sm text-slate-400">
                        <span>{r.label}</span>
                        <span
                          className="font-bold"
                          style={{
                            color: '#475569',
                            fontFamily: 'var(--font-jetbrains-mono), monospace',
                          }}
                        >
                          {r.display}
                        </span>
                      </div>
                      <Bar pct={12} color="#334155" delay={i * 200} />
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={400}>
            <p className="text-center text-slate-400 text-base font-medium mt-10">
              You wouldn&apos;t run a restaurant without a fire alarm.
              <br />
              Why run one without an AI alarm?
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 7. Comparison Table ────────────────────────────────────────────── */}
      <section className="px-4" style={{ backgroundColor: '#050A15' }}>
        <div className="lv-section">
          <Reveal><SectionLabel color="#FFB800">The Difference</SectionLabel></Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white leading-tight mb-12"
              style={{ fontSize: 'clamp(24px,3.5vw,36px)', letterSpacing: '-0.02em' }}
            >
              Static listings were built for Google.
              <br />
              <span style={{ color: '#00F5A0' }}>AI runs on a completely different trust model.</span>
            </h2>
          </Reveal>

          <Reveal delay={160}>
            <div
              className="rounded-2xl overflow-x-auto"
              style={{ border: '1px solid rgba(255,255,255,0.05)' }}
            >
            <div style={{ minWidth: 540 }}>
              {/* Header row */}
              <div
                className="grid gap-0 px-6 py-3.5"
                style={{
                  gridTemplateColumns: '1fr 160px 160px',
                  background: '#111D33',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span className="text-xs font-bold uppercase text-slate-500" style={{ letterSpacing: '0.08em' }}>Capability</span>
                <span className="text-xs font-bold text-center" style={{ color: '#00F5A0' }}>LocalVector</span>
                <span className="text-xs font-bold text-center text-slate-500">Listing Tools</span>
              </div>

              {([
                ['Detects AI hallucinations about your business', true, false],
                ['Shows what ChatGPT actually says about you', true, false],
                ['Tells you WHY competitors win AI recommendations', true, false],
                ['Converts PDF menu into AI-readable data', true, false],
                ['Monitors AI sentiment (Premium vs. Budget)', true, false],
                ['Pushes to 48 directories nobody visits', false, true],
              ] as const).map(([cap, us, them], i) => (
                <div
                  key={i}
                  className="grid gap-0 px-6 py-3.5"
                  style={{
                    gridTemplateColumns: '1fr 160px 160px',
                    background: i % 2 === 0 ? '#0A1628' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                  }}
                >
                  <span className="text-sm text-slate-300">{cap}</span>
                  <span className="text-center text-base">
                    {us
                      ? <span style={{ color: '#00F5A0' }}>&check;</span>
                      : <span style={{ color: '#334155' }}>&mdash;</span>
                    }
                  </span>
                  <span className="text-center text-base">
                    {them
                      ? <span className="text-slate-500">&check;</span>
                      : <span style={{ color: '#EF4444', opacity: 0.6 }}>&times;</span>
                    }
                  </span>
                </div>
              ))}
            </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
