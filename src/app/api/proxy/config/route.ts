import { NextRequest, NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/auth/appProxy';
import { getShopToken } from '@/lib/auth/session';
import { getActivePlan } from '@/lib/shopify/billing';
import {
  fetchProductExamples, fetchFeaturedProducts,
  fetchCollectionProducts, fetchProductsByIds,
} from '@/lib/shopify/products';
import { parsePick } from '@/lib/featuredPick';
import { parseHandoff } from '@/lib/handoff';
import type { ProductRec } from '@/lib/shopify/products';
import { db, schema } from '@/lib/db';
import { defaultQuickActions, parseQuickActions } from '@/lib/quickActions';
import { and, eq, desc } from 'drizzle-orm';

export const runtime = 'nodejs';
// Several Shopify calls run in sequence here. Vercel's 10s default would cut
// them off with an HTML gateway error the widget cannot parse, leaving the
// shopper with a bare 'could not reach support'.
export const maxDuration = 60;

// Catalogues change slowly, and config is read on every storefront page load.
const EXAMPLES_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// An empty result is held for hours, not a week. A shop that genuinely sells
// nothing is rare; a bad query, an expired token or a slow API is not — and a
// week is far too long to serve the consequences of one. This is exactly what
// went wrong when a rejected query cached "[]" everywhere: the bug was fixed
// within the hour and shops kept showing the empty result for days.
const EMPTY_TTL_MS = 6 * 60 * 60 * 1000;

// The storefront widget calls this once on load (via App Proxy) to know how to
// render: whether to show branding, whether WhatsApp handoff is unlocked on the
// shop's plan, and which suggested FAQ questions to offer.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Paid features fail closed: if we cannot confirm the plan, keep them off.
  // `whatsapp` carries the number itself, so a shop without handoff never
  // receives it at all — it cannot be recovered from the page source.
  const fallback = {
    branding: true,
    whatsapp: null as string | null,
    photos: false,
    productExamples: [] as string[],
    featured: [] as ProductRec[],
    suggestions: [] as string[],
  };
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
    // Guard against blank questions, which would render as an empty chip.
    const suggestions = faqs
      .map((f) => (f.question ?? '').trim())
      .filter(Boolean);

    // Which chat buttons this merchant wants shown. Read before the plan check
    // so the setting is honoured even for a shop whose token has gone stale.
    const [buttons] = await db
      .select({
        quickActions: schema.shops.quickActions,
        widgetLastSeenAt: schema.shops.widgetLastSeenAt,
        supportEmail: schema.shops.supportEmail,
        handoffMode: schema.shops.handoffMode,
        featuredPick: schema.shops.featuredPick,
      })
      .from(schema.shops)
      .where(eq(schema.shops.shopDomain, shopDomain))
      .limit(1);
    const actions = parseQuickActions(buttons?.quickActions);

    // This request is proof the theme embed is switched on — there is no Admin
    // API that will tell us, and the merchant's Home page says so. Stamped at
    // most hourly: a shop with traffic would otherwise buy a database write on
    // every single page view to learn something we already knew.
    const seenAt = buttons?.widgetLastSeenAt;
    if (!seenAt || Date.now() - new Date(seenAt).getTime() > 60 * 60 * 1000) {
      db.update(schema.shops)
        .set({ widgetLastSeenAt: new Date() })
        .where(eq(schema.shops.shopDomain, shopDomain))
        .catch(() => { /* a missed heartbeat must never cost the shopper their widget */ });
    }

    const token = await getShopToken(shopDomain);
    let productExamples: string[] = [];
    let featured: ProductRec[] = [];
    let branding = true;
    let whatsapp: string | null = null;
    let photos = false;
    if (token) {
      const plan = await getActivePlan(shopDomain, token);
      branding = !plan.removeBranding;
      photos = plan.damagePhotos;
      if (plan.whatsappHandoff) {
        const [shop] = await db
          .select({ whatsappNumber: schema.shops.whatsappNumber })
          .from(schema.shops)
          .where(eq(schema.shops.shopDomain, shopDomain))
          .limit(1);
        whatsapp = shop?.whatsappNumber || null;
      }

      const [cached] = await db
        .select({
          productExamples: schema.shops.productExamples,
          featuredProducts: schema.shops.featuredProducts,
          productExamplesAt: schema.shops.productExamplesAt,
        })
        .from(schema.shops)
        .where(eq(schema.shops.shopDomain, shopDomain))
        .limit(1);

      // Parse first: how long the cache is good for depends on whether it
      // actually holds anything.
      let cached_ok = true;
      if (cached?.productExamples) {
        try { productExamples = JSON.parse(cached.productExamples); } catch { cached_ok = false; }
      }
      if (cached?.featuredProducts) {
        try { featured = JSON.parse(cached.featuredProducts); } catch { cached_ok = false; }
      } else {
        // Written before this column existed — refresh once to fill it in.
        cached_ok = false;
      }

      const age = cached?.productExamplesAt
        ? Date.now() - new Date(cached.productExamplesAt).getTime()
        : Infinity;
      const ttl = featured.length ? EXAMPLES_TTL_MS : EMPTY_TTL_MS;
      const cacheHit = cached_ok && age < ttl;
      if (!cacheHit) {
        // Anything reused below must come from this refresh, not from a cache
        // we have just decided not to trust.
        productExamples = [];
        featured = [];
      }

      // Both come from the same catalogue and go stale together, so one miss
      // refreshes the pair — two separate clocks would mean two Admin API
      // round trips on a page load that should usually make none.
      if (!cacheHit) {
        const pick = parsePick(buttons?.featuredPick);
        [productExamples, featured] = await Promise.all([
          fetchProductExamples(shopDomain, token),
          // A merchant who named a collection or picked a list gets exactly
          // that. If it comes back empty — the collection emptied, the picked
          // products deleted — the automatic list stands in, because a bare
          // welcome screen is worse than one the merchant did not choose.
          (async (): Promise<ProductRec[]> => {
            let chosen: ProductRec[] = [];
            if (pick.mode === 'collection') {
              chosen = (await fetchCollectionProducts(shopDomain, token, pick.collection, 6)).products;
            } else if (pick.mode === 'products') {
              chosen = await fetchProductsByIds(shopDomain, token, pick.productIds);
            }
            return chosen.length ? chosen : fetchFeaturedProducts(shopDomain, token);
          })(),
        ]);
        // Stamp the time even when nothing came back, so a shop with no usable
        // product names is not re-queried on every single page load.
        await db
          .update(schema.shops)
          .set({
            productExamples: JSON.stringify(productExamples),
            featuredProducts: JSON.stringify(featured),
            productExamplesAt: new Date(),
          })
          .where(eq(schema.shops.shopDomain, shopDomain));
      }
    }
    return NextResponse.json({
      branding, whatsapp, photos, productExamples, suggestions, actions,
      featured,
      // Read outside the plan check, unlike the WhatsApp number: this one is
      // available on every plan.
      supportEmail: buttons?.supportEmail || null,
      // Whether those are a button too, or only offered once we have failed.
      handoff: parseHandoff(buttons?.handoffMode),
    });
  } catch {
    return NextResponse.json(fallback);
  }
}
