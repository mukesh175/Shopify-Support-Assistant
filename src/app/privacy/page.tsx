import Link from 'next/link';

export const metadata = { title: 'Zappy — Privacy Policy' };

const wrap: React.CSSProperties = {
  maxWidth: 760,
  margin: '0 auto',
  padding: '40px 24px 80px',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  color: '#1a1a1a',
  lineHeight: 1.7,
};
const h2: React.CSSProperties = { fontSize: 19, marginTop: 32, marginBottom: 8 };
const p: React.CSSProperties = { color: '#3a3d41', margin: '8px 0' };

export default function PrivacyPolicy() {
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Privacy Policy</h1>
      <p style={{ color: '#8a8d91', marginTop: 0 }}>
        Zappy · Last updated: {new Date().getFullYear()}
      </p>

      <p style={p}>
        Zappy (&quot;we&quot;, &quot;the app&quot;) is a Shopify app that adds an
        AI support assistant to a merchant&apos;s storefront. This policy explains
        what data the app accesses, why, and how it is handled. By installing
        Zappy, the merchant agrees to this policy.
      </p>

      <h2 style={h2}>Information we access</h2>
      <p style={p}>
        With the merchant&apos;s permission (granted at install), Zappy accesses:
      </p>
      <ul style={{ color: '#3a3d41' }}>
        <li>
          <b>Store &amp; order data</b> — order status, fulfillment, and tracking
          details, used only to answer a customer&apos;s own order-status request
          (matched by order number and email).
        </li>
        <li>
          <b>Product data</b> — product titles, prices, and images, used to
          generate product recommendations in the chat.
        </li>
        <li>
          <b>Customer questions</b> — the messages customers type into the chat
          widget are processed to generate a reply and are logged so the merchant
          can view what customers ask (used for the analytics dashboard).
        </li>
        <li>
          <b>Access token</b> — an offline access token provided by Shopify, so
          the app can look up orders and products. It is stored{' '}
          <b>encrypted at rest</b> (AES-256-GCM) and is never shared.
        </li>
      </ul>
      <p style={p}>
        Zappy does <b>not</b> collect payment/card details, and does not sell or
        rent any data to third parties.
      </p>

      <h2 style={h2}>AI processing</h2>
      <p style={p}>
        To generate answers and recommendations, customer questions and relevant
        store data (such as your saved FAQ answers or product titles) are sent to
        third-party AI providers (Google Gemini and/or Groq) via their APIs. These
        providers process the request to return a response. We send only what is
        needed to answer the question and do not send access tokens or payment
        data.
      </p>

      <h2 style={h2}>How we use the data</h2>
      <ul style={{ color: '#3a3d41' }}>
        <li>To answer customer questions and provide order status.</li>
        <li>To recommend products from the store&apos;s own catalog.</li>
        <li>
          To show the merchant analytics (questions handled, deflection rate,
          unanswered questions).
        </li>
      </ul>

      <h2 style={h2}>Data retention &amp; deletion</h2>
      <p style={p}>
        Chat logs are retained to power the merchant&apos;s analytics. When a
        merchant uninstalls the app, or when Shopify sends a data-deletion request
        on behalf of a shop or customer, the associated data is deleted. Zappy
        implements Shopify&apos;s mandatory privacy webhooks (
        <code>customers/data_request</code>, <code>customers/redact</code>,{' '}
        <code>shop/redact</code>) to honor these requests.
      </p>

      <h2 style={h2}>Data storage</h2>
      <p style={p}>
        Data is stored using Neon (PostgreSQL) and the app is hosted on Vercel.
        Access tokens are encrypted before storage.
      </p>

      <h2 style={h2}>Your rights</h2>
      <p style={p}>
        Merchants and their customers may request access to, or deletion of, their
        data. Deletion requests are handled automatically via Shopify&apos;s
        privacy webhooks, or can be made directly using the contact below.
      </p>

      <h2 style={h2}>Changes to this policy</h2>
      <p style={p}>
        We may update this policy as the app evolves. Material changes will be
        reflected on this page with an updated date.
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>
        For any privacy questions or data requests, contact us at{' '}
        <b>[your-email@example.com]</b>.
      </p>

      <p style={{ ...p, marginTop: 32, fontSize: 13, color: '#8a8d91' }}>
        This document is a general template describing Zappy&apos;s data
        practices and is not legal advice. Please review it against your own
        circumstances before publishing.
      </p>

      <p style={{ marginTop: 24 }}>
        <Link href="/" style={{ color: '#2c6ecb' }}>
          ← Back to Zappy
        </Link>
      </p>
    </main>
  );
}
