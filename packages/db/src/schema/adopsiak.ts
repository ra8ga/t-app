import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const adopsiakOrders = sqliteTable('adopsiak_orders', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cityOrMunicipality: text('city_or_municipality').notNull(),
    shippingAddress: text('shipping_address').notNull(),
    delegateName: text('delegate_name').notNull(),
    delegatePhone1: text('delegate_phone1').notNull(),
    delegatePhone2: text('delegate_phone2'),
    librariesCount: integer('libraries_count').notNull().default(0),
    kindergartensCount: integer('kindergartens_count').notNull().default(0),
    totalInstitutions: integer('total_institutions').notNull().default(0),
    protocolText: text('protocol_text'),
    protocolEmailRecipient: text('protocol_email_recipient'),
    email: text('email').notNull(),
    createdAt: text('created_at').notNull(),
});
