// ---------------------------------------------------------------------------
// content-brief-assembly.test.ts — Unit tests for markdown assembly
//
// Sprint 86: 11 tests — assembleDraftContent with/without AI content.
//
// Run:
//   npx vitest run src/__tests__/unit/content-brief-assembly.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll } from 'vitest';
import { assembleDraftContent } from '@/app/dashboard/share-of-voice/brief-actions';
import { buildBriefStructure } from '@/lib/services/content-brief-builder.service';
import { MOCK_BRIEF_STRUCTURE_INPUT, MOCK_CONTENT_BRIEF } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

const structure = buildBriefStructure(MOCK_BRIEF_STRUCTURE_INPUT);

// ---------------------------------------------------------------------------
// Tests — with AI content
// ---------------------------------------------------------------------------

describe('assembleDraftContent', () => {
  describe('with AI content', () => {
    let result: string;

    beforeAll(async () => {
      result = await assembleDraftContent(structure, MOCK_CONTENT_BRIEF);
    });

    it('includes H1 from structure', () => {
      expect(result).toContain(`# ${structure.h1}`);
    });

    it('includes suggested URL', () => {
      expect(result).toContain(`**Suggested URL:** ${structure.suggestedUrl}`);
    });

    it('includes title tag', () => {
      expect(result).toContain(`**Title Tag:** ${structure.titleTag}`);
    });

    it('includes answer capsule when AI content provided', () => {
      expect(result).toContain('## Answer Capsule');
      expect(result).toContain(MOCK_CONTENT_BRIEF.answerCapsule);
    });

    it('includes meta description from AI content', () => {
      expect(result).toContain(`**Meta Description:** ${MOCK_CONTENT_BRIEF.metaDescription}`);
    });

    it('includes outline sections with headings and bullets', () => {
      for (const section of MOCK_CONTENT_BRIEF.outlineSections) {
        expect(result).toContain(`## ${section.heading}`);
        for (const bullet of section.bullets) {
          expect(result).toContain(`- ${bullet}`);
        }
      }
    });

    it('includes FAQ questions and answer hints', () => {
      expect(result).toContain('## Frequently Asked Questions');
      for (const faq of MOCK_CONTENT_BRIEF.faqQuestions) {
        expect(result).toContain(`### ${faq.question}`);
        expect(result).toContain(faq.answerHint);
      }
    });

    it('includes schema recommendations', () => {
      expect(result).toContain(`**Recommended Schema:** ${structure.recommendedSchemas.join(', ')}`);
    });

    it('includes llms.txt entry in code block', () => {
      expect(result).toContain('**llms.txt Entry:**');
      expect(result).toContain('```');
      expect(result).toContain(structure.llmsTxtEntry);
    });

    it('produces valid markdown output', () => {
      // Should start with a heading
      expect(result).toMatch(/^# /);
      // Should contain section separator
      expect(result).toContain('---');
    });
  });

  describe('without AI content (fallback)', () => {
    let result: string;

    beforeAll(async () => {
      result = await assembleDraftContent(structure, null);
    });

    it('includes placeholder when AI content is null', () => {
      expect(result).toContain('## Answer Capsule');
      expect(result).toContain('_[Write a 40-60 word direct answer');
      expect(result).toContain('## Details & Features');
      expect(result).toContain('_[Add content about your offerings');
      expect(result).toContain('## Why Choose Us');
      expect(result).toContain('## Frequently Asked Questions');
      expect(result).toContain('_[Add 3-5 FAQ questions');
    });
  });
});
