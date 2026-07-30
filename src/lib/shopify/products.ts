import { LATEST_API_VERSION } from '@shopify/shopify-api';

export type ProductRec = {
  title: string;
  price: string;
  image: string | null;
  url: string;
  handle: string;
};

// Fetch candidate products from the store, then let the LLM pick + rank the best
// matches for the customer's request. Two-step keeps it grounded: we only ever
// recommend products that actually exist in the store.

const SEARCH_QUERY = /* GraphQL */ `
  query ProductSearch($q: String!) {
    products(first: 15, query: $q) {
      edges {
        node {
          title
          handle
          onlineStoreUrl
          featuredImage { url }
          priceRangeV2 { minVariantPrice { amount currencyCode } }
          totalInventory
        }
      }
    }
  }
`;

async function fetchCandidates(
  shopDomain: string,
  accessToken: string,
  keywords: string
): Promise<any[]> {
  // Broaden the search: match title/tag/product_type, in stock preferred.
  const q = `${keywords} status:active`;
  const res = await fetch(
    `https://${shopDomain}/admin/api/${LATEST_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query: SEARCH_QUERY, variables: { q } }),
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.data?.products?.edges ?? []).map((e: any) => e.node);
}

function toRec(node: any, shopDomain: string): ProductRec {
  const price = node?.priceRangeV2?.minVariantPrice;
  const store = shopDomain.replace('.myshopify.com', '');
  return {
    title: node.title,
    price: price ? `${price.currencyCode} ${Number(price.amount).toFixed(0)}` : '',
    image: node?.featuredImage?.url ?? null,
    url:
      node.onlineStoreUrl ||
      `https://${shopDomain}/products/${node.handle}`,
    handle: node.handle,
  };
}

/**
 * Given a natural-language customer request, return up to `limit` product recs.
 * `keywordExtractor` and `ranker` both use the LLM (provider-abstracted).
 */
export async function recommendProducts(
  shopDomain: string,
  accessToken: string,
  request: string,
  llm: {
    keywords: (req: string) => Promise<string>;
    rank: (req: string, products: { i: number; title: string; price: string }[]) => Promise<number[]>;
  },
  limit = 3
): Promise<ProductRec[]> {
  // 1) Turn the request into search keywords (e.g. "gift for my mom" -> "women gift")
  const keywords = (await llm.keywords(request)) || request;

  // 2) Fetch candidates from the store
  let candidates = await fetchCandidates(shopDomain, accessToken, keywords);
  if (candidates.length === 0) {
    // fallback: try the raw request
    candidates = await fetchCandidates(shopDomain, accessToken, request);
  }
  if (candidates.length === 0) return [];

  // 3) Ask the LLM to rank which candidates best fit the request
  const brief = candidates.slice(0, 15).map((n, i) => ({
    i,
    title: n.title,
    price: n?.priceRangeV2?.minVariantPrice?.amount ?? '',
  }));
  let order: number[] = [];
  try {
    order = await llm.rank(request, brief);
  } catch {
    order = brief.map((b) => b.i);
  }
  if (!order || order.length === 0) order = brief.map((b) => b.i);

  const picked = order
    .filter((i) => candidates[i])
    .slice(0, limit)
    .map((i) => toRec(candidates[i], shopDomain));

  // if ranking returned nothing usable, fall back to first few
  if (picked.length === 0) {
    return candidates.slice(0, limit).map((n) => toRec(n, shopDomain));
  }
  return picked;
}
