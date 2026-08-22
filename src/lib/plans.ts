// Plan definitions. Plan NAMES here must EXACTLY match the plans you configure
// in the Partner Dashboard under Shopify App Pricing. The app reads the
// merchant's active subscription and gates features accordingly.

export type PlanKey = 'free' | 'starter' | 'pro';

export type Plan = {
  key: PlanKey;
  shopifyPlanName: string; // must match Partner Dashboard plan name
  price: string;
  monthlyQueryLimit: number | null; // null = unlimited
  monthlyRecommendationLimit: number | null; // null = unlimited, 0 = disabled
  maxFaqs: number | null;
  whatsappHandoff: boolean;
  removeBranding: boolean;
  // Replying in the customer's own language is the reason merchants pick this
  // app, so it is not something to withhold — a shop that never sees it work
  // concludes the app cannot do it, rather than that it needs to pay.
  allLanguages: boolean;
  // Shoppers can attach photos of damage, which the vision model describes.
  damagePhotos: boolean;
  // Support email is answered in the app, with drafted replies.
  emailChannel: boolean;
};

export const PLANS: Record<PlanKey, Plan> = {
  // Free limits volume, not capability. A shop should see the assistant do the
  // whole job — in the customer's language, tracking orders, taking returns —
  // and upgrade because it ran out of room, not because it never worked.
  free: {
    key: 'free',
    shopifyPlanName: 'Free',
    price: '$0',
    monthlyQueryLimit: 100,
    monthlyRecommendationLimit: 20,
    maxFaqs: 20,
    whatsappHandoff: false,
    removeBranding: false,
    allLanguages: true,
    damagePhotos: false,
    emailChannel: false,
  },
  // The paid trigger is reaching customers on more channels, not unlocking the
  // basics.
  starter: {
    key: 'starter',
    shopifyPlanName: 'Starter',
    price: '$9/month',
    monthlyQueryLimit: 1000,
    monthlyRecommendationLimit: 200,
    maxFaqs: null,
    whatsappHandoff: true,
    removeBranding: false,
    allLanguages: true,
    damagePhotos: true,
    emailChannel: false,
  },
  pro: {
    key: 'pro',
    shopifyPlanName: 'Pro',
    price: '$19/month',
    monthlyQueryLimit: null,
    monthlyRecommendationLimit: null,
    maxFaqs: null,
    whatsappHandoff: true,
    removeBranding: true,
    allLanguages: true,
    damagePhotos: true,
    emailChannel: true,
  },
};

// Map a Shopify active-subscription name to our plan. Order matters: check the
// most specific first. Anything unrecognized/absent = free.
export function planFromSubscriptionName(name?: string | null): Plan {
  const n = (name ?? '').toLowerCase();
  if (n.includes('pro')) return PLANS.pro;
  if (n.includes('starter')) return PLANS.starter;
  return PLANS.free;
}
