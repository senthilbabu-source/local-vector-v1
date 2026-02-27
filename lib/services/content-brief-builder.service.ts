// ---------------------------------------------------------------------------
// lib/services/content-brief-builder.service.ts — Pure Brief Structure Builder
//
// Sprint 86: Deterministic parts of a content brief — URL slug, title tag, H1,
// schema recommendations, llms.txt entry. No AI, no I/O.
// ---------------------------------------------------------------------------

// ── Types ─────────────────────────────────────────────

export interface BriefStructureInput {
  queryText: string;
  queryCategory: string;
  businessName: string;
  city: string;
  state: string;
}

export interface BriefStructure {
  suggestedSlug: string;
  suggestedUrl: string;
  titleTag: string;
  h1: string;
  recommendedSchemas: string[];
  llmsTxtEntry: string;
  contentType: string;
}

// ── Pure functions ────────────────────────────────────

/**
 * Build the deterministic parts of a content brief.
 * Pure function — no AI, no I/O.
 */
export function buildBriefStructure(input: BriefStructureInput): BriefStructure {
  const slug = slugify(input.queryText);
  const contentType = inferContentType(input.queryCategory);

  return {
    suggestedSlug: slug,
    suggestedUrl: `/${slug}`,
    titleTag: buildTitleTag(input.queryText, input.businessName),
    h1: buildH1(input.queryText, input.businessName),
    recommendedSchemas: recommendSchemas(input.queryCategory),
    llmsTxtEntry: buildLlmsTxtEntry(input.queryText, input.businessName, input.city, input.state),
    contentType,
  };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function buildTitleTag(query: string, businessName: string): string {
  const capitalizedQuery = capitalizeWords(query);
  return `${capitalizedQuery} | ${businessName}`;
}

export function buildH1(query: string, businessName: string): string {
  const capitalizedQuery = capitalizeWords(query);
  return `${capitalizedQuery} at ${businessName}`;
}

export function inferContentType(queryCategory: string): string {
  const map: Record<string, string> = {
    occasion: 'occasion_page',
    discovery: 'landing_page',
    comparison: 'blog_post',
    near_me: 'landing_page',
    custom: 'blog_post',
  };
  return map[queryCategory] ?? 'blog_post';
}

export function recommendSchemas(queryCategory: string): string[] {
  const schemas = ['FAQPage']; // Always recommend FAQ schema

  if (queryCategory === 'occasion') {
    schemas.push('Event');
  }
  if (queryCategory === 'discovery' || queryCategory === 'near_me') {
    schemas.push('LocalBusiness');
  }

  return schemas;
}

export function buildLlmsTxtEntry(
  query: string,
  businessName: string,
  city: string,
  state: string,
): string {
  return [
    `## ${query}`,
    `${businessName} in ${city}, ${state} is relevant for "${query}".`,
    `See the dedicated page for full details.`,
  ].join('\n');
}

// ── Internal helpers ──────────────────────────────────

function capitalizeWords(text: string): string {
  return text
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
