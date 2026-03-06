import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { getCachedBenchmarks } from '@/lib/analytics/correction-benchmark.cache';
import AdminNav from '../_components/AdminNav';

export const metadata = { title: 'Correction Benchmarks | Admin' };

export default async function CorrectionBenchmarksPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());
  if (!adminEmails.includes(ctx.email.toLowerCase())) {
    redirect('/dashboard');
  }

  const benchmarks = await getCachedBenchmarks();
  const entries = benchmarks ? Object.entries(benchmarks) : [];

  return (
    <div className="min-h-screen bg-surface-dark">
      <AdminNav email={ctx.email} />
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Correction Benchmarks</h1>
          <p className="mt-1 text-sm text-slate-400">
            Anonymized correction timing data across all orgs. Updated weekly (Saturday 5 AM UTC).
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-slate-400">
              No benchmark data yet. Cron runs weekly — check back after Saturday.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="correction-benchmarks-table">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="pb-3 pr-4 font-medium">Model + Category</th>
                  <th className="pb-3 pr-4 font-medium text-right">Avg Days</th>
                  <th className="pb-3 pr-4 font-medium text-right">Median Days</th>
                  <th className="pb-3 pr-4 font-medium text-right">P75 Days</th>
                  <th className="pb-3 pr-4 font-medium text-right">Recurrence</th>
                  <th className="pb-3 font-medium text-right">Sample</th>
                </tr>
              </thead>
              <tbody>
                {entries
                  .sort(([, a], [, b]) => b.sample_size - a.sample_size)
                  .map(([key, entry]) => (
                    <tr key={key} className="border-b border-white/5">
                      <td className="py-3 pr-4 text-white font-mono text-xs">{key}</td>
                      <td className="py-3 pr-4 text-right text-slate-300">{entry.avg_days_to_fix}</td>
                      <td className="py-3 pr-4 text-right text-slate-300">{entry.median_days_to_fix}</td>
                      <td className="py-3 pr-4 text-right text-slate-300">{entry.p75_days_to_fix}</td>
                      <td className="py-3 pr-4 text-right text-slate-300">
                        {Math.round(entry.recurrence_rate * 100)}%
                      </td>
                      <td className="py-3 text-right text-slate-300">{entry.sample_size}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
