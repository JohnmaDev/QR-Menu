<script setup lang="ts">
import { formatCOP } from '../../utils/currency.js';
import Icon from '../common/Icon.vue';

defineProps<{
  totalCount: number;
  estimatedTotal: number;
}>();

defineEmits<{
  (e: 'viewCart'): void;
}>();
</script>

<template>
  <div v-if="totalCount > 0" class="bottom-cart-wrapper" role="region" aria-label="Resumen del carrito">
    <div class="bottom-cart-bar">
      <div class="cart-summary">
        <div class="cart-icon-pill">
          <Icon name="cart" :size="18" color="var(--accent-gold)" />
          <span class="count-bubble">{{ totalCount }}</span>
        </div>
        <div class="cart-total-info">
          <span class="total-label">Total a pagar</span>
          <span class="total-amount">{{ formatCOP(estimatedTotal) }}</span>
        </div>
      </div>
      <button
        type="button"
        class="view-cart-btn"
        aria-label="Ver y confirmar pedido"
        @click="$emit('viewCart')"
      >
        <span>Ver Pedido</span>
        <Icon name="chevron-right" :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.bottom-cart-wrapper {
  position: fixed;
  bottom: 20px;
  left: 0;
  right: 0;
  padding: 0 16px;
  z-index: 50;
  max-width: 520px;
  margin: 0 auto;
  animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.bottom-cart-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(21, 29, 46, 0.94);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 10px 14px 10px 16px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(245, 158, 11, 0.35);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(245, 158, 11, 0.15);
}

.cart-summary {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cart-icon-pill {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.count-bubble {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--accent-gold-gradient);
  color: #0b0e14;
  font-family: var(--font-heading);
  font-size: 0.72rem;
  font-weight: 800;
  width: 19px;
  height: 19px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.cart-total-info {
  display: flex;
  flex-direction: column;
}

.total-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  line-height: 1;
}

.total-amount {
  font-family: var(--font-heading);
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.view-cart-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent-gold-gradient);
  color: #0b0e14;
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 0.9rem;
  padding: 10px 18px;
  border-radius: var(--radius-full);
  box-shadow: 0 2px 10px rgba(245, 158, 11, 0.3);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.view-cart-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
}

.view-cart-btn:active {
  transform: scale(0.96);
}
</style>
