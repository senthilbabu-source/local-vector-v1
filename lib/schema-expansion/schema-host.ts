// ---------------------------------------------------------------------------
// lib/schema-expansion/schema-host.ts — Schema Hosting Layer
//
// Sprint 106: Generates embeddable <script> snippets, validates JSON-LD,
// publishes schemas, and pings IndexNow.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { pingIndexNow } from '@/lib/indexnow';
import type { PageType, GeneratedSchema } from './types';

// ---------------------------------------------------------------------------
// Embed Snippet Generation
// ---------------------------------------------------------------------------

/**
 * Generate the embeddable HTML snippet — a copy-pasteable <script> block.
 */
export function generateEmbedSnippet(
  jsonLd: Record<string, unknown>[],
  pageType: PageType,
): string {
  const date = new Date().toISOString().split('T')[0];
  const comment = `<!-- LocalVector Schema — ${pageType} — Generated ${date} -->`;

  const scripts = jsonLd.map((schema) =>
    `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`
  ).join('\n');

  return `${comment}\n${scripts}`;
}

// ---------------------------------------------------------------------------
// Schema Validation
// ---------------------------------------------------------------------------

/**
 * Validate generated JSON-LD against Schema.org constraints before publishing.
 * Lightweight rule set — catches common errors.
 */
export function validateSchemaBeforePublish(
  jsonLd: Record<string, unknown>[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(jsonLd) || jsonLd.length === 0) {
    errors.push('JSON-LD array is empty');
    return { valid: false, errors };
  }

  for (const schema of jsonLd) {
    if (!schema['@type']) {
      errors.push('Missing @type on schema object');
      continue;
    }

    const type = schema['@type'] as string;

    // FAQPage must have non-empty mainEntity
    if (type === 'FAQPage') {
      const mainEntity = schema.mainEntity;
      if (!Array.isArray(mainEntity) || mainEntity.length === 0) {
        errors.push('FAQPage has empty mainEntity array');
      }
    }

    // Event must have a name
    if (type === 'Event') {
      if (!schema.name) {
        errors.push('Event schema missing name');
      }
    }

    // BlogPosting must have a headline
    if (type === 'BlogPosting') {
      if (!schema.headline) {
        errors.push('BlogPosting schema missing headline');
      }
    }

    // Service must have a name
    if (type === 'Service') {
      if (!schema.name) {
        errors.push('Service schema missing name');
      }
    }

    // URL validation for url fields
    if (schema.url && typeof schema.url === 'string') {
      try {
        new URL(schema.url);
      } catch (_e) {
        errors.push(`Invalid URL: ${schema.url}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

/**
 * Publish a schema — update status, generate embed snippet, ping IndexNow.
 *
 * @param updateRow  — Function to update the page_schemas row (injected to decouple from Supabase)
 * @param slug       — Location slug for public URL
 * @param pageType   — Page type for URL path
 * @param schema     — Generated schema data
 * @param clientUrl  — The client's page URL (for IndexNow ping)
 */
export async function publishSchema(
  updateRow: (data: {
    status: string;
    published_at: string;
    embed_snippet: string;
    public_url: string;
  }) => Promise<void>,
  slug: string,
  pageType: PageType,
  schema: GeneratedSchema,
  clientUrl: string,
): Promise<{ ok: boolean; public_url?: string; error?: string }> {
  try {
    // Validate before publishing
    const validation = validateSchemaBeforePublish(schema.json_ld);
    if (!validation.valid) {
      return { ok: false, error: `Validation failed: ${validation.errors.join(', ')}` };
    }

    const embedSnippet = generateEmbedSnippet(schema.json_ld, pageType);
    const publicUrl = `https://schema.localvector.ai/${slug}/${pageType}/embed.html`;

    await updateRow({
      status: 'published',
      published_at: new Date().toISOString(),
      embed_snippet: embedSnippet,
      public_url: publicUrl,
    });

    // Fire-and-forget IndexNow ping
    pingIndexNow([clientUrl]).catch((err) => {
      Sentry.captureException(err, { tags: { component: 'schema-host', sprint: '106' } });
    });

    return { ok: true, public_url: publicUrl };
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'schema-host', sprint: '106' } });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
