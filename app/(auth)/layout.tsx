export const metadata = { title: 'Sign In | LocalVector.ai' };

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Bare passthrough — each auth page owns its own layout/centering.
  // login/page.tsx uses a full-screen split-screen layout.
  // register/page.tsx and signup/page.tsx each centre themselves.
  return <>{children}</>;
}
