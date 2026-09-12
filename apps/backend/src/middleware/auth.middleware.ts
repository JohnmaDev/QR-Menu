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

// Orígenes oficiales del proyecto en Vercel
const DEFAULT_ALLOWED_ORIGINS = [
  'https://qr-menu-frontend-zeta.vercel.app',
];

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Peticiones server-to-server o herramientas CLI
  const normalized = origin.trim().replace(/\/+$/, '');
  const rawCorsOrigin = process.env.CORS_ORIGIN?.trim();

  // 1. Origen explícito en DEFAULT_ALLOWED_ORIGINS o previsualizaciones Vercel del proyecto qr-menu-frontend
  if (
    DEFAULT_ALLOWED_ORIGINS.includes(normalized) ||
    /^https:\/\/qr-menu-frontend.*\.vercel\.app$/.test(normalized)
  ) {
    return true;
  }

  // 2. Si se definieron orígenes explícitos en CORS_ORIGIN, verificarlos
  if (rawCorsOrigin && rawCorsOrigin !== '*') {
    const allowedOrigins = rawCorsOrigin
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    if (allowedOrigins.includes(normalized)) {
      return true;
    }
  }

  // 3. Si CORS_ORIGIN tiene comodín explícito '*'
  if (rawCorsOrigin === '*') {
    return true;
  }

  // 4. En entorno local / desarrollo / tests, permitir localhost y 127.0.0.1
  if (
    normalized.startsWith('http://localhost:') ||
    normalized === 'http://localhost' ||
    normalized.startsWith('http://127.0.0.1:') ||
    normalized === 'http://127.0.0.1'
  ) {
    return true;
  }

  // 5. Denegar cualquier otro origen desconocido
  return false;
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

  const origin = request.headers['origin'];
  const referer = request.headers['referer'];

  // 1. Validar encabezado Origin si está presente
  if (origin) {
    if (!isOriginAllowed(String(origin))) {
      throw new CsrfError(`Origen no autorizado: '${origin}'`);
    }
  } else if (referer) {
    // 2. Si Origin está ausente, validar origen extraído del Referer
    try {
      const refererOrigin = new URL(String(referer)).origin;
      if (!isOriginAllowed(refererOrigin)) {
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
