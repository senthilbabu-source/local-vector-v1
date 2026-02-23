// ---------------------------------------------------------------------------
// Magic Menu — Canonical TypeScript interfaces for JSONB columns
//
// SOURCE OF TRUTH: Doc 03, Section 15.5.
// All code that reads or writes JSONB columns on the `magic_menus` table
// MUST import from here. Do NOT invent ad-hoc shapes.
// ---------------------------------------------------------------------------

// ── 15.5 magic_menus.extracted_data ─────────────────────────────────────────

/**
 * A single menu item extracted by the AI parser.
 * `confidence` is 0.0–1.0 — drives the Confidence Triage UI:
 *   ≥0.85  = auto-approved (collapsed, emerald)
 *   0.60–0.84 = needs review (expanded, amber)
 *   <0.60  = must edit (expanded, crimson, blocks publish)
 *
 * Doc 04b §2: `image_url` is populated from the `Image_URL` CSV column (Path 1)
 * or extracted by the GPT-4o POS mapper (Path 2). Used to populate
 * Schema.org MenuItem.image in the JSON-LD output.
 */
export interface MenuExtractedItem {
  id: string;
  name: string;
  description?: string;
  price?: string;
  category: string;
  /** AI confidence score for this item (0.0 – 1.0). */
  confidence: number;
  /** Optional dish photo URL. Rendered in Smart Review UI and emitted in JSON-LD. */
  image_url?: string;
}

/**
 * Top-level shape for `magic_menus.extracted_data` JSONB column.
 */
export interface MenuExtractedData {
  items: MenuExtractedItem[];
  extracted_at: string;  // ISO-8601
  source_url?: string;
}

// ── 15.6 magic_menus.propagation_events ─────────────────────────────────────

/**
 * A single entry in the `magic_menus.propagation_events` JSONB array.
 * Events are append-only; never mutate existing entries.
 *
 * Event meanings:
 *   published        — menu marked live by the owner
 *   link_injected    — owner pasted Magic Menu URL into Google Business Profile / Yelp
 *   indexnow_pinged  — IndexNow API called to fast-track AI crawler re-indexing (Phase 19+)
 *   crawled          — middleware recorded a verified bot hit (crawler_hits table)
 *   indexed          — confirmed indexed by Google / Bing
 *   live_in_ai       — confirmed cited by ChatGPT / Perplexity
 */
export interface PropagationEvent {
  event: 'published' | 'link_injected' | 'indexnow_pinged' | 'crawled' | 'indexed' | 'live_in_ai';
  date: string;  // ISO-8601
}

// ── Composite workspace type ─────────────────────────────────────────────────

/**
 * Full menu record shape used by the Smart Review workspace.
 * Mirrors the columns selected in the page.tsx query.
 */
export interface MenuWorkspaceData {
  id: string;
  location_id: string;
  processing_status: 'uploading' | 'processing' | 'review_ready' | 'published' | 'failed';
  extracted_data: MenuExtractedData | null;
  extraction_confidence: number | null;
  is_published: boolean;
  public_slug: string | null;
  human_verified: boolean;
  propagation_events: PropagationEvent[];
}
