'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from './lib-client';

type PlanInfo = {
  plan: string;
  planName: string;
  price: string;
  monthlyQueryLimit: number | null;
  used: number;
  upgradeUrl: string;
};

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e1e3e5', borderRadius: 14,
  padding: 28, maxWidth: 760, margin: '0 auto 18px',
};

const upgradeBtn: React.CSSProperties = {
  display: 'inline-block', width: '100%', textAlign: 'center', boxSizing: 'border-box',
  background: '#1a1a1a', color: '#fff', padding: '9px 0', borderRadius: 8,
  textDecoration: 'none', fontWeight: 600, fontSize: 13.5, marginTop: 16,
};

const currentPlanBadge: React.CSSProperties = {
  display: 'inline-block', width: '100%', textAlign: 'center', boxSizing: 'border-box',
  border: '1px solid #e1e3e5', color: '#8a8d91', padding: '9px 0', borderRadius: 8,
  fontWeight: 600, fontSize: 13.5, marginTop: 16,
};

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ padding: '7px 0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ color: '#1a7f37', fontWeight: 700 }}>✓</span>
      <span>{children}</span>
    </li>
  );
}

function PlanCta({ planId, info }: { planId: 'free' | 'starter' | 'pro'; info: PlanInfo | null }) {
  if (!info) return null;
  if (info.plan === planId) {
    return <div style={currentPlanBadge}>Current plan</div>;
  }
  return (
    <a href={info.upgradeUrl} target="_top" style={upgradeBtn}>
      Upgrade →
    </a>
  );
}

export default function PlansSection() {
  const [info, setInfo] = useState<PlanInfo | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/plan');
        if (res.ok) setInfo(await res.json());
      } catch {
        /* ignore — plan cards still render without CTA */
      }
    })();
  }, []);

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Plans</h2>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, border: '1px solid #e1e3e5', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Free</div>
          <div style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 12px' }}>$0</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13.5, color: '#42474c' }}>
            <Feature>100 answers/mo</Feature>
            <Feature>Order tracking</Feature>
            <Feature>10 saved Q&amp;As</Feature>
            <Feature>5 recommendations/mo</Feature>
            <Feature>All languages</Feature>
          </ul>
          <div style={{ marginTop: 'auto' }}>
            <PlanCta planId="free" info={info} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200, border: '2px solid #1a1a1a', borderRadius: 12, padding: 18, position: 'relative', display: 'flex', flexDirection: 'column' }}>
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
          <div style={{ marginTop: 'auto' }}>
            <PlanCta planId="starter" info={info} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200, border: '1px solid #e1e3e5', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Pro</div>
          <div style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 12px' }}>$9.99<span style={{ fontSize: 12, fontWeight: 400, color: '#5c5f62' }}>/mo</span></div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13.5, color: '#42474c' }}>
            <Feature><b>Unlimited</b> answers</Feature>
            <Feature><b>Unlimited</b> recommendations</Feature>
            <Feature><b>Unlimited</b> Q&amp;As</Feature>
            <Feature>WhatsApp handoff</Feature>
            <Feature>Remove branding</Feature>
          </ul>
          <div style={{ marginTop: 'auto' }}>
            <PlanCta planId="pro" info={info} />
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: '#8a8d91', marginBottom: 0, marginTop: 14 }}>
        Billing is handled securely by Shopify.
      </p>
    </div>
  );
}
