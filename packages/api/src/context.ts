import type { Context as HonoContext } from 'hono';
import { createAuth } from '@my-better-t-app/auth';
import { createDb } from '@my-better-t-app/db';

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  const db = createDb(context.env.DB);
  const auth = createAuth(db, context.env);

  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });

  return {
    session,
    db,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
