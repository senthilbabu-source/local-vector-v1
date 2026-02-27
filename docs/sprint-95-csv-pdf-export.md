# Sprint 95 — CSV Export + PDF Audit Report

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `MEMORY.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Build two export features that are table-stakes for Agency tier sales:

1. **CSV Export** — Download hallucination history as a spreadsheet. Agency clients use this to report AI accuracy improvements to their own clients. Every SaaS product with tabular data needs CSV export.

2. **PDF Audit Report** — Download a white-label AI Visibility Audit Report as a PDF. Org name, logo placeholder, Reality Score, hallucination breakdown, SOV summary, and recommendations. This is the artifact an agency hands to a restaurant owner and says "look what AI thinks about your business."

**Both are Growth+ plan gated.** Agency tier sales depend on being able to justify the subscription cost. Exportable, shareable reports are a core part of that justification.

**Gaps being closed:** Feature #73 (CSV Export) 0% → 100%, Feature #74 (PDF Audit Report) 0% → 100%.

---

## ⚠️ LIBRARY DECISION — READ BEFORE WRITING CODE

The spec says "React-PDF or Puppeteer." **Use `@react-pdf/renderer` (React-PDF).** Here's why this decision is already made for you:

**React-PDF (`@react-pdf/renderer`):**
- Pure Node.js — no headless browser binary
- Vercel-compatible out of the box — no special configuration
- JSX-based PDF layout — familiar syntax
- Generates PDFs server-side in an API route
- ✅ Correct choice for this project

**Puppeteer:**
- Requires a Chromium binary (~170MB) — needs `@sparticuz/chromium` for Vercel
- Vercel function size limits can be hit
- More complex deployment configuration
- ❌ Avoid unless Puppeteer is already in `package.json`

**Check `package.json` first.** If `puppeteer` or `@sparticuz/chromium` is already installed, use Puppeteer and follow its pattern. If neither is installed, use React-PDF. Do NOT install Puppeteer fresh — add `@react-pdf/renderer` instead.

```bash
npm install @react-pdf/renderer
```

**Critical React-PDF rules:**
- The PDF renderer runs server-side only — never import `@react-pdf/renderer` in `'use client'` components
- API routes using React-PDF must use **Node.js runtime** — add `export const runtime = 'nodejs'` at the top of each export route
- `@react-pdf/renderer` uses its own layout system (Flexbox via Yoga) — standard HTML/CSS does not apply inside PDF components
- Available components: `Document`, `Page`, `View`, `Text`, `Image`, `Link`, `StyleSheet`
- Colors must be hex strings (`'#6d28d9'`) — named CSS colors may not work

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md
Read CLAUDE.md
Read MEMORY.md
Read package.json                   — Check for existing PDF/CSV libraries (puppeteer, @sparticuz/chromium, papaparse)

Read supabase/prod_schema.sql
  § hallucination_audits table — all columns
    (is_hallucination, risk_level, model, question, ai_response, corrected_response, status, created_at, org_id — verify exact names)
  § visibility_analytics table — SOV columns
    (query_text, model, cited_business, rank_position, evaluated_at — verify)
  § orgs table — name, logo_url (if exists), plan

Read lib/supabase/database.types.ts
Read lib/plan-enforcer.ts           — checkPlan(), isPlanAtLeast() or equivalent
Read app/dashboard/page.tsx         — Main dashboard (Reality Score lives here)
Read app/dashboard/                 — grep -rn "hallucination\|risk-dashboard\|fear" to find list page
Read lib/data/dashboard.ts          — Data fetchers — find Reality Score + hallucination data
Read src/__fixtures__/golden-tenant.ts
Read lib/supabase/server.ts
```

**Critical questions to answer before writing a line of code:**
1. Exact table name for hallucination audits? (`hallucination_audits`? `fear_engine_results`?)
2. What are the columns for AI question, AI response, hallucination flag?
3. Exact column name for risk level? (`risk_level`? `severity`?)
4. Does `orgs` have `logo_url`? If missing, use a placeholder box in the PDF.
5. How does `lib/plan-enforcer.ts` expose plan checking in route handlers?

---

## 🏗️ Architecture

### Export 1: CSV — Hallucination History

**Route:** `GET /api/exports/hallucinations`
**Runtime:** `nodejs`
**Auth:** Session-based — get `orgId` from user session, never from query params (AI_RULES §18)
**Plan gate:** Growth+ — return HTTP 402 with `{ error: 'plan_required', plan: 'growth' }` for Starter users
**Data:** Last 90 days of hallucination audits. Cap at 500 rows. Order by `created_at DESC`.

**CSV columns:**

| Column Header | Source Field | Notes |
|--------------|-------------|-------|
| Date | `created_at` | ISO 8601: `2026-02-28T14:30:00Z` |
| AI Model | `model` | e.g. `perplexity`, `openai`, `gemini`, `copilot` |
| Question | `question` | The prompt sent to the AI |
| AI Response | `ai_response` | Truncated to 500 chars |
| Hallucination Detected | `is_hallucination` | `Yes` / `No` |
| Risk Level | `risk_level` | `High` / `Medium` / `Low` / `-` |
| Correction | `corrected_response` | The correct information (if provided) |
| Status | `status` | `open` / `resolved` / `disputed` |

