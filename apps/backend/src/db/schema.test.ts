import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getTableColumns } from 'drizzle-orm';
import {
  users,
  tables,
  categories,
  products,
  orders,
  orderItems,
  auditLogs,
  sessions,
  userRoleEnum,
  fulfillmentStatusEnum,
  paymentStatusEnum,
  paymentMethodEnum,
} from './schema.js';
import {
  UserRole,
  FulfillmentStatus,
  PaymentStatus,
  PaymentMethodDeclared,
} from '@qr-menu/shared';

describe('FASE 1: Database Schema Integrity & Migration Tests', () => {
  it('enum values match domain definitions in @qr-menu/shared', () => {
    expect(userRoleEnum.enumValues).toEqual([
      UserRole.ADMIN,
      UserRole.CASHIER,
      UserRole.KITCHEN,
    ]);
    expect(fulfillmentStatusEnum.enumValues).toEqual([
      FulfillmentStatus.PENDING,
      FulfillmentStatus.PREPARING,
      FulfillmentStatus.DELIVERED,
      FulfillmentStatus.CANCELLED,
    ]);
    expect(paymentStatusEnum.enumValues).toEqual([
      PaymentStatus.UNPAID,
      PaymentStatus.PAID,
    ]);
    expect(paymentMethodEnum.enumValues).toEqual([
      PaymentMethodDeclared.CASH,
      PaymentMethodDeclared.BRE_B,
      PaymentMethodDeclared.NEQUI,
      PaymentMethodDeclared.BANCOLOMBIA,
    ]);
  });

  it('users table has all required columns and constraints', () => {
    const cols = getTableColumns(users);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('username');
    expect(cols).toHaveProperty('passwordHash');
    expect(cols).toHaveProperty('role');
    expect(cols).toHaveProperty('isActive');
    expect(cols).toHaveProperty('createdAt');

    expect(cols.username.isUnique).toBe(true);
    expect(cols.passwordHash.notNull).toBe(true);
  });

  it('categories table has required columns and constraints', () => {
    const cols = getTableColumns(categories);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('name');
    expect(cols).toHaveProperty('icon');
    expect(cols).toHaveProperty('sortOrder');
    expect(cols).toHaveProperty('isActive');
    expect(cols).toHaveProperty('createdAt');
  });

  it('tables table has unique number and non-enumerable public_token', () => {
    const cols = getTableColumns(tables);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('number');
    expect(cols).toHaveProperty('name');
    expect(cols).toHaveProperty('publicToken');
    expect(cols).toHaveProperty('isActive');

    expect(cols.number.isUnique).toBe(true);
    expect(cols.publicToken.isUnique).toBe(true);
  });

  it('products table enforces numeric price and restrictive category relation', () => {
    const cols = getTableColumns(products);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('categoryId');
    expect(cols).toHaveProperty('name');
    expect(cols).toHaveProperty('price');
    expect(cols).toHaveProperty('isAvailable');

    expect(cols.price.dataType).toBe('string'); // Drizzle numeric is represented as string in JS for precision
    expect(cols.isAvailable.notNull).toBe(true);
  });

  it('orders table decouples fulfillment_status from payment_status', () => {
    const cols = getTableColumns(orders);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('orderNumber');
    expect(cols).toHaveProperty('publicCode');
    expect(cols).toHaveProperty('tableId');
    expect(cols).toHaveProperty('fulfillmentStatus');
    expect(cols).toHaveProperty('paymentStatus');
    expect(cols).toHaveProperty('paymentMethod');
    expect(cols).toHaveProperty('idempotencyKey');
    expect(cols).toHaveProperty('requestHash');
    expect(cols).toHaveProperty('totalAmount');
    expect(cols).toHaveProperty('customerName');

    expect(cols.publicCode.isUnique).toBe(true);
    expect(cols.idempotencyKey.isUnique).toBe(true);
  });

  it('order_items table includes immutable historical snapshots', () => {
    const cols = getTableColumns(orderItems);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('orderId');
    expect(cols).toHaveProperty('productId');
    expect(cols).toHaveProperty('productNameSnapshot');
    expect(cols).toHaveProperty('unitPriceSnapshot');
    expect(cols).toHaveProperty('quantity');
    expect(cols).toHaveProperty('subtotal');

    expect(cols.productNameSnapshot.notNull).toBe(true);
    expect(cols.unitPriceSnapshot.notNull).toBe(true);
  });

  it('audit_logs table exists and tracks user actions', () => {
    const cols = getTableColumns(auditLogs);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('userId');
    expect(cols).toHaveProperty('action');
    expect(cols).toHaveProperty('entityType');
    expect(cols).toHaveProperty('entityId');
    expect(cols).toHaveProperty('metadata');
    expect(cols).toHaveProperty('ipAddress');
    expect(cols).toHaveProperty('createdAt');
  });

  it('sessions table has all required columns and constraints', () => {
    const cols = getTableColumns(sessions);
    expect(cols).toHaveProperty('tokenHash');
    expect(cols).toHaveProperty('userId');
    expect(cols).toHaveProperty('expiresAt');
    expect(cols).toHaveProperty('createdAt');
    expect(cols).toHaveProperty('userAgent');
    expect(cols).toHaveProperty('ipAddress');

    expect(cols.tokenHash.notNull).toBe(true);
    expect(cols.userId.notNull).toBe(true);
    expect(cols.expiresAt.notNull).toBe(true);
  });

  it('generated SQL migration file exists and contains valid DDL', () => {
    const migrationsDir = path.resolve(__dirname, 'migrations');
    expect(fs.existsSync(migrationsDir)).toBe(true);

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThanOrEqual(1);

    const sqlContent = fs.readFileSync(path.join(migrationsDir, files[0]), 'utf-8');
    expect(sqlContent).toContain('CREATE TABLE "orders"');
    expect(sqlContent).toContain('CREATE TABLE "order_items"');
    expect(sqlContent).toContain('CREATE TABLE "products"');
    expect(sqlContent).toContain('CREATE TABLE "categories"');
    expect(sqlContent).toContain('CREATE TABLE "tables"');
    expect(sqlContent).toContain('CREATE TABLE "users"');
    expect(sqlContent).toContain('CREATE TABLE "audit_logs"');

    // Verify critical indexes and constraints
    expect(sqlContent).toContain('idx_orders_status_polling');
    expect(sqlContent).toContain('idx_orders_idempotency');
    expect(sqlContent).toContain('idx_tables_token');
    expect(sqlContent).toContain('chk_order_items_quantity_range');
    expect(sqlContent).toContain('chk_products_price_positive');
  });
});
