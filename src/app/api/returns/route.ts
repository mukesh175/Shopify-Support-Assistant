import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, ensureOfflineToken, errorResponse } from '@/lib/auth/session';
import { db, schema } from '@/lib/db';
import { and, eq, desc, sql, type SQL } from 'drizzle-orm';

export const runtime = 'nodejs';

const PAGE_SIZE = 25;
const STATUSES = ['pending', 'approved', 'declined', 'completed'] as const;
type Status = (typeof STATUSES)[number];

export async function GET(req: NextRequest) {
  try {
    const { token, shopDomain } = await verifySessionToken(req);
    await ensureOfflineToken(token, shopDomain);

    const url = new URL(req.url);
    const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10) || 0);
    const status = url.searchParams.get('status') ?? '';

    const filters: SQL[] = [eq(schema.returnRequests.shopDomain, shopDomain)];
    if ((STATUSES as readonly string[]).includes(status)) {
      filters.push(eq(schema.returnRequests.status, status));
    }
    const where = and(...filters);

    const rows = await db
      .select({
        id: schema.returnRequests.id,
        orderName: schema.returnRequests.orderName,
        email: schema.returnRequests.email,
        items: schema.returnRequests.items,
        reason: schema.returnRequests.reason,
        note: schema.returnRequests.note,
        status: schema.returnRequests.status,
        createdAt: schema.returnRequests.createdAt,
      })
      .from(schema.returnRequests)
      .where(where)
      .orderBy(desc(schema.returnRequests.createdAt))
      .limit(PAGE_SIZE + 1)
      .offset(page * PAGE_SIZE);

    const hasNext = rows.length > PAGE_SIZE;

    // Counts per status drive the tab badges, so they ignore the status filter.
    const counts = await db
      .select({ status: schema.returnRequests.status, c: sql<number>`count(*)::int` })
      .from(schema.returnRequests)
      .where(eq(schema.returnRequests.shopDomain, shopDomain))
      .groupBy(schema.returnRequests.status);

    return NextResponse.json({
      returns: rows.slice(0, PAGE_SIZE).map((r) => ({
        ...r,
        items: safeParse(r.items),
      })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c.c])),
      page,
      hasNext,
      hasPrevious: page > 0,
    });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { token, shopDomain } = await verifySessionToken(req);
    await ensureOfflineToken(token, shopDomain);

    const { id, status } = await req.json();
    if (!id || !(STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'invalid id or status' }, { status: 400 });
    }

    // Scoped to the shop so one store cannot alter another's requests.
    const updated = await db
      .update(schema.returnRequests)
      .set({ status: status as Status, updatedAt: new Date() })
      .where(and(
        eq(schema.returnRequests.id, Number(id)),
        eq(schema.returnRequests.shopDomain, shopDomain)
      ))
      .returning({ id: schema.returnRequests.id });

    if (!updated.length) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return []; }
}
