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
  
  // Localizar directorio de migraciones tanto en desarrollo (src) como en producción (dist)
  let migrationsDir = path.resolve(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    const candidates = [
      path.resolve(__dirname, '../../src/db/migrations'),
      path.resolve(__dirname, '../src/db/migrations'),
      path.resolve(process.cwd(), 'src/db/migrations'),
      path.resolve(process.cwd(), 'apps/backend/src/db/migrations'),
      path.resolve(process.cwd(), 'apps/backend/dist/db/migrations'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        migrationsDir = c;
        break;
      }
    }
  }

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

    // Si la tabla de migraciones está vacía pero las tablas de negocio ya existen (ej. base creada anteriormente),
    // registramos las migraciones base correspondientes para no colisionar.
    if (existingNames.size === 0) {
      try {
        const tableCheck = await pglite.query<{ count: string }>(
          "SELECT count(*)::text as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders'"
        );
        if (Number(tableCheck.rows[0]?.count) > 0) {
          console.log('ℹ️ [MIGRATE] Base de datos existente detectada en PGlite. Auto-sincronizando historial...');
          await pglite.query("INSERT INTO \"__app_migrations\" (name) VALUES ('0000_bumpy_zaladane.sql') ON CONFLICT DO NOTHING");
          existingNames.add('0000_bumpy_zaladane.sql');

          const userCheck = await pglite.query<{ count: string }>(
            "SELECT count(*)::text as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
          );
          if (Number(userCheck.rows[0]?.count) > 0) {
            await pglite.query("INSERT INTO \"__app_migrations\" (name) VALUES ('0001_ancient_luminals.sql') ON CONFLICT DO NOTHING");
            existingNames.add('0001_ancient_luminals.sql');
          }

          const tokenCol = await pglite.query<{ count: string }>(
            "SELECT count(*)::text as count FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'session_token_hash'"
          );
          if (Number(tokenCol.rows[0]?.count) > 0) {
            await pglite.query("INSERT INTO \"__app_migrations\" (name) VALUES ('0002_add_session_token_hash.sql') ON CONFLICT DO NOTHING");
            existingNames.add('0002_add_session_token_hash.sql');
          }

          const custCol = await pglite.query<{ count: string }>(
            "SELECT count(*)::text as count FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_name'"
          );
          if (Number(custCol.rows[0]?.count) > 0) {
            await pglite.query("INSERT INTO \"__app_migrations\" (name) VALUES ('0003_add_customer_name_and_payment_methods.sql') ON CONFLICT DO NOTHING");
            existingNames.add('0003_add_customer_name_and_payment_methods.sql');
          }

          const dailyCol = await pglite.query<{ count: string }>(
            "SELECT count(*)::text as count FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'daily_order_number'"
          );
          if (Number(dailyCol.rows[0]?.count) > 0) {
            await pglite.query("INSERT INTO \"__app_migrations\" (name) VALUES ('0004_daily_orders_and_sequences.sql') ON CONFLICT DO NOTHING");
            existingNames.add('0004_daily_orders_and_sequences.sql');
          }
        }
      } catch {
        // Ignorar si information_schema no está disponible
      }
    }

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
    const requiresSsl =
      process.env.DATABASE_SSL !== undefined
        ? process.env.DATABASE_SSL === 'true'
        : connStr.includes('sslmode=require') ||
          connStr.includes('.neon.tech') ||
          process.env.NODE_ENV === 'production';

    const sql = postgres(connStr, {
      max: 1,
      ssl: requiresSsl ? 'require' : undefined,
    });
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

      // Si __app_migrations está vacía pero las tablas de negocio ya existen (ej. creadas previamente en Neon),
      // auto-detectar histórico para no recrear tablas ni tipos existentes
      if (existingNames.size === 0) {
        try {
          const tableCheck = await sql<{ count: string }[]>`
            SELECT count(*)::text as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'orders'
          `;
          if (Number(tableCheck[0]?.count) > 0) {
            console.log('ℹ️ [MIGRATE] Tablas base detectadas en PostgreSQL. Verificando estado histórico...');
            await sql`INSERT INTO "__app_migrations" (name) VALUES ('0000_bumpy_zaladane.sql') ON CONFLICT DO NOTHING`;
            existingNames.add('0000_bumpy_zaladane.sql');

            const userCheck = await sql<{ count: string }[]>`
              SELECT count(*)::text as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'
            `;
            if (Number(userCheck[0]?.count) > 0) {
              await sql`INSERT INTO "__app_migrations" (name) VALUES ('0001_ancient_luminals.sql') ON CONFLICT DO NOTHING`;
              existingNames.add('0001_ancient_luminals.sql');
            }

            const tokenColCheck = await sql<{ count: string }[]>`
              SELECT count(*)::text as count FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'session_token_hash'
            `;
            if (Number(tokenColCheck[0]?.count) > 0) {
              await sql`INSERT INTO "__app_migrations" (name) VALUES ('0002_add_session_token_hash.sql') ON CONFLICT DO NOTHING`;
              existingNames.add('0002_add_session_token_hash.sql');
            }

            const custColCheck = await sql<{ count: string }[]>`
              SELECT count(*)::text as count FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_name'
            `;
            if (Number(custColCheck[0]?.count) > 0) {
              await sql`INSERT INTO "__app_migrations" (name) VALUES ('0003_add_customer_name_and_payment_methods.sql') ON CONFLICT DO NOTHING`;
              existingNames.add('0003_add_customer_name_and_payment_methods.sql');
            }

            const dailyColCheck = await sql<{ count: string }[]>`
              SELECT count(*)::text as count FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'daily_order_number'
            `;
            if (Number(dailyColCheck[0]?.count) > 0) {
              await sql`INSERT INTO "__app_migrations" (name) VALUES ('0004_daily_orders_and_sequences.sql') ON CONFLICT DO NOTHING`;
              existingNames.add('0004_daily_orders_and_sequences.sql');
            }
          }
        } catch {
          // Ignorar si information_schema no está accesible
        }
      }

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
