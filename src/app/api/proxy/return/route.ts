import { NextRequest, NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/auth/appProxy';
import { getShopToken } from '@/lib/auth/session';
import { lookupOrderItems } from '@/lib/shopify/orders';
import { db, schema } from '@/lib/db';
import { and, eq, gte, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

const REASONS = [
  'Wrong size or fit',
  'Damaged or defective',
  'Wrong item sent',
  'Not as described',
  'No longer needed',
  'Other',
];

// A shopper who knows an order number and email could otherwise queue up
// unlimited requests. Cap what one shop can take in a day.
const MAX_PER_SHOP_PER_DAY = 200;

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (!verifyAppProxySignature(url)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const shopDomain = url.searchParams.get('shop');
  if (!shopDomain) return NextResponse.json({ error: 'missing shop' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const token = await getShopToken(shopDomain);
  if (!token) {
    return NextResponse.json({
      kind: 'return_error',
      text: 'Returns are unavailable right now. Please contact the store directly.',
    });
  }

  // ---- Step 1: find the order and list what can be returned ----
  if (body.action === 'lookup') {
    const orderName = String(body.orderName ?? '').trim();
    const email = String(body.email ?? '').trim();
    if (!orderName || !email) {
      return NextResponse.json({ kind: 'return_error', text: 'Please enter both your order number and email.' });
    }

    const order = await lookupOrderItems(shopDomain, token, orderName, email);
    if (!order.found || !order.items?.length) {
      return NextResponse.json({
        kind: 'return_error',
        text: "I couldn't find that order. Please check the order number and the email used at checkout.",
      });
    }

    return NextResponse.json({
      kind: 'return_items',
      text: `Which item${order.items.length > 1 ? 's' : ''} from ${order.name} would you like to return?`,
      orderName: order.name,
      items: order.items,
      reasons: REASONS,
    });
  }

  // ---- Step 2: record the request for the merchant ----
  if (body.action === 'submit') {
    const orderName = String(body.orderName ?? '').trim();
    const email = String(body.email ?? '').trim();
    const reason = String(body.reason ?? '').trim();
    const note = String(body.note ?? '').trim().slice(0, 500);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!orderName || !email || !items.length) {
      return NextResponse.json({ kind: 'return_error', text: 'Please choose at least one item to return.' });
    }
    if (!REASONS.includes(reason)) {
      return NextResponse.json({ kind: 'return_error', text: 'Please choose a reason for the return.' });
    }

    // Re-verify against Shopify: the item list arrives from the browser, so it
    // cannot be trusted to describe a real order the shopper actually owns.
    const order = await lookupOrderItems(shopDomain, token, orderName, email);
    if (!order.found) {
      return NextResponse.json({
        kind: 'return_error',
        text: "I couldn't verify that order. Please check the order number and email.",
      });
    }
    const valid = new Map((order.items ?? []).map((i) => [i.lineItemId, i]));
    const chosen = items
      .filter((i: any) => valid.has(String(i.lineItemId)))
      .map((i: any) => {
        const real = valid.get(String(i.lineItemId))!;
        const qty = Math.max(1, Math.min(Number(i.quantity) || 1, real.quantity));
        return {
          lineItemId: real.lineItemId,
          title: real.title,
          variantTitle: real.variantTitle,
          quantity: qty,
        };
      });
    if (!chosen.length) {
      return NextResponse.json({ kind: 'return_error', text: 'Those items are not on that order.' });
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [{ c }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.returnRequests)
      .where(and(
        eq(schema.returnRequests.shopDomain, shopDomain),
        gte(schema.returnRequests.createdAt, dayAgo)
      ));
    if (Number(c) >= MAX_PER_SHOP_PER_DAY) {
      return NextResponse.json({
        kind: 'return_error',
        text: 'We could not submit that right now. Please contact the store directly.',
      });
    }

    await db.insert(schema.returnRequests).values({
      shopDomain,
      orderName: order.name ?? orderName,
      email: email.toLowerCase(),
      items: JSON.stringify(chosen),
      reason,
      note: note || null,
    });

    return NextResponse.json({
      kind: 'return_submitted',
      text: `Thanks — your return request for ${order.name} has been sent to the store. They'll be in touch by email with the next steps.`,
    });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
