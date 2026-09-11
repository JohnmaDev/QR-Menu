<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchOrderStatus, ApiClientError } from '../services/api.js';
import { OrderStatusResponse, FulfillmentStatus, PaymentStatus } from '@qr-menu/shared';
import { formatCOP } from '../utils/currency.js';
import LoadingSpinner from '../components/common/LoadingSpinner.vue';
import ErrorMessage from '../components/common/ErrorMessage.vue';
import Icon from '../components/common/Icon.vue';

const route = useRoute();
const router = useRouter();

const tableToken = computed(() => route.params.tableToken as string);
const orderCode = computed(() => route.params.orderCode as string);

const orderStatus = ref<OrderStatusResponse | null>(null);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;

const statusInfo = computed(() => {
  if (!orderStatus.value) return null;

  switch (orderStatus.value.fulfillmentStatus) {
    case FulfillmentStatus.PENDING:
      return {
        label: 'Pedido recibido',
        description: 'La barra ha recibido tu pedido y pronto iniciará su preparación.',
        iconName: 'clock',
        colorClass: 'status-pending',
        step: 1,
      };
    case FulfillmentStatus.PREPARING:
      return {
        label: 'En preparación',
        description: 'El personal está alistando tus bebidas y snacks.',
        iconName: 'fire',
        colorClass: 'status-preparing',
        step: 2,
      };
    case FulfillmentStatus.DELIVERED:
      return {
        label: '¡Entregado!',
        description: 'Tu pedido ya fue llevado a tu mesa. ¡Que lo disfrutes!',
        iconName: 'check-circle',
        colorClass: 'status-delivered',
        step: 3,
      };
    case FulfillmentStatus.CANCELLED:
      return {
        label: 'Pedido cancelado',
        description: 'Este pedido fue cancelado por el personal del bar.',
        iconName: 'alert',
        colorClass: 'status-cancelled',
        step: 0,
      };
    default:
      return {
        label: 'En proceso',
        description: 'Tu pedido está siendo procesado.',
        iconName: 'clock',
        colorClass: 'status-pending',
        step: 1,
      };
  }
});

async function loadStatus() {
  if (!orderCode.value) return;

  try {
    const data = await fetchOrderStatus(orderCode.value);
    orderStatus.value = data;
    errorMessage.value = null;

    // Detener polling solo cuando el pedido esté completamente cerrado:
    // Entregado Y Pagado, o Cancelado.
    const isCompleted =
      (data.fulfillmentStatus === FulfillmentStatus.DELIVERED &&
        data.paymentStatus === PaymentStatus.PAID) ||
      data.fulfillmentStatus === FulfillmentStatus.CANCELLED;

    if (isCompleted) {
      stopPolling();
    }
  } catch (err: unknown) {
    if (err instanceof ApiClientError && err.statusCode === 404) {
      errorMessage.value = 'El pedido solicitado no fue encontrado.';
      stopPolling();
    }
  } finally {
    isLoading.value = false;
  }
}

function startPolling() {
  stopPolling();
  loadStatus();
  pollTimer = setInterval(loadStatus, 5000);
}

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function handleNewOrder() {
  stopPolling();
  router.push(`/m/${tableToken.value}`);
}

