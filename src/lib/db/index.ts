import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

// neon-http is the right driver for Vercel serverless / edge: it uses HTTP,
// so there's no connection pool to exhaust across cold starts. Use the POOLED
// connection string from Neon.
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
export { schema };
