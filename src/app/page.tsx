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
            <li>Enable the <b>Zappy</b> app embed (Online Store → Themes → Customize → App embeds).</li>
            <li>Done — the chat widget appears on your storefront.</li>
          </ol>
        </div>

        <Link href="/faqs" style={btnDark}>Manage knowledge base →</Link>
        <Link href="/analytics" style={btnGhost}>View analytics →</Link>
        <Link href="/plans" style={btnGhost}>View plans →</Link>
      </div>
    </main>
  );
}
