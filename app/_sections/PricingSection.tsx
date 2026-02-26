// ---------------------------------------------------------------------------
// PricingSection — Pricing + FAQ + Final CTA + Footer
// ---------------------------------------------------------------------------

import ViralScanner from '../_components/ViralScanner';
import Reveal from '../_components/Reveal';
import FaqAccordion from '../_components/FaqAccordion';
import { SectionLabel, PricingCard } from './shared';

export default function PricingSection() {
  return (
    <>
      {/* ── 10. Pricing ───────────────────────────────────────────────────── */}
      <section
        id="pricing"
        className="px-4"
        style={{
          background: '#0A1628',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        <div className="lv-section">
          <Reveal><SectionLabel>Pricing</SectionLabel></Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white leading-tight mb-2"
              style={{ fontSize: 'clamp(24px,3.5vw,38px)', letterSpacing: '-0.02em' }}
            >
              Cheaper than one lost table.
            </h2>
            <p className="text-base text-slate-400 mb-14" style={{ maxWidth: 540 }}>
              One wrong AI answer costs you a customer. One lost Friday reservation: $120.
              Our monthly price: less than that.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {([
              {
                name: 'THE AUDIT', price: 'Free', period: '', sub: 'See the damage.', popular: false,
                features: ['One-time AI hallucination scan', 'Real AI mentions + sentiment', 'ChatGPT, Perplexity, Gemini', 'No signup required'],
                cta: 'Run Free Audit \u2192', ctaStyle: 'outline' as const, ctaHref: '/',
              },
              {
                name: 'STARTER', price: '$29', period: '/mo', sub: 'Stop the bleeding.', popular: false,
                features: ['Weekly automated AI audits', 'Hallucination email alerts', 'Reality Score dashboard', 'Magic Menu (1 menu)', 'Big 6 listing tracker', '1 location'],
                cta: 'Start for $29/mo \u2192', ctaStyle: 'outline' as const, ctaHref: '/signup',
              },
              {
                name: 'AI SHIELD', price: '$59', period: '/mo', sub: 'Go on offense.', popular: true,
                features: ['Daily AI audits', 'Competitor Intercept analysis', 'AI Sentiment tracking', 'Content recommendations', 'Share of Voice tracking', 'Priority alerts', '1 location'],
                cta: 'Get AI Shield \u2192', ctaStyle: 'green' as const, ctaHref: '/signup',
              },
              {
                name: 'BRAND FORTRESS', price: 'Custom', period: '', sub: 'Agencies & multi-location.', popular: false,
                features: ['Up to 25 locations', 'White-label reports', 'Agency dashboard', 'Dedicated onboarding', 'Custom query monitoring', 'API access'],
                cta: 'Talk to Us \u2192', ctaStyle: 'outline' as const, ctaHref: 'mailto:hello@localvector.ai',
              },
            ] as const).map((tier, i) => (
              <Reveal key={i} delay={i * 100}>
                <PricingCard
                  name={tier.name}
                  price={tier.price}
                  period={tier.period}
                  description={tier.sub}
                  features={[...tier.features]}
                  cta={tier.cta}
                  ctaHref={tier.ctaHref}
                  ctaStyle={tier.ctaStyle}
                  highlighted={tier.popular}
                  badge={tier.popular ? 'Most Popular' : undefined}
                />
              </Reveal>
            ))}
          </div>

          <Reveal delay={500}>
            <p className="text-center text-sm text-slate-500 mt-8">
              14-day free trial on all plans. Cancel anytime. No contracts. No setup fees.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 11. FAQ ───────────────────────────────────────────────────────── */}
      <section
        className="px-4"
        style={{
          background: '#050A15',
          borderTop: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        <div className="lv-section">
          <Reveal><SectionLabel>Questions</SectionLabel></Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white mb-12"
              style={{ fontSize: 'clamp(24px,3.5vw,36px)', letterSpacing: '-0.02em' }}
            >
              Straight answers.
            </h2>
          </Reveal>

          <FaqAccordion
            q="What exactly does LocalVector do?"
            a={'LocalVector monitors what AI models (ChatGPT, Gemini, Perplexity) say about your business. When they get something wrong \u2014 wrong hours, wrong prices, "permanently closed" when you\'re open \u2014 we detect it, alert you, and give you the tools to fix it.'}
            delay={0}
          />
          <FaqAccordion
            q="How is this different from Yelp or Google Business Profile?"
            a="Yelp and GBP manage your listings on their specific platforms. LocalVector monitors what AI engines synthesize from ALL sources. AI combines data from Yelp, TripAdvisor, Reddit, food blogs, and more. If any source is wrong, AI will be wrong. We catch errors across the entire AI ecosystem."
            delay={80}
          />
          <FaqAccordion
            q="I'm not a tech person. Can I actually use this?"
            a="Yes. Sign up, enter your business details, and monitoring starts automatically. When something is wrong, you get a plain-English alert. Fixing it is one click. The whole product was built by a restaurant owner who also runs a lounge in Alpharetta, GA."
            delay={160}
          />
          <FaqAccordion
            q="What if AI isn't saying anything wrong about me?"
            a={'Then your dashboard shows "All Clear" and your Reality Score. But AI models update constantly \u2014 a clean audit today doesn\'t guarantee next month. We keep watching so you don\'t have to.'}
            delay={240}
          />
          <FaqAccordion
            q="Do I need to cancel my BrightLocal or Yext?"
            a="No. Those tools manage directory listings, which is still useful. LocalVector monitors and optimizes for AI answers \u2014 a layer those tools don't touch. Many customers use both."
            delay={320}
          />
        </div>
      </section>

      {/* ── 12. Final CTA ─────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden px-4"
        style={{
          background: 'linear-gradient(180deg, #050A15 0%, #0A1628 100%)',
        }}
      >
        {/* Radial floating glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: 600,
            height: 600,
            background: 'radial-gradient(circle, rgba(0,245,160,0.06) 0%, transparent 70%)',
            animation: 'lv-float 6s ease-in-out infinite',
          }}
        />

        <div className="lv-section relative text-center">
          <Reveal>
            <h2
              className="font-extrabold text-white leading-tight mb-4"
              style={{ fontSize: 'clamp(26px,4vw,44px)', letterSpacing: '-0.03em' }}
            >
              Right now, AI is describing your business to someone.
              <br />
              <span style={{ color: '#00F5A0' }}>Is it telling the truth?</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-slate-400 text-base mb-9">
              Find out in 8 seconds. No signup required.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="max-w-md mx-auto">
              <ViralScanner />
              <p
                className="mt-3 text-xs text-slate-600"
                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
              >
                Free &middot; Instant &middot; Real results from real AI models
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 13. Footer ────────────────────────────────────────────────────── */}
      <footer
        className="border-t border-white/5 py-10 px-6"
        style={{ backgroundColor: '#050A15' }}
      >
        <div className="mx-auto max-w-[1120px] flex flex-wrap items-center justify-between gap-5">
          <div>
            <span className="text-sm font-bold text-white">
              LocalVector<span style={{ color: '#00F5A0' }}>.ai</span>
            </span>
            <p className="text-xs text-slate-600 mt-1">
              Defending the truth for local business. Built for the Generative Age.
            </p>
          </div>
          <div className="flex gap-5 text-xs text-slate-600">
            <a href="/privacy" className="hover:text-slate-300 transition">Privacy</a>
            <a href="/terms" className="hover:text-slate-300 transition">Terms</a>
            <a href="/login" className="hover:text-slate-300 transition">Log In</a>
          </div>
        </div>
        <div className="mx-auto max-w-[1120px] mt-5 text-center">
          <p className="text-xs" style={{ color: '#334155' }}>&copy; 2026 LocalVector.ai</p>
        </div>
      </footer>
    </>
  );
}