**Response headers:**
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="localvector-hallucinations-{YYYY-MM-DD}.csv"
Cache-Control: no-store
```

**CSV injection sanitization:** Any field that starts with `=`, `+`, `-`, `@`, or TAB must be prefixed with a single quote before quoting. Prevents formula injection when opened in Excel/Google Sheets.

```typescript
function sanitizeCSVField(value: string): string {
  const dangerous = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerous.some(char => value.startsWith(char))) {
    return `'${value}`;
  }
  return value;
}

function escapeCSVValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const sanitized = sanitizeCSVField(String(value));
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}
```

---

### Export 2: PDF — AI Visibility Audit Report

**Route:** `GET /api/exports/audit-report`
**Runtime:** `nodejs` (mandatory — React-PDF cannot run on Edge)
**Auth:** Session-based
**Plan gate:** Growth+

**Response headers:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="ai-visibility-audit-{org-slug}-{YYYY-MM-DD}.pdf"
Cache-Control: no-store
```

**PDF Design:** A4 (595pt × 842pt). Margins: 40pt all sides. Primary: `#6d28d9`. Text: `#111827`. Secondary: `#6b7280`.

---

### PDF Report Sections

**Section 1: Cover Page**
```
[LOGO — Image if logo_url exists, styled View placeholder if null]
LocalVector

────────────────────────

AI VISIBILITY AUDIT REPORT

{Org Name}
{City}, {State}

Audit Period: Dec 1 – Feb 28, 2026
Generated: February 28, 2026

────────────────────────

Prepared by LocalVector
AI Visibility Intelligence Platform
```

**Section 2: Executive Summary**
```
EXECUTIVE SUMMARY

Reality Score          72 / 100
████████████████░░░░   (filled bar — View with width %)

Total Audits Run         247
Hallucinations Detected   38  (15%)
High Risk                  8
Medium Risk               19
Low Risk                  11
AI Models Monitored        4
```

Reality Score: replicate the same computation used on the dashboard — do NOT call an internal API to get it. Likely: `100 - (hallucinationCount / totalAudits * 100)`, clamped 0–100.

**Section 3: AI Model Breakdown Table**

| AI Engine | Audits | Hallucinations | Accuracy |
|-----------|--------|----------------|----------|
| ChatGPT (OpenAI) | 62 | 8 | 87% |
| Perplexity | 61 | 12 | 80% |
| Google Gemini | 63 | 10 | 84% |
| Microsoft Copilot | 61 | 8 | 87% |

**Section 4: Top Hallucinations (max 5)**

For each, sorted high risk first then by date descending:
```
❌ HIGH RISK — February 25, 2026 — Perplexity
Q: "What time does Charcoal N Chill close on Friday?"
AI Said: "Charcoal N Chill closes at 10 PM on Fridays."
Correct: "Charcoal N Chill is open until 2 AM on Friday and Saturday."
```

**Section 5: Share of Voice Summary (max 10 queries)**

| Query | ChatGPT | Perplexity | Gemini | Copilot |
|-------|---------|-----------|--------|---------|
| "hookah lounge alpharetta" | ✅ #1 | ❌ | ✅ #2 | ✅ #1 |

Use `✅` for cited, `❌` for not cited. Literal unicode — React-PDF supports it.

**Section 6: Recommendations**

3–5 data-driven strings. Examples:
- If Perplexity hallucination rate > 20%: "Update your Perplexity-facing content — allow PerplexityBot in robots.txt."
- If Reality Score < 70: "Your Reality Score is below 70. Priority: correct the N high-risk hallucinations."
- If any model has 0 SOV citations: "PerplexityBot has not cited your business. Review your robots.txt and menu schema."

Computed from data — not hardcoded.

**Footer on every page:**
```typescript
function PageFooter({ orgName }: { orgName: string }) {
  return (
    <View fixed style={{ position: 'absolute', bottom: 20, left: 40, right: 40,
      flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 8, color: '#6b7280' }}>
        LocalVector AI Visibility Report — {orgName} — Confidential
      </Text>
      <Text style={{ fontSize: 8, color: '#6b7280' }}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}
```

---

## 🔧 Components to Build

### Component 1: `lib/exports/csv-builder.ts` — Pure CSV Builder

```typescript
export function buildHallucinationCSV(
  rows: HallucinationAuditRow[],
  options?: { maxResponseLength?: number }
): string

export function sanitizeCSVField(value: string): string
export function escapeCSVValue(value: string | null | undefined): string

function riskLevelLabel(level: string | null): string
// Maps: high→'High', medium→'Medium', low→'Low', null→'-'
```

**Rules:**
- RFC 4180 line endings: `\r\n`
- `HallucinationAuditRow` derived from `database.types.ts` Row type — use exact types, no manual interface duplication
- Pure function — no I/O, no side effects, zero mocks needed in tests

---

### Component 2: `lib/exports/pdf-assembler.ts` — Pure Data Assembler

