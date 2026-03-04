// ---------------------------------------------------------------------------
// lib/distribution/distribution-types.ts — Sprint 1: Distribution Engine Core
//
// Types for the menu distribution system. All code that reads or writes
// distribution state MUST import from here.
// ---------------------------------------------------------------------------

/**
 * Result from a single engine's distribute attempt.
 */
export interface EngineResult {
  engine: string;
  status: 'success' | 'skipped' | 'error';
  message?: string;
}

/**
 * Aggregate result from distributeMenu().
 */
export interface DistributionResult {
  status: 'distributed' | 'no_changes' | 'error';
  engineResults: EngineResult[];
  contentHash: string | null;
  distributedAt: string | null; // ISO-8601
}

/**
 * Context passed to each engine adapter's distribute() method.
 */
export interface DistributionContext {
  menuId: string;
  orgId: string;
  publicSlug: string;
  appUrl: string; // NEXT_PUBLIC_APP_URL
  /** Menu items from extracted_data — avoids duplicate DB fetch in engine adapters. */
  items: import('@/lib/types/menu').MenuExtractedItem[];
  /** Supabase client for engines that need DB lookups (e.g. GBP location). */
  supabase: import('@supabase/supabase-js').SupabaseClient;
}

/**
 * Interface for distribution engine adapters.
 * Each engine (IndexNow, GBP, Apple BC) implements this.
 */
export interface DistributionEngine {
  name: string;
  distribute(ctx: DistributionContext): Promise<EngineResult>;
}
