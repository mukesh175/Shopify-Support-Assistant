'use client';

import { useEffect, useState } from 'react';
import {
  Layout, Card, BlockStack, InlineStack, Text, Button, Badge, Icon,
  SkeletonBodyText, Box,
} from '@shopify/polaris';
import { CheckIcon } from '@shopify/polaris-icons';
import { apiFetch } from './lib-client';

type PlanInfo = {
  plan: string;
  planName: string;
  price: string;
  monthlyQueryLimit: number | null;
  used: number;
  upgradeUrl: string;
};

type PlanCard = {
  id: 'free' | 'starter' | 'pro';
  name: string;
  price: string;
  cadence?: string;
  popular?: boolean;
  features: string[];
};

const PLAN_CARDS: PlanCard[] = [
  {
    id: 'free', name: 'Free', price: '$0',
    features: ['100 answers/mo', 'Order tracking', '5 saved Q&As', '5 recommendations/mo', 'English only'],
  },
  {
    id: 'starter', name: 'Starter', price: '$5', cadence: '/mo', popular: true,
    features: ['500 answers/mo', 'WhatsApp handoff', '50 saved Q&As', '100 recommendations/mo', 'All languages'],
  },
  {
    id: 'pro', name: 'Pro', price: '$9.99', cadence: '/mo',
    features: ['Unlimited answers', 'Unlimited recommendations', 'Unlimited Q&As', 'WhatsApp handoff', 'Remove branding'],
  },
];

export default function PlansSection() {
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/plan');
        if (res.ok) setInfo(await res.json());
      } catch {
        /* plan cards still render without the CTA */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Layout>
      {PLAN_CARDS.map((plan) => {
        const isCurrent = info?.plan === plan.id;
        return (
          <Layout.Section variant="oneThird" key={plan.id}>
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h3" variant="headingMd">{plan.name}</Text>
                    {plan.popular && <Badge tone="success">Popular</Badge>}
                  </InlineStack>
                  <InlineStack gap="100" blockAlign="baseline">
                    <Text as="p" variant="headingLg">{plan.price}</Text>
                    {plan.cadence && <Text as="span" tone="subdued">{plan.cadence}</Text>}
                  </InlineStack>
                </BlockStack>

                <BlockStack gap="200">
                  {plan.features.map((f) => (
                    <InlineStack key={f} gap="150" blockAlign="start" wrap={false}>
                      <Box><Icon source={CheckIcon} tone="success" /></Box>
                      <Text as="span" variant="bodySm">{f}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>

                {loading ? (
                  <SkeletonBodyText lines={1} />
                ) : isCurrent ? (
                  <Button fullWidth disabled>Current plan</Button>
                ) : info ? (
                  <Button fullWidth variant="primary" url={info.upgradeUrl} target="_top">
                    Upgrade
                  </Button>
                ) : null}
              </BlockStack>
            </Card>
          </Layout.Section>
        );
      })}
    </Layout>
  );
}
