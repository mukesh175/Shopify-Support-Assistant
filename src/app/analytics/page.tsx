'use client';

import { useEffect, useState } from 'react';
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Banner, Link,
  SkeletonBodyText, Box, Divider, ProgressBar,
} from '@shopify/polaris';
import { apiFetch } from '../lib-client';

type Analytics = {
  total: number;
  resolved: number;
  deflectionRate: number;
  hoursSaved: number;
  breakdown: { orderStatus: number; faq: number; unresolved: number };
  trend: { day: string; count: number }[];
  topUnanswered: { question: string; count: number }[];
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Box minWidth="150px">
      <BlockStack gap="100">
        <Text as="p" variant="heading2xl">{value}</Text>
        <Text as="p" tone="subdued">{label}</Text>
        {sub && <Text as="p" variant="bodySm" tone="subdued">{sub}</Text>}
      </BlockStack>
    </Box>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/analytics');
        const d = await res.json().catch(() => ({}));
        if (!res.ok) setError(d.error ?? 'Failed to load analytics');
        else setData(d);
      } catch (e: any) {
        setError(e?.message ?? 'Could not reach server');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const maxTrend = data ? Math.max(1, ...data.trend.map((d) => d.count)) : 1;

  return (
    <Page title="Analytics" subtitle="What customers asked and how much the assistant handled.">
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical"><p>{error}</p></Banner>
          </Layout.Section>
        )}

        {loading ? (
          <Layout.Section>
            <Card><SkeletonBodyText lines={6} /></Card>
          </Layout.Section>
        ) : data && (
          <>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">This month</Text>
                  <InlineStack gap="800" wrap>
                    <Stat label="Questions handled" value={String(data.total)} />
                    <Stat label="Auto-answered" value={String(data.resolved)} sub={`${data.deflectionRate}% deflection`} />
                    <Stat label="Est. hours saved" value={`${data.hoursSaved}h`} sub="~3 min per answer" />
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Last 14 days</Text>
                  {data.trend.length === 0 ? (
                    <Text as="p" tone="subdued">No activity yet.</Text>
                  ) : (
                    <BlockStack gap="200">
                      {data.trend.map((d) => (
                        <InlineStack key={d.day} gap="300" blockAlign="center" wrap={false}>
                          <Box minWidth="52px">
                            <Text as="span" variant="bodySm" tone="subdued">{d.day.slice(5)}</Text>
                          </Box>
                          <Box width="100%">
                            <ProgressBar progress={(d.count / maxTrend) * 100} size="small" tone="primary" />
                          </Box>
                          <Box minWidth="28px">
                            <Text as="span" variant="bodySm" alignment="end">{String(d.count)}</Text>
                          </Box>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Breakdown</Text>
                  <InlineStack gap="800" wrap>
                    <Stat label="Order status" value={String(data.breakdown.orderStatus)} />
                    <Stat label="FAQ answered" value={String(data.breakdown.faq)} />
                    <Stat label="Couldn't answer" value={String(data.breakdown.unresolved)} />
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Top unanswered questions</Text>
                  <Text as="p" tone="subdued">
                    Customers asked these but the assistant had no answer. Add them to your{' '}
                    <Link url="/faqs">knowledge base</Link> to deflect them next time.
                  </Text>
                  {data.topUnanswered.length === 0 ? (
                    <Text as="p" tone="subdued">
                      Nothing here — your knowledge base is covering everything.
                    </Text>
                  ) : (
                    <BlockStack gap="0">
                      {data.topUnanswered.map((u, i) => (
                        <Box key={i}>
                          <Divider />
                          <Box paddingBlock="300">
                            <InlineStack align="space-between" gap="400" blockAlign="center">
                              <Text as="span">{u.question}</Text>
                              <Text as="span" tone="subdued">{u.count}×</Text>
                            </InlineStack>
                          </Box>
                        </Box>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}
