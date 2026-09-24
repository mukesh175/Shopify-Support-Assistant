import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  index,
} from 'drizzle-orm/pg-core';

/**
 * One row per installed store. We store the OFFLINE access token so the app
 * proxy (customer-facing) can call the Admin API even when no merchant is
 * logged in. Token is encrypted at rest (see src/lib/auth/crypto.ts).
 */
export const shops = pgTable('shops', {
  id: serial('id').primaryKey(),
  shopDomain: text('shop_domain').notNull().unique(), // e.g. my-store.myshopify.com
  accessTokenEnc: text('access_token_enc').notNull(),
  refreshTokenEnc: text('refresh_token_enc'),
  scope: text('scope'),
  // expiring offline tokens (required for public apps from 2026-04-01)
  tokenExpiresAt: timestamp('token_expires_at'),
  installedAt: timestamp('installed_at').defaultNow().notNull(),
  uninstalledAt: timestamp('uninstalled_at'),
  // merchant-configurable widget settings
  widgetEnabled: boolean('widget_enabled').default(true).notNull(),
  brandName: text('brand_name'),
  greeting: text('greeting').default("Hi! Ask me about your order or our policies."),
  // WhatsApp handoff number, digits only (e.g. 919876543210). Stored here
  // rather than in theme settings so it is never rendered into the storefront
  // HTML of shops whose plan does not include handoff.
  whatsappNumber: text('whatsapp_number'),
  // Where a shopper is sent when the assistant cannot help and the shop has no
  // WhatsApp handoff. Deliberately not gated by plan: a shop with no route to a
  // human is a worse product, and an email address is not a feature worth
  // charging for.
  supportEmail: text('support_email'),
  // When the handoff options are offered: 'fallback' (only once the assistant
  // has failed) or 'always' (a button too). See src/lib/handoff.ts.
  handoffMode: text('handoff_mode'),
  // Random slug identifying this shop's inbound email address. The merchant
  // forwards their support inbox to <slug>@<inbound domain>, and that is how
  // an arriving email is matched back to a shop.
  inboundToken: text('inbound_token'),
  // Two short phrases naming things this shop actually sells, used as examples
  // in the product-finder prompt. Cached because the storefront widget asks for
  // config on every page load and this would otherwise be an Admin API call
  // each time.
  productExamples: text('product_examples'),
  // Best sellers with their images, shown on the widget's welcome screen.
  // Cached beside the examples above and refreshed on the same clock — the
  // storefront asks for config on every page load, and this must never become
  // an Admin API call per view.
  featuredProducts: text('featured_products'),
  // How the merchant wants those chosen, as JSON (see src/lib/featuredPick.ts).
  // Null means automatic, which is what every shop had before the setting
  // existed. Editing this clears productExamplesAt so the change is visible on
  // the storefront immediately rather than whenever the cache next expires.
  featuredPick: text('featured_pick'),
  productExamplesAt: timestamp('product_examples_at'),
  // Which chat buttons the widget offers, as a JSON object keyed by action
  // (see src/lib/quickActions.ts). Null means the merchant has never touched
  // the setting, which reads as "all of them".
  quickActions: text('quick_actions'),
  // Last time the storefront widget asked us for its config. This is how the
  // app knows the theme embed is actually switched on — there is no Admin API
  // that will tell us. Written at most hourly, so a busy shop does not pay for
  // a database round trip on every page view.
  widgetLastSeenAt: timestamp('widget_last_seen_at'),
  // Last time the merchant opened the app in their Shopify admin. Paired with
  // widgetLastSeenAt this separates an install nobody ever came back to from
  // one where the merchant looked at the setup screen and left anyway — two
  // problems with nothing in common but the symptom.
  adminLastSeenAt: timestamp('admin_last_seen_at'),
});

/**
 * Knowledge base entries the LLM answers from. Kept per-shop.
 * Keeping this small + retrieval-based means answers stay grounded and cheap.
 */
export const faqs = pgTable(
  'faqs',
  {
    id: serial('id').primaryKey(),
    shopDomain: text('shop_domain').notNull(),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    shopIdx: index('faqs_shop_idx').on(t.shopDomain),
  })
);

