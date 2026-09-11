import { eq, and, desc, inArray, SQL } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { orders, orderItems, tables } from '../db/schema.js';
import {
  FulfillmentStatus,
  PaymentStatus,
  UserRole,
  OpsOrder,
  OpsOrderItem,
} from '@qr-menu/shared';
import {
  OrderNotFoundError,
  OrderStateConflictError,
  OrderInvalidStateTransitionError,
  OrderAlreadyPaidError,
  ForbiddenError,
} from '../errors.js';
import { AuthenticatedUser, recordAuditLog } from './auth.service.js';

export interface ListOrdersFilters {
  fulfillmentStatus?: FulfillmentStatus;
  paymentStatus?: PaymentStatus;
  tableId?: number;
  limit?: number;
  offset?: number;
}

export async function listOpsOrders(
  filters: ListOrdersFilters = {},
  db = getDb()
): Promise<OpsOrder[]> {
  const conditions: SQL[] = [];

  if (filters.fulfillmentStatus) {
    conditions.push(eq(orders.fulfillmentStatus, filters.fulfillmentStatus));
  }
  if (filters.paymentStatus) {
    conditions.push(eq(orders.paymentStatus, filters.paymentStatus));
  }
  if (filters.tableId) {
    conditions.push(eq(orders.tableId, filters.tableId));
  }

  const query = db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      publicCode: orders.publicCode,
      tableId: orders.tableId,
      tableName: tables.name,
      tableNumber: tables.number,
      fulfillmentStatus: orders.fulfillmentStatus,
      paymentStatus: orders.paymentStatus,
      paymentMethod: orders.paymentMethod,
      totalAmount: orders.totalAmount,
      customerName: orders.customerName,
      notes: orders.notes,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .innerJoin(tables, eq(orders.tableId, tables.id))
    .orderBy(desc(orders.createdAt));

  const orderRecords =
    conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

  if (orderRecords.length === 0) {
    return [];
  }

  // Cargar ítems para todas las órdenes encontradas
  const orderIds = orderRecords.map((o) => o.id);
  const items = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      productNameSnapshot: orderItems.productNameSnapshot,
      unitPriceSnapshot: orderItems.unitPriceSnapshot,
      quantity: orderItems.quantity,
      subtotal: orderItems.subtotal,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));

  const itemsByOrder = new Map<string, OpsOrderItem[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) || [];
    list.push({
      id: item.id,
      productId: item.productId,
      productName: item.productNameSnapshot,
      unitPrice: Number(item.unitPriceSnapshot),
      quantity: item.quantity,
      subtotal: Number(item.subtotal),
    });
    itemsByOrder.set(item.orderId, list);
  }

  return orderRecords.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    publicCode: o.publicCode,
    tableName: o.tableName,
    tableNumber: o.tableNumber,
    fulfillmentStatus: o.fulfillmentStatus,
    paymentStatus: o.paymentStatus,
    paymentMethodDeclared: o.paymentMethod,
    totalAmount: Number(o.totalAmount),
    customerName: o.customerName || null,
    notes: o.notes,
    items: itemsByOrder.get(o.id) || [],
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }));
}

export async function getOpsOrderById(
  orderId: string,
  db = getDb()
): Promise<OpsOrder> {
  const orderRecords = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      publicCode: orders.publicCode,
      tableId: orders.tableId,
      tableName: tables.name,
      tableNumber: tables.number,
      fulfillmentStatus: orders.fulfillmentStatus,
      paymentStatus: orders.paymentStatus,
      paymentMethod: orders.paymentMethod,
      totalAmount: orders.totalAmount,
      customerName: orders.customerName,
      notes: orders.notes,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .innerJoin(tables, eq(orders.tableId, tables.id))
    .where(eq(orders.id, orderId));

  if (orderRecords.length === 0) {
    throw new OrderNotFoundError(`No se encontró el pedido con ID '${orderId}'`);
  }

  const o = orderRecords[0];

  const items = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      productNameSnapshot: orderItems.productNameSnapshot,
      unitPriceSnapshot: orderItems.unitPriceSnapshot,
      quantity: orderItems.quantity,
      subtotal: orderItems.subtotal,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, o.id));

  return {
    id: o.id,
    orderNumber: o.orderNumber,
    publicCode: o.publicCode,
    tableName: o.tableName,
    tableNumber: o.tableNumber,
    fulfillmentStatus: o.fulfillmentStatus,
    paymentStatus: o.paymentStatus,
    paymentMethodDeclared: o.paymentMethod,
    totalAmount: Number(o.totalAmount),
    customerName: o.customerName || null,
    notes: o.notes,
    items: items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productNameSnapshot,
      unitPrice: Number(i.unitPriceSnapshot),
      quantity: i.quantity,
      subtotal: Number(i.subtotal),
    })),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

export interface UpdateFulfillmentOptions {
  reason?: string;
  ipAddress?: string;
}

