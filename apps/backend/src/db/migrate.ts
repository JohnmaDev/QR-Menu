import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb, getPgliteClient } from './index.js';
import postgres from 'postgres';

// Ensure environment is loaded
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  const connStr = process.env.DATABASE_URL || 'pglite://.pgdata';
  const migrationsDir = path.resolve(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Directorio de migraciones no encontrado: ${migrationsDir}`);
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const isPgLite = connStr.startsWith('pglite://') || process.env.DATABASE_DRIVER === 'pglite';
  console.log(`\n🚀 [MIGRATE] Iniciando migraciones sobre: ${isPgLite ? 'PGlite (almacenamiento local)' : 'PostgreSQL'}`);

  const applied: string[] = [];
  const skipped: string[] = [];

  if (isPgLite) {
    // Inicializar getDb() para arrancar la instancia PGlite
    getDb(connStr);
    const pglite = getPgliteClient();
    if (!pglite) {
      throw new Error('Error fatal: PGlite client no pudo ser inicializado');
    }

    // Crear tabla de tracking si no existe
    await pglite.exec(`
      CREATE TABLE IF NOT EXISTS "__app_migrations" (
        "id" serial PRIMARY KEY,
        "name" varchar(255) NOT NULL UNIQUE,
        "applied_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    const existingRes = await pglite.query<{ name: string }>('SELECT name FROM "__app_migrations"');
    const existingNames = new Set(existingRes.rows.map((r) => r.name));

    for (const file of migrationFiles) {
      if (existingNames.has(file)) {
        console.log(`⏩ [MIGRATE] Migración ya aplicada: ${file}`);
        skipped.push(file);
        continue;
      }

      console.log(`▶️  [MIGRATE] Aplicando migración: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');
      await pglite.exec(sqlContent);
      await pglite.query('INSERT INTO "__app_migrations" (name) VALUES ($1)', [file]);
      console.log(`✅ [MIGRATE] Migración aplicada exitosamente: ${file}`);
      applied.push(file);
    }
  } else {
    const sql = postgres(connStr, { max: 1 });
    try {
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS "__app_migrations" (
          "id" serial PRIMARY KEY,
          "name" varchar(255) NOT NULL UNIQUE,
          "applied_at" timestamp with time zone DEFAULT now() NOT NULL
        );
      `);

      const existingRows = await sql<{ name: string }[]>`SELECT name FROM "__app_migrations"`;
      const existingNames = new Set(existingRows.map((r) => r.name));

      for (const file of migrationFiles) {
        if (existingNames.has(file)) {
          console.log(`⏩ [MIGRATE] Migración ya aplicada: ${file}`);
          skipped.push(file);
          continue;
        }

        console.log(`▶️  [MIGRATE] Aplicando migración: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sqlContent = fs.readFileSync(filePath, 'utf-8');
        await sql.unsafe(sqlContent);
        await sql`INSERT INTO "__app_migrations" (name) VALUES (${file})`;
        console.log(`✅ [MIGRATE] Migración aplicada exitosamente: ${file}`);
        applied.push(file);
      }
    } finally {
      await sql.end({ timeout: 5 });
    }
  }

  console.log(`\n🎉 [MIGRATE] Proceso completado: ${applied.length} aplicadas, ${skipped.length} omitidas (ya existentes).\n`);
  return { applied, skipped };
}

if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ [MIGRATE] Error crítico al ejecutar migraciones:', err);
      await closeDb();
      process.exit(1);
    });
}
