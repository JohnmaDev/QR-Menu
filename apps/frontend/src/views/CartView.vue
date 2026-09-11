<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCartStore } from '../stores/cart.js';
import { submitOrder, ApiClientError } from '../services/api.js';
import { formatCOP } from '../utils/currency.js';
import { PaymentMethodDeclared } from '@qr-menu/shared';
import ErrorMessage from '../components/common/ErrorMessage.vue';
import Icon from '../components/common/Icon.vue';

const route = useRoute();
const router = useRouter();
const cart = useCartStore();

const tableToken = computed(() => (route.params.tableToken as string) || cart.tableToken);

// Asegurar sincronización con la mesa actual
if (tableToken.value && cart.tableToken !== tableToken.value) {
  cart.setTableToken(tableToken.value);
}

const paymentOptions = [
  { value: PaymentMethodDeclared.CASH, label: 'Efectivo', iconName: 'cash' },
  { value: PaymentMethodDeclared.BRE_B, label: 'Bre-B', iconName: 'bre-b' },
  { value: PaymentMethodDeclared.NEQUI, label: 'Nequi', iconName: 'nequi' },
  { value: PaymentMethodDeclared.BANCOLOMBIA, label: 'Bancolombia', iconName: 'bancolombia' },
];

function goBackToMenu() {
  router.push(`/m/${tableToken.value}`);
}

async function handleConfirmOrder() {
  if (cart.isEmpty || cart.isSubmitting) return;

  cart.isSubmitting = true;
  cart.lastError = null;

  try {
    const payload = cart.prepareOrderPayload();
    const createdOrder = await submitOrder(payload, cart.idempotencyKey);

    // Éxito: vaciar carrito y redirigir a confirmación con código de seguimiento
    cart.clearCart();
    router.push(`/m/${tableToken.value}/confirmation/${createdOrder.orderCode}`);
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      if (err.statusCode === 409) {
        cart.lastError =
          'El menú o la disponibilidad han cambiado mientras realizabas tu pedido. Por favor revisa los ítems antes de reintentar.';
      } else {
        cart.lastError = err.message;
      }
    } else {
      cart.lastError = 'No pudimos enviar tu pedido. Por favor verifica tu conexión y reintenta.';
    }
  } finally {
    cart.isSubmitting = false;
  }
}
</script>

