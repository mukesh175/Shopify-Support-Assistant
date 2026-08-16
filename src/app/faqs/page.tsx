'use client';

import { useEffect, useState } from 'react';
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, TextField, Button,
  Banner, ResourceList, ResourceItem, EmptyState, SkeletonBodyText,
} from '@shopify/polaris';
import { apiFetch } from '../lib-client';

type Faq = { id: number; question: string; answer: string; enabled: boolean };

export default function FaqsPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/faqs');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? 'Could not load your knowledge base.');
      else setFaqs(data.faqs ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!q.trim() || !a.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch('/api/faqs', {
        method: 'POST',
        body: JSON.stringify({ question: q, answer: a }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? 'Could not save.');
      else { setQ(''); setA(''); await load(); }
    } catch (e: any) {
      setError(e?.message ?? 'Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    setError(null);
    try {
      const res = await apiFetch(`/api/faqs?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Could not delete.');
        return;
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not delete.');
    }
  }

  return (
    <Page
      title="Knowledge base"
      subtitle="Answers the assistant replies with. Everything else it marks unresolved."
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Add a question</Text>
              <TextField
                label="Question"
                value={q}
                onChange={setQ}
                autoComplete="off"
                placeholder="What is your return policy?"
              />
              <TextField
                label="Answer"
                value={a}
                onChange={setA}
                autoComplete="off"
                multiline={3}
                placeholder="Returns accepted within 30 days, unused, with receipt."
              />
              <InlineStack>
                <Button variant="primary" onClick={add} loading={saving} disabled={!q.trim() || !a.trim()}>
                  Add
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            {loading ? (
              <div style={{ padding: 16 }}><SkeletonBodyText lines={4} /></div>
            ) : faqs.length === 0 ? (
              <EmptyState
                heading="No answers saved yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Add your first question above. The assistant only answers from what you save here.</p>
              </EmptyState>
            ) : (
              <ResourceList
                resourceName={{ singular: 'answer', plural: 'answers' }}
                items={faqs}
                renderItem={(f) => (
                  <ResourceItem
                    id={String(f.id)}
                    onClick={() => {}}
                    shortcutActions={[{ content: 'Delete', onAction: () => remove(f.id) }]}
                  >
                    <BlockStack gap="100">
                      <Text as="h3" variant="bodyMd" fontWeight="semibold">{f.question}</Text>
                      <Text as="p" tone="subdued">{f.answer}</Text>
                    </BlockStack>
                  </ResourceItem>
                )}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
