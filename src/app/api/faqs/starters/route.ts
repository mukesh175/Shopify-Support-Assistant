import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, ensureOfflineToken, getShopToken, errorResponse } from '@/lib/auth/session';
import { getActivePlan } from '@/lib/shopify/billing';
import { db, schema } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { STARTERS } from '@/lib/faqs/starters';

export const runtime = 'nodejs';


export async function GET(req: NextRequest) {
  try {
    const { token, shopDomain } = await verifySessionToken(req);
    await ensureOfflineToken(token, shopDomain);
    return NextResponse.json({ starters: STARTERS });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, shopDomain } = await verifySessionToken(req);
    await ensureOfflineToken(token, shopDomain);

    const [{ existing }] = await db
      .select({ existing: sql<number>`count(*)::int` })
      .from(schema.faqs)
      .where(eq(schema.faqs.shopDomain, shopDomain));

    // Only ever offered as a way to fill an empty knowledge base, so refuse
    // rather than duplicating entries a merchant has already written.
    if (Number(existing) > 0) {
      return NextResponse.json(
        { error: 'Your knowledge base already has answers in it.' },
        { status: 409 }
      );
    }

    // Respect the plan cap: add as many as fit rather than failing outright.
    let toAdd = STARTERS;
    const offline = await getShopToken(shopDomain);
    if (offline) {
      const plan = await getActivePlan(shopDomain, offline);
      if (plan.maxFaqs !== null) toAdd = STARTERS.slice(0, plan.maxFaqs);
    }

    await db.insert(schema.faqs).values(
      toAdd.map((s) => ({ shopDomain, question: s.question, answer: s.answer }))
    );

    return NextResponse.json({ added: toAdd.length, total: STARTERS.length });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}
