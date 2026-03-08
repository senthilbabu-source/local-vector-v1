'use client';

// ---------------------------------------------------------------------------
// SelfAuditCards — interactive comparison toggle (Sprint D Marketing)
//
// Two cards: Protected vs Unmonitored. Clicking highlights the card and
// shows a contextual CTA. Default: no selection (both visible side by side).
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { ScoreRow, Badge } from './MarketingShared';

type Selection = null | 'protected' | 'unmonitored';

export default function SelfAuditCards() {
  const [selected, setSelected] = useState<Selection>(null);

  return (
    <>
      {/* ── Toggle prompt ── */}
      <p
        className="m-mono"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--m-text-muted)',
          letterSpacing: '0.04em',
          marginBottom: 16,
          textAlign: 'center',
        }}
      >
        TAP A CARD — WHICH ONE IS YOUR BUSINESS?
      </p>

      <div className="m-grid2 m-reveal-stagger">
        {/* ---- Protected card ---- */}
        <button
          type="button"
          onClick={() => setSelected(selected === 'protected' ? null : 'protected')}
          style={{
            all: 'unset',
            display: 'block',
            width: '100%',
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="m-card m-reveal-left"
            style={{
              borderRadius: 12,
              border: '1px solid var(--m-border-green)',
              boxShadow: selected === 'protected'
                ? '0 0 0 3px rgba(22,163,74,0.3), 0 0 24px rgba(22,163,74,0.12)'
                : '0 0 24px rgba(22,163,74,0.08)',
              opacity: selected === 'unmonitored' ? 0.5 : 1,
              transition: 'opacity 0.3s, box-shadow 0.3s',
              textAlign: 'left',
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
        </button>

        {/* ---- Unmonitored card ---- */}
        <button
          type="button"
          onClick={() => setSelected(selected === 'unmonitored' ? null : 'unmonitored')}
          style={{
            all: 'unset',
            display: 'block',
            width: '100%',
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="m-card m-reveal-right"
            style={{
              borderRadius: 12,
              border: '1px solid var(--m-amber)',
              boxShadow: selected === 'unmonitored'
                ? '0 0 0 3px rgba(217,119,6,0.3), 0 0 24px rgba(217,119,6,0.12)'
                : '0 0 24px rgba(217,119,6,0.08)',
              opacity: selected === 'protected' ? 0.5 : 1,
              transition: 'opacity 0.3s, box-shadow 0.3s',
              textAlign: 'left',
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
        </button>
      </div>

      {/* ── Contextual CTA ── */}
      {selected && (
        <div
          style={{
            marginTop: 32,
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          {selected === 'protected' ? (
            <div
              style={{
                background: 'var(--m-green-light)',
                border: '1px solid var(--m-border-green)',
                borderRadius: 12,
                padding: '20px 24px',
                maxWidth: 480,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--m-green)', marginBottom: 8 }}>
                {'\u2713'} This is Charcoal N Chill — our real business, monitored daily.
              </p>
              <p style={{ fontSize: 14, color: 'var(--m-text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                Every LocalVector customer gets the same protection. Automated scans, instant alerts,
                correction guidance.
              </p>
              <a
                href="/scan"
                className="m-btn-primary"
                style={{ fontSize: 14, padding: '10px 20px' }}
              >
                See how your business compares {'\u2192'}
              </a>
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(217,119,6,0.06)',
                border: '1px solid rgba(217,119,6,0.2)',
                borderRadius: 12,
                padding: '20px 24px',
                maxWidth: 480,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--m-amber)', marginBottom: 8 }}>
                This could be your business right now.
              </p>
              <p style={{ fontSize: 14, color: 'var(--m-text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                AI is answering questions about your business. Wrong hours, wrong menu, wrong location —
                you won&apos;t know until a customer doesn&apos;t show up.
              </p>
              <a
                href="/scan"
                className="m-btn-primary"
                style={{ fontSize: 14, padding: '10px 20px' }}
              >
                Find out in 8 seconds — free {'\u2192'}
              </a>
            </div>
          )}
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `,
        }}
      />
    </>
  );
}
