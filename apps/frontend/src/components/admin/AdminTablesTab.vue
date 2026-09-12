<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AdminTable } from '@qr-menu/shared';
import {
  fetchAdminTablesApi,
  createAdminTableApi,
  updateAdminTableApi,
  ApiClientError,
} from '../../services/api.js';
import Icon from '../common/Icon.vue';
import LoadingSpinner from '../common/LoadingSpinner.vue';
import QrGeneratorModal from './QrGeneratorModal.vue';

const tables = ref<AdminTable[]>([]);
const isLoading = ref(true);
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

// Formulario de nueva mesa
const newTableNumber = ref<number | ''>('');
const newTableName = ref('');

// Modal de QR
const selectedTableForQr = ref<AdminTable | null>(null);

async function loadTables() {
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const data = await fetchAdminTablesApi();
    tables.value = data.tables;
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      errorMessage.value = err.message;
    } else {
      errorMessage.value = 'Error al consultar listado de mesas';
    }
  } finally {
    isLoading.value = false;
  }
}

async function handleCreateTable() {
  if (typeof newTableNumber.value !== 'number' || newTableNumber.value <= 0) {
    errorMessage.value = 'Ingresa un número de mesa válido (mayor a 0)';
    return;
  }
  if (!newTableName.value.trim()) {
    errorMessage.value = 'Ingresa un nombre para identificar la mesa';
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = null;
  successMessage.value = null;

  try {
    const res = await createAdminTableApi({
      number: newTableNumber.value,
      name: newTableName.value.trim(),
    });
    tables.value.push(res.table);
    tables.value.sort((a, b) => a.number - b.number);
    successMessage.value = `¡Mesa #${res.table.number} creada con éxito!`;
    newTableNumber.value = '';
    newTableName.value = '';
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      errorMessage.value = err.message;
    } else {
      errorMessage.value = 'Error al registrar la nueva mesa';
    }
  } finally {
    isSubmitting.value = false;
  }
}

async function handleToggleStatus(table: AdminTable) {
  try {
    const res = await updateAdminTableApi(table.id, {
      isActive: !table.isActive,
    });
    table.isActive = res.table.isActive;
    successMessage.value = `Mesa #${table.number} ${table.isActive ? 'activada' : 'desactivada'}`;
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      errorMessage.value = err.message;
    } else {
      errorMessage.value = 'No se pudo actualizar el estado de la mesa';
    }
  }
}

function openQrModal(table: AdminTable) {
  selectedTableForQr.value = table;
}

onMounted(() => {
  loadTables();
});
</script>

