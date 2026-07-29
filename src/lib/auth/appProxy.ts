import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Shopify App Proxy signs every proxied request with a `signature` query param.
 * Verify it so random internet traffic can't hit our customer endpoint.
 *
 * Algorithm: take all query params EXCEPT `signature`, sort them, concatenate
 * as key=value (no separators), HMAC-SHA256 with the app secret, hex-encode,
 * compare to the provided signature.
 * Docs: https://shopify.dev/docs/apps/build/online-store/display-dynamic-data
 */
export function verifyAppProxySignature(url: URL): boolean {
  const params = new URLSearchParams(url.search);
  const signature = params.get('signature');
  if (!signature) return false;
  params.delete('signature');

  const sorted = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('');

  const digest = createHmac('sha256', process.env.SHOPIFY_API_SECRET!)
    .update(sorted)
    .digest('hex');

  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
