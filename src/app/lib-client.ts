'use client';

// App Bridge injects a global `shopify` object. This helper attaches a fresh
// session token to every request to our own API routes.
declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

export async function apiFetch(input: string, init: RequestInit = {}) {
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
