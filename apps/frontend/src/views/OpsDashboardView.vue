<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import {
  fetchOpsOrdersApi,
  updateFulfillmentApi,
  confirmPaymentApi,
  ApiClientError,
} from '../services/api.js';
import {
  OpsOrder,
  UserRole,
  FulfillmentStatus,
  PaymentStatus,
} from '@qr-menu/shared';
import { formatCOP } from '../utils/currency.js';
import OrderCard from '../components/ops/OrderCard.vue';
import LoadingSpinner from '../components/common/LoadingSpinner.vue';
import Icon from '../components/common/Icon.vue';

const router = useRouter();
const authStore = useAuthStore();

const orders = ref<OpsOrder[]>([]);
const isLoading = ref(true);
const isRefreshing = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const mutatingOrderId = ref<string | null>(null);

// Filtros
type FilterTab = FulfillmentStatus | 'ACTIVE' | 'HISTORY' | 'ALL';
const selectedStatusFilter = ref<FilterTab>('ACTIVE');
const selectedTableFilter = ref<string>('ALL');

// Modales
const paymentModalOrder = ref<OpsOrder | null>(null);
const cancelModalOrder = ref<OpsOrder | null>(null);
const cancelReason = ref('');

let pollInterval: ReturnType<typeof setInterval> | null = null;

// Rol del usuario activo
const userRole = computed(() => authStore.user?.role || UserRole.CASHIER);

// Mesas únicas disponibles en los pedidos cargados
const availableTables = computed(() => {
  const map = new Map<number, string>();
  orders.value.forEach((o) => {
    if (!map.has(o.tableNumber)) {
      map.set(o.tableNumber, o.tableName);
    }
  });
  return Array.from(map.entries())
    .map(([number, name]) => ({ number, name }))
    .sort((a, b) => a.number - b.number);
});

// Pedidos filtrados según estado y mesa
const filteredOrders = computed(() => {
  return orders.value.filter((o) => {
    // Filtro por estado / tab
    if (selectedStatusFilter.value === 'ACTIVE') {
      const isActive =
        (o.fulfillmentStatus !== FulfillmentStatus.DELIVERED &&
          o.fulfillmentStatus !== FulfillmentStatus.CANCELLED) ||
        o.paymentStatus === PaymentStatus.UNPAID;
      if (!isActive) return false;
    } else if (selectedStatusFilter.value === 'HISTORY') {
      const isHistory =
        (o.fulfillmentStatus === FulfillmentStatus.DELIVERED &&
          o.paymentStatus === PaymentStatus.PAID) ||
        o.fulfillmentStatus === FulfillmentStatus.CANCELLED;
      if (!isHistory) return false;
    } else if (selectedStatusFilter.value !== 'ALL') {
      if (o.fulfillmentStatus !== selectedStatusFilter.value) {
        return false;
      }
    }

    // Filtro por mesa
    if (selectedTableFilter.value !== 'ALL') {
      if (String(o.tableNumber) !== selectedTableFilter.value) {
        return false;
      }
    }
    return true;
  });
});

// Contadores rápidos para tabs
const countActive = computed(
  () =>
    orders.value.filter(
      (o) =>
        (o.fulfillmentStatus !== FulfillmentStatus.DELIVERED &&
          o.fulfillmentStatus !== FulfillmentStatus.CANCELLED) ||
        o.paymentStatus === PaymentStatus.UNPAID
    ).length
);
const countPending = computed(
  () => orders.value.filter((o) => o.fulfillmentStatus === FulfillmentStatus.PENDING).length
);
const countPreparing = computed(
  () => orders.value.filter((o) => o.fulfillmentStatus === FulfillmentStatus.PREPARING).length
);
const countHistory = computed(
  () =>
    orders.value.filter(
      (o) =>
        (o.fulfillmentStatus === FulfillmentStatus.DELIVERED &&
          o.paymentStatus === PaymentStatus.PAID) ||
        o.fulfillmentStatus === FulfillmentStatus.CANCELLED
    ).length
);

async function loadOrders(silent = false) {
  if (!silent) {
    if (orders.value.length === 0) {
      isLoading.value = true;
    } else {
      isRefreshing.value = true;
    }
  }

  try {
    const data = await fetchOpsOrdersApi();
    orders.value = data.orders;
    if (!silent) {
      errorMessage.value = null;
    }
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      if (err.statusCode === 401) {
        await authStore.logout();
        router.replace('/login');
        return;
      }
      errorMessage.value = err.message;
    } else {
      errorMessage.value = 'Error al cargar los pedidos';
    }
  } finally {
    isLoading.value = false;
    isRefreshing.value = false;
  }
}

