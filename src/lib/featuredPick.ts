/**
 * How the products on the widget's welcome screen are chosen.
 *
 * Three modes, because merchants asked for two different things and neither
 * suits everyone: a collection is set once and keeps itself current, while a
 * hand-picked list gives exact control at the cost of maintaining it. Shops
 * that want neither keep the automatic behaviour they already had.
 *
 * Shared by the settings screen, the settings API and the storefront config,
 * so the three cannot drift apart on what a stored value means.
 */

export type FeaturedMode = 'auto' | 'collection' | 'products';

export type FeaturedPick = {
  mode: FeaturedMode;
  /** Collection handle, for `collection` mode. */
  collection: string;
  /** Product GIDs, for `products` mode. */
  productIds: string[];
};

export const MAX_PICKED_PRODUCTS = 6;

export function defaultPick(): FeaturedPick {
  return { mode: 'auto', collection: '', productIds: [] };
}

/**
 * Read the stored JSON into a complete value. Anything unparseable falls back
 * to automatic: a corrupt row should leave the widget showing something rather
 * than nothing.
 */
export function parsePick(raw: string | null | undefined): FeaturedPick {
  if (!raw) return defaultPick();
  try {
    return sanitizePick(JSON.parse(raw));
  } catch {
    return defaultPick();
  }
}

/** Keep only what we understand, so a hand-made request cannot write junk. */
export function sanitizePick(input: unknown): FeaturedPick {
  const out = defaultPick();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  const o = input as Record<string, unknown>;

  if (o.mode === 'collection' || o.mode === 'products') out.mode = o.mode;

  if (typeof o.collection === 'string') {
    // A Shopify handle is lowercase alphanumeric with hyphens, and this value
    // is interpolated into a search query — so anything else is dropped rather
    // than escaped.
    out.collection = o.collection.trim().toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 255);
  }

  if (Array.isArray(o.productIds)) {
    out.productIds = o.productIds
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.trim())
      .filter((id) => /^gid:\/\/shopify\/Product\/\d+$/.test(id))
      .slice(0, MAX_PICKED_PRODUCTS);
  }

  // A mode with nothing chosen would show an empty welcome screen, which is
  // worse than the automatic list it replaced.
  if (out.mode === 'collection' && !out.collection) out.mode = 'auto';
  if (out.mode === 'products' && !out.productIds.length) out.mode = 'auto';

  return out;
}