<template>
  <div class="admin-tables-tab">
    <!-- Feedback Alerts -->
    <div v-if="errorMessage" class="tab-alert alert-error">
      <span>{{ errorMessage }}</span>
      <button type="button" class="alert-close" @click="errorMessage = null">×</button>
    </div>
    <div v-if="successMessage" class="tab-alert alert-success">
      <span>{{ successMessage }}</span>
      <button type="button" class="alert-close" @click="successMessage = null">×</button>
    </div>

    <!-- Barra de creación rápida -->
    <div class="create-table-card">
      <div class="card-header-row">
        <Icon name="table" :size="18" color="var(--accent-gold)" />
        <h2 class="card-title">Registrar Nueva Mesa</h2>
      </div>
      <form class="create-form" @submit.prevent="handleCreateTable">
        <div class="input-field num-field">
          <label for="table-num">Número #</label>
          <input
            id="table-num"
            v-model.number="newTableNumber"
            type="number"
            min="1"
            placeholder="Ej: 7"
            required
          />
        </div>
        <div class="input-field name-field">
          <label for="table-name">Nombre / Ubicación</label>
          <input
            id="table-name"
            v-model="newTableName"
            type="text"
            placeholder="Ej: Terraza 2, Barra Principal, etc."
            required
          />
        </div>
        <button type="submit" class="btn-submit" :disabled="isSubmitting">
          <Icon name="plus" :size="15" />
          <span>{{ isSubmitting ? 'Creando...' : 'Crear Mesa' }}</span>
        </button>
      </form>
    </div>

    <!-- Listado de mesas -->
    <div class="tables-list-section">
      <div class="section-title-row">
        <h3 class="section-heading">Mesas Configuradas ({{ tables.length }})</h3>
        <button type="button" class="btn-refresh-mini" title="Recargar mesas" @click="loadTables">
          <Icon name="refresh" :size="14" />
        </button>
      </div>

      <div v-if="isLoading" class="loading-box">
        <LoadingSpinner message="Consultando mesas..." />
      </div>

      <div v-else-if="tables.length === 0" class="empty-box">
        <p>Aún no hay mesas registradas. Crea una arriba para generar su QR.</p>
      </div>

      <div v-else class="tables-grid">
        <div
          v-for="table in tables"
          :key="table.id"
          class="table-item-card"
          :class="{ inactive: !table.isActive }"
        >
          <div class="table-card-header">
            <div class="table-badge">
              <span
                v-if="!table.name.includes(String(table.number))"
                class="table-num-tag"
              >
                #{{ table.number }}
              </span>
              <span class="table-name-text">{{ table.name }}</span>
            </div>
            <span class="status-pill" :class="table.isActive ? 'pill-active' : 'pill-inactive'">
              {{ table.isActive ? 'Activa' : 'Inactiva' }}
            </span>
          </div>

          <div class="token-info-row">
            <span class="token-label">Token:</span>
            <code class="token-code">{{ table.publicToken }}</code>
          </div>

          <div class="table-actions">
            <button
              type="button"
              class="btn-qr-action"
              title="Generar y personalizar QR"
              @click="openQrModal(table)"
            >
              <Icon name="table" :size="15" color="var(--accent-gold)" />
              <span>Ver / Descargar QR</span>
            </button>

            <button
              type="button"
              class="btn-toggle-switch"
              :class="{ 'btn-switch-off': table.isActive }"
              @click="handleToggleStatus(table)"
            >
              <span>{{ table.isActive ? 'Desactivar' : 'Activar' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de QR personalizado -->
    <QrGeneratorModal
      v-if="selectedTableForQr"
      :table="selectedTableForQr"
      @close="selectedTableForQr = null"
    />
  </div>
</template>

<style scoped>
.admin-tables-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.tab-alert {
  padding: 10px 14px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
}

.alert-error {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.alert-success {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #6ee7b7;
}

.alert-close {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 1.2rem;
  cursor: pointer;
}

.create-table-card {
  background: var(--bg-card, #1a1a1a);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-lg, 12px);
  padding: 16px 20px;
}

.card-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.card-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.create-form {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.input-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-field label {
  font-size: 0.75rem;
  color: var(--text-muted, #aaa);
}

.input-field input {
  background: #121212;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: 8px;
  padding: 8px 12px;
  color: #fff;
  font-size: 0.88rem;
  outline: none;
}

.input-field input:focus {
  border-color: var(--accent-gold, #c5a059);
}

.num-field {
  width: 100px;
}

.name-field {
  flex: 1;
  min-width: 180px;
}

.btn-submit {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--accent-gold, #c5a059);
  color: #000;
  border: none;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  height: 38px;
}

.btn-submit:hover:not(:disabled) {
  background: #d4b26f;
  transform: translateY(-1px);
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tables-list-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-heading {
  font-size: 0.95rem;
  font-weight: 600;
  color: #ddd;
  margin: 0;
}

.btn-refresh-mini {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #aaa;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
}

.tables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.table-item-card {
  background: var(--bg-card, #1a1a1a);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius-lg, 12px);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.2s;
}

.table-item-card.inactive {
  opacity: 0.6;
  border-color: rgba(255, 255, 255, 0.04);
}

.table-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-badge {
  display: flex;
  align-items: center;
  gap: 8px;
}

.table-num-tag {
  background: rgba(197, 160, 89, 0.15);
  color: var(--accent-gold, #c5a059);
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.85rem;
}

.table-name-text {
  font-weight: 600;
  font-size: 0.92rem;
  color: #fff;
}

.status-pill {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
}

.pill-active {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.pill-inactive {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.token-info-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
}

.token-label {
  color: var(--text-muted, #888);
}

.token-code {
  background: #111;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--accent-gold, #c5a059);
  font-family: monospace;
}

.table-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.btn-qr-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(197, 160, 89, 0.1);
  border: 1px solid rgba(197, 160, 89, 0.3);
  color: #fff;
  border-radius: 8px;
  padding: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-qr-action:hover {
  background: rgba(197, 160, 89, 0.25);
  border-color: var(--accent-gold, #c5a059);
}

.btn-toggle-switch {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #aaa;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.75rem;
  cursor: pointer;
}

.btn-toggle-switch:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.25);
}

.btn-switch-off {
  color: #f87171;
}

.empty-box,
.loading-box {
  padding: 30px;
  text-align: center;
  color: var(--text-muted, #888);
  background: var(--bg-card, #1a1a1a);
  border-radius: 12px;
}
</style>
