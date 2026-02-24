// ---------------------------------------------------------------------------
// /privacy — Privacy Policy (Sprint 25B)
//
// Standard SaaS boilerplate. Review with legal counsel before launch.
// Static Server Component — no auth required.
// ---------------------------------------------------------------------------

export default function PrivacyPage() {
  const effectiveDate = 'February 23, 2026';

  return (
    <main className="min-h-screen bg-midnight-slate text-slate-300">

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-10 border-b border-white/5 bg-midnight-slate/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <a href="/" className="text-lg font-bold text-signal-green tracking-tight hover:opacity-80 transition">
            LocalVector
          </a>
        </div>
      </nav>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <article className="mx-auto max-w-3xl px-6 py-12 space-y-8">

        {/* Header */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">
            ⚠️ Please review with your legal counsel before launch.
          </p>
          <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-500">Effective date: {effectiveDate}</p>
        </div>

        <ProseSection title="1. Introduction">
          LocalVector.ai (&ldquo;LocalVector&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;)
          operates the LocalVector.ai platform. This Privacy Policy explains how we collect, use, disclose, and
          safeguard your information when you use our service. By accessing or using LocalVector, you agree to
          the terms of this policy.
        </ProseSection>

        <ProseSection title="2. Information We Collect">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account data:</strong> Name, email address, and password when you register.</li>
            <li><strong>Billing data:</strong> Payment method details processed and stored by Stripe. We do not store full card numbers.</li>
            <li><strong>Business data:</strong> Location details, menu information, and other business entity data you enter into the platform.</li>
            <li><strong>Usage data:</strong> Log data including IP addresses, browser type, pages visited, and timestamps.</li>
            <li><strong>AI scan results:</strong> Results of hallucination scans and competitive analysis performed on your behalf.</li>
          </ul>
        </ProseSection>

        <ProseSection title="3. How We Use Your Information">
          <ul className="list-disc pl-5 space-y-1">
            <li>To provide, operate, and maintain the LocalVector service.</li>
            <li>To process payments and send billing-related communications.</li>
            <li>To run AI hallucination scans and competitive analysis on your behalf.</li>
            <li>To send transactional emails (alerts, scan reports) and service updates.</li>
            <li>To improve our platform through aggregated, anonymized analytics.</li>
            <li>To comply with legal obligations.</li>
          </ul>
        </ProseSection>

        <ProseSection title="4. Third-Party Service Providers">
          We share data with the following third-party providers to operate the service. Each provider processes
          data in accordance with their own privacy policies.
          <ul className="list-disc pl-5 space-y-1 mt-3">
            <li><strong>Supabase</strong> — Database, authentication, and file storage.</li>
            <li><strong>Stripe</strong> — Payment processing and subscription management.</li>
            <li><strong>OpenAI</strong> — AI hallucination detection and analysis (business data queries only).</li>
            <li><strong>Perplexity</strong> — AI search queries for competitive and hallucination analysis.</li>
            <li><strong>Resend</strong> — Transactional email delivery (alerts, scan reports).</li>
          </ul>
          We do not sell your personal data to third parties.
        </ProseSection>

        <ProseSection title="5. Data Retention">
          We retain your account and business data for as long as your account is active or as needed to provide
          the service. AI scan results are retained for 24 months. You may request deletion of your account and
          associated data at any time by emailing{' '}
          <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
            hello@localvector.ai
          </a>.
          We will process deletion requests within 30 days.
        </ProseSection>

        <ProseSection title="6. Your Rights">
          Depending on your jurisdiction, you may have the right to access, correct, or delete personal data
          we hold about you, to object to processing, or to request data portability. To exercise these rights,
          contact us at{' '}
          <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
            hello@localvector.ai
          </a>.
        </ProseSection>

        <ProseSection title="7. Cookies">
          LocalVector uses strictly necessary session cookies to authenticate users. We do not use third-party
          tracking or advertising cookies.
        </ProseSection>

        <ProseSection title="8. Security">
          We implement industry-standard security measures including encryption in transit (TLS), row-level
          security in our database, and regular security reviews. No transmission over the Internet is 100%
          secure; we cannot guarantee absolute security.
        </ProseSection>

        <ProseSection title="9. Changes to This Policy">
          We may update this Privacy Policy periodically. We will notify you of material changes by email or
          by posting a notice in the application. Continued use of the service after changes constitutes
          acceptance of the updated policy.
        </ProseSection>

        <ProseSection title="10. Contact">
          For privacy questions or requests, contact us at{' '}
          <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
            hello@localvector.ai
          </a>.
        </ProseSection>

      </article>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <LegalFooter />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function ProseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="text-sm text-slate-400 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function LegalFooter() {
  return (
    <footer className="border-t border-white/5 py-8">
      <div className="mx-auto max-w-3xl px-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <a href="/privacy" className="text-sm text-slate-500 hover:text-slate-300 transition">Privacy Policy</a>
        <span className="text-slate-700">·</span>
        <a href="/terms" className="text-sm text-slate-500 hover:text-slate-300 transition">Terms of Service</a>
        <span className="text-slate-700">·</span>
        <a href="mailto:hello@localvector.ai" className="text-sm text-slate-500 hover:text-slate-300 transition">
          hello@localvector.ai
        </a>
      </div>
    </footer>
  );
}
