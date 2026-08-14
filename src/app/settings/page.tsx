'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../lib-client';

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e1e3e5', borderRadius: 12,
  padding: 24, maxWidth: 720, margin: '0 auto 16px',
};

export default function SettingsPage() {
  const [number, setNumber] = useState('');
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/settings');
        const d = await res.json().catch(() => ({}));
        if (!res.ok) setError(d.error ?? 'Failed to load settings');
        else {
          setNumber(d.whatsappNumber ?? '');
          setAllowed(!!d.whatsappHandoff);
        }
      } catch (e: any) {
        setError(e?.message ?? 'Could not reach server');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ whatsappNumber: number }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? 'Could not save');
      else {
        setNumber(d.whatsappNumber ?? '');
        setSaved(true);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not reach server');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ maxWidth: 720, margin: '0 auto 12px' }}>
        <Link href="/" style={{ color: '#2c6ecb', fontSize: 14 }}>← Back</Link>
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>WhatsApp handoff</h2>
        <p style={{ color: '#5c5f62', fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>
          When the assistant can&apos;t answer, customers can continue the
          conversation with you on WhatsApp. Enter the number with country code,
          digits only — e.g. <code>919876543210</code>. Leave blank to turn it off.
        </p>

        {loading ? (
          <p style={{ color: '#616161' }}>Loading…</p>
        ) : !allowed ? (
          <div style={{
            border: '1px solid #e1e3e5', borderRadius: 10, padding: 16,
            background: '#fafbfb',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Not included in your plan
            </div>
            <p style={{ color: '#5c5f62', fontSize: 14, margin: '0 0 12px' }}>
              WhatsApp handoff is available on the Starter and Pro plans.
            </p>
            <Link
              href="/plans"
              style={{
                display: 'inline-block', background: '#1a1a1a', color: '#fff',
                padding: '9px 18px', borderRadius: 8, textDecoration: 'none',
                fontWeight: 600, fontSize: 13.5,
              }}
            >
              See plans →
            </Link>
          </div>
        ) : (
          <>
            <input
              value={number}
              onChange={(e) => { setNumber(e.target.value); setSaved(false); }}
              placeholder="919876543210"
              inputMode="numeric"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                border: '1px solid #c9cccf', borderRadius: 8, fontSize: 14,
              }}
            />
            <button
              onClick={save}
              disabled={saving}
              style={{
                marginTop: 12, background: '#1a1a1a', color: '#fff',
                padding: '10px 20px', borderRadius: 8, border: 'none',
                fontWeight: 600, fontSize: 14,
                cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && (
              <span style={{ marginLeft: 12, color: '#1a7f37', fontSize: 14 }}>
                Saved
              </span>
            )}
          </>
        )}

        {error && (
          <p style={{ color: '#8a2c0d', fontSize: 14, marginBottom: 0 }}>{error}</p>
        )}
      </div>
    </main>
  );
}
