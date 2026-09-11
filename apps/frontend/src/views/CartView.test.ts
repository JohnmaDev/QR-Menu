import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import CartView from './CartView.vue';
import { useCartStore } from '../stores/cart.js';
import * as api from '../services/api.js';
import { PaymentMethodDeclared } from '@qr-menu/shared';

const pushMock = vi.fn();
vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {
      tableToken: 't_m1_test',
    },
  }),
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe('CartView Component', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    pushMock.mockClear();
    localStorage.clear();
  });

  it('renders empty cart state when cart has no items', () => {
    const wrapper = mount(CartView);
    expect(wrapper.text()).toContain('Tu carrito está vacío');
    expect(wrapper.find('.empty-cart').exists()).toBe(true);

    const backBtn = wrapper.find('.action-btn');
    backBtn.trigger('click');
    expect(pushMock).toHaveBeenCalledWith('/m/t_m1_test');
  });

  it('renders items, calculates estimated total and allows editing quantities', async () => {
    const cart = useCartStore();
    cart.setTableToken('t_m1_test');
    cart.addItem({
      id: 1,
      name: 'Pilsen 330ml',
      description: 'Lata fría',
      price: 5000,
      imageUrl: null,
      sortOrder: 1,
    });

    const wrapper = mount(CartView);
    expect(wrapper.text()).toContain('Pilsen 330ml');
    expect(wrapper.text()).toContain('$5.000');

    // Incrementar cantidad
    const plusBtn = wrapper.findAll('.qty-btn')[1];
    await plusBtn.trigger('click');
    expect(cart.items[0].quantity).toBe(2);
    expect(wrapper.text()).toContain('$10.000');

    // Disminuir cantidad
    const minusBtn = wrapper.findAll('.qty-btn')[0];
    await minusBtn.trigger('click');
    expect(cart.items[0].quantity).toBe(1);

    // Eliminar producto
    const removeBtn = wrapper.find('.remove-btn');
    await removeBtn.trigger('click');
    expect(cart.isEmpty).toBe(true);
    expect(wrapper.text()).toContain('Tu carrito está vacío');
  });

  it('allows entering notes with character counter and selecting payment method', async () => {
    const cart = useCartStore();
    cart.setTableToken('t_m1_test');
    cart.addItem({
      id: 1,
      name: 'Pilsen 330ml',
      description: null,
      price: 5000,
      imageUrl: null,
      sortOrder: 1,
    });

    const wrapper = mount(CartView);

    // Nombre de cliente
    const nameInput = wrapper.find('.name-input');
    await nameInput.setValue('Carlos Mesa 1');
    expect(cart.customerName).toBe('Carlos Mesa 1');

    // Notas
    const textarea = wrapper.find('textarea');
    await textarea.setValue('Sin hielo y bien frías');
    expect(cart.notes).toBe('Sin hielo y bien frías');
    expect(wrapper.text()).toContain('22 / 150 caracteres');

    // Cambiar método de pago a Bre-B
    const paymentButtons = wrapper.findAll('.payment-option');
    const breBBtn = paymentButtons.find((btn) => btn.text().includes('Bre-B'));
    expect(breBBtn).toBeDefined();
    await breBBtn!.trigger('click');
    expect(cart.paymentMethodDeclared).toBe(PaymentMethodDeclared.BRE_B);
  });

  it('submits order successfully, clears cart, and navigates to confirmation', async () => {
    const cart = useCartStore();
    cart.setTableToken('t_m1_test');
    cart.addItem({
      id: 1,
      name: 'Pilsen 330ml',
      description: null,
      price: 5000,
      imageUrl: null,
      sortOrder: 1,
    });

    const submitSpy = vi.spyOn(api, 'submitOrder').mockResolvedValue({
      orderCode: 'ORD-TEST123',
      orderNumber: 1,
      tableName: 'Mesa 1',
      fulfillmentStatus: 'PENDING',
      paymentStatus: 'UNPAID',
      totalAmount: 5000,
      createdAt: new Date().toISOString(),
    });

    const expectedIdempotencyKey = cart.idempotencyKey;

    const wrapper = mount(CartView);
    const submitBtn = wrapper.find('.submit-order-btn');
    await submitBtn.trigger('click');

    expect(submitSpy).toHaveBeenCalledTimes(1);
    const [payload, idempotencyKey] = submitSpy.mock.calls[0];
    expect(payload.tableToken).toBe('t_m1_test');
    expect(payload.items).toEqual([{ productId: 1, quantity: 1 }]);
    // Sovereign check: payload has no client-calculated prices or totalAmount
    expect(payload).not.toHaveProperty('totalAmount');
    expect(payload.items[0]).not.toHaveProperty('unitPrice');
    expect(idempotencyKey).toBe(expectedIdempotencyKey);

    await flushPromises();

    expect(cart.isEmpty).toBe(true);
    expect(pushMock).toHaveBeenCalledWith('/m/t_m1_test/confirmation/ORD-TEST123');
  });

  it('handles 409 Conflict with friendly message', async () => {
    const cart = useCartStore();
    cart.setTableToken('t_m1_test');
    cart.addItem({
      id: 1,
      name: 'Pilsen 330ml',
      description: null,
      price: 5000,
      imageUrl: null,
      sortOrder: 1,
    });

    vi.spyOn(api, 'submitOrder').mockRejectedValue(
      new api.ApiClientError('CONFLICT', 'Menu item changed', 409)
    );

    const wrapper = mount(CartView);
    const submitBtn = wrapper.find('.submit-order-btn');
    await submitBtn.trigger('click');
    await flushPromises();

    expect(cart.lastError).toContain('El menú o la disponibilidad han cambiado');
    expect(wrapper.text()).toContain('El menú o la disponibilidad han cambiado');
    expect(cart.isEmpty).toBe(false); // Carrito no se borra ante conflicto
  });
});
