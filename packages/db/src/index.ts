import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';

export const createDb = (d1: D1Database) => drizzle(d1);
export type DB = ReturnType<typeof createDb>;

