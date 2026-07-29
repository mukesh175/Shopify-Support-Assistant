import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

// Visit https://your-app.vercel.app/api/health to isolate problems.
// Reports which env vars are present (booleans only, never values) and whether
// the Neon DB is reachable + whether the tables exist.
export async function GET() {
  const env = {
    SHOPIFY_API_KEY: !!process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: !!process.env.SHOPIFY_API_SECRET,
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL ?? null,
    DATABASE_URL: !!process.env.DATABASE_URL,
    TOKEN_ENC_KEY_valid:
      (process.env.TOKEN_ENC_KEY ?? '').length === 64, // 32 bytes hex
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    GROQ_API_KEY: !!process.env.GROQ_API_KEY,
  };

  let dbConnected = false;
  let tablesExist = false;
  let dbError: string | null = null;

  try {
    await db.execute(sql`SELECT 1`);
    dbConnected = true;
    // check the faqs table specifically
    await db.execute(sql`SELECT 1 FROM faqs LIMIT 1`);
    tablesExist = true;
  } catch (e: any) {
    dbError = e?.message ?? String(e);
    // "relation \"faqs\" does not exist" => connected but tables missing
    if (dbConnected && /does not exist/i.test(dbError ?? '')) {
      tablesExist = false;
    }
  }

  return NextResponse.json({
    ok: dbConnected && tablesExist && env.SHOPIFY_API_SECRET,
    env,
    dbConnected,
    tablesExist,
    dbError,
    hint: !dbConnected
      ? 'DB unreachable — check DATABASE_URL in Vercel env vars.'
      : !tablesExist
      ? 'DB connected but tables missing — run `npm run db:push` locally against the same DATABASE_URL.'
      : !env.SHOPIFY_API_SECRET
      ? 'SHOPIFY_API_SECRET missing in Vercel env vars.'
      : 'All core systems healthy.',
  });
}