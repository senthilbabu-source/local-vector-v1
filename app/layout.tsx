export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getOrgContextFromHeaders } from '@/lib/whitelabel/get-org-context-from-headers';
import { getOrgThemeOrDefault } from '@/lib/whitelabel/theme-service';
import { buildThemeCssProps, cssPropsToObject } from '@/lib/whitelabel/theme-utils';
import { buildGoogleFontUrl } from '@/lib/whitelabel/types';
import { createServiceRoleClient } from '@/lib/supabase/server';
import CookieConsentBanner from '@/components/ui/CookieConsentBanner';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  weight: ['400', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'LocalVector.ai — AI Visibility for Local Businesses',
    template: '%s | LocalVector.ai',
  },
  description:
    'Know exactly how AI search engines see your business. Monitor, optimize, and protect your visibility on ChatGPT, Perplexity, Gemini, and more.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://localvector.ai'
  ),
  openGraph: {
    type: 'website',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Sprint 115: Inject CSS custom properties from org theme when accessed via subdomain/custom domain
  const orgContext = await getOrgContextFromHeaders();
  let styleObj: React.CSSProperties | undefined;
  let fontUrl: string | null = null;

  if (orgContext) {
    const serviceClient = createServiceRoleClient();
    const theme = await getOrgThemeOrDefault(serviceClient, orgContext.org_id);
    const cssProps = buildThemeCssProps(theme);
    styleObj = cssPropsToObject(cssProps);
    fontUrl = buildGoogleFontUrl(theme.font_family);
  }

  return (
    <html lang="en" style={styleObj}>
      <head>
        {fontUrl && <link rel="stylesheet" href={fontUrl} />}
      </head>
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
