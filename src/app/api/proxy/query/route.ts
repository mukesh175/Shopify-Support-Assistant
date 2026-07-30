import { NextRequest, NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/auth/appProxy';
import { getShopToken } from '@/lib/auth/session';
import { lookupOrder, listOrdersByEmail } from '@/lib/shopify/orders';
import { answerFromKnowledge, extractKeywords, rankProducts } from '@/lib/ai/answer';
import { getActivePlan } from '@/lib/shopify/billing';
import { recommendProducts } from '@/lib/shopify/products';
import { db, schema } from '@/lib/db';
import { and, eq, gte, sql } from 'drizzle-orm';

// Count queries of a given kind this calendar month.
async function monthlyCount(shopDomain: string, kind?: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const conds = [
    eq(schema.queryLogs.shopDomain, shopDomain),
    gte(schema.queryLogs.createdAt, start),
  ];
  if (kind) conds.push(eq(schema.queryLogs.kind, kind));
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.queryLogs)
    .where(and(...conds));
  return Number(rows[0]?.c ?? 0);
}

export const runtime = 'nodejs';

// Customer widget POSTs here (proxied by Shopify at /apps/support/query).
// Shopify appends the shop + a signature to the query string.
export async function POST(req: NextRequest) {
  const url = new URL(req.url);

  if (!verifyAppProxySignature(url)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  const shopDomain = url.searchParams.get('shop');
  if (!shopDomain) {
    return NextResponse.json({ error: 'missing shop' }, { status: 400 });
  }

  let body: {
    message?: string;
    orderName?: string;
    email?: string;
    intent?: 'order' | 'orders_by_email' | 'faq' | 'product';
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  // ---- List orders by email (customer doesn't know order number) ----
  if (body.intent === 'orders_by_email' && body.email) {
    const token = await getShopToken(shopDomain);
    if (!token) {
      return NextResponse.json({ kind: 'error', text: 'App not connected.' });
    }
    const orders = await listOrdersByEmail(shopDomain, token, body.email);
    await logQuery(shopDomain, 'list: ' + body.email, `${orders.length} orders`, 'order_status', orders.length > 0);
    return NextResponse.json({
      kind: 'order_list',
      text: orders.length
        ? 'Here are your recent orders — tap one to see its status:'
        : "I couldn't find any orders for that email. Please check the spelling, or the email used at checkout.",
      orders,
    });
  }

  // ---- Order status intent ----
  if (body.intent === 'order' && body.orderName && body.email) {
    const token = await getShopToken(shopDomain);
    if (!token) {
      return NextResponse.json(
        { kind: 'error', text: 'App not connected. Contact the store.' },
        { status: 200 }
      );
    }
    const order = await lookupOrder(shopDomain, token, body.orderName, body.email);
    let text: string;
    if (!order.found) {
      text =
        "I couldn't find an order matching that number and email. Please double-check both.";
    } else {
      const parts = [`Order ${order.name}: ${order.fulfillmentStatus?.toLowerCase()}`];
      if (order.trackingNumbers?.length) {
        parts.push(`Tracking: ${order.trackingNumbers.join(', ')}`);
      }
      if (order.trackingUrls?.length) parts.push(order.trackingUrls[0]);
      if (order.estimatedDelivery) {
        parts.push(
          `Estimated delivery: ${new Date(order.estimatedDelivery).toDateString()}`
        );
      }
      text = parts.join('\n');
    }

    await logQuery(shopDomain, body.orderName + ' / ' + body.email, text, 'order_status', order.found);
    return NextResponse.json({
      kind: 'order_status',
      text,
      timeline: order.found ? order.timeline : undefined,
      trackingUrl: order.trackingUrls?.[0] ?? undefined,
    });
  }

  // ---- Product recommendation intent ----
  if (body.intent === 'product') {
    const request = (body.message ?? '').trim();
    if (!request) {
      return NextResponse.json({ error: 'empty message' }, { status: 400 });
    }
    const token = await getShopToken(shopDomain);
    if (!token) {
      return NextResponse.json({ kind: 'error', text: 'App not connected.' });
    }
    const plan = await getActivePlan(shopDomain, token);

    // 0 = feature disabled on this plan; N = capped; null = unlimited
    if (plan.monthlyRecommendationLimit === 0) {
      return NextResponse.json({
        kind: 'recommend_locked',
        text: 'Product recommendations are available on the Pro plan.',
      });
    }
    if (plan.monthlyRecommendationLimit !== null) {
      const used = await monthlyCount(shopDomain, 'recommend');
      if (used >= plan.monthlyRecommendationLimit) {
        return NextResponse.json({
          kind: 'recommend_locked',
          text: "This store's product assistant is busy right now. Please browse the store or ask us directly.",
        });
      }
    }

    const products = await recommendProducts(shopDomain, token, request, {
      keywords: extractKeywords,
      rank: rankProducts,
    });

    await logQuery(shopDomain, request, `${products.length} products`, 'recommend', products.length > 0);
    return NextResponse.json({
      kind: 'recommend',
      text: products.length
        ? 'Here are a few that might fit:'
        : "I couldn't find a good match. Try different words, or browse the store.",
      products,
    });
  }

  // ---- FAQ intent (default) ----
  const message = (body.message ?? '').trim();
  if (!message) {
    return NextResponse.json({ error: 'empty message' }, { status: 400 });
  }

  // ---- Plan enforcement: free tier is capped per month ----
  const token = await getShopToken(shopDomain);
  if (token) {
    const plan = await getActivePlan(shopDomain, token);
    if (plan.monthlyQueryLimit !== null) {
      const used = await monthlyCount(shopDomain);
      if (used >= plan.monthlyQueryLimit) {
        // Soft-fail: still helpful to the customer, but nudges the merchant.
        return NextResponse.json({
          kind: 'limit',
          text: "Our assistant has reached this month's limit. Please contact the store directly and they'll be happy to help.",
        });
      }
    }
  }

  const faqRows = await db
    .select({ question: schema.faqs.question, answer: schema.faqs.answer })
    .from(schema.faqs)
    .where(and(eq(schema.faqs.shopDomain, shopDomain), eq(schema.faqs.enabled, true)));

  const { text } = await answerFromKnowledge(message, faqRows);
  const unresolved = text.includes('__UNRESOLVED__');
  const finalText = unresolved
    ? "I'm not sure about that one — I've noted it so the team can follow up. You can also email us directly."
    : text;

  await logQuery(shopDomain, message, finalText, unresolved ? 'unresolved' : 'faq', !unresolved);
  return NextResponse.json({
    kind: unresolved ? 'unresolved' : 'faq',
    text: finalText,
  });
}

async function logQuery(
  shopDomain: string,
  question: string,
  answer: string,
  kind: string,
  resolved: boolean
) {
  try {
    await db.insert(schema.queryLogs).values({ shopDomain, question, answer, kind, resolved });
  } catch {
    // logging must never break the customer response
  }
}
