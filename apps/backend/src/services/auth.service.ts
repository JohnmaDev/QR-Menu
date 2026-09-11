import crypto from 'crypto';
import * as argon2 from 'argon2';
import { eq, and, gt, lte } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users, sessions, auditLogs } from '../db/schema.js';
import { UserRole } from '@qr-menu/shared';
import {
  InvalidCredentialsError,
  UserInactiveError,
  UnauthorizedError,
} from '../errors.js';

// Hash Argon2id precalculado para verificación simulada cuando el usuario no existe (mitigación de timing attack)
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRmb3JkdW1teQ$uG2+7+wQG8Fw6p8G3m/hT7z8Vw8u6b2w6p8G3m/hT7w';

export async function hashPassword(plainPassword: string): Promise<string> {
  return await argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(
  hash: string,
  plainPassword: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainPassword);
  } catch {
    return false;
  }
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
}

export async function authenticateCredentials(
  usernameInput: string,
  passwordInput: string,
  db = getDb()
): Promise<AuthenticatedUser> {
  const normalizedUsername = usernameInput.trim().toLowerCase();

  const userRecords = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.username, normalizedUsername));

  if (userRecords.length === 0) {
    // Timing mitigation: verificar dummy hash para que el tiempo de cómputo sea equivalente
    await verifyPassword(DUMMY_HASH, passwordInput);
    throw new InvalidCredentialsError();
  }

  const user = userRecords[0];

  const isValidPassword = await verifyPassword(user.passwordHash, passwordInput);
  if (!isValidPassword || !user.isActive) {
    throw new InvalidCredentialsError();
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role as UserRole,
    isActive: user.isActive,
  };
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export interface CreateSessionOptions {
  userAgent?: string;
  ipAddress?: string;
  ttlHours?: number;
}

export async function createSession(
  userId: string,
  opts: CreateSessionOptions = {},
  db = getDb()
): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const ttl = opts.ttlHours ?? 24;
  const expiresAt = new Date(Date.now() + ttl * 3600 * 1000);

  await db.insert(sessions).values({
    tokenHash,
    userId,
    expiresAt,
    userAgent: opts.userAgent?.substring(0, 255) || null,
    ipAddress: opts.ipAddress?.substring(0, 45) || null,
  });

  return rawToken;
}

export async function validateSession(
  rawToken: string,
  db = getDb()
): Promise<{ user: AuthenticatedUser; sessionTokenHash: string }> {
  if (!rawToken || rawToken.trim().length === 0) {
    throw new UnauthorizedError();
  }

  const tokenHash = hashSessionToken(rawToken);
  const now = new Date();

  const sessionResults = await db
    .select({
      tokenHash: sessions.tokenHash,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      username: users.username,
      role: users.role,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)));

  if (sessionResults.length === 0) {
    throw new UnauthorizedError('Sesión inválida o expirada');
  }

  const record = sessionResults[0];

  if (!record.isActive) {
    // Si el usuario fue desactivado, destruir la sesión
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    throw new UserInactiveError();
  }

  return {
    user: {
      id: record.userId,
      username: record.username,
      role: record.role as UserRole,
      isActive: record.isActive,
    },
    sessionTokenHash: record.tokenHash,
  };
}

export async function revokeSession(
  rawToken: string,
  db = getDb()
): Promise<void> {
  const tokenHash = hashSessionToken(rawToken);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function cleanupExpiredSessions(db = getDb()): Promise<void> {
  const now = new Date();
  await db.delete(sessions).where(lte(sessions.expiresAt, now));
}

export interface AuditLogPayload {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

const SENSITIVE_AUDIT_KEYS = new Set([
  'password',
  'passwordhash',
  'cookie',
  'token',
  'authorization',
  'session',
  'secret',
  'apikey',
]);

export function sanitizeAuditMetadata(
  data: unknown,
  seen = new WeakSet<object>()
): unknown {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  if (seen.has(data)) {
    return '[Circular]';
  }
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditMetadata(item, seen));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_AUDIT_KEYS.has(key.toLowerCase())) {
      continue; // Omitir claves sensibles
    }
    sanitized[key] = sanitizeAuditMetadata(value, seen);
  }

  return sanitized;
}

export async function recordAuditLog(
  payload: AuditLogPayload,
  db = getDb()
): Promise<void> {
  const sanitizedMetadata = payload.metadata
    ? (sanitizeAuditMetadata(payload.metadata) as Record<string, unknown>)
    : {};

  await db.insert(auditLogs).values({
    userId: payload.userId || null,
    action: payload.action,
    entityType: payload.entityType,
    entityId: payload.entityId,
    metadata: sanitizedMetadata,
    ipAddress: payload.ipAddress || null,
  });
}

