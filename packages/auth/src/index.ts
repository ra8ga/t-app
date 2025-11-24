import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { oidcProvider } from 'better-auth/plugins';
import type { DB } from '@my-better-t-app/db';
import * as schema from '@my-better-t-app/db/schema/auth';

export const createAuth = (
  db: DB,
  env: {
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    CORS_ORIGIN: string;
  },
) => {
  return betterAuth<BetterAuthOptions>({
    database: drizzleAdapter(db, {
      provider: 'sqlite',

      schema: schema,
    }),
    plugins: [
      oidcProvider({
        loginPage: '/sign-in',
      }),
    ],
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
    },
    // uncomment cookieCache setting when ready to deploy to Cloudflare using *.workers.dev domains
    // session: {
    //   cookieCache: {
    //     enabled: true,
    //     maxAge: 60,
    //   },
    // },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: 'none',
        secure: true,
        httpOnly: true,
      },
      // uncomment crossSubDomainCookies setting when ready to deploy and replace <your-workers-subdomain> with your actual workers subdomain
      // https://developers.cloudflare.com/workers/wrangler/configuration/#workersdev
      // crossSubDomainCookies: {
      //   enabled: true,
      //   domain: "<your-workers-subdomain>",
      // },
    },
  });
};

export type Auth = ReturnType<typeof createAuth>;
