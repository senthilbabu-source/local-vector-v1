// ---------------------------------------------------------------------------
// HijackingAlertsSection — P8-FIX-37: Server component that fetches and
// renders hijacking alerts for the current org.
//
// Plan-gated to agency tier. Rendered at the bottom of the AI Mistakes page.
// AI_RULES §193.
// ---------------------------------------------------------------------------

import { createClient } from '@/lib/supabase/server';
import { Shield } from 'lucide-react';
import HijackingAlertCard, { type HijackingAlertRow } from './HijackingAlertCard';

export default async function HijackingAlertsSection() {
  const supabase = await createClient();

  const { data: alerts } = await supabase
    .from('hijacking_alerts')
    .select('id, engine, query_text, hijack_type, our_business, competitor_name, evidence_text, severity, status, detected_at, resolved_at')
    .order('detected_at', { ascending: false })
    .limit(50);

  const hijackAlerts = (alerts as HijackingAlertRow[] | null) ?? [];

  // Split into active vs resolved
  const activeAlerts = hijackAlerts.filter((a) => a.status !== 'resolved');
  const resolvedAlerts = hijackAlerts.filter((a) => a.status === 'resolved').slice(0, 5);

  return (
    <section className="space-y-4" data-testid="hijacking-alerts-section">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#94A3B8]">
          <Shield className="h-4 w-4" aria-hidden="true" />
          Competitor Hijacking Alerts
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">
          AI engines confusing your business with a competitor
        </p>
      </div>

      {hijackAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-dark px-6 py-10 text-center border border-white/5">
          <Shield className="mx-auto h-8 w-8 text-signal-green/60" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-[#94A3B8]">No competitor hijacking detected</p>
          <p className="mt-1 text-xs text-slate-400">
            We scan AI responses weekly. If a competitor starts appearing in results meant for your business, you&apos;ll see alerts here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active alerts */}
          {activeAlerts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground">
                Active ({activeAlerts.length})
              </h3>
              {activeAlerts.map((alert) => (
                <HijackingAlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}

          {/* Resolved alerts */}
          {resolvedAlerts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground">
                Recently Resolved ({resolvedAlerts.length})
              </h3>
              {resolvedAlerts.map((alert) => (
                <HijackingAlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
