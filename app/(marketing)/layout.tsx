// ---------------------------------------------------------------------------
// Marketing Layout — Light theme with Bricolage Grotesque + Plus Jakarta Sans
//
// Phase 1: Website Content Strategy v2.0
// Uses a separate font stack from the dashboard (which keeps Outfit).
// ---------------------------------------------------------------------------

import dynamic from 'next/dynamic';
import { Plus_Jakarta_Sans, JetBrains_Mono, Bricolage_Grotesque } from 'next/font/google';

const ScrollReveal = dynamic(() => import('./_components/ScrollReveal'));

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
  weight: ['700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${plusJakarta.variable} ${jetbrainsMono.variable} ${bricolage.variable} lv-marketing`}
      style={{
        fontFamily: 'var(--font-plus-jakarta), system-ui, sans-serif',
        color: 'var(--m-text-primary)',
        backgroundColor: 'var(--m-bg-primary)',
        minHeight: '100vh',
        // Override the dark body that bleeds through
        position: 'relative',
        zIndex: 0,
      }}
    >
      <ScrollReveal>{children}</ScrollReveal>
    </div>
  );
}
