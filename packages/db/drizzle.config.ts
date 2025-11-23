import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config({
  path: '../../apps/server/.env',
});

const LOCAL_DB_PATH = String(process.env.LOCAL_DB_PATH || '');

export default defineConfig(
  LOCAL_DB_PATH
    ? {
        schema: './src/schema',
        out: './src/migrations',
        dialect: 'sqlite',
        dbCredentials: {
          url: LOCAL_DB_PATH,
        },
      }
    : {
        schema: './src/schema',
        out: './src/migrations',
        // DOCS: https://orm.drizzle.team/docs/guides/d1-http-with-drizzle-kit
        dialect: 'sqlite',
        driver: 'd1-http',
        dbCredentials: {
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
          databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
          token: process.env.CLOUDFLARE_D1_TOKEN!,
        },
      },
);
