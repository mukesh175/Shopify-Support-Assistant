'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Badge, Banner, Button,
  ResourceList, ResourceItem, EmptyState, SkeletonBodyText, Box, Modal,
  TextField, Divider,
} from '@shopify/polaris';
import { apiFetch } from '../lib-client';

type Thread = {
  id: number;
  customerEmail: string;
  subject: string;
  status: string;
  lastMessageAt: string;
};
type Message = {
  id: number;
  direction: string;
  body: string;
  sentAt: string | null;
  createdAt: string;
};

function fmt(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
      ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

export default function EmailsPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [forwardTo, setForwardTo] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [included, setIncluded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/emails');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? 'Could not load emails.');
      else {
        setThreads(d.threads ?? []);
        setForwardTo(d.forwardTo ?? null);
        setConfigured(!!d.configured);
        setIncluded(d.included !== false);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openThread(t: Thread) {
    setOpen(t);
    setMessages([]);
    setReply('');
    setLoadingThread(true);
    try {
      const res = await apiFetch(`/api/emails?threadId=${t.id}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? 'Could not open that conversation.');
      else {
        const msgs: Message[] = d.messages ?? [];
        setMessages(msgs);
        // An unsent outbound message is the AI's draft — load it for editing.
        const draft = [...msgs].reverse().find((m) => m.direction === 'outbound' && !m.sentAt);
        setReply(draft?.body ?? '');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not open that conversation.');
    } finally {
      setLoadingThread(false);
    }
  }

  async function send() {
    if (!open || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await apiFetch('/api/emails', {
        method: 'POST',
        body: JSON.stringify({ threadId: open.id, body: reply }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? 'Could not send.');
      else {
        setOpen(null);
        await load();
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not send.');
    } finally {
      setSending(false);
    }
  }

  const waiting = threads.filter((t) => t.status === 'open').length;

  return (
    <Page title="Emails" subtitle={waiting ? `${waiting} awaiting a reply` : undefined}>
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}><p>{error}</p></Banner>
          </Layout.Section>
        )}

        {!loading && configured && !included && (
          <Layout.Section>
            <Banner tone="info">
              <BlockStack gap="300">
                <Text as="p">
                  Answering support email in Zappy is part of the Pro plan.
                  Forward your inbox here and each message arrives with a reply
                  drafted from your knowledge base, ready to check and send.
                </Text>
                <InlineStack>
                  <Button url="/plans" variant="primary">See plans</Button>
                </InlineStack>
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        {!loading && !configured && (
          <Layout.Section>
            <Banner tone="warning">
              <p>
                The email channel is not configured yet. Add your email provider
                keys to the app&apos;s environment variables to start receiving
                customer emails here.
              </p>
            </Banner>
          </Layout.Section>
        )}

        {forwardTo && (
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingSm">Forward your support inbox here</Text>
                <Text as="p" tone="subdued">
                  Set up forwarding from your support address to this one. Emails
                  arrive here with a drafted reply for you to review.
                </Text>
                <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                  <Text as="p" fontWeight="semibold" breakWord>{forwardTo}</Text>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card padding="0">
            {loading ? (
              <Box padding="400"><SkeletonBodyText lines={6} /></Box>
            ) : threads.length === 0 ? (
              <EmptyState
                heading="No emails yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Once your support inbox forwards here, customer emails appear
                  with a drafted reply for you to check and send.
                </p>
              </EmptyState>
            ) : (
              <ResourceList
                resourceName={{ singular: 'conversation', plural: 'conversations' }}
                items={threads}
                renderItem={(t) => (
                  <ResourceItem id={String(t.id)} onClick={() => openThread(t)}>
                    <InlineStack align="space-between" blockAlign="center" gap="400" wrap>
                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Text as="h3" variant="bodyMd" fontWeight="semibold">{t.subject}</Text>
                          {t.status === 'open'
                            ? <Badge tone="attention">Needs a reply</Badge>
                            : <Badge tone="success">Replied</Badge>}
                        </InlineStack>
                        <Text as="p" tone="subdued" variant="bodySm">
                          {t.customerEmail} · {fmt(t.lastMessageAt)}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                  </ResourceItem>
                )}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>

      {open && (
        <Modal
          open
          onClose={() => setOpen(null)}
          title={open.subject}
          primaryAction={{
            content: 'Send reply',
            onAction: send,
            loading: sending,
            disabled: !reply.trim() || loadingThread,
          }}
          secondaryActions={[{ content: 'Close', onAction: () => setOpen(null) }]}
        >
          <Modal.Section>
            {loadingThread ? (
              <SkeletonBodyText lines={6} />
            ) : (
              <BlockStack gap="400">
                <Text as="p" tone="subdued" variant="bodySm">{open.customerEmail}</Text>

                <BlockStack gap="300">
                  {messages.filter((m) => m.direction === 'inbound' || m.sentAt).map((m) => (
                    <Box
                      key={m.id}
                      background={m.direction === 'inbound' ? 'bg-surface-secondary' : 'bg-surface-success'}
                      padding="300"
                      borderRadius="200"
                    >
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" fontWeight="semibold">
                          {m.direction === 'inbound' ? 'Customer' : 'You'} · {fmt(m.sentAt ?? m.createdAt)}
                        </Text>
                        <Text as="p" variant="bodySm" breakWord>{m.body}</Text>
                      </BlockStack>
                    </Box>
                  ))}
                </BlockStack>

                <Divider />

                <TextField
                  label="Your reply"
                  value={reply}
                  onChange={setReply}
                  multiline={7}
                  autoComplete="off"
                  helpText="Drafted from your knowledge base. Check anything in [square brackets] — the AI leaves those because it does not know your policies. Nothing sends until you press Send."
                />
              </BlockStack>
            )}
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
