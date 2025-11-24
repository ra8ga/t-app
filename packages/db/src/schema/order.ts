import { integer, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';

export const orders = sqliteTable('orders', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(),
    name: text('name').notNull(),
    productId: integer('product_id').notNull(),
    quantity: integer('quantity').default(1).notNull(),
    status: text('status').default('pending').notNull(), // pending, confirmed, cancelled
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql => sql('CURRENT_TIMESTAMP')).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql => sql('CURRENT_TIMESTAMP')).notNull(),
});
