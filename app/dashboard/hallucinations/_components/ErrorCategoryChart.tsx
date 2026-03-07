'use client';

import {
  buildCategoryBreakdown,
  getCategoryLabel,
  getCategoryColor,
  getTopCategories,
} from '@/lib/services/error-category-breakdown';

// ---------------------------------------------------------------------------
// S56: ErrorCategoryChart — Bar chart showing error distribution by category
// ---------------------------------------------------------------------------

interface ErrorCategoryChartProps {
  errors: Array<{ category: string | null }>;
}

export default function ErrorCategoryChart({ errors }: ErrorCategoryChartProps) {
  const breakdown = buildCategoryBreakdown(errors);
  if (breakdown.total === 0) return null;

  const topCats = getTopCategories(breakdown, 5);
  const maxCount = topCats[0]?.count ?? 1;

  return (
    <div
      className="rounded-xl border border-white/10 bg-slate-900/50 p-5"
      data-testid="error-category-chart"
    >
      <h3 className="text-sm font-semibold text-white mb-4">
        Errors by Category
      </h3>

      <div className="space-y-3" role="img" aria-label="Error category breakdown">
        <span className="sr-only">
          {topCats.map(c => `${getCategoryLabel(c.category)}: ${c.count} (${c.percentage}%)`).join(', ')}
        </span>
        {topCats.map((cat) => (
          <div key={cat.category} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">
                {getCategoryLabel(cat.category)}
              </span>
              <span className="text-slate-500">
                {cat.count} ({cat.percentage}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(cat.count / maxCount) * 100}%`,
                  backgroundColor: getCategoryColor(cat.category),
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {breakdown.total} total error{breakdown.total === 1 ? '' : 's'} across {breakdown.categories.length} categor{breakdown.categories.length === 1 ? 'y' : 'ies'}
      </p>
    </div>
  );
}
