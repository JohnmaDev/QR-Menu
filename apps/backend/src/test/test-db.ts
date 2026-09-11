import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../db/schema.js';
import * as fs from 'fs';
import * as path from 'path';

export async function createTestDb() {
  const client = new PGlite();

  // Leer y ejecutar todas las migraciones SQL en orden secuencial
  const migrationsDir = path.resolve(__dirname, '../db/migrations');
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, 'utf-8');
    await client.exec(sqlContent);
  }

  const db = drizzle(client, { schema });

  return { db, client };
}

