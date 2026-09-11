import { FastifyInstance } from 'fastify';
import {
  UserRole,
  FulfillmentStatus,
  PaymentStatus,
  UpdateFulfillmentInputSchema,
  ConfirmPaymentInputSchema,
} from '@qr-menu/shared';
import { getDb } from '../db/index.js';
import { ValidationError } from '../errors.js';
import {
  createAuthMiddleware,
  requireRole,
  verifyCsrfProtection,
} from '../middleware/auth.middleware.js';
import {
  listOpsOrders,
  getOpsOrderById,
  updateOrderFulfillment,
  confirmOrderPayment,
} from '../services/ops.service.js';

export interface OpsRoutesOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}

export async function opsRoutes(app: FastifyInstance, opts: OpsRoutesOptions = {}) {
  const db = opts.db || getDb();
  const requireAuth = createAuthMiddleware(db);

  // Hook global a nivel de plugin para requerir autenticación en todas las rutas operativas
  app.addHook('preHandler', requireAuth);

  // 1. GET /api/ops/orders (Listado general de comandas con filtros)
  app.get<{
    Querystring: {
      fulfillmentStatus?: string;
      paymentStatus?: string;
      tableId?: string;
    };
  }>(
    '/orders',
    {
      preHandler: [
        requireRole([UserRole.ADMIN, UserRole.CASHIER, UserRole.KITCHEN]),
      ],
    },
    async (request, reply) => {
      const { fulfillmentStatus, paymentStatus, tableId } = request.query;

      const validFulfillment = Object.values(FulfillmentStatus).includes(
        fulfillmentStatus as FulfillmentStatus
      )
        ? (fulfillmentStatus as FulfillmentStatus)
        : undefined;

      const validPayment = Object.values(PaymentStatus).includes(
        paymentStatus as PaymentStatus
      )
        ? (paymentStatus as PaymentStatus)
        : undefined;

      const validTableId = tableId ? parseInt(tableId, 10) : undefined;

      const orders = await listOpsOrders(
        {
          fulfillmentStatus: validFulfillment,
          paymentStatus: validPayment,
          tableId: isNaN(validTableId as number) ? undefined : validTableId,
        },
        db
      );

      return reply.code(200).send({ orders });
    }
  );

  // 2. GET /api/ops/orders/:orderId (Detalle de una comanda específica)
  app.get<{ Params: { orderId: string } }>(
    '/orders/:orderId',
    {
      preHandler: [
        requireRole([UserRole.ADMIN, UserRole.CASHIER, UserRole.KITCHEN]),
      ],
    },
    async (request, reply) => {
      const { orderId } = request.params;
      const order = await getOpsOrderById(orderId, db);
      return reply.code(200).send(order);
    }
  );

  // 3. PATCH /api/ops/orders/:orderId/fulfillment (Actualización de preparación en KDS / Cancelación)
  app.patch<{ Params: { orderId: string } }>(
    '/orders/:orderId/fulfillment',
    {
      preHandler: [
        verifyCsrfProtection,
        requireRole([UserRole.ADMIN, UserRole.KITCHEN, UserRole.CASHIER]),
      ],
    },
    async (request, reply) => {
      const { orderId } = request.params;

      const parseResult = UpdateFulfillmentInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        throw new ValidationError('Datos de actualización de preparación inválidos', issues);
      }

      const { status, reason } = parseResult.data;
      const updatedOrder = await updateOrderFulfillment(
        orderId,
        status,
        request.user!,
        {
          reason,
          ipAddress: request.ip,
        },
        db
      );

      return reply.code(200).send(updatedOrder);
    }
  );

  // 4. PATCH /api/ops/orders/:orderId/payment (Confirmación operativa de pago en Caja)
  app.patch<{ Params: { orderId: string } }>(
    '/orders/:orderId/payment',
    {
      preHandler: [
        verifyCsrfProtection,
        requireRole([UserRole.ADMIN, UserRole.CASHIER]),
      ],
    },
    async (request, reply) => {
      const { orderId } = request.params;

      const parseResult = ConfirmPaymentInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        throw new ValidationError('Datos de confirmación de pago inválidos', issues);
      }

      const updatedOrder = await confirmOrderPayment(
        orderId,
        request.user!,
        {
          ipAddress: request.ip,
        },
        db
      );

      return reply.code(200).send(updatedOrder);
    }
  );
}
