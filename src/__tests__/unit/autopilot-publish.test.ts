import { describe, it, expect, vi } from 'vitest';
import type { ContentDraftRow, AutopilotLocationContext } from '@/lib/types/autopilot';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function makeDraft(overrides?: Partial<ContentDraftRow>): ContentDraftRow {
  return {
    id: 'draft-uuid-001',
    org_id: 'org-uuid-001',
    location_id: 'loc-uuid-001',
    trigger_type: 'first_mover',
    trigger_id: 'trigger-uuid-001',
    draft_title: 'Best Italian Restaurant in Austin',
    draft_content:
      'Bella Napoli is Austin\'s premier Italian restaurant.\n\n' +
      'Q: What makes Bella Napoli special?\n' +
      'A: Our authentic Neapolitan cuisine uses imported ingredients from Naples.\n\n' +
      'Q: Where is Bella Napoli located?\n' +
      'A: We are located at 123 Main St in downtown Austin, TX.\n\n' +
      'Visit us today to experience the best Italian food in Austin. Call to reserve.',
    target_prompt: 'best italian restaurant in austin',
    content_type: 'faq_page',
    aeo_score: 75,
    status: 'approved',
    human_approved: true,
    published_url: null,
    published_at: null,
    approved_at: '2026-02-25T00:00:00Z',
    created_at: '2026-02-24T00:00:00Z',
    updated_at: '2026-02-25T00:00:00Z',
    ...overrides,
  };
}

function makeLocation(): AutopilotLocationContext {
  return {
    business_name: 'Bella Napoli',
    city: 'Austin',
    state: 'TX',
    categories: ['Italian Restaurant'],
    amenities: null,
    phone: '512-555-1234',
    website_url: 'https://bellanapoli.com',
    address_line1: '123 Main St',
    google_location_name: 'accounts/123/locations/456',
  };
}

// ---------------------------------------------------------------------------
// publish-download tests
// ---------------------------------------------------------------------------

import {
  publishAsDownload,
  buildLocalBusinessSchema,
  buildFaqSchemaFromContent,
} from '@/lib/autopilot/publish-download';

describe('publishAsDownload', () => {
  it('generates valid HTML with title and content', async () => {
    const draft = makeDraft();
    const location = makeLocation();
    const result = await publishAsDownload(draft, location);

    // Decode base64
    const html = Buffer.from(result.downloadPayload!, 'base64').toString('utf-8');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Best Italian Restaurant in Austin</title>');
    expect(html).toContain('<h1>Best Italian Restaurant in Austin</h1>');
    expect(html).toContain('Bella Napoli');
  });

  it('includes LocalBusiness JSON-LD schema', async () => {
    const draft = makeDraft();
    const location = makeLocation();
    const result = await publishAsDownload(draft, location);

    const html = Buffer.from(result.downloadPayload!, 'base64').toString('utf-8');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type": "LocalBusiness"');
    expect(html).toContain('Bella Napoli');
  });

  it('includes FAQPage JSON-LD for faq_page content type', async () => {
    const draft = makeDraft({ content_type: 'faq_page' });
    const location = makeLocation();
    const result = await publishAsDownload(draft, location);

    const html = Buffer.from(result.downloadPayload!, 'base64').toString('utf-8');
    expect(html).toContain('"@type": "FAQPage"');
    expect(html).toContain('"@type": "Question"');
  });

  it('omits FAQPage JSON-LD for non-faq content types', async () => {
    const draft = makeDraft({ content_type: 'blog_post' });
    const location = makeLocation();
    const result = await publishAsDownload(draft, location);

    const html = Buffer.from(result.downloadPayload!, 'base64').toString('utf-8');
    expect(html).not.toContain('"@type": "FAQPage"');
  });

  it('returns base64-encoded payload', async () => {
    const draft = makeDraft();
    const location = makeLocation();
    const result = await publishAsDownload(draft, location);

    expect(result.downloadPayload).toBeTruthy();
    // Verify it's valid base64
    const decoded = Buffer.from(result.downloadPayload!, 'base64').toString('utf-8');
    expect(decoded).toContain('<!DOCTYPE html>');
  });

  it('has meta description truncated to 160 chars', async () => {
    const longContent = 'A'.repeat(300);
    const draft = makeDraft({ draft_content: longContent });
    const location = makeLocation();
    const result = await publishAsDownload(draft, location);

    const html = Buffer.from(result.downloadPayload!, 'base64').toString('utf-8');
    const descMatch = html.match(/name="description" content="([^"]*)"/);
    expect(descMatch).toBeTruthy();
    expect(descMatch![1].length).toBeLessThanOrEqual(160);
  });

  it('sets status to published', async () => {
    const draft = makeDraft();
    const location = makeLocation();
    const result = await publishAsDownload(draft, location);

    expect(result.status).toBe('published');
    expect(result.publishedUrl).toBeNull();
  });
});

