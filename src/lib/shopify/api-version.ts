/**
 * The Admin API version this app targets.
 *
 * Pinned deliberately rather than taken from the library's LATEST_API_VERSION:
 * that value moves whenever @shopify/shopify-api is upgraded, so a routine
 * dependency bump would silently change every Admin API call in production and
 * could break queries with no code change to point at.
 *
 * This MUST stay in step with `api_version` in shopify.app.toml, which sets the
 * version webhook payloads arrive in.
 *
 * Shopify supports each version for 12 months from release, so this needs a
 * deliberate bump roughly once a year — check the release notes, update both
 * places together, and re-test order lookups and webhooks.
 */
export const ADMIN_API_VERSION = '2025-07';
