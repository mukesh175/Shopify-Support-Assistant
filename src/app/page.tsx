'use client';

import { useEffect, useState } from 'react';
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Button, Badge, Box,
  Divider, SkeletonBodyText, Icon, InlineGrid, Banner,
} from '@shopify/polaris';
import { CheckCircleIcon, AlertCircleIcon } from '@shopify/polaris-icons';
import PlanBanner from './PlanBanner';
import ReviewPrompt from './ReviewPrompt';
import { apiFetch } from './lib-client';

type Home = {
  setup: {
    widgetLive: boolean;
    widgetLastSeenAt: string | null;
    faqCount: number;
    whatsappSet: boolean;
    whatsappAvailable: boolean;
    enableWidgetUrl: string;
  };
  stats: {
    answered: number;
    resolved: number;
    deflectionRate: number;
    satisfaction: number | null;
    ratedCount: number;
    pendingRequests: number;
  };
  plan: { key: string; name: string };
};

/** One number, big. The merchant should be able to read this from across a room. */
function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <Box padding="400" background="bg-surface-secondary" borderRadius="300">
      <BlockStack gap="100">
        <Text as="p" variant="heading2xl">{value}</Text>
        <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
        {sub && <Text as="p" variant="bodySm" tone="subdued">{sub}</Text>}
      </BlockStack>
    </Box>
  );
}

/**
 * A checklist step that reflects what is actually true, not what the merchant
 * has been told to do. A tick they did not have to claim for themselves is the
 * whole point — it answers "did that work?" without them having to go and look.
 */
function Step({
  done, title, description, action, url, external, primary,
}: {
  done: boolean; title: string; description: string; action?: string; url?: string;
  external?: boolean; primary?: boolean;
}) {
  return (
    <InlineStack gap="300" blockAlign="start" wrap={false}>
      <Box>
        <Icon source={done ? CheckCircleIcon : AlertCircleIcon} tone={done ? 'success' : 'subdued'} />
      </Box>
      <Box width="100%">
        <InlineStack align="space-between" blockAlign="center" gap="300" wrap>
          <BlockStack gap="050">
            <Text as="h3" variant="headingSm">{title}</Text>
            <Text as="p" variant="bodySm" tone="subdued">{description}</Text>
          </BlockStack>
          {!done && action && url && (
            // The theme editor lives outside our iframe, so it has to open at
            // the top level rather than inside the embedded app.
            <Button
              url={url}
              target={external ? '_blank' : undefined}
              variant={primary ? 'primary' : undefined}
            >
              {action}
            </Button>
          )}
        </InlineStack>
      </Box>
    </InlineStack>
  );
}

