import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  tables,
  products,
  orders,
  orderItems,
} from '../db/schema.js';
import {
  CreateOrderInput,
  OrderCreatedResponse,
  OrderStatusResponse,
  PaymentMethodDeclared,
} from '@qr-menu/shared';
import {
  InvalidTableTokenError,
  ProductNotFoundError,
  ProductUnavailableError,
  IdempotencyReusedError,
  OrderNotFoundError,
} from '../errors.js';

// Generador de código público no predecible (ORD-XXXXXX)
export function generatePublicOrderCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Evita 0, 1, I, O para claridad humana
  let result = 'ORD-';
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

// Cálculo determinista del hash de petición para idempotencia
export function computeOrderRequestHash(input: CreateOrderInput): string {
  const method = input.paymentMethodDeclared || input.paymentMethod || '';
  const sortedItems = input.items
    .slice()
    .sort((a, b) => a.productId - b.productId)
    .map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));

  const canonical = {
    tableToken: input.tableToken.trim(),
    paymentMethodDeclared: method,
    notes: (input.notes || '').trim(),
    items: sortedItems,
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
}

export async function createOrder(
  input: CreateOrderInput,
  idempotencyKey: string,
  db = getDb()
): Promise<OrderCreatedResponse> {
  const requestHash = computeOrderRequestHash(input);
  const paymentMethod = (input.paymentMethodDeclared || input.paymentMethod) as PaymentMethodDeclared;

  // 1. Verificación preliminar de idempotencia antes de transacción
  const existingOrders = await db
    .select({
      id: orders.id,
      publicCode: orders.publicCode,
      orderNumber: orders.orderNumber,
      tableId: orders.tableId,
      customerName: orders.customerName,
      requestHash: orders.requestHash,
      totalAmount: orders.totalAmount,
      fulfillmentStatus: orders.fulfillmentStatus,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.idempotencyKey, idempotencyKey));

  if (existingOrders.length > 0) {
    const existing = existingOrders[0];
    if (existing.requestHash !== requestHash) {
      throw new IdempotencyReusedError();
    }

    // Obtener nombre de la mesa asociada
    const tableRecord = await db
      .select({ name: tables.name })
      .from(tables)
      .where(eq(tables.id, existing.tableId));

    return {
      orderCode: existing.publicCode,
      orderNumber: existing.orderNumber,
      tableName: tableRecord[0]?.name || 'Mesa',
      customerName: existing.customerName || undefined,
      totalAmount: Number(existing.totalAmount),
      fulfillmentStatus: existing.fulfillmentStatus,
      paymentStatus: existing.paymentStatus,
      createdAt: existing.createdAt.toISOString(),
    };
  }

  // 2. Ejecución atómica en transacción
  try {
    return await db.transaction(async (tx) => {
      // a. Validar mesa activa
      const matchingTables = await tx
        .select({
          id: tables.id,
          name: tables.name,
          isActive: tables.isActive,
        })
        .from(tables)
        .where(eq(tables.publicToken, input.tableToken.trim()));

      if (matchingTables.length === 0 || !matchingTables[0].isActive) {
        throw new InvalidTableTokenError();
      }
      const table = matchingTables[0];

      // b. Obtener productos de la base de datos (Precios Soberanos)
      const requestedProductIds = Array.from(
        new Set(input.items.map((i) => i.productId))
      );

      const dbProducts = await tx
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
          isAvailable: products.isAvailable,
        })
        .from(products)
        .where(inArray(products.id, requestedProductIds));

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));

      // c. Verificar existencia y disponibilidad estricta
      for (const item of input.items) {
        const prod = productMap.get(item.productId);
        if (!prod) {
          throw new ProductNotFoundError(item.productId);
        }
        if (!prod.isAvailable) {
          throw new ProductUnavailableError(prod.name, prod.id);
        }
      }

      // d. Recalcular subtotales y total con aritmética de centavos segura
      let totalCents = 0;
      const calculatedItems = input.items.map((item) => {
        const prod = productMap.get(item.productId)!;
        const unitPriceNum = Number(prod.price);
        const unitPriceCents = Math.round(unitPriceNum * 100);
        const itemSubtotalCents = unitPriceCents * item.quantity;
        totalCents += itemSubtotalCents;

        return {
          productId: prod.id,
          productNameSnapshot: prod.name,
          unitPriceSnapshot: (unitPriceCents / 100).toFixed(2),
          quantity: item.quantity,
          subtotal: (itemSubtotalCents / 100).toFixed(2),
        };
      });

      const totalAmountStr = (totalCents / 100).toFixed(2);
      const publicCode = generatePublicOrderCode();

      // e. Insertar cabecera de orden
      const insertedOrders = await tx
        .insert(orders)
        .values({
          publicCode,
          tableId: table.id,
          customerName: input.customerName?.trim() || null,
          paymentMethod,
          idempotencyKey,
          requestHash,
          totalAmount: totalAmountStr,
          notes: input.notes?.trim() || null,
        })
        .returning({
          id: orders.id,
          publicCode: orders.publicCode,
          orderNumber: orders.orderNumber,
          customerName: orders.customerName,
          fulfillmentStatus: orders.fulfillmentStatus,
          paymentStatus: orders.paymentStatus,
          totalAmount: orders.totalAmount,
          createdAt: orders.createdAt,
        });

      const createdOrder = insertedOrders[0];

      // f. Insertar detalle con snapshots inmutables
      await tx.insert(orderItems).values(
        calculatedItems.map((item) => ({
          orderId: createdOrder.id,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          unitPriceSnapshot: item.unitPriceSnapshot,
          quantity: item.quantity,
          subtotal: item.subtotal,
        }))
      );

      return {
        orderCode: createdOrder.publicCode,
        orderNumber: createdOrder.orderNumber,
        tableName: table.name,
        customerName: createdOrder.customerName || undefined,
        totalAmount: Number(createdOrder.totalAmount),
        fulfillmentStatus: createdOrder.fulfillmentStatus,
        paymentStatus: createdOrder.paymentStatus,
        createdAt: createdOrder.createdAt.toISOString(),
      };
    });
  } catch (err: unknown) {
    // Manejo de condición de carrera si otra solicitud concurrente insertó primero la misma clave
    const errorString = String(err);
    if (
      errorString.includes('orders_idempotency_key_unique') ||
      errorString.includes('duplicate key value') ||
      (err as { code?: string })?.code === '23505'
    ) {
      const raceOrder = await db
        .select({
          publicCode: orders.publicCode,
          orderNumber: orders.orderNumber,
          tableId: orders.tableId,
          customerName: orders.customerName,
          requestHash: orders.requestHash,
          totalAmount: orders.totalAmount,
          fulfillmentStatus: orders.fulfillmentStatus,
          paymentStatus: orders.paymentStatus,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(eq(orders.idempotencyKey, idempotencyKey));

      if (raceOrder.length > 0) {
        if (raceOrder[0].requestHash !== requestHash) {
          throw new IdempotencyReusedError();
        }

        const tableRecord = await db
          .select({ name: tables.name })
          .from(tables)
          .where(eq(tables.id, raceOrder[0].tableId));

        return {
          orderCode: raceOrder[0].publicCode,
          orderNumber: raceOrder[0].orderNumber,
          tableName: tableRecord[0]?.name || 'Mesa',
          customerName: raceOrder[0].customerName || undefined,
          totalAmount: Number(raceOrder[0].totalAmount),
          fulfillmentStatus: raceOrder[0].fulfillmentStatus,
          paymentStatus: raceOrder[0].paymentStatus,
          createdAt: raceOrder[0].createdAt.toISOString(),
        };
      }
    }
    throw err;
  }
}

export async function getOrderStatus(
  publicCode: string,
  db = getDb()
): Promise<OrderStatusResponse> {
  const result = await db
    .select({
      orderCode: orders.publicCode,
      orderNumber: orders.orderNumber,
      tableName: tables.name,
      customerName: orders.customerName,
      fulfillmentStatus: orders.fulfillmentStatus,
      paymentStatus: orders.paymentStatus,
      totalAmount: orders.totalAmount,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(tables, eq(orders.tableId, tables.id))
    .where(eq(orders.publicCode, publicCode.trim()));

  if (result.length === 0) {
    throw new OrderNotFoundError(`No se encontró ningún pedido con el código '${publicCode}'`);
  }

  const order = result[0];
  return {
    orderCode: order.orderCode,
    orderNumber: order.orderNumber,
    tableName: order.tableName,
    customerName: order.customerName || undefined,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentStatus: order.paymentStatus,
    totalAmount: Number(order.totalAmount),
    createdAt: order.createdAt.toISOString(),
  };
}
