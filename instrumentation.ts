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
  // Guard 1: Only activate in the Node.js runtime (not the Edge runtime).
  // Server Components and Server Actions run in Node.js; this is where MSW
  // needs to intercept calls.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Guard 2: Only activate when explicitly opted-in via env var.
  // This prevents MSW from interfering with normal dev or production traffic.
  if (process.env.NEXT_PUBLIC_API_MOCKING !== 'enabled') return;

  // Dynamic import keeps MSW out of the production bundle entirely.
  // The import path resolves to src/mocks/node.ts via the tsconfig @/ alias.
  const { server } = await import('./src/mocks/node');

  // 'bypass' means unhandled requests (e.g. Supabase REST API, internal Next.js
  // fetch) pass through to the real network. Only the explicitly registered
  // handlers (OpenAI, Perplexity) are intercepted.
  server.listen({ onUnhandledRequest: 'bypass' });

  console.log('[MSW] Node.js server started — API mocking is ENABLED');
}