async function handlePrepare(orderId: string) {
  mutatingOrderId.value = orderId;
  errorMessage.value = null;
  try {
    await updateFulfillmentApi(orderId, FulfillmentStatus.PREPARING);
    await loadOrders(true);
    showSuccess('Pedido en preparación');
  } catch (err: unknown) {
    handleMutationError(err);
  } finally {
    mutatingOrderId.value = null;
  }
}

async function handleDeliver(orderId: string) {
  mutatingOrderId.value = orderId;
  errorMessage.value = null;
  try {
    await updateFulfillmentApi(orderId, FulfillmentStatus.DELIVERED);
    await loadOrders(true);
    showSuccess('Pedido marcado como entregado');
  } catch (err: unknown) {
    handleMutationError(err);
  } finally {
    mutatingOrderId.value = null;
  }
}

function openPaymentModal(order: OpsOrder) {
  paymentModalOrder.value = order;
}

function closePaymentModal() {
  paymentModalOrder.value = null;
}

async function executeConfirmPayment() {
  if (!paymentModalOrder.value) return;
  const orderId = paymentModalOrder.value.id;
  mutatingOrderId.value = orderId;
  errorMessage.value = null;

  try {
    await confirmPaymentApi(orderId);
    await loadOrders(true);
    showSuccess('Pago confirmado correctamente');
    closePaymentModal();
  } catch (err: unknown) {
    handleMutationError(err);
  } finally {
    mutatingOrderId.value = null;
  }
}

function openCancelModal(order: OpsOrder) {
  cancelModalOrder.value = order;
  cancelReason.value = '';
}

function closeCancelModal() {
  cancelModalOrder.value = null;
  cancelReason.value = '';
}

async function executeCancelOrder() {
  if (!cancelModalOrder.value) return;
  const orderId = cancelModalOrder.value.id;
  mutatingOrderId.value = orderId;
  errorMessage.value = null;

  try {
    await updateFulfillmentApi(orderId, FulfillmentStatus.CANCELLED, cancelReason.value || undefined);
    await loadOrders(true);
    showSuccess('Pedido cancelado');
    closeCancelModal();
  } catch (err: unknown) {
    handleMutationError(err);
  } finally {
    mutatingOrderId.value = null;
  }
}

function handleMutationError(err: unknown) {
  if (err instanceof ApiClientError) {
    if (err.statusCode === 401) {
      authStore.logout();
      router.replace('/login');
      return;
    }
    if (err.statusCode === 409) {
      errorMessage.value = `${err.message}. Se actualizó la lista de pedidos.`;
      loadOrders(true);
      return;
    }
    errorMessage.value = err.message;
  } else {
    errorMessage.value = 'Ocurrió un error inesperado al procesar el pedido.';
  }
}

function showSuccess(msg: string) {
  successMessage.value = msg;
  setTimeout(() => {
    if (successMessage.value === msg) {
      successMessage.value = null;
    }
  }, 4000);
}

async function handleLogout() {
  await authStore.logout();
  router.replace('/login');
}

onMounted(async () => {
  await loadOrders();
  pollInterval = setInterval(() => {
    loadOrders(true);
  }, 10000);
});

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
});
</script>

