import { LATEST_API_VERSION } from '@shopify/shopify-api';
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

export async function getActivePlan(
  shopDomain: string,
  accessToken: string
): Promise<Plan> {
  try {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${LATEST_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query: SUB_QUERY }),
      }
    );
    if (!res.ok) return planFromSubscriptionName(null);
    const data = await res.json();
    const subs =
      data?.data?.currentAppInstallation?.activeSubscriptions ?? [];
    const active = subs.find((s: any) => s.status === 'ACTIVE');
    return planFromSubscriptionName(active?.name);
  } catch {
    // On any error, fail safe to free tier.
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
