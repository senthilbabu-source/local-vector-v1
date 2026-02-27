import { http, HttpResponse, passthrough } from 'msw';

/**
 * MSW Handler Registry — LocalVector.ai
 *
 * Three layers of handlers, applied in order:
 *
 *  1. supabaseHandlers    — pass all local Supabase traffic through to the real
 *                           local instance (http://localhost:54321).
 *                           Required for integration tests (rls-isolation, auth-flow).
 *
 *  2. authApiHandlers     — pass our own Next.js /api/auth/* routes through.
 *                           In unit tests the route handler is called directly,
 *                           so these never fire; they exist for future E2E tests
 *                           that drive the app via fetch().
 *
 *  3. externalApiGuards   — BLOCK accidental calls to paid external APIs.
 *                           Any test that needs a real Perplexity / OpenAI response
 *                           must override with `server.use(http.post(...))` locally.
 *                           This makes unhandled API spend impossible.
 *
 * Usage in tests:
 *   import { server } from '@/__helpers__/setup';
 *   server.use(http.post('https://api.perplexity.ai/chat/completions', () =>
 *     HttpResponse.json(PERPLEXITY_RESPONSES.status_correct)
 *   ));
 */

// ---------------------------------------------------------------------------
// 1. Supabase local passthrough
//    Covers all Supabase sub-services: Auth, PostgREST, Storage, Realtime
// ---------------------------------------------------------------------------

export const supabaseHandlers = [
  http.all('http://localhost:54321/*', () => passthrough()),

  // Supabase Studio (optional — only needed if tests navigate the Studio UI)
  http.all('http://localhost:54323/*', () => passthrough()),
];

// ---------------------------------------------------------------------------
// 2. Our own Next.js API routes (passthrough in any fetch()-based tests)
// ---------------------------------------------------------------------------

export const authApiHandlers = [
  http.post('http://localhost:3000/api/auth/register', () => passthrough()),
  http.post('http://localhost:3000/api/auth/login', () => passthrough()),
  http.post('http://localhost:3000/api/auth/logout', () => passthrough()),
  http.get('http://localhost:3000/api/v1/auth/context', () => passthrough()),
];

// ---------------------------------------------------------------------------
// 3. External API guards — block all paid APIs by default
//    Override per-test with server.use(...) for specific scenarios
// ---------------------------------------------------------------------------

export const externalApiGuards = [
  http.all('https://api.perplexity.ai/*', () =>
    HttpResponse.json(
      {
        error:
          'Perplexity API is not mocked for this test. ' +
          'Add server.use(http.post("https://api.perplexity.ai/...", handler)) ' +
          'using a fixture from @/__fixtures__/mock-perplexity-responses.ts',
      },
      { status: 500 }
    )
  ),

  http.all('https://api.openai.com/*', () =>
    HttpResponse.json(
      {
        error:
          'OpenAI API is not mocked for this test. ' +
          'Add server.use(http.post("https://api.openai.com/...", handler)) ' +
          'using a fixture from @/__fixtures__/mock-openai-responses.ts',
      },
      { status: 500 }
    )
  ),

  http.all('https://maps.googleapis.com/*', () =>
    HttpResponse.json(
      {
        error:
          'Google Places API is not mocked for this test. ' +
          'Add server.use(http.get("https://maps.googleapis.com/...", handler)) ' +
          'to provide a fixture response.',
      },
      { status: 500 }
    )
  ),

  http.all('https://api.resend.com/*', () =>
    HttpResponse.json(
      { error: 'Resend API is not mocked for this test.' },
      { status: 500 }
    )
  ),

  http.all('https://oauth2.googleapis.com/*', () =>
    HttpResponse.json(
      { error: 'Google OAuth is not mocked for this test.' },
      { status: 500 }
    )
  ),

  http.all('https://places.googleapis.com/*', () =>
    HttpResponse.json(
      { error: 'Google Places API (New) is not mocked for this test.' },
      { status: 500 }
    )
  ),
];

// ---------------------------------------------------------------------------
// Default export — all handlers combined, used in setup.ts
// ---------------------------------------------------------------------------

export const handlers = [
  ...supabaseHandlers,
  ...authApiHandlers,
  ...externalApiGuards,
];
