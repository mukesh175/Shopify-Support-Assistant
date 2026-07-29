import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, ensureOfflineToken } from '@/lib/auth/session';
import { db, schema } from '@/lib/db';
import { and, eq, desc } from 'drizzle-orm';

export const runtime = 'nodejs';

// Every request from the embedded admin carries a Bearer session token.
// We verify it, then make sure we hold a valid offline token for the shop.
async function authed(req: NextRequest) {
  const { token, shopDomain } = await verifySessionToken(req);
  await ensureOfflineToken(token, shopDomain);
  return shopDomain;
}

export async function GET(req: NextRequest) {
  try {
    const shopDomain = await authed(req);
    const rows = await db
      .select()
      .from(schema.faqs)
      .where(eq(schema.faqs.shopDomain, shopDomain))
      .orderBy(desc(schema.faqs.createdAt));
    return NextResponse.json({ faqs: rows });
  } catch (e) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const shopDomain = await authed(req);
    const { question, answer } = await req.json();
    if (!question?.trim() || !answer?.trim()) {
      return NextResponse.json({ error: 'question and answer required' }, { status: 400 });
    }
    const [row] = await db
      .insert(schema.faqs)
      .values({ shopDomain, question: question.trim(), answer: answer.trim() })
      .returning();
    return NextResponse.json({ faq: row });
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const shopDomain = await authed(req);
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await db
      .delete(schema.faqs)
      .where(and(eq(schema.faqs.id, id), eq(schema.faqs.shopDomain, shopDomain)));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}
