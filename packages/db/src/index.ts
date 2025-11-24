import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as authSchema from './schema/auth';
import * as adopsiakSchema from './schema/adopsiak';

const schema = { ...authSchema, ...adopsiakSchema };

export const createDb = (d1: D1Database) => drizzle(d1, { schema });
export type DB = ReturnType<typeof createDb>;
