import { defineStore } from 'pinia';
import { MenuItem, PaymentMethodDeclared, CreateOrderInput } from '@qr-menu/shared';

export interface CartItem {
  product: MenuItem;
  quantity: number;
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback simple para navegadores antiguos
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    tableToken: '',
    customerName: '',
    items: [] as CartItem[],
    notes: '',
    paymentMethodDeclared: PaymentMethodDeclared.CASH as PaymentMethodDeclared,
    idempotencyKey: generateUUID(),
    isSubmitting: false,
    lastError: null as string | null,
  }),

  getters: {
    totalCount: (state): number => {
      return state.items.reduce((acc, item) => acc + item.quantity, 0);
    },

    /**
     * Total estimado exclusivamente para previsualización en la interfaz.
     * El total soberano y definitivo es calculado por el backend.
     */
    estimatedTotal: (state): number => {
      return state.items.reduce(
        (acc, item) => acc + item.product.price * item.quantity,
        0
      );
    },

    isEmpty(): boolean {
      return this.totalCount === 0;
    },

    getItemQuantity: (state) => (productId: number): number => {
      const found = state.items.find((i) => i.product.id === productId);
      return found ? found.quantity : 0;
    },
  },

  actions: {
    setTableToken(token: string) {
      if (this.tableToken !== token) {
        this.tableToken = token;
        this.loadPersisted();
      }
    },

    addItem(product: MenuItem) {
      const existing = this.items.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity < 50) {
          existing.quantity += 1;
        }
      } else {
        this.items.push({ product, quantity: 1 });
      }
      this.persist();
    },

    incrementItem(productId: number) {
      const existing = this.items.find((i) => i.product.id === productId);
      if (existing && existing.quantity < 50) {
        existing.quantity += 1;
        this.persist();
      }
    },

    decrementItem(productId: number) {
      const index = this.items.findIndex((i) => i.product.id === productId);
      if (index !== -1) {
        if (this.items[index].quantity > 1) {
          this.items[index].quantity -= 1;
        } else {
          this.items.splice(index, 1);
        }
        this.persist();
      }
    },

    removeItem(productId: number) {
      const index = this.items.findIndex((i) => i.product.id === productId);
      if (index !== -1) {
        this.items.splice(index, 1);
        this.persist();
      }
    },

    clearCart() {
      this.items = [];
      this.customerName = '';
      this.notes = '';
      this.lastError = null;
      this.refreshIdempotencyKey();
      this.persist();
    },

    setCustomerName(name: string) {
      if (name.length <= 50) {
        this.customerName = name;
        this.persist();
      }
    },

    setNotes(notes: string) {
      if (notes.length <= 150) {
        this.notes = notes;
        this.persist();
      }
    },

    setPaymentMethod(method: PaymentMethodDeclared) {
      this.paymentMethodDeclared = method;
      this.persist();
    },

    refreshIdempotencyKey() {
      this.idempotencyKey = generateUUID();
      this.persist();
    },

    prepareOrderPayload(): CreateOrderInput {
      return {
        tableToken: this.tableToken,
        paymentMethodDeclared: this.paymentMethodDeclared,
        customerName: this.customerName.trim() || undefined,
        notes: this.notes.trim() || undefined,
        items: this.items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
      };
    },

    persist() {
      if (!this.tableToken || typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      try {
        const storageKey = `qr_menu_cart_${this.tableToken}`;
        const data = {
          items: this.items,
          customerName: this.customerName,
          notes: this.notes,
          paymentMethodDeclared: this.paymentMethodDeclared,
          idempotencyKey: this.idempotencyKey,
        };
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        // Ignorar errores de cuota en modo incógnito
      }
    },

    loadPersisted() {
      if (!this.tableToken || typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      try {
        const storageKey = `qr_menu_cart_${this.tableToken}`;
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.items)) {
          // Sanitizar y validar ítems cargados
          this.items = parsed.items
            .filter(
              (i: any) =>
                i &&
                i.product &&
                typeof i.product.id === 'number' &&
                typeof i.quantity === 'number' &&
                i.quantity > 0 &&
                i.quantity <= 50
            )
            .map((i: any) => ({
              product: i.product,
              quantity: Math.floor(i.quantity),
            }));
        }

        if (typeof parsed.customerName === 'string') {
          this.customerName = parsed.customerName.slice(0, 50);
        }

        if (typeof parsed.notes === 'string') {
          this.notes = parsed.notes.slice(0, 150);
        }

        if (
          parsed.paymentMethodDeclared &&
          Object.values(PaymentMethodDeclared).includes(parsed.paymentMethodDeclared)
        ) {
          this.paymentMethodDeclared = parsed.paymentMethodDeclared;
        }

        if (typeof parsed.idempotencyKey === 'string' && parsed.idempotencyKey.length >= 6) {
          this.idempotencyKey = parsed.idempotencyKey;
        }
      } catch {
        // En caso de corrupción, descartar datos locales
      }
    },
  },
});
