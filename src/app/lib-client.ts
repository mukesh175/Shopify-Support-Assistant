'use client';

// App Bridge injects a global `shopify` object WHEN the app is loaded inside the
// Shopify admin iframe. This helper waits briefly for it, then attaches a fresh
// session token to each request to our own API routes.
declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

// Wait up to ~5s for App Bridge to initialize (it loads beforeInteractive, but
// there can be a small race on first paint).
async function waitForAppBridge(timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (typeof window !== 'undefined' && window.shopify?.idToken) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    'App Bridge not found. Open this app from your Shopify admin (Apps → Zappy), not directly by URL.'
  );
}

export async function apiFetch(input: string, init: RequestInit = {}) {
  await waitForAppBridge();
  const token = await window.shopify!.idToken();
  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}
