import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema.js';
import * as path from 'path';
import * as fs from 'fs';

let postgresClient: ReturnType<typeof postgres> | null = null;
let pgliteClient: PGlite | null = null;
let dbInstance: ReturnType<typeof drizzlePostgres<typeof schema>> | null = null;

function getResolvedPgDataDir(dirPath: string): string {
  if (path.isAbsolute(dirPath)) return dirPath;
  let current = process.cwd();
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'package.json'))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(current, 'package.json'), 'utf8'));
        if (pkg.workspaces) {
          return path.resolve(current, dirPath);
        }
      } catch {
        // ignore
      }
    }
    current = path.dirname(current);
  }
  return path.resolve(process.cwd(), dirPath);
}

export function getDb(connectionString?: string) {
  if (dbInstance) {
    return dbInstance;
  }

  const connStr =
    connectionString ||
    process.env.DATABASE_URL ||
    'pglite://.pgdata';

  if (connStr.startsWith('pglite://') || process.env.DATABASE_DRIVER === 'pglite') {
    const rawPath = connStr.replace(/^pglite:\/\//, '') || '.pgdata';
    const resolvedPath = getResolvedPgDataDir(rawPath);
    pgliteClient = new PGlite(resolvedPath);
    dbInstance = drizzlePglite(pgliteClient, { schema }) as unknown as ReturnType<
      typeof drizzlePostgres<typeof schema>
    >;
    return dbInstance;
  }

  const requiresSsl =
    process.env.DATABASE_SSL !== undefined
      ? process.env.DATABASE_SSL === 'true'
      : connStr.includes('sslmode=require') ||
        connStr.includes('.neon.tech') ||
        process.env.NODE_ENV === 'production';

  postgresClient = postgres(connStr, {
    max: process.env.NODE_ENV === 'production' ? 10 : 3,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: requiresSsl ? 'require' : false,
  });

  dbInstance = drizzlePostgres(postgresClient, { schema });
  return dbInstance;
}

export function getPgliteClient(): PGlite | null {
  return pgliteClient;
}

export function getPostgresClient(): ReturnType<typeof postgres> | null {
  return postgresClient;
}

export async function closeDb(): Promise<void> {
  if (postgresClient) {
    await postgresClient.end({ timeout: 5 });
    postgresClient = null;
  }
  if (pgliteClient) {
    await pgliteClient.close();
    pgliteClient = null;
  }
  dbInstance = null;
}

export async function checkDbConnection(connectionString?: string): Promise<boolean> {
  try {
    const db = getDb(connectionString);
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export { schema };

