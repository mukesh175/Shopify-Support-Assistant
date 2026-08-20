import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, ensureOfflineToken, getShopToken, errorResponse } from '@/lib/auth/session';
import { getActivePlan } from '@/lib/shopify/billing';
import { draftAnswer } from '@/lib/ai/answer';
import { db, schema } from '@/lib/db';
import { and, eq, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * Draft an answer for a question the assistant could not handle.
 *
 * The draft is only ever a suggestion: it is returned to the merchant to edit,
 * never saved on its own. The model is told not to invent shop policy, because
 * whatever is saved here is what the assistant will tell customers.
 */
export async function POST(req: NextRequest) {
  try {
    const { token, shopDomain } = await verifySessionToken(req);
    await ensureOfflineToken(token, shopDomain);

    const { question } = await req.json();
    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json({ error: 'question required' }, { status: 400 });
    }

    // Existing entries give the model this shop's tone and its actual policies.
    const faqs = await db
      .select({ question: schema.faqs.question, answer: schema.faqs.answer })
      .from(schema.faqs)
      .where(and(eq(schema.faqs.shopDomain, shopDomain), eq(schema.faqs.enabled, true)))
      .limit(10);

    const draft = await draftAnswer(question.trim(), faqs);
    if (!draft) {
      return NextResponse.json(
        { error: 'The AI is unavailable right now. You can still write the answer yourself.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ draft });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}

/**
 * Save an edited answer to the knowledge base and mark the question handled,
 * so the assistant answers it next time and the merchant can see which gaps
 * are still outstanding.
 */
export async function PUT(req: NextRequest) {
  try {
    const { token, shopDomain } = await verifySessionToken(req);
    await ensureOfflineToken(token, shopDomain);

    const { logId, question, answer } = await req.json();
    if (!question?.trim() || !answer?.trim()) {
      return NextResponse.json({ error: 'question and answer required' }, { status: 400 });
    }

    // The plan's knowledge base cap applies here as much as on the Knowledge
    // base page — this is another way to add an entry.
    const offline = await getShopToken(shopDomain);
    if (offline) {
      const plan = await getActivePlan(shopDomain, offline);
      if (plan.maxFaqs !== null) {
        const [{ c }] = await db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.faqs)
          .where(eq(schema.faqs.shopDomain, shopDomain));
        if (Number(c) >= plan.maxFaqs) {
          return NextResponse.json(
            { error: `The ${plan.shopifyPlanName} plan is limited to ${plan.maxFaqs} Q&As. Upgrade for more.` },
            { status: 402 }
          );
        }
      }
    }

    await db.insert(schema.faqs).values({
      shopDomain,
      question: question.trim(),
      answer: answer.trim(),
    });

    if (logId) {
      await db
        .update(schema.queryLogs)
        .set({ handled: true })
        .where(and(
          eq(schema.queryLogs.id, Number(logId)),
          eq(schema.queryLogs.shopDomain, shopDomain)
        ));
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}
