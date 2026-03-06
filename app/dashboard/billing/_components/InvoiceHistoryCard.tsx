'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, ExternalLink } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { getInvoiceHistory, type InvoiceItem } from '../actions';

export default function InvoiceHistoryCard() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInvoiceHistory()
      .then(setInvoices)
      .catch((err) => {
        Sentry.captureException(err);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-surface-dark p-6 animate-pulse">
        <div className="h-4 w-32 bg-white/5 rounded" />
      </div>
    );
  }

  if (invoices.length === 0) return null;

  return (
    <section
      className="rounded-2xl border border-white/5 bg-surface-dark p-6"
      data-testid="invoice-history"
    >
      <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-slate-400" aria-hidden="true" />
        Invoice History
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" role="table">
          <thead>
            <tr className="border-b border-white/5 text-left text-slate-400">
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4">Amount</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr
                key={inv.id}
                className="border-b border-white/5 text-slate-300"
              >
                <td className="py-2 pr-4 tabular-nums">
                  {new Date(inv.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td className="py-2 pr-4 tabular-nums">
                  ${((inv.amountDue ?? 0) / 100).toFixed(2)}
                </td>
                <td className="py-2 pr-4 capitalize">{inv.status}</td>
                <td className="py-2 text-right">
                  <span className="inline-flex items-center gap-2">
                    {inv.pdfUrl && (
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-white transition"
                        title="Download PDF"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {inv.hostedUrl && (
                      <a
                        href={inv.hostedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-white transition"
                        title="View invoice"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
