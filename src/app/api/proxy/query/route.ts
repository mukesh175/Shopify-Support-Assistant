import { NextRequest, NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/auth/appProxy';
import { getShopToken } from '@/lib/auth/session';
import { lookupOrder, listOrdersByEmail } from '@/lib/shopify/orders';
import { answerFromKnowledge, extractKeywords, rankProducts } from '@/lib/ai/answer';
import { getActivePlan } from '@/lib/shopify/billing';
import { PLANS } from '@/lib/plans';
import {
  recommendProducts,
  fetchCollections,
  fetchCollectionProducts,
} from '@/lib/shopify/products';
import { quickActionEnabled, ACTION_OFF } from '@/lib/shopQuickActions';
import { UNCOUNTED_KINDS } from '@/lib/usage';
import { db, schema } from '@/lib/db';
import { and, eq, gte, notInArray, sql } from 'drizzle-orm';

// Count queries of a given kind this calendar month. Rows that are our own
// failure never count — see UNCOUNTED_KINDS.
async function monthlyCount(shopDomain: string, kind?: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const conds = [
    eq(schema.queryLogs.shopDomain, shopDomain),
    gte(schema.queryLogs.createdAt, start),
    notInArray(schema.queryLogs.kind, UNCOUNTED_KINDS),
  ];
  if (kind) conds.push(eq(schema.queryLogs.kind, kind));
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.queryLogs)
    .where(and(...conds));
  return Number(rows[0]?.c ?? 0);
}

export const runtime = 'nodejs';
// The product finder makes two LLM calls and up to three Admin API calls in
// sequence, which does not fit Vercel's 10s default. Exceeding it returns an
// HTML gateway error the widget cannot parse, so the shopper sees a bare
// 'could not reach support' with nothing in our logs to explain it.
export const maxDuration = 60;

/**
 * Nothing here may reach the shopper as a crash.
 *
 * An unhandled throw becomes an HTML error page, and the widget can only parse
 * JSON — so every bug in this route showed up in the chat as "Sorry, I could
 * not reach support right now", indistinguishable from the shopper's wifi
 * dropping. The real error goes to the logs instead, where it can be fixed.
 */
export async function POST(req: NextRequest) {
  try {
    return await handleQuery(req);
  } catch (e) {
    console.error('[query] unhandled', e);
    return NextResponse.json({
      kind: 'error',
      text: "I'm having trouble right now. Please try again in a moment, or contact the store directly.",
    });
  }
}

// Customer widget POSTs here (proxied by Shopify at /apps/support/query).
// Shopify appends the shop + a signature to the query string.
async function handleQuery(req: NextRequest) {
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
    intent?:
      | 'order'
      | 'orders_by_email'
      | 'faq'
      | 'product'
      | 'collections'
      | 'collection_products';
    handle?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  // ---- Merchant has turned this button off ----
  // The widget hides it, but a stale page or a hand-made request could still
  // ask, so the answer comes from the setting rather than from the markup.
  const gated = {
    order: 'order',
    orders_by_email: 'order',
    product: 'product',
    collections: 'collections',
    collection_products: 'collections',
  } as const;
  const gate = body.intent ? gated[body.intent as keyof typeof gated] : undefined;
  if (gate && !(await quickActionEnabled(shopDomain, gate))) {
    return NextResponse.json(ACTION_OFF);
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

  // ---- Browse collections ----
  // Plain catalogue browsing: no model runs, so this is not counted against
  // the shop's monthly recommendation allowance.
  if (body.intent === 'collections') {
    const token = await getShopToken(shopDomain);
    if (!token) {
      return NextResponse.json({ kind: 'error', text: 'App not connected.' });
    }
    const collections = await fetchCollections(shopDomain, token);
    return NextResponse.json({
      kind: 'collections',
      text: collections.length
        ? 'Here is what we have — pick a category:'
        : "I couldn't load our categories right now. Tell me what you're looking for instead and I'll search.",
      collections,
    });
  }

  // ---- Products inside one collection ----
  if (body.intent === 'collection_products') {
    const handle = (body.handle ?? '').trim();
    if (!handle) {
      return NextResponse.json({ error: 'missing handle' }, { status: 400 });
    }
    const token = await getShopToken(shopDomain);
    if (!token) {
      return NextResponse.json({ kind: 'error', text: 'App not connected.' });
    }
    const { title, products } = await fetchCollectionProducts(shopDomain, token, handle);
    // Deliberately not logged: the monthly cap counts query-log rows, and
    // tapping through categories costs the shop nothing to answer.
    return NextResponse.json({
      kind: 'recommend',
      text: products.length
        ? (title ? `Popular in ${title}:` : 'Here are a few to look at:')
        : "That category looks empty right now. Try another one, or tell me what you're after.",
      products,
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

    const logId = await logQuery(shopDomain, request, `${products.length} products`, 'recommend', products.length > 0);
    return NextResponse.json({
      kind: 'recommend',
      text: products.length
        ? 'Here are a few that might fit:'
        : "I couldn't find a good match. Try different words, or browse the store.",
      products,
      logId,
    });
  }

  // ---- FAQ intent (default) ----
  const message = (body.message ?? '').trim();
  if (!message) {
    return NextResponse.json({ error: 'empty message' }, { status: 400 });
  }

  // ---- Plan enforcement: free tier is capped per month ----
  const token = await getShopToken(shopDomain);
  // Defaults to the free plan so an unresolvable token never unlocks paid
  // behaviour further down (e.g. multi-language replies).
  let plan = PLANS.free;
  if (token) {
    plan = await getActivePlan(shopDomain, token);
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

  const { text, provider } = await answerFromKnowledge(message, faqRows, plan.allLanguages);

  // A provider outage and a genuine gap in the knowledge base used to produce
  // the same reply, which made a shop with good answers look like it had none.
  // 'none' means every provider failed, so say that instead of implying the
  // store never wrote an answer.
  if (provider === 'none') {
    console.error('[query] all AI providers failed', {
      shopDomain,
      faqCount: faqRows.length,
    });
    const text = "I'm having trouble reaching our assistant right now. Please try again in a moment, or contact the store directly.";
    await logQuery(shopDomain, message, text, 'error', false);
    return NextResponse.json({ kind: 'error', text });
  }

  const unresolved = text.includes('__UNRESOLVED__');
  const finalText = unresolved
    ? "I'm not sure about that one — I've noted it so the team can follow up. You can also email us directly."
    : text;

  const logId = await logQuery(shopDomain, message, finalText, unresolved ? 'unresolved' : 'faq', !unresolved);
  return NextResponse.json({
    kind: unresolved ? 'unresolved' : 'faq',
    text: finalText,
    logId,
  });
}

/**
 * Record the exchange, and hand back the row id.
 *
 * The id goes to the widget so the shopper can rate that specific answer —
 * without it there is nothing to attach a 👍/👎 to. Null when logging failed,
 * which simply means no rating buttons: a lost rating must never cost the
 * shopper their answer.
 */
async function logQuery(
  shopDomain: string,
  question: string,
  answer: string,
  kind: string,
  resolved: boolean
): Promise<number | null> {
  try {
    const [row] = await db
      .insert(schema.queryLogs)
      .values({ shopDomain, question, answer, kind, resolved })
      .returning({ id: schema.queryLogs.id });
    return row?.id ?? null;
  } catch {
    // logging must never break the customer response
    return null;
  }
}
