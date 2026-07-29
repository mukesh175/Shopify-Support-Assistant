import { NextRequest, NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/auth/appProxy';
import { getShopToken } from '@/lib/auth/session';
import { lookupOrder } from '@/lib/shopify/orders';
import { answerFromKnowledge } from '@/lib/ai/answer';
import { getActivePlan } from '@/lib/shopify/billing';
import { db, schema } from '@/lib/db';
import { and, eq, gte, sql } from 'drizzle-orm';

// Count how many queries this shop has logged in the current calendar month.
async function monthlyQueryCount(shopDomain: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.queryLogs)
    .where(
      and(
        eq(schema.queryLogs.shopDomain, shopDomain),
        gte(schema.queryLogs.createdAt, start)
      )
    );
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
    intent?: 'order' | 'faq';
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
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
    return NextResponse.json({ kind: 'order_status', text });
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
      const used = await monthlyQueryCount(shopDomain);
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
