'use client';

import { Page, Text, BlockStack } from '@shopify/polaris';
import PlansSection from '../PlansSection';

export default function PlansPage() {
  return (
    <Page title="Plans" subtitle="Billing is handled securely by Shopify.">
      <BlockStack gap="500">
        <PlansSection />
        <Text as="p" tone="subdued" variant="bodySm">
          Changing plan opens Shopify&apos;s pricing page, where you can approve
          the charge. You can switch or cancel at any time.
        </Text>
      </BlockStack>
    </Page>
  );
}
