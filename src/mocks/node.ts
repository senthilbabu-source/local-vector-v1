// MSW Node.js Server — Server-side network interception
//
// Used in Next.js App Router server context (Server Components, Server Actions,
// Route Handlers) to intercept outgoing fetch calls before they reach real APIs.
//
// Imported by instrumentation.ts only when NEXT_PUBLIC_API_MOCKING=enabled.
// Never imported in production or standard E2E runs.
//
// MSW v2 Node.js setup docs:
// https://mswjs.io/docs/integrations/node

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * The MSW server instance for Node.js environments.
 * Call server.listen() to activate interception.
 * Call server.close() to restore native fetch.
 */
export const server = setupServer(...handlers);
