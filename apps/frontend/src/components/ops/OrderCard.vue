<script setup lang="ts">
import { computed } from 'vue';
import {
  OpsOrder,
  UserRole,
  FulfillmentStatus,
  PaymentStatus,
  PaymentMethodDeclared,
} from '@qr-menu/shared';
import { formatCOP } from '../../utils/currency.js';
import Icon from '../common/Icon.vue';
import PaymentBrandLogo from '../common/PaymentBrandLogo.vue';

const props = defineProps<{
  order: OpsOrder;
  userRole: UserRole;
  isMutating: boolean;
}>();

const emit = defineEmits<{
  (e: 'prepare', orderId: string): void;
  (e: 'deliver', orderId: string): void;
  (e: 'confirmPayment', order: OpsOrder): void;
  (e: 'cancel', order: OpsOrder): void;
}>();

// Permisos según rol (CASHIER y ADMIN gestionan el ciclo operativo completo)
const canPrepare = computed(() => {
  return (
    (props.userRole === UserRole.ADMIN || props.userRole === UserRole.CASHIER) &&
    props.order.fulfillmentStatus === FulfillmentStatus.PENDING
  );
});

const canDeliver = computed(() => {
  return (
    (props.userRole === UserRole.ADMIN || props.userRole === UserRole.CASHIER) &&
    props.order.fulfillmentStatus === FulfillmentStatus.PREPARING
  );
});

const canConfirmPayment = computed(() => {
  return (
    (props.userRole === UserRole.ADMIN || props.userRole === UserRole.CASHIER) &&
    props.order.paymentStatus === PaymentStatus.UNPAID &&
    props.order.fulfillmentStatus !== FulfillmentStatus.CANCELLED
  );
});

const canCancel = computed(() => {
  return (
    (props.userRole === UserRole.ADMIN || props.userRole === UserRole.CASHIER) &&
    props.order.fulfillmentStatus !== FulfillmentStatus.DELIVERED &&
    props.order.fulfillmentStatus !== FulfillmentStatus.CANCELLED
  );
});

// Clases de estado
const isPending = computed(() => props.order.fulfillmentStatus === FulfillmentStatus.PENDING);
const isPreparing = computed(() => props.order.fulfillmentStatus === FulfillmentStatus.PREPARING);
const isDelivered = computed(() => props.order.fulfillmentStatus === FulfillmentStatus.DELIVERED);
const isCancelled = computed(() => props.order.fulfillmentStatus === FulfillmentStatus.CANCELLED);
const isPaid = computed(() => props.order.paymentStatus === PaymentStatus.PAID);

