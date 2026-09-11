import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import OpsDashboardView from './OpsDashboardView.vue';
import { useAuthStore } from '../stores/auth.js';
import * as api from '../services/api.js';
import { UserRole, FulfillmentStatus, PaymentStatus, PaymentMethodDeclared } from '@qr-menu/shared';

const replaceMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

describe('OpsDashboardView Component', () => {
  const sampleOrder = {
    id: '11111111-2222-3333-4444-555555555555',
    orderNumber: 101,
    publicCode: 'ORD-ABC123',
    tableName: 'Mesa 1',
    tableNumber: 1,
    fulfillmentStatus: FulfillmentStatus.PENDING,
    paymentStatus: PaymentStatus.UNPAID,
    paymentMethodDeclared: PaymentMethodDeclared.NEQUI,
    totalAmount: 10000,
    notes: 'Sin hielo',
    items: [
      {
        id: 1,
        productId: 1,
        productName: 'Cerveza Fría',
        unitPrice: 5000,
        quantity: 2,
        subtotal: 10000,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    replaceMock.mockClear();

    const auth = useAuthStore();
    auth.user = {
      id: 'user_1',
      username: 'cocinero_juan',
      role: UserRole.KITCHEN,
    };
  });

  it('renders navbar with operator username and role badge', async () => {
    vi.spyOn(api, 'fetchOpsOrdersApi').mockResolvedValue({
      orders: [sampleOrder],
    });

    const wrapper = mount(OpsDashboardView);
    await flushPromises();

    expect(wrapper.text()).toContain('El Mora');
    expect(wrapper.text()).toContain('Caja');
    expect(wrapper.text()).toContain('cocinero_juan');
    expect(wrapper.text()).toContain('KITCHEN');
    expect(wrapper.find('.order-card').exists()).toBe(true);
    expect(wrapper.text()).toContain('ORD-ABC123');
  });

  it('triggers prepare action when cook clicks preparar button', async () => {
    vi.spyOn(api, 'fetchOpsOrdersApi').mockResolvedValue({
      orders: [sampleOrder],
    });
    const updateSpy = vi.spyOn(api, 'updateFulfillmentApi').mockResolvedValue({
      ...sampleOrder,
      fulfillmentStatus: FulfillmentStatus.PREPARING,
    });

    const wrapper = mount(OpsDashboardView);
    await flushPromises();

    const btnPrepare = wrapper.find('.btn-prepare');
    expect(btnPrepare.exists()).toBe(true);

    await btnPrepare.trigger('click');
    await flushPromises();

    expect(updateSpy).toHaveBeenCalledWith(sampleOrder.id, FulfillmentStatus.PREPARING);
  });

  it('handles 409 conflict gracefully and shows conflict alert', async () => {
    vi.spyOn(api, 'fetchOpsOrdersApi').mockResolvedValue({
      orders: [sampleOrder],
    });
    vi.spyOn(api, 'updateFulfillmentApi').mockRejectedValue(
      new api.ApiClientError(
        'ORDER_STATE_CONFLICT',
        'El pedido ya fue tomado por otro operador',
        409
      )
    );

    const wrapper = mount(OpsDashboardView);
    await flushPromises();

    await wrapper.find('.btn-prepare').trigger('click');
    await flushPromises();

    expect(wrapper.find('.alert-error').exists()).toBe(true);
    expect(wrapper.text()).toContain('El pedido ya fue tomado por otro operador');
  });

  it('opens confirmation modal and confirms payment for cashier', async () => {
    const auth = useAuthStore();
    auth.user = {
      id: 'cashier_1',
      username: 'cajera_ana',
      role: UserRole.CASHIER,
    };

    vi.spyOn(api, 'fetchOpsOrdersApi').mockResolvedValue({
      orders: [sampleOrder],
    });
    const confirmSpy = vi.spyOn(api, 'confirmPaymentApi').mockResolvedValue({
      ...sampleOrder,
      paymentStatus: PaymentStatus.PAID,
    });

    const wrapper = mount(OpsDashboardView);
    await flushPromises();

    // Cajero ve el botón de confirmar pago
    const btnPay = wrapper.find('.btn-pay');
    expect(btnPay.exists()).toBe(true);

    await btnPay.trigger('click');
    await flushPromises();

    // Modal de confirmación debe aparecer
    expect(wrapper.find('.modal-backdrop').exists()).toBe(true);
    expect(wrapper.text()).toContain('¿Confirmas que el pedido');

    // Confirmar en el modal
    await wrapper.find('.btn-confirm-pay').trigger('click');
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalledWith(sampleOrder.id);
  });
});
