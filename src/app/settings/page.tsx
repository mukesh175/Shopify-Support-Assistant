'use client';

import { useEffect, useState } from 'react';
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, TextField,
  Button, Banner, SkeletonBodyText, Checkbox, Select, Tag,
} from '@shopify/polaris';
import { apiFetch } from '../lib-client';
import {
  defaultPick, MAX_PICKED_PRODUCTS, type FeaturedPick,
} from '@/lib/featuredPick';
import {
  QUICK_ACTIONS, defaultQuickActions,
  type QuickActionKey, type QuickActionSettings,
} from '@/lib/quickActions';

export default function SettingsPage() {
  const [number, setNumber] = useState('');
  // Saves on its own, like the chat buttons: it is on every plan, so it must
  // not run into the WhatsApp plan gate.
  const [email, setEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [savedEmail, setSavedEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Which products the widget's welcome screen shows.
  const [pick, setPick] = useState<FeaturedPick>(defaultPick);
  const [picked, setPicked] = useState<Array<{ id: string; title: string }>>([]);
  const [collections, setCollections] = useState<Array<{ title: string; handle: string; count: number }>>([]);
  const [savingPick, setSavingPick] = useState(false);
  const [savedPick, setSavedPick] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
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
          setEmail(d.supportEmail ?? '');
          setAllowed(!!d.whatsappHandoff);
          if (d.featuredPick) setPick({ ...defaultPick(), ...d.featuredPick });
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

  // Fetched once, and only when the merchant actually wants a collection —
  // it is an Admin API call, and most merchants never open this mode.
  useEffect(() => {
    if (pick.mode !== 'collection' || collections.length) return;
    (async () => {
      try {
        const res = await apiFetch('/api/collections');
        if (res.ok) setCollections((await res.json()).collections ?? []);
      } catch { /* the dropdown falls back to whatever is already chosen */ }
    })();
  }, [pick.mode, collections.length]);

  /**
   * Shopify's own product picker, from App Bridge. Using it rather than
   * building a search means the merchant browses their catalogue exactly as
   * they do everywhere else in the admin, with images and variants.
   */
  async function choose() {
    const bridge = (window as any).shopify;
    if (!bridge?.resourcePicker) {
      setPickError('The product picker needs the app to be open inside your Shopify admin.');
      return;
    }
    try {
      const selection = await bridge.resourcePicker({
        type: 'product',
        multiple: MAX_PICKED_PRODUCTS,
        // Reopening the picker should show what is already chosen, not a
        // blank slate the merchant has to rebuild from memory.
        selectionIds: pick.productIds.map((id) => ({ id })),
      });
      if (!selection?.length) return;   // cancelled
      const chosen = selection.slice(0, MAX_PICKED_PRODUCTS)
        .map((p: any) => ({ id: String(p.id), title: String(p.title ?? '') }));
      setPicked(chosen);
      setPick((p) => ({ ...p, productIds: chosen.map((c: any) => c.id) }));
      setSavedPick(false);
    } catch {
      /* the picker throws on cancel in some versions — nothing to report */
    }
  }

  async function savePick() {
    setSavingPick(true);
    setPickError(null);
    setSavedPick(false);
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ featuredPick: pick }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setPickError(d.error ?? 'Could not save');
      else {
        if (d.featuredPick) setPick({ ...defaultPick(), ...d.featuredPick });
        setSavedPick(true);
      }
    } catch (e: any) {
      setPickError(e?.message ?? 'Could not reach server');
    } finally {
      setSavingPick(false);
    }
  }

  async function saveEmail() {
    setSavingEmail(true);
    setEmailError(null);
    setSavedEmail(false);
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ supportEmail: email }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setEmailError(d.error ?? 'Could not save');
      else {
        setEmail(d.supportEmail ?? '');
        setSavedEmail(true);
      }
    } catch (e: any) {
      setEmailError(e?.message ?? 'Could not reach server');
    } finally {
      setSavingEmail(false);
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
          title="Products in the chat"
          description="The products shown on the chat's welcome screen, before a customer has typed anything."
        >
          <Card>
            <BlockStack gap="400">
              {pickError && (
                <Banner tone="critical" onDismiss={() => setPickError(null)}>
                  <p>{pickError}</p>
                </Banner>
              )}
              {savedPick && (
                <Banner tone="success" onDismiss={() => setSavedPick(false)}>
                  <p>Saved. Your storefront picks this up on the next page load.</p>
                </Banner>
              )}

              {loading ? (
                <SkeletonBodyText lines={5} />
              ) : (
                <BlockStack gap="400">
                  <Select
                    label="Choose products by"
                    options={[
                      { label: 'Automatic — your newest products', value: 'auto' },
                      { label: 'A collection', value: 'collection' },
                      { label: 'Products I pick', value: 'products' },
                    ]}
                    value={pick.mode}
                    onChange={(v) => {
                      setPick((p) => ({ ...p, mode: v as FeaturedPick['mode'] }));
                      setSavedPick(false);
                    }}
                    helpText={
                      pick.mode === 'collection'
                        ? 'Set it once — the chat follows the collection as you change it.'
                        : pick.mode === 'products'
                          ? 'Exactly these, in this order. You will need to update it as your catalogue changes.'
                          : 'No upkeep — new products appear in the chat on their own.'
                    }
                  />

                  {pick.mode === 'collection' && (
                    <Select
                      label="Collection"
                      options={[
                        { label: collections.length ? 'Choose a collection…' : 'Loading…', value: '' },
                        ...collections.map((c) => ({
                          label: `${c.title} (${c.count})`,
                          value: c.handle,
                        })),
                      ]}
                      value={pick.collection}
                      onChange={(v) => { setPick((p) => ({ ...p, collection: v })); setSavedPick(false); }}
                    />
                  )}

                  {pick.mode === 'products' && (
                    <BlockStack gap="300">
                      <InlineStack gap="200" blockAlign="center" wrap>
                        <Button onClick={choose}>
                          {pick.productIds.length ? 'Change products' : 'Choose products'}
                        </Button>
                        <Text as="span" tone="subdued" variant="bodySm">
                          {pick.productIds.length
                            ? `${pick.productIds.length} chosen (up to ${MAX_PICKED_PRODUCTS})`
                            : `Up to ${MAX_PICKED_PRODUCTS}`}
                        </Text>
                      </InlineStack>
                      {/* Titles are only known for a selection made in this
                          visit; a saved list reloads as ids until the picker
                          is reopened, so it says how many rather than
                          inventing names it does not have. */}
                      {picked.length > 0 && (
                        <InlineStack gap="150" wrap>
                          {picked.map((p) => <Tag key={p.id}>{p.title}</Tag>)}
                        </InlineStack>
                      )}
                    </BlockStack>
                  )}

                  {/* A mode with nothing chosen falls back to automatic rather
                      than emptying the welcome screen, and saying so beats
                      letting the merchant discover it on their storefront. */}
                  {((pick.mode === 'collection' && !pick.collection) ||
                    (pick.mode === 'products' && !pick.productIds.length)) && (
                    <Text as="p" tone="subdued" variant="bodySm">
                      Nothing chosen yet — the chat will keep showing your newest products.
                    </Text>
                  )}

                  <InlineStack>
                    <Button variant="primary" onClick={savePick} loading={savingPick}>
                      Save
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Talk to our team"
          description="When the assistant can't help, customers are offered your support email. Available on every plan — leave it blank to turn the option off."
        >
          <Card>
            <BlockStack gap="400">
              {emailError && (
                <Banner tone="critical" onDismiss={() => setEmailError(null)}>
                  <p>{emailError}</p>
                </Banner>
              )}
              {savedEmail && (
                <Banner tone="success" onDismiss={() => setSavedEmail(false)}>
                  <p>Support email saved.</p>
                </Banner>
              )}
              {loading ? (
                <SkeletonBodyText lines={3} />
              ) : (
                <BlockStack gap="400">
                  <TextField
                    label="Support email"
                    type="email"
                    value={email}
                    onChange={(v) => { setEmail(v); setSavedEmail(false); }}
                    autoComplete="email"
                    placeholder="help@yourstore.com"
                    helpText="Shown in the chat as “Talk to our team”, and offered whenever the assistant cannot answer."
                  />
                  <InlineStack>
                    <Button variant="primary" onClick={saveEmail} loading={savingEmail}>
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
