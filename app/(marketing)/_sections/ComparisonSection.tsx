// ---------------------------------------------------------------------------
// Section 5: "The Honest Comparison" — Light theme Server Component
// ---------------------------------------------------------------------------

import { SectionLabel, Check, Cross, Dash } from '../_components/MarketingShared';

type CellValue = 'check' | 'cross' | 'dash' | string;

interface ComparisonRow {
  feature: string;
  lv: CellValue;
  bl: CellValue;
  semrush: CellValue;
  moz: CellValue;
  birdeye: CellValue;
}

const ROWS: ComparisonRow[] = [
  {
    feature: 'Detects AI hallucinations about your business',
    lv: 'check',
    bl: 'cross',
    semrush: 'cross',
    moz: 'cross',
    birdeye: 'cross',
  },
  {
    feature: 'Shows what ChatGPT/Gemini actually say (verbatim)',
    lv: 'check',
    bl: 'cross',
    semrush: 'cross',
    moz: 'cross',
    birdeye: 'cross',
  },
  {
    feature: 'Tells you WHY competitors win AI recommendations',
    lv: 'check',
    bl: 'cross',
    semrush: 'cross',
    moz: 'cross',
    birdeye: 'cross',
  },
  {
    feature: 'Converts PDF menu / service list to AI-readable structured data',
    lv: 'check',
    bl: 'cross',
    semrush: 'cross',
    moz: 'cross',
    birdeye: 'cross',
  },
  {
    feature: 'Tracks your Share of Voice in AI results',
    lv: 'check',
    bl: 'cross',
    semrush: 'Limited',
    moz: 'cross',
    birdeye: 'cross',
  },
  {
    feature: 'Quantifies dollar cost of each AI error',
    lv: 'check',
    bl: 'cross',
    semrush: 'cross',
    moz: 'cross',
    birdeye: 'cross',
  },
  {
    feature: 'Generates llms.txt and AI config for your site',
    lv: 'check',
    bl: 'cross',
    semrush: 'cross',
    moz: 'cross',
    birdeye: 'cross',
  },
  {
    feature: 'Shows which AI bots are crawling your site',
    lv: 'check',
    bl: 'cross',
    semrush: 'cross',
    moz: 'cross',
    birdeye: 'cross',
  },
  {
    feature: 'Alerts when a fixed hallucination reappears (drift)',
    lv: 'check',
    bl: 'cross',
    semrush: 'cross',
    moz: 'cross',
    birdeye: 'cross',
  },
  {
    feature: 'Blocks third-party markup from misleading AI crawlers',
    lv: 'check',
    bl: 'cross',
    semrush: 'cross',
    moz: 'cross',
    birdeye: 'cross',
  },
  {
    feature: 'Scores your readiness for AI booking agents',
    lv: 'check',
    bl: 'cross',
    semrush: 'cross',
    moz: 'cross',
    birdeye: 'cross',
  },
  {
    feature: 'Alerts you to AI queries no competitor owns yet',
    lv: 'check',
    bl: 'cross',
    semrush: 'cross',
    moz: 'cross',
    birdeye: 'cross',
  },
  {
    feature: 'Pushes listings to 100+ directories',
    lv: 'Not our focus',
    bl: 'check',
    semrush: 'check',
    moz: 'check',
    birdeye: 'check',
  },
  {
    feature: 'Review monitoring and reputation management',
    lv: 'Basic',
    bl: 'check',
    semrush: 'cross',
    moz: 'cross',
    birdeye: 'check',
  },
  {
    feature: 'Traditional SEO rank tracking',
    lv: 'Not our focus',
    bl: 'check',
    semrush: 'check',
    moz: 'check',
    birdeye: 'cross',
  },
];

function CellContent({ value }: { value: CellValue }) {
  if (value === 'check') return <Check />;
  if (value === 'cross') return <Cross />;
  if (value === 'dash') return <Dash />;
  return (
    <span
      className="m-mono"
      style={{ fontSize: 12, color: 'var(--m-text-muted)', fontWeight: 500 }}
    >
      {value}
    </span>
  );
}