```typescript
export interface AuditReportData {
  org: { name: string; city: string | null; state: string | null; logoUrl: string | null; }
  period: { start: string; end: string; generatedAt: string; }
  summary: {
    realityScore: number;
    totalAudits: number;
    hallucinationCount: number;
    hallucinationRate: number;   // 0–100
    byRisk: { high: number; medium: number; low: number };
    modelCount: number;
  }
  modelBreakdown: ModelRow[];
  topHallucinations: HallucinationDetail[];   // max 5, high risk first
  sovRows: SOVSummaryRow[];                   // max 10 queries
  recommendations: string[];                  // 3–5
}

export interface ModelRow {
  model: string;         // Display name: 'ChatGPT (OpenAI)', 'Perplexity', etc.
  audits: number;
  hallucinations: number;
  accuracy: number;      // 0–100
}

export interface HallucinationDetail {
  date: string;          // 'February 25, 2026'
  model: string;
  question: string;
  aiResponse: string;    // Truncated to 300 chars
  correction: string | null;
  riskLevel: 'high' | 'medium' | 'low' | null;
}

export interface SOVSummaryRow {
  query: string;
  results: Record<string, 'cited' | 'not_cited'>;  // keyed by display name
}

export function assembleAuditReportData(
  org: OrgRow,
  location: LocationRow | null,
  hallucinations: HallucinationAuditRow[],
  sovData: SOVRow[],
  realityScore: number
): AuditReportData

export function generateRecommendations(data: AuditReportData): string[]

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  openai:     'ChatGPT (OpenAI)',
  perplexity: 'Perplexity',
  gemini:     'Google Gemini',
  copilot:    'Microsoft Copilot',
  anthropic:  'Claude (Anthropic)',
}
```

---

### Component 3: `lib/exports/pdf-template.tsx` — React-PDF JSX Template

**Server-side only. No `'use client'`.**

```typescript
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { AuditReportData } from './pdf-assembler';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, paddingTop: 40,
          paddingBottom: 60, paddingHorizontal: 40, color: '#111827' },
  // All styles static — no template literals or dynamic expressions
});

export function AuditReportPDF({ data }: { data: AuditReportData }) {
  return (
    <Document title={`AI Visibility Audit — ${data.org.name}`} author="LocalVector">
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
```

**React-PDF styling rules:**
- All `StyleSheet.create()` values must be **static** — no dynamic expressions
- `flexDirection: 'row'` for horizontal layouts
- Text must always be wrapped in `<Text>` — never raw strings in `<View>`
- Tables: nested `<View>` with `flexDirection: 'row'` for rows
- Page footer: `<View fixed>` with `position: 'absolute'` bottom positioning
- Reality Score bar: two `<View>` elements side-by-side — one filled (width = realityScore%), one empty

---

### Component 4: `app/api/exports/hallucinations/route.ts` — CSV Route

```typescript
export const runtime = 'nodejs';  // REQUIRED

export async function GET(request: Request) {
  // 1. Auth — session only, no orgId from query params
  // 2. Get org → plan gate (Growth+) → HTTP 402 if Starter
  // 3. Query: hallucination_audits WHERE org_id = ? AND created_at >= 90_days_ago
  //    ORDER BY created_at DESC LIMIT 500
  // 4. buildHallucinationCSV(rows)
  // 5. Return new Response(csv, { headers: { Content-Type, Content-Disposition, Cache-Control } })
}
```

**Return `new Response(csv, {...})` — not `NextResponse`.** `NextResponse` may not set binary/stream headers correctly for file downloads.

---

### Component 5: `app/api/exports/audit-report/route.ts` — PDF Route

```typescript
export const runtime = 'nodejs';  // REQUIRED — React-PDF cannot run on Edge

export async function GET(request: Request) {
  // 1. Auth — session only
  // 2. Get org (name, plan, logo_url) → plan gate → HTTP 402 if Starter
  // 3. Three parallel queries (Promise.all):
  //    - hallucination_audits: last 90 days, limit 500
  //    - visibility_analytics: last 90 days, limit 200
  //    - locations: primary location (city, state)
  // 4. Compute realityScore inline
  // 5. assembleAuditReportData(...)
  // 6. renderToBuffer(<AuditReportPDF data={reportData} />)
  //    — wrap in try/catch, return 500 on PDF render error
  // 7. Return new Response(pdfBuffer, { headers: { Content-Type: application/pdf, ... } })
}

// Org name slug for filename:
const orgSlug = org.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40);
const filename = `ai-visibility-audit-${orgSlug}-${date}.pdf`;
```

---

### Component 6: Export Buttons — UI Integration

**Read the hallucination/risk dashboard page first.** Place buttons near the top of the hallucination table. PDF button goes near the Reality Score on the main dashboard.

**Download trigger — CRITICAL:**
```typescript
// Use window.location.href — NOT fetch()
// fetch() cannot trigger a browser download dialog
const handleExportCSV = () => { window.location.href = '/api/exports/hallucinations'; };
const handleExportPDF = () => { window.location.href = '/api/exports/audit-report'; };
```

**Plan gate UI:** Starter users see the button disabled with a tooltip: "Requires Growth plan or higher." Button is **visible but disabled** — not hidden. Users should see what they're missing (drives upgrades).

**`data-testid` attributes required:**
- `data-testid="export-csv-btn"`
- `data-testid="export-pdf-btn"`
- `data-testid="export-csv-upgrade-tooltip"`
- `data-testid="export-pdf-upgrade-tooltip"`

---

### Component 7: Golden Tenant Fixture Updates

Add to `src/__fixtures__/golden-tenant.ts`:

