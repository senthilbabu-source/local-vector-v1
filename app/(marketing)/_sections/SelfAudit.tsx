// ---------------------------------------------------------------------------
// Section 3: "Practice What We Preach" — Light theme Server Component
// ---------------------------------------------------------------------------

import { SectionLabel, ScoreRow, Badge } from '../_components/MarketingShared';

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

      <div className="m-grid2 m-reveal-stagger">
        {/* ---- Protected card ---- */}
        <div
          className="m-card m-reveal-left"
          style={{
            borderRadius: 12,
            border: '1px solid var(--m-border-green)',
            boxShadow: '0 0 24px rgba(22,163,74,0.08)',
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <Badge variant="green">PROTECTED</Badge>
          </div>

          <ScoreRow label="AI Visibility Score" value="97 / 100" color="var(--m-green)" />
          <ScoreRow label="Citation Accuracy" value="100%" color="var(--m-green)" />
          <ScoreRow label="Hallucinations" value="0 active" color="var(--m-green)" />
          <ScoreRow label="Models Monitored" value="5" color="var(--m-green)" />
          <ScoreRow label="Last Audit" value="Today" color="var(--m-green)" />
        </div>

        {/* ---- Unmonitored card ---- */}
        <div
          className="m-card m-reveal-right"
          style={{
            borderRadius: 12,
            border: '1px solid var(--m-amber)',
            boxShadow: '0 0 24px rgba(217,119,6,0.08)',
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <Badge variant="amber">UNMONITORED</Badge>
          </div>

          <ScoreRow label="AI Visibility Score" value="-- / 100" color="var(--m-text-muted)" />
          <ScoreRow label="Citation Accuracy" value="Unknown" color="var(--m-text-muted)" />
          <ScoreRow label="Hallucinations" value="Unknown" color="var(--m-text-muted)" />
          <ScoreRow label="Models Monitored" value="0" color="var(--m-text-muted)" />
          <ScoreRow label="Last Audit" value="Never" color="var(--m-text-muted)" />
        </div>
      </div>

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
