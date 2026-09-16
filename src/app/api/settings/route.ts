import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, ensureOfflineToken, getShopToken, errorResponse } from '@/lib/auth/session';
import { getActivePlan } from '@/lib/shopify/billing';
import { db, schema } from '@/lib/db';
import { parseQuickActions, sanitizeQuickActions } from '@/lib/quickActions';
import { parsePick, sanitizePick } from '@/lib/featuredPick';
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
      .select({
        whatsappNumber: schema.shops.whatsappNumber,
        supportEmail: schema.shops.supportEmail,
        featuredPick: schema.shops.featuredPick,
        quickActions: schema.shops.quickActions,
      })
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
      supportEmail: row?.supportEmail ?? '',
      featuredPick: parsePick(row?.featuredPick),
      whatsappHandoff,
      quickActions: parseQuickActions(row?.quickActions),
    });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const shopDomain = await authed(req);
    const payload = await req.json();

    // The two settings on this screen save independently: which chat buttons
    // to show is on every plan, so a Free shop changing them must not run into
    // the WhatsApp plan gate. Only the keys actually sent are written.
    const updates: Partial<typeof schema.shops.$inferInsert> = {};
    let digits: string | undefined;

    if ('whatsappNumber' in payload) {
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
      digits = String(payload.whatsappNumber ?? '').replace(/[^0-9]/g, '');
      if (digits && (digits.length < 8 || digits.length > 15)) {
        return NextResponse.json(
          { error: 'Enter a valid number with country code, digits only (e.g. 919876543210).' },
          { status: 400 }
        );
      }
      updates.whatsappNumber = digits || null;
    }

    // No plan gate: a shop with no route to a human is a worse product, and an
    // email address is not a feature worth charging for.
    let supportEmail: string | undefined;
    if ('supportEmail' in payload) {
      supportEmail = String(payload.supportEmail ?? '').trim();
      if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
        return NextResponse.json(
          { error: 'Enter a valid email address, or leave it blank.' },
          { status: 400 }
        );
      }
      updates.supportEmail = supportEmail || null;
    }

    let featuredPick;
    if ('featuredPick' in payload) {
      featuredPick = sanitizePick(payload.featuredPick);
      updates.featuredPick = JSON.stringify(featuredPick);
      // Drop the cached deck's timestamp so the storefront picks the new
      // choice up on the next page load. Without this a merchant changes the
      // setting, looks at their shop, and sees the old products for a week.
      updates.productExamplesAt = null;
    }

    let quickActions;
    if ('quickActions' in payload) {
      quickActions = sanitizeQuickActions(payload.quickActions);
      updates.quickActions = JSON.stringify(quickActions);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
    }

    await db
      .update(schema.shops)
      .set(updates)
      .where(eq(schema.shops.shopDomain, shopDomain));

    return NextResponse.json({
      ...(digits !== undefined ? { whatsappNumber: digits } : {}),
      ...(supportEmail !== undefined ? { supportEmail } : {}),
      ...(featuredPick ? { featuredPick } : {}),
      ...(quickActions ? { quickActions } : {}),
    });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}
