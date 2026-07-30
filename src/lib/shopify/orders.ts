import { LATEST_API_VERSION } from '@shopify/shopify-api';

/**
 * Look up an order's fulfillment/tracking status by order name + customer email.
 * Requiring email match keeps this safe to expose to customers (they can only
 * see their own order). Uses the Admin GraphQL API with the shop's offline token.
 */
export type TimelineStep = {
  key: 'placed' | 'shipped' | 'out_for_delivery' | 'delivered';
  label: string;
  date: string | null; // ISO string or null
  done: boolean;
  current: boolean;
};

export type OrderStatus = {
  found: boolean;
  name?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  trackingNumbers?: string[];
  trackingUrls?: string[];
  estimatedDelivery?: string | null;
  timeline?: TimelineStep[];
};

const QUERY = /* GraphQL */ `
  query OrderLookup($q: String!) {
    orders(first: 1, query: $q) {
      edges {
        node {
          name
          email
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          fulfillments {
            createdAt
            deliveredAt
            inTransitAt
            estimatedDeliveryAt
            displayStatus
            trackingInfo { number url }
            events(first: 10) {
              edges { node { status happenedAt } }
            }
          }
        }
      }
    }
  }
`;

// Build a 4-step timeline from real order data. A step is "done" if we have a
// signal it happened; the last done step is marked "current" unless delivered.
function buildTimeline(node: any): TimelineStep[] {
  const f = node?.fulfillments?.[0];
  const events: any[] = (f?.events?.edges ?? []).map((e: any) => e.node);
  const eventDate = (statuses: string[]): string | null => {
    const ev = events.find((e) =>
      statuses.includes(String(e.status).toUpperCase())
    );
    return ev?.happenedAt ?? null;
  };

  const placedDate = node?.createdAt ?? null;
  const shippedDate = f?.createdAt ?? f?.inTransitAt ?? null;
  const oodDate = eventDate(['OUT_FOR_DELIVERY']);
  const deliveredDate = f?.deliveredAt ?? eventDate(['DELIVERED']) ?? null;

  const fulfilled = !!f;
  const isDelivered =
    !!deliveredDate ||
    String(node?.displayFulfillmentStatus).toUpperCase() === 'DELIVERED' ||
    String(f?.displayStatus).toUpperCase() === 'DELIVERED';
  const isOod = !!oodDate || String(f?.displayStatus).toUpperCase() === 'OUT_FOR_DELIVERY';

  const steps: TimelineStep[] = [
    { key: 'placed', label: 'Placed', date: placedDate, done: true, current: false },
    { key: 'shipped', label: 'Shipped', date: shippedDate, done: fulfilled, current: false },
    { key: 'out_for_delivery', label: 'Out for delivery', date: oodDate, done: isOod || isDelivered, current: false },
    { key: 'delivered', label: 'Delivered', date: deliveredDate, done: isDelivered, current: false },
  ];

  // mark the last done step as current (unless everything delivered)
  let lastDone = -1;
  steps.forEach((s, i) => { if (s.done) lastDone = i; });
  if (lastDone >= 0 && !isDelivered) steps[lastDone].current = true;
  if (isDelivered) steps[3].current = true;

  return steps;
}

export type OrderSummary = {
  name: string;
  createdAt: string;
  fulfillmentStatus: string;
  financialStatus: string;
};

const LIST_QUERY = /* GraphQL */ `
  query OrdersByEmail($q: String!) {
    orders(first: 10, query: $q, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          name
          email
          createdAt
          displayFulfillmentStatus
          displayFinancialStatus
        }
      }
    }
  }
`;

// List a customer's recent orders by email (order number + date + status only —
// no personal details — so a shopper can identify which order to open).
export async function listOrdersByEmail(
  shopDomain: string,
  accessToken: string,
  email: string
): Promise<OrderSummary[]> {
  const clean = email.trim().toLowerCase();
  const q = `email:${clean}`;
  const res = await fetch(
    `https://${shopDomain}/admin/api/${LATEST_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query: LIST_QUERY, variables: { q } }),
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const edges = data?.data?.orders?.edges ?? [];
  return edges
    .map((e: any) => e.node)
    .filter((n: any) => n.email?.toLowerCase() === clean) // exact email match
    .map((n: any) => ({
      name: n.name,
      createdAt: n.createdAt,
      fulfillmentStatus: n.displayFulfillmentStatus,
      financialStatus: n.displayFinancialStatus,
    }));
}

export async function lookupOrder(
  shopDomain: string,
  accessToken: string,
  orderName: string,
  email: string
): Promise<OrderStatus> {
  const cleanName = orderName.replace(/^#/, '').trim();
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
    timeline: buildTimeline(node),
  };
}
