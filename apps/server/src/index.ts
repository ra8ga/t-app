import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { RPCHandler } from '@orpc/server/fetch';
import { onError } from '@orpc/server';
import { createContext } from '@my-better-t-app/api/context';
import { appRouter } from '@my-better-t-app/api/routers/index';
import { createAuth } from '@my-better-t-app/auth';
import { createDb } from '@my-better-t-app/db';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(logger());
app.use(
  '/*',
  cors({
    origin: (origin) => origin, // Allow all origins in development
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

app.all('/api/auth/*', (c) => {
  const db = createDb(c.env.DB);
  const auth = createAuth(db, c.env);
  return auth.handler(c.req.raw);
});

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

app.use('/*', async (c, next) => {
  const context = await createContext({ context: c });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: '/rpc',
    context: context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: '/api-reference',
    context: context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  await next();
});

app.get('/', (c) => {
  return c.text('OK');
});

export default app;
