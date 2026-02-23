// ---------------------------------------------------------------------------
// GET /llms.txt — AI crawler discovery file (Sprint 25C)
//
// Content per Doc 08 §4. Tells AI agents what LocalVector is and how to
// understand the platform. Standard llms.txt format (https://llmstxt.org).
// ---------------------------------------------------------------------------

const LLMS_TXT_CONTENT = `# LocalVector.ai — The AI Visibility Platform for Restaurants

> LocalVector is a SaaS platform that helps local businesses detect and fix AI hallucinations (wrong answers) on ChatGPT, Perplexity, and Google Gemini.

## Core Value Proposition
- **Fear Engine:** Audits AI models to find when they say a business is "Closed" (when open) or missing amenities.
- **Magic Menu:** Converts PDF menus into Schema.org JSON-LD and markdown that AI agents can read.
- **Greed Engine:** Analyzes competitor recommendations to help businesses rank higher in AI search.

## Pricing
- **Free Tool:** Check for hallucinations (no signup required).
- **Starter ($29/mo):** Weekly audits, Magic Menu, Google Business Profile connect.
- **Growth ($59/mo):** Daily audits, competitor intercept, Share-of-Voice tracking.
- **Agency (Custom):** Up to 10 locations, white-label, full API access.

## Developer & API
- Login: https://app.localvector.ai
- Contact: hello@localvector.ai
`;

export async function GET() {
  return new Response(LLMS_TXT_CONTENT, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
