/**
 * RoleBadge — Sprint 111
 *
 * Renders a role as a colored pill badge.
 * Static Tailwind classes — no dynamic construction (AI_RULES §12).
 */

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-indigo-500/15 text-indigo-300',
  admin: 'bg-blue-500/15 text-blue-300',
  analyst: 'bg-green-500/15 text-green-300',
  viewer: 'bg-slate-500/15 text-slate-300',
  member: 'bg-slate-500/15 text-slate-300', // legacy
};

interface RoleBadgeProps {
  role: string;
  'data-testid'?: string;
}

export default function RoleBadge({ role, 'data-testid': testId }: RoleBadgeProps) {
  const color = ROLE_COLORS[role] ?? ROLE_COLORS.viewer;
  const label = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${color}`}
    >
      {label}
    </span>
  );
}
