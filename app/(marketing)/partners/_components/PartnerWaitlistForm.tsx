'use client';

// ---------------------------------------------------------------------------
// Partner Waitlist Form — client component for email capture
// Stores to scan_leads table with source='partner_waitlist'.
// ---------------------------------------------------------------------------

import { useTransition, useState } from 'react';

export default function PartnerWaitlistForm() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = (formData.get('email') as string)?.trim();
    const company = (formData.get('company') as string)?.trim();

    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      setStatus('error');
      return;
    }

    startTransition(async () => {
      try {
        // Reuse captureLeadEmail server action pattern — store as partner lead
        const res = await fetch('/api/partner-waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, company }),
        });

        if (res.ok) {
          setStatus('success');
          form.reset();
        } else {
          setErrorMsg('Something went wrong. Please try again.');
          setStatus('error');
        }
      } catch {
        setErrorMsg('Network error. Please try again.');
        setStatus('error');
      }
    });
  }

  if (status === 'success') {
    return (
      <div
        style={{
          background: 'var(--m-green-light)',
          border: '1px solid var(--m-border-green)',
          borderRadius: 12,
          padding: '32px 24px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--m-green)',
            marginBottom: 8,
          }}
        >
          {'\u2713'} You&apos;re on the list!
        </p>
        <p
          style={{
            fontSize: 15,
            color: 'var(--m-text-secondary)',
            lineHeight: 1.6,
          }}
        >
          We&apos;ll reach out within 48 hours to discuss partnership options.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <input
          name="company"
          type="text"
          placeholder="Company name"
          style={{
            width: '100%',
            padding: '14px 16px',
            fontSize: 15,
            border: '1px solid var(--m-border-base)',
            borderRadius: 10,
            background: 'var(--m-bg-card)',
            color: 'var(--m-text-primary)',
            outline: 'none',
          }}
        />
        <input
          name="email"
          type="email"
          placeholder="Work email address"
          required
          style={{
            width: '100%',
            padding: '14px 16px',
            fontSize: 15,
            border: '1px solid var(--m-border-base)',
            borderRadius: 10,
            background: 'var(--m-bg-card)',
            color: 'var(--m-text-primary)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={isPending}
          className="m-btn-primary"
          style={{
            width: '100%',
            fontSize: 15,
            padding: '14px 24px',
            cursor: isPending ? 'wait' : 'pointer',
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? 'Submitting...' : 'Join Partner Waitlist \u2192'}
        </button>
      </div>

      {status === 'error' && (
        <p
          style={{
            marginTop: 12,
            fontSize: 14,
            color: 'var(--m-red)',
          }}
        >
          {errorMsg}
        </p>
      )}
    </form>
  );
}
