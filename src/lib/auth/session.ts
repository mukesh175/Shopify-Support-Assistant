import { shopify } from '@/lib/shopify';
import { RequestedTokenType } from '@shopify/shopify-api';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from './crypto';

/**
 * Verify the App Bridge session token (JWT) sent by the embedded admin frontend
 * in the `Authorization: Bearer <token>` header. Returns the decoded payload
 * (contains `dest` = shop domain) or throws if invalid.
 */
export async function verifySessionToken(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing session token');

  // decodeSessionToken validates signature + expiry against the app secret.
  const payload = await shopify.session.decodeSessionToken(token);
  const shopDomain = new URL(payload.dest).host; // e.g. store.myshopify.com
  return { payload, token, shopDomain };
}

/**
 * Exchange a valid session token for an OFFLINE access token and upsert it
 * (encrypted) into Neon. Offline tokens let the customer-facing app proxy call
 * the Admin API later without a logged-in merchant.
 */
export async function ensureOfflineToken(sessionToken: string, shopDomain: string) {
  const existing = await db
    .select()
    .from(schema.shops)
    .where(eq(schema.shops.shopDomain, shopDomain))
    .limit(1);

  const valid =
    existing[0] &&
    !existing[0].uninstalledAt &&
    (!existing[0].tokenExpiresAt || existing[0].tokenExpiresAt > new Date());

  if (valid) return existing[0];

  const { session } = await shopify.auth.tokenExchange({
    shop: shopDomain,
    sessionToken,
    requestedTokenType: RequestedTokenType.OfflineAccessToken,
  });

  const expiresAt = session.expires ? new Date(session.expires) : null;
  const enc = encrypt(session.accessToken!);

  const row = {
    shopDomain,
    accessTokenEnc: enc,
    scope: session.scope ?? process.env.SCOPES ?? null,
    tokenExpiresAt: expiresAt,
    uninstalledAt: null,
  };

  await db
    .insert(schema.shops)
    .values(row)
    .onConflictDoUpdate({
      target: schema.shops.shopDomain,
      set: {
        accessTokenEnc: row.accessTokenEnc,
        scope: row.scope,
        tokenExpiresAt: row.tokenExpiresAt,
        uninstalledAt: null,
      },
    });

  return (
    await db
      .select()
      .from(schema.shops)
      .where(eq(schema.shops.shopDomain, shopDomain))
      .limit(1)
  )[0];
}

/** Load a shop's decrypted offline access token for Admin API calls. */
export async function getShopToken(shopDomain: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(schema.shops)
    .where(eq(schema.shops.shopDomain, shopDomain))
    .limit(1);
  const shop = rows[0];
  if (!shop || shop.uninstalledAt) return null;
  return decrypt(shop.accessTokenEnc);
}
