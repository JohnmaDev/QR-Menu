<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
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
  PaymentMethodDeclared,
} from '@qr-menu/shared';
import { formatCOP } from '../utils/currency.js';
import OrderCard from '../components/ops/OrderCard.vue';
import LoadingSpinner from '../components/common/LoadingSpinner.vue';
import Icon from '../components/common/Icon.vue';
import AdminTablesTab from '../components/admin/AdminTablesTab.vue';
import AdminProductsTab from '../components/admin/AdminProductsTab.vue';

const router = useRouter();
const authStore = useAuthStore();

type AdminViewTab = 'ORDERS' | 'TABLES' | 'PRODUCTS';
const currentAdminTab = ref<AdminViewTab>('ORDERS');

const orders = ref<OpsOrder[]>([]);
const isLoading = ref(true);
const isRefreshing = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const mutatingOrderId = ref<string | null>(null);

// Filtros
type FilterTab = FulfillmentStatus | 'ACTIVE' | 'HISTORY' | 'ALL';
const selectedStatusFilter = ref<FilterTab>('ACTIVE');
const previousTab = ref<FilterTab>('ACTIVE');
const selectedTableFilter = ref<string>('ALL');

// Cambiar de pestaña guardando la pestaña previa si no era historial
function switchTab(tab: FilterTab) {
  if (selectedStatusFilter.value !== 'HISTORY' && tab === 'HISTORY') {
    previousTab.value = selectedStatusFilter.value;
  } else if (tab !== 'HISTORY') {
    previousTab.value = tab;
  }
  selectedStatusFilter.value = tab;
}

// Toggle para abrir o esconder el panel de Pagos Hoy / Historial
function togglePagosHoy() {
  if (selectedStatusFilter.value === 'HISTORY') {
    // Si ya estamos en pagos/historial, lo escondemos y volvemos a la pestaña anterior
    selectedStatusFilter.value = previousTab.value && previousTab.value !== 'HISTORY' ? previousTab.value : 'ACTIVE';
  } else {
    // Guardamos la pestaña actual antes de abrir pagos
    previousTab.value = selectedStatusFilter.value;
    selectedStatusFilter.value = 'HISTORY';
    selectedHistoryDate.value = todayDateString.value;
  }
}

// Helpers de fecha en zona horaria local (Colombia UTC-5)
function getTodayString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);
}

const todayDateString = computed(() => getTodayString());
const yesterdayDateString = computed(() => getYesterdayString());
const selectedHistoryDate = ref<string>(getTodayString());

function getOrderDateString(o: OpsOrder): string {
  if (o.orderDate) return o.orderDate;
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(o.createdAt));
  } catch {
    return '';
  }
}

const formattedHistorySelectedDate = computed(() => {
  if (!selectedHistoryDate.value) return '';
  if (selectedHistoryDate.value === todayDateString.value) return 'Hoy';
  if (selectedHistoryDate.value === yesterdayDateString.value) return 'Ayer';
  return selectedHistoryDate.value;
});

