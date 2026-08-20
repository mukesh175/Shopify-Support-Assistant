import { NextRequest, NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/auth/appProxy';
import { getShopToken } from '@/lib/auth/session';
import { lookupOrderItems } from '@/lib/shopify/orders';
import { db, schema } from '@/lib/db';
import { and, eq, gte, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

const CANCEL_REASONS = [
  'Ordered by mistake',
  'Found a better price',
  'Changing to a different item',
  'Taking too long to arrive',
  'Other',
];

const MAX_PER_SHOP_PER_DAY = 200;

// Once a shop has posted the goods, cancelling is not the right ask — a
// return is. Anything already on its way is steered there instead.
const UNCANCELLABLE = ['FULFILLED', 'PARTIALLY_FULFILLED', 'IN_PROGRESS'];

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
      kind: 'order_action_error',
      text: 'That is unavailable right now. Please contact the store directly.',
    });
  }

  const orderName = String(body.orderName ?? '').trim();
  const email = String(body.email ?? '').trim();
  if (!orderName || !email) {
    return NextResponse.json({
      kind: 'order_action_error',
      text: 'Please enter both your order number and email.',
    });
  }

  const order = await lookupOrderItems(shopDomain, token, orderName, email);
  if (!order.found) {
    return NextResponse.json({
      kind: 'order_action_error',
      text: "I couldn't find that order. Please check the order number and the email used at checkout.",
    });
  }

  // ---- Buy the same things again ----------------------------------------
  // A cart permalink needs no write access, so this works immediately rather
  // than becoming another request for the merchant to process.
  if (body.action === 'reorder') {
    const parts = (order.items ?? [])
      .filter((i) => i.variantId)
      .map((i) => `${i.variantId}:${i.quantity}`);

    if (!parts.length) {
      return NextResponse.json({
        kind: 'order_action_error',
        text: 'Those items are no longer available to buy again.',
      });
    }
    const skipped = (order.items ?? []).length - parts.length;

    return NextResponse.json({
      kind: 'reorder',
      text: skipped
        ? `I've put ${parts.length} item${parts.length > 1 ? 's' : ''} from ${order.name} back in your cart. ${skipped} ${skipped > 1 ? 'are' : 'is'} no longer available.`
        : `I've put everything from ${order.name} back in your cart.`,
      cartUrl: `https://${shopDomain}/cart/${parts.join(',')}`,
    });
  }

  // ---- Ask the merchant to cancel ---------------------------------------
  if (body.action === 'cancel_lookup') {
    if (UNCANCELLABLE.includes(String(order.fulfillmentStatus ?? '').toUpperCase())) {
      return NextResponse.json({
        kind: 'order_action_error',
        text: `${order.name} has already shipped, so it can't be cancelled. You can request a return once it arrives.`,
      });
    }
    return NextResponse.json({
      kind: 'cancel_confirm',
      text: `Why would you like to cancel ${order.name}?`,
      orderName: order.name,
      reasons: CANCEL_REASONS,
    });
  }

  if (body.action === 'cancel_submit') {
    const reason = String(body.reason ?? '').trim();
    const note = String(body.note ?? '').trim().slice(0, 500);
    if (!CANCEL_REASONS.includes(reason)) {
      return NextResponse.json({
        kind: 'order_action_error',
        text: 'Please choose a reason for cancelling.',
      });
    }
    if (UNCANCELLABLE.includes(String(order.fulfillmentStatus ?? '').toUpperCase())) {
      return NextResponse.json({
        kind: 'order_action_error',
        text: `${order.name} has already shipped, so it can't be cancelled.`,
      });
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
        kind: 'order_action_error',
        text: 'We could not submit that right now. Please contact the store directly.',
      });
    }

    await db.insert(schema.returnRequests).values({
      shopDomain,
      orderName: order.name ?? orderName,
      email: email.toLowerCase(),
      type: 'cancel',
      items: '[]',
      reason,
      note: note || null,
    });

    return NextResponse.json({
      kind: 'cancel_submitted',
      text: `Thanks — I've asked the store to cancel ${order.name}. They'll confirm by email. If it has already been packed they may not be able to stop it.`,
    });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
