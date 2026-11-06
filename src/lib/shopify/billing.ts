import { ADMIN_API_VERSION } from './api-version';
import { Plan, planFromSubscriptionName } from '@/lib/plans';

/**
 * Read the merchant's active app subscription via the Admin GraphQL API.
 * With Shopify App Pricing, plans are configured in the Partner Dashboard and
 * Shopify manages the charge; our app only needs to READ which plan is active
 * to gate features. This query works with the shop's offline access token.
 */
const SUB_QUERY = /* GraphQL */ `
  query CurrentSubscription {
    currentAppInstallation {
      activeSubscriptions {
        name
        status
      }
    }
  }
`;

/**
 * A shop's plan, remembered for a minute.
 *
 * Thirteen call sites ask for the plan, and a single admin page load goes
 * through several of them — the API logs showed one shop asking eight times
 * inside three seconds. A plan does not change eight times in three seconds.
 *
 * A minute is deliberately short. The one moment staleness would be felt is
 * right after a merchant pays and comes back expecting the feature to be
 * unlocked, so the window is kept smaller than that round trip, and the screen
 * that reports the plan asks for a fresh answer anyway (see `fresh` below).
 *
 * This lives in module memory, so it is per serverless instance and vanishes
 * on a cold start. That is the right shape for it: it exists to collapse
 * bursts within one request or one warm instance, not to be a source of truth.
 */
const PLAN_TTL_MS = 60 * 1000;
const planCache = new Map<string, { plan: Plan; at: number }>();

/** Drop a shop's cached plan — after an upgrade, the next read must be real. */
export function clearPlanCache(shopDomain: string) {
  planCache.delete(shopDomain);
}

export async function getActivePlan(
  shopDomain: string,
  accessToken: string,
  opts?: { fresh?: boolean }
): Promise<Plan> {
  const now = Date.now();

  if (!opts?.fresh) {
    const hit = planCache.get(shopDomain);
    if (hit && now - hit.at < PLAN_TTL_MS) return hit.plan;
  }

  try {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query: SUB_QUERY }),
      }
    );
    // Failures below fall back to the free tier but are deliberately NOT
    // cached: an outage or an expired token must not pin a paying shop to the
    // free plan for a minute after the problem has passed.
    if (!res.ok) return planFromSubscriptionName(null);
    const data = await res.json();
    if (data?.errors) {
      console.error('[billing] plan query errors', JSON.stringify(data.errors));
      return planFromSubscriptionName(null);
    }
    const subs =
      data?.data?.currentAppInstallation?.activeSubscriptions ?? [];
    const active = subs.find((s: any) => s.status === 'ACTIVE');
    const plan = planFromSubscriptionName(active?.name);

    // Only a real answer from Shopify is worth remembering.
    for (const [key, v] of planCache) {
      if (now - v.at >= PLAN_TTL_MS) planCache.delete(key);
    }
    planCache.set(shopDomain, { plan, at: now });
    return plan;
  } catch {
    // On any error, fail safe to free tier — again without caching it.
    return planFromSubscriptionName(null);
  }
}

/**
 * Build the URL that opens Shopify's managed pricing page, where the merchant
 * can choose/approve a plan. Shopify handles the checkout + approval.
 * `appHandle` is your app handle from shopify.app.toml.
 */
export function pricingPageUrl(shopDomain: string, appHandle: string): string {
  const store = shopDomain.replace('.myshopify.com', '');
  return `https://admin.shopify.com/store/${store}/charges/${appHandle}/pricing_plans`;
}