```typescript
export const MOCK_HALLUCINATION_ROWS: HallucinationAuditRow[] = [
  {
    id: 'h0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    model: 'perplexity',
    question: 'What time does Charcoal N Chill close on Friday?',
    ai_response: 'Charcoal N Chill closes at 10 PM on Fridays.',
    is_hallucination: true,
    risk_level: 'high',
    corrected_response: 'Charcoal N Chill is open until 2 AM on Friday and Saturday.',
    status: 'open',
    created_at: '2026-02-25T14:30:00Z',
  },
  {
    id: 'h1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    model: 'openai',
    question: 'Does Charcoal N Chill have outdoor seating?',
    ai_response: '=SUM(1,2)',   // ← formula injection test case
    is_hallucination: false,
    risk_level: 'low',
    corrected_response: null,
    status: 'resolved',
    created_at: '2026-02-24T10:00:00Z',
  },
  // Add 4 more covering: medium risk, null corrected_response, null risk_level, gemini model
];

export const MOCK_AUDIT_REPORT_DATA: AuditReportData = {
  org: { name: 'Charcoal N Chill', city: 'Alpharetta', state: 'GA', logoUrl: null },
  period: {
    start: '2025-12-01T00:00:00Z',
    end: '2026-02-28T23:59:59Z',
    generatedAt: '2026-02-28T12:00:00Z',
  },
  summary: {
    realityScore: 72, totalAudits: 247, hallucinationCount: 38,
    hallucinationRate: 15, byRisk: { high: 8, medium: 19, low: 11 }, modelCount: 4,
  },
  modelBreakdown: [
    { model: 'ChatGPT (OpenAI)', audits: 62, hallucinations: 8, accuracy: 87 },
    { model: 'Perplexity', audits: 61, hallucinations: 12, accuracy: 80 },
    { model: 'Google Gemini', audits: 63, hallucinations: 10, accuracy: 84 },
    { model: 'Microsoft Copilot', audits: 61, hallucinations: 8, accuracy: 87 },
  ],
  topHallucinations: [{
    date: 'February 25, 2026', model: 'Perplexity',
    question: 'What time does Charcoal N Chill close on Friday?',
    aiResponse: 'Charcoal N Chill closes at 10 PM on Fridays.',
    correction: 'Charcoal N Chill is open until 2 AM on Friday and Saturday.',
    riskLevel: 'high',
  }],
  sovRows: [{
    query: 'hookah lounge alpharetta',
    results: { 'ChatGPT (OpenAI)': 'cited', 'Perplexity': 'not_cited', 'Google Gemini': 'cited', 'Microsoft Copilot': 'cited' },
  }],
  recommendations: [
    'Your Reality Score is 72/100. Address the 8 high-risk hallucinations to improve accuracy.',
    'Perplexity has not cited you for some queries. Allow PerplexityBot in your robots.txt.',
  ],
};
```


---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/csv-builder.test.ts`

**Target: `lib/exports/csv-builder.ts` — Pure functions, zero mocks.**

```
describe('buildHallucinationCSV')
  1.  returns correct CSV header row (8 columns in exact order)
  2.  produces CRLF line endings (\r\n)
  3.  maps is_hallucination=true → "Yes"
  4.  maps is_hallucination=false → "No"
  5.  maps risk_level "high" → "High"
  6.  maps risk_level "medium" → "Medium"
  7.  maps risk_level "low" → "Low"
  8.  maps risk_level null → "-"
  9.  truncates ai_response to 500 chars by default
  10. respects custom maxResponseLength option
  11. handles empty rows array (returns header only, no trailing CRLF)
  12. produces correct total line count for N input rows (N+1 including header)

describe('escapeCSVValue')
  13. wraps in quotes when value contains a comma
  14. wraps in quotes when value contains a double quote
  15. doubles internal double quotes: " becomes ""
  16. wraps in quotes when value contains a newline
  17. does NOT wrap plain values that contain no special chars
  18. returns empty string for null input
  19. returns empty string for undefined input

describe('sanitizeCSVField — formula injection prevention')
  20. prefixes with single quote when value starts with "="
  21. prefixes with single quote when value starts with "+"
  22. prefixes with single quote when value starts with "-"
  23. prefixes with single quote when value starts with "@"
  24. does NOT prefix normal text starting with a letter
  25. does NOT prefix normal text starting with a digit
  26. injection-prefixed value is then quoted if it also contains a comma
  27. MOCK_HALLUCINATION_ROWS[1].ai_response ("=SUM(1,2)") is sanitized correctly
```

**27 tests. Zero mocks — pure functions.**

---

### Test File 2: `src/__tests__/unit/pdf-assembler.test.ts`

**Target: `lib/exports/pdf-assembler.ts` — Pure functions, zero mocks.**

```
describe('assembleAuditReportData')
  1.  org.name populated from org row
  2.  org.city and org.state populated from location row
  3.  org.logoUrl is null when org has no logo_url column or it is null
  4.  realityScore passed through to summary.realityScore
  5.  summary.totalAudits = total hallucination rows
  6.  summary.hallucinationCount = rows where is_hallucination=true only
  7.  summary.hallucinationRate = (hallucinationCount / totalAudits * 100) rounded
  8.  summary.byRisk.high counts rows with risk_level='high' and is_hallucination=true
  9.  summary.byRisk.medium counts correctly
  10. summary.byRisk.low counts correctly
  11. modelBreakdown has one entry per unique model
  12. modelBreakdown.accuracy = round((1 - hallucinations/audits) * 100)
  13. topHallucinations capped at 5 rows
  14. topHallucinations sorted: high risk first, then by created_at descending
  15. topHallucinations.aiResponse truncated to 300 chars
  16. sovRows capped at 10 unique queries
  17. sovRows result 'cited' when cited_business matches org name (case-insensitive)
  18. sovRows result 'not_cited' when cited_business is null or different org
  19. period.start is approximately 90 days before period.end

