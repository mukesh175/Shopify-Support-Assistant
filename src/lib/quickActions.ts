/**
 * The buttons a shopper sees under the chat transcript.
 *
 * A store that does not take cancellations, or does not want repeat orders
 * pushed at people, should not have to show those buttons — so each one is
 * something the merchant turns on or off in the app under Settings. The list
 * lives here because three places need to agree on it: the settings screen,
 * the settings API, and the config the storefront widget reads.
 *
 * Order matters: it is the order the buttons appear in the widget.
 */
export const QUICK_ACTIONS = [
  {
    key: 'faq',
    label: 'Ask a question',
    description: 'Answers from your knowledge base.',
  },
  {
    key: 'product',
    label: 'Find a product — search',
    description: 'The shopper describes what they want and the assistant picks matching products.',
  },
  {
    key: 'collections',
    label: 'Find a product — browse collections',
    description: 'The shopper taps through your collections instead of describing what they want.',
  },
  {
    key: 'order',
    label: 'Track my order',
    description: 'Order status and tracking, by order number or email.',
  },
  {
    key: 'return',
    label: 'Return an item',
    description: 'Records a return request for you to action in Shopify.',
  },
  {
    key: 'cancel',
    label: 'Cancel an order',
    description: 'Records a cancellation request for you to action in Shopify.',
  },
  {
    key: 'reorder',
    label: 'Buy again',
    description: 'Puts the items from a past order back in the cart.',
  },
] as const;

export type QuickActionKey = (typeof QUICK_ACTIONS)[number]['key'];

export type QuickActionSettings = Record<QuickActionKey, boolean>;

/**
 * Everything on. A shop that has never opened the setting sees what it saw
 * before the setting existed, and a new action added later is on by default
 * rather than silently missing for every existing shop.
 */
export function defaultQuickActions(): QuickActionSettings {
  const out = {} as QuickActionSettings;
  for (const a of QUICK_ACTIONS) out[a.key] = true;
  return out;
}

/**
 * Read the stored JSON into a complete, trusted settings object. Anything
 * unparseable, missing, or not a boolean falls back to on — a corrupt row
 * should leave the widget usable rather than blank.
 */
export function parseQuickActions(raw: string | null | undefined): QuickActionSettings {
  const out = defaultQuickActions();
  if (!raw) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return out;
  for (const a of QUICK_ACTIONS) {
    const v = (parsed as Record<string, unknown>)[a.key];
    if (typeof v === 'boolean') out[a.key] = v;
  }
  return out;
}

/** Keep only known keys, so an odd request cannot write junk into the column. */
export function sanitizeQuickActions(input: unknown): QuickActionSettings {
  const out = defaultQuickActions();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const a of QUICK_ACTIONS) {
    const v = (input as Record<string, unknown>)[a.key];
    if (typeof v === 'boolean') out[a.key] = v;
  }
  return out;
}