export default function ComparisonSection() {
  return (
    <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
      <div className="m-reveal">
        <SectionLabel color="var(--m-amber)">THE HONEST COMPARISON</SectionLabel>

        <h2
          className="m-display m-text-shimmer"
          style={{ maxWidth: 760, marginBottom: 20 }}
        >
          The tools you&apos;re using weren&apos;t built for AI search.
          That&apos;s not an opinion. It&apos;s their architecture.
        </h2>

        <p
          style={{
            maxWidth: 680,
            color: 'var(--m-text-secondary)',
            fontSize: 17,
            lineHeight: 1.7,
            marginBottom: 48,
          }}
        >
          BrightLocal, Yext, Semrush, Moz Local, and Birdeye are excellent at
          what they were designed for — managing directory listings, tracking
          traditional search rankings, and monitoring reviews. But AI search is a
          fundamentally different system. It doesn&apos;t crawl directories. It
          reconstructs answers from training data, live retrieval, and structured
          schemas. None of these tools monitor that layer.
        </p>
      </div>

      {/* Responsive table wrapper */}
      <div
        className="m-reveal"
        style={{
          overflowX: 'auto',
          borderRadius: 12,
          border: '1px solid var(--m-border-base)',
          marginBottom: 48,
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: 640,
          }}
        >
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              <th
                style={{
                  textAlign: 'left',
                  padding: '14px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--m-text-primary)',
                  borderBottom: '1px solid var(--m-border-base)',
                }}
              >
                Feature
              </th>
              <th
                style={{
                  textAlign: 'center',
                  padding: '14px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--m-green)',
                  borderBottom: '1px solid var(--m-border-base)',
                  whiteSpace: 'nowrap',
                }}
              >
                LocalVector.ai
              </th>
              <th
                style={{
                  textAlign: 'center',
                  padding: '14px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--m-text-muted)',
                  borderBottom: '1px solid var(--m-border-base)',
                  whiteSpace: 'nowrap',
                }}
              >
                BrightLocal / Yext
              </th>
              <th
                style={{
                  textAlign: 'center',
                  padding: '14px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--m-text-muted)',
                  borderBottom: '1px solid var(--m-border-base)',
                }}
              >
                Semrush
              </th>
              <th
                style={{
                  textAlign: 'center',
                  padding: '14px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--m-text-muted)',
                  borderBottom: '1px solid var(--m-border-base)',
                  whiteSpace: 'nowrap',
                }}
              >
                Moz Local
              </th>
              <th
                style={{
                  textAlign: 'center',
                  padding: '14px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--m-text-muted)',
                  borderBottom: '1px solid var(--m-border-base)',
                }}
              >
                Birdeye
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr
                key={i}
                style={{
                  background: i % 2 === 0 ? '#FFFFFF' : '#F6F8FB',
                }}
              >
                <td
                  style={{
                    padding: '13px 20px',
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: 'var(--m-text-primary)',
                    borderBottom: '1px solid var(--m-border-base)',
                  }}
                >
                  {row.feature}
                </td>
                <td
                  style={{
                    textAlign: 'center',
                    padding: '13px 16px',
                    borderBottom: '1px solid var(--m-border-base)',
                  }}
                >
                  <CellContent value={row.lv} />
                </td>
                <td
                  style={{
                    textAlign: 'center',
                    padding: '13px 16px',
                    borderBottom: '1px solid var(--m-border-base)',
                  }}
                >
                  <CellContent value={row.bl} />
                </td>
                <td
                  style={{
                    textAlign: 'center',
                    padding: '13px 16px',
                    borderBottom: '1px solid var(--m-border-base)',
                  }}
                >
                  <CellContent value={row.semrush} />
                </td>
                <td
                  style={{
                    textAlign: 'center',
                    padding: '13px 16px',
                    borderBottom: '1px solid var(--m-border-base)',
                  }}
                >
                  <CellContent value={row.moz} />
                </td>
                <td
                  style={{
                    textAlign: 'center',
                    padding: '13px 16px',
                    borderBottom: '1px solid var(--m-border-base)',
                  }}
                >
                  <CellContent value={row.birdeye} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Closing statement */}
      <p
        style={{
          maxWidth: 680,
          color: 'var(--m-text-secondary)',
          fontSize: 17,
          lineHeight: 1.7,
          marginBottom: 32,
        }}
      >
        They optimize for directories. We optimize for the AI models your
        customers are actually using.
      </p>

      {/* CTA */}
      <a href="/scan" className="m-btn-primary">
        Start Free AI Audit &rarr;
      </a>
    </section>
  );
}
