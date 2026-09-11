import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import OrderConfirmationView from './OrderConfirmationView.vue';
import * as api from '../services/api.js';
import { FulfillmentStatus, PaymentStatus } from '@qr-menu/shared';

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {
      tableToken: 't_m1_test',
      orderCode: 'ORD-TEST123',
    },
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('OrderConfirmationView Component & Polling Lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('mounts, fetches initial status, and displays order details', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchOrderStatus').mockResolvedValue({
      orderCode: 'ORD-TEST123',
      orderNumber: 42,
      tableName: 'Mesa 1',
      fulfillmentStatus: FulfillmentStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
      totalAmount: 15000,
      createdAt: new Date().toISOString(),
    });

    const wrapper = mount(OrderConfirmationView);
    await flushPromises();

    expect(fetchSpy).toHaveBeenCalledWith('ORD-TEST123');
    expect(wrapper.text()).toContain('ORD-TEST123');
    expect(wrapper.text()).toContain('Pedido #42');
    expect(wrapper.text()).toContain('Pedido recibido');
    expect(wrapper.text()).toContain('Mesa 1');
  });

  it('polls status every 5 seconds until DELIVERED', async () => {
    let callCount = 0;
    vi.spyOn(api, 'fetchOrderStatus').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          orderCode: 'ORD-TEST123',
          orderNumber: 42,
          tableName: 'Mesa 1',
          fulfillmentStatus: FulfillmentStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
          totalAmount: 15000,
          createdAt: new Date().toISOString(),
        };
      } else if (callCount === 2) {
        return {
          orderCode: 'ORD-TEST123',
          orderNumber: 42,
          tableName: 'Mesa 1',
          fulfillmentStatus: FulfillmentStatus.PREPARING,
          paymentStatus: PaymentStatus.UNPAID,
          totalAmount: 15000,
          createdAt: new Date().toISOString(),
        };
      } else {
        return {
          orderCode: 'ORD-TEST123',
          orderNumber: 42,
          tableName: 'Mesa 1',
          fulfillmentStatus: FulfillmentStatus.DELIVERED,
          paymentStatus: PaymentStatus.PAID,
          totalAmount: 15000,
          createdAt: new Date().toISOString(),
        };
      }
    });

    const wrapper = mount(OrderConfirmationView);
    await flushPromises();
    expect(callCount).toBe(1);

    // Avanzar 5 segundos -> Segunda llamada (PREPARING)
    vi.advanceTimersByTime(5000);
    await flushPromises();
    expect(callCount).toBe(2);
    expect(wrapper.text()).toContain('En preparación');

    // Avanzar otros 5 segundos -> Tercera llamada (DELIVERED)
    vi.advanceTimersByTime(5000);
    await flushPromises();
    expect(callCount).toBe(3);
    expect(wrapper.text()).toContain('¡Entregado!');

    // Avanzar otros 15 segundos -> NO deben ocurrir más llamadas porque DELIVERED detiene el polling
    vi.advanceTimersByTime(15000);
    await flushPromises();
    expect(callCount).toBe(3);
  });

  it('cleans up polling interval when unmounted', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchOrderStatus').mockResolvedValue({
      orderCode: 'ORD-TEST123',
      orderNumber: 42,
      tableName: 'Mesa 1',
      fulfillmentStatus: FulfillmentStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
      totalAmount: 15000,
      createdAt: new Date().toISOString(),
    });

    const wrapper = mount(OrderConfirmationView);
    await flushPromises();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Desmontar el componente
    wrapper.unmount();

    // Avanzar el tiempo: NO debe disparar más consultas
    vi.advanceTimersByTime(15000);
    await flushPromises();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
