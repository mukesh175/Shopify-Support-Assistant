import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, ensureOfflineToken, getShopToken, errorResponse } from '@/lib/auth/session';
import { getActivePlan, pricingPageUrl } from '@/lib/shopify/billing';
import { APP_HANDLE } from '@/lib/shopify/app-handle';
import { db, schema } from '@/lib/db';
import { and, eq, gte, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { token, shopDomain } = await verifySessionToken(req);
    await ensureOfflineToken(token, shopDomain);
    const offline = await getShopToken(shopDomain);

    const plan = offline
      ? await getActivePlan(shopDomain, offline)
      : (await import('@/lib/plans')).PLANS.free;

    // monthly usage
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
    const used = Number(rows[0]?.c ?? 0);

    return NextResponse.json({
      plan: plan.key,
      planName: plan.shopifyPlanName,
      price: plan.price,
      monthlyQueryLimit: plan.monthlyQueryLimit,
      used,
      upgradeUrl: pricingPageUrl(shopDomain, APP_HANDLE),
    });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}
