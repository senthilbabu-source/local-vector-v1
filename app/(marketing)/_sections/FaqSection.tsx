// ---------------------------------------------------------------------------
// Section 9: "FAQ" — Light theme Server Component
// ---------------------------------------------------------------------------

export default function FaqSection() {
  return (
    <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
      <h2
        className="m-display m-reveal"
        style={{ maxWidth: 480, marginBottom: 48 }}
      >
        Straight answers.
      </h2>

      <div className="m-reveal" style={{ maxWidth: 740 }}>
        <FaqItem
          question="What exactly does LocalVector.ai do?"
          answer="We monitor what the major AI models — ChatGPT, Gemini, Perplexity, Copilot, Claude — are saying about your business. When they get something wrong (wrong hours, wrong address, saying you're closed when you're open), we detect it, alert you, and give you the tools to fix it before it costs you customers."
        />
        <FaqItem
          question="How is this different from BrightLocal or Yext?"
          answer="BrightLocal and Yext manage your directory listings — Google, Yelp, Apple Maps. That still matters. But LocalVector monitors what AI engines actually synthesize from all those sources. An AI model can pull from your perfect Google listing and still get it wrong. We catch that layer."
        />
        <FaqItem
          question="I'm not a tech person. Can I actually use this?"
          answer="Yes. This was built by a local business owner, not a software company. You get plain-English alerts ('ChatGPT says you close at 9 PM — you actually close at 11 PM') and one-click fixes. If you can read an email, you can use LocalVector."
        />
        <FaqItem
          question="How quickly do corrections propagate to AI models?"
          answer="Your first audit runs in minutes. Once you submit corrections through our structured data tools, they reach AI crawlers within 7-14 days. We show you live propagation status so you know exactly when each model picks up the fix."
        />
        <FaqItem
          question="What AI models do you monitor?"
          answer="ChatGPT (GPT-4o), Google Gemini, Perplexity, Microsoft Copilot, and Claude. Our Growth plan monitors all 5 models. Starter monitors the top 3. We add new models as they gain market share."
        />
        <FaqItem
          question="Do I need to cancel my other SEO tools?"
          answer="No. Directory listings still matter — they're one of the sources AI models pull from. LocalVector adds the AI accuracy layer on top. Think of it as the monitoring system for what happens after your listings get ingested by AI."
        />
        <FaqItem
          question="What if AI isn't saying anything wrong about my business?"
          answer="Then your dashboard shows 'All Clear' and you can sleep well. But AI models update their knowledge constantly, and a correct answer today can become a hallucination tomorrow. Ongoing monitoring is how you stay protected."
          last
        />
      </div>
    </section>
  );
}

/* ---- Helper sub-component ---- */

function FaqItem({
  question,
  answer,
  last = false,
}: {
  question: string;
  answer: string;
  last?: boolean;
}) {
  return (
    <details
      style={{
        borderBottom: last ? 'none' : '1px solid var(--m-border-base)',
      }}
    >
      <summary
        className="m-faq-summary"
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--m-text-primary)',
          padding: '20px 32px 20px 0',
          cursor: 'pointer',
          listStyle: 'none',
          position: 'relative',
        }}
      >
        {question}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 20,
            color: 'var(--m-text-muted)',
            transition: 'transform 0.2s',
            fontWeight: 300,
          }}
          className="m-faq-chevron"
        >
          +
        </span>
      </summary>
      <p
        style={{
          fontSize: 16,
          lineHeight: 1.7,
          color: 'var(--m-text-secondary)',
          paddingBottom: 20,
          marginTop: 0,
        }}
      >
        {answer}
      </p>
    </details>
  );
}
