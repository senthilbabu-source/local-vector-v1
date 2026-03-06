// ---------------------------------------------------------------------------
// /terms — Terms of Service
// Final draft — March 5, 2026. Review with legal counsel before public launch.
// Static Server Component — no auth required.
// ---------------------------------------------------------------------------

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
          <p className="mt-2 text-sm text-slate-400">Effective date: {effectiveDate}</p>
          <p className="mt-4 text-sm text-slate-400 leading-relaxed">
            These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement between you
            and LocalVector, Inc. (&ldquo;LocalVector&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
            &ldquo;our&rdquo;) governing your access to and use of the LocalVector.ai platform and all
            related services (collectively, the &ldquo;Service&rdquo;). Please read them carefully.
          </p>
        </div>

        {/* ── 1. Acceptance ─────────────────────────────────────────────── */}
        <ProseSection title="1. Acceptance of Terms">
          By creating an account, accessing, or using the Service, you agree to be bound by these Terms
          and our Privacy Policy, which is incorporated by reference. If you are using the Service on
          behalf of a business or other legal entity, you represent that you have the authority to bind
          that entity to these Terms. If you do not agree to these Terms, do not access or use the Service.
        </ProseSection>

        {/* ── 2. Eligibility ────────────────────────────────────────────── */}
        <ProseSection title="2. Eligibility">
          You must be at least 18 years old to use the Service. By using the Service, you represent and
          warrant that you meet this age requirement. The Service is intended for business use only. You
          may not use the Service if you are a direct competitor of LocalVector for the purpose of monitoring,
          copying, or benchmarking the Service without our express written consent.
        </ProseSection>

        {/* ── 3. Description of Service ─────────────────────────────────── */}
        <ProseSection title="3. Description of Service">
          LocalVector is an AI visibility and Answer Engine Optimization (AEO) platform for businesses.
          The Service includes: (a) detection and correction of AI hallucinations about your business across
          major AI platforms; (b) share-of-voice tracking across AI search engines; (c) structured data
          distribution to search engines and AI systems; (d) menu and business data management; (e) content
          generation and optimization tools; (f) competitive intelligence and benchmarking; and (g) integration
          with third-party platforms including Google Business Profile. Specific features available to you
          depend on your subscription plan.
        </ProseSection>

        {/* ── 4. Account Registration and Security ──────────────────────── */}
        <ProseSection title="4. Account Registration and Security">
          You must provide accurate, current, and complete information when creating your account and keep
          it updated. You are responsible for maintaining the confidentiality of your login credentials and
          for all activity that occurs under your account. You must promptly notify us at{' '}
          <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
            hello@localvector.ai
          </a>{' '}
          of any unauthorized use of your account. We are not liable for any loss or damage arising from
          your failure to protect your credentials. You may not share your account credentials with any
          person who is not an authorized member of your organization under your subscription.
        </ProseSection>

        {/* ── 5. Subscription Plans, Billing, and Payment ───────────────── */}
        <ProseSection title="5. Subscription Plans, Billing, and Payment">
          <SubSection title="5.1 Plans">
            The Service is offered under several subscription tiers (each, a &ldquo;Plan&rdquo;). Plan
            features, limitations, and pricing are described on our pricing page. We reserve the right to
            modify Plan features with reasonable notice.
          </SubSection>
          <SubSection title="5.2 Free Trial">
            We may offer a free trial period for certain Plans. At the end of the trial, your account will
            automatically convert to the applicable paid Plan unless you cancel before the trial period ends.
            We may require a valid payment method to initiate a trial. We reserve the right to modify or
            discontinue free trials at any time.
          </SubSection>
          <SubSection title="5.3 Billing">
            Paid Plans are billed in advance on a monthly or annual basis, depending on the billing cycle
            you select. By providing a payment method, you authorize us and our payment processor (Stripe)
            to charge you the applicable fees. All fees are in U.S. dollars unless otherwise stated.
          </SubSection>
          <SubSection title="5.4 Seat-Based Billing">
            Certain Plans include a defined number of user seats. Adding team members beyond your Plan&apos;s
            included seat limit may incur additional per-seat charges as described on the pricing page. You
            are responsible for all seat charges incurred under your account, including charges for seats
            added by administrators you designate.
          </SubSection>
          <SubSection title="5.5 Seat Overages">
            If your active seat count exceeds your Plan&apos;s seat limit, we may automatically charge
            an overage fee for each additional seat, prorated to your billing cycle. We will notify you
            by email when you approach or exceed your seat limit. You are responsible for managing your
            team membership to avoid unintended overages.
          </SubSection>
          <SubSection title="5.6 Upgrades and Downgrades">
            You may upgrade your Plan at any time; the new rate will apply immediately and you will be
            charged a prorated amount for the remainder of your current billing cycle. Downgrades take
            effect at the start of the next billing cycle. Downgrading may result in loss of access to
            features or data associated with your current Plan.
          </SubSection>
          <SubSection title="5.7 Cancellation">
            You may cancel your subscription at any time through your billing settings or by emailing{' '}
            <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
              hello@localvector.ai
            </a>
            . Cancellation takes effect at the end of your current billing period. You retain access to
            the Service through the end of the paid period. No partial refunds are issued for unused time
            in a billing cycle.
          </SubSection>
          <SubSection title="5.8 Failed Payments">
            If a payment fails, we will attempt to collect payment using retry logic. If payment cannot
            be collected after multiple attempts, we may suspend or terminate your account. You remain
            responsible for all unpaid amounts. We may charge a late fee or interest on past-due amounts
            to the maximum extent permitted by law.
          </SubSection>
          <SubSection title="5.9 Refunds">
            All fees are non-refundable except where expressly required by applicable law or as otherwise
            stated in a written agreement with us. If you believe a charge was made in error, contact us
            within 30 days of the charge.
          </SubSection>
          <SubSection title="5.10 Price Changes">
            We reserve the right to change our pricing at any time. We will provide at least 30 days&apos;
            advance notice of price increases via email or in-app notice. Continued use of the Service
            after the price change takes effect constitutes acceptance of the new pricing.
          </SubSection>
          <SubSection title="5.11 Taxes">
            All fees are exclusive of applicable taxes. You are responsible for paying all taxes, levies,
            or duties imposed by taxing authorities in connection with your use of the Service, excluding
            taxes based on LocalVector&apos;s income. Where required, we will collect and remit applicable
            sales tax.
          </SubSection>
        </ProseSection>

        {/* ── 6. Acceptable Use ─────────────────────────────────────────── */}
        <ProseSection title="6. Acceptable Use">
          You agree not to:
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Use the Service to scrape, abuse, or make unauthorized or excessive API calls to third-party platforms.</li>
            <li>Submit false, misleading, or defamatory business information to the Service or to third-party platforms via the Service.</li>
            <li>Attempt to reverse-engineer, decompile, disassemble, or otherwise derive source code from the Service.</li>
            <li>Resell, sublicense, or provide access to the Service to third parties without our written consent, except as permitted under an Agency Plan.</li>
            <li>Violate any applicable local, state, national, or international law or regulation.</li>
            <li>Interfere with or disrupt the security, integrity, or performance of the Service or its infrastructure.</li>
            <li>Attempt to bypass, circumvent, or disable any rate limiting, security, or access control measures.</li>
            <li>Use the Service to transmit malware, viruses, or other harmful code.</li>
            <li>Use automated means (bots, scrapers, crawlers) to access the Service beyond our published APIs.</li>
            <li>Impersonate another user, organization, or any representative of LocalVector.</li>
            <li>Use the Service to infringe any patent, trademark, trade secret, copyright, or other intellectual property right of any party.</li>
            <li>Use the Service in any manner that could disparage, defame, or harm the reputation of any individual or organization.</li>
          </ul>
          We reserve the right to investigate and, where appropriate, suspend or terminate accounts that violate
          this Acceptable Use policy. Repeated or egregious violations may be reported to law enforcement.
        </ProseSection>

        {/* ── 7. Your Content and Data ──────────────────────────────────── */}
        <ProseSection title="7. Your Content and Data">
          <SubSection title="7.1 Ownership">
            You retain all ownership rights to the business data, content, and information you submit to
            the Service (&ldquo;Your Content&rdquo;), including business names, locations, menus, and
            related materials.
          </SubSection>
          <SubSection title="7.2 License to LocalVector">
            By submitting Your Content to the Service, you grant LocalVector a worldwide, non-exclusive,
            royalty-free license to store, process, display, and use Your Content solely to: (a) provide
            and improve the Service to you; (b) perform AI analysis, hallucination detection, and
            distribution functions on your behalf; and (c) comply with legal obligations. This license
            terminates when you delete Your Content or close your account, subject to the data retention
            terms in our Privacy Policy.
          </SubSection>
          <SubSection title="7.3 Your Responsibility">
            You are solely responsible for the accuracy and legality of Your Content. You represent and
            warrant that you have all rights necessary to submit Your Content to the Service and to grant
            the license above, and that Your Content does not violate any applicable law or any
            third-party rights.
          </SubSection>
          <SubSection title="7.4 AI-Generated Content">
            The Service may generate content on your behalf, including corrected business listings,
            FAQ responses, and marketing drafts (&ldquo;AI-Generated Content&rdquo;). You are responsible
            for reviewing AI-Generated Content before publishing or distributing it. Subject to your
            compliance with these Terms and payment of applicable fees, we assign to you all ownership
            rights in AI-Generated Content produced specifically for your account.
          </SubSection>
        </ProseSection>

        {/* ── 8. Intellectual Property ──────────────────────────────────── */}
        <ProseSection title="8. Intellectual Property">
          LocalVector and its licensors own all rights, title, and interest in and to the Service,
          including the platform, software, algorithms, models, design, trademarks, logos, and all
          related intellectual property (&ldquo;LocalVector IP&rdquo;). Nothing in these Terms transfers
          any ownership of LocalVector IP to you. You are granted a limited, non-exclusive,
          non-transferable, revocable license to access and use the Service solely for your internal
          business purposes in accordance with these Terms. All rights not expressly granted are reserved.
        </ProseSection>

        {/* ── 9. Feedback License ───────────────────────────────────────── */}
        <ProseSection title="9. Feedback">
          If you provide us with suggestions, ideas, feature requests, or other feedback regarding the
          Service (&ldquo;Feedback&rdquo;), you grant LocalVector a perpetual, irrevocable, worldwide,
          royalty-free license to use, reproduce, modify, and incorporate such Feedback into the Service
          or any other product or service, without compensation or attribution to you.
        </ProseSection>

        {/* ── 10. Third-Party Integrations ──────────────────────────────── */}
        <ProseSection title="10. Third-Party Integrations and Services">
          The Service integrates with third-party platforms including Google Business Profile, Yelp,
          Bing Places, and others (&ldquo;Third-Party Services&rdquo;). By connecting a Third-Party
          Service to your account, you authorize LocalVector to access and act on that platform on your
          behalf using the permissions you grant. You are responsible for complying with the terms of
          service of all Third-Party Services you connect. LocalVector is not responsible for the
          availability, accuracy, or actions of any Third-Party Service, and we are not liable for any
          loss or damage arising from your use of or reliance on Third-Party Services. We may discontinue
          integration with any Third-Party Service at any time without notice.
        </ProseSection>

        {/* ── 11. AI Features and Limitations ──────────────────────────── */}
        <ProseSection title="11. AI Features, Limitations, and Disclaimer">
          The Service uses artificial intelligence and machine learning to analyze, detect, and report on
          how your business is represented across AI platforms and search engines. You acknowledge and
          agree that:
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>AI scan results, hallucination detection outputs, and competitive analysis are probabilistic and may be incomplete, delayed, or inaccurate.</li>
            <li>The Service does not guarantee that AI hallucinations about your business will be detected, corrected, or prevented.</li>
            <li>You are solely responsible for verifying the accuracy of any AI-Generated Content or recommendations before acting on them or distributing them.</li>
            <li>LocalVector is not responsible for decisions you make based on Service outputs, including changes to your business listings, marketing materials, or operational decisions.</li>
            <li>AI platform behaviors, responses, and outputs are controlled by third parties and may change at any time without notice to LocalVector.</li>
          </ul>
        </ProseSection>

        {/* ── 12. Team Accounts and Administrators ──────────────────────── */}
        <ProseSection title="12. Team Accounts and Administrators">
          If you use the Service with multiple team members, the account owner and any designated
          administrators are responsible for: (a) managing user access and permissions within the account;
          (b) ensuring all team members comply with these Terms; and (c) all actions taken by team members
          under the account. Administrators may add or remove team members, which may affect seat count
          and billing. LocalVector is not liable for actions taken by administrators or team members
          within your account.
        </ProseSection>

        {/* ── 13. Confidentiality ───────────────────────────────────────── */}
        <ProseSection title="13. Confidentiality">
          Each party may receive confidential information from the other party in connection with the
          Service. Each party agrees to: (a) keep the other party&apos;s confidential information
          confidential using at least the same degree of care it uses to protect its own confidential
          information, but no less than reasonable care; and (b) not disclose the other party&apos;s
          confidential information to any third party without prior written consent, except to employees
          or contractors who need to know it to provide the Service and who are bound by confidentiality
          obligations no less protective than those in these Terms. Confidential information does not
          include information that is or becomes publicly available through no fault of the receiving
          party, was rightfully known before disclosure, or is required to be disclosed by law.
        </ProseSection>

        {/* ── 14. Disclaimer of Warranties ──────────────────────────────── */}
        <ProseSection title="14. Disclaimer of Warranties">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo;
          AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
          BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          NON-INFRINGEMENT, OR UNINTERRUPTED OR ERROR-FREE OPERATION. LOCALVECTOR DOES NOT WARRANT
          THAT: (A) THE SERVICE WILL MEET YOUR SPECIFIC REQUIREMENTS; (B) AI SCAN RESULTS WILL BE
          COMPLETE, ACCURATE, OR CURRENT; (C) THE SERVICE WILL BE AVAILABLE AT ANY PARTICULAR TIME OR
          LOCATION; OR (D) ANY ERRORS OR DEFECTS IN THE SERVICE WILL BE CORRECTED. SOME JURISDICTIONS
          DO NOT ALLOW THE EXCLUSION OF IMPLIED WARRANTIES, SO SOME OF THE ABOVE EXCLUSIONS MAY NOT
          APPLY TO YOU.
        </ProseSection>

        {/* ── 15. Limitation of Liability ───────────────────────────────── */}
        <ProseSection title="15. Limitation of Liability">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL LOCALVECTOR, ITS
          AFFILIATES, DIRECTORS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
          SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS
          OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITIES, ARISING OUT OF OR IN
          CONNECTION WITH THESE TERMS OR YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF
          LOCALVECTOR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          <br /><br />
          IN NO EVENT SHALL LOCALVECTOR&apos;S AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF
          OR RELATING TO THESE TERMS OR THE SERVICE EXCEED THE GREATER OF: (A) THE TOTAL FEES PAID BY
          YOU TO LOCALVECTOR IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE CLAIM; OR (B) ONE
          HUNDRED U.S. DOLLARS ($100).
          <br /><br />
          THE LIMITATIONS IN THIS SECTION APPLY REGARDLESS OF THE THEORY OF LIABILITY (CONTRACT, TORT,
          NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE). NOTHING IN THESE TERMS LIMITS LOCALVECTOR&apos;S
          LIABILITY FOR FRAUD, GROSS NEGLIGENCE, OR WILLFUL MISCONDUCT, OR TO THE EXTENT SUCH LIMITATION
          IS NOT PERMITTED BY APPLICABLE LAW.
        </ProseSection>

        {/* ── 16. Indemnification ───────────────────────────────────────── */}
        <ProseSection title="16. Indemnification">
          You agree to defend, indemnify, and hold harmless LocalVector, its affiliates, and their
          respective officers, directors, employees, agents, and licensors from and against any claims,
          liabilities, damages, judgments, awards, losses, costs, expenses, and fees (including reasonable
          attorneys&apos; fees) arising out of or relating to: (a) your use of the Service in violation
          of these Terms; (b) Your Content or the submission, processing, or distribution of Your
          Content via the Service; (c) your violation of any applicable law or regulation; (d) your
          violation of any third-party right, including any intellectual property or privacy right; or
          (e) any claim by a third party relating to actions taken on third-party platforms through
          your connected integrations. LocalVector reserves the right to assume exclusive control of the
          defense of any matter subject to indemnification by you, at your expense.
        </ProseSection>

        {/* ── 17. Termination ───────────────────────────────────────────── */}
        <ProseSection title="17. Termination">
          <SubSection title="17.1 Termination by You">
            You may terminate these Terms and close your account at any time through your account
            billing settings or by emailing{' '}
            <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
              hello@localvector.ai
            </a>
            . Termination takes effect at the end of your current billing period.
          </SubSection>
          <SubSection title="17.2 Termination by LocalVector">
            We may suspend or terminate your account and access to the Service immediately upon notice
            if: (a) you materially breach these Terms and fail to cure the breach within 15 days of
            notice (or immediately for breaches that cannot be cured); (b) you fail to pay fees when
            due; (c) you engage in fraudulent, abusive, or illegal activity; or (d) we are required to
            do so by law. We may also terminate the Service entirely upon 60 days&apos; notice to all
            subscribers.
          </SubSection>
          <SubSection title="17.3 Effect of Termination">
            Upon termination: (a) all licenses granted to you under these Terms immediately terminate;
            (b) you must cease all use of the Service; and (c) any outstanding payment obligations
            survive termination.
          </SubSection>
          <SubSection title="17.4 Data Export Window">
            Following account termination, you have 30 days to export Your Content from the Service
            using the data export tools available in your account settings. After 30 days, we may
            permanently delete Your Content in accordance with our Privacy Policy and data retention
            schedule. We are not liable for any loss of data following this window.
          </SubSection>
        </ProseSection>

        {/* ── 18. Beta Features ─────────────────────────────────────────── */}
        <ProseSection title="18. Beta Features">
          We may make certain features available to you on a beta or preview basis
          (&ldquo;Beta Features&rdquo;). Beta Features are provided &ldquo;as is&rdquo; without any
          warranty, may be discontinued at any time, and are not subject to any SLA commitments. Your
          use of Beta Features is voluntary and at your own risk. We may use your feedback on Beta
          Features to improve the Service without any obligation to you.
        </ProseSection>

        {/* ── 19. DMCA and Copyright ────────────────────────────────────── */}
        <ProseSection title="19. Copyright and DMCA">
          LocalVector respects intellectual property rights. If you believe that content available
          through the Service infringes your copyright, please send a written notice to{' '}
          <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
            hello@localvector.ai
          </a>{' '}
          with: (a) identification of the copyrighted work claimed to have been infringed; (b)
          identification of the allegedly infringing material and information reasonably sufficient to
          locate it; (c) your contact information; (d) a statement that you have a good faith belief
          that the use is not authorized; and (e) a statement, under penalty of perjury, that the
          information in the notice is accurate and that you are the copyright owner or authorized to
          act on the owner&apos;s behalf.
        </ProseSection>

        {/* ── 20. Force Majeure ─────────────────────────────────────────── */}
        <ProseSection title="20. Force Majeure">
          Neither party will be liable for any delay or failure to perform its obligations under these
          Terms (other than payment obligations) to the extent such delay or failure is caused by
          circumstances beyond that party&apos;s reasonable control, including acts of God, natural
          disasters, pandemic, government action, war, terrorism, labor disputes, internet or
          infrastructure failures, or third-party service outages.
        </ProseSection>

        {/* ── 21. Dispute Resolution and Arbitration ────────────────────── */}
        <ProseSection title="21. Dispute Resolution and Arbitration">
          <SubSection title="21.1 Informal Resolution">
            Before initiating any formal dispute, you agree to contact us at{' '}
            <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
              hello@localvector.ai
            </a>{' '}
            and give us 30 days to attempt to resolve the dispute informally.
          </SubSection>
          <SubSection title="21.2 Binding Arbitration">
            If informal resolution fails, any dispute, claim, or controversy arising out of or relating
            to these Terms or the Service will be resolved by binding individual arbitration administered
            by the American Arbitration Association (&ldquo;AAA&rdquo;) under its Commercial Arbitration
            Rules. The arbitration will be conducted in Delaware or, at your option, by video conference.
            The arbitrator&apos;s decision will be final and binding, and judgment may be entered in
            any court of competent jurisdiction.
          </SubSection>
          <SubSection title="21.3 Class Action Waiver">
            YOU AND LOCALVECTOR AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN AN INDIVIDUAL
            CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, CONSOLIDATED, OR
            REPRESENTATIVE ACTION OR PROCEEDING. The arbitrator may not consolidate claims of more than
            one person or entity and may not preside over any form of a class or representative proceeding.
          </SubSection>
          <SubSection title="21.4 Exceptions">
            Notwithstanding the above, either party may seek emergency injunctive or other equitable
            relief in any court of competent jurisdiction to protect its intellectual property rights or
            confidential information, or to prevent irreparable harm pending arbitration. Either party
            may also bring claims in small claims court if the dispute qualifies.
          </SubSection>
          <SubSection title="21.5 Opt-Out">
            You may opt out of binding arbitration by sending written notice to{' '}
            <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
              hello@localvector.ai
            </a>{' '}
            within 30 days of first accepting these Terms. Your notice must include your name, account
            email, and a clear statement that you are opting out of arbitration.
          </SubSection>
        </ProseSection>

        {/* ── 22. Governing Law ─────────────────────────────────────────── */}
        <ProseSection title="22. Governing Law and Venue">
          These Terms are governed by the laws of the State of Delaware, United States, without regard
          to its conflict of law provisions. To the extent any dispute is not subject to arbitration
          under Section 21, you and LocalVector consent to exclusive jurisdiction and venue in the
          state or federal courts located in Delaware.
        </ProseSection>

        {/* ── 23. General Provisions ────────────────────────────────────── */}
        <ProseSection title="23. General Provisions">
          <SubSection title="23.1 Entire Agreement">
            These Terms, together with the Privacy Policy and any order forms or written agreements
            separately executed by the parties, constitute the entire agreement between you and
            LocalVector with respect to the Service and supersede all prior or contemporaneous
            understandings regarding such subject matter.
          </SubSection>
          <SubSection title="23.2 Severability">
            If any provision of these Terms is found to be unenforceable or invalid, that provision
            will be limited or eliminated to the minimum extent necessary, and the remaining provisions
            will remain in full force and effect.
          </SubSection>
          <SubSection title="23.3 No Waiver">
            Our failure to enforce any right or provision of these Terms will not be considered a waiver
            of those rights. Any waiver must be in writing and signed by an authorized representative
            of LocalVector.
          </SubSection>
          <SubSection title="23.4 Assignment">
            You may not assign or transfer these Terms, by operation of law or otherwise, without our
            prior written consent. We may freely assign these Terms, including in connection with a
            merger, acquisition, or sale of all or substantially all of our assets, without your
            consent. These Terms will bind and inure to the benefit of each party&apos;s permitted
            successors and assigns.
          </SubSection>
          <SubSection title="23.5 Notices">
            Notices to LocalVector must be sent to{' '}
            <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
              hello@localvector.ai
            </a>
            . We will send notices to the email address associated with your account. Notices are
            effective when sent.
          </SubSection>
          <SubSection title="23.6 Relationship of Parties">
            The parties are independent contractors. Nothing in these Terms creates a partnership,
            joint venture, employment, franchise, or agency relationship between you and LocalVector.
          </SubSection>
          <SubSection title="23.7 Export Controls">
            You agree to comply with all applicable export and import laws and regulations. You represent
            that you are not located in a country subject to U.S. government embargo and that you are
            not listed on any U.S. government list of prohibited or restricted parties.
          </SubSection>
        </ProseSection>

        {/* ── 24. Changes to Terms ──────────────────────────────────────── */}
        <ProseSection title="24. Changes to These Terms">
          We may update these Terms periodically. We will notify you of material changes by email or
          in-app notice at least 14 days before they take effect. The updated Terms will be posted at
          localvector.ai/terms with a new effective date. If you do not agree to the updated Terms, you
          must stop using the Service before the changes take effect. Your continued use of the Service
          after the effective date of the updated Terms constitutes your acceptance of the changes.
        </ProseSection>

        {/* ── 25. Contact ───────────────────────────────────────────────── */}
        <ProseSection title="25. Contact">
          Questions about these Terms? Contact us at{' '}
          <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
            hello@localvector.ai
          </a>
          . For legal notices, please include &ldquo;Legal Notice&rdquo; in the subject line.
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