/**
 * Return requests raised by shoppers through the assistant.
 *
 * The app holds read-only Admin API scopes, so it records the request and the
 * merchant carries it out in Shopify themselves. Keeping it here rather than
 * creating a Shopify return means installed merchants never have to re-approve
 * permissions, and nothing is actioned in their store without them.
 */
export const returnRequests = pgTable(
  'return_requests',
  {
    id: serial('id').primaryKey(),
    shopDomain: text('shop_domain').notNull(),
    orderName: text('order_name').notNull(),
    email: text('email').notNull(),
    // return | cancel — what the shopper is asking the merchant to do.
    // Defaults to return so rows written before cancellations existed are
    // still classified correctly.
    type: text('type').default('return').notNull(),
    // JSON array of { lineItemId, title, variantTitle, quantity }.
    // Empty for cancellations, which concern the whole order.
    items: text('items').notNull(),
    reason: text('reason').notNull(),
    note: text('note'),
    // What the vision model saw in the shopper's photos. Null when no photos
    // were sent, or when the model was unavailable — the request still stands.
    aiAssessment: text('ai_assessment'),
    // pending | approved | declined | completed
    status: text('status').default('pending').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    shopIdx: index('returns_shop_idx').on(t.shopDomain),
  })
);

/**
 * Photos a shopper attached to a request, as data URLs.
 *
 * Kept in their own table so listing requests never drags image bytes along,
 * and so they can be purged or moved to object storage without touching the
 * requests themselves. The widget downscales before uploading and the server
 * caps both count and size, but this table will still grow faster than any
 * other — worth moving to blob storage once volume justifies it.
 */
export const requestPhotos = pgTable(
  'request_photos',
  {
    id: serial('id').primaryKey(),
    requestId: integer('request_id').notNull(),
    shopDomain: text('shop_domain').notNull(),
    dataUrl: text('data_url').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    requestIdx: index('photos_request_idx').on(t.requestId),
  })
);

/**
 * One email conversation with a customer. Threads are keyed by the customer's
 * address rather than by mail headers: shoppers routinely reply from a phone
 * that drops References, or start a fresh mail about the same problem, and
 * grouping by person matches how a merchant thinks about it.
 */
export const emailThreads = pgTable(
  'email_threads',
  {
    id: serial('id').primaryKey(),
    shopDomain: text('shop_domain').notNull(),
    customerEmail: text('customer_email').notNull(),
    subject: text('subject').notNull(),
    // open | replied | closed
    status: text('status').default('open').notNull(),
    lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    shopIdx: index('email_threads_shop_idx').on(t.shopDomain),
  })
);

/**
 * Individual emails within a thread, inbound and outbound.
 *
 * A draft is held here too, with sentAt null, so a merchant can come back to a
 * half-edited reply. Nothing is sent without the merchant pressing send.
 */
export const emailMessages = pgTable(
  'email_messages',
  {
    id: serial('id').primaryKey(),
    threadId: integer('thread_id').notNull(),
    shopDomain: text('shop_domain').notNull(),
    // inbound (from the customer) | outbound (from the merchant)
    direction: text('direction').notNull(),
    body: text('body').notNull(),
    // Set on outbound messages once actually sent; null while still a draft.
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    threadIdx: index('email_messages_thread_idx').on(t.threadId),
  })
);

/**
 * Log every customer query so the merchant can see what's being asked and
 * whether the AI deflected it. This is the data that proves ROI ("we deflected
 * N tickets this month") — the thing you sell.
 */
export const queryLogs = pgTable(
  'query_logs',
  {
    id: serial('id').primaryKey(),
    shopDomain: text('shop_domain').notNull(),
    question: text('question').notNull(),
    answer: text('answer'),
    kind: text('kind').notNull(), // 'order_status' | 'faq' | 'unresolved'
    resolved: boolean('resolved').default(false).notNull(),
    // The merchant has acted on this gap — usually by saving an answer to the
    // knowledge base. Distinct from `resolved`, which records whether the
    // assistant managed to answer at the time.
    handled: boolean('handled').default(false).notNull(),
    // What the shopper thought of the answer: 'up' | 'down', null if they
    // never said. This is the only signal that comes from the customer rather
    // than from us, which is what makes it worth showing a merchant.
    rating: text('rating'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    shopIdx: index('logs_shop_idx').on(t.shopDomain),
  })
);