export async function updateOrderFulfillment(
  orderId: string,
  newStatus: FulfillmentStatus,
  user: AuthenticatedUser,
  opts: UpdateFulfillmentOptions = {},
  db = getDb()
): Promise<OpsOrder> {
  // 1. Autorización por rol (ADMIN, KITCHEN y CASHIER en punto único de caja/barra)
  // Todos los roles operativos tienen permiso para actualizar el estado de comandas.

  // 2. Definición de estados previos válidos para la transición
  let validCurrentStatuses: FulfillmentStatus[] = [];
  if (newStatus === FulfillmentStatus.PREPARING) {
    validCurrentStatuses = [FulfillmentStatus.PENDING];
  } else if (newStatus === FulfillmentStatus.DELIVERED) {
    validCurrentStatuses = [FulfillmentStatus.PREPARING];
  } else if (newStatus === FulfillmentStatus.CANCELLED) {
    validCurrentStatuses = [
      FulfillmentStatus.PENDING,
      FulfillmentStatus.PREPARING,
    ];
  } else {
    throw new OrderInvalidStateTransitionError(
      `Estado destino '${newStatus}' no es válido`
    );
  }

  // 3. Ejecución atómica condicional contra la base de datos (concurrencia estricta)
  const updatedRows = await db
    .update(orders)
    .set({
      fulfillmentStatus: newStatus,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.id, orderId),
        inArray(orders.fulfillmentStatus, validCurrentStatuses)
      )
    )
    .returning({
      id: orders.id,
      publicCode: orders.publicCode,
      fulfillmentStatus: orders.fulfillmentStatus,
      updatedAt: orders.updatedAt,
    });

  if (updatedRows.length === 0) {
    // La actualización no afectó ninguna fila. Verificar la causa:
    const currentRecords = await db
      .select({
        id: orders.id,
        publicCode: orders.publicCode,
        fulfillmentStatus: orders.fulfillmentStatus,
      })
      .from(orders)
      .where(eq(orders.id, orderId));

    if (currentRecords.length === 0) {
      throw new OrderNotFoundError(`No se encontró el pedido con ID '${orderId}'`);
    }

    const current = currentRecords[0];

    // Si ya está en un estado terminal o en un estado incompatible:
    if (
      current.fulfillmentStatus === FulfillmentStatus.DELIVERED ||
      current.fulfillmentStatus === FulfillmentStatus.CANCELLED
    ) {
      throw new OrderInvalidStateTransitionError(
        `El pedido '${current.publicCode}' se encuentra en estado terminal '${current.fulfillmentStatus}' y no puede ser modificado`,
        { currentStatus: current.fulfillmentStatus, targetStatus: newStatus }
      );
    }

    // Condición de carrera: otro operador lo modificó concurrentemente
    throw new OrderStateConflictError(
      `Conflicto de concurrencia: el pedido '${current.publicCode}' fue cambiado a '${current.fulfillmentStatus}' por otro operador`,
      { currentStatus: current.fulfillmentStatus, targetStatus: newStatus }
    );
  }

  const updated = updatedRows[0];

  // 4. Registro de auditoría
  await recordAuditLog(
    {
      userId: user.id,
      action: 'ORDER_FULFILLMENT_UPDATED',
      entityType: 'ORDER',
      entityId: updated.id,
      metadata: {
        publicCode: updated.publicCode,
        newStatus: updated.fulfillmentStatus,
        reason: opts.reason || null,
      },
      ipAddress: opts.ipAddress || null,
    },
    db
  );

  return await getOpsOrderById(orderId, db);
}

export interface ConfirmPaymentOptions {
  ipAddress?: string;
}

export async function confirmOrderPayment(
  orderId: string,
  user: AuthenticatedUser,
  opts: ConfirmPaymentOptions = {},
  db = getDb()
): Promise<OpsOrder> {
  // 1. Autorización por rol: Cocina NO tiene permitido confirmar pagos
  if (user.role === UserRole.KITCHEN) {
    throw new ForbiddenError(
      'El rol COCINA no tiene permisos para confirmar pagos'
    );
  }

  // 2. Ejecución atómica condicional: Solo si el estado actual es UNPAID
  const updatedRows = await db
    .update(orders)
    .set({
      paymentStatus: PaymentStatus.PAID,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.paymentStatus, PaymentStatus.UNPAID)
      )
    )
    .returning({
      id: orders.id,
      publicCode: orders.publicCode,
      paymentStatus: orders.paymentStatus,
      paymentMethod: orders.paymentMethod,
      totalAmount: orders.totalAmount,
      updatedAt: orders.updatedAt,
    });

  if (updatedRows.length === 0) {
    // Verificar por qué no se actualizó
    const currentRecords = await db
      .select({
        id: orders.id,
        publicCode: orders.publicCode,
        paymentStatus: orders.paymentStatus,
      })
      .from(orders)
      .where(eq(orders.id, orderId));

    if (currentRecords.length === 0) {
      throw new OrderNotFoundError(`No se encontró el pedido con ID '${orderId}'`);
    }

    const current = currentRecords[0];

    if (current.paymentStatus === PaymentStatus.PAID) {
      throw new OrderAlreadyPaidError(
        `El pedido '${current.publicCode}' ya fue marcado como PAGADO previamente`
      );
    }

    throw new OrderStateConflictError(
      `Conflicto de estado al confirmar pago para el pedido '${current.publicCode}'`
    );
  }

  const updated = updatedRows[0];

  // 3. Registro de auditoría
  await recordAuditLog(
    {
      userId: user.id,
      action: 'ORDER_PAYMENT_CONFIRMED',
      entityType: 'ORDER',
      entityId: updated.id,
      metadata: {
        publicCode: updated.publicCode,
        paymentStatus: updated.paymentStatus,
        paymentMethod: updated.paymentMethod,
        totalAmount: updated.totalAmount,
      },
      ipAddress: opts.ipAddress || null,
    },
    db
  );

  return await getOpsOrderById(orderId, db);
}
