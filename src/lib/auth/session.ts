import { shopify } from '@/lib/shopify';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from './crypto';

const TOKEN_URL = (shop: string) => `https://${shop}/admin/oauth/access_token`;
// Refresh a bit before the 60-min expiry to avoid mid-request expiry.
const REFRESH_BUFFER_MS = 2 * 60 * 1000;

/**
 * Verify the App Bridge session token (JWT) from the embedded admin frontend.
 */
export async function verifySessionToken(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing session token');
  const payload = await shopify.session.decodeSessionToken(token);
  const shopDomain = new URL(payload.dest).host;
  return { payload, token, shopDomain };
}

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
};

// Exchange a session token for an EXPIRING offline access token (expiring=1).
// Returns { access_token, refresh_token, expires_in, ... }.
async function tokenExchangeExpiring(shopDomain: string, sessionToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL(shopDomain), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: sessionToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
      requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
      expiring: true,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Use a refresh token to obtain a fresh access + refresh token pair.
async function refreshAccessToken(shopDomain: string, refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL(shopDomain), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function persistTokens(shopDomain: string, t: TokenResponse) {
  const expiresAt = t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : null;
  const row = {
    shopDomain,
    accessTokenEnc: encrypt(t.access_token),
    refreshTokenEnc: t.refresh_token ? encrypt(t.refresh_token) : null,
    scope: t.scope ?? process.env.SCOPES ?? null,
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
        refreshTokenEnc: row.refreshTokenEnc,
        scope: row.scope,
        tokenExpiresAt: row.tokenExpiresAt,
        uninstalledAt: null,
      },
    });
}

/**
 * Called during an admin session: ensures we hold a valid EXPIRING offline
 * token. If we don't have one (or it's a legacy/expired one), exchange the
 * session token for a fresh expiring token pair.
 */
export async function ensureOfflineToken(sessionToken: string, shopDomain: string) {
  const rows = await db.select().from(schema.shops).where(eq(schema.shops.shopDomain, shopDomain)).limit(1);
  const shop = rows[0];

  const hasFreshExpiring =
    shop &&
    !shop.uninstalledAt &&
    shop.refreshTokenEnc && // must be an expiring token (has refresh token)
    shop.tokenExpiresAt &&
    shop.tokenExpiresAt.getTime() - REFRESH_BUFFER_MS > Date.now();

  if (hasFreshExpiring) return shop;

  // Otherwise (no token, legacy non-expiring token, or expired): re-exchange.
  const t = await tokenExchangeExpiring(shopDomain, sessionToken);
  await persistTokens(shopDomain, t);
  return (await db.select().from(schema.shops).where(eq(schema.shops.shopDomain, shopDomain)).limit(1))[0];
}

/**
 * Load a usable access token for Admin API calls (used by the customer-facing
 * app proxy). Auto-refreshes via the refresh token when the access token is
 * expired or about to expire. Returns null if we can't get a valid token.
 */
export async function getShopToken(shopDomain: string): Promise<string | null> {
  const rows = await db.select().from(schema.shops).where(eq(schema.shops.shopDomain, shopDomain)).limit(1);
  const shop = rows[0];
  if (!shop || shop.uninstalledAt) return null;

  const expired =
    !shop.tokenExpiresAt || shop.tokenExpiresAt.getTime() - REFRESH_BUFFER_MS <= Date.now();

  // Fresh enough → use it.
  if (!expired) {
    try { return decrypt(shop.accessTokenEnc); } catch { return null; }
  }

  // Expired/expiring → refresh if we have a refresh token.
  if (shop.refreshTokenEnc) {
    try {
      const refreshToken = decrypt(shop.refreshTokenEnc);
      const t = await refreshAccessToken(shopDomain, refreshToken);
      await persistTokens(shopDomain, t);
      return t.access_token;
    } catch {
      return null; // refresh failed (e.g. refresh token expired) → needs admin re-auth
    }
  }

  // Legacy non-expiring token with no refresh token: try using it, but it will
  // likely be rejected by Shopify. Returning it lets the caller surface the error.
  try { return decrypt(shop.accessTokenEnc); } catch { return null; }
}
