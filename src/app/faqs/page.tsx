'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib-client';

type Faq = { id: number; question: string; answer: string; enabled: boolean };

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e1e3e5',
  borderRadius: 12,
  padding: 24,
  maxWidth: 720,
  margin: '0 auto 16px',
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #c9cccf',
  borderRadius: 8,
  marginBottom: 10,
  boxSizing: 'border-box',
  fontSize: 14,
};

export default function FaqsPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await apiFetch('/api/faqs');
    if (res.ok) setFaqs((await res.json()).faqs);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!q.trim() || !a.trim()) return;
    setSaving(true);
    const res = await apiFetch('/api/faqs', {
      method: 'POST',
      body: JSON.stringify({ question: q, answer: a }),
    });
    if (res.ok) {
      setQ('');
      setA('');
      await load();
    }
    setSaving(false);
  }

  async function remove(id: number) {
    await apiFetch(`/api/faqs?id=${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={card}>
        <h2 style={{ marginTop: 0 }}>Add a Q&amp;A</h2>
        <input
          style={input}
          placeholder="Question e.g. What is your return policy?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <textarea
          style={{ ...input, minHeight: 80, resize: 'vertical' }}
          placeholder="Answer e.g. Returns accepted within 30 days, unused, with receipt."
          value={a}
          onChange={(e) => setA(e.target.value)}
        />
        <button
          onClick={add}
          disabled={saving}
          style={{
            background: '#1a1a1a',
            color: '#fff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Add'}
        </button>
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0 }}>Your knowledge base</h2>
        {loading ? (
          <p style={{ color: '#616161' }}>Loading…</p>
        ) : faqs.length === 0 ? (
          <p style={{ color: '#616161' }}>No entries yet. Add your first above.</p>
        ) : (
          faqs.map((f) => (
            <div
              key={f.id}
              style={{
                borderTop: '1px solid #f0f0f0',
                padding: '12px 0',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{f.question}</div>
                <div style={{ color: '#616161', fontSize: 14 }}>{f.answer}</div>
              </div>
              <button
                onClick={() => remove(f.id)}
                style={{
                  background: 'none',
                  border: '1px solid #c9cccf',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  height: 'fit-content',
                }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
