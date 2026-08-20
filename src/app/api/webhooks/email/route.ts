import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { fetchReceivedEmail, stripQuotedReply } from '@/lib/email/resend';
import { draftAnswer } from '@/lib/ai/answer';
import { db, schema } from '@/lib/db';
import { and, eq, desc } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * Verify a Resend (Svix) webhook signature.
 *
 * Without this anyone could POST invented customer emails into a merchant's
 * inbox, so an unverifiable request is rejected rather than trusted.
 */
function verifySignature(raw: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;

  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signatureHeader = headers.get('svix-signature');
  if (!id || !timestamp || !signatureHeader) return false;

  // Reject anything older than five minutes so a captured request cannot be
  // replayed indefinitely.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  // Secrets are issued as "whsec_<base64>".
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${raw}`)
    .digest('base64');

  // The header carries space-separated "v1,<sig>" entries.
  return signatureHeader.split(' ').some((part) => {
    const sig = part.split(',')[1];
    if (!sig) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  if (event?.type !== 'email.received') return NextResponse.json({ ok: true });

  const emailId = event?.data?.email_id ?? event?.data?.id;
  if (!emailId) return NextResponse.json({ ok: true });

  // The webhook carries metadata only — the body needs a second call.
  const mail = await fetchReceivedEmail(String(emailId));
  if (!mail) return NextResponse.json({ ok: true });

  // Which shop was this addressed to? The local part is the shop's token.
  const tokens = mail.to
    .map((addr) => addr.split('@')[0])
    .filter(Boolean);
  if (!tokens.length) return NextResponse.json({ ok: true });

  const [shop] = await db
    .select({ shopDomain: schema.shops.shopDomain, inboundToken: schema.shops.inboundToken })
    .from(schema.shops)
    .where(eq(schema.shops.inboundToken, tokens[0]))
    .limit(1);

  // Unknown address — accept and drop, so Resend does not retry forever.
  if (!shop) return NextResponse.json({ ok: true });

  const customerEmail = mail.from;
  const body = stripQuotedReply(mail.text).slice(0, 10000);
  if (!customerEmail || !body) return NextResponse.json({ ok: true });

  // Continue this customer's existing open thread rather than starting a new
  // one per email — a reply from a phone often loses the mail headers that
  // would otherwise link them.
  const [existing] = await db
    .select({ id: schema.emailThreads.id })
    .from(schema.emailThreads)
    .where(and(
      eq(schema.emailThreads.shopDomain, shop.shopDomain),
      eq(schema.emailThreads.customerEmail, customerEmail),
      eq(schema.emailThreads.status, 'open')
    ))
    .orderBy(desc(schema.emailThreads.lastMessageAt))
    .limit(1);

  let threadId = existing?.id;
  if (threadId) {
    await db
      .update(schema.emailThreads)
      .set({ lastMessageAt: new Date(), status: 'open' })
      .where(eq(schema.emailThreads.id, threadId));
  } else {
    const [created] = await db
      .insert(schema.emailThreads)
      .values({
        shopDomain: shop.shopDomain,
        customerEmail,
        subject: mail.subject.slice(0, 300),
      })
      .returning({ id: schema.emailThreads.id });
    threadId = created.id;
  }

  await db.insert(schema.emailMessages).values({
    threadId,
    shopDomain: shop.shopDomain,
    direction: 'inbound',
    body,
  });

  // Draft a reply for the merchant to review. Never sent automatically: this
  // goes out under the store's name, so a person approves it.
  const faqs = await db
    .select({ question: schema.faqs.question, answer: schema.faqs.answer })
    .from(schema.faqs)
    .where(and(eq(schema.faqs.shopDomain, shop.shopDomain), eq(schema.faqs.enabled, true)))
    .limit(10);

  const draft = await draftAnswer(body, faqs);
  if (draft) {
    await db.insert(schema.emailMessages).values({
      threadId,
      shopDomain: shop.shopDomain,
      direction: 'outbound',
      body: draft,
      sentAt: null, // a draft until the merchant sends it
    });
  }

  return NextResponse.json({ ok: true });
}
