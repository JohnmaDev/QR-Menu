import {
  pgTable,
  serial,
  bigserial,
  uuid,
  varchar,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  pgEnum,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import {
  UserRole,
  FulfillmentStatus,
  PaymentStatus,
  PaymentMethodDeclared,
} from '@qr-menu/shared';

// ==============================================================================
// POSTGRESQL ENUMS
// ==============================================================================

export const userRoleEnum = pgEnum('user_role', [
  UserRole.ADMIN,
  UserRole.CASHIER,
  UserRole.KITCHEN,
]);

export const fulfillmentStatusEnum = pgEnum('fulfillment_status', [
  FulfillmentStatus.PENDING,
  FulfillmentStatus.PREPARING,
  FulfillmentStatus.DELIVERED,
  FulfillmentStatus.CANCELLED,
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  PaymentStatus.UNPAID,
  PaymentStatus.PAID,
]);

export const paymentMethodEnum = pgEnum('payment_method_declared', [
  PaymentMethodDeclared.CASH,
  PaymentMethodDeclared.BRE_B,
  PaymentMethodDeclared.NEQUI,
  PaymentMethodDeclared.BANCOLOMBIA,
]);

// ==============================================================================
// 1. USERS TABLE
// ==============================================================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default(UserRole.CASHIER),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ==============================================================================
// 2. TABLES TABLE
// ==============================================================================

export const tables = pgTable(
  'tables',
  {
    id: serial('id').primaryKey(),
    number: integer('number').notNull().unique(),
    name: varchar('name', { length: 50 }).notNull(),
    publicToken: varchar('public_token', { length: 32 }).notNull().unique(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: index('idx_tables_token').on(table.publicToken),
  })
);

// ==============================================================================
// 3. CATEGORIES TABLE
// ==============================================================================

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  icon: varchar('icon', { length: 30 }),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ==============================================================================
// 4. PRODUCTS TABLE
// ==============================================================================

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 255 }),
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    imageUrl: varchar('image_url', { length: 500 }),
    isAvailable: boolean('is_available').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    categoryIdx: index('idx_products_category').on(table.categoryId, table.isAvailable),
    priceCheck: check('chk_products_price_positive', sql`${table.price} >= 0`),
  })
);

// ==============================================================================
// 5. ORDERS TABLE (CABECERA)
// ==============================================================================

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNumber: serial('order_number').notNull(),
    publicCode: varchar('public_code', { length: 10 }).notNull().unique(),
    tableId: integer('table_id')
      .notNull()
      .references(() => tables.id, { onDelete: 'restrict' }),
    fulfillmentStatus: fulfillmentStatusEnum('fulfillment_status')
      .notNull()
      .default(FulfillmentStatus.PENDING),
    paymentStatus: paymentStatusEnum('payment_status')
      .notNull()
      .default(PaymentStatus.UNPAID),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 64 }).notNull().unique(),
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    customerName: varchar('customer_name', { length: 50 }),
    notes: varchar('notes', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pollingIdx: index('idx_orders_status_polling').on(
      table.createdAt,
      table.fulfillmentStatus,
      table.paymentStatus
    ),
    tableIdx: index('idx_orders_table').on(table.tableId, table.fulfillmentStatus),
    idempotencyIdx: index('idx_orders_idempotency').on(table.idempotencyKey),
    totalCheck: check('chk_orders_total_non_negative', sql`${table.totalAmount} >= 0`),
  })
);

// ==============================================================================
// 6. ORDER ITEMS TABLE (SNAPSHOT HISTÓRICO INMUTABLE)
// ==============================================================================

export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    productNameSnapshot: varchar('product_name_snapshot', { length: 100 }).notNull(),
    unitPriceSnapshot: numeric('unit_price_snapshot', { precision: 12, scale: 2 }).notNull(),
    quantity: integer('quantity').notNull(),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  },
  (table) => ({
    orderIdx: index('idx_order_items_order').on(table.orderId),
    quantityCheck: check('chk_order_items_quantity_range', sql`${table.quantity} > 0 AND ${table.quantity} <= 50`),
    subtotalCheck: check('chk_order_items_subtotal_non_negative', sql`${table.subtotal} >= 0`),
    unitPriceCheck: check('chk_order_items_unit_price_non_negative', sql`${table.unitPriceSnapshot} >= 0`),
  })
);

// ==============================================================================
// 7. AUDIT LOGS TABLE
// ==============================================================================

export const auditLogs = pgTable('audit_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 50 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 50 }).notNull(),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ==============================================================================
// 8. SESSIONS TABLE
// ==============================================================================

export const sessions = pgTable(
  'sessions',
  {
    tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    userAgent: varchar('user_agent', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 45 }),
  },
  (table) => ({
    userIdx: index('idx_sessions_user_id').on(table.userId),
    expiresIdx: index('idx_sessions_expires_at').on(table.expiresAt),
  })
);

// ==============================================================================
// DRIZZLE RELATIONS
// ==============================================================================

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
}));

export const tablesRelations = relations(tables, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  table: one(tables, {
    fields: [orders.tableId],
    references: [tables.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  auditLogs: many(auditLogs),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

