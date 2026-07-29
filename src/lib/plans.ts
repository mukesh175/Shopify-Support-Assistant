// Plan definitions. These MUST match the plan names you configure in the
// Partner Dashboard under Shopify App Pricing (App submission > Pricing).
// The app reads the merchant's active subscription and gates features here.

export type PlanKey = 'free' | 'pro';

export type Plan = {
  key: PlanKey;
  // Must EXACTLY match the plan "name" set in the Partner Dashboard.
  shopifyPlanName: string;
  price: string;
  monthlyQueryLimit: number | null; // null = unlimited
  maxFaqs: number | null;
  whatsappHandoff: boolean;
  removeBranding: boolean;
};

export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: 'free',
    shopifyPlanName: 'Free',
    price: '$0',
    monthlyQueryLimit: 100,
    maxFaqs: 10,
    whatsappHandoff: false,
    removeBranding: false,
  },
  pro: {
    key: 'pro',
    shopifyPlanName: 'Pro',
    price: '$9.99/month',
    monthlyQueryLimit: null,
    maxFaqs: null,
    whatsappHandoff: true,
    removeBranding: true,
  },
};

// Map a Shopify active-subscription name to our plan. Anything unrecognized or
// absent = free.
export function planFromSubscriptionName(name?: string | null): Plan {
  if (name && name.toLowerCase().includes('pro')) return PLANS.pro;
  return PLANS.free;
}
