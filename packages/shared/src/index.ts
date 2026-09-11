import { z } from 'zod';

// ==============================================================================
// DOMAIN ENUMS & CONSTANTS
// ==============================================================================

export const UserRole = {
  ADMIN: 'ADMIN',
  CASHIER: 'CASHIER',
  KITCHEN: 'KITCHEN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const FulfillmentStatus = {
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type FulfillmentStatus = (typeof FulfillmentStatus)[keyof typeof FulfillmentStatus];

export const PaymentStatus = {
  UNPAID: 'UNPAID',
  PAID: 'PAID',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentMethodDeclared = {
  CASH: 'CASH',
  BRE_B: 'BRE_B',
  NEQUI: 'NEQUI',
  BANCOLOMBIA: 'BANCOLOMBIA',
} as const;
export type PaymentMethodDeclared = (typeof PaymentMethodDeclared)[keyof typeof PaymentMethodDeclared];

// ==============================================================================
// ERROR CODES
// ==============================================================================

export const ApiErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_TABLE_TOKEN: 'INVALID_TABLE_TOKEN',
  TABLE_INACTIVE: 'TABLE_INACTIVE',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  PRODUCT_UNAVAILABLE: 'PRODUCT_UNAVAILABLE',
  PRICE_MISMATCH: 'PRICE_MISMATCH',
  IDEMPOTENCY_KEY_MISSING: 'IDEMPOTENCY_KEY_MISSING',
  IDEMPOTENCY_KEY_INVALID: 'IDEMPOTENCY_KEY_INVALID',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_INACTIVE: 'USER_INACTIVE',
  ORDER_STATE_CONFLICT: 'ORDER_STATE_CONFLICT',
  ORDER_INVALID_STATE_TRANSITION: 'ORDER_INVALID_STATE_TRANSITION',
  ORDER_ALREADY_PAID: 'ORDER_ALREADY_PAID',
  CSRF_TOKEN_INVALID: 'CSRF_TOKEN_INVALID',
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

// ==============================================================================
// VALIDATION SCHEMAS (Zod)
// ==============================================================================

export const OrderItemInputSchema = z.object({
  productId: z.number().int().positive('ID de producto inválido'),
  quantity: z.number().int().min(1, 'Cantidad mínima es 1').max(50, 'Cantidad máxima por ítem es 50'),
});
export type OrderItemInput = z.infer<typeof OrderItemInputSchema>;

export const CreateOrderInputSchema = z.object({
  tableToken: z.string().min(6).max(32, 'Token de mesa inválido'),
  customerName: z.string().trim().max(50, 'El nombre no puede superar 50 caracteres').optional(),
  paymentMethodDeclared: z.enum([
    PaymentMethodDeclared.CASH,
    PaymentMethodDeclared.BRE_B,
    PaymentMethodDeclared.NEQUI,
    PaymentMethodDeclared.BANCOLOMBIA,
  ]).optional(),
  paymentMethod: z.enum([
    PaymentMethodDeclared.CASH,
    PaymentMethodDeclared.BRE_B,
    PaymentMethodDeclared.NEQUI,
    PaymentMethodDeclared.BANCOLOMBIA,
  ]).optional(),
  notes: z.string().max(150, 'Notas no pueden superar 150 caracteres').optional(),
  items: z.array(OrderItemInputSchema).min(1, 'El pedido debe incluir al menos un producto').max(30, 'Máximo 30 productos diferentes por pedido'),
  clientMenuVersion: z.number().int().optional(),
}).refine(
  (data) => data.paymentMethodDeclared !== undefined || data.paymentMethod !== undefined,
  {
    message: 'El método de pago declarado es obligatorio',
    path: ['paymentMethodDeclared'],
  }
);
export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;

export const MenuItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  imageUrl: z.string().nullable(),
  sortOrder: z.number().int(),
});
export type MenuItem = z.infer<typeof MenuItemSchema>;

export const MenuCategorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  icon: z.string().nullable(),
  sortOrder: z.number().int(),
  products: z.array(MenuItemSchema),
});
export type MenuCategory = z.infer<typeof MenuCategorySchema>;

