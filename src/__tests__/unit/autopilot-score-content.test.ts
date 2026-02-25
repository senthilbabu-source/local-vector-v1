import { describe, it, expect } from 'vitest';
import { scoreContentHeuristic, type ScoreContext } from '@/lib/autopilot/score-content';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultCtx: ScoreContext = {
  businessName: 'Bella Napoli',
  city: 'Austin',
  categories: ['Italian Restaurant'],
};

function makeContent(opts: {
  opener?: string;
  wordCount?: number;
  includeName?: boolean;
  includeCity?: boolean;
  includeCategory?: boolean;
  includeCta?: boolean;
}): string {
  const parts: string[] = [];

  // Opener sentence
  if (opts.opener) {
    parts.push(opts.opener);
  } else if (opts.includeName !== false && opts.includeCity !== false) {
    parts.push(
      'Bella Napoli is Austin\'s premier Italian restaurant offering authentic Neapolitan cuisine.',
    );
  }

  // Pad to approximate word count
  const targetWords = opts.wordCount ?? 250;
  const currentWords = parts.join(' ').split(/\s+/).length;
  const filler =
    'Our chefs prepare fresh pasta daily using imported ingredients from Naples. ' +
    'The menu features classic dishes alongside modern interpretations. ';
  let text = parts.join(' ');

  while (text.split(/\s+/).length < targetWords) {
    text += ' ' + filler;
    if (opts.includeCategory !== false) {
      text += 'As an Italian restaurant, we pride ourselves on quality. ';
    }
  }

  if (opts.includeCta) {
    text += ' Call us today to reserve your table or visit us for dinner.';
  }

  return text.trim();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scoreContentHeuristic', () => {
  it('scores high for answer-first content with all keywords and CTA', () => {
    const content = makeContent({
      includeName: true,
      includeCity: true,
      includeCategory: true,
      includeCta: true,
      wordCount: 300,
    });
    const title = 'Best Italian Restaurant in Austin — Bella Napoli';
    const score = scoreContentHeuristic(content, title, defaultCtx);

    // Should score well across all dimensions
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it('scores low for generic welcome-page content', () => {
    const content = makeContent({
      opener: 'Welcome to our website! Check out our amazing deals.',
      includeName: false,
      includeCity: false,
      includeCategory: false,
      wordCount: 250,
    });
    const title = 'Home Page';
    const score = scoreContentHeuristic(content, title, defaultCtx);

    expect(score).toBeLessThan(40);
  });

  it('returns 0 for empty content', () => {
    expect(scoreContentHeuristic('', 'Title', defaultCtx)).toBe(0);
    expect(scoreContentHeuristic('  ', 'Title', defaultCtx)).toBe(0);
  });

  it('handles null city gracefully', () => {
    const ctx: ScoreContext = { businessName: 'Test Cafe', city: null, categories: ['Cafe'] };
    const content = 'Test Cafe offers the best coffee and pastries in town. ' +
      'Our baristas are trained professionals who care about quality. '.repeat(15);
    const score = scoreContentHeuristic(content, 'Test Cafe', ctx);

    // Should still produce a valid score even without city
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('handles null categories gracefully', () => {
    const ctx: ScoreContext = { businessName: 'Test Cafe', city: 'Denver', categories: null };
    const content = 'Test Cafe in Denver serves excellent coffee. '.repeat(10);
    const score = scoreContentHeuristic(content, 'Test Cafe Denver', ctx);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('rewards CTA phrases', () => {
    const base = makeContent({ wordCount: 250 });
    const withCta = base + ' Call us to reserve your table or book online today.';
    const withoutCta = base;

    const scoreCta = scoreContentHeuristic(withCta, 'Title', defaultCtx);
    const scoreNoCta = scoreContentHeuristic(withoutCta, 'Title', defaultCtx);

    expect(scoreCta).toBeGreaterThan(scoreNoCta);
  });

  it('gives title bonus for city and business name in title', () => {
    const content = makeContent({ wordCount: 250 });

    const goodTitle = 'Best Italian Restaurant in Austin — Bella Napoli';
    const badTitle = 'Page 1 of 47 — Updated February 2024';

    const scoreGood = scoreContentHeuristic(content, goodTitle, defaultCtx);
    const scoreBad = scoreContentHeuristic(content, badTitle, defaultCtx);

    expect(scoreGood).toBeGreaterThan(scoreBad);
  });

  it('penalizes very short content', () => {
    const short = 'Bella Napoli is great in Austin.';
    const score = scoreContentHeuristic(short, 'Title', defaultCtx);

    expect(score).toBeLessThan(50);
  });

  it('gives moderate score for long content over 600 words', () => {
    const longContent = makeContent({ wordCount: 700 });
    const idealContent = makeContent({ wordCount: 300 });

    const scoreLong = scoreContentHeuristic(longContent, 'Title', defaultCtx);
    const scoreIdeal = scoreContentHeuristic(idealContent, 'Title', defaultCtx);

    // Ideal length should score higher on the depth dimension
    expect(scoreIdeal).toBeGreaterThanOrEqual(scoreLong);
  });

  it('always returns an integer between 0 and 100', () => {
    const testCases = [
      { content: '', title: '', ctx: defaultCtx },
      { content: 'x', title: 'y', ctx: defaultCtx },
      { content: 'a '.repeat(1000), title: 'z'.repeat(200), ctx: defaultCtx },
      {
        content: makeContent({ wordCount: 300, includeCta: true }),
        title: 'Best Italian in Austin — Bella Napoli',
        ctx: defaultCtx,
      },
    ];

    for (const tc of testCases) {
      const score = scoreContentHeuristic(tc.content, tc.title, tc.ctx);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
