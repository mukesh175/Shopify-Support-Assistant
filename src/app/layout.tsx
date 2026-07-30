import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Support Assistant',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.SHOPIFY_API_KEY ?? '';
  return (
    <html lang="en">
      <head>
        <meta name="shopify-api-key" content={apiKey} />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
      </head>
      <body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          margin: 0,
          background: '#f1f2f4',
          color: '#1a1a1a',
        }}
      >
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
          <span style={{ fontWeight: 700, marginRight: 16 }}>🛟 Support Assistant</span>
          <NavLink href="/" label="Home" />
          <NavLink href="/faqs" label="Knowledge base" />
          <NavLink href="/analytics" label="Analytics" />
        </nav>
        {children}
      </body>
    </html>
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
