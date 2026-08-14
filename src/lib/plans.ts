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
  // false = the assistant answers in English only; true = it replies in
  // whatever language the customer wrote in.
  allLanguages: boolean;
};

export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: 'free',
    shopifyPlanName: 'Free',
    price: '$0',
    monthlyQueryLimit: 100,
    monthlyRecommendationLimit: 5,
    maxFaqs: 5,
    whatsappHandoff: false,
    removeBranding: false,
    allLanguages: false,
  },
  starter: {
    key: 'starter',
    shopifyPlanName: 'Starter',
    price: '$5/month',
    monthlyQueryLimit: 500,
    monthlyRecommendationLimit: 100,
    maxFaqs: 50,
    whatsappHandoff: true,
    removeBranding: false,
    allLanguages: true,
  },
  pro: {
    key: 'pro',
    shopifyPlanName: 'Pro',
    price: '$9.99/month',
    monthlyQueryLimit: null,
    monthlyRecommendationLimit: null,
    maxFaqs: null,
    whatsappHandoff: true,
    removeBranding: true,
    allLanguages: true,
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