describe('generateRecommendations')
  20. returns at least 3 recommendations
  21. returns no more than 5 recommendations
  22. includes Reality Score recommendation when score < 70
  23. does NOT include Reality Score recommendation when score >= 70
  24. includes Perplexity robots.txt tip when Perplexity SOV citation rate = 0
  25. includes high-risk hallucination recommendation when high count > 0
  26. all returned values are non-empty strings (no nulls, no '')
```

**26 tests. Zero mocks.**

---

### Test File 3: `src/__tests__/unit/csv-export-route.test.ts`

**Target: `app/api/exports/hallucinations/route.ts`**

```
describe('GET /api/exports/hallucinations')
  1.  returns 401 when user is not authenticated
  2.  returns 404 when org not found for user
  3.  returns 402 with error_code "plan_required" for Starter plan
  4.  returns 200 with Content-Type: text/csv; charset=utf-8 for Growth+
  5.  Content-Disposition header contains "attachment" and ".csv"
  6.  filename contains current date in YYYY-MM-DD format
  7.  queries with eq('org_id', orgId) filter — never cross-tenant (AI_RULES §18)
  8.  queries with gte filter for 90 days ago
  9.  queries with limit(500)
  10. CSV body starts with correct header row
  11. returns header-only CSV when no audit rows exist for org
  12. Cache-Control: no-store header is set
```

**12 tests. Mock Supabase + plan enforcer.**

---

### Test File 4: `src/__tests__/unit/pdf-export-route.test.ts`

**Target: `app/api/exports/audit-report/route.ts`**

```
describe('GET /api/exports/audit-report')
  1.  returns 401 when user is not authenticated
  2.  returns 404 when org not found
  3.  returns 402 with error_code "plan_required" for Starter plan
  4.  returns 200 with Content-Type: application/pdf for Growth+
  5.  Content-Disposition contains "attachment" and ".pdf"
  6.  filename contains org name slug and current date
  7.  all three DB queries run in parallel via Promise.all
  8.  hallucination query includes org_id filter
  9.  visibility_analytics query includes org_id filter
  10. locations query includes org_id filter
  11. hallucination query uses 90-day window and limit 500
  12. visibility_analytics query uses 90-day window and limit 200
  13. calls assembleAuditReportData with correct arguments
  14. calls renderToBuffer with AuditReportPDF element
  15. returns 500 when renderToBuffer throws
  16. Cache-Control: no-store header is set
```

**16 tests.**

```typescript
// Mock setup for PDF route tests:
vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock')),
}));
vi.mock('@/lib/exports/pdf-assembler', () => ({
  assembleAuditReportData: vi.fn().mockReturnValue(MOCK_AUDIT_REPORT_DATA),
  generateRecommendations: vi.fn().mockReturnValue(['rec 1', 'rec 2', 'rec 3']),
}));
vi.mock('@/lib/exports/pdf-template', () => ({
  AuditReportPDF: vi.fn().mockReturnValue(null),
}));
```

---

### Test File 5 (Playwright E2E): `src/__tests__/e2e/exports.spec.ts`

```typescript
describe('CSV Export', () => {
  test('Export CSV button visible on hallucination dashboard for Growth+ users', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('export-csv-btn')).toBeVisible();
    await expect(page.getByTestId('export-csv-btn')).toBeEnabled();
  });

  test('Export CSV button disabled for Starter plan users', async ({ page }) => {
    // Auth as Starter plan user
    await page.goto('/dashboard');
    await expect(page.getByTestId('export-csv-btn')).toBeDisabled();
  });

  test('clicking Export CSV triggers file download with correct filename', async ({ page }) => {
    // waitForEvent('download') MUST be set up BEFORE clicking — register first, await after
    const downloadPromise = page.waitForEvent('download');
    await page.goto('/dashboard');
    await page.getByTestId('export-csv-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^localvector-hallucinations-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test('downloaded CSV has Content-Type: text/csv', async ({ page }) => {
    let contentType = '';
    await page.route('**/api/exports/hallucinations**', async (route) => {
      const response = await route.fetch();
      contentType = response.headers()['content-type'] ?? '';
      await route.fulfill({ response });
    });
    await page.goto('/dashboard');
    await page.getByTestId('export-csv-btn').click();
    await page.waitForTimeout(1000);
    expect(contentType).toContain('text/csv');
  });
});