<template>
  <div class="ops-dashboard">
    <!-- Navbar superior KDS -->
    <header class="ops-navbar">
      <div class="brand-section">
        <div class="logo-icon-box">
          <Icon name="beer" :size="20" color="var(--accent-gold)" />
        </div>
        <h1 class="ops-brand">El Mora <span class="badge-brand">Caja</span></h1>
        <div class="role-badge" :class="`role-${userRole.toLowerCase()}`">
          <span class="role-dot" />
          <span>{{ userRole }}</span>
        </div>
      </div>

      <div class="user-actions">
        <div class="user-greeting">
          <Icon name="user" :size="16" color="var(--text-muted)" />
          <span class="user-name">{{ authStore.user?.username || 'Operador' }}</span>
        </div>

        <button
          type="button"
          class="btn-nav btn-refresh"
          :disabled="isRefreshing"
          title="Actualizar pedidos"
          @click="loadOrders()"
        >
          <Icon name="refresh" :size="15" :class="{ 'spin-active': isRefreshing }" />
          <span class="btn-text">Refrescar</span>
        </button>

        <button
          type="button"
          class="btn-nav btn-logout"
          title="Cerrar sesión"
          @click="handleLogout"
        >
          <Icon name="logout" :size="15" />
          <span class="btn-text">Salir</span>
        </button>
      </div>
    </header>

    <!-- Alertas globales -->
    <div class="alerts-container">
      <div v-if="errorMessage" class="alert alert-error" role="alert">
        <div class="alert-content">
          <Icon name="alert" :size="16" color="var(--accent-red)" />
          <span>{{ errorMessage }}</span>
        </div>
        <button type="button" class="alert-close" @click="errorMessage = null">×</button>
      </div>
      <div v-if="successMessage" class="alert alert-success" role="alert">
        <div class="alert-content">
          <Icon name="check" :size="16" color="var(--accent-green)" />
          <span>{{ successMessage }}</span>
        </div>
        <button type="button" class="alert-close" @click="successMessage = null">×</button>
      </div>
    </div>

    <!-- Barra de Filtros / Tabs -->
    <nav class="filters-bar" aria-label="Filtros de pedidos">
      <div class="tabs-group">
        <button
          type="button"
          class="tab-btn tab-active"
          :class="{ active: selectedStatusFilter === 'ACTIVE' }"
          @click="selectedStatusFilter = 'ACTIVE'"
        >
          <span class="live-dot" />
          <span>Activos</span>
          <span class="tab-counter counter-pending">{{ countActive }}</span>
        </button>

        <button
          type="button"
          class="tab-btn tab-pending"
          :class="{ active: selectedStatusFilter === FulfillmentStatus.PENDING }"
          @click="selectedStatusFilter = FulfillmentStatus.PENDING"
        >
          <Icon name="clock" :size="14" />
          <span>Pendientes</span>
          <span class="tab-counter">{{ countPending }}</span>
        </button>

        <button
          type="button"
          class="tab-btn tab-preparing"
          :class="{ active: selectedStatusFilter === FulfillmentStatus.PREPARING }"
          @click="selectedStatusFilter = FulfillmentStatus.PREPARING"
        >
          <Icon name="fire" :size="14" />
          <span>En Preparación</span>
          <span class="tab-counter counter-preparing">{{ countPreparing }}</span>
        </button>

        <button
          type="button"
          class="tab-btn tab-history"
          :class="{ active: selectedStatusFilter === 'HISTORY' }"
          @click="selectedStatusFilter = 'HISTORY'"
        >
          <Icon name="check-circle" :size="14" />
          <span>Historial</span>
          <span class="tab-counter">{{ countHistory }}</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          :class="{ active: selectedStatusFilter === 'ALL' }"
          @click="selectedStatusFilter = 'ALL'"
        >
          <span>Todos</span>
          <span class="tab-counter">{{ orders.length }}</span>
        </button>
      </div>

      <div class="table-filter-group">
        <Icon name="table" :size="14" color="var(--accent-gold)" />
        <label for="table-select" class="filter-label">Mesa:</label>
        <select
          id="table-select"
          v-model="selectedTableFilter"
          class="table-select"
        >
          <option value="ALL">Todas las mesas</option>
          <option
            v-for="t in availableTables"
            :key="t.number"
            :value="String(t.number)"
          >
            {{ t.name }}
          </option>
        </select>
      </div>
    </nav>

    <!-- Contenido principal -->
    <main class="orders-viewport">
      <div v-if="isLoading" class="loading-state">
        <LoadingSpinner message="Cargando pedidos..." />
      </div>

      <div v-else-if="filteredOrders.length === 0" class="empty-state">
        <div class="empty-icon-box">
          <Icon name="note" :size="36" color="var(--text-muted)" />
        </div>
        <h2>No hay pedidos en esta sección</h2>
        <p>Los nuevos pedidos realizados por clientes aparecerán aquí automáticamente en tiempo real.</p>
      </div>

      <div v-else class="orders-grid">
        <OrderCard
          v-for="order in filteredOrders"
          :key="order.id"
          :order="order"
          :user-role="userRole"
          :is-mutating="mutatingOrderId === order.id"
          @prepare="handlePrepare"
          @deliver="handleDeliver"
          @confirm-payment="openPaymentModal"
          @cancel="openCancelModal"
        />
      </div>
    </main>

    <!-- Modal de confirmación de Pago -->
    <div
      v-if="paymentModalOrder"
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-modal-title"
    >
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-icon-bubble">
            <Icon name="card" :size="20" color="var(--accent-gold)" />
          </div>
          <h2 id="pay-modal-title" class="modal-title">Confirmar Pago</h2>
        </div>
        <div class="modal-body">
          <p>
            ¿Confirmas que el pedido <strong>#{{ paymentModalOrder.orderNumber }} ({{ paymentModalOrder.publicCode }})</strong>
            de la <strong>{{ paymentModalOrder.tableName }}</strong> ha sido recibido y pagado?
          </p>
          <div class="modal-summary">
            <div class="modal-summary-row">
              <span class="modal-summary-label">Método declarado:</span>
              <span class="modal-summary-val">{{ paymentModalOrder.paymentMethodDeclared }}</span>
            </div>
            <div class="modal-summary-row highlight">
              <span class="modal-summary-label">Total a cobrar:</span>
              <span class="modal-summary-val total">{{ formatCOP(paymentModalOrder.totalAmount) }}</span>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button
            type="button"
            class="btn-modal btn-cancel-modal"
            @click="closePaymentModal"
          >
            Volver
          </button>
          <button
            type="button"
            class="btn-modal btn-confirm-pay"
            :disabled="mutatingOrderId === paymentModalOrder.id"
            @click="executeConfirmPayment"
          >
            {{ mutatingOrderId === paymentModalOrder.id ? 'Confirmando...' : 'Confirmar Pago' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de cancelación de Pedido -->
    <div
      v-if="cancelModalOrder"
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
    >
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-icon-bubble cancel-bubble">
            <Icon name="alert" :size="20" color="var(--accent-red)" />
          </div>
          <h2 id="cancel-modal-title" class="modal-title modal-danger">Cancelar Pedido</h2>
        </div>
        <div class="modal-body">
          <p>
            ¿Deseas cancelar el pedido <strong>#{{ cancelModalOrder.orderNumber }} ({{ cancelModalOrder.publicCode }})</strong>?
            Esta acción es irreversible y terminará el pedido.
          </p>
          <div class="form-group-modal">
            <label for="cancel-reason">Motivo de cancelación (opcional):</label>
            <input
              id="cancel-reason"
              v-model="cancelReason"
              type="text"
              class="modal-input"
              placeholder="Ej: Cliente desistió, falta de insumo"
              maxlength="150"
            />
          </div>
        </div>
        <div class="modal-actions">
          <button
            type="button"
            class="btn-modal btn-cancel-modal"
            @click="closeCancelModal"
          >
            Volver
          </button>
          <button
            type="button"
            class="btn-modal btn-confirm-danger"
            :disabled="mutatingOrderId === cancelModalOrder.id"
            @click="executeCancelOrder"
          >
            {{ mutatingOrderId === cancelModalOrder.id ? 'Cancelando...' : 'Sí, Cancelar Pedido' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ops-dashboard {
  min-height: 100vh;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
}

.ops-navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: rgba(17, 24, 39, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 30;
}

.brand-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon-box {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ops-brand {
  font-family: var(--font-heading);
  font-size: 1.35rem;
  font-weight: 800;
  margin: 0;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.badge-brand {
  background: var(--accent-gold-gradient);
  color: #0b0e14;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-left: 4px;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.role-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.role-admin {
  background: rgba(245, 158, 11, 0.12);
  color: var(--accent-gold);
  border: 1px solid rgba(245, 158, 11, 0.3);
}
.role-admin .role-dot {
  background: var(--accent-gold);
}

.role-kitchen {
  background: var(--accent-blue-bg);
  color: var(--accent-blue-light);
  border: 1px solid var(--accent-blue-border);
}
.role-kitchen .role-dot {
  background: var(--accent-blue-light);
}

.role-cashier {
  background: var(--accent-green-bg);
  color: var(--accent-green-light);
  border: 1px solid var(--accent-green-border);
}
.role-cashier .role-dot {
  background: var(--accent-green-light);
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-greeting {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.88rem;
  color: var(--text-secondary);
  background: var(--bg-card);
  padding: 6px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-subtle);
}

.user-name {
  font-weight: 700;
  color: var(--text-primary);
}

.btn-nav {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: var(--radius-full);
  transition: all 0.2s;
}

.btn-nav:hover:not(:disabled) {
  background: var(--bg-card-hover);
  color: var(--text-primary);
  border-color: var(--border-highlight);
}

.btn-logout:hover {
  background: rgba(244, 63, 94, 0.12);
  border-color: var(--accent-red);
  color: var(--accent-red);
}

.spin-active {
  animation: spin-loader 0.8s linear infinite;
}

.alerts-container {
  padding: 10px 24px 0 24px;
}

.alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  font-weight: 600;
  margin-bottom: 8px;
  animation: fadeIn 0.2s ease;
}

.alert-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.alert-error {
  background: var(--accent-red-bg);
  border: 1px solid var(--accent-red-border);
  color: #fca5a5;
}

.alert-success {
  background: var(--accent-green-bg);
  border: 1px solid var(--accent-green-border);
  color: var(--accent-green-light);
}

.alert-close {
  background: transparent;
  color: inherit;
  font-size: 1.3rem;
  line-height: 1;
  padding: 0 4px;
  opacity: 0.7;
}

.alert-close:hover {
  opacity: 1;
}

.filters-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 24px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  flex-wrap: wrap;
  gap: 12px;
}

.tabs-group {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.tabs-group::-webkit-scrollbar {
  display: none;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: 0.84rem;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.2s;
}

.tab-btn:hover:not(.active) {
  background: var(--bg-card-hover);
  color: var(--text-primary);
  border-color: var(--border-highlight);
}

.tab-btn.active {
  background: var(--accent-gold-gradient);
  color: #0b0e14;
  border-color: transparent;
  box-shadow: 0 2px 10px rgba(245, 158, 11, 0.3);
}

.tab-counter {
  font-family: var(--font-heading);
  background: rgba(0, 0, 0, 0.25);
  padding: 2px 7px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 800;
}

.counter-pending {
  background: rgba(245, 158, 11, 0.2);
  color: var(--accent-gold);
}

.tab-btn.active .counter-pending {
  background: rgba(0, 0, 0, 0.3);
  color: #0b0e14;
}

.counter-preparing {
  background: rgba(14, 165, 233, 0.2);
  color: var(--accent-blue-light);
}

.tab-btn.active .counter-preparing {
  background: rgba(0, 0, 0, 0.3);
  color: #0b0e14;
}

.table-filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  padding: 4px 12px;
  border-radius: var(--radius-full);
}

.filter-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.table-select {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 4px;
}

.orders-viewport {
  flex: 1;
  padding: 24px;
  max-width: 1440px;
  margin: 0 auto;
  width: 100%;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.empty-icon-box {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.empty-state h2 {
  font-size: 1.3rem;
  margin-bottom: 6px;
}

.empty-state p {
  color: var(--text-secondary);
  max-width: 380px;
  font-size: 0.9rem;
}

.orders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

/* Modales */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(9, 13, 22, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
  animation: fadeIn 0.2s ease;
}

.modal-dialog {
  background: var(--bg-card);
  border: 1px solid var(--border-highlight);
  border-radius: var(--radius-xl);
  padding: 28px;
  width: 100%;
  max-width: 440px;
  box-shadow: var(--shadow-lg), 0 0 50px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-icon-bubble {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cancel-bubble {
  background: rgba(244, 63, 94, 0.12);
  border-color: rgba(244, 63, 94, 0.3);
}

.modal-title {
  font-family: var(--font-heading);
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
}

.modal-title.modal-danger {
  color: var(--accent-red);
}

.modal-body p {
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.45;
  margin-bottom: 14px;
}

.modal-summary {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.modal-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.88rem;
}

.modal-summary-row.highlight {
  border-top: 1px dashed var(--border-subtle);
  padding-top: 6px;
  margin-top: 4px;
}

.modal-summary-val.total {
  font-family: var(--font-heading);
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--accent-gold);
}

.form-group-modal {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group-modal label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.modal-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  font-size: 0.88rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

.btn-modal {
  padding: 10px 18px;
  border-radius: var(--radius-full);
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel-modal {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}

.btn-cancel-modal:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
}

.btn-confirm-pay {
  background: var(--accent-gold-gradient);
  color: #0b0e14;
  box-shadow: 0 2px 10px rgba(245, 158, 11, 0.3);
}

.btn-confirm-pay:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.btn-confirm-danger {
  background: var(--accent-red);
  color: #ffffff;
  box-shadow: 0 2px 10px rgba(244, 63, 94, 0.3);
}

.btn-confirm-danger:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
</style>
