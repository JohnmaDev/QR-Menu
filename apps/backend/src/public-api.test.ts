import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from './app.js';
import { createTestDb } from './test/test-db.js';
import { tables, categories, products, orders, orderItems } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { FastifyInstance } from 'fastify';

describe('FASE 2: Public API & Order Domain Comprehensive Tests', () => {
  let app: FastifyInstance;
  let testDb: Awaited<ReturnType<typeof createTestDb>>['db'];
  let client: Awaited<ReturnType<typeof createTestDb>>['client'];

  beforeEach(async () => {
    const testSetup = await createTestDb();
    testDb = testSetup.db;
    client = testSetup.client;

    app = buildApp({ logger: false, db: testDb });

    // Seed datos de prueba
    await testDb.insert(tables).values([
      { id: 1, number: 1, name: 'Mesa 1', publicToken: 't_m1_valid123', isActive: true },
      { id: 2, number: 2, name: 'Mesa 2', publicToken: 't_m2_inactive', isActive: false },
    ]);

    await testDb.insert(categories).values([
      { id: 1, name: 'Cervezas', icon: 'beer', sortOrder: 1, isActive: true },
      { id: 2, name: 'Snacks', icon: 'popcorn', sortOrder: 2, isActive: true },
      { id: 3, name: 'Inactiva', icon: 'lock', sortOrder: 3, isActive: false },
    ]);

    await testDb.insert(products).values([
      { id: 1, categoryId: 1, name: 'Pilsen 330ml', price: '5000.00', isAvailable: true, sortOrder: 1 },
      { id: 2, categoryId: 1, name: 'Águila 330ml', price: '5000.00', isAvailable: true, sortOrder: 2 },
      { id: 3, categoryId: 1, name: 'Club Colombia', price: '6000.00', isAvailable: false, sortOrder: 3 }, // Agotada
      { id: 4, categoryId: 2, name: 'Papas Lays', price: '3500.00', isAvailable: true, sortOrder: 1 },
    ]);
  });

  afterEach(async () => {
    await app.close();
    await client.close();
  });

  // ============================================================================
  // 1. TESTS DE GET /api/menu
  // ============================================================================
  describe('GET /api/menu', () => {
    it('returns only active categories and available products with deterministic order', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/menu',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['etag']).toBeDefined();
      expect(res.headers['cache-control']).toBe('public, no-cache');

      const json = JSON.parse(res.body);
      expect(json).toHaveProperty('categories');
      expect(json.categories.length).toBe(2); // Cervezas y Snacks (la inactiva se excluye)

      // Verificar categoría Cervezas
      const cervezas = json.categories[0];
      expect(cervezas.name).toBe('Cervezas');
      expect(cervezas.products.length).toBe(2); // Pilsen y Águila (Club Colombia está agotada)
      expect(cervezas.products[0].name).toBe('Pilsen 330ml');
      expect(cervezas.products[0].price).toBe(5000);
      expect(cervezas.products[1].name).toBe('Águila 330ml');

      // Verificar que NO se expongan campos internos
      for (const cat of json.categories) {
        expect(cat).not.toHaveProperty('isActive');
        expect(cat).not.toHaveProperty('createdAt');
        for (const prod of cat.products) {
          expect(prod).not.toHaveProperty('isAvailable');
          expect(prod).not.toHaveProperty('createdAt');
          expect(prod).not.toHaveProperty('updatedAt');
        }
      }
    });

    it('returns 304 Not Modified when client provides matching ETag', async () => {
      const initialRes = await app.inject({
        method: 'GET',
        url: '/api/menu',
      });

      const etag = initialRes.headers['etag'] as string;
      expect(etag).toBeDefined();

      const cachedRes = await app.inject({
        method: 'GET',
        url: '/api/menu',
        headers: {
          'if-none-match': etag,
        },
      });

      expect(cachedRes.statusCode).toBe(304);
      expect(cachedRes.body).toBe('');
    });
  });

  // ============================================================================
  // 2. TESTS DE POST /api/orders (Validaciones de Entrada)
  // ============================================================================
  describe('POST /api/orders - Validaciones de Entrada', () => {
    it('rejects request if X-Idempotency-Key header is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        payload: {
          tableToken: 't_m1_valid123',
          paymentMethodDeclared: 'CASH',
          items: [{ productId: 1, quantity: 1 }],
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('IDEMPOTENCY_KEY_MISSING');
    });

    it('rejects request if tableToken does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'x-idempotency-key': 'key_table_not_found_1' },
        payload: {
          tableToken: 't_non_existent',
          paymentMethodDeclared: 'CASH',
          items: [{ productId: 1, quantity: 1 }],
        },
      });

      expect(res.statusCode).toBe(404);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('INVALID_TABLE_TOKEN');
    });

    it('rejects request if tableToken belongs to an inactive table', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'x-idempotency-key': 'key_table_inactive_1' },
        payload: {
          tableToken: 't_m2_inactive',
          paymentMethodDeclared: 'CASH',
          items: [{ productId: 1, quantity: 1 }],
        },
      });

      expect(res.statusCode).toBe(404);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('INVALID_TABLE_TOKEN');
    });

    it('rejects request with empty items array', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'x-idempotency-key': 'key_empty_items_1' },
        payload: {
          tableToken: 't_m1_valid123',
          paymentMethodDeclared: 'CASH',
          items: [],
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects request with invalid quantities (0, negative, decimal, > 50)', async () => {
      const invalidQuantities = [0, -1, 1.5, 51];

      for (const q of invalidQuantities) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/orders',
          headers: { 'x-idempotency-key': `key_inv_qty_${q}` },
          payload: {
            tableToken: 't_m1_valid123',
            paymentMethodDeclared: 'CASH',
            items: [{ productId: 1, quantity: q }],
          },
        });

        expect(res.statusCode).toBe(400);
        const json = JSON.parse(res.body);
        expect(json.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('rejects request if productId does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'x-idempotency-key': 'key_prod_not_found_1' },
        payload: {
          tableToken: 't_m1_valid123',
          paymentMethodDeclared: 'CASH',
          items: [{ productId: 9999, quantity: 1 }],
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('rejects request if product is unavailable/agotado', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'x-idempotency-key': 'key_prod_unavailable_1' },
        payload: {
          tableToken: 't_m1_valid123',
          paymentMethodDeclared: 'CASH',
          items: [{ productId: 3, quantity: 1 }], // Club Colombia está agotada
        },
      });

      expect(res.statusCode).toBe(409);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('PRODUCT_UNAVAILABLE');
    });

    it('rejects request with notes exceeding 150 characters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'x-idempotency-key': 'key_notes_too_long' },
        payload: {
          tableToken: 't_m1_valid123',
          paymentMethodDeclared: 'CASH',
          notes: 'A'.repeat(151),
          items: [{ productId: 1, quantity: 1 }],
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ============================================================================
  // 3. TEST DE SOBERANÍA DEL PRECIO (Section 25)
  // ============================================================================
  describe('Test de Soberanía del Precio', () => {
    it('ignores client prices and enforces database pricing strictly', async () => {
      // El cliente intenta enviar "price: 1" y "subtotal: 2"
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'x-idempotency-key': 'key_sovereign_price_test' },
        payload: {
          tableToken: 't_m1_valid123',
          paymentMethodDeclared: 'NEQUI',
          items: [
            {
              productId: 1, // Pilsen cuesta 5000 en DB
              quantity: 2,
              price: 1, // Intento de manipulación fraudulenta
              subtotal: 2,
            },
            {
              productId: 4, // Papas Lays cuesta 3500 en DB
              quantity: 1,
              price: 0,
            },
          ],
          total: 2, // Intento de forzar total
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);

      // El total real debe ser: (5000 * 2) + (3500 * 1) = 13500.00
      expect(json.totalAmount).toBe(13500);

      // Verificar directamente en PostgreSQL
      const dbOrder = await testDb
        .select()
        .from(orders)
        .where(eq(orders.publicCode, json.orderCode));

      expect(dbOrder.length).toBe(1);
      expect(Number(dbOrder[0].totalAmount)).toBe(13500);
    });
  });

  // ============================================================================
  // 4. TEST DE SNAPSHOT HISTÓRICO (Section 26)
  // ============================================================================
  describe('Test de Snapshot Inmutable', () => {
    it('preserves historical order item snapshots even after product is modified in DB', async () => {
      // 1. Crear pedido cuando Pilsen cuesta $5000
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'x-idempotency-key': 'key_snapshot_test_1' },
        payload: {
          tableToken: 't_m1_valid123',
          paymentMethodDeclared: 'CASH',
          items: [{ productId: 1, quantity: 2 }],
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);

      // 2. Verificar snapshots iniciales en DB
      const orderRecord = (await testDb.select().from(orders).where(eq(orders.publicCode, json.orderCode)))[0];
      const items = await testDb.select().from(orderItems).where(eq(orderItems.orderId, orderRecord.id));

      expect(items.length).toBe(1);
      expect(items[0].productNameSnapshot).toBe('Pilsen 330ml');
      expect(items[0].unitPriceSnapshot).toBe('5000.00');
      expect(items[0].subtotal).toBe('10000.00');

      // 3. Modificar el producto en la base de datos (aumentar precio y cambiar nombre)
      await testDb
        .update(products)
        .set({ name: 'Pilsen Lata Nueva', price: '7500.00' })
        .where(eq(products.id, 1));

      // 4. Verificar que el pedido histórico NO cambió
      const historicalItems = await testDb.select().from(orderItems).where(eq(orderItems.orderId, orderRecord.id));
      expect(historicalItems[0].productNameSnapshot).toBe('Pilsen 330ml');
      expect(historicalItems[0].unitPriceSnapshot).toBe('5000.00');
      expect(historicalItems[0].subtotal).toBe('10000.00');

      const historicalOrder = (await testDb.select().from(orders).where(eq(orders.id, orderRecord.id)))[0];
      expect(historicalOrder.totalAmount).toBe('10000.00');
    });
  });

  // ============================================================================
  // 5. TESTS DE IDEMPOTENCIA
  // ============================================================================
  describe('Idempotencia de Pedidos', () => {
    it('returns the same order when called with the same key and identical payload', async () => {
      const payload = {
        tableToken: 't_m1_valid123',
        paymentMethodDeclared: 'CASH',
        notes: 'Sin hielo',
        items: [{ productId: 1, quantity: 2 }],
      };

      // Primera petición
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'x-idempotency-key': 'key_idempotent_identical' },
        payload,
      });

      expect(res1.statusCode).toBe(201);
      const order1 = JSON.parse(res1.body);

      // Segunda petición con la misma clave y mismo payload
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'x-idempotency-key': 'key_idempotent_identical' },
        payload,
      });

      expect(res2.statusCode).toBe(201);
      const order2 = JSON.parse(res2.body);

      expect(order1.orderCode).toBe(order2.orderCode);
      expect(order1.totalAmount).toBe(order2.totalAmount);
      expect(order1.createdAt).toBe(order2.createdAt);

      // Verificar que solo existe 1 registro en la DB
      const allOrders = await testDb.select().from(orders);
      expect(allOrders.length).toBe(1);
    });

    it('rejects with 409 Conflict when the same key is reused with a different payload', async () => {
      const key = 'key_reused_diff_payload';

      // Primera petición: 2 Pilsen
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'x-idempotency-key': key },
        payload: {
          tableToken: 't_m1_valid123',
          paymentMethodDeclared: 'CASH',
          items: [{ productId: 1, quantity: 2 }],
        },
      });
      expect(res1.statusCode).toBe(201);

      // Segunda petición: MISMA CLAVE pero con 1 Papas Lays
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'x-idempotency-key': key },
        payload: {
          tableToken: 't_m1_valid123',
          paymentMethodDeclared: 'CASH',
          items: [{ productId: 4, quantity: 1 }],
        },
      });

      expect(res2.statusCode).toBe(409);
      const json = JSON.parse(res2.body);
      expect(json.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });
  });

  // ============================================================================
  // 6. TEST DE CONCURRENCIA (Section 24)
  // ============================================================================
  describe('Test de Concurrencia Real', () => {
    it('creates exactly 1 order when 10 concurrent requests arrive with the same idempotency key', async () => {
      const key = 'key_concurrent_burst_10';
      const payload = {
        tableToken: 't_m1_valid123',
        paymentMethodDeclared: 'BANCOLOMBIA',
        items: [{ productId: 1, quantity: 1 }],
      };

      // Disparar 10 solicitudes paralelas al mismo tiempo
      const requests = Array.from({ length: 10 }).map(() =>
        app.inject({
          method: 'POST',
          url: '/api/orders',
          headers: { 'x-idempotency-key': key },
          payload,
        })
      );

      const responses = await Promise.all(requests);

      // Todas las respuestas deben ser 201 y retornar el mismo código de orden
      const codes = responses.map((r) => {
        expect(r.statusCode).toBe(201);
        return JSON.parse(r.body).orderCode;
      });

      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(1);

      // Verificar en base de datos que se creó exactamente 1 registro
      const dbOrders = await testDb.select().from(orders);
      expect(dbOrders.length).toBe(1);
      expect(dbOrders[0].publicCode).toBe(codes[0]);
    });
  });

  // ============================================================================
  // 7. TESTS DE GET /api/orders/:publicCode/status
  // ============================================================================
  describe('GET /api/orders/:publicCode/status', () => {
    it('returns status of an existing order correctly', async () => {
      // Crear orden primero
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'x-idempotency-key': 'key_status_check_1' },
        payload: {
          tableToken: 't_m1_valid123',
          paymentMethodDeclared: 'BRE_B',
          items: [{ productId: 1, quantity: 2 }],
        },
      });

      const created = JSON.parse(createRes.body);

      // Consultar estado público
      const statusRes = await app.inject({
        method: 'GET',
        url: `/api/orders/${created.orderCode}/status`,
      });

      expect(statusRes.statusCode).toBe(200);
      const json = JSON.parse(statusRes.body);

      expect(json.orderCode).toBe(created.orderCode);
      expect(json.tableName).toBe('Mesa 1');
      expect(json.fulfillmentStatus).toBe('PENDING');
      expect(json.paymentStatus).toBe('UNPAID');
      expect(json.totalAmount).toBe(10000);
      expect(json.createdAt).toBeDefined();

      // No debe exponer UUID interno ni datos administrativos
      expect(json).not.toHaveProperty('id');
      expect(json).not.toHaveProperty('idempotencyKey');
      expect(json).not.toHaveProperty('requestHash');
    });

    it('returns 404 for non-existent publicCode', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/orders/ORD-NONEXIST/status',
      });

      expect(res.statusCode).toBe(404);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('ORDER_NOT_FOUND');
    });
  });
});
