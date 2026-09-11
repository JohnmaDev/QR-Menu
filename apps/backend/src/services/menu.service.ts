import { eq, and, asc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { categories, products } from '../db/schema.js';
import { PublicMenuResponse } from '@qr-menu/shared';
import crypto from 'crypto';

export interface MenuServiceResult {
  menu: PublicMenuResponse;
  etag: string;
}

interface CacheEntry {
  result: MenuServiceResult;
  timestamp: number;
}

let memoryCache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 segundos de caché en memoria RAM

export function invalidateMenuCache(): void {
  memoryCache = null;
}

export async function getPublicMenu(db = getDb(), bypassCache = false): Promise<MenuServiceResult> {
  const now = Date.now();
  if (
    !bypassCache &&
    process.env.NODE_ENV !== 'test' &&
    memoryCache &&
    now - memoryCache.timestamp < CACHE_TTL_MS
  ) {
    return memoryCache.result;
  }
  // 1. Obtener categorías activas ordenadas
  const activeCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      icon: categories.icon,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder), asc(categories.id));

  // 2. Obtener productos disponibles ordenados
  const availableProducts = await db
    .select({
      id: products.id,
      categoryId: products.categoryId,
      name: products.name,
      description: products.description,
      price: products.price,
      imageUrl: products.imageUrl,
      sortOrder: products.sortOrder,
    })
    .from(products)
    .where(and(eq(products.isAvailable, true)))
    .orderBy(asc(products.sortOrder), asc(products.id));

  // 3. Agrupar productos por categoría
  const categoryMap = new Map<
    number,
    {
      id: number;
      name: string;
      icon: string | null;
      sortOrder: number;
      products: Array<{
        id: number;
        name: string;
        description: string | null;
        price: number;
        imageUrl: string | null;
        sortOrder: number;
      }>;
    }
  >();

  for (const cat of activeCategories) {
    categoryMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
      products: [],
    });
  }

  for (const prod of availableProducts) {
    const cat = categoryMap.get(prod.categoryId);
    if (cat) {
      cat.products.push({
        id: prod.id,
        name: prod.name,
        description: prod.description,
        price: Number(prod.price),
        imageUrl: prod.imageUrl,
        sortOrder: prod.sortOrder,
      });
    }
  }

  const resultCategories = Array.from(categoryMap.values()).filter(
    (c) => c.products.length > 0
  );

  const menu: PublicMenuResponse = {
    categories: resultCategories,
  };

  // 4. Calcular ETag determinista
  const contentHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(menu))
    .digest('hex')
    .substring(0, 16);

  const etag = `W/"${contentHash}"`;
  const result: MenuServiceResult = { menu, etag };

  if (process.env.NODE_ENV !== 'test') {
    memoryCache = { result, timestamp: now };
  }

  return result;
}
