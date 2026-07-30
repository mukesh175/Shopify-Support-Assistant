'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Admin nav. Hidden on public pages (e.g. /privacy) which are viewed outside
// the Shopify admin.
const PUBLIC_PREFIXES = ['/privacy'];

export default function AppNav() {
  const pathname = usePathname();
  if (PUBLIC_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  return (
    <nav
      style={{
        background: '#fff',
        borderBottom: '1px solid #e1e3e5',
        padding: '0 20px',
        display: 'flex',
        gap: 4,
        alignItems: 'center',
        height: 52,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <span style={{ fontWeight: 700, marginRight: 16 }}>⚡ Zappy</span>
      <NavLink href="/" label="Home" />
      <NavLink href="/faqs" label="Knowledge base" />
      <NavLink href="/analytics" label="Analytics" />
    </nav>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        textDecoration: 'none',
        color: '#42474c',
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      {label}
    </Link>
  );
}