onMounted(() => {
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <main class="confirmation-view" role="main">
    <!-- Spinner Inicial -->
    <div v-if="isLoading" class="loader-wrap">
      <LoadingSpinner message="Consultando estado de tu pedido..." />
    </div>

    <!-- Error crítico (ej. 404) -->
    <div v-else-if="errorMessage" class="error-wrap">
      <ErrorMessage
        :message="errorMessage"
        retry-label="Volver al Menú"
        @retry="handleNewOrder"
      />
    </div>

    <!-- Información de la Orden -->
    <div v-else-if="orderStatus" class="order-details-card">
      <header class="card-header">
        <div class="success-badge">
          <Icon name="check" :size="14" />
          <span>El Mora • ¡Pedido Confirmado!</span>
        </div>
        <h1 class="order-title">Pedido #{{ orderStatus.orderNumber }}</h1>
        <div class="code-pill-wrap">
          <span class="code-prefix">CÓDIGO:</span>
          <span class="code-pill" aria-label="Código de seguimiento">
            {{ orderStatus.orderCode }}
          </span>
        </div>
      </header>

      <!-- Stepper Visual -->
      <section class="status-tracker" aria-label="Progreso del pedido">
        <div v-if="statusInfo?.step !== 0" class="tracker-steps">
          <div
            class="step"
            :class="{ active: statusInfo && statusInfo.step >= 1 }"
          >
            <div class="step-circle">
              <Icon v-if="statusInfo && statusInfo.step > 1" name="check" :size="14" />
              <span v-else>1</span>
            </div>
            <span class="step-label">Recibido</span>
          </div>
          <div
            class="step-line"
            :class="{ filled: statusInfo && statusInfo.step >= 2 }"
          />
          <div
            class="step"
            :class="{ active: statusInfo && statusInfo.step >= 2 }"
          >
            <div class="step-circle">
              <Icon v-if="statusInfo && statusInfo.step > 2" name="check" :size="14" />
              <span v-else>2</span>
            </div>
            <span class="step-label">Preparando</span>
          </div>
          <div
            class="step-line"
            :class="{ filled: statusInfo && statusInfo.step >= 3 }"
          />
          <div
            class="step"
            :class="{ active: statusInfo && statusInfo.step >= 3 }"
          >
            <div class="step-circle">
              <Icon v-if="statusInfo && statusInfo.step >= 3" name="check" :size="14" />
              <span v-else>3</span>
            </div>
            <span class="step-label">Entregado</span>
          </div>
        </div>

        <div class="current-status-box" :class="statusInfo?.colorClass">
          <div class="status-icon-bubble">
            <Icon :name="statusInfo?.iconName || 'clock'" :size="24" />
          </div>
          <div class="status-text-content">
            <h2 class="status-headline">{{ statusInfo?.label }}</h2>
            <p class="status-subtext">{{ statusInfo?.description }}</p>
          </div>
        </div>
      </section>

      <!-- Recibo / Datos del Pedido -->
      <section class="order-meta-info" aria-label="Detalles de la mesa y cobro">
        <div class="meta-row">
          <span class="meta-label">Ubicación</span>
          <span class="meta-value">{{ orderStatus.tableName }}</span>
        </div>
        <div v-if="orderStatus.customerName" class="meta-row">
          <span class="meta-label">Cliente</span>
          <span class="meta-value highlight">{{ orderStatus.customerName }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Total de la orden</span>
          <span class="meta-value highlight">{{ formatCOP(orderStatus.totalAmount) }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Estado de pago</span>
          <span
            class="meta-value payment-tag"
            :class="orderStatus.paymentStatus === PaymentStatus.PAID ? 'paid' : 'unpaid'"
          >
            <span class="tag-dot" />
            {{ orderStatus.paymentStatus === PaymentStatus.PAID ? 'Pago confirmado' : 'Pendiente de cobro' }}
          </span>
        </div>
      </section>

      <p class="wait-note">
        Puedes mantener esta pantalla abierta mientras preparan tus bebidas. Se actualizará automáticamente.
      </p>

      <button type="button" class="new-order-btn" @click="handleNewOrder">
        <Icon name="plus" :size="16" />
        <span>Hacer otro pedido</span>
      </button>
    </div>
  </main>
</template>

<style scoped>
.confirmation-view {
  max-width: 500px;
  margin: 0 auto;
  padding: 24px 16px 40px 16px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.loader-wrap, .error-wrap {
  padding: 40px 20px;
}

.order-details-card {
  background: var(--bg-card-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-highlight);
  border-radius: var(--radius-xl);
  padding: 28px 24px;
  text-align: center;
  box-shadow: var(--shadow-lg), 0 0 40px rgba(245, 158, 11, 0.08);
  animation: fadeIn 0.35s ease;
}

.card-header {
  margin-bottom: 26px;
}

.success-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent-green-bg);
  border: 1px solid var(--accent-green-border);
  color: var(--accent-green-light);
  font-weight: 700;
  font-size: 0.82rem;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  margin-bottom: 12px;
}

.order-title {
  font-family: var(--font-heading);
  font-size: 1.85rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.code-pill-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  padding: 6px 16px;
  border-radius: var(--radius-full);
}

.code-prefix {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.code-pill {
  font-family: var(--font-heading);
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--accent-gold);
  letter-spacing: 0.06em;
}

.status-tracker {
  margin-bottom: 26px;
}

.tracker-steps {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
  padding: 0 16px;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 2;
}

.step-circle {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background-color: var(--bg-surface);
  border: 2px solid var(--border-subtle);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-heading);
  font-weight: 800;
  font-size: 0.88rem;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.step.active .step-circle {
  background: var(--accent-gold-gradient);
  border-color: transparent;
  color: #0b0e14;
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.4);
}

.step-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  transition: color 0.2s;
}

.step.active .step-label {
  color: var(--text-primary);
  font-weight: 700;
}

.step-line {
  flex: 1;
  height: 2px;
  background-color: var(--border-subtle);
  margin: 0 6px -20px 6px;
  position: relative;
  z-index: 1;
  transition: background-color 0.3s;
}

.step-line.filled {
  background-color: var(--accent-gold);
}

.current-status-box {
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  padding: 16px 18px;
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-sm);
}

