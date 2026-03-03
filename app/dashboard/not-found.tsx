// ---------------------------------------------------------------------------
// app/dashboard/not-found.tsx — P5-FIX-23: 404 for unknown dashboard routes
// ---------------------------------------------------------------------------

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function DashboardNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
          <AlertTriangle className="h-6 w-6 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-white">Page not found</h2>
        <p className="text-sm text-slate-400">
          This dashboard page doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-4 rounded-xl bg-electric-indigo px-6 py-2.5 text-sm font-semibold text-white hover:bg-electric-indigo/90 transition"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
