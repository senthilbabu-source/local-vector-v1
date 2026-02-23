'use client';

import { useState } from 'react';
import type { MenuWorkspaceData } from '@/lib/types/menu';
import UploadState from './UploadState';
import ReviewState from './ReviewState';
import LinkInjectionModal from './LinkInjectionModal';

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
        const done    = idx < currentIdx;
        const active  = idx === currentIdx;
        return (
          <div key={step.id} className="flex items-center">
            {/* Node */}
            <div
              className={[
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition',
                done   ? 'bg-truth-emerald text-white' :
                active ? 'bg-electric-indigo text-white' :
                         'bg-white/10 text-slate-500',
              ].join(' ')}
              aria-current={active ? 'step' : undefined}
            >
              {done ? '✓' : idx + 1}
            </div>
            {/* Label */}
            <span
              className={[
                'ml-1.5 text-xs font-medium',
                active ? 'text-white' : done ? 'text-truth-emerald' : 'text-slate-500',
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
  onOpenModal,
}: {
  menu: MenuWorkspaceData;
  locationName: string;
  onOpenModal: () => void;
}) {
  const injectionCount = menu.propagation_events.filter(
    (e) => e.event === 'link_injected'
  ).length;

  return (
    <section
      aria-label="Published menu"
      className="rounded-2xl bg-surface-dark border border-white/5 p-6 space-y-5"
    >
      {/* Success header */}
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

      {/* Propagation status */}
      <div className="flex flex-wrap gap-3">
        <PropagationPill
          label="Published"
          done={menu.propagation_events.some((e) => e.event === 'published')}
        />
        <PropagationPill
          label="Link injected"
          done={injectionCount > 0}
          count={injectionCount}
        />
        <PropagationPill
          label="Crawled"
          done={menu.propagation_events.some((e) => e.event === 'crawled')}
        />
        <PropagationPill
          label="Live in AI"
          done={menu.propagation_events.some((e) => e.event === 'live_in_ai')}
        />
      </div>

      {/* CTA */}
      <button
        onClick={onOpenModal}
        className="inline-flex items-center gap-2 rounded-xl bg-electric-indigo/10 border border-electric-indigo/30 px-4 py-2.5 text-xs font-semibold text-electric-indigo hover:bg-electric-indigo/20 transition"
      >
        Distribute to AI Engines →
      </button>
    </section>
  );
}

function PropagationPill({
  label,
  done,
  count,
}: {
  label: string;
  done: boolean;
  count?: number;
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        done ? 'bg-truth-emerald/15 text-truth-emerald' : 'bg-white/5 text-slate-500',
      ].join(' ')}
    >
      {done ? '✓' : '○'} {label}
      {done && count !== undefined && count > 0 && (
        <span className="tabular-nums">{count}×</span>
      )}
    </span>
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
  const [showInjectionModal, setShowInjectionModal] = useState(false);

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
            setShowInjectionModal(true);
          }}
        />
      )}

      {view === 'published' && menu && (
        <PublishedBanner
          menu={menu}
          locationName={locationName}
          onOpenModal={() => setShowInjectionModal(true)}
        />
      )}

      {showInjectionModal && menu?.public_slug && (
        <LinkInjectionModal
          menuId={menu.id}
          publicSlug={menu.public_slug}
          onClose={() => setShowInjectionModal(false)}
          onInjected={() => {
            // Optimistically append the link_injected event
            setMenu((prev) =>
              prev
                ? {
                    ...prev,
                    propagation_events: [
                      ...prev.propagation_events,
                      { event: 'link_injected', date: new Date().toISOString() },
                    ],
                  }
                : prev
            );
          }}
        />
      )}
    </div>
  );
}
