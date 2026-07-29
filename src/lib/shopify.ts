import '@shopify/shopify-api/adapters/web-api';
import {
  shopifyApi,
  LATEST_API_VERSION,
  Session,
} from '@shopify/shopify-api';

// Central Shopify API client. Uses the web-api adapter which works on Vercel's
// serverless/edge runtime. Auth strategy = managed installation + token
// exchange (the current recommended default for embedded apps).
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: (process.env.SCOPES ?? 'read_orders,read_customers').split(','),
  hostName: (process.env.SHOPIFY_APP_URL ?? '').replace(/^https?:\/\//, ''),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

export { Session };
