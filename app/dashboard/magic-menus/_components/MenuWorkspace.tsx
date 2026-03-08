'use client';

import { useState } from 'react';
import type { MenuWorkspaceData } from '@/lib/types/menu';
import UploadState from './UploadState';
import ReviewState from './ReviewState';
import DistributionPanel from './DistributionPanel';
import MenuItemEditor from './MenuItemEditor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkspaceView = 'upload' | 'review' | 'published';

interface MenuWorkspaceProps {
  locationId: string;
  locationName: string;
  locationCity: string | null;
  initialMenu: MenuWorkspaceData | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveInitialView(menu: MenuWorkspaceData | null): WorkspaceView {
  if (!menu) return 'upload';
  if (menu.processing_status === 'review_ready') return 'review';
  if (menu.processing_status === 'published') return 'published';
  return 'upload';
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS: { id: WorkspaceView; label: string }[] = [
  { id: 'upload',    label: 'Upload' },
  { id: 'review',    label: 'AI Review' },
  { id: 'published', label: 'Published' },
];

function StepIndicator({ current }: { current: WorkspaceView }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <nav aria-label="Menu workflow steps" className="flex items-center gap-0 mb-6">
      {STEPS.map((step, idx) => {
        const done    = idx < currentIdx || (idx === currentIdx && current === 'published');
        const active  = idx === currentIdx && !done;
        return (
          <div key={step.id} className="flex items-center">
            {/* Node */}
            <div
              className={[
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition',
                done   ? 'bg-truth-emerald text-white' :
                active ? 'bg-electric-indigo text-white' :
                         'bg-white/10 text-slate-400',
              ].join(' ')}
              aria-current={active ? 'step' : undefined}
            >
              {done ? '✓' : idx + 1}
            </div>
            {/* Label */}
            <span
              className={[
                'ml-1.5 text-xs font-medium',
                active ? 'text-white' : done ? 'text-truth-emerald' : 'text-slate-400',
              ].join(' ')}
            >
              {step.label}
            </span>
            {/* Connector */}
            {idx < STEPS.length - 1 && (
              <div
                className={[
                  'mx-3 h-px w-8 flex-shrink-0 transition',
                  idx < currentIdx ? 'bg-truth-emerald' : 'bg-white/10',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Published banner (inline — simple enough to not warrant a separate file)
// ---------------------------------------------------------------------------

function PublishedBanner({
  menu,
  locationName,
  onReplace,
}: {
  menu: MenuWorkspaceData;
  locationName: string;
  onReplace: () => void;
}) {
  const events = menu.propagation_events ?? [];
  const injectionCount = events.filter(
    (e) => e.event === 'link_injected'
  ).length;

  return (
    <section
      aria-label="Published menu"
      className="rounded-2xl bg-surface-dark border border-white/5 p-6 space-y-5"
    >
      {/* Success header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-truth-emerald/15">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5 text-truth-emerald"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">
            Magic Menu is live!
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {locationName}&rsquo;s menu is published at{' '}
            <span className="font-mono text-slate-300">/m/{menu.public_slug}</span> and
            indexed for AI engines.
          </p>
        </div>
        </div>
        <button
          onClick={onReplace}
          className="shrink-0 text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-2"
        >
          Replace menu
        </button>
      </div>

      {/* Propagation status */}
      <PropagationChecklist
        events={events}
        injectionCount={injectionCount}
        publicSlug={menu.public_slug ?? ''}
      />
    </section>
  );
}

function PropagationChecklist({
  events,
  injectionCount,
  publicSlug,
}: {
  events: { event: string; date: string }[];
  injectionCount: number;
  publicSlug: string;
}) {
  const isPublished = events.some((e) => e.event === 'published');
  const isInjected = injectionCount > 0;
  const isCrawled = events.some((e) => e.event === 'crawled');
  const isLive = events.some((e) => e.event === 'live_in_ai');

  const steps: { done: boolean; label: string; hint: string }[] = [
    {
      done: isPublished,
      label: 'Published',
      hint: 'Your AI-readable menu page is live.',
    },
    {
      done: isInjected,
      label: 'Link added to your website',
      hint: isInjected
        ? `Link added ${injectionCount} time${injectionCount > 1 ? 's' : ''}.`
        : `Add a link to /m/${publicSlug} on your website or Google Business Profile so AI engines can find it.`,
    },
    {
      done: isCrawled,
      label: 'AI bots visited',
      hint: isCrawled
        ? 'AI search bots have crawled your menu page.'
        : 'Waiting for AI bots (GPTBot, GoogleBot, etc.) to visit your menu page. This usually takes a few days.',
    },
    {
      done: isLive,
      label: 'Confirmed in AI answers',
      hint: isLive
        ? 'AI engines are referencing your menu in search results.'
        : 'We\'ll check if AI engines like ChatGPT and Google AI cite your menu when people search. This can take 1–2 weeks.',
    },
  ];

  // Find the first incomplete step to highlight
  const nextIdx = steps.findIndex((s) => !s.done);

  return (
    <div className="space-y-2.5">
      {steps.map((step, idx) => (
        <div key={step.label} className="flex items-start gap-3">
          <div
            className={[
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs mt-0.5',
              step.done
                ? 'bg-truth-emerald/15 text-truth-emerald'
                : idx === nextIdx
                  ? 'bg-electric-indigo/20 text-electric-indigo ring-1 ring-electric-indigo/40'
                  : 'bg-white/5 text-slate-500',
            ].join(' ')}
          >
            {step.done ? '✓' : idx + 1}
          </div>
          <div className="min-w-0">
            <p
              className={[
                'text-xs font-medium',
                step.done ? 'text-truth-emerald' : idx === nextIdx ? 'text-white' : 'text-slate-400',
              ].join(' ')}
            >
              {step.label}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{step.hint}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MenuWorkspace
// ---------------------------------------------------------------------------

export default function MenuWorkspace({
  locationId,
  locationName,
  locationCity,
  initialMenu,
}: MenuWorkspaceProps) {
  const [view, setView] = useState<WorkspaceView>(deriveInitialView(initialMenu));
  const [menu, setMenu] = useState<MenuWorkspaceData | null>(initialMenu);

  return (
    <div>
      <StepIndicator current={view} />

      {view === 'upload' && (
        <UploadState
          locationId={locationId}
          locationName={locationName}
          locationCity={locationCity}
          onParseComplete={(updatedMenu) => {
            setMenu(updatedMenu);
            setView('review');
          }}
        />
      )}

      {view === 'review' && menu && (
        <ReviewState
          menu={menu}
          onPublished={(publicSlug) => {
            setMenu((prev) =>
              prev
                ? { ...prev, is_published: true, processing_status: 'published', public_slug: publicSlug, human_verified: true }
                : prev
            );
            setView('published');
          }}
        />
      )}

      {view === 'published' && menu && (
        <>
          <PublishedBanner menu={menu} locationName={locationName} onReplace={() => setView('upload')} />
          <MenuItemEditor menu={menu} onMenuUpdated={setMenu} />
          <DistributionPanel
            menuId={menu.id}
            publicSlug={menu.public_slug}
            contentHash={menu.content_hash}
            lastDistributedAt={menu.last_distributed_at}
            propagationEvents={menu.propagation_events ?? []}
          />
        </>
      )}
    </div>
  );
}
