
import z from 'zod';
import { adopsiakOrders } from '@my-better-t-app/db/schema/adopsiak';
import { publicProcedure } from '../index';

export const adopsiakRouter = {
    getAll: publicProcedure.handler(async ({ context }) => {
        return await context.db.select().from(adopsiakOrders);
    }),

    create: publicProcedure
        .input(
            z.object({
                cityOrMunicipality: z.string().min(1, 'City/Municipality is required'),
                shippingAddress: z.string().min(1, 'Shipping address is required'),
                delegateName: z.string().min(1, 'Delegate name is required'),
                delegatePhone1: z
                    .string()
                    .min(1, 'Phone number is required')
                    .regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone format (e.g., +48600700800)'),
                delegatePhone2: z
                    .string()
                    .regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone format')
                    .optional()
                    .or(z.literal('')),
                librariesCount: z.number().min(0).default(0),
                kindergartensCount: z.number().min(0).default(0),
                totalInstitutions: z.number().min(0).default(0),
                deliveryDate: z.string().optional(),
                protocolText: z.string().optional(),
                protocolEmailRecipient: z.string().email('Invalid email').optional().or(z.literal('')),
                email: z.string().email('Email is required'),
            })
        )
        .handler(async ({ input, context }) => {
            const createdAt = new Date().toISOString();

            // Calculate total if not provided or 0
            const total = input.totalInstitutions > 0
                ? input.totalInstitutions
                : input.librariesCount + input.kindergartensCount;

            return await context.db.insert(adopsiakOrders).values({
                cityOrMunicipality: input.cityOrMunicipality,
                shippingAddress: input.shippingAddress,
                delegateName: input.delegateName,
                delegatePhone1: input.delegatePhone1,
                delegatePhone2: input.delegatePhone2 || null,
                librariesCount: input.librariesCount,
                kindergartensCount: input.kindergartensCount,
                totalInstitutions: total,
                deliveryDate: input.deliveryDate || null,
                protocolText: input.protocolText || null,
                protocolEmailRecipient: input.protocolEmailRecipient || null,
                email: input.email,
                createdAt,
            });
        }),
};