// Cargar pedidos históricos al cambiar de fecha
watch(selectedHistoryDate, async (newDate) => {
  if (newDate) {
    try {
      const data = await fetchOpsOrdersApi({ date: newDate });
      const currentMap = new Map(orders.value.map((o) => [o.id, o]));
      for (const o of data.orders) {
        currentMap.set(o.id, o);
      }
      orders.value = Array.from(currentMap.values());
    } catch {
      // ignore
    }
  }
});

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
      // Un pedido cancelado NUNCA está activo
      if (o.fulfillmentStatus === FulfillmentStatus.CANCELLED) {
        return false;
      }
      // Solo queda activo si está por despachar O por cobrar
      const isPendingDispatch = o.fulfillmentStatus !== FulfillmentStatus.DELIVERED;
      const isPendingPayment = o.paymentStatus === PaymentStatus.UNPAID;
      const isActive = isPendingDispatch || isPendingPayment;
      if (!isActive) return false;
    } else if (selectedStatusFilter.value === 'HISTORY') {
      const isHistory =
        (o.fulfillmentStatus === FulfillmentStatus.DELIVERED &&
          o.paymentStatus === PaymentStatus.PAID) ||
        o.fulfillmentStatus === FulfillmentStatus.CANCELLED;
      if (!isHistory) return false;

      // Filtrar por la fecha seleccionada en historial
      if (selectedHistoryDate.value && getOrderDateString(o) !== selectedHistoryDate.value) {
        return false;
      }
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

// Pedidos de historial para la fecha seleccionada (para resumen de caja)
const historyOrdersForSelectedDate = computed(() => {
  return orders.value.filter((o) => {
    const isHistory =
      (o.fulfillmentStatus === FulfillmentStatus.DELIVERED &&
        o.paymentStatus === PaymentStatus.PAID) ||
      o.fulfillmentStatus === FulfillmentStatus.CANCELLED;
    return isHistory && getOrderDateString(o) === selectedHistoryDate.value;
  });
});

// Arqueo y ventas del día para la fecha seleccionada
const historyDailySales = computed(() => {
  let totalCash = 0;
  let totalNequi = 0;
  let totalBancolombia = 0;
  let totalBreB = 0;
  let totalRevenue = 0;
  let countCompleted = 0;
  let countCancelled = 0;

  for (const o of historyOrdersForSelectedDate.value) {
    if (o.paymentStatus === PaymentStatus.PAID && o.fulfillmentStatus === FulfillmentStatus.DELIVERED) {
      countCompleted++;
      totalRevenue += o.totalAmount;
      switch (o.paymentMethodDeclared) {
        case PaymentMethodDeclared.CASH:
          totalCash += o.totalAmount;
          break;
        case PaymentMethodDeclared.NEQUI:
          totalNequi += o.totalAmount;
          break;
        case PaymentMethodDeclared.BANCOLOMBIA:
          totalBancolombia += o.totalAmount;
          break;
        case PaymentMethodDeclared.BRE_B:
          totalBreB += o.totalAmount;
          break;
      }
    } else if (o.fulfillmentStatus === FulfillmentStatus.CANCELLED) {
      countCancelled++;
    }
  }

  return {
    totalRevenue,
    countCompleted,
    countCancelled,
    totalCash,
    totalNequi,
    totalBancolombia,
    totalBreB,
  };
});

// Total de dinero cobrado de la jornada de hoy (para indicador persistente en navbar)
const todayTotalRevenue = computed(() => {
  const today = todayDateString.value;
  let total = 0;
  for (const o of orders.value) {
    if (
      o.fulfillmentStatus === FulfillmentStatus.DELIVERED &&
      o.paymentStatus === PaymentStatus.PAID &&
      getOrderDateString(o) === today
    ) {
      total += o.totalAmount;
    }
  }
  return total;
});

// Contadores rápidos para tabs (solo quedan activos los no cancelados que estén por despachar o por cobrar)
const countActive = computed(
  () =>
    orders.value.filter(
      (o) =>
        o.fulfillmentStatus !== FulfillmentStatus.CANCELLED &&
        (o.fulfillmentStatus !== FulfillmentStatus.DELIVERED ||
          o.paymentStatus === PaymentStatus.UNPAID)
    ).length
);
const countPending = computed(
  () => orders.value.filter((o) => o.fulfillmentStatus === FulfillmentStatus.PENDING).length
);
const countPreparing = computed(
  () => orders.value.filter((o) => o.fulfillmentStatus === FulfillmentStatus.PREPARING).length
);
const countHistory = computed(
  () => historyOrdersForSelectedDate.value.length
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
        <h1 class="ops-brand">El Mora <span class="badge-brand">{{ authStore.isAdmin ? 'Admin' : 'Caja' }}</span></h1>
        <div class="role-badge" :class="`role-${userRole.toLowerCase()}`">
          <span class="role-dot" />
          <span>{{ userRole }}</span>
        </div>
      </div>

      <!-- Pill persistente de Pagos Totales de Hoy (toggle directo para abrir / esconder resumen de pagos) -->
      <button
        type="button"
        class="quick-cash-pill"
        :class="{ 'is-open': selectedStatusFilter === 'HISTORY' }"
        :title="selectedStatusFilter === 'HISTORY' ? 'Hacer clic para esconder menú de pagos y volver a pedidos' : 'Hacer clic para ver arqueo y desglose detallado de pagos de hoy'"
        @click="togglePagosHoy"
      >
        <span class="cash-dot" :class="{ 'cash-dot-active': selectedStatusFilter === 'HISTORY' }" />
        <span class="quick-cash-label">Pagos Hoy:</span>
        <span class="quick-cash-amount">{{ formatCOP(todayTotalRevenue) }}</span>
      </button>

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

    <!-- Pestañas Superiores de Administración (Solo ADMIN) -->
    <div v-if="authStore.isAdmin" class="admin-main-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        class="admin-nav-tab"
        :class="{ active: currentAdminTab === 'ORDERS' }"
        @click="currentAdminTab = 'ORDERS'"
      >
        <Icon name="clock" :size="15" />
        <span>Comandas & Caja</span>
      </button>

      <button
        type="button"
        role="tab"
        class="admin-nav-tab"
        :class="{ active: currentAdminTab === 'TABLES' }"
        @click="currentAdminTab = 'TABLES'"
      >
        <Icon name="table" :size="15" />
        <span>Mesas & QRs</span>
      </button>

      <button
        type="button"
        role="tab"
        class="admin-nav-tab"
        :class="{ active: currentAdminTab === 'PRODUCTS' }"
        @click="currentAdminTab = 'PRODUCTS'"
      >
        <Icon name="beer" :size="15" />
        <span>Menú & Catálogo</span>
      </button>
    </div>

    <!-- Vista de Mesas & QRs -->
    <main v-if="authStore.isAdmin && currentAdminTab === 'TABLES'" class="admin-tab-container">
      <AdminTablesTab />
    </main>

    <!-- Vista de Menú & Catálogo -->
    <main v-else-if="authStore.isAdmin && currentAdminTab === 'PRODUCTS'" class="admin-tab-container">
      <AdminProductsTab />
    </main>

    <!-- Vista de Comandas & Caja (Para Caja o Admin en modo Comandas) -->
    <div v-else class="orders-tab-container">
      <!-- Barra de Filtros / Tabs -->
      <nav class="filters-bar" aria-label="Filtros de pedidos">
      <div class="tabs-group">
        <button
          type="button"
          class="tab-btn tab-active"
          :class="{ active: selectedStatusFilter === 'ACTIVE' }"
          @click="switchTab('ACTIVE')"
        >
          <span class="live-dot" />
          <span>Activos</span>
          <span class="tab-counter counter-pending">{{ countActive }}</span>
        </button>

        <button
          type="button"
          class="tab-btn tab-pending"
          :class="{ active: selectedStatusFilter === FulfillmentStatus.PENDING }"
          @click="switchTab(FulfillmentStatus.PENDING)"
        >
          <Icon name="clock" :size="14" />
          <span>Pendientes</span>
          <span class="tab-counter">{{ countPending }}</span>
        </button>

        <button
          type="button"
          class="tab-btn tab-preparing"
          :class="{ active: selectedStatusFilter === FulfillmentStatus.PREPARING }"
          @click="switchTab(FulfillmentStatus.PREPARING)"
        >
          <Icon name="fire" :size="14" />
          <span>En Preparación</span>
          <span class="tab-counter counter-preparing">{{ countPreparing }}</span>
        </button>

        <button
          type="button"
          class="tab-btn tab-history"
          :class="{ active: selectedStatusFilter === 'HISTORY' }"
          @click="switchTab('HISTORY')"
        >
          <Icon name="check-circle" :size="14" />
          <span>Historial & Caja</span>
          <span class="tab-counter">{{ countHistory }}</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          :class="{ active: selectedStatusFilter === 'ALL' }"
          @click="switchTab('ALL')"
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

      <!-- Barra de control y Resumen de Caja exclusivo para la pestaña HISTORIAL -->
      <section v-else-if="selectedStatusFilter === 'HISTORY'" class="history-dashboard-header">
        <div class="history-controls-row">
          <div class="history-title-box">
            <h2 class="history-section-title">
              <Icon name="check-circle" :size="18" color="var(--accent-gold)" />
              Historial de Pedidos & Arqueo de Caja
            </h2>
            <p class="history-subtitle">Consulta de pedidos cerrados y resumen de recaudo por fecha.</p>
          </div>

          <div class="date-filter-actions">
            <div class="date-quick-buttons">
              <button
                type="button"
                class="btn-date-quick"
                :class="{ active: selectedHistoryDate === todayDateString }"
                @click="selectedHistoryDate = todayDateString"
              >
                Hoy
              </button>
              <button
                type="button"
                class="btn-date-quick"
                :class="{ active: selectedHistoryDate === yesterdayDateString }"
                @click="selectedHistoryDate = yesterdayDateString"
              >
                Ayer
              </button>
            </div>

            <div class="date-input-wrapper">
              <Icon name="clock" :size="14" color="var(--text-muted)" />
              <input
                id="history-date-picker"
                type="date"
                v-model="selectedHistoryDate"
                class="history-native-date"
                :max="todayDateString"
                title="Seleccionar fecha personalizada"
              />
            </div>
          </div>
        </div>

        <!-- Tarjetas de Arqueo de Caja del Día -->
        <div class="cash-summary-panel">
          <div class="summary-hero-card">
            <div class="summary-hero-info">
              <span class="summary-hero-label">PAGOS TOTALES ({{ formattedHistorySelectedDate }})</span>
              <span class="summary-hero-amount">{{ formatCOP(historyDailySales.totalRevenue) }}</span>
            </div>
            <div class="summary-hero-stats">
              <span class="stat-pill stat-completed">
                <Icon name="check" :size="12" />
                {{ historyDailySales.countCompleted }} pedidos pagados
              </span>
              <span v-if="historyDailySales.countCancelled > 0" class="stat-pill stat-cancelled">
                <Icon name="alert" :size="12" />
                {{ historyDailySales.countCancelled }} cancelados
              </span>
            </div>
          </div>

          <div class="methods-grid">
            <div class="method-card">
              <span class="method-title">💵 Efectivo</span>
              <span class="method-sum">{{ formatCOP(historyDailySales.totalCash) }}</span>
            </div>
            <div class="method-card">
              <span class="method-title">📱 Nequi</span>
              <span class="method-sum">{{ formatCOP(historyDailySales.totalNequi) }}</span>
            </div>
            <div class="method-card">
              <span class="method-title">🏦 Bancolombia</span>
              <span class="method-sum">{{ formatCOP(historyDailySales.totalBancolombia) }}</span>
            </div>
            <div class="method-card">
              <span class="method-title">⚡ Bre-B</span>
              <span class="method-sum">{{ formatCOP(historyDailySales.totalBreB) }}</span>
            </div>
          </div>
        </div>
      </section>

      <div v-if="!isLoading && filteredOrders.length === 0" class="empty-state">
        <div class="empty-icon-box">
          <Icon name="note" :size="36" color="var(--text-muted)" />
        </div>
        <h2>No hay pedidos en esta sección</h2>
        <p v-if="selectedStatusFilter === 'HISTORY'">
          No se encontraron pedidos cerrados ni cancelados para la fecha seleccionada ({{ formattedHistorySelectedDate }}).
        </p>
        <p v-else>
          Los nuevos pedidos realizados por clientes aparecerán aquí automáticamente en tiempo real.
        </p>
      </div>

      <div v-else-if="!isLoading" class="orders-grid">
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
    </div> <!-- end orders-tab-container -->
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

.admin-main-tabs {
  display: flex;
  background: #151c28;
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 24px;
  gap: 8px;
}

.admin-nav-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.admin-nav-tab:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.03);
}

