'use client';

import { useState, useTransition, useCallback } from 'react';
import type { MenuExtractedItem, MenuWorkspaceData } from '@/lib/types/menu';
import { updateMenuItems, autoTagDietaryInfo } from '../actions';
import { DIETARY_TAG_OPTIONS } from '@/lib/constants/dietary-tags';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MenuItemEditorProps {
  menu: MenuWorkspaceData;
  onMenuUpdated: (menu: MenuWorkspaceData) => void;
}

interface ItemEdit {
  price?: string;
  description?: string;
  dietary_tags?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIETARY_LABELS: Record<string, string> = {
  'vegan': 'Vegan',
  'vegetarian': 'Vegetarian',
  'gluten-free': 'Gluten-Free',
  'halal': 'Halal',
  'kosher': 'Kosher',
  'dairy-free': 'Dairy-Free',
  'nut-free': 'Nut-Free',
  'spicy': 'Spicy',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MenuItemEditor({ menu, onMenuUpdated }: MenuItemEditorProps) {
  const items = menu.extracted_data?.items ?? [];
  const categories = [...new Set(items.map((i) => i.category))];

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<ItemEdit>({});
  const [isSaving, startSaveTransition] = useTransition();

  // AI dietary tagger state
  const [isTagging, startTagTransition] = useTransition();
  const [dietarySuggestions, setDietarySuggestions] = useState<Map<string, string[]>>(new Map());
  const [tagError, setTagError] = useState<string | null>(null);

  // Search/filter
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    if (selectedCategory && item.category !== selectedCategory) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Edit handlers ────────────────────────────────────────────────────────

  const startEditing = useCallback((item: MenuExtractedItem) => {
    setEditingId(item.id);
    setEdits({
      price: item.price ?? '',
      description: item.description ?? '',
      dietary_tags: item.dietary_tags ?? [],
    });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEdits({});
  }, []);

  const saveItem = useCallback(() => {
    if (!editingId) return;
    startSaveTransition(async () => {
      const result = await updateMenuItems(menu.id, [
        { id: editingId, ...edits },
      ]);
      if (result.success) {
        onMenuUpdated(result.menu);
        setEditingId(null);
        setEdits({});
      }
    });
  }, [editingId, edits, menu.id, onMenuUpdated]);

  const toggleDietaryTag = useCallback((tag: string) => {
    setEdits((prev) => {
      const current = prev.dietary_tags ?? [];
      const next = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag];
      return { ...prev, dietary_tags: next };
    });
  }, []);

  // ── AI dietary tagger ────────────────────────────────────────────────────

  const runAITagger = useCallback(() => {
    setTagError(null);
    startTagTransition(async () => {
      const result = await autoTagDietaryInfo(menu.id);
      if (result.success) {
        const map = new Map<string, string[]>();
        for (const s of result.suggestions) {
          map.set(s.id, s.dietary_tags);
        }
        setDietarySuggestions(map);
      } else {
        setTagError(result.error);
      }
    });
  }, [menu.id]);

  const acceptAllDietarySuggestions = useCallback(() => {
    if (dietarySuggestions.size === 0) return;
    startSaveTransition(async () => {
      const updates = Array.from(dietarySuggestions.entries()).map(([id, tags]) => {
        const existing = items.find((i) => i.id === id)?.dietary_tags ?? [];
        const merged = [...new Set([...existing, ...tags])];
        return { id, dietary_tags: merged };
      });
      const result = await updateMenuItems(menu.id, updates);
      if (result.success) {
        onMenuUpdated(result.menu);
        setDietarySuggestions(new Map());
      }
    });
  }, [dietarySuggestions, items, menu.id, onMenuUpdated]);

  const dismissDietarySuggestions = useCallback(() => {
    setDietarySuggestions(new Map());
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Menu item editor"
      className="rounded-2xl bg-surface-dark border border-white/5 p-6 space-y-5 mt-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-white">Edit Menu Items</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Update prices, descriptions, and dietary tags. Changes are saved to your published menu.
          </p>
        </div>
        <button
          onClick={runAITagger}
          disabled={isTagging}
          className="inline-flex items-center gap-1.5 rounded-lg bg-electric-indigo/15 px-3 py-1.5 text-xs font-medium text-electric-indigo hover:bg-electric-indigo/25 transition disabled:opacity-50"
        >
          {isTagging ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-electric-indigo border-t-transparent" />
              Detecting dietary info…
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.683a1 1 0 0 1 .633.633l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.633.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.184.551a1 1 0 0 0 1.898 0l.184-.551a1 1 0 0 1 .633-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.184a1 1 0 0 1-.633-.633l-.184-.55Z" />
              </svg>
              AI: Detect dietary tags (1 credit)
            </>
          )}
        </button>
      </div>

      {/* AI dietary suggestions banner */}
      {dietarySuggestions.size > 0 && (
        <div className="rounded-xl bg-electric-indigo/10 border border-electric-indigo/20 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-electric-indigo">
                AI detected dietary tags for {dietarySuggestions.size} item{dietarySuggestions.size !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Review the suggestions below. Accept all or edit individual items to adjust.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={acceptAllDietarySuggestions}
                disabled={isSaving}
                className="rounded-lg bg-truth-emerald/15 px-3 py-1 text-xs font-medium text-truth-emerald hover:bg-truth-emerald/25 transition disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Accept all'}
              </button>
              <button
                onClick={dismissDietarySuggestions}
                className="rounded-lg bg-white/5 px-3 py-1 text-xs font-medium text-slate-400 hover:text-white transition"
              >
                Dismiss
              </button>
            </div>
          </div>
          {/* Preview of suggestions */}
          <div className="flex flex-wrap gap-2">
            {Array.from(dietarySuggestions.entries()).slice(0, 8).map(([id, tags]) => {
              const item = items.find((i) => i.id === id);
              return (
                <span key={id} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-300">
                  {item?.name}: {tags.map((t) => DIETARY_LABELS[t] ?? t).join(', ')}
                </span>
              );
            })}
            {dietarySuggestions.size > 8 && (
              <span className="text-xs text-slate-500">+{dietarySuggestions.size - 8} more</span>
            )}
          </div>
        </div>
      )}

      {tagError && (
        <p className="text-xs text-red-400">{tagError}</p>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-electric-indigo focus:outline-none w-48"
        />
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={[
              'rounded-full px-2.5 py-0.5 text-xs font-medium transition',
              selectedCategory === null
                ? 'bg-electric-indigo/15 text-electric-indigo'
                : 'bg-white/5 text-slate-400 hover:text-white',
            ].join(' ')}
          >
            All ({items.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={[
                'rounded-full px-2.5 py-0.5 text-xs font-medium transition',
                selectedCategory === cat
                  ? 'bg-electric-indigo/15 text-electric-indigo'
                  : 'bg-white/5 text-slate-400 hover:text-white',
              ].join(' ')}
            >
              {cat} ({items.filter((i) => i.category === cat).length})
            </button>
          ))}
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-1">
        {filteredItems.map((item) => {
          const isEditing = editingId === item.id;
          const aiSuggested = dietarySuggestions.get(item.id);

          return (
            <div
              key={item.id}
              className={[
                'rounded-xl border p-4 transition',
                isEditing
                  ? 'border-electric-indigo/30 bg-electric-indigo/5'
                  : aiSuggested
                    ? 'border-electric-indigo/15 bg-electric-indigo/[0.03]'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]',
              ].join(' ')}
            >
              {isEditing ? (
                /* ── Editing mode ──────────────────────────────────────── */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white">{item.name}</p>
                    <span className="text-xs text-slate-500">{item.category}</span>
                  </div>

                  {/* Price + Description */}
                  <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Price</label>
                      <input
                        type="text"
                        value={edits.price ?? ''}
                        onChange={(e) => setEdits((p) => ({ ...p, price: e.target.value }))}
                        placeholder="$0.00"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-electric-indigo focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Description</label>
                      <input
                        type="text"
                        value={edits.description ?? ''}
                        onChange={(e) => setEdits((p) => ({ ...p, description: e.target.value }))}
                        placeholder="Add a description…"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-electric-indigo focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Dietary tags checkboxes */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Dietary Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {DIETARY_TAG_OPTIONS.map((tag) => {
                        const checked = (edits.dietary_tags ?? []).includes(tag);
                        return (
                          <label
                            key={tag}
                            className={[
                              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs cursor-pointer transition border',
                              checked
                                ? 'bg-truth-emerald/15 border-truth-emerald/30 text-truth-emerald'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20',
                            ].join(' ')}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDietaryTag(tag)}
                              className="sr-only"
                            />
                            {checked ? '✓' : '○'} {DIETARY_LABELS[tag] ?? tag}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Save / Cancel */}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={cancelEditing}
                      disabled={isSaving}
                      className="rounded-lg bg-white/5 px-3 py-1 text-xs font-medium text-slate-400 hover:text-white transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveItem}
                      disabled={isSaving}
                      className="rounded-lg bg-truth-emerald/15 px-3 py-1 text-xs font-medium text-truth-emerald hover:bg-truth-emerald/25 transition disabled:opacity-50"
                    >
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Display mode ──────────────────────────────────────── */
                <div
                  className="flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => startEditing(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && startEditing(item)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-white truncate">{item.name}</p>
                      {item.price && (
                        <span className="text-xs text-slate-400 shrink-0">{item.price}</span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{item.description}</p>
                    )}
                    {/* Tags row */}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs text-slate-600">{item.category}</span>
                      {(item.dietary_tags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex rounded-full bg-truth-emerald/10 px-1.5 py-0.5 text-[10px] text-truth-emerald"
                        >
                          {DIETARY_LABELS[tag] ?? tag}
                        </span>
                      ))}
                      {aiSuggested && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-electric-indigo/10 px-1.5 py-0.5 text-[10px] text-electric-indigo">
                          AI: {aiSuggested.map((t) => DIETARY_LABELS[t] ?? t).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 shrink-0 mt-0.5">Edit</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-4">No items match your search.</p>
      )}
    </section>
  );
}
