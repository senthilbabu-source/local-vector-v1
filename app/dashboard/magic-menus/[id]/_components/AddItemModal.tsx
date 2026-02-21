'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateMenuItemSchema,
  type CreateMenuItemInput,
} from '@/lib/schemas/menu-items';
import { createMenuItem } from '../actions';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CategoryOption = {
  id: string;
  name: string;
};

interface Props {
  menuId: string;
  categories: CategoryOption[];
  /** Pre-select a specific category when the button is clicked from a category row */
  defaultCategoryId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass = (hasError: boolean) =>
  `w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:ring-2 ${
    hasError
      ? 'border-red-400 focus:ring-red-300'
      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-200'
  }`;

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export default function AddItemModal({ menuId, categories, defaultCategoryId }: Props) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateMenuItemInput>({
    resolver: zodResolver(CreateMenuItemSchema),
    defaultValues: {
      menu_id: menuId,
      category_id: defaultCategoryId ?? '',
    },
  });

  function handleClose() {
    setOpen(false);
    setServerError(null);
    reset({ menu_id: menuId, category_id: defaultCategoryId ?? '' });
  }

  async function onSubmit(data: CreateMenuItemInput) {
    setServerError(null);
    const result = await createMenuItem(data);
    if (result.success) {
      handleClose();
    } else {
      setServerError(result.error);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Item
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-900/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Add Menu Item</h2>
              <button
                onClick={handleClose}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {serverError && (
              <div
                role="alert"
                className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
              >
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {/* Hidden fields */}
              <input type="hidden" {...register('menu_id')} />

              {/* Item name */}
              <Field label="Item name" id="item-name" error={errors.name?.message}>
                <input
                  id="item-name"
                  type="text"
                  placeholder="e.g. Lamb Chops"
                  {...register('name')}
                  className={inputClass(!!errors.name)}
                />
              </Field>

              {/* Category */}
              <Field label="Category" id="item-category" error={errors.category_id?.message}>
                <select
                  id="item-category"
                  {...register('category_id')}
                  className={inputClass(!!errors.category_id)}
                >
                  <option value="" disabled>
                    Select a category…
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Price */}
              <Field label="Price ($)" id="item-price" error={errors.price?.message}>
                <input
                  id="item-price"
                  type="number"
                  min="0"
                  max="9999.99"
                  step="0.01"
                  placeholder="0.00"
                  {...register('price')}
                  className={inputClass(!!errors.price)}
                />
              </Field>

              {/* Description */}
              <Field
                label="Description (optional)"
                id="item-description"
                error={errors.description?.message}
              >
                <textarea
                  id="item-description"
                  rows={3}
                  placeholder="A brief, AI-readable description of the dish…"
                  {...register('description')}
                  className={`resize-none ${inputClass(!!errors.description)}`}
                />
              </Field>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || categories.length === 0}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Saving…' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
