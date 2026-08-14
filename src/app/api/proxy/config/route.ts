import { NextRequest, NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/auth/appProxy';
import { getShopToken } from '@/lib/auth/session';
import { getActivePlan } from '@/lib/shopify/billing';
import { db, schema } from '@/lib/db';
import { and, eq, desc } from 'drizzle-orm';

export const runtime = 'nodejs';

// The storefront widget calls this once on load (via App Proxy) to know how to
// render: whether to show branding, whether WhatsApp handoff is unlocked on the
// shop's plan, and which suggested FAQ questions to offer.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Paid features fail closed: if we cannot confirm the plan, keep them off.
  // `whatsapp` carries the number itself, so a shop without handoff never
  // receives it at all — it cannot be recovered from the page source.
  const fallback = { branding: true, whatsapp: null as string | null, suggestions: [] as string[] };
  if (!verifyAppProxySignature(url)) return NextResponse.json(fallback);

  const shopDomain = url.searchParams.get('shop');
  if (!shopDomain) return NextResponse.json(fallback);

  try {
    // suggested questions = up to 4 enabled FAQs
    const faqs = await db
      .select({ question: schema.faqs.question })
      .from(schema.faqs)
      .where(and(eq(schema.faqs.shopDomain, shopDomain), eq(schema.faqs.enabled, true)))
      .orderBy(desc(schema.faqs.createdAt))
      .limit(4);
    const suggestions = faqs.map((f) => f.question);

    const token = await getShopToken(shopDomain);
    let branding = true;
    let whatsapp: string | null = null;
    if (token) {
      const plan = await getActivePlan(shopDomain, token);
      branding = !plan.removeBranding;
      if (plan.whatsappHandoff) {
        const [shop] = await db
          .select({ whatsappNumber: schema.shops.whatsappNumber })
          .from(schema.shops)
          .where(eq(schema.shops.shopDomain, shopDomain))
          .limit(1);
        whatsapp = shop?.whatsappNumber || null;
      }
    }
    return NextResponse.json({ branding, whatsapp, suggestions });
  } catch {
    return NextResponse.json(fallback);
  }
}
