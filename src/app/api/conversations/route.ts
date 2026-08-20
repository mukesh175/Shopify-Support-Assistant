import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, ensureOfflineToken, errorResponse } from '@/lib/auth/session';
import { db, schema } from '@/lib/db';
import { and, eq, desc, ilike, or, sql, type SQL } from 'drizzle-orm';

export const runtime = 'nodejs';

const PAGE_SIZE = 25;
const KINDS = ['faq', 'order_status', 'recommend'] as const;

/**
 * What customers asked and how the assistant replied. The merchant has no
 * other way to see this — chat history lives in the shopper's own browser —
 * so this is the only window onto what the assistant is doing on their behalf.
 *
 * Columns are listed explicitly rather than using select(): a bare select()
 * asks for every column the schema declares, which fails outright if the
 * database has not caught up with a schema change.
 */
export async function GET(req: NextRequest) {
  try {
    const { token, shopDomain } = await verifySessionToken(req);
    await ensureOfflineToken(token, shopDomain);

    const url = new URL(req.url);
    const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10) || 0);
    const status = url.searchParams.get('status') ?? 'all';
    const kind = url.searchParams.get('kind') ?? 'all';
    const q = (url.searchParams.get('q') ?? '').trim();

    const filters: SQL[] = [eq(schema.queryLogs.shopDomain, shopDomain)];
    if (status === 'resolved') filters.push(eq(schema.queryLogs.resolved, true));
    if (status === 'unresolved') filters.push(eq(schema.queryLogs.resolved, false));
    if ((KINDS as readonly string[]).includes(kind)) {
      filters.push(eq(schema.queryLogs.kind, kind));
    }
    if (q) {
      const like = `%${q}%`;
      filters.push(
        or(ilike(schema.queryLogs.question, like), ilike(schema.queryLogs.answer, like))!
      );
    }
    const where = and(...filters);

    const rows = await db
      .select({
        id: schema.queryLogs.id,
        question: schema.queryLogs.question,
        answer: schema.queryLogs.answer,
        kind: schema.queryLogs.kind,
        resolved: schema.queryLogs.resolved,
        createdAt: schema.queryLogs.createdAt,
      })
      .from(schema.queryLogs)
      .where(where)
      .orderBy(desc(schema.queryLogs.createdAt))
      .limit(PAGE_SIZE + 1) // one extra row tells us whether another page exists
      .offset(page * PAGE_SIZE);

    const hasNext = rows.length > PAGE_SIZE;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.queryLogs)
      .where(where);

    return NextResponse.json({
      conversations: rows.slice(0, PAGE_SIZE),
      page,
      pageSize: PAGE_SIZE,
      hasNext,
      hasPrevious: page > 0,
      total,
    });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}
