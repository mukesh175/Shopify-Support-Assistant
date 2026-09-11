/**
 * Deep link that opens the theme editor with our app embed already switched
 * on, so the merchant only has to press Save.
 *
 * This matters more than it looks. Turning the widget on today means finding
 * Online Store → Themes → Customize → App embeds → Zappy → toggle, and most
 * merchants never get there: of the first twelve installs, half uninstalled
 * the same day and nine never had a single conversation. The app works — they
 * just never saw it work.
 *
 * Shopify's format is `activateAppId={id}/{block handle}`, where the handle is
 * the name of the .liquid file in extensions/support-widget/blocks/.
 */

// The block file name. Renaming widget.liquid breaks this link silently, so
// the two must move together.
const APP_EMBED_HANDLE = 'widget';

/**
 * Which id Shopify wants here differs between apps — the client id works for
 * some, the theme extension's own UUID for others — and a wrong one opens the
 * editor without activating anything, which is confusing rather than broken.
 * So it is configurable: set THEME_EXTENSION_ID if the client id does not
 * activate the embed, and no code has to change.
 */
function embedId(): string | null {
  return process.env.THEME_EXTENSION_ID || process.env.SHOPIFY_API_KEY || null;
}

export function appEmbedDeepLink(shopDomain: string): string | null {
  const id = embedId();
  if (!id || !shopDomain) return null;
  const store = shopDomain.replace('.myshopify.com', '');
  // Built by hand rather than with URLSearchParams: that would percent-encode
  // the slash in `{id}/{handle}`, and Shopify expects it literal — an encoded
  // one opens the editor without activating anything.
  return `https://admin.shopify.com/store/${store}/themes/current/editor` +
    `?context=apps&activateAppId=${id}/${APP_EMBED_HANDLE}`;
}

/** Where to send a merchant when we cannot build the deep link. */
export function themeEditorUrl(shopDomain: string): string {
  const store = shopDomain.replace('.myshopify.com', '');
  return `https://admin.shopify.com/store/${store}/themes/current/editor?context=apps`;
}
