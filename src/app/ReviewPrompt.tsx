'use client';

import { useEffect, useState } from 'react';
import { Banner, BlockStack, InlineStack, Text, Button } from '@shopify/polaris';
import { apiFetch } from './lib-client';

// Ask only once the app has visibly done the job. A prompt on day one, before
// the assistant has answered anything, earns a bad review or an uninstall.
const MIN_RESOLVED = 10;
const DISMISS_KEY = 'zappy-review-prompt-dismissed';
const REVIEW_URL = 'https://apps.shopify.com/zappy#modal-show=WriteReviewModal';

export default function ReviewPrompt() {
  const [show, setShow] = useState(false);
  const [resolved, setResolved] = useState(0);

  useEffect(() => {
    // Dismissal lives in the browser: it is a nudge, not something worth a
    // column and a migration, and the worst case is one repeat prompt.
    try {
      if (window.localStorage.getItem(DISMISS_KEY)) return;
    } catch { /* private mode — just show it */ }

    (async () => {
      try {
        const res = await apiFetch('/api/analytics');
        if (!res.ok) return;
        const d = await res.json();
        if ((d?.resolved ?? 0) >= MIN_RESOLVED) {
          setResolved(d.resolved);
          setShow(true);
        }
      } catch { /* the prompt is never worth surfacing an error for */ }
    })();
  }, []);

  function dismiss() {
    try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setShow(false);
  }

  if (!show) return null;

  return (
    <Banner tone="success" onDismiss={dismiss}>
      <BlockStack gap="300">
        <Text as="p">
          Zappy has answered {resolved} customer questions for you without anyone
          stepping in. If it has been useful, a review helps other merchants find it.
        </Text>
        <InlineStack gap="200">
          <Button url={REVIEW_URL} target="_blank" variant="primary">
            Leave a review
          </Button>
          <Button onClick={dismiss} variant="tertiary">Not now</Button>
        </InlineStack>
      </BlockStack>
    </Banner>
  );
}
