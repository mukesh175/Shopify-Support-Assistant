import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Support Assistant',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.SHOPIFY_API_KEY;
  return (
    <html lang="en">
      <head>
        {/* App Bridge v4 must load FIRST, before any other script, with the
            api-key meta. It provides shopify.idToken() = session token. */}
        <meta name="shopify-api-key" content={apiKey} />
        <Script
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          strategy="beforeInteractive"
        />
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
