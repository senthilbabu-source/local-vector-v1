// ---------------------------------------------------------------------------
// /unsubscribe — Unsubscribe Confirmation Page (Sprint 117)
//
// PUBLIC server component. No auth required. Brand-neutral.
// Accessed via redirect from GET /api/email/unsubscribe?token=...
// ---------------------------------------------------------------------------

import Link from 'next/link';

interface UnsubscribePageProps {
  searchParams: Promise<{ success?: string; already?: string }>;
}

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const params = await searchParams;
  const isSuccess = params.success === 'true';
  const isAlready = params.already === 'true';

  return (
    <div style={container}>
      <div style={card}>
        {isSuccess && (
          <>
            <h1 style={heading}>Unsubscribed</h1>
            <p style={text}>
              You&apos;ve been unsubscribed. You won&apos;t receive weekly AI
              visibility reports anymore. You can re-subscribe in your settings.
            </p>
          </>
        )}

        {isAlready && (
          <>
            <h1 style={heading}>Already Unsubscribed</h1>
            <p style={text}>
              You&apos;re already unsubscribed from weekly reports.
            </p>
          </>
        )}

        {!isSuccess && !isAlready && (
          <>
            <h1 style={heading}>Invalid Link</h1>
            <p style={text}>
              Invalid unsubscribe link. If you need help, contact support.
            </p>
          </>
        )}

        <Link href="/dashboard" style={link}>
          Go to Dashboard →
        </Link>
      </div>
    </div>
  );
}

const container: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#050A15',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const card: React.CSSProperties = {
  maxWidth: '400px',
  margin: '0 auto',
  padding: '40px',
  textAlign: 'center',
};

const heading: React.CSSProperties = {
  color: '#F1F5F9',
  fontSize: '24px',
  fontWeight: 700,
  marginBottom: '12px',
};

const text: React.CSSProperties = {
  color: '#94A3B8',
  fontSize: '15px',
  lineHeight: 1.6,
  marginBottom: '24px',
};

const link: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#4f46e5',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '14px',
};
