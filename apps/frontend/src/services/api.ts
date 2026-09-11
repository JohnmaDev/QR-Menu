import {
  PublicMenuResponse,
  CreateOrderInput,
  OrderCreatedResponse,
  OrderStatusResponse,
  ApiErrorResponse,
} from '@qr-menu/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorData: ApiErrorResponse | null = null;
    try {
      errorData = (await res.json()) as ApiErrorResponse;
    } catch {
      // Si la respuesta no es JSON válido
    }

    const code = errorData?.error?.code || 'UNKNOWN_ERROR';
    const message =
      errorData?.error?.message ||
      (res.status === 404
        ? 'Recurso no encontrado'
        : res.status === 429
        ? 'Demasiadas solicitudes. Por favor espera un momento.'
        : 'Error al comunicarse con el servidor');

    throw new ApiClientError(code, message, res.status, errorData?.error?.details);
  }

  return (await res.json()) as T;
}

export async function fetchMenu(): Promise<PublicMenuResponse> {
  const url = `${API_BASE_URL}/api/menu`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    return await handleResponse<PublicMenuResponse>(res);
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    throw new ApiClientError(
      'NETWORK_ERROR',
      'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
      0
    );
  }
}

export async function submitOrder(
  input: CreateOrderInput,
  idempotencyKey: string
): Promise<OrderCreatedResponse> {
  const url = `${API_BASE_URL}/api/orders`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
        Accept: 'application/json',
      },
      body: JSON.stringify(input),
    });
    return await handleResponse<OrderCreatedResponse>(res);
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    throw new ApiClientError(
      'NETWORK_ERROR',
      'Error de red al enviar el pedido. Por favor intenta de nuevo.',
      0
    );
  }
}

export async function fetchOrderStatus(
  orderCode: string
): Promise<OrderStatusResponse> {
  const url = `${API_BASE_URL}/api/orders/${encodeURIComponent(orderCode)}/status`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    return await handleResponse<OrderStatusResponse>(res);
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    throw new ApiClientError(
      'NETWORK_ERROR',
      'No se pudo consultar el estado del pedido.',
      0
    );
  }
}

// ==============================================================================
// AUTH API
// ==============================================================================

export async function loginApi(credentials: {
  username: string;
  password: string;
}): Promise<{ user: { id: string; username: string; role: any } }> {
  const url = `${API_BASE_URL}/api/auth/login`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    return await handleResponse<{ user: { id: string; username: string; role: any } }>(res);
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    throw new ApiClientError(
      'NETWORK_ERROR',
      'No se pudo conectar con el servidor para iniciar sesión.',
      0
    );
  }
}

export async function logoutApi(): Promise<{ status: string }> {
  const url = `${API_BASE_URL}/api/auth/logout`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
      },
    });
    return await handleResponse<{ status: string }>(res);
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    throw new ApiClientError(
      'NETWORK_ERROR',
      'Error al cerrar sesión.',
      0
    );
  }
}

export async function fetchCurrentUserApi(): Promise<{ user: { id: string; username: string; role: any } }> {
  const url = `${API_BASE_URL}/api/auth/me`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
    return await handleResponse<{ user: { id: string; username: string; role: any } }>(res);
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    throw new ApiClientError(
      'NETWORK_ERROR',
      'No se pudo verificar la sesión actual.',
      0
    );
  }
}

// ==============================================================================
// OPS / KDS / CAJA API
// ==============================================================================

export interface OpsOrdersFilters {
  fulfillmentStatus?: string;
  paymentStatus?: string;
  tableId?: number;
}

export async function fetchOpsOrdersApi(
  filters: OpsOrdersFilters = {}
): Promise<{ orders: any[] }> {
  const queryParams = new URLSearchParams();
  if (filters.fulfillmentStatus) {
    queryParams.set('fulfillmentStatus', filters.fulfillmentStatus);
  }
  if (filters.paymentStatus) {
    queryParams.set('paymentStatus', filters.paymentStatus);
  }
  if (filters.tableId) {
    queryParams.set('tableId', String(filters.tableId));
  }

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/api/ops/orders${queryString ? `?${queryString}` : ''}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
    return await handleResponse<{ orders: any[] }>(res);
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    throw new ApiClientError(
      'NETWORK_ERROR',
      'No se pudo cargar el listado de pedidos.',
      0
    );
  }
}

export async function updateFulfillmentApi(
  orderId: string,
  status: string,
  reason?: string
): Promise<any> {
  const url = `${API_BASE_URL}/api/ops/orders/${encodeURIComponent(orderId)}/fulfillment`;
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
      },
      body: JSON.stringify({ status, reason }),
    });
    return await handleResponse<any>(res);
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    throw new ApiClientError(
      'NETWORK_ERROR',
      'Error de red al actualizar estado del pedido.',
      0
    );
  }
}

export async function confirmPaymentApi(orderId: string): Promise<any> {
  const url = `${API_BASE_URL}/api/ops/orders/${encodeURIComponent(orderId)}/payment`;
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
      },
      body: JSON.stringify({ paymentStatus: 'PAID' }),
    });
    return await handleResponse<any>(res);
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    throw new ApiClientError(
      'NETWORK_ERROR',
      'Error de red al confirmar el pago.',
      0
    );
  }
}

