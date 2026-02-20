import { config } from 'dotenv';
import { beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './msw/handlers';

// Load test environment variables before any test code runs.
// Must happen before Supabase clients are constructed anywhere in the test suite.
config({ path: '.env.test' });

/**
 * MSW node server — intercepts all outbound HTTP calls during tests.
 *
 * Default handlers (see src/__helpers__/msw/handlers.ts):
 *   - supabaseHandlers    → passthrough to local Supabase (integration tests)
 *   - authApiHandlers     → passthrough to Next.js dev server (E2E tests)
 *   - externalApiGuards   → block Perplexity / OpenAI / Google / Resend by default
 *
 * To mock an external API in a single test:
 *   server.use(http.post('https://api.perplexity.ai/...', () => HttpResponse.json(fixture)))
 *
 * The handler is automatically reset after each test via afterEach → resetHandlers().
 *
 * Future phase handlers:
 *   Phase 1: import { fearEngineHandlers } from './msw/fear-engine';
 *   Phase 2: import { magicMenuHandlers }  from './msw/magic-menu';
 */
export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
