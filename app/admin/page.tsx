import { redirect } from 'next/navigation';

/**
 * Admin index — redirects to the most useful view (customers).
 * Sprint D (L1).
 */
export default function AdminPage() {
  redirect('/admin/customers');
}
