// ---------------------------------------------------------------------------
// /for/[city] — Programmatic City Pages (Marketing Sprint C)
//
// Template: "AI Visibility Monitoring for Restaurants in {City}"
// Top 10 metros. generateStaticParams from TRACKED_METROS.
// Server Component. ISR revalidate 86400 (1 day).
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MarketingNav from '../../_components/MarketingNav';
import MarketingFooter from '../../_components/MarketingFooter';
import PageHero from '../../_components/PageHero';
import { SectionLabel } from '../../_components/MarketingShared';

export const revalidate = 86400; // 1 day ISR

// ---------------------------------------------------------------------------
// Metro data
// ---------------------------------------------------------------------------

interface Metro {
  slug: string;
  city: string;
  state: string;
  stateCode: string;
  population: string;
  restaurants: string;
  aiSearchVolume: string;
  topCuisines: string[];
  localInsight: string;
}

export const TRACKED_METROS: Metro[] = [
  {
    slug: 'atlanta',
    city: 'Atlanta',
    state: 'Georgia',
    stateCode: 'GA',
    population: '6.2M metro',
    restaurants: '12,000+',
    aiSearchVolume: '~340K/mo',
    topCuisines: ['Southern / Soul Food', 'BBQ', 'Korean', 'Ethiopian', 'Seafood'],
    localInsight: 'Atlanta\'s food scene is one of the most diverse in the South. With massive growth in Midtown, East Atlanta Village, and the BeltLine corridor, new restaurants open weekly — and AI models struggle to keep up with the pace of change.',
  },
  {
    slug: 'dallas',
    city: 'Dallas',
    state: 'Texas',
    stateCode: 'TX',
    population: '7.7M metro',
    restaurants: '15,000+',
    aiSearchVolume: '~410K/mo',
    topCuisines: ['Tex-Mex', 'BBQ', 'Steakhouse', 'Vietnamese', 'Craft Cocktail Bars'],
    localInsight: 'The DFW metroplex sprawls across dozens of cities, making accurate location data critical. AI models frequently confuse Dallas, Plano, Frisco, and Arlington businesses — serving wrong addresses and hours.',
  },
  {
    slug: 'houston',
    city: 'Houston',
    state: 'Texas',
    stateCode: 'TX',
    population: '7.3M metro',
    restaurants: '14,000+',
    aiSearchVolume: '~390K/mo',
    topCuisines: ['Vietnamese', 'Tex-Mex', 'BBQ', 'Cajun / Creole', 'Nigerian'],
    localInsight: 'Houston has more restaurant diversity per capita than any US city. The sheer variety means AI models often confuse cuisine types, attribute the wrong specialty, or miss entire neighborhoods like Montrose and EaDo.',
  },
  {
    slug: 'chicago',
    city: 'Chicago',
    state: 'Illinois',
    stateCode: 'IL',
    population: '9.5M metro',
    restaurants: '16,000+',
    aiSearchVolume: '~480K/mo',
    topCuisines: ['Deep Dish Pizza', 'Italian Beef', 'Mexican', 'Polish', 'Craft Beer'],
    localInsight: 'Chicago\'s neighborhood-driven food culture means a restaurant in Wicker Park and one in Hyde Park serve completely different markets. AI models flatten this nuance, often serving generic "Chicago" answers instead of neighborhood-specific ones.',
  },
  {
    slug: 'new-york',
    city: 'New York',
    state: 'New York',
    stateCode: 'NY',
    population: '20.1M metro',
    restaurants: '27,000+',
    aiSearchVolume: '~890K/mo',
    topCuisines: ['Pizza', 'Chinese', 'Italian', 'Japanese / Ramen', 'Brunch'],
    localInsight: 'The sheer density of NYC restaurants means AI hallucination rates are among the highest in the country. With businesses opening and closing weekly, AI training data is perpetually stale — especially in Brooklyn and Queens.',
  },
  {
    slug: 'los-angeles',
    city: 'Los Angeles',
    state: 'California',
    stateCode: 'CA',
    population: '13.2M metro',
    restaurants: '22,000+',
    aiSearchVolume: '~720K/mo',
    topCuisines: ['Mexican', 'Korean', 'Japanese', 'Thai', 'Health-Conscious'],
    localInsight: 'LA\'s sprawling geography across dozens of distinct neighborhoods creates massive data consistency challenges. AI models frequently mix up Silver Lake, Los Feliz, and Echo Park businesses, or serve outdated hours for restaurants that change seasonally.',
  },
  {
    slug: 'miami',
    city: 'Miami',
    state: 'Florida',
    stateCode: 'FL',
    population: '6.1M metro',
    restaurants: '10,000+',
    aiSearchVolume: '~290K/mo',
    topCuisines: ['Cuban', 'Colombian', 'Seafood', 'Brazilian', 'Fusion'],
    localInsight: 'Miami\'s tourism-driven economy means AI accuracy directly impacts revenue. When AI tells tourists a restaurant is in South Beach but it\'s actually in Wynwood, or says a Cuban spot is closed during peak season — the impact is immediate.',
  },
  {
    slug: 'phoenix',
    city: 'Phoenix',
    state: 'Arizona',
    stateCode: 'AZ',
    population: '4.9M metro',
    restaurants: '8,000+',
    aiSearchVolume: '~250K/mo',
    topCuisines: ['Mexican', 'Southwestern', 'BBQ', 'Brunch', 'Craft Beer'],
    localInsight: 'Phoenix\'s rapid growth means AI models are perpetually behind. New restaurants in Scottsdale, Tempe, and Gilbert open faster than AI can index them, while established spots in downtown Phoenix see their data go stale.',
  },
  {
    slug: 'denver',
    city: 'Denver',
    state: 'Colorado',
    stateCode: 'CO',
    population: '2.9M metro',
    restaurants: '6,000+',
    aiSearchVolume: '~180K/mo',
    topCuisines: ['Craft Beer', 'Farm-to-Table', 'Mexican', 'Ramen', 'Brunch'],
    localInsight: 'Denver\'s food scene has exploded with the RiNo, LoHi, and South Broadway corridors. Seasonal menus change frequently, and AI models often serve summer menus in winter or miss new openings in fast-growing neighborhoods.',
  },
  {
    slug: 'seattle',
    city: 'Seattle',
    state: 'Washington',
    stateCode: 'WA',
    population: '4.0M metro',
    restaurants: '7,500+',
    aiSearchVolume: '~230K/mo',
    topCuisines: ['Seafood', 'Vietnamese', 'Japanese', 'Coffee Culture', 'Pacific NW Farm-to-Table'],
    localInsight: 'Seattle\'s tech-savvy population uses AI assistants at higher rates than most cities. That means AI inaccuracy has an outsized impact — when Perplexity sends someone to a closed Pike Place restaurant, it costs real money.',
  },
];

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return TRACKED_METROS.map((m) => ({ city: m.slug }));
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

