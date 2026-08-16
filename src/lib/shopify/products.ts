import { ADMIN_API_VERSION } from './api-version';

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
          images(first: 1) { edges { node { url } } }
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
  const q = `${keywords} status:active`.trim();
  const res = await fetch(
    `https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
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
  const image =
    node?.featuredImage?.url ??
    node?.images?.edges?.[0]?.node?.url ??
    null;
  return {
    title: node.title,
    price: price ? `${price.currencyCode} ${Number(price.amount).toFixed(0)}` : '',
    image,
    url:
      node.onlineStoreUrl ||
      `https://${shopDomain}/products/${node.handle}`,
    handle: node.handle,
  };
}

function priceOf(node: any): number {
  return Number(node?.priceRangeV2?.minVariantPrice?.amount ?? NaN);
}

// Extract a price constraint from the customer's words. Handles: "under 500",
// "below $500", "less than 2000", "over 300", "between 100 and 500", "100-500".
function parsePriceRange(text: string): { min: number; max: number } {
  const t = text.toLowerCase().replace(/[,₹$]/g, '');
  let min = 0, max = Infinity;
  let m;
  if ((m = t.match(/between\s+(\d+)\s+and\s+(\d+)/))) { min = +m[1]; max = +m[2]; }
  else if ((m = t.match(/(\d+)\s*[-to]+\s*(\d+)/))) { min = +m[1]; max = +m[2]; }
  else if ((m = t.match(/(?:under|below|less than|upto|up to|max|cheaper than)\s*(\d+)/))) { max = +m[1]; }
  else if ((m = t.match(/(?:over|above|more than|min|starting)\s*(\d+)/))) { min = +m[1]; }
  return { min, max };
}

// Fetch all active products (used when a keyword search returns nothing, e.g.
// vague requests like "gift" — we still want candidates to price-filter/rank).
async function fetchAll(shopDomain: string, accessToken: string): Promise<any[]> {
  return fetchCandidates(shopDomain, accessToken, '');
}

/**
 * Given a natural-language customer request, return up to `limit` product recs.
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
  const { min, max } = parsePriceRange(request);
  const hasPriceFilter = min > 0 || max < Infinity;

  // 1) Keywords (price words are ignored by the extractor prompt)
  const keywords = (await llm.keywords(request)) || request;

  // 2) Fetch candidates. If keyword search is empty, or the request is mostly a
  //    price filter, fall back to browsing all products so price filter works.
  let candidates = await fetchCandidates(shopDomain, accessToken, keywords);
  if (candidates.length === 0) {
    candidates = await fetchCandidates(shopDomain, accessToken, request);
  }
  if (candidates.length === 0 && hasPriceFilter) {
    candidates = await fetchAll(shopDomain, accessToken);
  }
  if (candidates.length === 0) return [];

  // 2b) Apply the price filter in code (Shopify search can't do price ranges)
  if (hasPriceFilter) {
    const filtered = candidates.filter((n) => {
      const p = priceOf(n);
      return !Number.isNaN(p) && p >= min && p <= max;
    });
    if (filtered.length > 0) candidates = filtered;
    // if nothing matches the price, we return empty rather than wrong-priced items
    else return [];
  }

  // 3) Ask the LLM to rank which candidates best fit the request
  const brief = candidates.slice(0, 15).map((n, i) => ({
    i,
    title: n.title,
    price: String(priceOf(n) || ''),
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

  if (picked.length === 0) {
    return candidates.slice(0, limit).map((n) => toRec(n, shopDomain));
  }
  return picked;
}
