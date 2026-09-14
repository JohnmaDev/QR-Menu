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
      username: 'cajero_juan',
      role: UserRole.CASHIER,
    };
  });

  it('renders navbar with operator username and role badge', async () => {
    vi.spyOn(api, 'fetchOpsOrdersApi').mockResolvedValue({
      orders: [sampleOrder],
    });

    const wrapper = mount(OpsDashboardView);
    await flushPromises();

    expect(wrapper.text()).toContain('Licores Distrito 4');
    expect(wrapper.text()).toContain('Caja');
    expect(wrapper.text()).toContain('cajero_juan');
    expect(wrapper.text()).toContain('CASHIER');
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

  it('removes cancelled orders from active view and does not count them as active', async () => {
    const cancelledOrder = {
      ...sampleOrder,
      id: '22222222-3333-4444-5555-666666666666',
      orderNumber: 102,
      publicCode: 'ORD-CANCEL99',
      fulfillmentStatus: FulfillmentStatus.CANCELLED,
      paymentStatus: PaymentStatus.UNPAID,
    };

    vi.spyOn(api, 'fetchOpsOrdersApi').mockResolvedValue({
      orders: [cancelledOrder],
    });

    const wrapper = mount(OpsDashboardView);
    await flushPromises();

    // En la vista de activos no debe aparecer la tarjeta del pedido cancelado
    expect(wrapper.find('.order-card').exists()).toBe(false);

    // El contador de activos debe ser 0
    const activeCounter = wrapper.find('.tab-active .tab-counter');
    expect(activeCounter.text()).toBe('0');

    // Cambiar a la pestaña de Historial
    const tabHistory = wrapper.find('.tab-history');
    await tabHistory.trigger('click');
    await flushPromises();

    // En historial sí debe estar presente
    expect(wrapper.find('.order-card').exists()).toBe(true);
    expect(wrapper.text()).toContain('ORD-CANCEL99');
  });

  it('toggles payments menu open and closed with quick-cash-pill and returns to previous tab', async () => {
    vi.spyOn(api, 'fetchOpsOrdersApi').mockResolvedValue({
      orders: [sampleOrder],
    });

    const wrapper = mount(OpsDashboardView, {
      global: {
        stubs: {
          Icon: true,
          LoadingSpinner: true,
        },
      },
    });

    await flushPromises();

    // Inicialmente estamos en la pestaña de Activos
    expect(wrapper.find('.tab-active').classes()).toContain('active');
    expect(wrapper.find('.history-dashboard-header').exists()).toBe(false);

    const quickCashPill = wrapper.find('.quick-cash-pill');
    expect(quickCashPill.exists()).toBe(true);
    expect(quickCashPill.classes()).not.toContain('is-open');
    expect(quickCashPill.text()).toContain('Pagos Hoy:');

    // Primer clic en Pagos Hoy: despliega el menú de pagos e historial
    await quickCashPill.trigger('click');
    await flushPromises();

    expect(wrapper.find('.history-dashboard-header').exists()).toBe(true);
    expect(wrapper.find('.tab-history').classes()).toContain('active');
    expect(quickCashPill.classes()).toContain('is-open');

    // Segundo clic en Pagos Hoy: vuelve a esconder el menú de pagos y regresa a Activos
    await quickCashPill.trigger('click');
    await flushPromises();

    expect(wrapper.find('.history-dashboard-header').exists()).toBe(false);
    expect(wrapper.find('.tab-active').classes()).toContain('active');
    expect(quickCashPill.classes()).not.toContain('is-open');

    // Si estábamos en otra pestaña (por ejemplo En Preparación) y abrimos pagos,
    // al volver a hacer clic en Pagos Hoy debe regresar a Preparación
    const tabPreparing = wrapper.find('.tab-preparing');
    await tabPreparing.trigger('click');
    await flushPromises();
    expect(tabPreparing.classes()).toContain('active');

    // Abrir pagos desde el botón superior
    await quickCashPill.trigger('click');
    await flushPromises();
    expect(wrapper.find('.history-dashboard-header').exists()).toBe(true);
    expect(quickCashPill.classes()).toContain('is-open');

    // Volver a hacer clic en Pagos Hoy: lo esconde y regresa a Preparación
    await quickCashPill.trigger('click');
    await flushPromises();

    expect(wrapper.find('.history-dashboard-header').exists()).toBe(false);
    expect(wrapper.find('.tab-preparing').classes()).toContain('active');
    expect(quickCashPill.classes()).not.toContain('is-open');
  });
});