type PageProps = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params;
  const metro = TRACKED_METROS.find((m) => m.slug === city);
  if (!metro) return { title: 'City | LocalVector.ai' };

  return {
    title: `AI Visibility for Restaurants in ${metro.city}, ${metro.stateCode} | LocalVector.ai`,
    description: `Monitor what ChatGPT, Perplexity, and Gemini say about restaurants in ${metro.city}. Detect AI hallucinations, track Share of Voice, and fix errors before they cost you customers.`,
    openGraph: {
      title: `AI Visibility Monitoring for ${metro.city} Restaurants`,
      description: `${metro.restaurants} restaurants in ${metro.city}. Is AI getting yours right?`,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMMON_PROBLEMS = [
  { icon: '\u23F0', title: 'Wrong hours', description: 'AI tells customers you\'re closed when you\'re open — or open when you\'re closed. The #1 hallucination type.' },
  { icon: '\uD83D\uDCCD', title: 'Wrong location', description: 'AI confuses your address with a nearby competitor, or sends customers to a closed location.' },
  { icon: '\uD83C\uDF7D\uFE0F', title: 'Wrong menu', description: 'AI invents dishes, lists outdated prices, or attributes another restaurant\'s menu to yours.' },
  { icon: '\u274C', title: '"Permanently closed"', description: 'The most damaging hallucination. AI says you\'re closed when you\'re fully operational.' },
  { icon: '\uD83D\uDE45', title: 'Wrong policies', description: '"No walk-ins," "cash only," "no outdoor seating" — AI invents policies you don\'t have.' },
  { icon: '\uD83C\uDFC6', title: 'Competitor recommendations', description: 'AI recommends your competitor for the exact service or cuisine you\'re known for.' },
];

const HOW_IT_WORKS = [
  { step: 1, title: 'Run a free scan', detail: 'Enter your business name. We query 6 AI engines in 8 seconds and show you exactly what they say.' },
  { step: 2, title: 'See the errors', detail: 'Wrong hours? Missing menu? Competitor mentioned instead of you? We surface every hallucination with severity ranking.' },
  { step: 3, title: 'Fix with one click', detail: 'Auto-generated correction content: GBP posts, schema updates, llms.txt entries. You approve, we publish.' },
  { step: 4, title: 'Monitor weekly', detail: 'Automated scans track changes across all AI engines. Get alerts when something new goes wrong.' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default async function CityPage({ params }: PageProps) {
  const { city } = await params;
  const metro = TRACKED_METROS.find((m) => m.slug === city);
  if (!metro) notFound();

  return (
    <>
      <MarketingNav />

      <PageHero
        label={`${metro.city.toUpperCase()}, ${metro.stateCode}`}
        titleClassName="m-text-shimmer"
        title={<>AI Visibility Monitoring for Restaurants in {metro.city}</>}
        subtitle={`${metro.restaurants} restaurants. ${metro.aiSearchVolume} AI-assisted searches per month. Is AI getting yours right?`}
      />

      {/* ── City Stats ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-green)">{metro.city.toUpperCase()} BY THE NUMBERS</SectionLabel>

          <div className="m-city-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 40 }}>
            {[
              { label: 'Metro Population', value: metro.population },
              { label: 'Restaurants', value: metro.restaurants },
              { label: 'AI Searches/mo', value: metro.aiSearchVolume },
              { label: 'Top Cuisines', value: metro.topCuisines.length.toString() },
            ].map((stat) => (
              <div key={stat.label} className="m-card m-reveal" style={{ padding: '24px 20px', borderRadius: 10, textAlign: 'center' }}>
                <p className="m-display" style={{ fontSize: 28, color: 'var(--m-green)', margin: 0, marginBottom: 8 }}>{stat.value}</p>
                <p className="m-mono" style={{ fontSize: 11, color: 'var(--m-text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="m-card m-reveal" style={{ borderLeft: '4px solid var(--m-green)', borderRadius: 12, padding: '24px 28px' }}>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', margin: 0 }}>
              {metro.localInsight}
            </p>
          </div>
        </div>
      </section>

      {/* ── Top Cuisines ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal-left" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-green)">TOP CUISINES AT RISK</SectionLabel>
          <h2 className="m-display" style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', marginBottom: 32 }}>
            Most-searched cuisines in {metro.city}
          </h2>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {metro.topCuisines.map((cuisine) => (
              <span key={cuisine} className="m-card" style={{ padding: '12px 24px', borderRadius: 8, fontSize: 15, fontWeight: 600, color: 'var(--m-text-primary)', borderLeft: '3px solid var(--m-green)' }}>
                {cuisine}
              </span>
            ))}
          </div>

          <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--m-text-muted)', marginTop: 24, maxWidth: 600 }}>
            These are the cuisines most frequently searched via AI assistants in {metro.city}. If your restaurant serves any of these, AI accuracy directly impacts your foot traffic.
          </p>
        </div>
      </section>

      {/* ── Common Problems ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal-right" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-red)">COMMON AI ERRORS</SectionLabel>
          <h2 className="m-display" style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', marginBottom: 32 }}>
            What AI gets wrong about {metro.city} restaurants
          </h2>

          <div className="m-city-problems-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {COMMON_PROBLEMS.map((p) => (
              <div key={p.title} className="m-card m-reveal" style={{ padding: '24px 20px', borderRadius: 10 }}>
                <p style={{ fontSize: 28, margin: 0, marginBottom: 12 }}>{p.icon}</p>
                <h3 className="m-display" style={{ fontSize: 16, marginBottom: 8 }}>{p.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--m-text-secondary)', margin: 0 }}>{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-green)">HOW IT WORKS</SectionLabel>
          <h2 className="m-display" style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', marginBottom: 32 }}>
            Fix your AI visibility in {metro.city}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step} className="m-card m-reveal" style={{ borderRadius: 12, padding: '24px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--m-green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
                  {s.step}
                </div>
                <div>
                  <h3 className="m-display" style={{ fontSize: 17, marginBottom: 6 }}>{s.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--m-text-secondary)', margin: 0 }}>{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Other Cities ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-green)">OTHER CITIES</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {TRACKED_METROS.filter((m) => m.slug !== metro.slug).map((m) => (
              <a key={m.slug} href={`/for/${m.slug}`} className="m-btn-secondary" style={{ fontSize: 14, padding: '10px 20px', textDecoration: 'none' }}>
                {m.city}, {m.stateCode}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section
        style={{
          background: 'linear-gradient(160deg, #F0F4E8 0%, #E4F5EC 50%, #E8F0F8 100%)',
          textAlign: 'center',
          padding: '80px 24px',
        }}
      >
        <h2 className="m-display" style={{ maxWidth: 700, marginLeft: 'auto', marginRight: 'auto', marginBottom: 20 }}>
          See what AI says about your {metro.city} restaurant.
        </h2>
        <p style={{ color: 'var(--m-text-secondary)', fontSize: 17, lineHeight: 1.7, marginBottom: 32, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
          Free AI audit. 8 seconds. No account required.
        </p>
        <a href={`/scan?city=${encodeURIComponent(metro.city)}`} className="m-btn-primary" style={{ fontSize: 16, padding: '16px 36px', textDecoration: 'none' }}>
          Scan My {metro.city} Restaurant {'\u2192'}
        </a>
      </section>

      <MarketingFooter />

      {/* ── Responsive ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 900px) {
          .m-city-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .m-city-problems-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .m-city-stats-grid { grid-template-columns: 1fr !important; }
        }
      ` }} />
    </>
  );
}
