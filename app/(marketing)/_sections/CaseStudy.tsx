// ---------------------------------------------------------------------------
// Section 6: "Case Study" — Light theme Server Component
// ---------------------------------------------------------------------------

import { SectionLabel } from '../_components/MarketingShared';

export default function CaseStudy() {
  return (
    <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
      <div className="m-reveal">
        <SectionLabel color="#DC2626">REAL DAMAGE. REAL RECOVERY.</SectionLabel>

        <h2
          className="m-display"
          style={{ maxWidth: 780, marginBottom: 48 }}
        >
          The $12,000 Business That Disappeared From AI
        </h2>
      </div>

      <div className="m-grid2">
        {/* ---- Left: Story prose ---- */}
        <div className="m-reveal-left">
          <p
            style={{
              color: 'var(--m-text-secondary)',
              fontSize: 16,
              lineHeight: 1.75,
              marginBottom: 20,
            }}
          >
            A family dental practice in Austin with a 15-year reputation and steady
            new-patient flow noticed something strange: appointment requests started
            dropping. Not gradually &mdash; a cliff. They assumed it was seasonal. They
            ran Google Ads. They redesigned their website. Nothing moved the needle.
          </p>

          <p
            style={{
              color: 'var(--m-text-secondary)',
              fontSize: 16,
              lineHeight: 1.75,
              marginBottom: 20,
            }}
          >
            Three months later, a staff member asked ChatGPT to find a dentist nearby.
            ChatGPT said the practice was &ldquo;not accepting new patients.&rdquo;
            It was. It had never stopped. But for 90 days, every AI assistant on the
            planet was turning potential patients away. Nobody flagged it. There was no
            alert. They found it by accident.
          </p>

          <p
            style={{
              color: 'var(--m-text-secondary)',
              fontSize: 16,
              lineHeight: 1.75,
              marginBottom: 24,
            }}
          >
            The total estimated revenue loss: $12,000. Three months of invisible damage
            from a single hallucination that no one was monitoring. They spent $2,400
            redesigning their marketing to solve a problem that had nothing to do with their service.
          </p>

          <div
            style={{
              background: 'var(--m-green-light)',
              border: '1px solid var(--m-border-green)',
              borderRadius: 10,
              padding: '16px 20px',
            }}
          >
            <p
              style={{
                color: 'var(--m-green-dark)',
                fontSize: 16,
                fontWeight: 600,
                margin: 0,
              }}
            >
              The fix took 24 hours.
            </p>
          </div>
        </div>

        {/* ---- Right: Before / After stat cards ---- */}
        <div className="m-reveal-right" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* BEFORE card */}
          <div
            className="m-card m-reveal"
            style={{
              borderLeft: '4px solid #DC2626',
              borderRadius: 12,
            }}
          >
            <p
              className="m-mono"
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: 'var(--m-red)',
                marginBottom: 20,
              }}
            >
              BEFORE
            </p>

            <BeforeAfterRow
              label="AI Status"
              value="Permanently Closed"
              icon={<XIcon />}
              valueColor="var(--m-red)"
            />
            <BeforeAfterRow
              label="Monthly AI mentions"
              value="0"
              valueColor="var(--m-red)"
            />
            <BeforeAfterRow
              label="Revenue impact"
              value="-$4,000/mo"
              valueColor="var(--m-red)"
            />
            <BeforeAfterRow
              label="Time to discovery"
              value="3 months (by accident)"
              valueColor="var(--m-text-muted)"
              noBorder
            />
          </div>

          {/* AFTER card */}
          <div
            className="m-card m-reveal"
            style={{
              borderLeft: '4px solid var(--m-green)',
              borderRadius: 12,
            }}
          >
            <p
              className="m-mono"
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: 'var(--m-green)',
                marginBottom: 20,
              }}
            >
              AFTER
            </p>

            <BeforeAfterRow
              label="AI Status"
              value="Open, Verified"
              icon={<CheckIcon />}
              valueColor="var(--m-green)"
            />
            <BeforeAfterRow
              label="Monthly AI mentions"
              value="47"
              valueColor="var(--m-green)"
            />
            <BeforeAfterRow
              label="Revenue recovered"
              value="$4,000/mo"
              valueColor="var(--m-green)"
            />
            <BeforeAfterRow
              label="Detection time"
              value="< 24 hours"
              valueColor="var(--m-green)"
              noBorder
            />
          </div>
        </div>
      </div>

      {/* ---- Full-width pull quote ---- */}
      <blockquote
        style={{
          marginTop: 56,
          marginBottom: 0,
          paddingLeft: 24,
          borderLeft: '4px solid var(--m-green)',
          maxWidth: 800,
        }}
      >
        <p
          style={{
            fontSize: 'clamp(18px, 2.5vw, 22px)',
            fontStyle: 'italic',
            lineHeight: 1.65,
            color: 'var(--m-text-primary)',
            margin: 0,
          }}
        >
          &ldquo;We spent $2,400 on marketing trying to fix a problem that had
          nothing to do with our business. The problem was that AI thought we were
          closed.&rdquo;
        </p>
      </blockquote>
    </section>
  );
}

/* ---- Helper sub-components ---- */

function BeforeAfterRow({
  label,
  value,
  icon,
  valueColor,
  noBorder = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueColor: string;
  noBorder?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: noBorder ? 'none' : '1px solid var(--m-border-base)',
      }}
    >
      <span style={{ fontSize: 14, color: 'var(--m-text-secondary)' }}>{label}</span>
      <span
        className="m-mono"
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: valueColor,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {icon}
        {value}
      </span>
    </div>
  );
}

function XIcon() {
  return (
    <span style={{ color: 'var(--m-red)', fontSize: 16, fontWeight: 700, lineHeight: 1 }}>
      {'\u2717'}
    </span>
  );
}

function CheckIcon() {
  return (
    <span style={{ color: 'var(--m-green)', fontSize: 16, fontWeight: 700, lineHeight: 1 }}>
      {'\u2713'}
    </span>
  );
}
