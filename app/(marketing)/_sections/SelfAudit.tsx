// ---------------------------------------------------------------------------
// Section 3: "Practice What We Preach" — Interactive Self-Audit
//
// Two comparison cards with interactive toggle. Clicking a card highlights
// it and shows a contextual CTA. Sprint D: interactivity upgrade.
// ---------------------------------------------------------------------------

import { SectionLabel } from '../_components/MarketingShared';
import SelfAuditCards from '../_components/SelfAuditCards';

export default function SelfAudit() {
  return (
    <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
      <div className="m-reveal">
        <SectionLabel color="var(--m-green)">THE SELF-AUDIT</SectionLabel>

        <h2
          className="m-display"
          style={{ maxWidth: 720, marginBottom: 20 }}
        >
          We built an AI visibility platform. We score ourselves publicly.
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
          Most platforms sell you a dashboard and hope you never look behind the
          curtain. We monitor LocalVector.ai with the same engine we give our
          customers — and publish the results right here. If it works for us, it
          works for you.
        </p>
      </div>

      <SelfAuditCards />

      <p
        style={{
          maxWidth: 680,
          marginTop: 48,
          color: 'var(--m-text-primary)',
          fontSize: 17,
          fontWeight: 500,
          lineHeight: 1.7,
        }}
      >
        You wouldn&apos;t run your business with no financial audit. Why run
        your digital presence with no AI audit?
      </p>
    </section>
  );
}
