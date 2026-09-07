import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import {
  parseQuickActions,
  defaultQuickActions,
  type QuickActionKey,
  type QuickActionSettings,
} from '@/lib/quickActions';

/**
 * The shop's chat-button settings, read from the database.
 *
 * Server-only: kept apart from the pure definitions in `quickActions.ts` so
 * the settings screen can import the labels without pulling the database
 * client into the browser bundle.
 */
export async function getShopQuickActions(shopDomain: string): Promise<QuickActionSettings> {
  try {
    const [row] = await db
      .select({ quickActions: schema.shops.quickActions })
      .from(schema.shops)
      .where(eq(schema.shops.shopDomain, shopDomain))
      .limit(1);
    return parseQuickActions(row?.quickActions);
  } catch {
    // A database hiccup should not silently strip the widget of its buttons.
    return defaultQuickActions();
  }
}

/**
 * Whether an action the shopper triggered is one this shop actually offers.
 *
 * The widget already hides buttons the merchant turned off, but that is only
 * presentation — a request can still arrive for a hidden action, so the
 * endpoints check here before doing the work.
 */
export async function quickActionEnabled(
  shopDomain: string,
  key: QuickActionKey
): Promise<boolean> {
  return (await getShopQuickActions(shopDomain))[key];
}

/** What an endpoint returns when the merchant has turned that action off. */
export const ACTION_OFF = {
  kind: 'disabled' as const,
  text: "That option isn't available in this store's chat. Ask me a question and I'll help however I can.",
};
