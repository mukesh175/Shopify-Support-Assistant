import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, ensureOfflineToken, errorResponse } from '@/lib/auth/session';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * Photos for one request, fetched only when the merchant opens it.
 *
 * Deliberately not part of the request list: these are data URLs, and sending
 * every image with every page of results would make the list heavy for no
 * benefit.
 */
export async function GET(req: NextRequest) {
  try {
    const { token, shopDomain } = await verifySessionToken(req);
    await ensureOfflineToken(token, shopDomain);

    const id = Number(new URL(req.url).searchParams.get('requestId'));
    if (!id) return NextResponse.json({ error: 'missing requestId' }, { status: 400 });

    // Scoped to the shop so one store cannot read another's photos.
    const rows = await db
      .select({ id: schema.requestPhotos.id, dataUrl: schema.requestPhotos.dataUrl })
      .from(schema.requestPhotos)
      .where(and(
        eq(schema.requestPhotos.requestId, id),
        eq(schema.requestPhotos.shopDomain, shopDomain)
      ));

    return NextResponse.json({ photos: rows });
  } catch (e) {
    const r = errorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}
