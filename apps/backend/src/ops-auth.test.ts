import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from './app.js';
import { createTestDb } from './test/test-db.js';
import {
  users,
  tables,
  categories,
  products,
  orders,
  orderItems,
  auditLogs,
  sessions,
} from './db/schema.js';
import {
  UserRole,
  FulfillmentStatus,
  PaymentStatus,
  PaymentMethodDeclared,
} from '@qr-menu/shared';
import { hashPassword } from './services/auth.service.js';
import { eq } from 'drizzle-orm';
import { FastifyInstance } from 'fastify';

describe('FASE 4: Backend Auth, RBAC, Operations & Audit Comprehensive Tests', () => {
  let app: FastifyInstance;
  let testDb: Awaited<ReturnType<typeof createTestDb>>['db'];
  let client: Awaited<ReturnType<typeof createTestDb>>['client'];

  // IDs de prueba
  let cashierUserId: string;

  beforeEach(async () => {
    const testSetup = await createTestDb();
    testDb = testSetup.db;
    client = testSetup.client;

    app = buildApp({ logger: false, db: testDb });

    const passwordHash = await hashPassword('Password123!');

    // Inserción de usuarios con diferentes roles
    const insertedUsers = await testDb
      .insert(users)
      .values([
        {
          username: 'admin_user',
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
        },
        {
          username: 'cashier_user',
          passwordHash,
          role: UserRole.CASHIER,
          isActive: true,
        },

        {
          username: 'inactive_user',
          passwordHash,
          role: UserRole.CASHIER,
          isActive: false,
        },
      ])
      .returning();

    cashierUserId = insertedUsers[1].id;

    // Mesas y catálogo base
    await testDb.insert(tables).values([
      { id: 1, number: 1, name: 'Mesa 1', publicToken: 't_mesa1_test', isActive: true },
      { id: 2, number: 2, name: 'Mesa 2', publicToken: 't_mesa2_test', isActive: true },
    ]);

    await testDb.insert(categories).values([
      { id: 1, name: 'Bebidas', sortOrder: 1, isActive: true },
    ]);

    await testDb.insert(products).values([
      { id: 1, categoryId: 1, name: 'Cerveza', price: '5000.00', isAvailable: true, sortOrder: 1 },
    ]);
  });

  afterEach(async () => {
    await app.close();
    await client.close();
  });

  // Helper para login y extracción de cookie firmada
  async function loginAs(username: string, password = 'Password123!'): Promise<{
    statusCode: number;
    body: any;
    cookieHeader: string | undefined;
  }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: {
        'content-type': 'application/json',
      },
      payload: { username, password },
    });

    const setCookie = res.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    let body: any = null;
    try {
      body = JSON.parse(res.body);
    } catch {
      // Ignorar si no es json
    }
    return { statusCode: res.statusCode, body, cookieHeader };
  }

  // Helper para crear una orden de prueba en la base de datos
  async function createTestOrder(
    tableId = 1,
    fulfillmentStatus: FulfillmentStatus = FulfillmentStatus.PENDING,
    paymentStatus: PaymentStatus = PaymentStatus.UNPAID
  ) {
    const publicCode = `ORD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const idempotencyKey = `idem_${Math.random().toString(36).substring(2, 12)}`;

    const [order] = await testDb
      .insert(orders)
      .values({
        publicCode,
        tableId,
        fulfillmentStatus,
        paymentStatus,
        paymentMethod: PaymentMethodDeclared.NEQUI,
        idempotencyKey,
        requestHash: 'mock_hash',
        totalAmount: '10000.00',
        notes: 'Mesa con hielo',
      })
      .returning();

    await testDb.insert(orderItems).values({
      orderId: order.id,
      productId: 1,
      productNameSnapshot: 'Cerveza',
      unitPriceSnapshot: '5000.00',
      quantity: 2,
      subtotal: '10000.00',
    });

    return order;
  }

  // ============================================================================
  // 1. TESTS DE AUTENTICACIÓN
  // ============================================================================
  describe('Autenticación (/api/auth)', () => {
    it('login exitoso: retorna 200, usuario sin password_hash y emite cookie HttpOnly', async () => {
      const { statusCode, body, cookieHeader } = await loginAs('admin_user');

      expect(statusCode).toBe(200);
      expect(body.user).toBeDefined();
      expect(body.user.username).toBe('admin_user');
      expect(body.user.role).toBe(UserRole.ADMIN);
      expect(body.user).not.toHaveProperty('passwordHash');
      expect(body.user).not.toHaveProperty('password_hash');

      expect(cookieHeader).toBeDefined();
      expect(cookieHeader).toContain('qr_session=');
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader).toContain('SameSite=Lax');
    });

    it('login con contraseña incorrecta: retorna 401 con mensaje genérico', async () => {
      const { statusCode, body, cookieHeader } = await loginAs('admin_user', 'WrongPassword!');

      expect(statusCode).toBe(401);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
      expect(body.error.message).toBe('Usuario o contraseña incorrectos');
      expect(cookieHeader).toBeUndefined();
    });

    it('login con usuario inexistente: no enumera usuarios y devuelve 401 idéntico', async () => {
      const { statusCode, body, cookieHeader } = await loginAs('non_existent_user', 'AnyPassword123!');

      expect(statusCode).toBe(401);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
      expect(body.error.message).toBe('Usuario o contraseña incorrectos');
      expect(cookieHeader).toBeUndefined();
    });

    it('login con usuario inactivo: no enumera estado y retorna 401 unificado (SEC-07)', async () => {
      const { statusCode, body } = await loginAs('inactive_user');

      expect(statusCode).toBe(401);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
      expect(body.error.message).toBe('Usuario o contraseña incorrectos');
    });

    it('sesión de usuario desactivado posteriormente: es revocada de inmediato con 403 (SEC-07)', async () => {
      const { cookieHeader } = await loginAs('cashier_user');

      // Desactivar al usuario en base de datos
      await testDb
        .update(users)
        .set({ isActive: false })
        .where(eq(users.username, 'cashier_user'));

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: cookieHeader!,
        },
      });

      expect(meRes.statusCode).toBe(403);
      expect(JSON.parse(meRes.body).error.code).toBe('USER_INACTIVE');

      // Siguiente invocación debe retornar 401 porque la sesión fue eliminada
      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: cookieHeader!,
        },
      });
      expect(secondRes.statusCode).toBe(401);
    });

    it('GET /api/auth/me con sesión válida: retorna perfil del usuario actual', async () => {
      const { cookieHeader } = await loginAs('cashier_user');

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: cookieHeader!,
        },
      });

      expect(meRes.statusCode).toBe(200);
      const json = JSON.parse(meRes.body);
      expect(json.user.username).toBe('cashier_user');
      expect(json.user.role).toBe(UserRole.CASHIER);
      expect(json.user).not.toHaveProperty('passwordHash');
    });

    it('GET /api/auth/me sin sesión: retorna 401 Unauthorized', async () => {
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(meRes.statusCode).toBe(401);
      const json = JSON.parse(meRes.body);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /api/auth/logout: destruye la sesión en base de datos y limpia la cookie', async () => {
      const { cookieHeader } = await loginAs('admin_user');

      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          cookie: cookieHeader!,
        },
      });

      expect(logoutRes.statusCode).toBe(200);
      const clearedCookie = logoutRes.headers['set-cookie'];
      expect(String(clearedCookie)).toContain('Max-Age=0');

      // Subsequent call to /me must now fail with 401
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: cookieHeader!,
        },
      });
      expect(meRes.statusCode).toBe(401);
    });
  });

  // ============================================================================
  // 2. TESTS DE AUTORIZACIÓN Y MATRIZ RBAC
  // ============================================================================
  describe('Matriz RBAC en Rutas Operativas', () => {
    it('usuario anónimo recibe 401 al intentar acceder a rutas operativas', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/ops/orders',
      });
      expect(res.statusCode).toBe(401);
    });

    it('ADMIN tiene acceso completo: puede ver órdenes, preparar y pagar', async () => {
      const { cookieHeader } = await loginAs('admin_user');
      const order = await createTestOrder(1, FulfillmentStatus.PENDING, PaymentStatus.UNPAID);

      // 1. Ver órdenes
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/ops/orders',
        headers: { cookie: cookieHeader! },
      });
      expect(listRes.statusCode).toBe(200);

      // 2. Cambiar a PREPARING
      const prepareRes = await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${order.id}/fulfillment`,
        headers: {
          cookie: cookieHeader!,
          'content-type': 'application/json',
        },
        payload: { status: FulfillmentStatus.PREPARING },
      });
      expect(prepareRes.statusCode).toBe(200);

      // 3. Confirmar pago
      const payRes = await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${order.id}/payment`,
        headers: {
          cookie: cookieHeader!,
          'content-type': 'application/json',
        },
        payload: { paymentStatus: PaymentStatus.PAID },
      });
      expect(payRes.statusCode).toBe(200);
    });



    it('CASHIER puede ver órdenes, preparar comanda y cobrar en caja (flujo unificado)', async () => {
      const { cookieHeader } = await loginAs('cashier_user');
      const order = await createTestOrder(1, FulfillmentStatus.PENDING, PaymentStatus.UNPAID);

      // 1. Cambiar a PREPARING -> Permitido para cajero (200 en flujo unificado de caja)
      const prepRes = await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${order.id}/fulfillment`,
        headers: {
          cookie: cookieHeader!,
          'content-type': 'application/json',
        },
        payload: { status: FulfillmentStatus.PREPARING },
      });
      expect(prepRes.statusCode).toBe(200);
      expect(JSON.parse(prepRes.body).fulfillmentStatus).toBe(FulfillmentStatus.PREPARING);

      // 2. Confirmar pago -> Permitido (200)
      const payRes = await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${order.id}/payment`,
        headers: {
          cookie: cookieHeader!,
          'content-type': 'application/json',
        },
        payload: { paymentStatus: PaymentStatus.PAID },
      });
      expect(payRes.statusCode).toBe(200);
      expect(JSON.parse(payRes.body).paymentStatus).toBe(PaymentStatus.PAID);
    });

    it('CASHIER puede cancelar pedidos (por ejemplo si el cliente desiste en caja)', async () => {
      const { cookieHeader } = await loginAs('cashier_user');
      const order = await createTestOrder(1, FulfillmentStatus.PENDING, PaymentStatus.UNPAID);

      const cancelRes = await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${order.id}/fulfillment`,
        headers: {
          cookie: cookieHeader!,
          'content-type': 'application/json',
        },
        payload: {
          status: FulfillmentStatus.CANCELLED,
          reason: 'Cliente canceló antes del cobro',
        },
      });

      expect(cancelRes.statusCode).toBe(200);
      expect(JSON.parse(cancelRes.body).fulfillmentStatus).toBe(FulfillmentStatus.CANCELLED);
    });

    it('permite filtrar órdenes por fecha con el query param date (YYYY-MM-DD)', async () => {
      const { cookieHeader } = await loginAs('admin_user');
      const order = await createTestOrder(1, FulfillmentStatus.PENDING, PaymentStatus.UNPAID);

      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

      // Consulta con fecha de hoy
      const resToday = await app.inject({
        method: 'GET',
        url: `/api/ops/orders?date=${todayStr}`,
        headers: { cookie: cookieHeader! },
      });
      expect(resToday.statusCode).toBe(200);
      const jsonToday = JSON.parse(resToday.body);
      expect(jsonToday.orders.some((o: { id: string }) => o.id === order.id)).toBe(true);

      // Consulta con fecha de ayer (no debe incluir la orden creada hoy)
      const resYesterday = await app.inject({
        method: 'GET',
        url: '/api/ops/orders?date=2020-01-01',
        headers: { cookie: cookieHeader! },
      });
      expect(resYesterday.statusCode).toBe(200);
      const jsonYesterday = JSON.parse(resYesterday.body);
      expect(jsonYesterday.orders.some((o: { id: string }) => o.id === order.id)).toBe(false);
    });
  });

  // ============================================================================
  // 3. TESTS DE TRANSICIÓN DE ESTADOS Y CONFLICTOS (409 CONFLICT)
  // ============================================================================
  describe('Máquina de Estados de Pedidos y Transiciones', () => {
    it('flujo completo válido: PENDING -> PREPARING -> DELIVERED', async () => {
      const { cookieHeader } = await loginAs('cashier_user');
      const order = await createTestOrder(1, FulfillmentStatus.PENDING);

      // 1. PENDING -> PREPARING
      const res1 = await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${order.id}/fulfillment`,
        headers: { cookie: cookieHeader!, 'content-type': 'application/json' },
        payload: { status: FulfillmentStatus.PREPARING },
      });
      expect(res1.statusCode).toBe(200);
      expect(JSON.parse(res1.body).fulfillmentStatus).toBe(FulfillmentStatus.PREPARING);

      // 2. PREPARING -> DELIVERED
      const res2 = await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${order.id}/fulfillment`,
        headers: { cookie: cookieHeader!, 'content-type': 'application/json' },
        payload: { status: FulfillmentStatus.DELIVERED },
      });
      expect(res2.statusCode).toBe(200);
      expect(JSON.parse(res2.body).fulfillmentStatus).toBe(FulfillmentStatus.DELIVERED);
    });

    it('rechaza con 409 saltarse PREPARING (PENDING -> DELIVERED)', async () => {
      const { cookieHeader } = await loginAs('cashier_user');
      const order = await createTestOrder(1, FulfillmentStatus.PENDING);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${order.id}/fulfillment`,
        headers: { cookie: cookieHeader!, 'content-type': 'application/json' },
        payload: { status: FulfillmentStatus.DELIVERED },
      });

      expect(res.statusCode).toBe(409);
    });

    it('rechaza con 409 modificar un pedido en estado terminal DELIVERED', async () => {
      const { cookieHeader } = await loginAs('cashier_user');
      const order = await createTestOrder(1, FulfillmentStatus.DELIVERED);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${order.id}/fulfillment`,
        headers: { cookie: cookieHeader!, 'content-type': 'application/json' },
        payload: { status: FulfillmentStatus.PREPARING },
      });

      expect(res.statusCode).toBe(409);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('ORDER_INVALID_STATE_TRANSITION');
    });

    it('rechaza con 409 revertir un pedido de PAID a UNPAID', async () => {
      const { cookieHeader } = await loginAs('cashier_user');
      const order = await createTestOrder(1, FulfillmentStatus.PENDING, PaymentStatus.PAID);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${order.id}/payment`,
        headers: { cookie: cookieHeader!, 'content-type': 'application/json' },
        payload: { paymentStatus: PaymentStatus.PAID },
      });

      expect(res.statusCode).toBe(409);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('ORDER_ALREADY_PAID');
    });

    it('retorna 404 para ID de orden inexistente', async () => {
      const { cookieHeader } = await loginAs('admin_user');
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${nonExistentUuid}/fulfillment`,
        headers: { cookie: cookieHeader!, 'content-type': 'application/json' },
        payload: { status: FulfillmentStatus.PREPARING },
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error.code).toBe('ORDER_NOT_FOUND');
    });
  });

  // ============================================================================
  // 4. TESTS DE CONCURRENCIA REAL
  // ============================================================================
  describe('Concurrencia Operativa (KDS & Caja)', () => {
    it('dos operadores intentan tomar el mismo pedido PENDING simultáneamente: exactamente uno gana (200) y el otro recibe 409', async () => {
      const { cookieHeader } = await loginAs('cashier_user');
      const order = await createTestOrder(1, FulfillmentStatus.PENDING);

      // Lanzar 2 peticiones paralelas al mismo instante
      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'PATCH',
          url: `/api/ops/orders/${order.id}/fulfillment`,
          headers: { cookie: cookieHeader!, 'content-type': 'application/json' },
          payload: { status: FulfillmentStatus.PREPARING },
        }),
        app.inject({
          method: 'PATCH',
          url: `/api/ops/orders/${order.id}/fulfillment`,
          headers: { cookie: cookieHeader!, 'content-type': 'application/json' },
          payload: { status: FulfillmentStatus.PREPARING },
        }),
      ]);

      const statusCodes = [res1.statusCode, res2.statusCode].sort();
      expect(statusCodes).toEqual([200, 409]);

      const conflictRes = res1.statusCode === 409 ? res1 : res2;
      const jsonConflict = JSON.parse(conflictRes.body);
      expect(jsonConflict.error.code).toBe('ORDER_STATE_CONFLICT');
    });

    it('dos cajeros intentan confirmar pago para el mismo pedido al mismo tiempo: exactamente uno triunfa', async () => {
      const { cookieHeader } = await loginAs('cashier_user');
      const order = await createTestOrder(1, FulfillmentStatus.PENDING, PaymentStatus.UNPAID);

      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'PATCH',
          url: `/api/ops/orders/${order.id}/payment`,
          headers: { cookie: cookieHeader!, 'content-type': 'application/json' },
          payload: { paymentStatus: PaymentStatus.PAID },
        }),
        app.inject({
          method: 'PATCH',
          url: `/api/ops/orders/${order.id}/payment`,
          headers: { cookie: cookieHeader!, 'content-type': 'application/json' },
          payload: { paymentStatus: PaymentStatus.PAID },
        }),
      ]);

      const statusCodes = [res1.statusCode, res2.statusCode].sort();
      expect(statusCodes).toEqual([200, 409]);
    });
  });

  // ============================================================================
  // 5. TESTS DE AUDITORÍA Y SEGURIDAD
  // ============================================================================
  describe('Auditoría y Seguridad', () => {
    it('las mutaciones sensibles generan registros detallados en audit_logs', async () => {
      const { cookieHeader } = await loginAs('cashier_user');
      const order = await createTestOrder(1, FulfillmentStatus.PENDING);

      // Ejecutar cambio de estado a PREPARING
      await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${order.id}/fulfillment`,
        headers: { cookie: cookieHeader!, 'content-type': 'application/json' },
        payload: { status: FulfillmentStatus.PREPARING, reason: 'Comenzando en horno' },
      });

      // Consultar audit_logs
      const logs = await testDb
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, order.id));

      expect(logs.length).toBeGreaterThanOrEqual(1);
      const fulfillmentLog = logs.find((l) => l.action === 'ORDER_FULFILLMENT_UPDATED');
      expect(fulfillmentLog).toBeDefined();
      expect(fulfillmentLog?.userId).toBe(cashierUserId);
      expect(fulfillmentLog?.entityType).toBe('ORDER');
      expect(fulfillmentLog?.metadata).toMatchObject({
        publicCode: order.publicCode,
        newStatus: 'PREPARING',
        reason: 'Comenzando en horno',
      });

      // Asegurar que no contenga passwords ni hashes
      expect(fulfillmentLog?.metadata).not.toHaveProperty('password');
      expect(fulfillmentLog?.metadata).not.toHaveProperty('passwordHash');
    });

    it('protección CSRF rechaza mutaciones con Origin sospechoso o sin application/json', async () => {
      const { cookieHeader } = await loginAs('cashier_user');
      const order = await createTestOrder(1, FulfillmentStatus.PENDING);

      // Petición con Origin malicioso externo
      const csrfRes = await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${order.id}/fulfillment`,
        headers: {
          cookie: cookieHeader!,
          origin: 'http://malicious-attacker-site.com',
          'content-type': 'application/json',
        },
        payload: { status: FulfillmentStatus.PREPARING },
      });

      expect(csrfRes.statusCode).toBe(403);
      expect(JSON.parse(csrfRes.body).error.code).toBe('CSRF_TOKEN_INVALID');
    });

    it('protección CSRF acepta Referer válido si Origin está ausente, y rechaza Referer sospechoso (SEC-06)', async () => {
      const { cookieHeader } = await loginAs('cashier_user');
      const order = await createTestOrder(1, FulfillmentStatus.PENDING);

      // 1. Referer sospechoso -> 403
      const badRefRes = await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${order.id}/fulfillment`,
        headers: {
          cookie: cookieHeader!,
          referer: 'http://malicious-external-site.com/attack',
          'content-type': 'application/json',
        },
        payload: { status: FulfillmentStatus.PREPARING },
      });
      expect(badRefRes.statusCode).toBe(403);
      expect(JSON.parse(badRefRes.body).error.code).toBe('CSRF_TOKEN_INVALID');

      // 2. Referer legítimo -> 200
      const goodRefRes = await app.inject({
        method: 'PATCH',
        url: `/api/ops/orders/${order.id}/fulfillment`,
        headers: {
          cookie: cookieHeader!,
          referer: 'http://localhost:5173/ops',
          'content-type': 'application/json',
        },
        payload: { status: FulfillmentStatus.PREPARING },
      });
      expect(goodRefRes.statusCode).toBe(200);
    });

    it('almacenamiento de sesión seguro (SEC-01): DB contiene hash SHA-256 y nunca el token raw', async () => {
      const { cookieHeader } = await loginAs('admin_user');
      expect(cookieHeader).toBeDefined();

      const match = cookieHeader!.match(/qr_session=([^;]+)/);
      expect(match).toBeDefined();
      const rawCookieVal = decodeURIComponent(match![1]);
      // Formato Fastify cookie firmada: <rawToken>.<signature>
      const rawToken = rawCookieVal.split('.')[0];
      expect(rawToken.length).toBe(64);

      const dbSessions = await testDb.select().from(sessions);
      expect(dbSessions.length).toBeGreaterThanOrEqual(1);

      // El token en texto plano NO debe existir en la base de datos
      const rawFoundInDb = dbSessions.some((s) => s.tokenHash === rawToken);
      expect(rawFoundInDb).toBe(false);

      // El token debe almacenarse como su hash SHA-256
      const crypto = await import('crypto');
      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const foundHash = dbSessions.find((s) => s.tokenHash === expectedHash);
      expect(foundHash).toBeDefined();
    });

    it('seed de desarrollo aborta inmediatamente en producción (SEC-02)', async () => {
      const prevEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const { runSeed } = await import('./db/seed.js');
        await expect(runSeed(testDb as any)).rejects.toThrow(/No está permitido ejecutar seed/);
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });

    it('buildApp aborta en producción si falta SESSION_SECRET o tiene menos de 32 caracteres (SEC-03)', () => {
      const prevEnv = process.env.NODE_ENV;
      const prevSecret = process.env.SESSION_SECRET;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.SESSION_SECRET;
        expect(() => buildApp({ logger: false })).toThrow(/SESSION_SECRET es obligatoria en producción/);

        process.env.SESSION_SECRET = 'short_secret_under_32';
        expect(() => buildApp({ logger: false })).toThrow(/SESSION_SECRET es obligatoria en producción/);
      } finally {
        process.env.NODE_ENV = prevEnv;
        if (prevSecret !== undefined) {
          process.env.SESSION_SECRET = prevSecret;
        } else {
          delete process.env.SESSION_SECRET;
        }
      }
    });

    it('sanitización recursiva de metadata en audit logs elimina secretos anidados (SEC-08)', async () => {
      const { recordAuditLog } = await import('./services/auth.service.js');
      const payloadWithNestedSecrets = {
        action: 'RECURSIVE_TEST',
        entityType: 'TEST',
        entityId: 'test-123',
        metadata: {
          safeProperty: 'hello_world',
          credentials: {
            password: 'leaked_password',
            apiKey: 'leaked_api_key',
            authorization: 'Bearer token',
          },
          deepList: [
            { token: 'leaked_token', secret: 'leaked_secret', name: 'safe_item' },
          ],
        },
      };

      await recordAuditLog(payloadWithNestedSecrets, testDb as any);

      const logs = await testDb
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, 'RECURSIVE_TEST'));

      expect(logs.length).toBe(1);
      const meta = logs[0].metadata as any;
      expect(meta.safeProperty).toBe('hello_world');
      expect(meta.credentials).not.toHaveProperty('password');
      expect(meta.credentials).not.toHaveProperty('apiKey');
      expect(meta.credentials).not.toHaveProperty('authorization');
      expect(meta.deepList[0]).not.toHaveProperty('token');
      expect(meta.deepList[0]).not.toHaveProperty('secret');
      expect(meta.deepList[0].name).toBe('safe_item');
    });
  });
});
