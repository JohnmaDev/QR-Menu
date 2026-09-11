import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateOrderInputSchema } from '@qr-menu/shared';
import { getPublicMenu } from '../services/menu.service.js';
import { createOrder, getOrderStatus } from '../services/order.service.js';
import { getDb } from '../db/index.js';
import {
  IdempotencyMissingError,
  ValidationError,
} from '../errors.js';

export interface PublicRoutesOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}

export async function publicRoutes(app: FastifyInstance, opts: PublicRoutesOptions = {}) {
  const db = opts.db || getDb();

  // 1. GET /api/menu
  app.get('/menu', async (request: FastifyRequest, reply: FastifyReply) => {
    const { menu, etag } = await getPublicMenu(db);

    const clientEtag = request.headers['if-none-match'];
    if (clientEtag && clientEtag === etag) {
      return reply.code(304).send();
    }

    reply.header('ETag', etag);
    if (process.env.NODE_ENV === 'test') {
      reply.header('Cache-Control', 'public, no-cache');
    } else {
      reply.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    }
    return reply.code(200).send(menu);
  });

  // 2. POST /api/orders
  app.post(
    '/orders',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Validar presencia y formato de X-Idempotency-Key
      const idempotencyKey = request.headers['x-idempotency-key'];
      if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        throw new IdempotencyMissingError();
      }

      const trimmedKey = idempotencyKey.trim();
      if (trimmedKey.length < 6 || trimmedKey.length > 64) {
        throw new ValidationError(
          'La clave de idempotencia debe tener entre 6 y 64 caracteres'
        );
      }

      // Validar estructura del cuerpo con Zod
      const parseResult = CreateOrderInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        throw new ValidationError('Datos del pedido inválidos', issues);
      }

      const createdOrder = await createOrder(parseResult.data, trimmedKey, db);
      return reply.code(201).send(createdOrder);
    }
  );

  // 3. GET /api/orders/:publicCode/status
  app.get(
    '/orders/:publicCode/status',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { publicCode: string } }>,
      reply: FastifyReply
    ) => {
      const { publicCode } = request.params;
      if (!publicCode || publicCode.trim().length === 0) {
        throw new ValidationError('Código de pedido no especificado');
      }

      const status = await getOrderStatus(publicCode.trim(), db);
      return reply.code(200).send(status);
    }
  );
}
