import Link from 'next/link';
import PlansSection from '../PlansSection';

export default function PlansPage() {
  return (
    <main style={{ padding: 24 }}>
      <div style={{ maxWidth: 760, margin: '0 auto 12px' }}>
        <Link href="/" style={{ color: '#2c6ecb', fontSize: 14 }}>← Back</Link>
      </div>

      <PlansSection />
    </main>
  );
}
