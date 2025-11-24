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

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(logger());
app.use(
  '/*',
  cors({
    origin: (origin) => {
      // Allow localhost for development
      if (origin === 'http://localhost:3000' || origin === 'http://localhost:3002') return origin;

      // Allow production domains
      if (origin === 'https://zwierzogranie.pl' || origin === 'https://www.zwierzogranie.pl') return origin;

      // Allow all spottedx.workers.dev subdomains (preview & production)
      if (origin.endsWith('.spottedx.workers.dev')) return origin;

      return undefined;
    },
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
      delegatePhone2: z.string().regex(/^\+[1-9]\d{1,14}$/).optional().or(z.literal('')),
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
    const total = parsed.totalInstitutions > 0
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
          : 'onboarding@resend.dev';

        const recipientEmail = parsed.protocolEmailRecipient || 'kontakt@zwierzogranie.pl';

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
          console.error('Failed to send email via Resend:', res.status, errorText);
        } else {
          console.log('Email sent successfully via Resend');
        }
      } catch (emailError) {
        console.error('Error sending email via Resend:', emailError);
        // Don't fail the request if email fails
      }
    }

    return c.json({ ok: true, message: 'Zgłoszenie wysłane' }, 200);
  } catch (err: any) {
    console.error('Error processing adopsiak order:', err);
    const message = err?.message || 'Błąd serwera';
    return c.json({ error: message }, 500);
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
