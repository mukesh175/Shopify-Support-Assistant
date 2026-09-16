/**
 * When the ways of reaching a person — the support email and WhatsApp — are
 * put in front of a shopper.
 *
 * This is a deflection decision, not a cosmetic one. A permanent "Talk to our
 * team" button invites people to skip the assistant entirely, and the merchant
 * would see the cost of that in their monthly numbers without ever seeing the
 * cause. Offering it at the moment the assistant actually fails keeps the
 * escape hatch without advertising it.
 *
 * Both channels follow the same rule: a shopper should not have to learn that
 * one of them behaves differently from the other.
 */

export type HandoffMode = 'fallback' | 'always';

export const DEFAULT_HANDOFF: HandoffMode = 'fallback';

/** Null — a shop that has never touched the setting — reads as the default. */
export function parseHandoff(raw: string | null | undefined): HandoffMode {
  return raw === 'always' ? 'always' : DEFAULT_HANDOFF;
}
