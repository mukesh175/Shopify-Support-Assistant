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

export default function PlanBanner() {
  const [info, setInfo] = useState<PlanInfo | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/plan');
        if (res.ok) setInfo(await res.json());
      } catch {
        /* ignore — banner is non-critical */
      }
    })();
  }, []);

  if (!info) return null;

  const isFree = info.plan === 'free';
  const usageText =
    info.monthlyQueryLimit === null
      ? `${info.used} answers this month · unlimited`
      : `${info.used} / ${info.monthlyQueryLimit} answers used this month`;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e1e3e5',
        borderRadius: 12,
        padding: 16,
        maxWidth: 720,
        margin: '0 auto 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ fontWeight: 600 }}>
          {info.planName} plan{' '}
          <span style={{ color: '#616161', fontWeight: 400 }}>· {info.price}</span>
        </div>
        <div style={{ color: '#616161', fontSize: 13 }}>{usageText}</div>
      </div>
      {isFree && (
        <a
          href={info.upgradeUrl}
          target="_top"
          style={{
            background: '#1a1a1a',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Upgrade to Pro →
        </a>
      )}
    </div>
  );
}
