import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, ensureOfflineToken, getShopToken, errorResponse } from '@/lib/auth/session';
import { listCollections } from '@/lib/shopify/products';

export const runtime = 'nodejs';

/**
 * The shop's collections, for the dropdown on the settings screen.
 *
 * A list rather than a picker: choosing one of a shop's own collections is a
 * decision better made by seeing them all at once, and most shops have few
 * enough that a search would be in the way.
 */
export async function GET(req: NextRequest) {
  try {
    const { token, shopDomain } = await verifySessionToken(req);
    await ensureOfflineToken(token, shopDomain);
    const offline = await getShopToken(shopDomain);
    if (!offline) return NextResponse.json({ collections: [] });
    return NextResponse.json({ collections: await listCollections(shopDomain, offline) });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}
