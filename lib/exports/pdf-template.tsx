// ---------------------------------------------------------------------------
// lib/exports/pdf-template.tsx — React-PDF JSX template for audit report
//
// Sprint 95 — PDF Audit Report (Gap #74).
// Server-side only — never import in 'use client' components.
// Uses @react-pdf/renderer primitives only (Document, Page, View, Text, Image).
// ---------------------------------------------------------------------------

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { AuditReportData } from './pdf-assembler';

// ---------------------------------------------------------------------------
// Styles — all static, no dynamic expressions
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    color: '#111827',
  },
  // Cover
  coverLogo: {
    width: 120,
    height: 40,
    backgroundColor: '#6d28d9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  coverLogoText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  coverBrand: {
    fontSize: 12,
    color: '#6d28d9',
    marginBottom: 24,
  },
  coverDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    marginVertical: 20,
  },
  coverTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 12,
  },
  coverOrgName: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 4,
  },
  coverLocation: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
  },
  coverPeriod: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 4,
  },
  coverPrepared: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 24,
  },
  // Section headers
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#6d28d9',
    marginTop: 28,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 6,
  },
  // Executive Summary
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  scoreLabel: {
    width: 160,
    fontSize: 11,
    color: '#374151',
  },
  scoreValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  barContainer: {
    flexDirection: 'row',
    height: 14,
    width: 200,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
    marginLeft: 12,
  },
  barFill: {
    height: 14,
    backgroundColor: '#6d28d9',
    borderRadius: 3,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  statValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    textTransform: 'uppercase',
  },
  tableCell: {
    fontSize: 9,
    color: '#111827',
  },
  // Hallucination card
  hallucinationCard: {
    marginBottom: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
  },
  hallucinationHeader: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  hallucinationLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    marginTop: 4,
  },
  hallucinationText: {
    fontSize: 9,
    color: '#374151',
    marginTop: 2,
  },
  // Recommendations
  recItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  recBullet: {
    width: 14,
    fontSize: 10,
    color: '#6d28d9',
  },
  recText: {
    flex: 1,
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.4,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#6b7280',
  },
});

// ---------------------------------------------------------------------------
// Risk level colors (static)
// ---------------------------------------------------------------------------

const RISK_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#2563eb',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CoverSection({ data }: { data: AuditReportData }) {
  const periodStart = new Date(data.period.start).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const periodEnd = new Date(data.period.end).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const generated = new Date(data.period.generatedAt).toLocaleDateString(
    'en-US',
    { month: 'long', day: 'numeric', year: 'numeric' },
  );

  return (
    <View>
      <View style={styles.coverLogo}>
        <Text style={styles.coverLogoText}>
          {data.org.name.slice(0, 12)}
        </Text>
      </View>
      <Text style={styles.coverBrand}>LocalVector</Text>
      <View style={styles.coverDivider} />
      <Text style={styles.coverTitle}>AI VISIBILITY AUDIT REPORT</Text>
      <Text style={styles.coverOrgName}>{data.org.name}</Text>
      {(data.org.city || data.org.state) && (
        <Text style={styles.coverLocation}>
          {[data.org.city, data.org.state].filter(Boolean).join(', ')}
        </Text>
      )}
      <Text style={styles.coverPeriod}>
        Audit Period: {periodStart} – {periodEnd}
      </Text>
      <Text style={styles.coverPeriod}>Generated: {generated}</Text>
      <View style={styles.coverDivider} />
      <Text style={styles.coverPrepared}>
        Prepared by LocalVector — AI Visibility Intelligence Platform
      </Text>
    </View>
  );
}

function ExecutiveSummarySection({
  summary,
}: {
  summary: AuditReportData['summary'];
}) {
  const barWidth = Math.max(0, Math.min(100, summary.realityScore));

  return (
    <View>
      <Text style={styles.sectionTitle}>EXECUTIVE SUMMARY</Text>

      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>Reality Score</Text>
        <Text style={styles.scoreValue}>{summary.realityScore} / 100</Text>
        <View style={styles.barContainer}>
          <View style={[styles.barFill, { width: `${barWidth}%` }]} />
        </View>
      </View>

      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Total Audits Run</Text>
        <Text style={styles.statValue}>{summary.totalAudits}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Hallucinations Detected</Text>
        <Text style={styles.statValue}>
          {summary.hallucinationCount} ({summary.hallucinationRate}%)
        </Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>High Risk</Text>
        <Text style={styles.statValue}>{summary.byRisk.high}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Medium Risk</Text>
        <Text style={styles.statValue}>{summary.byRisk.medium}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Low Risk</Text>
        <Text style={styles.statValue}>{summary.byRisk.low}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>AI Models Monitored</Text>
        <Text style={styles.statValue}>{summary.modelCount}</Text>
      </View>
    </View>
  );
}

