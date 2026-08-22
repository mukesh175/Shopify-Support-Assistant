import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { verifySessionToken, ensureOfflineToken, getShopToken, errorResponse } from '@/lib/auth/session';
import { getActivePlan } from '@/lib/shopify/billing';
import { emailConfigured, inboundAddress, sendEmail } from '@/lib/email/resend';
import { db, schema } from '@/lib/db';
import { and, eq, asc, desc } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * The shop's inbound address, created on first use.
 *
 * A random token rather than the shop domain: the address ends up in mail
 * headers and forwarding rules, and should not be guessable by someone who
 * knows a store's name.
 */
async function ensureInboundToken(shopDomain: string): Promise<string> {
  const [row] = await db
    .select({ inboundToken: schema.shops.inboundToken })
    .from(schema.shops)
    .where(eq(schema.shops.shopDomain, shopDomain))
    .limit(1);

  if (row?.inboundToken) return row.inboundToken;

  const token = 'shop-' + randomBytes(9).toString('hex');
  await db
    .update(schema.shops)
    .set({ inboundToken: token })
    .where(eq(schema.shops.shopDomain, shopDomain));
  return token;
}

export async function GET(req: NextRequest) {
  try {
    const { token, shopDomain } = await verifySessionToken(req);
    await ensureOfflineToken(token, shopDomain);

    const url = new URL(req.url);
    const threadId = Number(url.searchParams.get('threadId') ?? 0);

    // One thread with its messages.
    if (threadId) {
      const [thread] = await db
        .select()
        .from(schema.emailThreads)
        .where(and(
          eq(schema.emailThreads.id, threadId),
          eq(schema.emailThreads.shopDomain, shopDomain)
        ))
        .limit(1);
      if (!thread) return NextResponse.json({ error: 'not found' }, { status: 404 });

      const messages = await db
        .select({
          id: schema.emailMessages.id,
          direction: schema.emailMessages.direction,
          body: schema.emailMessages.body,
          sentAt: schema.emailMessages.sentAt,
          createdAt: schema.emailMessages.createdAt,
        })
        .from(schema.emailMessages)
        .where(eq(schema.emailMessages.threadId, threadId))
        .orderBy(asc(schema.emailMessages.createdAt));

      return NextResponse.json({ thread, messages });
    }

    // Thread list, plus the setup details the Emails page needs.
    const threads = await db
      .select({
        id: schema.emailThreads.id,
        customerEmail: schema.emailThreads.customerEmail,
        subject: schema.emailThreads.subject,
        status: schema.emailThreads.status,
        lastMessageAt: schema.emailThreads.lastMessageAt,
      })
      .from(schema.emailThreads)
      .where(eq(schema.emailThreads.shopDomain, shopDomain))
      .orderBy(desc(schema.emailThreads.lastMessageAt))
      .limit(100);

    // The email channel is a paid feature. Existing threads stay readable if a
    // shop downgrades — hiding what they already received would lose it — but
    // the forwarding address is only handed out on a plan that includes it.
    const offline = await getShopToken(shopDomain);
    const plan = offline ? await getActivePlan(shopDomain, offline) : null;
    const included = !!plan?.emailChannel;

    const configured = emailConfigured();
    return NextResponse.json({
      threads,
      configured,
      included,
      forwardTo: configured && included
        ? inboundAddress(await ensureInboundToken(shopDomain))
        : null,
    });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}

/** Send the merchant's reply, and record what actually went out. */
export async function POST(req: NextRequest) {
  try {
    const { token, shopDomain } = await verifySessionToken(req);
    await ensureOfflineToken(token, shopDomain);

    const { threadId, body, replyTo } = await req.json();
    if (!threadId || !body?.trim()) {
      return NextResponse.json({ error: 'threadId and body required' }, { status: 400 });
    }

    const offline = await getShopToken(shopDomain);
    const plan = offline ? await getActivePlan(shopDomain, offline) : null;
    if (!plan?.emailChannel) {
      return NextResponse.json(
        { error: 'Replying by email is available on the Pro plan.' },
        { status: 402 }
      );
    }

    const [thread] = await db
      .select()
      .from(schema.emailThreads)
      .where(and(
        eq(schema.emailThreads.id, Number(threadId)),
        eq(schema.emailThreads.shopDomain, shopDomain)
      ))
      .limit(1);
    if (!thread) return NextResponse.json({ error: 'not found' }, { status: 404 });

    const subject = thread.subject.toLowerCase().startsWith('re:')
      ? thread.subject
      : `Re: ${thread.subject}`;

    const failure = await sendEmail({
      to: thread.customerEmail,
      subject,
      text: body.trim(),
      replyTo: typeof replyTo === 'string' && replyTo.trim() ? replyTo.trim() : undefined,
    });
    // Only record a message as sent if it actually was.
    if (failure) return NextResponse.json({ error: failure }, { status: 502 });

    await db.insert(schema.emailMessages).values({
      threadId: thread.id,
      shopDomain,
      direction: 'outbound',
      body: body.trim(),
      sentAt: new Date(),
    });

    await db
      .update(schema.emailThreads)
      .set({ status: 'replied', lastMessageAt: new Date() })
      .where(eq(schema.emailThreads.id, thread.id));

    return NextResponse.json({ ok: true });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}