describe('PDF Export', () => {
  test('Export PDF button visible on dashboard for Growth+ users', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('export-pdf-btn')).toBeVisible();
    await expect(page.getByTestId('export-pdf-btn')).toBeEnabled();
  });

  test('clicking Export PDF triggers file download with correct filename', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.goto('/dashboard');
    await page.getByTestId('export-pdf-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^ai-visibility-audit-.+\.pdf$/);
  });

  test('downloaded PDF has Content-Type: application/pdf', async ({ page }) => {
    let contentType = '';
    await page.route('**/api/exports/audit-report**', async (route) => {
      const response = await route.fetch();
      contentType = response.headers()['content-type'] ?? '';
      await route.fulfill({ response });
    });
    await page.goto('/dashboard');
    await page.getByTestId('export-pdf-btn').click();
    await page.waitForTimeout(1000);
    expect(contentType).toContain('application/pdf');
  });
});
```

**Total Playwright tests: 7**

**Critical Playwright note:** `page.waitForEvent('download')` must be registered **before** the click action. The pattern is:
```typescript
const downloadPromise = page.waitForEvent('download');  // register first
await page.getByTestId('export-csv-btn').click();       // then click
const download = await downloadPromise;                  // then await
```

---

## 📂 Files to Create / Modify

| # | File | Action | Notes |
|---|------|--------|-------|
| 1 | `lib/exports/csv-builder.ts` | **CREATE** | Pure CSV builder + sanitizer |
| 2 | `lib/exports/pdf-assembler.ts` | **CREATE** | Pure data assembler |
| 3 | `lib/exports/pdf-template.tsx` | **CREATE** | React-PDF JSX template — server-side only |
| 4 | `app/api/exports/hallucinations/route.ts` | **CREATE** | `runtime = 'nodejs'`, Growth+ gate |
| 5 | `app/api/exports/audit-report/route.ts` | **CREATE** | `runtime = 'nodejs'`, Growth+ gate |
| 6 | `app/dashboard/[hallucination page]` | **MODIFY** | Export CSV + PDF buttons, data-testid |
| 7 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add MOCK_HALLUCINATION_ROWS + MOCK_AUDIT_REPORT_DATA |
| 8 | `src/__tests__/unit/csv-builder.test.ts` | **CREATE** | 27 tests |
| 9 | `src/__tests__/unit/pdf-assembler.test.ts` | **CREATE** | 26 tests |
| 10 | `src/__tests__/unit/csv-export-route.test.ts` | **CREATE** | 12 tests |
| 11 | `src/__tests__/unit/pdf-export-route.test.ts` | **CREATE** | 16 tests |
| 12 | `src/__tests__/e2e/exports.spec.ts` | **CREATE** | 7 Playwright tests |
| 13 | `package.json` | **MODIFY** | Add `@react-pdf/renderer` if not present |

---

## 🚫 What NOT to Do

1. **DO NOT use `fetch()` in the export button handler** — use `window.location.href`. `fetch()` cannot trigger a browser download dialog.
2. **DO NOT import `@react-pdf/renderer` in any `'use client'` component** — server-side only.
3. **DO NOT add `export const runtime = 'edge'`** to either export route — React-PDF requires Node.js.
4. **DO NOT skip CSV injection sanitization** — hallucination AI responses are user-generated content that may contain formula-like strings.
5. **DO NOT fetch external URLs for the logo** — if `logo_url` is null, render a styled placeholder `<View>`. Never make outbound fetches from the PDF renderer for unknown URLs.
6. **DO NOT use dynamic style objects in React-PDF** — all styles must be in `StyleSheet.create()` with static values.
7. **DO NOT use HTML elements in React-PDF** — `<div>`, `<p>`, `<table>` are invalid. Only `Document`, `Page`, `View`, `Text`, `Image`, `Link`.
8. **DO NOT accept `orgId` as a query parameter** — always derive from session (AI_RULES §18).
9. **DO NOT render the PDF client-side** — `renderToBuffer` runs only in the server-side API route.
10. **DO NOT show fewer than 3 recommendations in the PDF** — minimum 3 always, maximum 5. Even for perfect orgs, recommend proactive monitoring steps.
11. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
12. **DO NOT edit `middleware.ts`** (AI_RULES §6).
13. **DO NOT hide the export button from Starter users** — disable it with an upgrade tooltip. Visibility drives upgrade motivation.

---

## ✅ Definition of Done (AI_RULES §13.5)

### CSV Export
- [ ] `lib/exports/csv-builder.ts` — pure, RFC 4180, CRLF, formula injection prevention
- [ ] Route: `runtime = 'nodejs'`, auth, Growth+ gate (HTTP 402 for Starter), 90-day/500-row cap
- [ ] Filename: `localvector-hallucinations-YYYY-MM-DD.csv`
- [ ] `data-testid="export-csv-btn"` — enabled for Growth+, disabled for Starter with tooltip
- [ ] `Cache-Control: no-store` header set

### PDF Audit Report
- [ ] `lib/exports/pdf-assembler.ts` — pure, all sections, max-5 hallucinations (high risk first), max-10 SOV rows, 3–5 recommendations
- [ ] `lib/exports/pdf-template.tsx` — all 6 sections, fixed page footer with page numbers, logo placeholder when null
- [ ] Route: `runtime = 'nodejs'`, auth, Growth+ gate, 3 parallel queries
- [ ] Filename: `ai-visibility-audit-{slug}-YYYY-MM-DD.pdf`
- [ ] `data-testid="export-pdf-btn"` — enabled for Growth+, disabled for Starter with tooltip
- [ ] `@react-pdf/renderer` in `package.json` dependencies

### Tests
- [ ] `npx vitest run src/__tests__/unit/csv-builder.test.ts` — **27 tests passing**
- [ ] `npx vitest run src/__tests__/unit/pdf-assembler.test.ts` — **26 tests passing**
- [ ] `npx vitest run src/__tests__/unit/csv-export-route.test.ts` — **12 tests passing**
- [ ] `npx vitest run src/__tests__/unit/pdf-export-route.test.ts` — **16 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/exports.spec.ts` — **7 tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-28 — Sprint 95: CSV Export + PDF Audit Report (Completed)

