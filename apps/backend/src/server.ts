import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { buildApp } from './app.js';
import { runMigrations } from './db/migrate.js';

// Buscar .env en cwd o en raíz del monorepo
const rootEnv = path.resolve(process.cwd(), '.env');
const parentEnv = path.resolve(process.cwd(), '../../.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else if (fs.existsSync(parentEnv)) {
  dotenv.config({ path: parentEnv });
} else {
  dotenv.config();
}

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

const app = buildApp();

async function start() {
  try {
    // 1. Ejecutar migraciones pendientes automáticamente antes de atender tráfico
    try {
      app.log.info('Comprobando y ejecutando migraciones pendientes en base de datos...');
      const migRes = await runMigrations();
      app.log.info(`Migraciones finalizadas con éxito: ${migRes.applied.length} aplicadas, ${migRes.skipped.length} omitidas.`);
    } catch (migErr) {
      app.log.error(migErr, 'Fallo durante la ejecución de migraciones automáticas de inicio');
      if (process.env.NODE_ENV === 'production' && !process.env.IGNORE_MIGRATION_ERRORS) {
        throw migErr;
      }
    }

    // 2. Iniciar escucha en puerto
    await app.listen({ port, host });
    app.log.info(`Server listening at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
