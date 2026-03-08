// ---------------------------------------------------------------------------
// Section 2: "The Invisible Revenue Leak" — Light theme Server Component
// ---------------------------------------------------------------------------

import { SectionLabel, StatCard } from '../_components/MarketingShared';

export default function RevenueLeak() {
  return (
    <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
      <div className="m-reveal">
        <SectionLabel color="var(--m-amber)">THE INVISIBLE REVENUE LEAK</SectionLabel>

        <h2
          className="m-display m-text-shimmer"
          style={{ maxWidth: 720, marginBottom: 20 }}
        >
          The damage is happening tonight. You just can&apos;t see it.
        </h2>

        <p
          style={{
            maxWidth: 640,
            color: 'var(--m-text-secondary)',
            fontSize: 17,
            lineHeight: 1.7,
            marginBottom: 48,
          }}
        >
          Every time a potential customer asks an AI assistant about your business,
          the model reconstructs an answer from its training data. Not from your
          website. Not from your Google profile. From months-old snapshots it
          stitched together on its own — and it never tells you what it said.
        </p>
      </div>

      <div className="m-grid3 m-reveal-stagger">
        <StatCard
          value="$1,600 /month"
          borderColor="var(--m-red)"
          body="Lost revenue one business tracked directly to ChatGPT reporting wrong hours. They were open. ChatGPT said closed. Three months before they found out."
        />
        <StatCard
          value="68%"
          borderColor="var(--m-amber)"
          body="Of consumers now use AI assistants to find local businesses — where to go, who to call, what to book — before they visit a website or open an app."
        />
        <StatCard
          value="0 alerts"
          borderColor="var(--m-red)"
          body="The number of notifications you receive when AI sends your customers to a competitor. It happens silently. Every single day."
        />
      </div>

      <p
        style={{
          maxWidth: 680,
          marginTop: 48,
          fontStyle: 'italic',
          color: 'var(--m-text-secondary)',
          fontSize: 15,
          lineHeight: 1.7,
        }}
      >
        Your Yelp listing might be perfect. Your Google profile might be flawless.
        AI doesn&apos;t care. It has its own version of your business — and
        you&apos;ve never seen it.
      </p>
    </section>
  );
}
