'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../lib-client';

type Analytics = {
  total: number;
  resolved: number;
  deflectionRate: number;
  hoursSaved: number;
  breakdown: { orderStatus: number; faq: number; unresolved: number };
  trend: { day: string; count: number }[];
  topUnanswered: { question: string; count: number }[];
};

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e1e3e5', borderRadius: 12,
  padding: 24, maxWidth: 820, margin: '0 auto 16px',
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 13, color: '#616161', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: '#8a8a8a' }}>{sub}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/analytics');
        const d = await res.json().catch(() => ({}));
        if (!res.ok) setError(d.error ?? 'Failed to load analytics');
        else setData(d);
      } catch (e: any) {
        setError(e?.message ?? 'Could not reach server');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const maxTrend = data ? Math.max(1, ...data.trend.map((d) => d.count)) : 1;

  return (
    <main style={{ padding: 24 }}>
      <div style={{ maxWidth: 820, margin: '0 auto 12px' }}>
        <Link href="/" style={{ color: '#2c6ecb', fontSize: 14 }}>← Back</Link>
      </div>

      {loading ? (
        <div style={card}><p style={{ color: '#616161' }}>Loading…</p></div>
      ) : error ? (
        <div style={card}><p style={{ color: '#8a2c0d' }}>{error}</p></div>
      ) : data && (
        <>
          <div style={card}>
            <h2 style={{ marginTop: 0 }}>This month</h2>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <Stat label="Questions handled" value={String(data.total)} />
              <Stat label="Auto-answered" value={String(data.resolved)} sub={`${data.deflectionRate}% deflection`} />
              <Stat label="Est. hours saved" value={`${data.hoursSaved}h`} sub="~3 min per answer" />
            </div>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Last 14 days</h3>
            {data.trend.length === 0 ? (
              <p style={{ color: '#616161' }}>No activity yet.</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, justifyContent: 'flex-start' }}>
                {data.trend.map((d) => (
                  <div key={d.day} style={{ width: 34, textAlign: 'center', flexShrink: 0 }} title={`${d.day}: ${d.count}`}>
                    <div style={{ fontSize: 11, color: '#42474c', marginBottom: 4 }}>{d.count}</div>
                    <div
                      style={{
                        background: '#1a1a1a', borderRadius: 4, width: '100%',
                        height: `${Math.max(6, (d.count / maxTrend) * 90)}px`,
                      }}
                    />
                    <div style={{ fontSize: 10, color: '#8a8a8a', marginTop: 4 }}>
                      {d.day.slice(5)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Breakdown</h3>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <Stat label="Order status" value={String(data.breakdown.orderStatus)} />
              <Stat label="FAQ answered" value={String(data.breakdown.faq)} />
              <Stat label="Couldn't answer" value={String(data.breakdown.unresolved)} />
            </div>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Top unanswered questions</h3>
            <p style={{ color: '#616161', fontSize: 14, marginTop: 0 }}>
              Customers asked these but the assistant had no answer. Add them to your{' '}
              <Link href="/faqs" style={{ color: '#2c6ecb' }}>knowledge base</Link> to deflect them next time.
            </p>
            {data.topUnanswered.length === 0 ? (
              <p style={{ color: '#616161' }}>Nothing here — your knowledge base is covering everything. 🎉</p>
            ) : (
              data.topUnanswered.map((u, i) => (
                <div key={i} style={{
                  borderTop: '1px solid #f0f0f0', padding: '10px 0',
                  display: 'flex', justifyContent: 'space-between', gap: 12,
                }}>
                  <span>{u.question}</span>
                  <span style={{ color: '#8a8a8a', whiteSpace: 'nowrap' }}>{u.count}×</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </main>
  );
}
