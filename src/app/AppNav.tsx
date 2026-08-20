'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Navigation for an embedded app belongs in the Shopify admin sidebar, not in
 * a bar drawn inside our own iframe. App Bridge picks up <ui-nav-menu> and
 * renders it there, which is what merchants expect and what keeps our chrome
 * from competing with the admin's.
 *
 * The element renders nothing itself, so it is safe on public pages too, but
 * we still skip those to avoid advertising admin routes.
 */
const PUBLIC_PREFIXES = ['/privacy'];

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ui-nav-menu': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export default function AppNav() {
  const pathname = usePathname();
  if (PUBLIC_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  return (
    <ui-nav-menu>
      {/* App Bridge requires the first link to be the app root, marked rel="home". */}
      <Link href="/" rel="home">Home</Link>
      <Link href="/conversations">Conversations</Link>
      <Link href="/returns">Requests</Link>
      <Link href="/faqs">Knowledge base</Link>
      <Link href="/analytics">Analytics</Link>
      <Link href="/plans">Plans</Link>
      <Link href="/settings">Settings</Link>
    </ui-nav-menu>
  );
}
