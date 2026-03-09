'use client';
// ---------------------------------------------------------------------------
// PublicReportCard — Sprint A: shared UI for public report pages
//
// Dark theme (matches ScanDashboard). Uses Reveal/Bar scroll-reveal components,
// SectionLabel eyebrow text, JetBrains Mono for data elements.
//
// Two modes:
//   1. Location report (full data from visibility_scores + hallucinations)
//   2. Scan report (minimal data from scan_leads)
//
// DESIGN-SYSTEM.md: all colors, fonts, animations, and hard rules followed.
// ---------------------------------------------------------------------------

import type { PublicLocationReport, PublicScanReport } from '@/lib/report/public-report';
import Reveal from '@/app/_components/Reveal';
import Bar from '@/app/_components/Bar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionLabel({ children, color = '#00F5A0' }: { children: React.ReactNode; color?: string }) {
  return (
    <p
      className="text-xs font-bold uppercase mb-3"
      style={{
        color,
        letterSpacing: '0.14em',
        fontFamily: 'var(--font-jetbrains-mono), monospace',
      }}
    >
      {children}
    </p>
  );
}

function ScoreCard({
  label,
  value,
  color,
  pct,
}: {
  label: string;
  value: string;
  color: string;
  pct: number;
}) {
  return (
    <div className="lv-card" style={{ padding: 20 }}>
      <p
        className="text-xs font-bold uppercase mb-2"
        style={{
          color: '#94A3B8',
          letterSpacing: '0.08em',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 'clamp(28px, 4vw, 38px)',
          fontWeight: 800,
          color,
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          marginBottom: 8,
        }}
      >
        {value}
      </p>
      <Bar pct={pct} color={color} />
    </div>
  );
}

