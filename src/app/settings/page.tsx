'use client';

import { useEffect, useState } from 'react';
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, TextField,
  Button, Banner, SkeletonBodyText, Checkbox,
} from '@shopify/polaris';
import { apiFetch } from '../lib-client';
import {
  QUICK_ACTIONS, defaultQuickActions,
  type QuickActionKey, type QuickActionSettings,
} from '@/lib/quickActions';

export default function SettingsPage() {
  const [number, setNumber] = useState('');
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Chat buttons save on their own, so they keep their own saving/saved state.
  const [actions, setActions] = useState<QuickActionSettings>(defaultQuickActions);
  const [savingActions, setSavingActions] = useState(false);
  const [savedActions, setSavedActions] = useState(false);
  const [actionsError, setActionsError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/settings');
        const d = await res.json().catch(() => ({}));
        if (!res.ok) setError(d.error ?? 'Failed to load settings');
        else {
          setNumber(d.whatsappNumber ?? '');
          setAllowed(!!d.whatsappHandoff);
          if (d.quickActions) setActions({ ...defaultQuickActions(), ...d.quickActions });
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

  async function saveActions() {
    setSavingActions(true);
    setActionsError(null);
    setSavedActions(false);
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ quickActions: actions }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setActionsError(d.error ?? 'Could not save');
      else {
        if (d.quickActions) setActions({ ...defaultQuickActions(), ...d.quickActions });
        setSavedActions(true);
      }
    } catch (e: any) {
      setActionsError(e?.message ?? 'Could not reach server');
    } finally {
      setSavingActions(false);
    }
  }

  function toggle(key: QuickActionKey, value: boolean) {
    setActions((a) => ({ ...a, [key]: value }));
    setSavedActions(false);
  }

  // Turning every button off leaves a chat with nothing to tap, so the save is
  // blocked rather than quietly producing an empty row of buttons.
  const noneOn = QUICK_ACTIONS.every((a) => !actions[a.key]);

  return (
    <Page title="Settings">
      <Layout>
        <Layout.AnnotatedSection
          title="Chat buttons"
          description="The buttons customers see under the chat. Turn off anything your store doesn't offer — a store that never cancels orders shouldn't invite the question."
        >
          <Card>
            <BlockStack gap="400">
              {actionsError && (
                <Banner tone="critical" onDismiss={() => setActionsError(null)}>
                  <p>{actionsError}</p>
                </Banner>
              )}
              {savedActions && (
                <Banner tone="success" onDismiss={() => setSavedActions(false)}>
                  <p>Chat buttons saved. Your storefront picks this up on the next page load.</p>
                </Banner>
              )}

              {loading ? (
                <SkeletonBodyText lines={6} />
              ) : (
                <BlockStack gap="300">
                  {QUICK_ACTIONS.map((a) => (
                    <Checkbox
                      key={a.key}
                      label={a.label}
                      helpText={a.description}
                      checked={actions[a.key]}
                      onChange={(v) => toggle(a.key, v)}
                    />
                  ))}
                  {noneOn && (
                    <Text as="p" tone="critical">
                      Keep at least one button on.
                    </Text>
                  )}
                  <InlineStack>
                    <Button
                      variant="primary"
                      onClick={saveActions}
                      loading={savingActions}
                      disabled={noneOn}
                    >
                      Save
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

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
