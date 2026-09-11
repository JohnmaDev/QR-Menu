import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@qr-menu/shared';
import { UnauthorizedError, ForbiddenError, CsrfError } from '../errors.js';
import { validateSession, AuthenticatedUser } from '../services/auth.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    sessionId?: string;
  }
}

export const SESSION_COOKIE_NAME = 'qr_session';

export function createAuthMiddleware(dbInstance?: any) {
  return async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
    const rawCookie = request.cookies[SESSION_COOKIE_NAME];
    if (!rawCookie) {
      throw new UnauthorizedError('No se encontró ninguna sesión activa');
    }

    const unsigned = request.unsignCookie(rawCookie);
    if (!unsigned.valid || !unsigned.value) {
      throw new UnauthorizedError('Cookie de sesión inválida o alterada');
    }

    const sessionData = await validateSession(unsigned.value, dbInstance);
    request.user = sessionData.user;
    request.sessionId = sessionData.sessionTokenHash;
  };
}

export function requireRole(allowedRoles: UserRole[]) {
  return async function roleGuard(request: FastifyRequest, _reply: FastifyReply) {
    if (!request.user) {
      throw new UnauthorizedError();
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError(
        `Rol '${request.user.role}' no tiene permisos para esta operación`
      );
    }
  };
}

export async function verifyCsrfProtection(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  // Solo se aplica a mutaciones que utilizan cookies
  const mutatingMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];
  if (!mutatingMethods.includes(request.method)) {
    return;
  }

  const expectedOrigin = (process.env.CORS_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');
  const origin = request.headers['origin'];
  const referer = request.headers['referer'];

  // 1. Validar encabezado Origin si está presente
  if (origin) {
    const normalizedOrigin = String(origin).replace(/\/+$/, '');
    if (normalizedOrigin !== expectedOrigin) {
      throw new CsrfError(`Origen no autorizado: '${origin}'`);
    }
  } else if (referer) {
    // 2. Si Origin está ausente, validar origen extraído del Referer
    try {
      const refererOrigin = new URL(String(referer)).origin.replace(/\/+$/, '');
      if (refererOrigin !== expectedOrigin) {
        throw new CsrfError(`Referer no autorizado: '${referer}'`);
      }
    } catch {
      throw new CsrfError('Encabezado Referer con formato inválido');
    }
  }

  // 3. Exigir encabezado no simple (Content-Type application/json o X-Requested-With)
  const contentType = request.headers['content-type'];
  const requestedWith = request.headers['x-requested-with'];

  const isJson = contentType && contentType.toLowerCase().includes('application/json');
  const hasCustomHeader = Boolean(requestedWith);

  if (!isJson && !hasCustomHeader) {
    throw new CsrfError('Petición mutante debe incluir Content-Type application/json o X-Requested-With');
  }
}
