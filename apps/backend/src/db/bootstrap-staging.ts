import crypto from 'crypto';
import dotenv from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { getDb, closeDb } from './index.js';
import { users, tables, categories, products } from './schema.js';
import { hashPassword } from '../services/auth.service.js';
import { UserRole } from '@qr-menu/shared';

dotenv.config();

export interface BootstrapResult {
  adminStatus: 'created' | 'already_exists';
  tablesCount: number;
  categoriesCount: number;
  productsCount: number;
}

export async function runBootstrapStaging(db = getDb()): Promise<BootstrapResult> {
  // 1. Barrera explícita contra ejecución accidental
  if (process.env.STAGING_BOOTSTRAP !== 'true') {
    throw new Error(
      'EJECUCIÓN ABORTADA: Barrera de seguridad activa. Debes definir explícitamente STAGING_BOOTSTRAP=true para autorizar la inicialización.'
    );
  }

  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const adminUsername = (process.env.ADMIN_USERNAME?.trim() || 'admin').toLowerCase();

  // 2. Validación de contraseña
  if (!adminPassword) {
    throw new Error(
      'EJECUCIÓN ABORTADA: La variable de entorno ADMIN_PASSWORD es obligatoria para inicializar el entorno de staging.'
    );
  }

  if (adminPassword.length < 10) {
    throw new Error(
      'EJECUCIÓN ABORTADA: ADMIN_PASSWORD debe tener al menos 10 caracteres por motivos de seguridad.'
    );
  }

  // 3. Verificación de rama Neon (Protección contra producción)
  try {
    const branchRes: any = await db.execute(sql`SELECT current_setting('neon.branch', true) as branch`);
    const activeBranch = branchRes?.[0]?.branch || branchRes?.rows?.[0]?.branch;
    if (activeBranch && (activeBranch === 'production' || activeBranch === 'main')) {
      throw new Error(
        `BLOQUEO DE SEGURIDAD: La base de datos actual corresponde a la rama '${activeBranch}' (Producción). Está estrictamente prohibido ejecutar bootstrap de staging sobre esta rama.`
      );
    }
  } catch (err: any) {
    if (err.message?.includes('BLOQUEO DE SEGURIDAD')) {
      throw err;
    }
    // Ignorar si el setting de Neon no está presente (ej. en PGlite o postgres local)
  }

  console.log('\n🔒 [BOOTSTRAP] Iniciando aprovisionamiento seguro de STAGING...');

  // 4. Comprobar / Crear Usuario ADMIN
  const existingAdmin = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, adminUsername));

  let adminStatus: 'created' | 'already_exists' = 'already_exists';

  if (existingAdmin.length === 0) {
    console.log(`👤 [BOOTSTRAP] Creando usuario ADMIN principal ('${adminUsername}')...`);
    const passwordHash = await hashPassword(adminPassword);

    await db.insert(users).values({
      username: adminUsername,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    });
    adminStatus = 'created';
    console.log(`✅ [BOOTSTRAP] Usuario '${adminUsername}' creado exitosamente con rol ADMIN.`);
  } else {
    console.log(`ℹ️  [BOOTSTRAP] El usuario '${adminUsername}' ya existe en la base de datos. Se conserva sin cambios.`);
  }

  // 3. Crear Mesas con tokens criptográficos si no existen
  console.log('🪑 [BOOTSTRAP] Verificando mesas y barras...');
  const initialTables = [
    { number: 1, name: 'Mesa 1' },
    { number: 2, name: 'Mesa 2' },
    { number: 3, name: 'Mesa 3' },
    { number: 4, name: 'Mesa 4' },
    { number: 5, name: 'Mesa 5' },
    { number: 6, name: 'Barra 1' },
  ];

  let tablesCreated = 0;
  for (const t of initialTables) {
    const existing = await db
      .select({ id: tables.id })
      .from(tables)
      .where(eq(tables.number, t.number));

    if (existing.length === 0) {
      // Token criptográficamente seguro (16 chars hex)
      const secureToken = `t_m${t.number}_${crypto.randomBytes(6).toString('hex')}`;
      await db.insert(tables).values({
        number: t.number,
        name: t.name,
        publicToken: secureToken,
        isActive: true,
      });
      tablesCreated++;
    }
  }
  console.log(`✅ [BOOTSTRAP] Mesas verificadas (${tablesCreated} nuevas creadas).`);

  // 4. Crear Categorías iniciales del bar
  console.log('🏷️  [BOOTSTRAP] Verificando categorías del catálogo...');
  const initialCategories = [
    { id: 1, name: 'Cervezas', icon: 'beer', sortOrder: 1, isActive: true },
    { id: 2, name: 'Licores', icon: 'wine', sortOrder: 2, isActive: true },
    { id: 3, name: 'Granizados', icon: 'snowflake', sortOrder: 3, isActive: true },
    { id: 4, name: 'Gaseosas y Sodas', icon: 'cup-soda', sortOrder: 4, isActive: true },
    { id: 5, name: 'Snacks', icon: 'popcorn', sortOrder: 5, isActive: true },
  ];

  await db.insert(categories).values(initialCategories).onConflictDoNothing();
  console.log('✅ [BOOTSTRAP] Categorías aseguradas.');

  // 5. Crear Catálogo de productos para el MVP
  console.log('🍺 [BOOTSTRAP] Verificando productos del catálogo...');
  const initialProducts = [
    // Cervezas
    { id: 1, categoryId: 1, name: 'Pilsen 330ml', description: 'Lata bien fría', price: '5000.00', isAvailable: true, sortOrder: 1 },
    { id: 2, categoryId: 1, name: 'Águila 330ml', description: 'Lata bien fría', price: '5000.00', isAvailable: true, sortOrder: 2 },
    { id: 3, categoryId: 1, name: 'Poker 330ml', description: 'Lata bien fría', price: '5000.00', isAvailable: true, sortOrder: 3 },
    { id: 4, categoryId: 1, name: 'Cuates 330ml', description: 'Cerveza michelada', price: '4000.00', isAvailable: true, sortOrder: 4 },
    // Licores
    { id: 5, categoryId: 2, name: 'Media Aguardiente Antioqueño', description: '375ml Tapa Azul', price: '45000.00', isAvailable: true, sortOrder: 1 },
    { id: 6, categoryId: 2, name: 'Botella Aguardiente Antioqueño', description: '750ml Tapa Azul', price: '80000.00', isAvailable: true, sortOrder: 2 },
    { id: 7, categoryId: 2, name: 'Media Ron de Caldas', description: '375ml Tradicional', price: '50000.00', isAvailable: true, sortOrder: 3 },
    { id: 8, categoryId: 2, name: 'Botella Ron de Caldas', description: '750ml Tradicional', price: '90000.00', isAvailable: true, sortOrder: 4 },
    // Granizados
    { id: 9, categoryId: 3, name: 'Granizado de Frutos Rojos', description: 'Sin licor, 16oz', price: '12000.00', isAvailable: true, sortOrder: 1 },
    { id: 10, categoryId: 3, name: 'Granizado con Vodka / Ron', description: 'Con licor a elección, 16oz', price: '18000.00', isAvailable: true, sortOrder: 2 },
    // Gaseosas y Sodas
    { id: 11, categoryId: 4, name: 'Postobón Manzana 400ml', description: 'Botella PET fría', price: '4000.00', isAvailable: true, sortOrder: 1 },
    { id: 12, categoryId: 4, name: 'Soda Canada Dry 300ml', description: 'Lata fría', price: '4500.00', isAvailable: true, sortOrder: 2 },
    { id: 13, categoryId: 4, name: 'Agua Cristal 500ml', description: 'Con o sin gas', price: '3500.00', isAvailable: true, sortOrder: 3 },
    // Snacks
    { id: 14, categoryId: 5, name: 'Papas Lays Clásicas', description: 'Paquete mediano', price: '3500.00', isAvailable: true, sortOrder: 1 },
    { id: 15, categoryId: 5, name: 'De Todito Natural', description: 'Paquete mediano', price: '4500.00', isAvailable: true, sortOrder: 2 },
  ];

  await db.insert(products).values(initialProducts).onConflictDoNothing();
  console.log('✅ [BOOTSTRAP] Catálogo de productos asegurado.');

  console.log('🎉 [BOOTSTRAP] Proceso de inicialización completado con éxito.\n');

  return {
    adminStatus,
    tablesCount: initialTables.length,
    categoriesCount: initialCategories.length,
    productsCount: initialProducts.length,
  };
}

if (process.argv[1]?.endsWith('bootstrap-staging.ts') || process.argv[1]?.endsWith('bootstrap-staging.js')) {
  runBootstrapStaging()
    .then(async (res) => {
      console.log('Resultado del bootstrap:', res);
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Error crítico en bootstrap de staging:', err.message || err);
      await closeDb();
      process.exit(1);
    });
}
