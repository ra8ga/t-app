import { protectedProcedure, publicProcedure } from '../index';
import type { RouterClient } from '@orpc/server';
import { todoRouter } from './todo';
import { adopsiakRouter } from './adopsiak';

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return 'OK';
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: 'This is private',
      user: context.session?.user,
    };
  }),
  todo: todoRouter,
  adopsiak: adopsiakRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
