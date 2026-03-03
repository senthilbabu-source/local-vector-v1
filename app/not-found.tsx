// ---------------------------------------------------------------------------
// app/not-found.tsx — P5-FIX-23: Global 404 page
// ---------------------------------------------------------------------------

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-6xl font-bold text-slate-700">404</h1>
        <h2 className="text-xl font-semibold text-white">Page not found</h2>
        <p className="text-sm text-slate-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Link
            href="/"
            className="rounded-xl bg-electric-indigo px-6 py-2.5 text-sm font-semibold text-white hover:bg-electric-indigo/90 transition"
          >
            Go home
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-700 px-6 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
