import type { ReactNode } from 'react';

// Public layout — no getCurrentUser, no auth gate, no app chrome.
// Mirrors app/login/layout.tsx as the precedent for public-only routes.
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background min-h-dvh">
      <main className="mx-auto max-w-3xl px-4 py-12">{children}</main>
    </div>
  );
}
