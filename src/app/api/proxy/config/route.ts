import { NextRequest, NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/auth/appProxy';
import { getShopToken } from '@/lib/auth/session';
import { getActivePlan } from '@/lib/shopify/billing';

export const runtime = 'nodejs';

// The storefront widget calls this once on load (via App Proxy) to know how to
// render — currently whether to show the "Powered by" footer (hidden on Pro).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (!verifyAppProxySignature(url)) {
    // Fail open with branding shown (safe default) rather than breaking the widget.
    return NextResponse.json({ branding: true });
  }
  const shopDomain = url.searchParams.get('shop');
  if (!shopDomain) return NextResponse.json({ branding: true });

  try {
    const token = await getShopToken(shopDomain);
    if (!token) return NextResponse.json({ branding: true });
    const plan = await getActivePlan(shopDomain, token);
    return NextResponse.json({ branding: !plan.removeBranding });
  } catch {
    return NextResponse.json({ branding: true });
  }
}
