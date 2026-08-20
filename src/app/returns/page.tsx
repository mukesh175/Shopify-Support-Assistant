'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Badge, Banner, Button,
  ResourceList, ResourceItem, EmptyState, SkeletonBodyText, Tabs, Box,
  Pagination, ButtonGroup,
} from '@shopify/polaris';
import { apiFetch } from '../lib-client';

type ReturnItem = { lineItemId: string; title: string; variantTitle: string | null; quantity: number };
type ReturnRequest = {
  id: number;
  orderName: string;
  email: string;
  items: ReturnItem[];
  reason: string;
  note: string | null;
  status: string;
  createdAt: string;
};

const TABS = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'declined', label: 'Declined' },
  { id: 'completed', label: 'Completed' },
];

const STATUS_TONE: Record<string, 'attention' | 'success' | 'critical' | 'info'> = {
  pending: 'attention',
  approved: 'info',
  declined: 'critical',
  completed: 'success',
};

function fmt(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
      ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

export default function ReturnsPage() {
  const [rows, setRows] = useState<ReturnRequest[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (TABS[tab].id) params.set('status', TABS[tab].id);
      const res = await apiFetch(`/api/returns?${params}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? 'Could not load return requests.');
      else {
        setRows(d.returns ?? []);
        setCounts(d.counts ?? {});
        setHasNext(!!d.hasNext);
        setHasPrev(!!d.hasPrevious);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [page, tab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [tab]);

  async function setStatus(id: number, status: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await apiFetch('/api/returns', {
        method: 'PATCH',
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Could not update that request.');
      } else {
        await load();
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not update that request.');
    } finally {
      setBusyId(null);
    }
  }

  const pending = counts.pending ?? 0;

  return (
    <Page
      title="Returns"
      subtitle={pending ? `${pending} awaiting your decision` : undefined}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}><p>{error}</p></Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card padding="0">
            <Tabs
              tabs={TABS.map((t) => ({
                id: t.id || 'all',
                content: t.id && counts[t.id] ? `${t.label} (${counts[t.id]})` : t.label,
              }))}
              selected={tab}
              onSelect={setTab}
            />

            {loading ? (
              <Box padding="400"><SkeletonBodyText lines={6} /></Box>
            ) : rows.length === 0 ? (
              <EmptyState
                heading="No return requests"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  When a shopper asks to return something through the assistant,
                  the request appears here for you to review.
                </p>
              </EmptyState>
            ) : (
              <ResourceList
                resourceName={{ singular: 'return request', plural: 'return requests' }}
                items={rows}
                idForItem={(r) => String(r.id)}
                renderItem={(r) => (
                  <ResourceItem id={String(r.id)} onClick={() => {}}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="start" gap="400" wrap>
                        <BlockStack gap="100">
                          <InlineStack gap="200" blockAlign="center">
                            <Text as="h3" variant="bodyMd" fontWeight="semibold">{r.orderName}</Text>
                            <Badge tone={STATUS_TONE[r.status] ?? 'attention'}>
                              {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                            </Badge>
                          </InlineStack>
                          <Text as="p" tone="subdued" variant="bodySm">
                            {r.email} · {fmt(r.createdAt)}
                          </Text>
                        </BlockStack>

                        {r.status === 'pending' ? (
                          <ButtonGroup>
                            <Button
                              size="slim"
                              loading={busyId === r.id}
                              onClick={() => setStatus(r.id, 'declined')}
                            >
                              Decline
                            </Button>
                            <Button
                              size="slim"
                              variant="primary"
                              loading={busyId === r.id}
                              onClick={() => setStatus(r.id, 'approved')}
                            >
                              Approve
                            </Button>
                          </ButtonGroup>
                        ) : r.status === 'approved' ? (
                          <Button
                            size="slim"
                            loading={busyId === r.id}
                            onClick={() => setStatus(r.id, 'completed')}
                          >
                            Mark completed
                          </Button>
                        ) : null}
                      </InlineStack>

                      <BlockStack gap="100">
                        {r.items.map((it) => (
                          <Text as="p" variant="bodySm" key={it.lineItemId}>
                            {it.quantity}× {it.title}
                            {it.variantTitle ? ` — ${it.variantTitle}` : ''}
                          </Text>
                        ))}
                      </BlockStack>

                      <Text as="p" variant="bodySm" tone="subdued">
                        Reason: {r.reason}{r.note ? ` — “${r.note}”` : ''}
                      </Text>
                    </BlockStack>
                  </ResourceItem>
                )}
              />
            )}

            {(hasNext || hasPrev) && (
              <Box padding="300" borderBlockStartWidth="025" borderColor="border">
                <InlineStack align="center">
                  <Pagination
                    hasPrevious={hasPrev}
                    onPrevious={() => setPage((p) => Math.max(0, p - 1))}
                    hasNext={hasNext}
                    onNext={() => setPage((p) => p + 1)}
                  />
                </InlineStack>
              </Box>
            )}
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Text as="p" tone="subdued" variant="bodySm">
            Approving here records your decision — it does not create the return
            in Shopify or refund anything. Process the return in your Shopify
            admin as usual, then mark it completed.
          </Text>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
