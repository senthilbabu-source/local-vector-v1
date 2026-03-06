// ---------------------------------------------------------------------------
// /privacy — Privacy Policy
// Final draft — March 5, 2026. Review with legal counsel before public launch.
// Static Server Component — no auth required.
// ---------------------------------------------------------------------------

export default function PrivacyPage() {
  const effectiveDate = 'March 5, 2026';

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
          <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-400">Effective date: {effectiveDate}</p>
          <p className="mt-4 text-sm text-slate-400 leading-relaxed">
            LocalVector, Inc. (&ldquo;LocalVector&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
            &ldquo;our&rdquo;) is the data controller for personal data collected through the
            LocalVector.ai platform. This Privacy Policy explains what information we collect, how
            we use and share it, how long we keep it, and your rights with respect to it. By using
            the Service, you agree to the practices described in this policy.
          </p>
        </div>

        {/* ── 1. Information We Collect ──────────────────────────────────── */}
        <ProseSection title="1. Information We Collect">
          <SubSection title="1.1 Account Information">
            When you register, we collect your name, email address, and password (stored as a
            cryptographic hash). If you register via Google OAuth, we receive your name, email
            address, and Google account identifier from Google.
          </SubSection>
          <SubSection title="1.2 Business Information">
            Information you enter about your business, including business name, address, phone number,
            website URL, hours of operation, menu items, pricing, cuisine type, and other business
            attributes. This is the core operational data of the Service.
          </SubSection>
          <SubSection title="1.3 Payment Information">
            Payment details are collected and processed by Stripe. We receive and store only a payment
            method summary (card brand, last four digits, expiration), your billing address, and
            Stripe-generated customer and subscription identifiers. We do not store full card numbers,
            CVV codes, or bank account details.
          </SubSection>
          <SubSection title="1.4 Usage and Technical Data">
            We automatically collect information about how you use the Service, including: IP address,
            browser type and version, operating system, device identifiers, pages visited, features
            used, timestamps, session duration, and referring URLs. This data is collected via server
            logs and error monitoring tools.
          </SubSection>
          <SubSection title="1.5 Google Business Profile Data">
            If you connect your Google Business Profile, we receive and store data from Google&apos;s
            My Business API, including your GBP location details, review data, access tokens, and
            refresh tokens (stored encrypted). We use this data only to provide the integrations you
            have authorized.
          </SubSection>
          <SubSection title="1.6 AI Scan and Analysis Data">
            Results of hallucination scans, share-of-voice evaluations, competitive intelligence
            queries, and AI-generated content produced on your behalf. This includes the AI platform
            responses we retrieve when scanning for mentions of your business.
          </SubSection>
          <SubSection title="1.7 Communications">
            Records of emails and support messages you send to us, including the content of those
            communications and the metadata associated with them.
          </SubSection>
          <SubSection title="1.8 Error and Diagnostic Data">
            When the Service encounters an error, our error monitoring service (Sentry) may collect
            stack traces, browser environment data, and the user and session identifiers associated
            with the session in which the error occurred. This data is used solely for diagnosing
            and fixing software defects.
          </SubSection>
        </ProseSection>

        {/* ── 2. How We Use Your Information ────────────────────────────── */}
        <ProseSection title="2. How We Use Your Information">
          We use the information we collect to:
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Provide, operate, and maintain the Service, including running AI hallucination scans, share-of-voice evaluations, and content distribution functions on your behalf.</li>
            <li>Process payments, manage your subscription, and send billing-related communications.</li>
            <li>Authenticate you and maintain the security of your account.</li>
            <li>Send transactional communications: scan alerts, weekly digest emails, overage notifications, and service status updates.</li>
            <li>Provide customer support and respond to your inquiries.</li>
            <li>Detect, investigate, and prevent fraudulent, abusive, or illegal activity.</li>
            <li>Monitor and improve the performance, reliability, and security of the Service.</li>
            <li>Produce aggregated, de-identified industry benchmarks and analytics (see Section 7).</li>
            <li>Comply with our legal obligations, including responding to lawful government requests.</li>
            <li>Enforce our Terms of Service and protect the rights, property, or safety of LocalVector, our users, or others.</li>
          </ul>
          We do not use your business data or personal information to train, fine-tune, or improve AI
          models operated by LocalVector or any third party. See Section 6 for our full AI processing
          disclosure.
        </ProseSection>

        {/* ── 3. Legal Basis for Processing (GDPR) ──────────────────────── */}
        <ProseSection title="3. Legal Basis for Processing (GDPR)">
          If you are located in the European Economic Area, the United Kingdom, or Switzerland, we
          process your personal data under the following legal bases:
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong className="text-slate-300">Contract performance:</strong> Processing necessary to provide the Service you have subscribed to, including operating your account, running scans, and processing payments.</li>
            <li><strong className="text-slate-300">Legitimate interests:</strong> Improving and securing the Service, detecting fraud, producing anonymized benchmarks, and sending service-related communications. We have conducted a balancing test and determined that these interests do not override your rights and freedoms.</li>
            <li><strong className="text-slate-300">Legal obligation:</strong> Processing necessary to comply with applicable law, including tax and accounting requirements and lawful government requests.</li>
            <li><strong className="text-slate-300">Consent:</strong> Where we rely on consent (e.g., optional marketing communications), you may withdraw consent at any time without affecting the lawfulness of processing prior to withdrawal.</li>
          </ul>
        </ProseSection>

        {/* ── 4. How We Share Your Information ──────────────────────────── */}
        <ProseSection title="4. How We Share Your Information">
          <SubSection title="4.1 Service Providers">
            We share data with the following third-party vendors who process data on our behalf to
            operate the Service. Each is bound by data processing agreements and is permitted to use
            your data only as directed by us.
          </SubSection>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm text-slate-400 border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4 font-medium text-slate-300">Provider</th>
                  <th className="text-left py-2 pr-4 font-medium text-slate-300">Purpose</th>
                  <th className="text-left py-2 font-medium text-slate-300">Data Processed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-2 pr-4 font-medium text-slate-300">Supabase</td>
                  <td className="py-2 pr-4">Database, authentication, file storage</td>
                  <td className="py-2">All account and business data</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-slate-300">Vercel</td>
                  <td className="py-2 pr-4">Application hosting and edge network</td>
                  <td className="py-2">Request logs, IP addresses</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-slate-300">Stripe</td>
                  <td className="py-2 pr-4">Payment processing and subscription management</td>
                  <td className="py-2">Payment method, billing address, subscription data</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-slate-300">OpenAI</td>
                  <td className="py-2 pr-4">AI hallucination detection and content generation</td>
                  <td className="py-2">Business name, location data, menu items (query context only)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-slate-300">Anthropic</td>
                  <td className="py-2 pr-4">AI analysis features</td>
                  <td className="py-2">Business name, location data (query context only)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-slate-300">Perplexity AI</td>
                  <td className="py-2 pr-4">AI search queries for competitive and hallucination analysis</td>
                  <td className="py-2">Business name, location data (query context only)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-slate-300">Google (Gemini)</td>
                  <td className="py-2 pr-4">AI search grounding and analysis</td>
                  <td className="py-2">Business name, location data (query context only)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-slate-300">Resend</td>
                  <td className="py-2 pr-4">Transactional email delivery</td>
                  <td className="py-2">Email address, name, email content</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-slate-300">Sentry</td>
                  <td className="py-2 pr-4">Error monitoring and diagnostic logging</td>
                  <td className="py-2">Error data, session identifiers, browser environment</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-slate-300">Inngest</td>
                  <td className="py-2 pr-4">Background job orchestration</td>
                  <td className="py-2">Job payloads (organization and location identifiers)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-slate-300">Upstash</td>
                  <td className="py-2 pr-4">Rate limiting (Redis)</td>
                  <td className="py-2">IP addresses, organization identifiers</td>
                </tr>
              </tbody>
            </table>
          </div>
          <SubSection title="4.2 Business Transfers">
            If LocalVector is involved in a merger, acquisition, financing, reorganization, bankruptcy,
            or sale of all or a portion of our assets, your information may be transferred as part of
            that transaction. We will notify you via email or in-app notice of any such transfer and
            any material changes to how your data is handled.
          </SubSection>
          <SubSection title="4.3 Legal Requirements">
            We may disclose your information if required to do so by law, regulation, legal process,
            or governmental request, or to protect the rights, property, or safety of LocalVector,
            our users, or the public. Where legally permitted, we will notify you of such requests.
          </SubSection>
          <SubSection title="4.4 With Your Consent">
            We may share your information with third parties in other circumstances with your prior
            written consent.
          </SubSection>
          <p className="mt-3">
            <strong className="text-slate-300">We do not sell your personal data to third parties.</strong>{' '}
            We do not share personal data for third-party advertising or marketing purposes.
          </p>
        </ProseSection>

        {/* ── 5. AI Processing Disclosure ───────────────────────────────── */}
        <ProseSection title="5. AI Processing and Your Business Data">
          When you use AI-powered features (hallucination detection, share-of-voice analysis, content
          generation), we send query context — including your business name, location, and relevant
          business details — to third-party AI providers listed in Section 4. We do this on your behalf
          to detect errors and generate analysis.
          <br /><br />
          <strong className="text-slate-300">Your business data is not used to train AI models.</strong>{' '}
          We use API access to OpenAI, Anthropic, Perplexity, and Google under terms that prohibit
          them from using API inputs to train or improve their models. Your business data is processed
          only to generate the response for your query and is not retained by these providers beyond
          their standard API data handling policies.
          <br /><br />
          AI scan results, hallucination detections, and competitive intelligence data generated by
          the Service are stored in your account and governed by our data retention schedule. This
          data belongs to you and is accessible only to you and authorized members of your organization.
        </ProseSection>

        {/* ── 6. Aggregated and De-identified Data ──────────────────────── */}
        <ProseSection title="6. Aggregated and De-identified Data">
          We may use your data to create aggregated, de-identified, or anonymized datasets that do
          not identify you or your business (&ldquo;Aggregate Data&rdquo;). We may use Aggregate Data
          for benchmarking, industry research, product improvement, and to publish anonymized insights
          about AI visibility trends across the restaurant industry. Aggregate Data is not personal data
          and is not governed by this Privacy Policy.
        </ProseSection>

        {/* ── 7. Data Retention ─────────────────────────────────────────── */}
        <ProseSection title="7. Data Retention">
          We retain your data for as long as your account is active or as necessary to provide the
          Service. The following specific retention periods apply:
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong className="text-slate-300">Account and business data:</strong> Retained for the life of your account. Upon account deletion, we initiate deletion within 30 days, subject to the exceptions below.</li>
            <li><strong className="text-slate-300">AI scan results and evaluations:</strong> Retained for 24 months from the date of the scan.</li>
            <li><strong className="text-slate-300">Billing and payment records:</strong> Retained for 7 years from the date of the transaction, as required for tax and accounting compliance.</li>
            <li><strong className="text-slate-300">Server and access logs:</strong> Retained for 90 days.</li>
            <li><strong className="text-slate-300">Error and diagnostic data (Sentry):</strong> Retained for 90 days.</li>
            <li><strong className="text-slate-300">Support communications:</strong> Retained for 3 years.</li>
            <li><strong className="text-slate-300">Data export requests and deletion records:</strong> Retained for 3 years as evidence of compliance.</li>
          </ul>
          When a deletion request is processed, we delete or anonymize your personal data. Certain
          data may be retained longer if required by applicable law, to resolve disputes, enforce
          agreements, or for legitimate business purposes such as fraud prevention.
        </ProseSection>

        {/* ── 8. Cookies and Tracking Technologies ──────────────────────── */}
        <ProseSection title="8. Cookies and Tracking Technologies">
          <SubSection title="8.1 Strictly Necessary Cookies">
            We use session cookies to authenticate users and maintain your logged-in state. These
            cookies are required for the Service to function and cannot be disabled.
          </SubSection>
          <SubSection title="8.2 Analytics and Performance">
            We may use analytics tools to understand how the Service is used in aggregate. Where
            analytics tracking is in use, it is configured to anonymize IP addresses and not to
            collect personally identifiable information beyond session and usage patterns.
          </SubSection>
          <SubSection title="8.3 Error Monitoring">
            Sentry uses browser-level session identifiers to correlate error reports with user sessions.
            These are not advertising cookies and are used solely for debugging.
          </SubSection>
          <SubSection title="8.4 No Advertising Cookies">
            We do not use third-party advertising networks, retargeting pixels, or tracking cookies
            for advertising purposes.
          </SubSection>
          <SubSection title="8.5 Managing Cookies">
            You can control cookies through your browser settings. Disabling strictly necessary cookies
            will prevent you from logging in to the Service. Our cookie consent banner allows you to
            accept or decline non-essential cookies before they are set.
          </SubSection>
        </ProseSection>

        {/* ── 9. International Data Transfers ───────────────────────────── */}
        <ProseSection title="9. International Data Transfers">
          LocalVector is based in the United States, and the Service is hosted on infrastructure located
          primarily in the United States. If you access the Service from outside the United States, your
          data will be transferred to and processed in the United States, which may not provide the same
          level of data protection as your home jurisdiction.
          <br /><br />
          For transfers of personal data from the European Economic Area, the United Kingdom, or
          Switzerland to the United States, we rely on Standard Contractual Clauses (&ldquo;SCCs&rdquo;)
          approved by the European Commission as the legal mechanism for such transfers. Our third-party
          AI providers (OpenAI, Anthropic, Google) have their own cross-border transfer mechanisms in
          place. If you require a Data Processing Agreement documenting these safeguards, please contact
          us at{' '}
          <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
            hello@localvector.ai
          </a>
          .
        </ProseSection>

        {/* ── 10. Your Privacy Rights ────────────────────────────────────── */}
        <ProseSection title="10. Your Privacy Rights">
          <SubSection title="10.1 All Users">
            Regardless of your location, you have the right to:
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate personal data through your account settings or by contacting us.</li>
              <li>Delete your account and associated personal data (subject to our retention schedule).</li>
              <li>Export your business data using the data export feature in your account settings.</li>
              <li>Opt out of non-essential marketing communications at any time.</li>
            </ul>
          </SubSection>
          <SubSection title="10.2 California Residents (CCPA / CPRA)">
            If you are a California resident, you have the following additional rights under the
            California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA):
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li><strong className="text-slate-300">Right to Know:</strong> You may request disclosure of the categories and specific pieces of personal information we have collected about you, and the purposes for which we collect and share it.</li>
              <li><strong className="text-slate-300">Right to Delete:</strong> You may request deletion of personal information we have collected about you, subject to certain exceptions.</li>
              <li><strong className="text-slate-300">Right to Correct:</strong> You may request correction of inaccurate personal information.</li>
              <li><strong className="text-slate-300">Right to Opt-Out of Sale or Sharing:</strong> We do not sell or share your personal information for cross-context behavioral advertising. You do not need to take any action to exercise this right.</li>
              <li><strong className="text-slate-300">Right to Limit Use of Sensitive Personal Information:</strong> We do not use sensitive personal information for purposes other than providing the Service.</li>
              <li><strong className="text-slate-300">Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights.</li>
            </ul>
            To exercise your California rights, contact us at{' '}
            <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
              hello@localvector.ai
            </a>
            . We will respond within 45 days, with a possible 45-day extension where necessary.
          </SubSection>
          <SubSection title="10.3 European Economic Area, UK, and Switzerland (GDPR)">
            If you are located in the EEA, UK, or Switzerland, you have the following rights under
            the General Data Protection Regulation (GDPR) or applicable equivalent law:
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li><strong className="text-slate-300">Right of access:</strong> Obtain a copy of your personal data and information about how it is processed.</li>
              <li><strong className="text-slate-300">Right to rectification:</strong> Correct inaccurate or incomplete personal data.</li>
              <li><strong className="text-slate-300">Right to erasure:</strong> Request deletion of your personal data where there is no overriding legitimate basis for continued processing.</li>
              <li><strong className="text-slate-300">Right to restriction:</strong> Request that we restrict processing of your personal data in certain circumstances.</li>
              <li><strong className="text-slate-300">Right to data portability:</strong> Receive your personal data in a structured, commonly used, machine-readable format.</li>
              <li><strong className="text-slate-300">Right to object:</strong> Object to processing based on legitimate interests, including profiling.</li>
              <li><strong className="text-slate-300">Right to withdraw consent:</strong> Where processing is based on consent, withdraw it at any time without affecting prior lawful processing.</li>
              <li><strong className="text-slate-300">Right to lodge a complaint:</strong> You have the right to lodge a complaint with your local supervisory authority (e.g., the ICO in the UK or your national Data Protection Authority in the EU).</li>
            </ul>
            To exercise your rights, contact us at{' '}
            <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
              hello@localvector.ai
            </a>
            . We will respond within 30 days. We may need to verify your identity before processing
            your request.
          </SubSection>
        </ProseSection>

        {/* ── 11. Children&apos;s Privacy ─────────────────────────────────── */}
        <ProseSection title="11. Children's Privacy">
          The Service is not directed to, and we do not knowingly collect personal information from,
          anyone under the age of 18. If you are a parent or guardian and believe we have collected
          personal information from a child under 18, please contact us at{' '}
          <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
            hello@localvector.ai
          </a>{' '}
          and we will promptly delete the information.
        </ProseSection>

        {/* ── 12. Data Security ──────────────────────────────────────────── */}
        <ProseSection title="12. Data Security">
          We implement and maintain industry-standard technical and organizational security measures
          to protect your data, including:
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Encryption in transit using TLS 1.2 or higher for all data transmitted between your browser and our servers.</li>
            <li>Encryption at rest for database data and stored credentials.</li>
            <li>Row-level security (RLS) policies in our database to enforce organization-level data isolation.</li>
            <li>Role-based access controls limiting internal access to personal data on a need-to-know basis.</li>
            <li>Encrypted storage of third-party OAuth tokens (Google Business Profile access tokens).</li>
            <li>Regular dependency audits and security patch management.</li>
          </ul>
          No method of transmission over the Internet or method of electronic storage is 100% secure.
          While we use commercially reasonable efforts to protect your data, we cannot guarantee
          absolute security. You use the Service at your own risk with respect to the inherent risks
          of internet-based communication.
        </ProseSection>

        {/* ── 13. Data Breach Notification ──────────────────────────────── */}
        <ProseSection title="13. Data Breach Notification">
          In the event of a data breach that is likely to result in a high risk to your rights and
          freedoms, we will notify affected users without undue delay and, where required by applicable
          law (including GDPR Article 33), notify the relevant supervisory authority within 72 hours of
          becoming aware of the breach. Notification will be provided by email to the address associated
          with your account and, where required, posted to our status page. The notification will
          describe the nature of the breach, the data involved, the likely consequences, and the
          remediation measures we are taking.
        </ProseSection>

        {/* ── 14. Do Not Track ───────────────────────────────────────────── */}
        <ProseSection title="14. Do Not Track">
          Some browsers transmit Do Not Track (DNT) signals to websites. Because there is currently
          no industry standard for how to respond to DNT signals, we do not currently respond to DNT
          signals. You can manage your privacy preferences through the cookie settings described in
          Section 8.
        </ProseSection>

        {/* ── 15. Marketing Communications ──────────────────────────────── */}
        <ProseSection title="15. Marketing Communications">
          We may send you marketing emails about LocalVector features, updates, and industry insights.
          These are distinct from transactional service emails (scan alerts, billing receipts), which
          are required for service operation and cannot be opted out of while your account is active.
          You may opt out of marketing emails at any time by clicking the unsubscribe link in any
          marketing email or by visiting your notification preferences in account settings. We will
          process your opt-out within 10 business days.
        </ProseSection>

        {/* ── 16. Data Processing Agreement ─────────────────────────────── */}
        <ProseSection title="16. Data Processing Agreement">
          If your use of the Service involves the processing of personal data of EU, UK, or Swiss
          data subjects, or if your organization&apos;s compliance requirements mandate a Data
          Processing Agreement (DPA), please contact us at{' '}
          <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
            hello@localvector.ai
          </a>
          . We will provide a DPA that reflects our processing activities, incorporates the applicable
          Standard Contractual Clauses, and documents our sub-processor relationships.
        </ProseSection>

        {/* ── 17. Changes to This Policy ────────────────────────────────── */}
        <ProseSection title="17. Changes to This Policy">
          We may update this Privacy Policy periodically to reflect changes in our data practices,
          applicable law, or the Service. We will notify you of material changes by email or in-app
          notice at least 14 days before they take effect, and by updating the &ldquo;Effective
          date&rdquo; at the top of this page. We encourage you to review this page periodically.
          Your continued use of the Service after the effective date of a revised policy constitutes
          your acceptance of the changes.
        </ProseSection>

        {/* ── 18. Contact ───────────────────────────────────────────────── */}
        <ProseSection title="18. Contact Us">
          For privacy questions, data subject requests, or to request a Data Processing Agreement,
          contact our privacy team at:
          <br /><br />
          <strong className="text-slate-300">LocalVector, Inc.</strong>
          <br />
          Email:{' '}
          <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
            hello@localvector.ai
          </a>
          <br />
          Please include &ldquo;Privacy Request&rdquo; in the subject line. We will acknowledge your
          request within 5 business days and respond within the timeframes required by applicable law.
        </ProseSection>

      </article>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <LegalFooter />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="text-sm text-slate-400 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 space-y-1">
      <p className="font-medium text-slate-300">{title}</p>
      <div className="text-sm text-slate-400 leading-relaxed">{children}</div>
    </div>
  );
}

function LegalFooter() {
  return (
    <footer className="border-t border-white/5 py-8">
      <div className="mx-auto max-w-3xl px-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <a href="/privacy" className="text-sm text-slate-400 hover:text-slate-300 transition">Privacy Policy</a>
        <span className="text-slate-700">·</span>
        <a href="/terms" className="text-sm text-slate-400 hover:text-slate-300 transition">Terms of Service</a>
        <span className="text-slate-700">·</span>
        <a href="mailto:hello@localvector.ai" className="text-sm text-slate-400 hover:text-slate-300 transition">
          hello@localvector.ai
        </a>
      </div>
    </footer>
  );
}
