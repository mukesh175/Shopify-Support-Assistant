import { ADMIN_API_VERSION } from './api-version';

/* ---- Store profile --------------------------------------------------------
 * What the assistant knows about the shop itself, as opposed to the answers
 * the merchant typed into the knowledge base.
 *
 * Without this the model only ever saw the FAQ rows, so anything the merchant
 * had not written out by hand came back as "I'm not sure about that". A
 * shopper on VIRAABYA asked "i need more information about website" and was
 * told the team would follow up — about the store they were standing in. The
 * same gap produced "water bottle" and "yeh product mein kyu khareedoon" on
 * other shops: ordinary questions about the catalogue, unanswerable only
 * because the catalogue was never shown to the assistant.
 *
 * Everything here comes from scopes the app already holds (read_products and
 * the shop fields any installation may read), so no merchant has to re-approve
 * anything to get it.
 */

export type StoreProfile = {
  name: string;
  description: string | null;
  url: string | null;
  contactEmail: string | null;
  currency: string | null;
  country: string | null;
  collections: string[];
  productTypes: string[];
};

const PROFILE_QUERY = /* GraphQL */ `
  query StoreProfile {
    shop {
      name
      description
      contactEmail
      currencyCode
      primaryDomain { url }
      billingAddress { country }
      productTypes(first: 25) { edges { node } }
    }
    collections(first: 20, sortKey: TITLE) {
      edges { node { title productsCount { count } } }
    }
  }
`;

// If one field in the full query is ever rejected — Shopify deprecates fields
// between API versions — the whole query fails and the assistant silently
// loses its store context again. The minimal query asks only for what the
// Admin API has always exposed, so a rejected field costs detail, not the
// feature.
const MINIMAL_QUERY = /* GraphQL */ `
  query StoreProfileMinimal {
    shop {
      name
      primaryDomain { url }
    }
    collections(first: 20, sortKey: TITLE) {
      edges { node { title productsCount { count } } }
    }
  }
`;

// A shop's name, collections and product types do not change minute to minute,
// and this now runs on every FAQ question. Cache it the way getActivePlan
// caches the plan: long enough to spare the merchant's API quota, short enough
// that a new collection shows up the same session.
const PROFILE_TTL_MS = 10 * 60 * 1000;
const profileCache = new Map<string, { profile: StoreProfile; at: number }>();

/** Drop a shop's cached profile — used by tests and after a reinstall. */
export function clearStoreProfileCache(shopDomain: string) {
  profileCache.delete(shopDomain);
}

/**
 * Read the shop's own details for the assistant's prompt.
 *
 * Returns null on any failure. A missing profile must never cost the shopper
 * their answer: the assistant simply falls back to the knowledge base alone,
 * which is exactly how it behaved before this existed.
 */
export async function fetchStoreProfile(
  shopDomain: string,
  accessToken: string
): Promise<StoreProfile | null> {
  const now = Date.now();
  const hit = profileCache.get(shopDomain);
  if (hit && now - hit.at < PROFILE_TTL_MS) return hit.profile;

  try {
    const ask = async (query: string) => {
      const res = await fetch(
        `https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
          },
          // The shopper is waiting on this, and the LLM call still has to
          // happen afterwards. A slow profile is worth less than a prompt reply.
          signal: AbortSignal.timeout(6000),
          body: JSON.stringify({ query }),
        }
      );
      if (!res.ok) return null;
      return res.json();
    };

    let data = await ask(PROFILE_QUERY);
    if (data?.errors?.length) {
      console.error(
        '[store-profile] full query rejected, retrying minimal',
        JSON.stringify(data.errors).slice(0, 300)
      );
      data = await ask(MINIMAL_QUERY);
      if (data?.errors?.length) {
        console.error(
          '[store-profile] minimal query rejected',
          JSON.stringify(data.errors).slice(0, 300)
        );
        return null;
      }
    }

    const shop = data?.data?.shop;
    if (!shop?.name) return null;

    const profile: StoreProfile = {
      name: shop.name,
      description: shop.description?.trim() || null,
      url: shop.primaryDomain?.url ?? null,
      contactEmail: shop.contactEmail ?? null,
      currency: shop.currencyCode ?? null,
      country: shop.billingAddress?.country ?? null,
      productTypes: (shop.productTypes?.edges ?? [])
        .map((e: any) => String(e?.node ?? '').trim())
        .filter(Boolean),
      // An empty collection tells the shopper nothing and invites the
      // assistant to send them somewhere with nothing in it.
      collections: (data?.data?.collections?.edges ?? [])
        .map((e: any) => e?.node)
        .filter((n: any) => (n?.productsCount?.count ?? 0) > 0)
        .map((n: any) => String(n.title).trim())
        .filter(Boolean),
    };

    for (const [key, v] of profileCache) {
      if (now - v.at >= PROFILE_TTL_MS) profileCache.delete(key);
    }
    profileCache.set(shopDomain, { profile, at: now });
    return profile;
  } catch (err) {
    console.error('[store-profile] fetch failed', String(err).slice(0, 200));
    return null;
  }
}

/** Render the profile as the prompt section the model reads. */
export function storeProfileText(profile: StoreProfile | null): string | null {
  if (!profile) return null;
  const lines = [`Store name: ${profile.name}`];
  if (profile.url) lines.push(`Store website: ${profile.url}`);
  if (profile.description) lines.push(`About the store: ${profile.description}`);
  if (profile.country) lines.push(`Based in: ${profile.country}`);
  if (profile.currency) lines.push(`Prices are in: ${profile.currency}`);
  if (profile.contactEmail) lines.push(`Contact email: ${profile.contactEmail}`);
  if (profile.collections.length)
    lines.push(`Collections customers can browse: ${profile.collections.join(', ')}`);
  if (profile.productTypes.length)
    lines.push(`Kinds of products sold: ${profile.productTypes.join(', ')}`);
  return lines.join('\n');
}
