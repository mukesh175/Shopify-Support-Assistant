import type { Metadata } from 'next';
import '@shopify/polaris/build/esm/styles.css';
import PolarisProvider from './PolarisProvider';
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
      <body>
        <PolarisProvider>
          <AppNav />
          {children}
        </PolarisProvider>
      </body>
    </html>
  );
}
