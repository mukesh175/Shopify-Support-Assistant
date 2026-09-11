import { NextRequest, NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/auth/appProxy';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * A shopper rating one answer 👍 or 👎.
 *
 * This is the only quality signal in the app that comes from the customer
 * rather than from our own guess at whether we answered — which is exactly
 * what makes it worth showing the merchant.
 *
 * The rating is written onto the answer's own log row. The row is matched on
 * both id and shop so a request signed for one store can never rate another
 * store's conversation, and re-rating simply overwrites: a shopper changing
 * their mind is not an error worth reporting.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (!verifyAppProxySignature(url)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const shopDomain = url.searchParams.get('shop');
  if (!shopDomain) return NextResponse.json({ ok: false }, { status: 400 });

  const body = await req.json().catch(() => ({} as any));
  const logId = Number(body.logId);
  const rating = body.rating === 'up' ? 'up' : body.rating === 'down' ? 'down' : null;
  if (!Number.isInteger(logId) || logId <= 0 || !rating) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await db
      .update(schema.queryLogs)
      .set({ rating })
      .where(and(eq(schema.queryLogs.id, logId), eq(schema.queryLogs.shopDomain, shopDomain)));
  } catch {
    // Never surface a failure here: the shopper has already been helped, and
    // "thanks" is the only honest thing to say to someone who just tapped 👍.
  }
  return NextResponse.json({ ok: true });
}
