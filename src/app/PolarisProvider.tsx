'use client';

import { AppProvider } from '@shopify/polaris';
import en from '@shopify/polaris/locales/en.json';

/**
 * Polaris needs a provider for translations and portal mounting, and it must
 * be a client component. Keeping it in its own file lets the root layout stay
 * a server component.
 */
export default function PolarisProvider({ children }: { children: React.ReactNode }) {
  return <AppProvider i18n={en}>{children}</AppProvider>;
}
