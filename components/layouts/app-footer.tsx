import Link from 'next/link';

import { PRIVACY_HREF, TERMS_HREF } from '@/lib/constants';

export function AppFooter() {
  return (
    <footer className="text-muted-foreground border-border flex flex-wrap items-center gap-x-2 border-t px-6 py-4 text-xs">
      <Link
        href={PRIVACY_HREF}
        className="hover:text-foreground hover:underline"
      >
        Privacy Policy
      </Link>
      <span aria-hidden>·</span>
      <Link href={TERMS_HREF} className="hover:text-foreground hover:underline">
        Terms of Service
      </Link>
      <span aria-hidden>·</span>
      <span>© {new Date().getFullYear()} Student Government</span>
    </footer>
  );
}
