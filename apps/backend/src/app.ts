import fastify, { FastifyInstance, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { publicRoutes } from './routes/public.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { opsRoutes } from './routes/ops.routes.js';
import { AppError } from './errors.js';
import { ApiErrorCode } from '@qr-menu/shared';

export interface AppOptions {
  logger?: boolean | object;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}

export function buildApp(opts: AppOptions = {}): FastifyInstance {
  // Configuración segura de proxy inverso (SEC-04):
  // Si TRUST_PROXY='true' o contiene IPs/subredes, Fastify confía en los encabezados X-Forwarded-For.
  // Por defecto se mantiene en false para evitar falsificación de IPs (IP spoofing) si no hay reverse proxy.
  const trustProxyEnv = process.env.TRUST_PROXY;
  const trustProxy =
    trustProxyEnv === 'true'
      ? true
      : trustProxyEnv === 'false'
      ? false
      : trustProxyEnv
      ? trustProxyEnv.split(',').map((s) => s.trim())
      : false;

  const app = fastify({
    trustProxy,
    logger: opts.logger !== undefined ? opts.logger : (process.env.NODE_ENV === 'test' ? false : {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    }),
  });

  // Security Headers
  app.register(helmet, {
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
  });

  // Strict CORS
  app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Idempotency-Key', 'If-None-Match', 'X-Requested-With'],
  });

  // Cookies (SEC-03: Exigir SESSION_SECRET robusto en producción)
  const sessionSecret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!sessionSecret || sessionSecret.trim().length < 32) {
      throw new Error(
        'ERROR DE SEGURIDAD (SEC-03): La variable de entorno SESSION_SECRET es obligatoria en producción y debe contener al menos 32 caracteres.'
      );
    }
  }

  app.register(cookie, {
    secret: sessionSecret || 'temporary_dev_cookie_secret_minimum_32_chars!',
  });

  // Rate Limiting
  app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  // Healthcheck endpoint
  app.get('/healthz', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Register Routes
  app.register(publicRoutes, { prefix: '/api', db: opts.db });
  app.register(authRoutes, { prefix: '/api', db: opts.db });
  app.register(opsRoutes, { prefix: '/api/ops', db: opts.db });

  // Standardized Centralized Error Handler
  app.setErrorHandler((error: FastifyError | AppError | Error, request, reply) => {
    const timestamp = new Date().toISOString();

    // 1. Manejo de AppError (Errores de dominio controlados)
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          details: error.details,
          timestamp,
        },
      });
    }

    const fastifyErr = error as FastifyError;

    // 2. Manejo de errores de validación de Fastify / Zod
    if (fastifyErr.validation) {
      return reply.code(400).send({
        error: {
          code: ApiErrorCode.VALIDATION_ERROR,
          message: fastifyErr.message || 'Datos de entrada inválidos',
          statusCode: 400,
          details: fastifyErr.validation,
          timestamp,
        },
      });
    }

    // 3. Manejo de Rate Limit excedido
    if (fastifyErr.statusCode === 429) {
      return reply.code(429).send({
        error: {
          code: ApiErrorCode.RATE_LIMIT_EXCEEDED,
          message: 'Límite de solicitudes excedido. Intenta de nuevo más tarde.',
          statusCode: 429,
          timestamp,
        },
      });
    }

    // 4. Errores no controlados (500) - Sanitizados sin filtrar stack traces ni SQL
    request.log.error(error);
    const statusCode = fastifyErr.statusCode || 500;
    return reply.code(statusCode).send({
      error: {
        code: ApiErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Ocurrió un error inesperado en el servidor',
        statusCode,
        timestamp,
      },
    });
  });

  return app;
}

