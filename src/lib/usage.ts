import { sql } from 'drizzle-orm';

/**
 * What does NOT count as the merchant's usage.
 *
 * An 'error' row means every AI provider we have failed and the shopper got an
 * apology instead of an answer. That is our outage, and spending a shop's
 * monthly allowance on it is indefensible — on 25 August one shop lost ten of
 * its hundred answers to a Gemini model being retired without notice, having
 * helped nobody.
 *
 * Four places count this table: the cap itself, the usage bar, the Home
 * dashboard and Analytics. They were silently disagreeing, so the rule lives
 * here once, in both the forms those places need.
 */
export const UNCOUNTED_KINDS = ['error'];

/** The same rule for raw SQL, so the two cannot drift apart. */
export const COUNTS_AS_USAGE = sql.raw(
  `kind NOT IN (${UNCOUNTED_KINDS.map((k) => `'${k}'`).join(', ')})`
);
