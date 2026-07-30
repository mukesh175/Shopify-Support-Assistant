import { NextRequest, NextResponse } from 'next/server';
import { getShopToken } from '@/lib/auth/session';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { LATEST_API_VERSION } from '@shopify/shopify-api';

export const runtime = 'nodejs';

// TEMPORARY DEBUG ENDPOINT — remove before production.
// Visit: /api/debug-order?shop=YOUR-STORE.myshopify.com&email=you@example.com
// It shows: stored scopes, whether the token can read orders, raw API errors,
// and how many orders come back. This tells us exactly why lookups fail.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shopDomain = url.searchParams.get('shop');
  const email = (url.searchParams.get('email') || '').toLowerCase().trim();
  if (!shopDomain) return NextResponse.json({ error: 'add ?shop=your-store.myshopify.com' });

  // what scopes did we store at install?
  const rows = await db
    .select()
    .from(schema.shops)
    .where(eq(schema.shops.shopDomain, shopDomain))
    .limit(1);
  const shopRow = rows[0];

  const token = await getShopToken(shopDomain);
  if (!token) {
    return NextResponse.json({
      installed: !!shopRow,
      storedScope: shopRow?.scope ?? null,
      error: 'No usable access token (app may need reinstall/re-auth).',
    });
  }

  // 1) Ask Shopify what scopes THIS token actually has
  let grantedScopes: any = null;
  try {
    const scopeRes = await fetch(
      `https://${shopDomain}/admin/oauth/access_scopes.json`,
      { headers: { 'X-Shopify-Access-Token': token } }
    );
    grantedScopes = await scopeRes.json();
  } catch (e: any) {
    grantedScopes = { error: String(e) };
  }

  // 2) Try a broad orders query (no email) to see if we can read orders at all
  const QUERY = /* GraphQL */ `
    query($q: String) {
      orders(first: 5, query: $q, sortKey: CREATED_AT, reverse: true) {
        edges { node { name email customer { email } createdAt displayFulfillmentStatus } }
      }
    }
  `;
  async function run(q: string | null) {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${LATEST_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token! },
        body: JSON.stringify({ query: QUERY, variables: { q } }),
      }
    );
    const json = await res.json();
    return {
      httpStatus: res.status,
      errors: json.errors ?? null,
      count: json?.data?.orders?.edges?.length ?? 0,
      orders: (json?.data?.orders?.edges ?? []).map((e: any) => ({
        name: e.node.name,
        orderEmail: e.node.email,
        customerEmail: e.node.customer?.email,
        status: e.node.displayFulfillmentStatus,
      })),
    };
  }

  const allOrders = await run(null);
  const byEmail = email ? await run(`email:'${email}'`) : null;

  return NextResponse.json({
    shopDomain,
    installedScope: shopRow?.scope ?? null,
    grantedScopes,
    allOrders,
    byEmail,
    hint:
      allOrders.errors
        ? 'GraphQL errors above — likely missing read_orders scope. Reinstall the app to grant it.'
        : allOrders.count === 0
        ? 'Token works but store has 0 orders visible to the app. Orders older than 60 days need read_all_orders scope; otherwise create a recent real order.'
        : byEmail && byEmail.count === 0
        ? 'Orders exist but none match that email. Check the orders list above for the actual email on the order.'
        : 'Lookup should be working — compare the emails above.',
  });
}
