import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

// Verify the raw body against the X-Shopify-Hmac-Sha256 header. MUST read the
// raw text (not parsed JSON) or the HMAC won't match.
function verifyWebhook(raw: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false;
  const digest = createHmac('sha256', process.env.SHOPIFY_API_SECRET!)
    .update(raw, 'utf8')
    .digest('base64');
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get('x-shopify-hmac-sha256'))) {
    return NextResponse.json({ error: 'invalid hmac' }, { status: 401 });
  }

  const topic = req.headers.get('x-shopify-topic') ?? '';
  const shopDomain = req.headers.get('x-shopify-shop-domain') ?? '';

  switch (topic) {
    case 'app/uninstalled':
      // Mark uninstalled + wipe the token. Keep FAQs in case they reinstall.
      await db
        .update(schema.shops)
        .set({ uninstalledAt: new Date(), accessTokenEnc: '' })
        .where(eq(schema.shops.shopDomain, shopDomain));
      break;

    // --- Mandatory GDPR/privacy webhooks (required for App Store listing) ---
    case 'customers/data_request':
      // We store no customer PII beyond transient logs; nothing to export.
      break;
    case 'customers/redact':
    case 'shop/redact':
      // Purge any logs tied to this shop.
      await db.delete(schema.queryLogs).where(eq(schema.queryLogs.shopDomain, shopDomain));
      break;
  }

  return NextResponse.json({ ok: true });
}
