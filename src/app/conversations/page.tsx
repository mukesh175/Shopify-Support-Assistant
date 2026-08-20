'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Badge, Banner, Button,
  IndexTable, useIndexResourceState, EmptyState, SkeletonBodyText, Filters,
  ChoiceList, Pagination, Box, Link, Modal, TextField, Spinner,
} from '@shopify/polaris';
import { apiFetch } from '../lib-client';

type Conversation = {
  id: number;
  question: string;
  answer: string | null;
  kind: string;
  resolved: boolean;
  handled: boolean;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  faq: 'Question',
  order_status: 'Order',
  recommend: 'Product',
};

function fmt(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
      ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

export default function ConversationsPage() {
  const [rows, setRows] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [total, setTotal] = useState(0);

  // Draft-answer console: opens on a question the assistant could not handle.
  const [draftFor, setDraftFor] = useState<Conversation | null>(null);
  const [draftText, setDraftText] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [status, setStatus] = useState<string[]>([]);
  const [kind, setKind] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (status[0]) params.set('status', status[0]);
      if (kind[0]) params.set('kind', kind[0]);
      if (query.trim()) params.set('q', query.trim());

      const res = await apiFetch(`/api/conversations?${params}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? 'Could not load conversations.');
      else {
        setRows(d.conversations ?? []);
        setHasNext(!!d.hasNext);
        setHasPrev(!!d.hasPrevious);
        setTotal(d.total ?? 0);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [page, status, kind, query]);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, query ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  // Any filter change invalidates the current page number.
  useEffect(() => { setPage(0); }, [status, kind, query]);

  async function openDraft(row: Conversation) {
    setDraftFor(row);
    setDraftText('');
    setDraftError(null);
    setDrafting(true);
    try {
      const res = await apiFetch('/api/conversations/draft', {
        method: 'POST',
        body: JSON.stringify({ question: row.question }),
      });
      const d = await res.json().catch(() => ({}));
      // A missing draft is not a dead end — the merchant can still type one.
      if (!res.ok) setDraftError(d.error ?? 'Could not draft an answer.');
      else setDraftText(d.draft ?? '');
    } catch (e: any) {
      setDraftError(e?.message ?? 'Could not draft an answer.');
    } finally {
      setDrafting(false);
    }
  }

  async function saveDraft() {
    if (!draftFor || !draftText.trim()) return;
    setSavingDraft(true);
    setDraftError(null);
    try {
      const res = await apiFetch('/api/conversations/draft', {
        method: 'PUT',
        body: JSON.stringify({
          logId: draftFor.id,
          question: draftFor.question,
          answer: draftText,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setDraftError(d.error ?? 'Could not save.');
      else {
        setDraftFor(null);
        await load();
      }
    } catch (e: any) {
      setDraftError(e?.message ?? 'Could not save.');
    } finally {
      setSavingDraft(false);
    }
  }

  const resourceName = { singular: 'conversation', plural: 'conversations' };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(rows.map((r) => ({ ...r, id: String(r.id) })));

  const filters = [
    {
      key: 'status',
      label: 'Status',
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={[
            { label: 'Needs an answer', value: 'todo' },
            { label: 'Answered', value: 'resolved' },
            { label: 'Not answered', value: 'unresolved' },
          ]}
          selected={status}
          onChange={setStatus}
        />
      ),
      shortcut: true,
    },
    {
      key: 'kind',
      label: 'Type',
      filter: (
        <ChoiceList
          title="Type"
          titleHidden
          choices={[
            { label: 'Question', value: 'faq' },
            { label: 'Order', value: 'order_status' },
            { label: 'Product', value: 'recommend' },
          ]}
          selected={kind}
          onChange={setKind}
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = [
    ...(status[0] ? [{
      key: 'status',
      label: status[0] === 'resolved' ? 'Answered'
        : status[0] === 'todo' ? 'Needs an answer' : 'Not answered',
      onRemove: () => setStatus([]),
    }] : []),
    ...(kind[0] ? [{
      key: 'kind',
      label: KIND_LABEL[kind[0]] ?? kind[0],
      onRemove: () => setKind([]),
    }] : []),
  ];

  const isFiltered = !!(status[0] || kind[0] || query.trim());

  return (
    <Page
      title="Conversations"
      subtitle={total ? `${total} customer ${total === 1 ? 'message' : 'messages'}` : undefined}
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
          <Card padding="0">
            <Box padding="300">
              <Filters
                queryValue={query}
                queryPlaceholder="Search questions and answers"
                filters={filters}
                appliedFilters={appliedFilters}
                onQueryChange={setQuery}
                onQueryClear={() => setQuery('')}
                onClearAll={() => { setStatus([]); setKind([]); setQuery(''); }}
              />
            </Box>

            {loading ? (
              <Box padding="400"><SkeletonBodyText lines={8} /></Box>
            ) : rows.length === 0 ? (
              <EmptyState
                heading={isFiltered ? 'No matching conversations' : 'No conversations yet'}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                action={isFiltered
                  ? { content: 'Clear filters', onAction: () => { setStatus([]); setKind([]); setQuery(''); } }
                  : undefined}
              >
                <p>
                  {isFiltered
                    ? 'Try a different search or filter.'
                    : 'Once shoppers start using the assistant on your storefront, their questions appear here.'}
                </p>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={rows.length}
                selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
                onSelectionChange={handleSelectionChange}
                selectable={false}
                headings={[
                  { title: 'Customer asked' },
                  { title: 'Assistant replied' },
                  { title: 'Type' },
                  { title: 'Status' },
                  { title: 'When' },
                  { title: '' },
                ]}
              >
                {rows.map((r, index) => (
                  <IndexTable.Row id={String(r.id)} key={r.id} position={index}>
                    <IndexTable.Cell>
                      <Box maxWidth="260px">
                        <Text as="span" fontWeight="semibold" breakWord>{r.question}</Text>
                      </Box>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Box maxWidth="320px">
                        <Text as="span" tone="subdued" breakWord>{r.answer ?? '—'}</Text>
                      </Box>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span">{KIND_LABEL[r.kind] ?? r.kind}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {r.resolved
                        ? <Badge tone="success">Answered</Badge>
                        : r.handled
                        ? <Badge tone="info">Added to KB</Badge>
                        : <Badge tone="attention">Needs an answer</Badge>}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" tone="subdued">{fmt(r.createdAt)}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {!r.resolved && !r.handled && (
                        <Button size="slim" onClick={() => openDraft(r)}>
                          Draft answer
                        </Button>
                      )}
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
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
            Questions marked <b>Not answered</b> are ones the assistant could not
            answer from your knowledge base. Adding them in{' '}
            <Link url="/faqs">Knowledge base</Link> means it can handle them next time.
          </Text>
        </Layout.Section>
      </Layout>

      {draftFor && (
        <Modal
          open
          onClose={() => setDraftFor(null)}
          title="Answer this question"
          primaryAction={{
            content: 'Save to knowledge base',
            onAction: saveDraft,
            loading: savingDraft,
            disabled: !draftText.trim() || drafting,
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setDraftFor(null) }]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              {draftError && (
                <Banner tone="warning"><p>{draftError}</p></Banner>
              )}

              <BlockStack gap="100">
                <Text as="h3" variant="headingSm">Customer asked</Text>
                <Text as="p" tone="subdued">{draftFor.question}</Text>
              </BlockStack>

              {drafting ? (
                <InlineStack gap="200" blockAlign="center">
                  <Spinner size="small" />
                  <Text as="p" tone="subdued">Drafting an answer…</Text>
                </InlineStack>
              ) : (
                <TextField
                  label="Answer"
                  value={draftText}
                  onChange={setDraftText}
                  multiline={6}
                  autoComplete="off"
                  helpText="Check anything in [square brackets] — the AI leaves those for you because it does not know your policies."
                />
              )}

              <Text as="p" tone="subdued" variant="bodySm">
                Saving adds this to your knowledge base, so the assistant answers
                it itself next time. It does not reply to the customer who asked.
              </Text>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
