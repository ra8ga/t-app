import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { RPCHandler } from '@orpc/server/fetch';
import { onError } from '@orpc/server';
import { createContext } from '@my-better-t-app/api/context';
import { appRouter } from '@my-better-t-app/api/routers/index';
import { createAuth } from '@my-better-t-app/auth';
import { createDb } from '@my-better-t-app/db';
import { adopsiakOrders } from '@my-better-t-app/db/schema/adopsiak';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import z from 'zod';

type Bindings = {
  DB: unknown;
  NODE_ENV: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM_ADDRESS?: string;
  EMAIL_FROM_NAME?: string;
  BETTER_AUTH_URL?: string;
  PAYLOAD_SECRET?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

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

// REST endpoint for adopsiak form submissions (used by zwierzogranie-pl)
app.post('/api/v1/adopsiak-orders', async (c) => {
  try {
    const payload = await c.req.json();

    const schema = z.object({
      cityOrMunicipality: z.string().min(1),
      shippingAddress: z.string().min(1),
      delegateName: z.string().min(1),
      delegatePhone1: z.string().regex(/^\+[1-9]\d{1,14}$/),
      delegatePhone2: z
        .string()
        .regex(/^\+[1-9]\d{1,14}$/)
        .optional()
        .or(z.literal('')),
      librariesCount: z.number().min(0).default(0),
      kindergartensCount: z.number().min(0).default(0),
      totalInstitutions: z.number().min(0).default(0),
      deliveryDate: z.string().optional(),
      protocolText: z.string().optional(),
      protocolEmailRecipient: z.string().email().optional().or(z.literal('')),
      email: z.string().email(),
    });

    const parsed = schema.parse(payload);
    const createdAt = new Date().toISOString();
    const total =
      parsed.totalInstitutions > 0
        ? parsed.totalInstitutions
        : parsed.librariesCount + parsed.kindergartensCount;

    const db = createDb(c.env.DB);

    // Save to database
    await db.insert(adopsiakOrders).values({
      cityOrMunicipality: parsed.cityOrMunicipality,
      shippingAddress: parsed.shippingAddress,
      delegateName: parsed.delegateName,
      delegatePhone1: parsed.delegatePhone1,
      delegatePhone2: parsed.delegatePhone2 || null,
      librariesCount: parsed.librariesCount,
      kindergartensCount: parsed.kindergartensCount,
      totalInstitutions: total,
      deliveryDate: parsed.deliveryDate || null,
      protocolText: parsed.protocolText || null,
      protocolEmailRecipient: parsed.protocolEmailRecipient || null,
      email: parsed.email,
      createdAt,
    });

    // Send email notification via Resend
    if (c.env.RESEND_API_KEY) {
      try {
        const emailContent = `
          <h2>Nowe zgłoszenie Adopsiak</h2>
          <p><strong>Email:</strong> ${parsed.email}</p>
          <p><strong>Gmina/Miasto:</strong> ${parsed.cityOrMunicipality}</p>
          <p><strong>Adres dostawy:</strong> ${parsed.shippingAddress}</p>
          <p><strong>Osoba delegowana:</strong> ${parsed.delegateName}</p>
          <p><strong>Telefon 1:</strong> ${parsed.delegatePhone1}</p>
          ${parsed.delegatePhone2 ? `<p><strong>Telefon 2:</strong> ${parsed.delegatePhone2}</p>` : ''}
          <p><strong>Liczba bibliotek:</strong> ${parsed.librariesCount}</p>
          <p><strong>Liczba przedszkoli:</strong> ${parsed.kindergartensCount}</p>
          <p><strong>Łączna liczba placówek:</strong> ${total}</p>
          ${parsed.deliveryDate ? `<p><strong>Preferowana data dostawy:</strong> ${parsed.deliveryDate}</p>` : ''}
          ${parsed.protocolText ? `<p><strong>Tekst protokołu:</strong> ${parsed.protocolText}</p>` : ''}
          ${parsed.protocolEmailRecipient ? `<p><strong>Email do protokołu:</strong> ${parsed.protocolEmailRecipient}</p>` : ''}
        `;

        const sender = c.env.EMAIL_FROM_ADDRESS
          ? c.env.EMAIL_FROM_NAME
            ? `${c.env.EMAIL_FROM_NAME} <${c.env.EMAIL_FROM_ADDRESS}>`
            : c.env.EMAIL_FROM_ADDRESS
          : 'no-reply@zwierzogranie.pl';

        const recipientEmail =
          parsed.protocolEmailRecipient || 'kontakt@zwierzogranie.pl';

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: sender,
            to: recipientEmail,
            subject: `Nowe zgłoszenie Adopsiak - ${parsed.cityOrMunicipality}`,
            html: emailContent,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error(
            'Failed to send email via Resend:',
            res.status,
            errorText,
          );
        } else {
          console.log('Email sent successfully via Resend');
        }
      } catch (emailError) {
        console.error('Error sending email via Resend:', emailError);
        // Don't fail the request if email fails
      }
    }

    return c.json({ ok: true, message: 'Zgłoszenie wysłane' }, 200);
  } catch (err) {
    console.error('Error processing adopsiak order:', err);
    const message = err instanceof Error ? err.message : 'Błąd serwera';
    return c.json({ error: message }, 500);
  }
});

