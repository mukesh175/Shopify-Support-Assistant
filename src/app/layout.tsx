import type { Metadata } from 'next';
import AppNav from './AppNav';

export const metadata: Metadata = {
  title: 'Zappy',
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
        <AppNav />
        {children}
      </body>
    </html>
  );
}
