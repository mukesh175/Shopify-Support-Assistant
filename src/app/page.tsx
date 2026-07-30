import Link from 'next/link';
import PlanBanner from './PlanBanner';

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e1e3e5', borderRadius: 14,
  padding: 28, maxWidth: 760, margin: '0 auto 18px',
};

const btnDark: React.CSSProperties = {
  display: 'inline-block', background: '#1a1a1a', color: '#fff',
  padding: '11px 20px', borderRadius: 10, textDecoration: 'none', fontWeight: 600,
};
const btnGhost: React.CSSProperties = {
  display: 'inline-block', border: '1px solid #c9cccf', color: '#1a1a1a',
  padding: '11px 20px', borderRadius: 10, textDecoration: 'none', fontWeight: 600, marginLeft: 10,
};

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ padding: '7px 0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ color: '#1a7f37', fontWeight: 700 }}>✓</span>
      <span>{children}</span>
    </li>
  );
}

export default function Home() {
  return (
    <main style={{ padding: 28 }}>
      <PlanBanner />

      <div style={card}>
        <h1 style={{ margin: '0 0 6px', fontSize: 24 }}>Welcome 👋</h1>
        <p style={{ color: '#5c5f62', marginTop: 0, fontSize: 15, lineHeight: 1.6 }}>
          An AI assistant on your storefront that answers customer questions,
          tracks orders, and recommends products — in any language, with WhatsApp
          handoff. Fewer repetitive messages for you, faster help for customers.
        </p>

        <div style={{ margin: '18px 0' }}>
          <b style={{ fontSize: 14 }}>Get set up in 3 steps</b>
          <ol style={{ lineHeight: 1.9, paddingLeft: 20, marginTop: 8, color: '#42474c' }}>
            <li>Add your common answers in the <Link href="/faqs" style={{ color: '#2c6ecb' }}>Knowledge base</Link>.</li>
            <li>Enable the <b>Support Assistant</b> app embed (Online Store → Themes → Customize → App embeds).</li>
            <li>Done — the chat widget appears on your storefront.</li>
          </ol>
        </div>

        <Link href="/faqs" style={btnDark}>Manage knowledge base →</Link>
        <Link href="/analytics" style={btnGhost}>View analytics →</Link>
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Plans</h2>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, border: '1px solid #e1e3e5', borderRadius: 12, padding: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Free</div>
            <div style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 12px' }}>$0</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13.5, color: '#42474c' }}>
              <Feature>100 answers/mo</Feature>
              <Feature>Order tracking</Feature>
              <Feature>10 saved Q&amp;As</Feature>
              <Feature>5 recommendations/mo</Feature>
              <Feature>All languages</Feature>
            </ul>
          </div>
          <div style={{ flex: 1, minWidth: 200, border: '2px solid #1a1a1a', borderRadius: 12, padding: 18, position: 'relative' }}>
            <span style={{ position: 'absolute', top: -11, right: 14, background: '#1a1a1a', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>POPULAR</span>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Starter</div>
            <div style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 12px' }}>$5<span style={{ fontSize: 12, fontWeight: 400, color: '#5c5f62' }}>/mo</span></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13.5, color: '#42474c' }}>
              <Feature>500 answers/mo</Feature>
              <Feature><b>WhatsApp handoff</b></Feature>
              <Feature>50 saved Q&amp;As</Feature>
              <Feature>100 recommendations/mo</Feature>
              <Feature>All languages</Feature>
            </ul>
          </div>
          <div style={{ flex: 1, minWidth: 200, border: '1px solid #e1e3e5', borderRadius: 12, padding: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Pro</div>
            <div style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 12px' }}>$9.99<span style={{ fontSize: 12, fontWeight: 400, color: '#5c5f62' }}>/mo</span></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13.5, color: '#42474c' }}>
              <Feature><b>Unlimited</b> answers</Feature>
              <Feature><b>Unlimited</b> recommendations</Feature>
              <Feature><b>Unlimited</b> Q&amp;As</Feature>
              <Feature>WhatsApp handoff</Feature>
              <Feature>Remove branding</Feature>
            </ul>
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: '#8a8d91', marginBottom: 0, marginTop: 14 }}>
          Change your plan from the banner above. Billing is handled securely by Shopify.
        </p>
      </div>
    </main>
  );
}
