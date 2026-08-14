import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, ensureOfflineToken, errorResponse } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

// Rough estimate: each auto-answered question is a support message the merchant
// (or their team) didn't have to handle. Conservative ~3 minutes each.
const MINUTES_SAVED_PER_DEFLECTION = 3;

export async function GET(req: NextRequest) {
  try {
    const { token, shopDomain } = await verifySessionToken(req);
    await ensureOfflineToken(token, shopDomain);

    // Current calendar month start
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Totals for this month, grouped by kind + resolved
    const totals = await db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE resolved = true)::int AS resolved,
        count(*) FILTER (WHERE kind = 'order_status')::int AS order_status,
        count(*) FILTER (WHERE kind = 'faq')::int AS faq,
        count(*) FILTER (WHERE kind = 'unresolved')::int AS unresolved
      FROM query_logs
      WHERE shop_domain = ${shopDomain}
        AND created_at >= ${monthStart.toISOString()}
    `);
    const t: any = totals.rows?.[0] ?? {};

    const total = Number(t.total ?? 0);
    const resolved = Number(t.resolved ?? 0);
    const deflectionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const hoursSaved = Math.round((resolved * MINUTES_SAVED_PER_DEFLECTION) / 6) / 10; // 1 decimal

    // Daily trend, last 14 days
    const trendRes = await db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             count(*)::int AS count
      FROM query_logs
      WHERE shop_domain = ${shopDomain}
        AND created_at >= now() - interval '14 days'
      GROUP BY 1 ORDER BY 1
    `);
    const trend = (trendRes.rows ?? []).map((r: any) => ({
      day: r.day,
      count: Number(r.count),
    }));

    // Top unanswered questions (what to add to the knowledge base)
    const unresRes = await db.execute(sql`
      SELECT question, count(*)::int AS count
      FROM query_logs
      WHERE shop_domain = ${shopDomain}
        AND kind = 'unresolved'
        AND created_at >= now() - interval '30 days'
      GROUP BY question
      ORDER BY count DESC
      LIMIT 10
    `);
    const topUnanswered = (unresRes.rows ?? []).map((r: any) => ({
      question: r.question,
      count: Number(r.count),
    }));

    return NextResponse.json({
      total,
      resolved,
      deflectionRate,
      hoursSaved,
      breakdown: {
        orderStatus: Number(t.order_status ?? 0),
        faq: Number(t.faq ?? 0),
        unresolved: Number(t.unresolved ?? 0),
      },
      trend,
      topUnanswered,
    });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}
