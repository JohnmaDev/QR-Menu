import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchMenu, submitOrder, fetchOrderStatus, ApiClientError } from './api.js';
import { PaymentMethodDeclared } from '@qr-menu/shared';

describe('Frontend API Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchMenu returns parsed categories on 200 OK', async () => {
    const mockMenu = {
      categories: [
        {
          id: 1,
          name: 'Cervezas',
          icon: 'beer',
          sortOrder: 1,
          products: [
            {
              id: 10,
              name: 'Pilsen',
              description: null,
              price: 5000,
              imageUrl: null,
              sortOrder: 1,
            },
          ],
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMenu,
    } as unknown as Response);

    const result = await fetchMenu();
    expect(result.categories.length).toBe(1);
    expect(result.categories[0].name).toBe('Cervezas');
  });

  it('fetchMenu throws ApiClientError on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    await expect(fetchMenu()).rejects.toThrow(ApiClientError);
  });

  it('submitOrder sends X-Idempotency-Key header and returns created order', async () => {
    const mockCreated = {
      orderCode: 'ORD-7K2M9X',
      orderNumber: 1,
      tableName: 'Mesa 1',
      totalAmount: 10000,
      fulfillmentStatus: 'PENDING',
      paymentStatus: 'UNPAID',
      createdAt: new Date().toISOString(),
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCreated,
    } as unknown as Response);
    globalThis.fetch = fetchSpy;

    const payload = {
      tableToken: 't_m1_test',
      paymentMethodDeclared: PaymentMethodDeclared.CASH,
      items: [{ productId: 1, quantity: 2 }],
    };

    const res = await submitOrder(payload, 'idempotency-key-uuid-123');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/orders'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Idempotency-Key': 'idempotency-key-uuid-123',
          'Content-Type': 'application/json',
        }),
      })
    );

    expect(res.orderCode).toBe('ORD-7K2M9X');
  });

  it('submitOrder handles 409 Conflict cleanly', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: {
          code: 'PRODUCT_UNAVAILABLE',
          message: 'El producto se encuentra agotado',
          statusCode: 409,
        },
      }),
    } as unknown as Response);

    const payload = {
      tableToken: 't_m1_test',
      paymentMethodDeclared: PaymentMethodDeclared.CASH,
      items: [{ productId: 1, quantity: 2 }],
    };

    await expect(submitOrder(payload, 'key-123')).rejects.toThrow(
      'El producto se encuentra agotado'
    );
  });

  it('fetchOrderStatus calls correct endpoint and returns status', async () => {
    const mockStatus = {
      orderCode: 'ORD-7K2M9X',
      orderNumber: 1,
      tableName: 'Mesa 1',
      fulfillmentStatus: 'PREPARING',
      paymentStatus: 'UNPAID',
      totalAmount: 10000,
      createdAt: new Date().toISOString(),
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockStatus,
    } as unknown as Response);
    globalThis.fetch = fetchSpy;

    const res = await fetchOrderStatus('ORD-7K2M9X');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/orders/ORD-7K2M9X/status'),
      expect.any(Object)
    );

    expect(res.fulfillmentStatus).toBe('PREPARING');
  });
});