**Goal:** CSV export (hallucination history) + PDF audit report for Agency clients.
Both Growth+ plan gated. PDF uses @react-pdf/renderer (pure Node.js, Vercel-compatible).

**Scope:**
- `lib/exports/csv-builder.ts` — **NEW.** Pure CSV builder. RFC 4180, CRLF, formula injection prevention (=, +, -, @ → single-quote prefix). 500-char AI response cap.
- `lib/exports/pdf-assembler.ts` — **NEW.** Pure data assembler → AuditReportData. Reality Score computation, model breakdown, top-5 hallucinations (high risk first), 10-query SOV summary, 3–5 data-driven recommendations.
- `lib/exports/pdf-template.tsx` — **NEW.** React-PDF JSX. 6 sections: cover page, executive summary (Reality Score bar), model breakdown table, top hallucinations, SOV summary, recommendations. Fixed page footer with page-number render prop. Logo placeholder when logo_url null.
- `app/api/exports/hallucinations/route.ts` — **NEW.** runtime=nodejs. Auth + Growth+ gate. 90-day / 500-row cap. text/csv with attachment Content-Disposition.
- `app/api/exports/audit-report/route.ts` — **NEW.** runtime=nodejs. Auth + Growth+ gate. 3 parallel queries. renderToBuffer → application/pdf.
- `app/dashboard/[page]` — **MODIFIED.** Export CSV + PDF buttons added with data-testid. Disabled + upgrade tooltip for Starter plan.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added MOCK_HALLUCINATION_ROWS (6 rows, incl. formula injection case) + MOCK_AUDIT_REPORT_DATA.

**Tests added:**
- `csv-builder.test.ts` — **N Vitest tests.** Headers, escaping, formula injection, edge cases.
- `pdf-assembler.test.ts` — **N Vitest tests.** Assembly, caps, sorting, recommendations.
- `csv-export-route.test.ts` — **N Vitest tests.** Auth, plan gate, query filters, headers.
- `pdf-export-route.test.ts` — **N Vitest tests.** Auth, plan gate, parallel queries, PDF render, error handling.
- `exports.spec.ts` — **N Playwright tests.** Download triggers (4 CSV, 3 PDF), MIME types, disabled state.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/csv-builder.test.ts          # N tests
npx vitest run src/__tests__/unit/pdf-assembler.test.ts        # N tests
npx vitest run src/__tests__/unit/csv-export-route.test.ts     # N tests
npx vitest run src/__tests__/unit/pdf-export-route.test.ts     # N tests
npx vitest run                                                   # All — no regressions
npx playwright test src/__tests__/e2e/exports.spec.ts          # N e2e tests
npx tsc --noEmit                                                 # 0 type errors
```

**Note:** Replace N with actual counts via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `lib/plan-enforcer.ts` | Phase 3 | Growth+ plan gate for both routes |
| Hallucination audits table + Fear Engine data | Phase 1 | Source for CSV + PDF sections |
| `visibility_analytics` / SOV table | Phase 5 | Source for PDF SOV section |
| `orgs.plan` column | Phase 0 | Plan gate decision |
| Reality Score computation | Dashboard | Replicated inline in PDF route |
| Golden tenant with 5+ audits | Sprint 92 | E2E test data |

---

## 🧠 Edge Cases to Handle

1. **Org with zero hallucination rows:** CSV returns header only (not an error). PDF renders with zeroed summary, Reality Score = 100, and a note: "No hallucinations detected in this period" in place of the top-hallucinations section.

2. **Very long org name in PDF filename:** Cap slug at 40 chars after `replace(/[^a-z0-9]/g, '-')` to prevent filesystem issues.

3. **`renderToBuffer` throwing:** React-PDF errors are cryptic. Wrap in try/catch, log the full error with `console.error('[export/audit-report] PDF render error:', err)`, return HTTP 500. Do not let the error surface unhandled.

4. **`page.waitForEvent('download')` ordering:** In Playwright, the download listener **must** be registered before the action that triggers it. See the test pattern above — register, click, then await.

5. **Reality Score computation edge cases:** `totalAudits = 0` → score = 100 (no data = assumed accurate). Cap the result: `Math.max(0, Math.min(100, computed))`.

6. **PDF page overflow:** React-PDF handles text/view overflow to the next page automatically — no manual pagination needed beyond the max-5 and max-10 caps on hallucinations and SOV rows respectively.

7. **Starter plan button:** Visible, disabled, `cursor-not-allowed`, `opacity-50`. A `Tooltip` component wrapping the button shows the upgrade message on hover. The tooltip component is already used elsewhere in the dashboard — find and reuse it, do not build a new one.

8. **`logo_url` null handling in React-PDF:** If `logo_url` is null, render:
   ```typescript
   <View style={{ width: 120, height: 40, backgroundColor: '#6d28d9',
     justifyContent: 'center', alignItems: 'center' }}>
     <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold' }}>
       {data.org.name.slice(0, 12)}
     </Text>
   </View>
   ```
   Never attempt `<Image src={null}>` — React-PDF will throw.

---

## 📚 Document Sync + Git Commit

### Step 1: Update `/docs`

**`docs/roadmap.md`** — Feature #73 (CSV Export) `❌ 0%` → `✅ 100%`. Feature #74 (PDF Audit Report) `❌ 0%` → `✅ 100%`.

**`docs/09-BUILD-PLAN.md`** — Add Sprint 95 to completed sprints. Note `runtime = 'nodejs'` requirement and React-PDF library choice.

### Step 2: Update `DEVLOG.md`
Paste the DEVLOG entry above. Replace all `N` with actual test counts from `grep -cE "^\s*(it|test)\("`.

### Step 3: Update `CLAUDE.md`
```markdown
### Sprint 95 — CSV Export + PDF Audit Report (2026-02-28)
- `lib/exports/csv-builder.ts` — pure CSV builder, formula injection prevention
- `lib/exports/pdf-assembler.ts` — pure AuditReportData assembler
- `lib/exports/pdf-template.tsx` — React-PDF JSX, 6 sections, fixed page footer
- `app/api/exports/hallucinations/route.ts` — CSV (Growth+, runtime=nodejs)
- `app/api/exports/audit-report/route.ts` — PDF (Growth+, runtime=nodejs)
- Library: @react-pdf/renderer (pure Node.js, Vercel-compatible)
- Tests: 81 Vitest + 7 Playwright
- Gap #73: CSV Export 0% → 100%
- Gap #74: PDF Audit Report 0% → 100%
```

### Step 4: Update `MEMORY.md`
```markdown
## Decision: Export Architecture (Sprint 95 — 2026-02-28)
- PDF library: @react-pdf/renderer — chosen over Puppeteer for Vercel compatibility (no binary)
- Both routes: runtime = 'nodejs' (required — React-PDF + Supabase need Node.js APIs)
- Download trigger: window.location.href — NOT fetch(). fetch() cannot trigger download dialog.
- CSV injection: =, +, -, @ prefixes get single-quote prepended before quoting
- CSV/PDF both Growth+ plan gated — HTTP 402 for Starter; button visible but disabled
- CSV caps: 500 rows / 90 days. PDF caps: top-5 hallucinations / 10 SOV queries
- Logo: logo_url used if present; styled View placeholder if null — never <Image src={null}>
- Reality Score: computed inline (not via internal API fetch): 100 - (hallucinations/total)*100
```

### Step 5: Update `AI_RULES.md`
```markdown
## 47. 📄 Export Routes — Node.js Runtime Required (Sprint 95)

