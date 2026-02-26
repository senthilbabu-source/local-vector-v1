// ---------------------------------------------------------------------------
// TopGapCard — Sprint 58A: Highlighted card for #1 uncovered platform gap
// ---------------------------------------------------------------------------

'use client';

const PLATFORM_CLAIM_URLS: Record<string, string> = {
  yelp: 'https://biz.yelp.com/claim',
  tripadvisor: 'https://www.tripadvisor.com/Owners',
  google: 'https://business.google.com',
  facebook: 'https://www.facebook.com/business',
  apple: 'https://register.apple.com/placesonmaps',
  opentable: 'https://restaurant.opentable.com/get-started',
  foursquare: 'https://foursquare.com/venue/claim',
};

interface Props {
  platform: string;
  citationFrequency: number;
  action: string;
}

export default function TopGapCard({ platform, citationFrequency, action }: Props) {
  const pct = Math.round(citationFrequency * 100);
  const claimUrl = PLATFORM_CLAIM_URLS[platform.toLowerCase()] ?? `https://www.${platform.toLowerCase()}.com`;

  return (
    <div className="rounded-2xl bg-alert-crimson/5 border border-alert-crimson/20 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-alert-crimson/10 text-alert-crimson text-sm font-bold uppercase">
          #1
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white capitalize">
            {platform} — {pct}% AI Citation Rate
          </h3>
          <p className="mt-1 text-xs text-slate-400">{action}</p>
          <a
            href={claimUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-signal-green/10 px-3 py-1.5 text-xs font-semibold text-signal-green ring-1 ring-inset ring-signal-green/20 transition hover:bg-signal-green/20"
          >
            Claim Your Listing
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
