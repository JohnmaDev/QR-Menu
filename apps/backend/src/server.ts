import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { buildApp } from './app.js';

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
    await app.listen({ port, host });
    app.log.info(`Server listening at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
