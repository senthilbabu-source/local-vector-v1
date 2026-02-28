// Next.js Instrumentation Hook
//
// This file is loaded once by Next.js during server startup (not on every
// request). It activates MSW for Node.js only when the environment variable
// NEXT_PUBLIC_API_MOCKING=enabled is set.
//
// Usage (Phase 18 integration testing):
//   NEXT_PUBLIC_API_MOCKING=enabled npm run dev
//
// When active, all outgoing fetch calls from Server Components, Server Actions,
// and Route Handlers are intercepted by the MSW handlers in src/mocks/handlers.ts
// before reaching real external APIs (OpenAI, Perplexity, etc.).
//
// In normal dev and production, this file does nothing — the env var is not set.
//
// Next.js docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Sentry server-side initialisation (runs once on server startup).
    // Dynamic import keeps the config tree-shakeable.
    await import('./sentry.server.config');

    // MSW: Only activate when explicitly opted-in via env var.
    // This prevents MSW from interfering with normal dev or production traffic.
    if (process.env.NEXT_PUBLIC_API_MOCKING === 'enabled') {
      // Dynamic import keeps MSW out of the production bundle entirely.
      const { server } = await import('./src/mocks/node');

      // 'bypass' means unhandled requests (e.g. Supabase REST API, internal
      // Next.js fetch) pass through to the real network.
      server.listen({ onUnhandledRequest: 'bypass' });

      console.log('[MSW] Node.js server started — API mocking is ENABLED');
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Sentry edge runtime initialisation.
    await import('./sentry.edge.config');
  }
}
