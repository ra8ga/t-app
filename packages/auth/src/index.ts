import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { oidcProvider, emailOTP } from 'better-auth/plugins';
import type { DB } from '@my-better-t-app/db';
import * as schema from '@my-better-t-app/db/schema/auth';

export const createAuth = (
  db: DB,
  env: {
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    CORS_ORIGIN: string;
    RESEND_API_KEY: string;
    EMAIL_FROM_ADDRESS?: string;
    EMAIL_FROM_NAME?: string;
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
      emailOTP({
        overrideDefaultEmailVerification: true,
        async sendVerificationOTP({ email, otp, type }) {
          console.log(`[DEBUG] sendVerificationOTP called for ${email}`);
          console.log(`[DEBUG] RESEND_API_KEY present: ${!!env.RESEND_API_KEY}`);
          console.log(`Sending OTP to ${email}: ${otp} (type: ${type})`);

          if (!env.RESEND_API_KEY) {
            console.warn('[DEBUG] RESEND_API_KEY is missing, skipping email send');
            return;
          }

          try {
            console.log('[DEBUG] Attempting to fetch Resend API...');
            const sender = env.EMAIL_FROM_ADDRESS
              ? env.EMAIL_FROM_NAME
                ? `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`
                : env.EMAIL_FROM_ADDRESS
              : 'onboarding@resend.dev';
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: sender,
                to: email,
                subject: `Your Verification Code: ${otp}`,
                html: `<p>Your verification code is: <strong>${otp}</strong></p>`,
                text: `Your verification code is: ${otp}`,
              }),
            });

            if (!res.ok) {
              const errorText = await res.text();
              console.error('Failed to send email via Resend:', res.status, errorText);
            } else {
              let data: any = null;
              try {
                data = await res.json();
              } catch {}
              console.log('Email sent successfully via Resend', data?.id ? `id=${data.id}` : '');
            }
          } catch (error) {
            console.error('Error sending email via Resend:', error);
          }
        },
      }),
    ],
    trustedOrigins: [
      env.CORS_ORIGIN,
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ].filter(Boolean),
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
