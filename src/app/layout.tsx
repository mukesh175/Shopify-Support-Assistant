import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support Assistant',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.SHOPIFY_API_KEY ?? '';
  return (
    <html lang="en">
      <head>
        {/* App Bridge v4 requirements:
            1) the api-key meta tag, and
            2) the app-bridge.js script must be the FIRST script in <head>.
            We render a plain <script> (not next/script) to guarantee ordering. */}
        <meta name="shopify-api-key" content={apiKey} />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
      </head>
      <body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
          background: '#f6f6f7',
          color: '#1a1a1a',
        }}
      >
        {children}
      </body>
    </html>
  );
}
