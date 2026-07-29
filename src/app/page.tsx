import Link from 'next/link';
import PlanBanner from './PlanBanner';

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e1e3e5',
  borderRadius: 12,
  padding: 24,
  maxWidth: 720,
  margin: '0 auto',
};

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <PlanBanner />
      <div style={card}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Support Assistant</h1>
        <p style={{ color: '#616161', marginTop: 0 }}>
          An AI widget that answers customer questions and looks up order status
          on your storefront — so fewer &quot;where is my order?&quot; emails reach you.
        </p>

        <ol style={{ lineHeight: 1.9, paddingLeft: 20 }}>
          <li>
            Add your common answers in{' '}
            <Link href="/faqs" style={{ color: '#2c6ecb' }}>
              Knowledge base
            </Link>
            .
          </li>
          <li>
            Enable the <b>Support Assistant</b> app embed in your theme
            (Online Store → Themes → Customize → App embeds).
          </li>
          <li>Done. The widget appears on your storefront.</li>
        </ol>

        <Link
          href="/faqs"
          style={{
            display: 'inline-block',
            marginTop: 8,
            background: '#1a1a1a',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Manage knowledge base →
        </Link>
      </div>
    </main>
  );
}