export default function HomePage() {
  const [data, setData] = useState<Home | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/home');
        const d = await res.json().catch(() => ({}));
        if (!res.ok) setError(d.error ?? 'Could not load your dashboard');
        else setData(d);
      } catch (e: any) {
        setError(e?.message ?? 'Could not reach server');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setup = data?.setup;
  const stats = data?.stats;

  const steps = [
    {
      done: (setup?.faqCount ?? 0) > 0,
      title: 'Add your common answers',
      description: setup?.faqCount
        ? `${setup.faqCount} answer${setup.faqCount === 1 ? '' : 's'} in your knowledge base.`
        : 'Shipping times, returns, sizing — whatever customers keep asking.',
      action: 'Add answers',
      url: '/faqs',
    },
    {
      done: !!setup?.widgetLive,
      title: 'Turn on the chat widget',
      description: setup?.widgetLive
        ? 'Live on your storefront right now.'
        : 'Opens your theme editor with Zappy already selected — just press Save.',
      action: 'Enable on my store',
      url: setup?.enableWidgetUrl,
      external: true,
      // The one step that actually blocks the app from working, so it is the
      // one that gets the emphasis.
      primary: true,
    },
    {
      done: !!setup?.whatsappSet,
      title: 'Connect WhatsApp handoff',
      description: setup?.whatsappSet
        ? 'Customers can continue with you on WhatsApp.'
        : setup?.whatsappAvailable
          ? 'Optional. Let customers reach a human when the assistant cannot help.'
          : 'Optional. Available on the Starter and Pro plans.',
      action: setup?.whatsappAvailable ? 'Set up' : 'See plans',
      url: setup?.whatsappAvailable ? '/settings' : '/plans',
    },
  ];

  const remaining = steps.filter((s) => !s.done).length;

  return (
    <Page title="Zappy" subtitle="Your AI assistant for customer questions, orders, and product help.">
      <Layout>
        {/* Above everything, and loud. Of the shops that installed after the
            one-click button shipped, not one has switched the widget on — and
            until they do, nothing else on this page can happen. A card in a
            two-column grid was not saying that. */}
        {!loading && setup && !setup.widgetLive && (
          <Layout.Section>
            <Banner
              title="Your customers can't see the assistant yet"
              tone="warning"
              action={{
                content: 'Enable on my store',
                url: setup.enableWidgetUrl,
                target: '_blank',
              }}
            >
              <p>
                Zappy is installed but switched off in your theme. One click opens
                your theme editor with it already selected — press Save there and
                the chat appears on your storefront.
              </p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <ReviewPrompt />
        </Layout.Section>

        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}><p>{error}</p></Banner>
          </Layout.Section>
        )}

        {/* Status first: "is it on?" is the question a merchant opens this page with. */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
            <Card>
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h2" variant="headingSm">Storefront chat</Text>
                  {loading ? null : setup?.widgetLive
                    ? <Badge tone="success">Live</Badge>
                    : <Badge tone="attention">Not detected</Badge>}
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  {loading
                    ? 'Checking…'
                    : setup?.widgetLive
                      ? 'Your customers can see the assistant on your store.'
                      : 'Nobody can see the assistant yet. One click switches it on.'}
                </Text>
                {/* No button here: the banner above already carries it, and a
                    third copy of the same action on one screen reads as
                    clutter rather than emphasis. This card reports state. */}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h2" variant="headingSm">Knowledge base</Text>
                  {loading ? null : (setup?.faqCount ?? 0) > 0
                    ? <Badge tone="success">{`${setup!.faqCount} answers`}</Badge>
                    : <Badge tone="attention">Empty</Badge>}
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  {(setup?.faqCount ?? 0) > 0
                    ? 'The assistant answers from these, and never invents anything.'
                    : 'Without answers the assistant can only handle orders.'}
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <PlanBanner />
        </Layout.Section>

        {/* The checklist disappears once there is nothing left to do — a page of
            permanent green ticks is clutter, not reassurance. */}
        {!loading && remaining > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Finish setting up</Text>
                  <Text as="span" tone="subdued" variant="bodySm">
                    {`${steps.length - remaining} of ${steps.length} done`}
                  </Text>
                </InlineStack>
                <Divider />
                <BlockStack gap="400">
                  {steps.map((s) => <Step key={s.title} {...s} />)}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">This month</Text>
                <Button variant="plain" url="/analytics">View analytics</Button>
              </InlineStack>

              {loading ? (
                <SkeletonBodyText lines={4} />
              ) : (
                <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="300">
                  <Stat value={String(stats?.answered ?? 0)} label="Questions answered" />
                  <Stat
                    value={`${stats?.deflectionRate ?? 0}%`}
                    label="Handled without you"
                  />
                  <Stat
                    value={stats?.satisfaction === null || stats?.satisfaction === undefined
                      ? '—'
                      : `${stats.satisfaction}%`}
                    label="Rated helpful"
                    sub={stats?.ratedCount ? `${stats.ratedCount} rated` : 'No ratings yet'}
                  />
                  <Stat
                    value={String(stats?.pendingRequests ?? 0)}
                    label="Requests to action"
                  />
                </InlineGrid>
              )}

              {!loading && (stats?.pendingRequests ?? 0) > 0 && (
                <InlineStack>
                  <Button url="/returns">
                    {`Review ${stats!.pendingRequests} pending request${stats!.pendingRequests === 1 ? '' : 's'}`}
                  </Button>
                </InlineStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Knowledge base</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Add or edit the answers the assistant replies with.
                </Text>
                <InlineStack><Button url="/faqs">Manage answers</Button></InlineStack>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Conversations</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  See what customers asked, and what the assistant could not answer.
                </Text>
                <InlineStack><Button url="/conversations">View conversations</Button></InlineStack>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Appearance</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Chat buttons and WhatsApp here; colour, icon and greeting in your theme.
                </Text>
                {/* The theme editor holds half of the widget's settings, and
                    once setup is finished nothing else on this page links to
                    it — so this stays put whether or not the widget is live. */}
                <InlineStack gap="200" wrap>
                  <Button url="/settings">Open settings</Button>
                  {setup?.enableWidgetUrl && (
                    <Button url={setup.enableWidgetUrl} target="_blank" variant="plain">
                      Customize in theme editor
                    </Button>
                  )}
                </InlineStack>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
