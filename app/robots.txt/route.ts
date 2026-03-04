// ---------------------------------------------------------------------------
// app/robots.txt/route.ts — robots.txt Route Handler (P7-FIX-32)
//
// Serves robots.txt dynamically so the sitemap URL matches the deployment.
// Disallows /dashboard/, /api/, /_next/, /admin/ from indexing.
// ---------------------------------------------------------------------------

export function GET() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://localvector.ai';

  return new Response(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /dashboard/',
      'Disallow: /api/',
      'Disallow: /_next/',
      'Disallow: /admin/',
      '',
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain' } }
  );
}
