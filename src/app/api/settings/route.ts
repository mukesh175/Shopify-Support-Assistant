import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, ensureOfflineToken, getShopToken, errorResponse } from '@/lib/auth/session';
import { getActivePlan } from '@/lib/shopify/billing';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

// Every request from the embedded admin carries a Bearer session token.
async function authed(req: NextRequest) {
  const { token, shopDomain } = await verifySessionToken(req);
  await ensureOfflineToken(token, shopDomain);
  return shopDomain;
}

export async function GET(req: NextRequest) {
  try {
    const shopDomain = await authed(req);

    const [row] = await db
      .select({ whatsappNumber: schema.shops.whatsappNumber })
      .from(schema.shops)
      .where(eq(schema.shops.shopDomain, shopDomain))
      .limit(1);

    // The UI needs to know whether to offer the field at all.
    const token = await getShopToken(shopDomain);
    const whatsappHandoff = token
      ? (await getActivePlan(shopDomain, token)).whatsappHandoff
      : false;

    return NextResponse.json({
      whatsappNumber: row?.whatsappNumber ?? '',
      whatsappHandoff,
    });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const shopDomain = await authed(req);
    const { whatsappNumber } = await req.json();

    // Saving is itself a paid action — otherwise a Free shop could store a
    // number now and have it served the moment the plan check is bypassed.
    const token = await getShopToken(shopDomain);
    const plan = token ? await getActivePlan(shopDomain, token) : null;
    if (!plan?.whatsappHandoff) {
      return NextResponse.json(
        { error: 'WhatsApp handoff is not included in your current plan. Upgrade to enable it.' },
        { status: 402 }
      );
    }

    // Digits only — this is interpolated into a wa.me URL.
    const digits = String(whatsappNumber ?? '').replace(/[^0-9]/g, '');
    if (digits && (digits.length < 8 || digits.length > 15)) {
      return NextResponse.json(
        { error: 'Enter a valid number with country code, digits only (e.g. 919876543210).' },
        { status: 400 }
      );
    }

    await db
      .update(schema.shops)
      .set({ whatsappNumber: digits || null })
      .where(eq(schema.shops.shopDomain, shopDomain));

    return NextResponse.json({ whatsappNumber: digits });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}