.admin-nav-tab.active {
  color: var(--accent-gold);
  border-bottom-color: var(--accent-gold);
}

.admin-tab-container {
  padding: 24px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
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

/* ==============================================================================
   QUICK CASH PILL EN NAVBAR (ACCESO DIRECTO A PAGOS TOTALES)
============================================================================== */
.quick-cash-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: var(--radius-full);
  padding: 6px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-cash-pill:hover {
  background: rgba(245, 158, 11, 0.22);
  border-color: var(--accent-gold);
  transform: translateY(-1px);
}

.quick-cash-pill.is-open {
  background: rgba(245, 158, 11, 0.24);
  border-color: var(--accent-gold);
  box-shadow: 0 0 14px rgba(245, 158, 11, 0.35);
}

.quick-cash-pill .cash-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-green);
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.7);
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.quick-cash-pill .cash-dot.cash-dot-active {
  background: var(--accent-gold);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.9);
}

.quick-cash-label {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.quick-cash-amount {
  font-family: var(--font-heading);
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--accent-gold);
}

@media (max-width: 768px) {
  .quick-cash-pill {
    padding: 4px 10px;
    gap: 6px;
  }
  .quick-cash-label {
    display: none;
  }
}

/* ==============================================================================
   HISTORIAL & ARQUEO DE CAJA DIARIO
============================================================================== */
.history-dashboard-header {
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  background: var(--bg-card-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 14px 18px;
}

.history-title-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-heading);
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
}

