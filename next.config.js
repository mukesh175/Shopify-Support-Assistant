/** @type {import('next').NextConfig} */
const nextConfig = {
  // Shopify embeds the admin UI inside an iframe on admin.shopify.com.
  // These headers allow that. App Bridge handles the frame-ancestors CSP too.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors https://admin.shopify.com https://*.myshopify.com;",
          },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
