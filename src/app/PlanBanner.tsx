'use client';

import { useEffect, useState } from 'react';
import { Card, InlineStack, BlockStack, Text, Button, ProgressBar, Box } from '@shopify/polaris';
import { apiFetch } from './lib-client';

type PlanInfo = {
  plan: string;
  planName: string;
  price: string;
  monthlyQueryLimit: number | null;
  used: number;
  upgradeUrl: string;
};

export default function PlanBanner() {
  const [info, setInfo] = useState<PlanInfo | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/plan');
        if (res.ok) setInfo(await res.json());
      } catch {
        /* banner is non-critical */
      }
    })();
  }, []);

  if (!info) return null;

  const limited = info.monthlyQueryLimit !== null;
  const pct = limited ? Math.min(100, (info.used / info.monthlyQueryLimit!) * 100) : 0;
  const usageText = limited
    ? `${info.used} of ${info.monthlyQueryLimit} answers used this month`
    : `${info.used} answers this month · unlimited`;

  return (
    <Card>
      <InlineStack align="space-between" blockAlign="center" gap="400" wrap>
        <BlockStack gap="150">
          <InlineStack gap="200" blockAlign="baseline">
            <Text as="h2" variant="headingSm">{info.planName} plan</Text>
            <Text as="span" tone="subdued">{info.price}</Text>
          </InlineStack>
          <Text as="p" tone="subdued" variant="bodySm">{usageText}</Text>
          {limited && (
            <Box width="220px">
              <ProgressBar progress={pct} size="small" tone={pct >= 90 ? 'critical' : 'primary'} />
            </Box>
          )}
        </BlockStack>
        {info.plan !== 'pro' && <Button variant="primary" url="/plans">View plans</Button>}
      </InlineStack>
    </Card>
  );
}
