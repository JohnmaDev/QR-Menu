import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './db/schema.js';
import { buildApp } from './app.js';
import { UserRole } from '@qr-menu/shared';
import { createTestDb } from './test/test-db.js';
import { hashPassword } from './services/auth.service.js';

describe('FASE 5: Admin Routes & Services Comprehensive Tests', () => {
  let app: FastifyInstance;
  let client: PGlite;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let adminCookie: string;
  let cashierCookie: string;

  beforeAll(async () => {
    const testSetup = await createTestDb();
    testDb = testSetup.db;
    client = testSetup.client;

    app = buildApp({ db: testDb, logger: false });
    await app.ready();

    // Crear usuarios de prueba
    const passwordHash = await hashPassword('Admin123!');
    await testDb.insert(schema.users).values([
      {
        username: 'admin_test',
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
      {
        username: 'caja_test',
        passwordHash,
        role: UserRole.CASHIER,
        isActive: true,
      },
    ]);

    // Crear categoría inicial
    await testDb.insert(schema.categories).values([
      { id: 1, name: 'Bebidas', icon: 'beer', sortOrder: 1, isActive: true },
    ]);

    // Helper para extraer cookie
    const extractCookie = (res: any) => {
      const setCookie = res.headers['set-cookie'];
      if (!setCookie) return '';
      const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      return first.split(';')[0];
    };

    // Login Admin
    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { username: 'admin_test', password: 'Admin123!' },
    });
    adminCookie = extractCookie(adminLoginRes);

    // Login Cashier
    const cashierLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { username: 'caja_test', password: 'Admin123!' },
    });
    cashierCookie = extractCookie(cashierLoginRes);
  });

  afterAll(async () => {
    await app.close();
    await client.close();
  });

  // ============================================================================
  // 1. Control de Acceso (RBAC)
  // ============================================================================
  describe('RBAC en /api/admin', () => {
    it('rechaza con 401 si no hay sesión autenticada', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/tables',
      });
      expect(res.statusCode).toBe(401);
    });

    it('rechaza con 403 si el usuario es CASHIER (solo ADMIN permitido)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/tables',
        headers: { cookie: cashierCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('permite acceso si el usuario es ADMIN', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/tables',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // ============================================================================
  // 2. Mesas & Tokens de QR
  // ============================================================================
  describe('Gestión de Mesas (/api/admin/tables)', () => {
    it('crea una nueva mesa con token seguro único autogenerado', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tables',
        headers: {
          cookie: adminCookie,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
        },
        payload: {
          number: 10,
          name: 'Mesa 10 VIP',
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.table.number).toBe(10);
      expect(data.table.name).toBe('Mesa 10 VIP');
      expect(data.table.publicToken).toMatch(/^t_m10_[a-f0-9]{6}$/);
      expect(data.table.isActive).toBe(true);
    });

    it('rechaza crear mesa con número duplicado', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tables',
        headers: {
          cookie: adminCookie,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
        },
        payload: {
          number: 10,
          name: 'Otra Mesa 10',
        },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error.message).toContain('Ya existe una mesa');
    });

    it('actualiza el estado activo/inactivo de una mesa', async () => {
      // Listar mesas para obtener id
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/admin/tables',
        headers: { cookie: adminCookie },
      });
      const { tables } = JSON.parse(listRes.body);
      const targetTable = tables.find((t: any) => t.number === 10);

      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/admin/tables/${targetTable.id}`,
        headers: {
          cookie: adminCookie,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
        },
        payload: { isActive: false, name: 'Mesa 10 Reservada' },
      });

      expect(updateRes.statusCode).toBe(200);
      const data = JSON.parse(updateRes.body);
      expect(data.table.isActive).toBe(false);
      expect(data.table.name).toBe('Mesa 10 Reservada');
    });
  });

  // ============================================================================
  // 3. Productos y Disponibilidad
  // ============================================================================
  describe('Gestión de Productos (/api/admin/products)', () => {
    let createdProdId: number;

    it('crea un producto con precio, categoría e imagen', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/products',
        headers: {
          cookie: adminCookie,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
        },
        payload: {
          categoryId: 1,
          name: 'Cerveza Corona Extra',
          description: 'Botella 355ml con limón',
          price: 9000,
          imageUrl: 'https://example.com/corona.jpg',
          isAvailable: true,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.product.name).toBe('Cerveza Corona Extra');
      expect(data.product.price).toBe(9000);
      expect(data.product.categoryName).toBe('Bebidas');
      expect(data.product.isAvailable).toBe(true);
      createdProdId = data.product.id;
    });

    it('actualiza datos y precio de un producto', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/products/${createdProdId}`,
        headers: {
          cookie: adminCookie,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
        },
        payload: {
          price: 9500,
          description: 'Botella 355ml bien helada',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.product.price).toBe(9500);
      expect(data.product.description).toBe('Botella 355ml bien helada');
    });

    it('alterna la disponibilidad del producto (toggle isAvailable)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/products/${createdProdId}/toggle`,
        headers: {
          cookie: adminCookie,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
        },
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.product.isAvailable).toBe(false);

      // Segunda alternancia regresa a true
      const res2 = await app.inject({
        method: 'PATCH',
        url: `/api/admin/products/${createdProdId}/toggle`,
        headers: {
          cookie: adminCookie,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
        },
        payload: {},
      });
      expect(res2.statusCode).toBe(200);
      const data2 = JSON.parse(res2.body);
      expect(data2.product.isAvailable).toBe(true);
    });

    it('obtiene el listado de categorías', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/categories',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.categories.length).toBeGreaterThanOrEqual(1);
      expect(data.categories[0].name).toBe('Bebidas');
    });
  });
});
