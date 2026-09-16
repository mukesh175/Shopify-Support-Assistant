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
  try {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        // A hung Admin API call must not run out the whole request budget.
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ query: SEARCH_QUERY, variables: { q } }),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data?.products?.edges ?? []).map((e: any) => e.node);
  } catch {
    // A network error here used to escape as a 500, which the widget could
    // only report as "could not reach support". No candidates is the honest
    // answer, and the caller already has a message for it.
    return [];
  }
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
  // Only worth a second search when it would actually differ: with the model
  // unavailable, keywords fall back to the raw request and this repeated the
  // identical query, paying a round trip for the same empty result.
  if (candidates.length === 0 && keywords !== request) {
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

  // 3) Ask the LLM to rank which candidates best fit the request. With no more
  //    candidates than we can show, ranking cannot change the answer — skip the
  //    round trip and show them.
  if (candidates.length <= limit) {
    return candidates.map((n) => toRec(n, shopDomain));
  }

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

const EXAMPLES_QUERY = /* GraphQL */ `
  query ProductExamples {
    products(first: 25, sortKey: BEST_SELLING) {
      edges { node { title productType } }
    }
  }
`;

/**
 * Two short phrases naming things this shop actually sells.
 *
 * The product finder used to suggest "black snowboard" and "gift under $500",
 * which came from Shopify's demo data. On a real shop that reads as though the
 * assistant has never seen the catalogue, so the examples come from the
 * catalogue instead.
 *
 * Product type first — "Headset" is a better prompt than a full SKU title —
 * falling back to the opening words of a title when types are not set.
 */
export async function fetchProductExamples(
  shopDomain: string,
  accessToken: string
): Promise<string[]> {
  try {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query: EXAMPLES_QUERY }),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const nodes = (data?.data?.products?.edges ?? []).map((e: any) => e.node);

    const seen = new Set<string>();
    const out: string[] = [];

    for (const source of [
      nodes.map((n: any) => (n.productType ?? '').trim()),
      // Full titles are often long and SKU-ish, so keep the first few words.
      nodes.map((n: any) => (n.title ?? '').trim().split(/\s+/).slice(0, 3).join(' ')),
    ]) {
      for (const raw of source) {
        const v = String(raw).toLowerCase();
        if (v.length < 3 || v.length > 28 || seen.has(v)) continue;
        seen.add(v);
        out.push(String(raw));
        if (out.length >= 2) return out;
      }
    }
    return out;
  } catch {
    return [];
  }
}

/* ---- Collection browsing --------------------------------------------------
 * A shopper who cannot describe what they want in words can tap through the
 * store's own collections instead. This is plain catalogue browsing — no model
 * is involved, so it costs nothing beyond the Admin API call.
 */

export type CollectionRec = {
  title: string;
  handle: string;
  image: string | null;
  count: number;
  url: string;
};

const COLLECTIONS_QUERY = /* GraphQL */ `
  query Collections($first: Int!) {
    collections(first: $first, sortKey: TITLE) {
      edges {
        node {
          title
          handle
          image { url }
          productsCount { count }
        }
      }
    }
  }
`;

/**
 * The store's collections, largest first so the useful ones lead.
 *
 * Empty collections are dropped: tapping into one and finding nothing is worse
 * than never being offered it.
 */
export async function fetchCollections(
  shopDomain: string,
  accessToken: string,
  limit = 12
): Promise<CollectionRec[]> {
  try {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          query: COLLECTIONS_QUERY,
          variables: { first: Math.min(Math.max(limit, 1), 50) },
        }),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const nodes = (data?.data?.collections?.edges ?? []).map((e: any) => e.node);
    return nodes
      .map((n: any) => ({
        title: String(n?.title ?? '').trim(),
        handle: String(n?.handle ?? ''),
        image: n?.image?.url ?? null,
        count: Number(n?.productsCount?.count ?? 0),
        url: `https://${shopDomain}/collections/${n?.handle ?? ''}`,
      }))
      .filter((c: CollectionRec) => c.title && c.handle && c.count > 0)
      .sort((a: CollectionRec, b: CollectionRec) => b.count - a.count)
      .slice(0, limit);
  } catch {
    return [];
  }
}

const COLLECTION_PRODUCTS_QUERY = /* GraphQL */ `
  query CollectionProducts($q: String!, $first: Int!) {
    collections(first: 1, query: $q) {
      edges {
        node {
          title
          products(first: $first, sortKey: BEST_SELLING) {
            edges {
              node {
                title
                handle
                onlineStoreUrl
                featuredImage { url }
                images(first: 1) { edges { node { url } } }
                priceRangeV2 { minVariantPrice { amount currencyCode } }
              }
            }
          }
        }
      }
    }
  }
`;

/** Products inside one collection, best sellers first. */
export async function fetchCollectionProducts(
  shopDomain: string,
  accessToken: string,
  handle: string,
  limit = 6
): Promise<{ title: string; products: ProductRec[] }> {
  try {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          query: COLLECTION_PRODUCTS_QUERY,
          // Quoted so a handle with a dash is one term rather than a negation.
          variables: {
            q: `handle:"${handle.replace(/"/g, '')}"`,
            first: Math.min(Math.max(limit, 1), 20),
          },
        }),
      }
    );
    if (!res.ok) return { title: '', products: [] };
    const data = await res.json();
    const col = data?.data?.collections?.edges?.[0]?.node;
    if (!col) return { title: '', products: [] };
    const nodes = (col?.products?.edges ?? []).map((e: any) => e.node);
    return {
      title: String(col.title ?? ''),
      products: nodes.map((n: any) => toRec(n, shopDomain)),
    };
  } catch {
    return { title: '', products: [] };
  }
}

const FEATURED_QUERY = /* GraphQL */ `
  query FeaturedProducts($first: Int!) {
    products(first: $first, sortKey: BEST_SELLING) {
      edges {
        node {
          title
          handle
          onlineStoreUrl
          featuredImage { url }
          images(first: 1) { edges { node { url } } }
          priceRangeV2 { minVariantPrice { amount currencyCode } }
        }
      }
    }
  }
`;

/**
 * A handful of the shop's best sellers, for the widget's welcome screen.
 *
 * An empty chat panel gives a shopper nothing to react to. Showing real
 * products from this store — with their real photos — says the assistant knows
 * the catalogue before anyone has typed anything, and gives someone who opened
 * the chat out of curiosity somewhere to go.
 *
 * Products without an image are dropped: the point of this is the picture, and
 * a placeholder letter in a fanned deck looks broken rather than minimal.
 */
export async function fetchFeaturedProducts(
  shopDomain: string,
  accessToken: string,
  limit = 6
): Promise<ProductRec[]> {
  try {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          query: FEATURED_QUERY,
          // Over-fetch: some of the best sellers will have no image.
          variables: { first: Math.min(limit * 3, 30) },
        }),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    // GraphQL reports a bad query as 200 with an `errors` array, so without
    // this an invalid field or argument looks exactly like a shop that sells
    // nothing — which is how a `query:` argument this connection rejects sat
    // unnoticed, writing an empty deck into every shop's cache.
    if (data?.errors?.length) {
      console.error('[products] featured query rejected', JSON.stringify(data.errors).slice(0, 300));
      return [];
    }
    const nodes = (data?.data?.products?.edges ?? []).map((e: any) => e.node);
    return nodes
      .map((n: any) => toRec(n, shopDomain))
      .filter((p: ProductRec) => p.image && p.title)
      .slice(0, limit);
  } catch {
    return [];
  }
}