Export routes at `app/api/exports/` must have `export const runtime = 'nodejs'`.

* **Rule:** Never `export const runtime = 'edge'` in any export route.
* **Download trigger:** `window.location.href = '/api/exports/...'` — NOT `fetch()`.
  Direct navigation is required for `Content-Disposition: attachment` to trigger the download dialog.
* **CSV:** Always use `escapeCSVValue()` + `sanitizeCSVField()` from `lib/exports/csv-builder.ts`.

## 48. 🧮 React-PDF Rules (Sprint 95)

`@react-pdf/renderer` is used for PDF generation. Server-side only.

* **Never import** `@react-pdf/renderer` in `'use client'` components.
* **Only use** React-PDF primitives: `Document`, `Page`, `View`, `Text`, `Image`, `Link`.
* **All styles** must be in `StyleSheet.create()` — no inline dynamic style objects.
* **No HTML** inside PDF templates (`<div>`, `<p>`, `<table>` are invalid).
* **Never** `<Image src={null}>` — use a styled `<View>` placeholder instead.
```

### Step 6: Git Commit
```bash
git add -A
git status

git commit -m "Sprint 95: CSV Export + PDF Audit Report

CSV (/api/exports/hallucinations):
- lib/exports/csv-builder.ts: pure, RFC 4180, CRLF, formula injection prevention
- runtime=nodejs, Growth+ gate (402), 90-day/500-row cap
- Content-Disposition attachment with dated filename

PDF (/api/exports/audit-report):
- lib/exports/pdf-assembler.ts: pure assembler (6 sections, data-driven recommendations)
- lib/exports/pdf-template.tsx: @react-pdf/renderer JSX
  cover + summary + model table + top-5 hallucinations + SOV table + recs + page footer
- runtime=nodejs, Growth+ gate, 3 parallel queries
- Logo placeholder View when logo_url null

UI:
- Export buttons on hallucination dashboard + main dashboard
- data-testid on all export elements
- Disabled + upgrade tooltip for Starter plan users

Tests: 81 Vitest + 7 Playwright passing, 0 regressions, 0 type errors

Docs: roadmap #73/#74 → 100%, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES updated
Gap #73 + #74 closed. Tier 2 Sprint 3/5 complete.
Next: Sprint 96 (Plan Gate Polish — Blur Teasers)."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 95 completes:
- **CSV Export: 0% → 100%** (Gap #73 closed)
- **PDF Audit Report: 0% → 100%** (Gap #74 closed)
- Agency clients can download a print-ready PDF to present to restaurant owners — the Agency tier value prop is now fully demonstrable in a single shareable file
- CSV export lets agencies track hallucination rate trends over time in their own spreadsheets
- `@react-pdf/renderer` is established as the PDF library — future report types can extend `pdf-template.tsx`
- Formula injection prevention is baked in — CSV files are safe to open in Excel/Google Sheets without triggering formulas
- `lib/exports/` is a clean, pure-function module — all business logic testable without mocks
- **Tier 2 Sprint 3 of 5 complete.** Sprint 96 (Plan Gate Polish — Blur Teasers) is next.