<template>
  <main class="cart-view-container">
    <header class="cart-header">
      <button type="button" class="back-link" @click="goBackToMenu">
        <Icon name="arrow-left" :size="16" />
        <span>Volver al Menú</span>
      </button>
      <div class="title-row">
        <h1>Tu Pedido</h1>
        <span v-if="tableToken" class="table-tag">
          <Icon name="table" :size="12" color="var(--accent-gold)" />
          Mesa Activa
        </span>
      </div>
    </header>

    <!-- Error Alert -->
    <div v-if="cart.lastError" class="alert-box">
      <ErrorMessage
        :message="cart.lastError"
        retry-label="Entendido"
        @retry="cart.lastError = null"
      />
    </div>

    <!-- Carrito Vacío -->
    <div v-if="cart.isEmpty" class="empty-cart" role="status">
      <div class="empty-icon-circle">
        <Icon name="cart" :size="42" color="var(--text-muted)" />
      </div>
      <h2>Tu carrito está vacío</h2>
      <p>Explora nuestro menú y agrega tus bebidas o snacks favoritos.</p>
      <button type="button" class="action-btn" @click="goBackToMenu">
        <Icon name="beer" :size="18" />
        <span>Ver Menú</span>
      </button>
    </div>

    <!-- Contenido del Carrito -->
    <div v-else class="cart-content">
      <section class="items-section" aria-label="Productos en el carrito">
        <div v-for="item in cart.items" :key="item.product.id" class="cart-item-row">
          <div class="item-main">
            <h3 class="item-name">{{ item.product.name }}</h3>
            <span class="item-unit-price">{{ formatCOP(item.product.price) }} c/u</span>
          </div>

          <div class="item-controls">
            <div class="qty-pill">
              <button
                type="button"
                class="qty-btn"
                aria-label="Disminuir cantidad"
                @click="cart.decrementItem(item.product.id)"
              >
                <Icon name="minus" :size="13" />
              </button>
              <span class="qty-number">{{ item.quantity }}</span>
              <button
                type="button"
                class="qty-btn"
                aria-label="Aumentar cantidad"
                @click="cart.incrementItem(item.product.id)"
              >
                <Icon name="plus" :size="13" />
              </button>
            </div>
            <span class="item-subtotal">
              {{ formatCOP(item.product.price * item.quantity) }}
            </span>
            <button
              type="button"
              class="remove-btn"
              aria-label="Eliminar producto"
              @click="cart.removeItem(item.product.id)"
            >
              <Icon name="trash" :size="15" />
            </button>
          </div>
        </div>
      </section>

      <!-- Nombre del cliente (opcional) -->
      <section class="customer-section">
        <div class="section-label-row">
          <Icon name="user" :size="16" color="var(--accent-gold)" />
          <label for="customer-name" class="section-label">
            ¿A nombre de quién? (opcional)
          </label>
        </div>
        <input
          id="customer-name"
          v-model="cart.customerName"
          type="text"
          class="name-input"
          maxlength="50"
          placeholder="Ej: Carlos, Mesa VIP..."
          @input="cart.persist()"
        />
      </section>

      <!-- Notas para el pedido -->
      <section class="notes-section">
        <div class="section-label-row">
          <Icon name="note" :size="16" color="var(--accent-gold)" />
          <label for="order-notes" class="section-label">
            Notas para la barra (opcional)
          </label>
        </div>
        <textarea
          id="order-notes"
          v-model="cart.notes"
          class="notes-input"
          maxlength="150"
          placeholder="Ej: Bien frías, sin hielo, servilletas extra..."
          rows="2"
          @input="cart.persist()"
        ></textarea>
        <div class="char-count" aria-live="polite">
          {{ cart.notes.length }} / 150 caracteres
        </div>
      </section>

      <!-- Método de pago declarado -->
      <section class="payment-section">
        <div class="section-label-row">
          <Icon name="card" :size="16" color="var(--accent-gold)" />
          <h2 class="section-label">¿Cómo deseas pagar?</h2>
        </div>
        <div class="payment-grid" role="radiogroup" aria-label="Métodos de pago">
          <button
            v-for="opt in paymentOptions"
            :key="opt.value"
            type="button"
            class="payment-option"
            :class="{ selected: cart.paymentMethodDeclared === opt.value }"
            role="radio"
            :aria-checked="cart.paymentMethodDeclared === opt.value"
            @click="cart.setPaymentMethod(opt.value)"
          >
            <div class="payment-icon-wrap">
              <Icon :name="opt.iconName" :size="20" />
            </div>
            <span class="payment-text">{{ opt.label }}</span>
            <div v-if="cart.paymentMethodDeclared === opt.value" class="payment-selected-indicator">
              <Icon name="check" :size="12" />
            </div>
          </button>
        </div>
      </section>

      <!-- Resumen y Confirmación -->
      <footer class="checkout-footer">
        <div class="summary-card">
          <div class="total-row">
            <span class="total-title">Total a Pagar</span>
            <span class="total-value">{{ formatCOP(cart.estimatedTotal) }}</span>
          </div>
          <p class="sovereign-disclaimer">
            * El total exacto es garantizado por el sistema al enviar tu orden.
          </p>
        </div>

        <button
          type="button"
          class="submit-order-btn"
          :disabled="cart.isSubmitting"
          @click="handleConfirmOrder"
        >
          <span v-if="cart.isSubmitting" class="submitting-state">
            <span class="btn-spinner" />
            Enviando a la barra...
          </span>
          <span v-else class="submit-state">
            <span>Confirmar Pedido</span>
            <span class="btn-price-tag">{{ formatCOP(cart.estimatedTotal) }}</span>
          </span>
        </button>

        <button
          type="button"
          class="clear-cart-link"
          :disabled="cart.isSubmitting"
          @click="cart.clearCart"
        >
          Vaciar carrito
        </button>
      </footer>
    </div>
  </main>
</template>

