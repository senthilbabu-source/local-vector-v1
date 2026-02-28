'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/api-usage', label: 'API Usage' },
  { href: '/admin/cron-health', label: 'Cron Health' },
  { href: '/admin/revenue', label: 'Revenue' },
];

/**
 * Minimal admin navigation bar. Sprint D (L1).
 */
export default function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-white/5 bg-surface-dark/80 backdrop-blur-md px-6" data-testid="admin-nav">
      <div className="mx-auto max-w-7xl flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white transition">
            &larr; Dashboard
          </Link>
          <span className="text-sm font-semibold text-white">Admin</span>
          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  pathname === link.href
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <span className="text-xs text-slate-500">{email}</span>
      </div>
    </nav>
  );
}
