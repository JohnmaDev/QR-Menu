import { FastifyInstance } from 'fastify';
import {
  UserRole,
  CreateTableInputSchema,
  UpdateTableInputSchema,
  CreateProductInputSchema,
  UpdateProductInputSchema,
} from '@qr-menu/shared';
import { getDb } from '../db/index.js';
import { ValidationError } from '../errors.js';
import {
  createAuthMiddleware,
  requireRole,
  verifyCsrfProtection,
} from '../middleware/auth.middleware.js';
import {
  listAdminTables,
  createAdminTable,
  updateAdminTable,
  listAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  toggleProductAvailability,
  listAdminCategories,
} from '../services/admin.service.js';

export interface AdminRoutesOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}

export async function adminRoutes(app: FastifyInstance, opts: AdminRoutesOptions = {}) {
  const db = opts.db || getDb();
  const requireAuth = createAuthMiddleware(db);

  // Exigir autenticación y rol ADMIN en todas las rutas administrativas
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', requireRole([UserRole.ADMIN]));

  // ============================================================================
  // 1. MESAS (TABLES)
  // ============================================================================

  // GET /api/admin/tables
  app.get('/tables', async (_request, reply) => {
    const tables = await listAdminTables(db);
    return reply.code(200).send({ tables });
  });

  // POST /api/admin/tables
  app.post(
    '/tables',
    { preHandler: [verifyCsrfProtection] },
    async (request, reply) => {
      const parseResult = CreateTableInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        throw new ValidationError('Datos de mesa inválidos', issues);
      }

      const table = await createAdminTable(parseResult.data, db);
      return reply.code(201).send({ table });
    }
  );

  // PATCH /api/admin/tables/:id
  app.patch<{ Params: { id: string } }>(
    '/tables/:id',
    { preHandler: [verifyCsrfProtection] },
    async (request, reply) => {
      const tableId = parseInt(request.params.id, 10);
      if (isNaN(tableId)) {
        throw new ValidationError('ID de mesa inválido');
      }

      const parseResult = UpdateTableInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        throw new ValidationError('Datos de actualización de mesa inválidos', issues);
      }

      const table = await updateAdminTable(tableId, parseResult.data, db);
      return reply.code(200).send({ table });
    }
  );

  // ============================================================================
  // 2. PRODUCTOS (PRODUCTS)
  // ============================================================================

  // GET /api/admin/products
  app.get('/products', async (_request, reply) => {
    const products = await listAdminProducts(db);
    return reply.code(200).send({ products });
  });

  // POST /api/admin/products
  app.post(
    '/products',
    { preHandler: [verifyCsrfProtection] },
    async (request, reply) => {
      const parseResult = CreateProductInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        throw new ValidationError('Datos de producto inválidos', issues);
      }

      const product = await createAdminProduct(parseResult.data, db);
      return reply.code(201).send({ product });
    }
  );

  // PUT /api/admin/products/:id
  app.put<{ Params: { id: string } }>(
    '/products/:id',
    { preHandler: [verifyCsrfProtection] },
    async (request, reply) => {
      const productId = parseInt(request.params.id, 10);
      if (isNaN(productId)) {
        throw new ValidationError('ID de producto inválido');
      }

      const parseResult = UpdateProductInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        throw new ValidationError('Datos de actualización de producto inválidos', issues);
      }

      const product = await updateAdminProduct(productId, parseResult.data, db);
      return reply.code(200).send({ product });
    }
  );

  // PATCH /api/admin/products/:id/toggle
  app.patch<{ Params: { id: string } }>(
    '/products/:id/toggle',
    { preHandler: [verifyCsrfProtection] },
    async (request, reply) => {
      const productId = parseInt(request.params.id, 10);
      if (isNaN(productId)) {
        throw new ValidationError('ID de producto inválido');
      }

      const product = await toggleProductAvailability(productId, db);
      return reply.code(200).send({ product });
    }
  );

  // ============================================================================
  // 3. CATEGORÍAS (CATEGORIES)
  // ============================================================================

  // GET /api/admin/categories
  app.get('/categories', async (_request, reply) => {
    const categories = await listAdminCategories(db);
    return reply.code(200).send({ categories });
  });
}
