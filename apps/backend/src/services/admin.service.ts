import crypto from 'crypto';
import { eq, asc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { tables, categories, products } from '../db/schema.js';
import {
  AdminTable,
  CreateTableInput,
  UpdateTableInput,
  AdminProduct,
  CreateProductInput,
  UpdateProductInput,
} from '@qr-menu/shared';
import { ValidationError } from '../errors.js';
import { invalidateMenuCache } from './menu.service.js';

function toIso(date: unknown): string {
  if (!date) return new Date().toISOString();
  if (date instanceof Date) return date.toISOString();
  return new Date(String(date)).toISOString();
}

// ==============================================================================
// 1. GESTIÓN DE MESAS (TABLES)
// ==============================================================================

export async function listAdminTables(db = getDb()): Promise<AdminTable[]> {
  const rows = await db
    .select({
      id: tables.id,
      number: tables.number,
      name: tables.name,
      publicToken: tables.publicToken,
      isActive: tables.isActive,
      createdAt: tables.createdAt,
    })
    .from(tables)
    .orderBy(asc(tables.number));

  return rows.map((r) => ({
    ...r,
    createdAt: toIso(r.createdAt),
  }));
}

export async function createAdminTable(
  input: CreateTableInput,
  db = getDb()
): Promise<AdminTable> {
  // 1. Validar que el número de mesa no esté duplicado
  const existing = await db
    .select({ id: tables.id })
    .from(tables)
    .where(eq(tables.number, input.number));

  if (existing.length > 0) {
    throw new ValidationError(`Ya existe una mesa registrada con el número ${input.number}`);
  }

  // 2. Generar token público no predecible (t_m{num}_{6hex})
  const randomPart = crypto.randomBytes(3).toString('hex');
  const publicToken = `t_m${input.number}_${randomPart}`;

  const [created] = await db
    .insert(tables)
    .values({
      number: input.number,
      name: input.name.trim(),
      publicToken,
      isActive: true,
    })
    .returning({
      id: tables.id,
      number: tables.number,
      name: tables.name,
      publicToken: tables.publicToken,
      isActive: tables.isActive,
      createdAt: tables.createdAt,
    });

  return {
    ...created,
    createdAt: toIso(created.createdAt),
  };
}

export async function updateAdminTable(
  tableId: number,
  input: UpdateTableInput,
  db = getDb()
): Promise<AdminTable> {
  const [existing] = await db
    .select()
    .from(tables)
    .where(eq(tables.id, tableId));

  if (!existing) {
    throw new ValidationError(`La mesa con ID ${tableId} no existe`);
  }

  // Si cambia el número, verificar que no colisione con otra mesa
  if (input.number !== undefined && input.number !== existing.number) {
    const duplicate = await db
      .select({ id: tables.id })
      .from(tables)
      .where(eq(tables.number, input.number));

    if (duplicate.length > 0) {
      throw new ValidationError(`Ya existe otra mesa con el número ${input.number}`);
    }
  }

  const [updated] = await db
    .update(tables)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.number !== undefined ? { number: input.number } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    })
    .where(eq(tables.id, tableId))
    .returning({
      id: tables.id,
      number: tables.number,
      name: tables.name,
      publicToken: tables.publicToken,
      isActive: tables.isActive,
      createdAt: tables.createdAt,
    });

  return {
    ...updated,
    createdAt: toIso(updated.createdAt),
  };
}

// ==============================================================================
// 2. GESTIÓN DE PRODUCTOS Y CATÁLOGO
// ==============================================================================

export async function listAdminProducts(db = getDb()): Promise<AdminProduct[]> {
  const rows = await db
    .select({
      id: products.id,
      categoryId: products.categoryId,
      categoryName: categories.name,
      name: products.name,
      description: products.description,
      price: products.price,
      imageUrl: products.imageUrl,
      isAvailable: products.isAvailable,
      sortOrder: products.sortOrder,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(asc(categories.sortOrder), asc(products.sortOrder), asc(products.id));

  return rows.map((r) => ({
    ...r,
    price: Number(r.price),
    createdAt: toIso(r.createdAt),
    updatedAt: toIso(r.updatedAt),
  }));
}

export async function createAdminProduct(
  input: CreateProductInput,
  db = getDb()
): Promise<AdminProduct> {
  // 1. Verificar categoría existente
  const [cat] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, input.categoryId));

  if (!cat) {
    throw new ValidationError(`La categoría con ID ${input.categoryId} no existe`);
  }

  const [created] = await db
    .insert(products)
    .values({
      categoryId: input.categoryId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price: input.price.toFixed(2),
      imageUrl: input.imageUrl?.trim() || null,
      isAvailable: input.isAvailable !== undefined ? input.isAvailable : true,
      sortOrder: input.sortOrder || 0,
    })
    .returning();

  // Invalidar caché pública del menú en memoria
  invalidateMenuCache();

  return {
    id: created.id,
    categoryId: created.categoryId,
    categoryName: cat.name,
    name: created.name,
    description: created.description,
    price: Number(created.price),
    imageUrl: created.imageUrl,
    isAvailable: created.isAvailable,
    sortOrder: created.sortOrder,
    createdAt: toIso(created.createdAt),
    updatedAt: toIso(created.updatedAt),
  };
}

export async function updateAdminProduct(
  productId: number,
  input: UpdateProductInput,
  db = getDb()
): Promise<AdminProduct> {
  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId));

  if (!existing) {
    throw new ValidationError(`El producto con ID ${productId} no existe`);
  }

  let catName = '';
  const targetCatId = input.categoryId !== undefined ? input.categoryId : existing.categoryId;
  const [cat] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, targetCatId));

  if (!cat) {
    throw new ValidationError(`La categoría con ID ${targetCatId} no existe`);
  }
  catName = cat.name;

  const [updated] = await db
    .update(products)
    .set({
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.price !== undefined ? { price: input.price.toFixed(2) } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl?.trim() || null } : {}),
      ...(input.isAvailable !== undefined ? { isAvailable: input.isAvailable } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId))
    .returning();

  // Invalidar caché pública del menú en memoria
  invalidateMenuCache();

  return {
    id: updated.id,
    categoryId: updated.categoryId,
    categoryName: catName,
    name: updated.name,
    description: updated.description,
    price: Number(updated.price),
    imageUrl: updated.imageUrl,
    isAvailable: updated.isAvailable,
    sortOrder: updated.sortOrder,
    createdAt: toIso(updated.createdAt),
    updatedAt: toIso(updated.updatedAt),
  };
}

export async function toggleProductAvailability(
  productId: number,
  db = getDb()
): Promise<AdminProduct> {
  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId));

  if (!existing) {
    throw new ValidationError(`El producto con ID ${productId} no existe`);
  }

  return updateAdminProduct(productId, { isAvailable: !existing.isAvailable }, db);
}

// ==============================================================================
// 3. CATEGORÍAS
// ==============================================================================

export async function listAdminCategories(db = getDb()) {
  return await db
    .select({
      id: categories.id,
      name: categories.name,
      icon: categories.icon,
      sortOrder: categories.sortOrder,
      isActive: categories.isActive,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.id));
}
