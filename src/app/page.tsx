'use client';

import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Button, List,
} from '@shopify/polaris';
import PlanBanner from './PlanBanner';
import ReviewPrompt from './ReviewPrompt';

export default function Home() {
  return (
    <Page title="Zappy">
      <Layout>
        <Layout.Section>
          <ReviewPrompt />
        </Layout.Section>

        <Layout.Section>
          <PlanBanner />
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">Welcome</Text>
                <Text as="p" tone="subdued">
                  An AI assistant on your storefront that answers customer
                  questions, tracks orders, and recommends products — in any
                  language, with WhatsApp handoff. Fewer repetitive messages for
                  you, faster help for customers.
                </Text>
              </BlockStack>

              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Get set up in 3 steps</Text>
                <List type="number">
                  <List.Item>Add your common answers in the knowledge base.</List.Item>
                  <List.Item>
                    Enable the Zappy app embed (Online Store → Themes → Customize → App embeds).
                  </List.Item>
                  <List.Item>Done — the chat widget appears on your storefront.</List.Item>
                </List>
              </BlockStack>

              <InlineStack gap="300">
                <Button variant="primary" url="/faqs">Manage knowledge base</Button>
                <Button url="/conversations">View conversations</Button>
                <Button url="/analytics">View analytics</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
