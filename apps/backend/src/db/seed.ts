import dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import { getDb, closeDb } from './index.js';
import { users, tables, categories, products } from './schema.js';

dotenv.config();

// ==============================================================================
// ADVERTENCIA DE SEGURIDAD (SEC-02):
// Las siguientes credenciales ('Admin123!') y datos de semilla son EXCLUSIVOS
// para entornos de desarrollo local y testing.
// NUNCA deben ejecutarse en entornos de producción ni desplegarse públicamente.
// ==============================================================================

export async function runSeed(db = getDb()) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'EJECUCIÓN ABORTADA: No está permitido ejecutar seed de desarrollo en entorno de producción.'
    );
  }

  // Inserción de usuarios iniciales con hash Argon2id de 'Admin123!' (SOLO DESARROLLO)
  const defaultPasswordHash =
    '$argon2id$v=19$m=65536,p=4,t=3$duxg8MPkIvhQ121BT/GetQ$ZvdMGGbaw1AO6jSpcXXnQm6H261EsIB5OIM5erRYUtI';

  await db.insert(users).values([
    {
      username: 'admin',
      passwordHash: defaultPasswordHash,
      role: 'ADMIN',
      isActive: true,
    },
    {
      username: 'caja',
      passwordHash: defaultPasswordHash,
      role: 'CASHIER',
      isActive: true,
    },
  ]).onConflictDoNothing();

  // Inserción de mesas con tokens criptográficos unguessable
  await db.insert(tables).values([
    { number: 1, name: 'Mesa 1', publicToken: 't_m1_7k9x2m', isActive: true },
    { number: 2, name: 'Mesa 2', publicToken: 't_m2_4p8x1y', isActive: true },
    { number: 3, name: 'Mesa 3', publicToken: 't_m3_9a2b5c', isActive: true },
    { number: 4, name: 'Mesa 4', publicToken: 't_m4_3e6f8g', isActive: true },
    { number: 5, name: 'Mesa 5', publicToken: 't_m5_5h7j1k', isActive: true },
    { number: 6, name: 'Barra 1', publicToken: 't_b1_2l4n6p', isActive: true },
  ]).onConflictDoNothing();

  // Inserción de categorías del bar
  await db.insert(categories).values([
    { id: 1, name: 'Cervezas', icon: 'beer', sortOrder: 1, isActive: true },
    { id: 2, name: 'Licores', icon: 'wine', sortOrder: 2, isActive: true },
    { id: 3, name: 'Granizados', icon: 'snowflake', sortOrder: 3, isActive: true },
    { id: 4, name: 'Gaseosas y Sodas', icon: 'cup-soda', sortOrder: 4, isActive: true },
    { id: 5, name: 'Snacks', icon: 'popcorn', sortOrder: 5, isActive: true },
  ]).onConflictDoNothing();

  // Inserción de catálogo de productos
  await db.insert(products).values([
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
  ]).onConflictDoNothing();

  // Sincronizar secuencias serial de Postgres para que nuevos registros no choquen con los IDs del seed
  await db.execute(sql`SELECT setval('products_id_seq', COALESCE((SELECT MAX(id) FROM "products"), 1), (SELECT COUNT(*) > 0 FROM "products"))`);
  await db.execute(sql`SELECT setval('categories_id_seq', COALESCE((SELECT MAX(id) FROM "categories"), 1), (SELECT COUNT(*) > 0 FROM "categories"))`);
  await db.execute(sql`SELECT setval('tables_id_seq', COALESCE((SELECT MAX(id) FROM "tables"), 1), (SELECT COUNT(*) > 0 FROM "tables"))`);

  return { status: 'seed_completed' };
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runSeed()
    .then((res) => {
      console.log('Seed ejecutado con éxito:', res);
      return closeDb();
    })
    .catch((err) => {
      console.error('Error al ejecutar seed:', err);
      process.exit(1);
    });
}