<style scoped>
.cart-view-container {
  max-width: 520px;
  margin: 0 auto;
  padding: 20px 16px 40px 16px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.cart-header {
  margin-bottom: 24px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  color: var(--accent-gold);
  font-size: 0.88rem;
  font-weight: 600;
  padding: 4px 0;
  margin-bottom: 12px;
}

.back-link:hover {
  filter: brightness(1.2);
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-row h1 {
  font-family: var(--font-heading);
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.table-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-primary);
}

.alert-box {
  margin-bottom: 20px;
}

.empty-cart {
  text-align: center;
  padding: 60px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-icon-circle {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
}

.empty-cart h2 {
  font-size: 1.35rem;
  margin-bottom: 8px;
}

.empty-cart p {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-bottom: 24px;
  max-width: 300px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--accent-gold-gradient);
  color: #0b0e14;
  font-weight: 700;
  font-size: 0.92rem;
  padding: 12px 24px;
  border-radius: var(--radius-full);
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
}

.cart-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.items-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cart-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--bg-card-glass);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.item-name {
  font-family: var(--font-heading);
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-unit-price {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.item-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.qty-pill {
  display: inline-flex;
  align-items: center;
  background: var(--bg-surface);
  border: 1px solid var(--border-highlight);
  border-radius: var(--radius-full);
  padding: 2px;
}

.qty-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: transparent;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.qty-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.qty-number {
  min-width: 22px;
  text-align: center;
  font-family: var(--font-heading);
  font-size: 0.88rem;
  font-weight: 800;
  color: var(--accent-gold);
}

.item-subtotal {
  font-family: var(--font-heading);
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  min-width: 65px;
  text-align: right;
}

.remove-btn {
  background: rgba(244, 63, 94, 0.1);
  color: var(--accent-red);
  border: 1px solid rgba(244, 63, 94, 0.2);
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.remove-btn:hover {
  background: rgba(244, 63, 94, 0.2);
  border-color: var(--accent-red);
  transform: scale(1.05);
}

.section-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.section-label {
  font-family: var(--font-heading);
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-primary);
}

.name-input,
.notes-input {
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  line-height: 1.4;
}

.notes-input {
  resize: none;
}

.char-count {
  font-size: 0.72rem;
  color: var(--text-muted);
  text-align: right;
  margin-top: 4px;
}

.payment-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.payment-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  text-align: left;
}

.payment-option:hover {
  border-color: var(--border-highlight);
  background: var(--bg-card-hover);
  color: var(--text-primary);
}

.payment-option.selected {
  background: rgba(245, 158, 11, 0.08);
  border-color: var(--accent-gold);
  color: var(--text-primary);
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.15);
}

.payment-icon-wrap {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-gold);
  transition: all 0.2s;
}

.payment-option.selected .payment-icon-wrap {
  background: var(--accent-gold);
  color: #0b0e14;
}

.payment-text {
  font-size: 0.88rem;
  font-weight: 600;
}

.payment-selected-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-gold);
  color: #0b0e14;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkout-footer {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.summary-card {
  background: var(--bg-card-glass);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 16px 18px;
}

.total-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}

.total-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.total-value {
  font-family: var(--font-heading);
  font-size: 1.55rem;
  font-weight: 800;
  color: var(--accent-gold);
  letter-spacing: -0.02em;
}

.sovereign-disclaimer {
  font-size: 0.74rem;
  color: var(--text-muted);
  line-height: 1.3;
}

.submit-order-btn {
  width: 100%;
  padding: 16px 20px;
  border-radius: var(--radius-full);
  background: var(--accent-gold-gradient);
  color: #0b0e14;
  font-family: var(--font-sans);
  font-size: 1rem;
  font-weight: 800;
  box-shadow: 0 4px 20px rgba(245, 158, 11, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-order-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(245, 158, 11, 0.45);
}

.submit-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.btn-price-tag {
  background: rgba(11, 14, 20, 0.25);
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-family: var(--font-heading);
  font-size: 0.95rem;
}

.submitting-state {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(11, 14, 20, 0.3);
  border-top-color: #0b0e14;
  border-radius: 50%;
  animation: spin-loader 0.8s infinite linear;
}

.clear-cart-link {
  background: transparent;
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 500;
  align-self: center;
  padding: 6px 12px;
  transition: color 0.2s;
}

.clear-cart-link:hover {
  color: var(--accent-red);
}
</style>
