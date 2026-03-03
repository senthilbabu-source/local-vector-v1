/**
 * Unit Tests — RLS Coverage Audit (P6-FIX-25)
 *
 * Reads the production schema SQL and the RLS gap-fill migration to verify
 * every table with an org_id column has RLS enabled.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/security-rls-audit.test.ts
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read the schema and migration files
const schemaPath = join(process.cwd(), 'supabase', 'prod_schema.sql');
const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260304100001_rls_gap_fill.sql',
);

let schemaSql: string;
let migrationSql: string;

try {
  schemaSql = readFileSync(schemaPath, 'utf-8');
} catch {
  schemaSql = '';
}
try {
  migrationSql = readFileSync(migrationPath, 'utf-8');
} catch {
  migrationSql = '';
}

const combinedSql = schemaSql + '\n' + migrationSql;

// ---------------------------------------------------------------------------
// Extract tables with org_id column from schema
// ---------------------------------------------------------------------------

function extractTablesWithOrgId(sql: string): string[] {
  const tables: string[] = [];
  // Match CREATE TABLE ... ( ... org_id ... )
  const tableRegex = /CREATE TABLE[^"]*"public"\."(\w+)"/g;
  let match;
  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    // Find the table definition block (from CREATE TABLE to the next CREATE TABLE or end)
    const startIdx = match.index;
    const nextCreate = sql.indexOf('CREATE TABLE', startIdx + 1);
    const block = nextCreate > -1 ? sql.slice(startIdx, nextCreate) : sql.slice(startIdx);
    if (/\borg_id\b/.test(block)) {
      tables.push(tableName);
    }
  }
  return [...new Set(tables)];
}

function extractRLSEnabledTables(sql: string): string[] {
  const tables: string[] = [];
  const rlsRegex = /ALTER TABLE[^"]*"?public"?\."?(\w+)"?\s+ENABLE ROW LEVEL SECURITY/gi;
  let match;
  while ((match = rlsRegex.exec(sql)) !== null) {
    tables.push(match[1]);
  }
  return [...new Set(tables)];
}

// Tables intentionally without RLS (global lookup tables, no org_id)
const INTENTIONAL_SKIP = ['local_occasions', 'directories'];

describe('RLS coverage audit (P6-FIX-25)', () => {
  it('schema file exists and is readable', () => {
    expect(schemaSql.length).toBeGreaterThan(0);
  });

  it('RLS gap-fill migration exists', () => {
    expect(migrationSql.length).toBeGreaterThan(0);
  });

  const tablesWithOrgId = extractTablesWithOrgId(schemaSql);
  const rlsEnabledTables = extractRLSEnabledTables(combinedSql);

  it('finds tables with org_id in schema', () => {
    expect(tablesWithOrgId.length).toBeGreaterThan(10);
  });

  it('every org_id table has RLS enabled (schema + migration combined)', () => {
    const missing = tablesWithOrgId.filter(
      (t) => !rlsEnabledTables.includes(t) && !INTENTIONAL_SKIP.includes(t),
    );
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('Tables with org_id but NO RLS:', missing);
    }
    expect(missing).toEqual([]);
  });

  // P6-FIX-25: These 10 tables were added in the gap-fill migration
  const GAP_FILL_TABLES = [
    'entity_authority_citations',
    'entity_authority_profiles',
    'entity_authority_snapshots',
    'intent_discoveries',
    'listing_platform_ids',
    'listing_snapshots',
    'nap_discrepancies',
    'page_schemas',
    'post_publish_audits',
    'vaio_profiles',
  ];

  GAP_FILL_TABLES.forEach((table) => {
    it(`migration enables RLS on ${table}`, () => {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    });

    it(`migration creates SELECT policy for ${table}`, () => {
      expect(migrationSql).toContain(`"${table}_select_own" ON public.${table}`);
    });

    it(`migration creates INSERT policy for ${table}`, () => {
      expect(migrationSql).toContain(`"${table}_insert_own" ON public.${table}`);
    });
  });

  it('intentionally skipped tables do not have org_id', () => {
    // local_occasions and directories are global — verify they're NOT in the org_id list
    INTENTIONAL_SKIP.forEach((table) => {
      // This is a documentation test — if these tables ever gain org_id, they need RLS
      expect(tablesWithOrgId).not.toContain(table);
    });
  });
});
