import { ApiErrorCode } from '@qr-menu/shared';

export class AppError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ApiErrorCode.VALIDATION_ERROR, message, 400, details);
  }
}

export class InvalidTableTokenError extends AppError {
  constructor(message = 'Mesa no encontrada o código QR inválido') {
    super(ApiErrorCode.INVALID_TABLE_TOKEN, message, 404);
  }
}

export class ProductNotFoundError extends AppError {
  constructor(productId: number, message = `El producto con ID ${productId} no existe`) {
    super(ApiErrorCode.PRODUCT_NOT_FOUND, message, 400, { productId });
  }
}

export class ProductUnavailableError extends AppError {
  constructor(productName: string, productId: number) {
    super(
      ApiErrorCode.PRODUCT_UNAVAILABLE,
      `El producto '${productName}' no se encuentra disponible en este momento`,
      409,
      { productId, productName }
    );
  }
}

export class PriceMismatchError extends AppError {
  constructor(message = 'Los precios de los productos han cambiado. Por favor actualiza el menú.') {
    super(ApiErrorCode.PRICE_MISMATCH, message, 409);
  }
}

export class IdempotencyMissingError extends AppError {
  constructor(message = 'El encabezado X-Idempotency-Key es obligatorio para crear pedidos') {
    super(ApiErrorCode.IDEMPOTENCY_KEY_MISSING, message, 400);
  }
}

export class IdempotencyReusedError extends AppError {
  constructor(message = 'La clave de idempotencia ya fue utilizada previamente con un pedido diferente') {
    super(ApiErrorCode.IDEMPOTENCY_KEY_REUSED, message, 409);
  }
}

export class OrderNotFoundError extends AppError {
  constructor(code = 'Pedido no encontrado') {
    super(ApiErrorCode.ORDER_NOT_FOUND, code, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Se requiere autenticación para acceder a este recurso') {
    super(ApiErrorCode.UNAUTHORIZED, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permisos suficientes para realizar esta acción') {
    super(ApiErrorCode.FORBIDDEN, message, 403);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message = 'Usuario o contraseña incorrectos') {
    super(ApiErrorCode.INVALID_CREDENTIALS, message, 401);
  }
}

export class UserInactiveError extends AppError {
  constructor(message = 'La cuenta de usuario se encuentra desactivada') {
    super(ApiErrorCode.USER_INACTIVE, message, 403);
  }
}

export class OrderStateConflictError extends AppError {
  constructor(message = 'El pedido fue modificado concurrentemente por otro operador', details?: unknown) {
    super(ApiErrorCode.ORDER_STATE_CONFLICT, message, 409, details);
  }
}

export class OrderInvalidStateTransitionError extends AppError {
  constructor(message = 'Transición de estado no permitida para este pedido', details?: unknown) {
    super(ApiErrorCode.ORDER_INVALID_STATE_TRANSITION, message, 409, details);
  }
}

export class OrderAlreadyPaidError extends AppError {
  constructor(message = 'El pedido ya se encuentra pagado') {
    super(ApiErrorCode.ORDER_ALREADY_PAID, message, 409);
  }
}

export class CsrfError extends AppError {
  constructor(message = 'Petición rechazada por validación de seguridad de origen (CSRF)') {
    super(ApiErrorCode.CSRF_TOKEN_INVALID, message, 403);
  }
}