.history-subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}

.date-filter-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.date-quick-buttons {
  display: flex;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 2px;
}

.btn-date-quick {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 700;
  padding: 6px 14px;
  border-radius: calc(var(--radius-md) - 2px);
  cursor: pointer;
  transition: all 0.18s ease;
}

.btn-date-quick:hover {
  color: var(--text-primary);
}

.btn-date-quick.active {
  background: var(--accent-gold);
  color: #0b0e14;
  box-shadow: var(--shadow-sm);
}

.date-input-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 5px 10px;
}

.history-native-date {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.84rem;
  font-weight: 600;
  outline: none;
  cursor: pointer;
}

.history-native-date::-webkit-calendar-picker-indicator {
  filter: invert(0.8);
  cursor: pointer;
}

/* Panel de arqueo de caja */
.cash-summary-panel {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
}

@media (max-width: 900px) {
  .cash-summary-panel {
    grid-template-columns: 1fr;
  }
}

.summary-hero-card {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.05) 100%);
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: var(--radius-xl);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
}

.summary-hero-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-hero-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--accent-gold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.summary-hero-amount {
  font-family: var(--font-heading);
  font-size: 1.8rem;
  font-weight: 900;
  color: #ffffff;
  letter-spacing: -0.02em;
}

.summary-hero-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: var(--radius-full);
}

.stat-pill.stat-completed {
  background: rgba(16, 185, 129, 0.15);
  color: var(--accent-green);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.stat-pill.stat-cancelled {
  background: rgba(244, 63, 94, 0.15);
  color: var(--accent-red);
  border: 1px solid rgba(244, 63, 94, 0.3);
}

.methods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
}

.method-card {
  background: var(--bg-card-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all 0.2s ease;
}

.method-card:hover {
  border-color: var(--border-highlight);
  transform: translateY(-2px);
}

.method-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.method-sum {
  font-family: var(--font-heading);
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-primary);
}

</style>
