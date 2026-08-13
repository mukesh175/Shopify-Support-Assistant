/**
 * The app handle, as registered with Shopify. This MUST stay identical to
 * `handle` in shopify.app.toml — Shopify's admin URLs (including the managed
 * pricing page) 404 if the handle doesn't match exactly.
 *
 * Deliberately a constant rather than an env var: a stale APP_HANDLE in a
 * deployment environment silently breaks the upgrade link, and the handle
 * changes only when the app itself is renamed in shopify.app.toml.
 */
export const APP_HANDLE = 'smukesh-support-app';
