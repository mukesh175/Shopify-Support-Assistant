'use client';

import { useEffect, useState } from 'react';
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, TextField,
  Button, Banner, SkeletonBodyText,
} from '@shopify/polaris';
import { apiFetch } from '../lib-client';

export default function SettingsPage() {
  const [number, setNumber] = useState('');
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/settings');
        const d = await res.json().catch(() => ({}));
        if (!res.ok) setError(d.error ?? 'Failed to load settings');
        else {
          setNumber(d.whatsappNumber ?? '');
          setAllowed(!!d.whatsappHandoff);
        }
      } catch (e: any) {
        setError(e?.message ?? 'Could not reach server');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ whatsappNumber: number }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? 'Could not save');
      else {
        setNumber(d.whatsappNumber ?? '');
        setSaved(true);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not reach server');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title="Settings">
      <Layout>
        <Layout.AnnotatedSection
          title="WhatsApp handoff"
          description="When the assistant can't answer, customers can continue the conversation with you on WhatsApp."
        >
          <Card>
            <BlockStack gap="400">
              {error && (
                <Banner tone="critical" onDismiss={() => setError(null)}>
                  <p>{error}</p>
                </Banner>
              )}
              {saved && (
                <Banner tone="success" onDismiss={() => setSaved(false)}>
                  <p>WhatsApp number saved.</p>
                </Banner>
              )}

              {loading ? (
                <SkeletonBodyText lines={3} />
              ) : !allowed ? (
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Not included in your plan</Text>
                  <Text as="p" tone="subdued">
                    WhatsApp handoff is available on the Starter and Pro plans.
                  </Text>
                  <InlineStack>
                    <Button url="/plans">See plans</Button>
                  </InlineStack>
                </BlockStack>
              ) : (
                <BlockStack gap="400">
                  <TextField
                    label="WhatsApp number"
                    value={number}
                    onChange={(v) => { setNumber(v); setSaved(false); }}
                    autoComplete="tel"
                    inputMode="numeric"
                    placeholder="919876543210"
                    helpText="Include the country code, digits only. Leave blank to turn handoff off."
                  />
                  <InlineStack>
                    <Button variant="primary" onClick={save} loading={saving}>
                      Save
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>
      </Layout>
    </Page>
  );
}
