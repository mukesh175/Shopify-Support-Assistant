import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, ensureOfflineToken, getShopToken, errorResponse } from '@/lib/auth/session';
import { getActivePlan } from '@/lib/shopify/billing';
import { PLANS } from '@/lib/plans';
import { db, schema } from '@/lib/db';
import { and, eq, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

// How long after its last config call we still consider the storefront widget
// live. A shop with no visitors overnight has not uninstalled anything, so this
// is generous on purpose.
const WIDGET_LIVE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Everything the Home page needs, in one request.
 *
 * The page's job is to answer "is this working?" at a glance, so the setup
 * state and the month's numbers arrive together — two round trips would mean
 * the checklist and the stats popping in at different moments.
 */
export async function GET(req: NextRequest) {
  try {
    const { token, shopDomain } = await verifySessionToken(req);
    await ensureOfflineToken(token, shopDomain);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [shop] = await db
      .select({
        widgetLastSeenAt: schema.shops.widgetLastSeenAt,
        whatsappNumber: schema.shops.whatsappNumber,
      })
      .from(schema.shops)
      .where(eq(schema.shops.shopDomain, shopDomain))
      .limit(1);

    const [faqCount] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.faqs)
      .where(and(eq(schema.faqs.shopDomain, shopDomain), eq(schema.faqs.enabled, true)));

    const stats = await db.execute(sql`
      SELECT
        count(*)::int AS answered,
        count(*) FILTER (WHERE resolved = true)::int AS resolved,
        count(*) FILTER (WHERE rating = 'up')::int AS rated_up,
        count(*) FILTER (WHERE rating IS NOT NULL)::int AS rated
      FROM query_logs
      WHERE shop_domain = ${shopDomain}
        AND created_at >= ${monthStart.toISOString()}
    `);
    const s: any = stats.rows?.[0] ?? {};
    const answered = Number(s.answered ?? 0);
    const resolved = Number(s.resolved ?? 0);
    const rated = Number(s.rated ?? 0);
    const ratedUp = Number(s.rated_up ?? 0);

    // Pending requests are the one thing on this page that needs the merchant
    // to act, so it is counted even though it is not a "this month" number.
    const [pending] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.returnRequests)
      .where(and(
        eq(schema.returnRequests.shopDomain, shopDomain),
        eq(schema.returnRequests.status, 'pending')
      ));

    const offline = await getShopToken(shopDomain);
    const plan = offline ? await getActivePlan(shopDomain, offline) : PLANS.free;

    const lastSeen = shop?.widgetLastSeenAt ? new Date(shop.widgetLastSeenAt) : null;

    return NextResponse.json({
      setup: {
        widgetLive: !!lastSeen && Date.now() - lastSeen.getTime() < WIDGET_LIVE_MS,
        widgetLastSeenAt: lastSeen ? lastSeen.toISOString() : null,
        faqCount: Number(faqCount?.c ?? 0),
        whatsappSet: !!shop?.whatsappNumber,
        whatsappAvailable: plan.whatsappHandoff,
      },
      stats: {
        answered,
        resolved,
        deflectionRate: answered > 0 ? Math.round((resolved / answered) * 100) : 0,
        // Null rather than 0 when nobody has rated: "no data yet" and "everyone
        // hated it" must not look the same on the merchant's dashboard.
        satisfaction: rated > 0 ? Math.round((ratedUp / rated) * 100) : null,
        ratedCount: rated,
        pendingRequests: Number(pending?.c ?? 0),
      },
      plan: { key: plan.key, name: plan.shopifyPlanName },
    });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}
