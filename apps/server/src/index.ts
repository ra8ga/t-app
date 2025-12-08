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
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import z from 'zod';
import { LOGO_LITEWKA_BASE64, LOGO_ZWIERZOGRANIE_BASE64, ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from './pdf-assets';

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

    // Rate limiting: Check last order from this email
    const lastOrder = await db
      .select()
      .from(adopsiakOrders)
      .where(eq(adopsiakOrders.email, parsed.email))
      .orderBy(desc(adopsiakOrders.createdAt))
      .limit(1)
      .get();

    if (lastOrder) {
      const lastOrderTime = new Date(lastOrder.createdAt).getTime();
      const nowTime = new Date().getTime();
      const fiveMinutes = 5 * 60 * 1000;

      if (nowTime - lastOrderTime < fiveMinutes) {
        return c.json(
          {
            error:
              'Proszę odczekać 5 minut przed wysłaniem kolejnego zgłoszenia.',
          },
          429,
        );
      }
    }

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

    // Generate PDF Protocol using pdf-lib
    const generateProtocolPdf = async (data: typeof parsed) => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      const page = pdfDoc.addPage([595, 842]); // A4 size in points
      const { width, height } = page.getSize();

      // Embed fonts
      const customFont = await pdfDoc.embedFont(ROBOTO_REGULAR_BASE64);
      const customFontBold = await pdfDoc.embedFont(ROBOTO_BOLD_BASE64);

      // Embed logos
      const logoLitewka = await pdfDoc.embedPng(LOGO_LITEWKA_BASE64);
      const logoZwierzogranie = await pdfDoc.embedPng(LOGO_ZWIERZOGRANIE_BASE64);

      // Draw logos with correct aspect ratios
      // Team Litewka: 257x150 px (ratio ~1.71:1)
      // Zwierzogranie: 154x150 px (ratio ~1.03:1)

      // Both logos on the left
      const logoY = height - 80;

      page.drawImage(logoLitewka, {
        x: 40,
        y: logoY,
        width: 85,
        height: 50,
      });

      // Zwierzogranie next to Litewka, scaled to match height (50px)
      // Original ratio 1.03 -> width = 50 * 1.03 = 51.5
      page.drawImage(logoZwierzogranie, {
        x: 140, // 40 + 85 + 15px gap
        y: logoY,
        width: 52,
        height: 50,
      });

      let yPos = height - 140;

      // Header with title
      page.drawText('Protokół odbioru', {
        x: width / 2 - 80,
        y: yPos,
        size: 24,
        font: customFontBold,
        color: rgb(0, 0, 0),
      });

      yPos -= 35;
      page.drawText('AdoPsiak Biszkopt', {
        x: width / 2 - 70,
        y: yPos,
        size: 18,
        font: customFontBold,
        color: rgb(0, 0, 0),
      });

      // Book info
      yPos -= 30;
      page.drawText('Katarzyna Bieńkowska', {
        x: width / 2 - 60,
        y: yPos,
        size: 12,
        font: customFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 20;
      page.drawText('Wydawnictwo: Team Litewka', {
        x: width / 2 - 75,
        y: yPos,
        size: 12,
        font: customFont,
        color: rgb(0, 0, 0),
      });

      // Removed genre and page count as requested

      // Order details
      yPos -= 60;
      const startX = 60;
      const lineHeight = 25;

      page.drawText('Dane zamówienia:', {
        x: startX,
        y: yPos,
        size: 14,
        font: customFontBold,
        color: rgb(0, 0, 0),
      });

      yPos -= 35;
      page.drawText(`Data: ${new Date().toLocaleDateString('pl-PL')}`, {
        x: startX,
        y: yPos,
        size: 12,
        font: customFont,
        color: rgb(0, 0, 0),
      });

      yPos -= lineHeight;
      page.drawText(`Miasto/Gmina: ${data.cityOrMunicipality}`, {
        x: startX,
        y: yPos,
        size: 12,
        font: customFont,
        color: rgb(0, 0, 0),
      });

      yPos -= lineHeight;
      page.drawText(`Adres dostawy: ${data.shippingAddress}`, {
        x: startX,
        y: yPos,
        size: 12,
        font: customFont,
        color: rgb(0, 0, 0),
      });

      yPos -= lineHeight;
      page.drawText(`Osoba zamawiająca: ${data.delegateName}`, {
        x: startX,
        y: yPos,
        size: 12,
        font: customFont,
        color: rgb(0, 0, 0),
      });

      yPos -= lineHeight;
      page.drawText(`Telefon: ${data.delegatePhone1}`, {
        x: startX,
        y: yPos,
        size: 12,
        font: customFont,
        color: rgb(0, 0, 0),
      });

      if (data.delegatePhone2) {
        yPos -= lineHeight;
        page.drawText(`Telefon 2: ${data.delegatePhone2}`, {
          x: startX,
          y: yPos,
          size: 12,
          font: customFont,
          color: rgb(0, 0, 0),
        });
      }

      yPos -= 40; // Extra gap before counts
      page.drawText(`Liczba bibliotek: ${data.librariesCount}`, {
        x: startX,
        y: yPos,
        size: 12,
        font: customFont,
        color: rgb(0, 0, 0),
      });

      yPos -= lineHeight;
      page.drawText(`Liczba przedszkoli: ${data.kindergartensCount}`, {
        x: startX,
        y: yPos,
        size: 12,
        font: customFont,
        color: rgb(0, 0, 0),
      });

      yPos -= lineHeight;
      page.drawText(`Łączna liczba placówek: ${total}`, {
        x: startX,
        y: yPos,
        size: 12,
        font: customFontBold, // Bold for total
        color: rgb(0, 0, 0),
      });

      if (data.protocolText) {
        yPos -= 40;
        page.drawText(`Uwagi: ${data.protocolText}`, {
          x: startX,
          y: yPos,
          size: 12,
          font: customFont,
          color: rgb(0, 0, 0),
          maxWidth: 480,
        });
      }

      // Signature area - moved down for more space
      const signatureY = 100; // Lowered from 150

      page.drawText('Podpis osoby odbierającej:', {
        x: startX,
        y: signatureY,
        size: 12,
        font: customFontBold,
        color: rgb(0, 0, 0),
      });

      // Line below signature - increased gap (approx 2 enters ~ 40-50pts)
      page.drawLine({
        start: { x: startX, y: signatureY - 50 },
        end: { x: 300, y: signatureY - 50 },
        thickness: 1,
        color: rgb(0, 0, 0),
      });

      const pdfBytes = await pdfDoc.save();
      return pdfBytes.buffer;
    };

    const pdfBuffer = await generateProtocolPdf(parsed);
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

    // Send email notification via Resend
    if (c.env.RESEND_API_KEY) {
      try {
        const emailContent = `
          <h2>Nowe zgłoszenie Adopsiak</h2>
          <p><strong>Email:</strong> ${parsed.email}</p>
          <p><strong>Gmina/Miasto:</strong> ${parsed.cityOrMunicipality}</p>
          <p><strong>Adres dostawy:</strong> ${parsed.shippingAddress}</p>
          <p><strong>Osoba zamawiająca:</strong> ${parsed.delegateName}</p>
          <p><strong>Telefon:</strong> ${parsed.delegatePhone1}</p>
          ${parsed.delegatePhone2 ? `<p><strong>Telefon 2:</strong> ${parsed.delegatePhone2}</p>` : ''}
          <p><strong>Liczba bibliotek:</strong> ${parsed.librariesCount}</p>
          <p><strong>Liczba przedszkoli:</strong> ${parsed.kindergartensCount}</p>
          <p><strong>Łączna liczba placówek:</strong> ${total}</p>
          ${parsed.deliveryDate ? `<p><strong>Preferowana data dostawy:</strong> ${parsed.deliveryDate}</p>` : ''}
          ${parsed.protocolText ? `<p><strong>Tekst protokołu:</strong> ${parsed.protocolText}</p>` : ''}
          ${parsed.protocolEmailRecipient ? `<p><strong>Email do protokołu:</strong> ${parsed.protocolEmailRecipient}</p>` : ''}
          <p>W załączniku znajduje się protokół odbioru.</p>
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
            bcc: 'kontakt@zwierzogranie.pl',
            subject: `Nowe zgłoszenie Adopsiak - ${parsed.cityOrMunicipality}`,
            html: emailContent,
            attachments: [
              {
                filename: 'protokol_odbioru.pdf',
                content: pdfBase64,
              },
            ],
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
                subject: 'Weryfikacja adresu email - Zwierzogranie',
                html: `
                  <div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
                    Potwierdź swój adres email, aby dokończyć zgłoszenie.
                  </div>
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Weryfikacja adresu email</h2>
                    <p>Aby dokończyć zgłoszenie w formularzu Adopsiak, wpisz poniższy kod weryfikacyjny:</p>
                    <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                      <strong style="font-size: 24px; letter-spacing: 4px;">${code}</strong>
                    </div>
                    <p style="color: #666; font-size: 14px;">Kod jest ważny przez 15 minut.</p>
                  </div>
                `,
                text: `Twój kod weryfikacyjny do formularza Adopsiak: ${code}`,
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