function StatRow({ label, value, color = '#F1F5F9' }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <span style={{ fontSize: 14, color: '#94A3B8' }}>{label}</span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color,
          fontFamily: 'var(--font-jetbrains-mono), monospace',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function scoreColor(score: number | null): string {
  if (score === null) return '#475569';
  return score >= 80 ? '#00F5A0' : score >= 50 ? '#FFB800' : '#EF4444';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (_err) {
    return 'N/A';
  }
}

function statusLabel(status: 'fail' | 'pass' | 'not_found'): string {
  return status === 'fail'
    ? 'AI Hallucination Detected'
    : status === 'pass'
      ? 'No Hallucinations Detected'
      : 'Invisible to AI Search';
}

function statusColor(status: 'fail' | 'pass' | 'not_found'): string {
  return status === 'fail' ? '#EF4444' : status === 'pass' ? '#00F5A0' : '#94A3B8';
}

// ---------------------------------------------------------------------------
// LocationReportCard
// ---------------------------------------------------------------------------

export function LocationReportCard({ report }: { report: PublicLocationReport }) {
  const vis = report.visibilityScore;
  const acc = report.accuracyScore;
  const real = report.realityScore;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <Reveal>
        <div className="text-center" style={{ marginBottom: 48 }}>
          <SectionLabel>AI VISIBILITY REPORT</SectionLabel>
          <h1
            style={{
              fontSize: 'clamp(28px, 5vw, 44px)',
              fontWeight: 800,
              color: '#F1F5F9',
              fontFamily: 'var(--font-outfit), sans-serif',
              lineHeight: 1.1,
              marginBottom: 8,
            }}
          >
            {report.businessName}
          </h1>
          {(report.city || report.state) && (
            <p style={{ fontSize: 15, color: '#94A3B8' }}>
              {[report.city, report.state].filter(Boolean).join(', ')}
            </p>
          )}
          {report.snapshotDate && (
            <p
              style={{
                fontSize: 12,
                color: '#475569',
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                marginTop: 8,
              }}
            >
              Report generated {formatDate(report.snapshotDate)}
            </p>
          )}
        </div>
      </Reveal>

      {/* Score cards */}
      <Reveal delay={100}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 32,
          }}
        >
          <ScoreCard
            label="AI Visibility"
            value={vis !== null ? `${Math.round(vis)}` : '--'}
            color={scoreColor(vis)}
            pct={vis ?? 0}
          />
          <ScoreCard
            label="Accuracy"
            value={acc !== null ? `${Math.round(acc)}` : '--'}
            color={scoreColor(acc)}
            pct={acc ?? 0}
          />
          <ScoreCard
            label="Reality Score"
            value={real !== null ? `${Math.round(real)}` : '--'}
            color={scoreColor(real)}
            pct={real ?? 0}
          />
        </div>
      </Reveal>

      {/* Delta badge */}
      {report.scoreDelta !== null && report.scoreDelta !== 0 && (
        <Reveal delay={200}>
          <div className="text-center" style={{ marginBottom: 32 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                padding: '6px 14px',
                borderRadius: 100,
                background: report.scoreDelta > 0
                  ? 'rgba(0,245,160,0.1)'
                  : 'rgba(239,68,68,0.1)',
                color: report.scoreDelta > 0 ? '#00F5A0' : '#EF4444',
                border: `1px solid ${report.scoreDelta > 0 ? 'rgba(0,245,160,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}
            >
              {report.scoreDelta > 0 ? '▲' : '▼'} {Math.abs(report.scoreDelta).toFixed(1)} pts since last scan
            </span>
          </div>
        </Reveal>
      )}

      {/* Stats */}
      <Reveal delay={300}>
        <div className="lv-card" style={{ padding: 24, marginBottom: 32 }}>
          <SectionLabel>MONITORING STATUS</SectionLabel>
          <StatRow
            label="Active Hallucinations"
            value={String(report.activeHallucinations)}
            color={report.activeHallucinations > 0 ? '#EF4444' : '#00F5A0'}
          />
          <StatRow
            label="AI Engines Monitored"
            value={String(report.sovEnginesMonitored)}
          />
          <StatRow
            label="Last Scan"
            value={formatDate(report.lastScanDate)}
          />
        </div>
      </Reveal>

      {/* CTA */}
      <Reveal delay={400}>
        <div className="text-center" style={{ marginTop: 48 }}>
          <p
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#F1F5F9',
              fontFamily: 'var(--font-outfit), sans-serif',
              marginBottom: 8,
            }}
          >
            Want this for your business?
          </p>
          <p style={{ fontSize: 15, color: '#94A3B8', marginBottom: 24 }}>
            Get your free AI visibility audit in 8 seconds.
          </p>
          <a
            href="/"
            className="lv-btn-green"
            style={{ display: 'inline-block', fontSize: 15, padding: '14px 32px' }}
          >
            Run My Free AI Audit
          </a>
        </div>
      </Reveal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScanReportCard
// ---------------------------------------------------------------------------

export function ScanReportCard({ report }: { report: PublicScanReport }) {
  const color = statusColor(report.scanStatus);
  const label = statusLabel(report.scanStatus);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <Reveal>
        <div className="text-center" style={{ marginBottom: 48 }}>
          <SectionLabel color={color}>AI AUDIT RESULT</SectionLabel>
          <h1
            style={{
              fontSize: 'clamp(28px, 5vw, 44px)',
              fontWeight: 800,
              color: '#F1F5F9',
              fontFamily: 'var(--font-outfit), sans-serif',
              lineHeight: 1.1,
              marginBottom: 12,
            }}
          >
            {report.businessName}
          </h1>
          <p
            style={{
              fontSize: 12,
              color: '#475569',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
            }}
          >
            Scanned {formatDate(report.createdAt)}
          </p>
        </div>
      </Reveal>

      {/* Status banner */}
      <Reveal delay={100}>
        <div
          className="lv-card"
          style={{
            padding: 28,
            borderLeft: `3px solid ${color}`,
            textAlign: 'center',
            marginBottom: 32,
          }}
        >
          {/* Pulsing dot for fail */}
          {report.scanStatus === 'fail' && (
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#EF4444',
                marginRight: 8,
                animation: 'lv-ping 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
              aria-hidden
            />
          )}
          <p
            style={{
              fontSize: 20,
              fontWeight: 700,
              color,
              fontFamily: 'var(--font-outfit), sans-serif',
              marginBottom: 8,
            }}
          >
            {label}
          </p>
          <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6 }}>
            {report.scanStatus === 'fail'
              ? 'AI models are stating inaccurate information about this business. This can mislead potential customers and cost revenue.'
              : report.scanStatus === 'pass'
                ? 'No factual inaccuracies were detected in how AI models describe this business.'
                : 'AI search engines have no data about this business. It is invisible to AI-powered search.'}
          </p>
        </div>
      </Reveal>

      {/* CTA */}
      <Reveal delay={200}>
        <div className="text-center" style={{ marginTop: 48 }}>
          <p
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#F1F5F9',
              fontFamily: 'var(--font-outfit), sans-serif',
              marginBottom: 8,
            }}
          >
            Is AI telling the truth about your business?
          </p>
          <p style={{ fontSize: 15, color: '#94A3B8', marginBottom: 24 }}>
            Find out in 8 seconds. Free, no account required.
          </p>
          <a
            href="/"
            className="lv-btn-green"
            style={{ display: 'inline-block', fontSize: 15, padding: '14px 32px' }}
          >
            Run My Free AI Audit
          </a>
          <p
            style={{
              marginTop: 12,
              fontSize: 11,
              color: '#475569',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
            }}
          >
            Powered by LocalVector.ai
          </p>
        </div>
      </Reveal>
    </div>
  );
}