// Formateo de fecha relativa o legible
const formattedDate = computed(() => {
  try {
    const d = new Date(props.order.createdAt);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
});

const paymentMethodLabel = computed(() => {
  switch (props.order.paymentMethodDeclared) {
    case PaymentMethodDeclared.CASH:
      return 'Efectivo';
    case PaymentMethodDeclared.BRE_B:
      return 'Bre-B';
    case PaymentMethodDeclared.NEQUI:
      return 'Nequi';
    case PaymentMethodDeclared.BANCOLOMBIA:
      return 'Bancolombia';
    default:
      return props.order.paymentMethodDeclared;
  }
});
</script>

<template>
  <article
    class="order-card"
    :class="{
      'status-pending': isPending,
      'status-preparing': isPreparing,
      'status-delivered': isDelivered,
      'status-cancelled': isCancelled,
    }"
  >
    <header class="card-header">
      <div class="table-info">
        <span class="table-badge">{{ props.order.tableName }}</span>
        <span v-if="props.order.customerName" class="customer-badge">
          <Icon name="user" :size="12" />
          {{ props.order.customerName }}
        </span>
        <span class="order-code-badge">
          <span class="code-primary">{{ props.order.publicCode }}</span>
          <span class="code-turn" title="Consecutivo del día">
            #{{ props.order.dailyOrderNumber ? String(props.order.dailyOrderNumber).padStart(2, '0') : props.order.orderNumber }}
          </span>
        </span>
      </div>
      <div class="time-info">
        <Icon name="clock" :size="13" color="var(--text-muted)" />
        <span>{{ formattedDate }}</span>
      </div>
    </header>

    <div class="status-badges">
      <!-- Fulfillment Badge -->
      <span v-if="isPending" class="badge badge-pending">
        <span class="badge-dot" />
        Pendiente
      </span>
      <span v-else-if="isPreparing" class="badge badge-preparing">
        <Icon name="fire" :size="12" />
        En Preparación
      </span>
      <span v-else-if="isDelivered" class="badge badge-delivered">
        <Icon name="check" :size="12" />
        Entregado
      </span>
      <span v-else-if="isCancelled" class="badge badge-cancelled">
        <Icon name="alert" :size="12" />
        Cancelado
      </span>

      <!-- Payment Status Badge -->
      <span v-if="isPaid" class="badge badge-paid">
        <Icon name="check" :size="12" />
        PAGADO ({{ paymentMethodLabel }})
      </span>
      <span v-else class="badge badge-unpaid">
        <span class="badge-dot" />
        POR COBRAR ({{ paymentMethodLabel }})
      </span>

      <!-- Logo Oficial de Método de Pago -->
      <div v-if="props.order.paymentMethodDeclared" class="comanda-payment-brand" :title="paymentMethodLabel">
        <PaymentBrandLogo :method="props.order.paymentMethodDeclared" :width="46" :height="22" />
      </div>
    </div>

    <!-- Notas destacadas -->
    <div v-if="props.order.notes" class="order-notes">
      <Icon name="note" :size="15" color="var(--accent-gold)" />
      <div class="notes-text">
        <strong>Nota:</strong> {{ props.order.notes }}
      </div>
    </div>

    <!-- Lista de ítems -->
    <div class="items-list">
      <div
        v-for="item in props.order.items"
        :key="item.id"
        class="order-item"
      >
        <span class="item-qty">{{ item.quantity }}x</span>
        <span class="item-name">{{ item.productName }}</span>
        <span class="item-subtotal">{{ formatCOP(item.subtotal) }}</span>
      </div>
    </div>

    <div class="card-total">
      <span class="total-label">Total:</span>
      <span class="total-value">{{ formatCOP(props.order.totalAmount) }}</span>
    </div>

    <footer class="card-actions">
      <!-- Kitchen actions -->
      <button
        v-if="canPrepare"
        type="button"
        class="btn btn-prepare"
        :disabled="props.isMutating"
        @click="emit('prepare', props.order.id)"
      >
        <Icon name="fire" :size="16" />
        <span>Preparar</span>
      </button>

      <button
        v-if="canDeliver"
        type="button"
        class="btn btn-deliver"
        :disabled="props.isMutating"
        @click="emit('deliver', props.order.id)"
      >
        <Icon name="check" :size="16" />
        <span>Marcar Entregado</span>
      </button>

      <!-- Cashier actions -->
      <button
        v-if="canConfirmPayment"
        type="button"
        class="btn btn-pay"
        :disabled="props.isMutating"
        @click="emit('confirmPayment', props.order)"
      >
        <Icon name="card" :size="16" />
        <span>Cobrar</span>
      </button>

      <!-- Cancel action -->
      <button
        v-if="canCancel"
        type="button"
        class="btn btn-cancel"
        :disabled="props.isMutating"
        @click="emit('cancel', props.order)"
      >
        <span>Cancelar</span>
      </button>
    </footer>
  </article>
</template>

<style scoped>
.order-card {
  background: var(--bg-card-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: var(--shadow-sm);
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
}

.order-card:hover {
  border-color: var(--border-highlight);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.order-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--border-subtle);
}

.order-card.status-pending::before {
  background: var(--accent-gold);
}

.order-card.status-preparing::before {
  background: var(--accent-blue);
}

.order-card.status-delivered::before {
  background: var(--accent-green);
}