const otpSchemaSend = z.object({ email: z.string().email() });
const otpSchemaCheck = z.object({
  email: z.string().email(),
  otp: z.string().min(4).max(10),
});

function generateOtp() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1000000).padStart(6, '0');
}

async function hash(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

app.post('/api/v1/email-otp/send', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = otpSchemaSend.parse(body);
    const email = parsed.email.trim().toLowerCase();

    await c.env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier)',
    ).run();

    const code = generateOtp();
    const identifier = `adopsiak:${email}`;
    const now = Date.now();
    const expires = now + 10 * 60 * 1000;
    const hashed = await hash(`${email}|${code}`);

    await c.env.DB.prepare('DELETE FROM verification WHERE identifier = ?')
      .bind(identifier)
      .run();
    await c.env.DB.prepare(
      'INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), identifier, hashed, expires, now, now)
      .run();

    if (c.env.RESEND_API_KEY) {
      const sender = c.env.EMAIL_FROM_ADDRESS
        ? c.env.EMAIL_FROM_NAME
          ? `${c.env.EMAIL_FROM_NAME} <${c.env.EMAIL_FROM_ADDRESS}>`
          : c.env.EMAIL_FROM_ADDRESS
        : 'no-reply@zwierzogranie.pl';
      c.executionCtx?.waitUntil(
        (async () => {
          try {
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: sender,
                to: email,
                subject: 'Kod weryfikacyjny',
                html: `<p>Twój kod weryfikacyjny: <strong>${code}</strong></p>`,
                text: `Twój kod weryfikacyjny: ${code}`,
              }),
            });
            if (!res.ok) {
              console.error(
                'Failed to send email via Resend:',
                await res.text(),
              );
            }
          } catch (err) {
            console.error('Resend error:', err);
          }
        })(),
      );
    }

    return c.json({ success: true }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd serwera';
    return c.json({ error: message }, 400);
  }
});

type OTPRow = { id: string; value: string; expires_at: number };

app.post('/api/v1/email-otp/check', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = otpSchemaCheck.parse(body);
    const email = parsed.email.trim().toLowerCase();
    const otp = parsed.otp.trim();
    const identifier = `adopsiak:${email}`;
    const hashedInput = await hash(`${email}|${otp}`);

    await c.env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier)',
    ).run();

    const row = (await c.env.DB.prepare(
      'SELECT id, value, expires_at FROM verification WHERE identifier = ? LIMIT 1',
    )
      .bind(identifier)
      .first()) as OTPRow | null;

    if (!row) return c.json({ error: 'Kod nieprawidłowy lub wygasł' }, 400);
    const now = Date.now();
    if (Number(row.expires_at) < now)
      return c.json({ error: 'Kod nieprawidłowy lub wygasł' }, 400);
    if (row.value !== hashedInput)
      return c.json({ error: 'Kod nieprawidłowy lub wygasł' }, 400);

    await c.env.DB.prepare('DELETE FROM verification WHERE id = ?')
      .bind(row.id)
      .run();
    return c.json({ success: true }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd serwera';
    return c.json({ error: message }, 400);
  }
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