export const PublicMenuResponseSchema = z.object({
  categories: z.array(MenuCategorySchema),
});
export type PublicMenuResponse = z.infer<typeof PublicMenuResponseSchema>;

export const OrderCreatedResponseSchema = z.object({
  orderCode: z.string(),
  orderNumber: z.number().int(),
  tableName: z.string(),
  customerName: z.string().nullable().optional(),
  totalAmount: z.number(),
  fulfillmentStatus: z.enum([
    FulfillmentStatus.PENDING,
    FulfillmentStatus.PREPARING,
    FulfillmentStatus.DELIVERED,
    FulfillmentStatus.CANCELLED,
  ]),
  paymentStatus: z.enum([PaymentStatus.UNPAID, PaymentStatus.PAID]),
  createdAt: z.string(),
});
export type OrderCreatedResponse = z.infer<typeof OrderCreatedResponseSchema>;

export const OrderStatusResponseSchema = z.object({
  orderCode: z.string(),
  orderNumber: z.number().int(),
  tableName: z.string(),
  customerName: z.string().nullable().optional(),
  fulfillmentStatus: z.enum([
    FulfillmentStatus.PENDING,
    FulfillmentStatus.PREPARING,
    FulfillmentStatus.DELIVERED,
    FulfillmentStatus.CANCELLED,
  ]),
  paymentStatus: z.enum([PaymentStatus.UNPAID, PaymentStatus.PAID]),
  totalAmount: z.number(),
  createdAt: z.string(),
});
export type OrderStatusResponse = z.infer<typeof OrderStatusResponseSchema>;

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.unknown().optional(),
    timestamp: z.string(),
  }),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

// ==============================================================================
// AUTH SCHEMAS
// ==============================================================================

export const LoginInputSchema = z.object({
  username: z.string().trim().min(1, 'El nombre de usuario es obligatorio').max(50),
  password: z.string().min(1, 'La contraseña es obligatoria').max(100),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  role: z.enum([UserRole.ADMIN, UserRole.CASHIER, UserRole.KITCHEN]),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const AuthResponseSchema = z.object({
  user: AuthUserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ==============================================================================
// OPS / KDS / CAJA SCHEMAS
// ==============================================================================

export const UpdateFulfillmentInputSchema = z.object({
  status: z.enum([
    FulfillmentStatus.PREPARING,
    FulfillmentStatus.DELIVERED,
    FulfillmentStatus.CANCELLED,
  ]),
  reason: z.string().max(255).optional(),
});
export type UpdateFulfillmentInput = z.infer<typeof UpdateFulfillmentInputSchema>;

export const ConfirmPaymentInputSchema = z.object({
  paymentStatus: z.literal(PaymentStatus.PAID),
});
export type ConfirmPaymentInput = z.infer<typeof ConfirmPaymentInputSchema>;

export const OpsOrderItemSchema = z.object({
  id: z.number().int(),
  productId: z.number().int(),
  productName: z.string(),
  unitPrice: z.number(),
  quantity: z.number().int(),
  subtotal: z.number(),
});
export type OpsOrderItem = z.infer<typeof OpsOrderItemSchema>;

export const OpsOrderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.number().int(),
  publicCode: z.string(),
  tableName: z.string(),
  tableNumber: z.number().int(),
  customerName: z.string().nullable().optional(),
  fulfillmentStatus: z.enum([
    FulfillmentStatus.PENDING,
    FulfillmentStatus.PREPARING,
    FulfillmentStatus.DELIVERED,
    FulfillmentStatus.CANCELLED,
  ]),
  paymentStatus: z.enum([PaymentStatus.UNPAID, PaymentStatus.PAID]),
  paymentMethodDeclared: z.enum([
    PaymentMethodDeclared.CASH,
    PaymentMethodDeclared.BRE_B,
    PaymentMethodDeclared.NEQUI,
    PaymentMethodDeclared.BANCOLOMBIA,
  ]),
  totalAmount: z.number(),
  notes: z.string().nullable(),
  items: z.array(OpsOrderItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OpsOrder = z.infer<typeof OpsOrderSchema>;

export const OpsOrdersResponseSchema = z.object({
  orders: z.array(OpsOrderSchema),
});
export type OpsOrdersResponse = z.infer<typeof OpsOrdersResponseSchema>;