.order-card.status-cancelled::before {
  background: var(--accent-red);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 2px;
}

.table-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.table-badge {
  font-family: var(--font-heading);
  background: var(--bg-surface);
  border: 1px solid var(--border-highlight);
  color: var(--text-primary);
  font-weight: 800;
  font-size: 0.92rem;
  padding: 4px 10px;
  border-radius: var(--radius-md);
  letter-spacing: -0.01em;
}

.customer-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(245, 158, 11, 0.15);
  color: var(--accent-gold);
  border: 1px solid rgba(245, 158, 11, 0.3);
  font-size: 0.82rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: var(--radius-md);
}

.order-code-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.28);
  border-radius: var(--radius-md);
  padding: 3px 8px;
}

.code-primary {
  font-family: var(--font-heading);
  font-size: 0.92rem;
  font-weight: 800;
  color: var(--accent-gold);
  letter-spacing: 0.04em;
}

.code-turn {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg-surface);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
}

.time-info {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.status-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.comanda-payment-brand {
  display: inline-flex;
  align-items: center;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.74rem;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: var(--radius-full);
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.badge-pending {
  background: rgba(245, 158, 11, 0.12);
  color: var(--accent-gold);
  border: 1px solid rgba(245, 158, 11, 0.25);
}
.badge-pending .badge-dot {
  background: var(--accent-gold);
}

.badge-preparing {
  background: var(--accent-blue-bg);
  color: var(--accent-blue-light);
  border: 1px solid var(--accent-blue-border);
}

.badge-delivered {
  background: var(--accent-green-bg);
  color: var(--accent-green-light);
  border: 1px solid var(--accent-green-border);
}

.badge-cancelled {
  background: var(--accent-red-bg);
  color: var(--accent-red);
  border: 1px solid var(--accent-red-border);
}

.badge-paid {
  background: var(--accent-green-bg);
  color: var(--accent-green-light);
  border: 1px solid var(--accent-green-border);
}

.badge-unpaid {
  background: rgba(245, 158, 11, 0.1);
  color: var(--accent-gold);
  border: 1px solid rgba(245, 158, 11, 0.25);
}
.badge-unpaid .badge-dot {
  background: var(--accent-gold);
}

.order-notes {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(245, 158, 11, 0.08);
  border-left: 3px solid var(--accent-gold);
  padding: 8px 12px;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  font-size: 0.82rem;
  color: var(--text-primary);
  line-height: 1.35;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 10px 14px;
}

.order-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.88rem;
  padding: 3px 0;
}

.item-qty {
  font-family: var(--font-heading);
  background: rgba(255, 255, 255, 0.08);
  color: var(--accent-gold);
  font-weight: 800;
  font-size: 0.84rem;
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  min-width: 28px;
  text-align: center;
}

.item-name {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary);
}

.item-subtotal {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.card-total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-top: 4px;
  border-top: 1px dashed var(--border-subtle);
}

.total-label {
  font-size: 0.84rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.total-value {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--accent-gold);
  letter-spacing: -0.02em;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: var(--radius-full);
  font-size: 0.86rem;
  font-weight: 700;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  flex: 1;
  min-width: 110px;
}

.btn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.btn-prepare {
  background: var(--accent-blue);
  color: #ffffff;
  box-shadow: 0 2px 10px rgba(14, 165, 233, 0.35);
}

.btn-deliver {
  background: var(--accent-green);
  color: #0b0e14;
  box-shadow: 0 2px 10px rgba(16, 185, 129, 0.35);
}

.btn-pay {
  background: var(--accent-gold-gradient);
  color: #0b0e14;
  box-shadow: 0 2px 10px rgba(245, 158, 11, 0.35);
}

.btn-cancel {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border-subtle);
  flex: 0 0 auto;
  min-width: auto;
  padding: 9px 12px;
}

.btn-cancel:hover:not(:disabled) {
  background: rgba(244, 63, 94, 0.1);
  border-color: var(--accent-red);
  color: var(--accent-red);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