.current-status-box.status-pending {
  border-color: rgba(245, 158, 11, 0.4);
  background: rgba(245, 158, 11, 0.05);
}

.current-status-box.status-pending .status-icon-bubble {
  background: rgba(245, 158, 11, 0.15);
  color: var(--accent-gold);
}

.current-status-box.status-preparing {
  border-color: rgba(14, 165, 233, 0.4);
  background: rgba(14, 165, 233, 0.05);
}

.current-status-box.status-preparing .status-icon-bubble {
  background: rgba(14, 165, 233, 0.15);
  color: var(--accent-blue-light);
}

.current-status-box.status-delivered {
  border-color: rgba(16, 185, 129, 0.4);
  background: rgba(16, 185, 129, 0.06);
}

.current-status-box.status-delivered .status-icon-bubble {
  background: rgba(16, 185, 129, 0.15);
  color: var(--accent-green-light);
}

.current-status-box.status-cancelled {
  border-color: rgba(244, 63, 94, 0.4);
  background: rgba(244, 63, 94, 0.06);
}

.status-icon-bubble {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-text-content {
  display: flex;
  flex-direction: column;
}

.status-headline {
  font-family: var(--font-heading);
  font-size: 1.12rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.status-subtext {
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.35;
}

.order-meta-info {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 14px 18px;
  margin-bottom: 22px;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.meta-row:last-child {
  border-bottom: none;
}

.meta-label {
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.meta-value {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text-primary);
}

.meta-value.highlight {
  font-family: var(--font-heading);
  color: var(--accent-gold);
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.payment-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-full);
}

.tag-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.payment-tag.unpaid {
  background: rgba(245, 158, 11, 0.12);
  color: var(--accent-gold);
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.payment-tag.unpaid .tag-dot {
  background: var(--accent-gold);
}

.payment-tag.paid {
  background: var(--accent-green-bg);
  color: var(--accent-green-light);
  border: 1px solid var(--accent-green-border);
}

.payment-tag.paid .tag-dot {
  background: var(--accent-green);
}

.wait-note {
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.4;
  margin-bottom: 22px;
}

.new-order-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-highlight);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 0.92rem;
  padding: 14px;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
}

.new-order-btn:hover {
  background: var(--bg-card-hover);
  border-color: var(--accent-gold);
  color: var(--accent-gold);
  transform: translateY(-1px);
}
</style>
