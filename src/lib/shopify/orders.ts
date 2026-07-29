import { LATEST_API_VERSION } from '@shopify/shopify-api';

/**
 * Look up an order's fulfillment/tracking status by order name + customer email.
 * Requiring email match keeps this safe to expose to customers (they can only
 * see their own order). Uses the Admin GraphQL API with the shop's offline token.
 */
export type OrderStatus = {
  found: boolean;
  name?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  trackingNumbers?: string[];
  trackingUrls?: string[];
  estimatedDelivery?: string | null;
};

const QUERY = /* GraphQL */ `
  query OrderLookup($q: String!) {
    orders(first: 1, query: $q) {
      edges {
        node {
          name
          email
          displayFinancialStatus
          displayFulfillmentStatus
          fulfillments {
            trackingInfo { number url }
            estimatedDeliveryAt
          }
        }
      }
    }
  }
`;

export async function lookupOrder(
  shopDomain: string,
  accessToken: string,
  orderName: string,
  email: string
): Promise<OrderStatus> {
  const cleanName = orderName.replace(/^#/, '').trim();
  // Shopify search: match order name and email.
  const q = `name:${cleanName} email:${email.trim()}`;

  const res = await fetch(
    `https://${shopDomain}/admin/api/${LATEST_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query: QUERY, variables: { q } }),
    }
  );

  if (!res.ok) return { found: false };
  const data = await res.json();
  const node = data?.data?.orders?.edges?.[0]?.node;
  if (!node) return { found: false };

  // Double-check email matches (defense in depth vs. fuzzy search).
  if (node.email?.toLowerCase() !== email.trim().toLowerCase()) {
    return { found: false };
  }

  const tracking = (node.fulfillments ?? []).flatMap(
    (f: any) => f.trackingInfo ?? []
  );

  return {
    found: true,
    name: node.name,
    financialStatus: node.displayFinancialStatus,
    fulfillmentStatus: node.displayFulfillmentStatus,
    trackingNumbers: tracking.map((t: any) => t.number).filter(Boolean),
    trackingUrls: tracking.map((t: any) => t.url).filter(Boolean),
    estimatedDelivery: node.fulfillments?.[0]?.estimatedDeliveryAt ?? null,
  };
}
