import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCartStore } from './cart.js';
import { MenuItem, PaymentMethodDeclared } from '@qr-menu/shared';

describe('Frontend Cart Store (Pinia)', () => {
  const sampleProduct1: MenuItem = {
    id: 1,
    name: 'Pilsen 330ml',
    description: 'Lata bien fría',
    price: 5000,
    imageUrl: null,
    sortOrder: 1,
  };

  const sampleProduct2: MenuItem = {
    id: 2,
    name: 'Papas Lays',
    description: 'Paquete mediano',
    price: 3500,
    imageUrl: null,
    sortOrder: 2,
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('initializes with empty state and default payment method', () => {
    const cart = useCartStore();
    expect(cart.items).toEqual([]);
    expect(cart.totalCount).toBe(0);
    expect(cart.estimatedTotal).toBe(0);
    expect(cart.isEmpty).toBe(true);
    expect(cart.paymentMethodDeclared).toBe(PaymentMethodDeclared.CASH);
    expect(cart.idempotencyKey).toBeDefined();
  });

  it('adds items and calculates visual estimated total correctly', () => {
    const cart = useCartStore();
    cart.addItem(sampleProduct1);
    cart.addItem(sampleProduct1); // Segundo de lo mismo
    cart.addItem(sampleProduct2);

    expect(cart.items.length).toBe(2);
    expect(cart.totalCount).toBe(3);
    // 2 * 5000 + 1 * 3500 = 13500
    expect(cart.estimatedTotal).toBe(13500);
    expect(cart.getItemQuantity(1)).toBe(2);
    expect(cart.getItemQuantity(2)).toBe(1);
    expect(cart.isEmpty).toBe(false);
  });

  it('increments and decrements items cleanly', () => {
    const cart = useCartStore();
    cart.addItem(sampleProduct1);
    cart.incrementItem(1);
    expect(cart.getItemQuantity(1)).toBe(2);

    cart.decrementItem(1);
    expect(cart.getItemQuantity(1)).toBe(1);

    // Decrementar cuando queda 1 debe eliminar el ítem del carrito
    cart.decrementItem(1);
    expect(cart.getItemQuantity(1)).toBe(0);
    expect(cart.items.length).toBe(0);
    expect(cart.isEmpty).toBe(true);
  });

  it('enforces maximum item quantity limit of 50', () => {
    const cart = useCartStore();
    cart.addItem(sampleProduct1);
    const item = cart.items[0];
    item.quantity = 50;

    // Intentar incrementar más allá de 50
    cart.incrementItem(1);
    expect(item.quantity).toBe(50);
  });

  it('removes item directly', () => {
    const cart = useCartStore();
    cart.addItem(sampleProduct1);
    cart.addItem(sampleProduct2);

    cart.removeItem(1);
    expect(cart.items.length).toBe(1);
    expect(cart.items[0].product.id).toBe(2);
  });

  it('clears cart and refreshes idempotency key', () => {
    const cart = useCartStore();
    cart.addItem(sampleProduct1);
    cart.setNotes('Bien frías');
    const oldKey = cart.idempotencyKey;

    cart.clearCart();
    expect(cart.items.length).toBe(0);
    expect(cart.notes).toBe('');
    expect(cart.isEmpty).toBe(true);
    expect(cart.idempotencyKey).not.toBe(oldKey);
  });

  it('enforces notes length limit (max 150 chars)', () => {
    const cart = useCartStore();
    cart.setNotes('A'.repeat(150));
    expect(cart.notes.length).toBe(150);

    cart.setNotes('A'.repeat(151)); // No debe sobreescribir si supera 150
    expect(cart.notes.length).toBe(150);
  });

  it('persists and restores cart from localStorage scoped by tableToken', () => {
    const cart = useCartStore();
    cart.setTableToken('t_m1_test');
    cart.addItem(sampleProduct1);
    cart.setNotes('Sin sal');
    cart.setPaymentMethod(PaymentMethodDeclared.NEQUI);

    // Crear nueva instancia de store simulando recarga de página
    setActivePinia(createPinia());
    const reloadedCart = useCartStore();
    reloadedCart.setTableToken('t_m1_test');

    expect(reloadedCart.items.length).toBe(1);
    expect(reloadedCart.items[0].product.id).toBe(1);
    expect(reloadedCart.notes).toBe('Sin sal');
    expect(reloadedCart.paymentMethodDeclared).toBe(PaymentMethodDeclared.NEQUI);
  });

  // ============================================================================
  // TEST DE SEGURIDAD FRONTEND (Section 29)
  // ============================================================================
  it('SECURITY TEST: prepareOrderPayload does NOT send any price, subtotal or total', () => {
    const cart = useCartStore();
    cart.setTableToken('t_m1_test');
    cart.addItem(sampleProduct1);
    cart.addItem(sampleProduct2);

    const payload = cart.prepareOrderPayload();

    // Validar estructura de payload estricta enviada al backend
    expect(payload).toHaveProperty('tableToken', 't_m1_test');
    expect(payload).toHaveProperty('paymentMethodDeclared', PaymentMethodDeclared.CASH);
    expect(payload).toHaveProperty('items');

    // Verificar que CADA ítem SOLO contenga productId y quantity
    for (const item of payload.items) {
      expect(item).toHaveProperty('productId');
      expect(item).toHaveProperty('quantity');

      // NUNCA debe enviar campos de precio ni subtotales manipulables
      expect(item).not.toHaveProperty('price');
      expect(item).not.toHaveProperty('unitPrice');
      expect(item).not.toHaveProperty('subtotal');
    }

    // NUNCA debe enviar total general calculado
    expect(payload).not.toHaveProperty('total');
    expect(payload).not.toHaveProperty('totalAmount');
    expect(payload).not.toHaveProperty('estimatedTotal');
  });
});