function ModelBreakdownSection({ rows }: { rows: AuditReportData['modelBreakdown'] }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>AI MODEL BREAKDOWN</Text>

      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { width: '35%' }]}>
          AI Engine
        </Text>
        <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Audits</Text>
        <Text style={[styles.tableHeaderCell, { width: '25%' }]}>
          Hallucinations
        </Text>
        <Text style={[styles.tableHeaderCell, { width: '20%' }]}>
          Accuracy
        </Text>
      </View>

      {rows.map((row, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={[styles.tableCell, { width: '35%' }]}>{row.model}</Text>
          <Text style={[styles.tableCell, { width: '20%' }]}>
            {row.audits}
          </Text>
          <Text style={[styles.tableCell, { width: '25%' }]}>
            {row.hallucinations}
          </Text>
          <Text style={[styles.tableCell, { width: '20%' }]}>
            {row.accuracy}%
          </Text>
        </View>
      ))}
    </View>
  );
}

function TopHallucinationsSection({
  hallucinations,
}: {
  hallucinations: AuditReportData['topHallucinations'];
}) {
  if (hallucinations.length === 0) {
    return (
      <View>
        <Text style={styles.sectionTitle}>TOP HALLUCINATIONS</Text>
        <Text style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>
          No hallucinations detected in this period.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>TOP HALLUCINATIONS</Text>

      {hallucinations.map((h, i) => {
        const riskColor = RISK_COLORS[h.riskLevel ?? ''] ?? '#6b7280';
        const riskLabel = h.riskLevel
          ? h.riskLevel.toUpperCase()
          : 'UNKNOWN';

        return (
          <View key={i} style={styles.hallucinationCard}>
            <Text
              style={[styles.hallucinationHeader, { color: riskColor }]}
            >
              {riskLabel} RISK — {h.date} — {h.model}
            </Text>
            <Text style={styles.hallucinationLabel}>Claim:</Text>
            <Text style={styles.hallucinationText}>{h.question}</Text>
            {h.correction && (
              <>
                <Text style={styles.hallucinationLabel}>Expected Truth:</Text>
                <Text style={styles.hallucinationText}>{h.correction}</Text>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

function SOVSummarySection({
  rows,
}: {
  rows: AuditReportData['sovRows'];
}) {
  if (rows.length === 0) {
    return (
      <View>
        <Text style={styles.sectionTitle}>SHARE OF VOICE SUMMARY</Text>
        <Text style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>
          No share-of-voice data available for this period.
        </Text>
      </View>
    );
  }

  // Collect all engine names for column headers
  const engines = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r.results))),
  );

  const queryWidth = '30%';
  const engineWidth = `${Math.floor(70 / Math.max(engines.length, 1))}%`;

  return (
    <View>
      <Text style={styles.sectionTitle}>SHARE OF VOICE SUMMARY</Text>

      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { width: queryWidth }]}>
          Query
        </Text>
        {engines.map((engine) => (
          <Text
            key={engine}
            style={[styles.tableHeaderCell, { width: engineWidth }]}
          >
            {engine}
          </Text>
        ))}
      </View>

      {rows.map((row, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={[styles.tableCell, { width: queryWidth }]}>
            {row.query}
          </Text>
          {engines.map((engine) => (
            <Text
              key={engine}
              style={[styles.tableCell, { width: engineWidth }]}
            >
              {row.results[engine] === 'cited' ? '✅' : '❌'}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function RecommendationsSection({
  recommendations,
}: {
  recommendations: string[];
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
      {recommendations.map((rec, i) => (
        <View key={i} style={styles.recItem}>
          <Text style={styles.recBullet}>{i + 1}.</Text>
          <Text style={styles.recText}>{rec}</Text>
        </View>
      ))}
    </View>
  );
}

function PageFooter({ orgName }: { orgName: string }) {
  return (
    <View fixed style={styles.footer}>
      <Text style={styles.footerText}>
        LocalVector AI Visibility Report — {orgName} — Confidential
      </Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main PDF component
// ---------------------------------------------------------------------------

export function AuditReportPDF({ data }: { data: AuditReportData }) {
  return (
    <Document
      title={`AI Visibility Audit — ${data.org.name}`}
      author="LocalVector"
    >
      <Page size="A4" style={styles.page}>
        <CoverSection data={data} />
        <ExecutiveSummarySection summary={data.summary} />
        <ModelBreakdownSection rows={data.modelBreakdown} />
        <TopHallucinationsSection hallucinations={data.topHallucinations} />
        <SOVSummarySection rows={data.sovRows} />
        <RecommendationsSection recommendations={data.recommendations} />
        <PageFooter orgName={data.org.name} />
      </Page>
    </Document>
  );
}
