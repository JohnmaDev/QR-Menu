import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LoginInputSchema } from '@qr-menu/shared';
import { getDb } from '../db/index.js';
import { ValidationError } from '../errors.js';
import {
  authenticateCredentials,
  createSession,
  revokeSession,
  recordAuditLog,
} from '../services/auth.service.js';
import {
  createAuthMiddleware,
  SESSION_COOKIE_NAME,
} from '../middleware/auth.middleware.js';

export interface AuthRoutesOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}

export async function authRoutes(app: FastifyInstance, opts: AuthRoutesOptions = {}) {
  const db = opts.db || getDb();
  const requireAuth = createAuthMiddleware(db);

  // 1. POST /api/auth/login (Protegido por Rate Limit estricto contra fuerza bruta)
  app.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = LoginInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        throw new ValidationError('Credenciales con formato inválido', issues);
      }

      const { username, password } = parseResult.data;
      const user = await authenticateCredentials(username, password, db);

      const userAgent = request.headers['user-agent'];
      const ipAddress = request.ip;

      const sessionId = await createSession(
        user.id,
        {
          userAgent,
          ipAddress,
          ttlHours: 24,
        },
        db
      );

      // Registrar auditoría de inicio de sesión
      await recordAuditLog(
        {
          userId: user.id,
          action: 'USER_LOGIN',
          entityType: 'USER',
          entityId: user.id,
          metadata: { username: user.username, role: user.role },
          ipAddress,
        },
        db
      );

      reply.setCookie(SESSION_COOKIE_NAME, sessionId, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        signed: true,
        maxAge: 24 * 3600, // 24 horas
      });

      return reply.code(200).send({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
    }
  );

  // 2. POST /api/auth/logout
  app.post(
    '/auth/logout',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const rawCookie = request.cookies[SESSION_COOKIE_NAME];
      if (rawCookie) {
        const unsigned = request.unsignCookie(rawCookie);
        if (unsigned.valid && unsigned.value) {
          await revokeSession(unsigned.value, db);
        }
      }

      reply.clearCookie(SESSION_COOKIE_NAME, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      return reply.code(200).send({ status: 'logged_out' });
    }
  );

  // 3. GET /api/auth/me (Verifica sesión actual y retorna datos del usuario)
  app.get(
    '/auth/me',
    {
      preHandler: [requireAuth],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user!;
      return reply.code(200).send({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
    }
  );
}
