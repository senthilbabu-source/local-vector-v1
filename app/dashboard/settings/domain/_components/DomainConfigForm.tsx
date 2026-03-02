'use client';

/**
 * DomainConfigForm — Sprint 114
 *
 * Handles custom domain input, save, verify, and remove actions.
 */

import { useState } from 'react';
import { Globe, Trash2, ShieldCheck, Loader2 } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import type { OrgDomain, DnsInstructions, VerificationStatus as VerificationStatusType } from '@/lib/whitelabel/types';
import DnsInstructionsComponent from './DnsInstructions';
import VerificationStatus from './VerificationStatus';
import { SUBDOMAIN_BASE } from '@/lib/whitelabel/types';

interface DomainConfigFormProps {
  initialCustomDomain: OrgDomain | null;
}

export default function DomainConfigForm({ initialCustomDomain }: DomainConfigFormProps) {
  const [domainValue, setDomainValue] = useState(initialCustomDomain?.domain_value ?? '');
  const [customDomain, setCustomDomain] = useState<OrgDomain | null>(initialCustomDomain);
  const [dnsInstructions, setDnsInstructions] = useState<DnsInstructions | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatusType>(
    initialCustomDomain?.verification_status ?? 'unverified',
  );
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Save domain ───────────────────────────────────────────────────────────

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/whitelabel/domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_domain: domainValue.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        const errorMap: Record<string, string> = {
          invalid_domain_format: 'Please enter a valid domain (e.g. app.yourbrand.com).',
          localvector_domain_not_allowed: `You cannot use a ${SUBDOMAIN_BASE} subdomain as a custom domain.`,
          domain_taken: 'This domain is already registered by another organization.',
          not_owner: 'Only the organization owner can configure custom domains.',
          plan_upgrade_required: 'Custom domains are available on the Agency plan.',
        };
        setError(errorMap[data.error] ?? 'An error occurred. Please try again.');
        return;
      }

      setCustomDomain(data.domain);
      setDnsInstructions(data.dns_instructions);
      setVerificationStatus(data.domain.verification_status);
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'DomainConfigForm', sprint: '114' } });
      setError('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Verify domain ─────────────────────────────────────────────────────────

  async function handleVerify() {
    setError(null);
    setVerifying(true);
    setVerificationStatus('pending');
    try {
      const res = await fetch('/api/whitelabel/domain/verify', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError('Verification failed. Please try again.');
        setVerificationStatus('failed');
        return;
      }

      setVerificationStatus(data.status);
      if (data.status === 'failed') {
        setError('DNS record not found. Check your settings and try again.');
      }
      if (data.status === 'verified') {
        setDnsInstructions(null); // hide instructions after verification
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'DomainConfigForm', sprint: '114' } });
      setError('Verification failed. Please try again.');
      setVerificationStatus('failed');
    } finally {
      setVerifying(false);
    }
  }

  // ── Remove domain ─────────────────────────────────────────────────────────

  async function handleRemove() {
    if (!window.confirm('Remove your custom domain? The subdomain will continue to work.')) {
      return;
    }

    setError(null);
    try {
      const res = await fetch('/api/whitelabel/domain', { method: 'DELETE' });
      if (res.ok) {
        setDomainValue('');
        setCustomDomain(null);
        setDnsInstructions(null);
        setVerificationStatus('unverified');
      } else {
        setError('Failed to remove domain. Please try again.');
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'DomainConfigForm', sprint: '114' } });
      setError('Failed to remove domain. Please try again.');
    }
  }

  const hasCustomDomain = !!customDomain;
  const isVerified = verificationStatus === 'verified';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-electric-indigo" />
        <h3 className="text-sm font-semibold text-white">Custom Domain (Optional)</h3>
      </div>

      {/* Domain input + actions */}
      <div className="flex gap-2">
        <input
          data-testid="custom-domain-input"
          type="text"
          value={domainValue}
          onChange={(e) => setDomainValue(e.target.value)}
          placeholder="app.yourbrand.com"
          className="flex-1 rounded-lg border border-white/10 bg-deep-navy/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-electric-indigo/50 focus:outline-none"
        />
        <button
          data-testid="save-domain-btn"
          onClick={handleSave}
          disabled={saving || !domainValue.trim()}
          className="rounded-lg bg-electric-indigo px-4 py-2 text-sm font-medium text-white transition hover:bg-electric-indigo/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-alert-crimson">{error}</p>
      )}

      {/* Verification status + actions (shown when custom domain exists) */}
      {hasCustomDomain && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Status:</span>
          <VerificationStatus status={verificationStatus} />

          {!isVerified && (
            <button
              data-testid="verify-domain-btn"
              onClick={handleVerify}
              disabled={verifying}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-white/20 hover:text-white disabled:opacity-60"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Checking DNS...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verify Now
                </>
              )}
            </button>
          )}

          <button
            data-testid="remove-domain-btn"
            onClick={handleRemove}
            className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-alert-crimson/30 hover:text-alert-crimson"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      )}

      {/* DNS instructions (shown after save, hidden after verification) */}
      {dnsInstructions && !isVerified && (
        <DnsInstructionsComponent
          cnameValue={dnsInstructions.cname_record.value}
          txtValue={dnsInstructions.txt_record.value}
          customDomain={dnsInstructions.cname_record.name}
        />
      )}
    </div>
  );
}
