import { redirect } from 'next/navigation';

export default function RootPage() {
  // The middleware will redirect authenticated users to /dashboard and
  // unauthenticated users who reach /dashboard to /login.
  // Visiting "/" always sends you to /dashboard as the canonical entry point.
  redirect('/dashboard');
}