describe('buildLocalBusinessSchema', () => {
  it('includes name, address, phone from location', () => {
    const location = makeLocation();
    const schema = buildLocalBusinessSchema(location) as unknown as Record<string, unknown>;

    expect(schema['@type']).toBe('LocalBusiness');
    expect(schema.name).toBe('Bella Napoli');
    expect(schema.telephone).toBe('512-555-1234');
  });

  it('handles null fields gracefully', () => {
    const location: AutopilotLocationContext = {
      business_name: 'Test Biz',
      city: null,
      state: null,
      categories: null,
      amenities: null,
      phone: null,
      website_url: null,
      address_line1: null,
      google_location_name: null,
    };
    const schema = buildLocalBusinessSchema(location) as unknown as Record<string, unknown>;

    expect(schema.name).toBe('Test Biz');
    expect(schema.telephone).toBeUndefined();
    expect(schema.address).toBeUndefined();
  });
});

describe('buildFaqSchemaFromContent', () => {
  it('extracts Q&A pairs', () => {
    const content = 'Q: What is Bella Napoli?\nA: A great Italian restaurant.\n\nQ: Where is it?\nA: In Austin.';
    const schema = buildFaqSchemaFromContent(content) as unknown as Record<string, unknown>;

    expect(schema).not.toBeNull();
    expect(schema['@type']).toBe('FAQPage');
    const entities = schema.mainEntity as Array<{ name: string }>;
    expect(entities).toHaveLength(2);
    expect(entities[0].name).toBe('What is Bella Napoli?');
  });

  it('returns null when no Q&A pairs found', () => {
    const content = 'This is just a regular paragraph with no questions.';
    const schema = buildFaqSchemaFromContent(content);
    expect(schema).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// publish-gbp tests (truncation utility)
// ---------------------------------------------------------------------------

import { truncateAtSentence, GBP_MAX_CHARS } from '@/lib/autopilot/publish-gbp';

describe('truncateAtSentence', () => {
  it('returns original text when under limit', () => {
    const text = 'Short text.';
    expect(truncateAtSentence(text, 100)).toBe('Short text.');
  });

  it('truncates at sentence boundary', () => {
    const text = 'First sentence. Second sentence. Third sentence is very long and goes beyond.';
    // 'First sentence. Second sentence.' is 32 chars, fits in 35
    const result = truncateAtSentence(text, 35);

    expect(result).toMatch(/[.!?]$/);
    expect(result).toBe('First sentence. Second sentence.');
  });

  it('truncates at word boundary when no sentence boundary found', () => {
    const text = 'A very long sentence without any punctuation marks that keeps going and going forever';
    const result = truncateAtSentence(text, 50);

    expect(result).toContain('...');
    expect(result.length).toBeLessThanOrEqual(53); // 50 + ...
  });

  it('handles text with no spaces', () => {
    const text = 'x'.repeat(100);
    const result = truncateAtSentence(text, 50);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('has GBP_MAX_CHARS set to 1500', () => {
    expect(GBP_MAX_CHARS).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// publish-wordpress tests
// ---------------------------------------------------------------------------

import { contentToWPBlocks } from '@/lib/autopilot/publish-wordpress';

describe('contentToWPBlocks', () => {
  it('wraps paragraphs in wp:paragraph blocks', () => {
    const content = 'First paragraph.\n\nSecond paragraph.';
    const result = contentToWPBlocks(content);

    expect(result).toContain('<!-- wp:paragraph -->');
    expect(result).toContain('<!-- /wp:paragraph -->');
    expect(result).toContain('<p>First paragraph.</p>');
    expect(result).toContain('<p>Second paragraph.</p>');
  });

  it('handles empty content', () => {
    const result = contentToWPBlocks('');
    expect(result).toBe('');
  });

  it('filters out empty paragraphs', () => {
    const content = 'First.\n\n\n\n\nSecond.';
    const result = contentToWPBlocks(content);

    const blockCount = (result.match(/<!-- wp:paragraph -->/g) || []).length;
    expect(blockCount).toBe(2);
  });
});
