import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Creates a Supabase client scoped for use inside Next.js Middleware.
 *
 * Unlike the server client (which uses `next/headers`), this reads cookies from
 * the incoming `NextRequest` and writes refreshed tokens onto both the request
 * object and the outgoing `NextResponse`. This double-write is what ensures the
 * browser actually receives the new session cookie after a token refresh.
 *
 * Returns both the client and the (potentially re-built) response object so the
 * middleware can always return `response` rather than `NextResponse.next()`.
 */
export function createMiddlewareClient(request: NextRequest) {
  // Start with a basic pass-through; the setAll hook may replace it.
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write the refreshed tokens onto the request so downstream route
          // handlers and server components see the updated session.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Rebuild the response with the updated request, then stamp each
          // refreshed cookie onto it so the browser stores the new tokens.
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, response };
}
