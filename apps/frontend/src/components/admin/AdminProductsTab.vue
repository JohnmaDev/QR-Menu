<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { AdminProduct, CreateProductInput, UpdateProductInput } from '@qr-menu/shared';
import {
  fetchAdminProductsApi,
  createAdminProductApi,
  updateAdminProductApi,
  toggleProductAvailabilityApi,
  fetchAdminCategoriesApi,
  ApiClientError,
} from '../../services/api.js';
import { formatCOP } from '../../utils/currency.js';
import { optimizeProductImage } from '../../utils/images.js';
import { openProductImageWidget } from '../../utils/cloudinary.js';
import Icon from '../common/Icon.vue';
import LoadingSpinner from '../common/LoadingSpinner.vue';

const products = ref<AdminProduct[]>([]);
const categories = ref<Array<{ id: number; name: string; icon: string | null; sortOrder: number }>>([]);
const isLoading = ref(true);
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

// Filtro de categoría
const selectedCategoryFilter = ref<string>('ALL');

// Modal de Creación / Edición
const isModalOpen = ref(false);
const editingProduct = ref<AdminProduct | null>(null);

const formName = ref('');
const formCategoryId = ref<number | ''>('');
const formPrice = ref<number | ''>('');
const formDescription = ref('');
const formImageUrl = ref('');
const formIsAvailable = ref(true);
const isUploadingCloudinary = ref(false);
const cloudinaryUploadError = ref<string | null>(null);

const filteredProducts = computed(() => {
  if (selectedCategoryFilter.value === 'ALL') return products.value;
  return products.value.filter((p) => String(p.categoryId) === selectedCategoryFilter.value);
});

const countAvailable = computed(() => products.value.filter((p) => p.isAvailable).length);
const countUnavailable = computed(() => products.value.filter((p) => !p.isAvailable).length);

async function loadData() {
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const [prodsData, catsData] = await Promise.all([
      fetchAdminProductsApi(),
      fetchAdminCategoriesApi(),
    ]);
    products.value = prodsData.products;
    categories.value = catsData.categories;
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      errorMessage.value = err.message;
    } else {
      errorMessage.value = 'Error al cargar catálogo de productos';
    }
  } finally {
    isLoading.value = false;
  }
}

function openCreateModal() {
  editingProduct.value = null;
  formName.value = '';
  formCategoryId.value = categories.value.length > 0 ? categories.value[0].id : '';
  formPrice.value = '';
  formDescription.value = '';
  formImageUrl.value = '';
  formIsAvailable.value = true;
  cloudinaryUploadError.value = null;
  isUploadingCloudinary.value = false;
  isModalOpen.value = true;
}

function openEditModal(prod: AdminProduct) {
  editingProduct.value = prod;
  formName.value = prod.name;
  formCategoryId.value = prod.categoryId;
  formPrice.value = prod.price;
  formDescription.value = prod.description || '';
  formImageUrl.value = prod.imageUrl || '';
  formIsAvailable.value = prod.isAvailable;
  cloudinaryUploadError.value = null;
  isUploadingCloudinary.value = false;
  isModalOpen.value = true;
}

function closeModal() {
  isModalOpen.value = false;
  editingProduct.value = null;
  cloudinaryUploadError.value = null;
  isUploadingCloudinary.value = false;
}

function handleUploadImage() {
  cloudinaryUploadError.value = null;
  isUploadingCloudinary.value = true;
  openProductImageWidget({
    onSuccess: (secureUrl) => {
      formImageUrl.value = secureUrl;
      isUploadingCloudinary.value = false;
    },
    onError: (err) => {
      console.error('Error Cloudinary Widget:', err);
      cloudinaryUploadError.value = 'No se pudo abrir o completar la subida de la imagen.';
      isUploadingCloudinary.value = false;
    },
  });
}

function handleRemoveImage() {
  formImageUrl.value = '';
  cloudinaryUploadError.value = null;
}

async function handleSaveProduct() {
  if (!formName.value.trim()) {
    errorMessage.value = 'El nombre del producto es obligatorio';
    return;
  }
  if (typeof formPrice.value !== 'number' || formPrice.value < 0) {
    errorMessage.value = 'Ingresa un precio válido (mayor o igual a 0)';
    return;
  }
  if (!formCategoryId.value) {
    errorMessage.value = 'Selecciona una categoría';
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = null;
  successMessage.value = null;

  try {
    if (editingProduct.value) {
      // Actualizar producto existente
      const updateData: UpdateProductInput = {
        name: formName.value.trim(),
        categoryId: Number(formCategoryId.value),
        price: Number(formPrice.value),
        description: formDescription.value.trim() || null,
        imageUrl: formImageUrl.value.trim() || null,
        isAvailable: formIsAvailable.value,
      };
      const res = await updateAdminProductApi(editingProduct.value.id, updateData);
      const index = products.value.findIndex((p) => p.id === res.product.id);
      if (index !== -1) {
        products.value[index] = res.product;
      }
      successMessage.value = `¡Producto '${res.product.name}' actualizado!`;
    } else {
      // Crear nuevo producto
      const createData: CreateProductInput = {
        name: formName.value.trim(),
        categoryId: Number(formCategoryId.value),
        price: Number(formPrice.value),
        description: formDescription.value.trim() || null,
        imageUrl: formImageUrl.value.trim() || null,
        isAvailable: formIsAvailable.value,
        sortOrder: 0,
      };
      const res = await createAdminProductApi(createData);
      products.value.push(res.product);
      successMessage.value = `¡Producto '${res.product.name}' agregado al menú!`;
    }
    closeModal();
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      errorMessage.value = err.message;
    } else {
      errorMessage.value = 'Error al guardar el producto';
    }
  } finally {
    isSubmitting.value = false;
  }
}

async function handleToggleAvailability(prod: AdminProduct) {
  try {
    const res = await toggleProductAvailabilityApi(prod.id);
    prod.isAvailable = res.product.isAvailable;
    successMessage.value = `'${prod.name}' ahora está ${prod.isAvailable ? 'DISPONIBLE' : 'AGOTADO'}`;
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      errorMessage.value = err.message;
    } else {
      errorMessage.value = 'No se pudo cambiar la disponibilidad del producto';
    }
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="admin-products-tab">
    <!-- Feedback Alerts -->
    <div v-if="errorMessage" class="tab-alert alert-error">
      <span>{{ errorMessage }}</span>
      <button type="button" class="alert-close" @click="errorMessage = null">×</button>
    </div>
    <div v-if="successMessage" class="tab-alert alert-success">
      <span>{{ successMessage }}</span>
      <button type="button" class="alert-close" @click="successMessage = null">×</button>
    </div>

    <!-- Barra de acciones y filtros -->
    <div class="toolbar-card">
      <div class="summary-pills">
        <div class="pill-stat">
          <span class="stat-num">{{ products.length }}</span>
          <span class="stat-label">Total</span>
        </div>
        <div class="pill-stat stat-active">
          <span class="stat-num">{{ countAvailable }}</span>
          <span class="stat-label">Disponibles</span>
        </div>
        <div class="pill-stat stat-inactive">
          <span class="stat-num">{{ countUnavailable }}</span>
          <span class="stat-label">Agotados</span>
        </div>
      </div>

      <div class="filter-actions">
        <!-- Filtro por categoría -->
        <select v-model="selectedCategoryFilter" class="category-select">
          <option value="ALL">Todas las Categorías</option>
          <option v-for="cat in categories" :key="cat.id" :value="String(cat.id)">
            {{ cat.name }}
          </option>
        </select>

        <!-- Botón Nuevo Producto -->
        <button type="button" class="btn-create-prod" @click="openCreateModal">
          <Icon name="plus" :size="16" />
          <span>Nuevo Producto</span>
        </button>
      </div>
    </div>

    <!-- Lista de productos -->
    <div v-if="isLoading" class="loading-box">
      <LoadingSpinner message="Consultando catálogo..." />
    </div>

    <div v-else-if="filteredProducts.length === 0" class="empty-box">
      <p>No hay productos en esta selección. Añade uno con el botón superior.</p>
    </div>

    <div v-else class="products-grid">
      <div
        v-for="prod in filteredProducts"
        :key="prod.id"
        class="product-admin-card"
        :class="{ unavailable: !prod.isAvailable }"
      >
        <div class="product-thumb-box">
          <img
            v-if="prod.imageUrl"
            :src="optimizeProductImage(prod.imageUrl, 120)"
            :alt="prod.name"
            class="product-thumb"
            loading="lazy"
            decoding="async"
            @error="prod.imageUrl = null"
          />
          <div v-else class="thumb-fallback">
            <Icon name="beer" :size="24" color="var(--accent-gold)" />
          </div>
        </div>

        <div class="product-details">
          <div class="prod-category-tag">{{ prod.categoryName }}</div>
          <h4 class="prod-title">{{ prod.name }}</h4>
          <p v-if="prod.description" class="prod-desc">{{ prod.description }}</p>
          <div class="prod-price-row">
            <span class="prod-price">{{ formatCOP(prod.price) }}</span>
            <span
              class="availability-badge"
              :class="prod.isAvailable ? 'badge-in-stock' : 'badge-out-of-stock'"
            >
              {{ prod.isAvailable ? 'En Carta' : 'Agotado' }}
            </span>
          </div>
        </div>

        <div class="product-card-footer">
          <button
            type="button"
            class="btn-toggle-avail"
            :class="prod.isAvailable ? 'btn-mark-out' : 'btn-mark-in'"
            :title="prod.isAvailable ? 'Marcar como agotado' : 'Habilitar producto'"
            @click="handleToggleAvailability(prod)"
          >
            <span>{{ prod.isAvailable ? 'Marcar Agotado' : 'Reactivar' }}</span>
          </button>

          <button
            type="button"
            class="btn-edit-prod"
            title="Editar producto"
            @click="openEditModal(prod)"
          >
            <Icon name="check" :size="14" />
            <span>Editar</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Creación / Edición -->
    <div v-if="isModalOpen" class="modal-backdrop" @click.self="closeModal">
      <div class="modal-card" role="dialog" aria-modal="true">
        <header class="modal-header">
          <h3 class="modal-title">
            {{ editingProduct ? 'Editar Producto' : 'Añadir Nuevo Producto' }}
          </h3>
          <button type="button" class="btn-close" @click="closeModal">×</button>
        </header>

        <form class="modal-form" @submit.prevent="handleSaveProduct">
          <div class="form-group">
            <label for="prod-name">Nombre del producto *</label>
            <input
              id="prod-name"
              v-model="formName"
              type="text"
              placeholder="Ej: Cerveza Club Colombia Dorada"
              required
            />
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label for="prod-cat">Categoría *</label>
              <select id="prod-cat" v-model="formCategoryId" required>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label for="prod-price">Precio (COP) *</label>
              <input
                id="prod-price"
                v-model.number="formPrice"
                type="number"
                min="0"
                step="500"
                placeholder="Ej: 8000"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label for="prod-desc">Descripción (opcional)</label>
            <textarea
              id="prod-desc"
              v-model="formDescription"
              rows="2"
              placeholder="Presentación, ingredientes o detalles"
            ></textarea>
          </div>

          <div class="form-group image-upload-group">
            <div class="image-field-header">
              <label>Foto del Producto</label>
              <span class="image-field-hint">Cloudinary • Optimización AVIF/WebP</span>
            </div>

            <!-- Previsualización si ya existe imagen -->
            <div v-if="formImageUrl" class="current-image-preview-card">
              <div class="img-preview-box">
                <img :src="optimizeProductImage(formImageUrl, 260)" alt="Vista previa" class="img-preview" />
              </div>
              <div class="preview-actions">
                <div class="preview-status">
                  <span class="preview-status-dot"></span>
                  <span class="preview-status-text">Foto lista para la carta</span>
                </div>
                <div class="preview-buttons">
                  <button
                    type="button"
                    class="btn-change-image"
                    :disabled="isUploadingCloudinary"
                    @click="handleUploadImage"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>Cambiar</span>
                  </button>
                  <button
                    type="button"
                    class="btn-remove-image"
                    @click="handleRemoveImage"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    <span>Quitar</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Botón de subida directo si no hay imagen -->
            <div v-else class="upload-trigger-box">
              <button
                type="button"
                class="btn-cloudinary-upload"
                :disabled="isUploadingCloudinary"
                @click="handleUploadImage"
              >
                <div class="upload-icon-circle">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div class="upload-btn-texts">
                  <span class="upload-btn-title">Subir Foto a Cloudinary</span>
                  <span class="upload-btn-desc">Desde PC, galería o cámara del celular</span>
                </div>
              </button>
            </div>

            <div v-if="cloudinaryUploadError" class="cloudinary-error">
              {{ cloudinaryUploadError }}
            </div>

            <!-- Entrada manual secundaria opcional -->
            <details class="manual-url-details">
              <summary>O pegar URL manual</summary>
              <input
                id="prod-img"
                v-model="formImageUrl"
                type="url"
                placeholder="https://res.cloudinary.com/... o enlace de imagen"
                class="manual-url-input"
              />
            </details>
          </div>

          <div class="checkbox-group">
            <label class="checkbox-label">
              <input v-model="formIsAvailable" type="checkbox" />
              <span>Disponible inmediatamente en el menú de clientes</span>
            </label>
          </div>

          <footer class="modal-actions">
            <button type="button" class="btn-cancel" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn-save" :disabled="isSubmitting">
              {{ isSubmitting ? 'Guardando...' : (editingProduct ? 'Guardar Cambios' : 'Crear Producto') }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-products-tab {
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

.toolbar-card {
  background: var(--bg-card, #1a1a1a);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-lg, 12px);
  padding: 14px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.summary-pills {
  display: flex;
  gap: 10px;
}

.pill-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
}

.stat-num {
  font-weight: 700;
  color: #fff;
}

.stat-label {
  color: #aaa;
}

.stat-active .stat-num {
  color: #10b981;
}

.stat-inactive .stat-num {
  color: #ef4444;
}

.filter-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.category-select {
  background: #121212;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  color: #ddd;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.85rem;
  outline: none;
}

.btn-create-prod {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--accent-gold, #c5a059);
  color: #000;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-create-prod:hover {
  background: #d4b26f;
  transform: translateY(-1px);
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.product-admin-card {
  background: var(--bg-card, #1a1a1a);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius-lg, 12px);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.2s;
}

.product-admin-card.unavailable {
  opacity: 0.65;
  border-color: rgba(239, 68, 68, 0.2);
}

.product-thumb-box {
  width: 100%;
  height: 120px;
  background: #121212;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: rgba(197, 160, 89, 0.05);
}

.product-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.prod-category-tag {
  font-size: 0.7rem;
  color: var(--accent-gold, #c5a059);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.prod-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.prod-desc {
  font-size: 0.78rem;
  color: #999;
  margin: 0;
  line-height: 1.3;
}

.prod-price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}

.prod-price {
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent-gold, #c5a059);
}

.availability-badge {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.badge-in-stock {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.badge-out-of-stock {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.product-card-footer {
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
  padding-top: 10px;
}

.btn-toggle-avail {
  flex: 1;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-mark-out {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.btn-mark-out:hover {
  background: rgba(239, 68, 68, 0.25);
}

.btn-mark-in {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.3);
  color: #6ee7b7;
}

.btn-mark-in:hover {
  background: rgba(16, 185, 129, 0.25);
}

.btn-edit-prod {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ddd;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
}

.btn-edit-prod:hover {
  color: #fff;
  border-color: var(--accent-gold, #c5a059);
}

/* Modal Form */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-card {
  background: var(--bg-card, #1a1a1a);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.btn-close {
  background: transparent;
  border: none;
  color: #888;
  font-size: 1.4rem;
  cursor: pointer;
}

.modal-form {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.78rem;
  color: #aaa;
}

.form-group input,
.form-group select,
.form-group textarea {
  background: #121212;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  color: #fff;
  font-size: 0.88rem;
  outline: none;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: var(--accent-gold, #c5a059);
}

.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.img-preview-box {
  width: 100%;
  height: 140px;
  border-radius: 10px;
  overflow: hidden;
  background: #0d0f14;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.img-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Cloudinary Upload Styles */
.image-upload-group {
  gap: 8px;
}

.image-field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.image-field-hint {
  font-size: 0.72rem;
  color: var(--accent-gold, #c5a059);
  font-weight: 600;
  letter-spacing: 0.2px;
}

.upload-trigger-box {
  width: 100%;
}

.btn-cloudinary-upload {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(145deg, rgba(197, 160, 89, 0.08), rgba(255, 255, 255, 0.02));
  border: 1.5px dashed rgba(197, 160, 89, 0.4);
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  text-align: left;
  color: #fff;
}

.btn-cloudinary-upload:hover:not(:disabled) {
  border-color: var(--accent-gold, #c5a059);
  background: linear-gradient(145deg, rgba(197, 160, 89, 0.16), rgba(255, 255, 255, 0.05));
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(197, 160, 89, 0.15);
}

.btn-cloudinary-upload:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-icon-circle {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(197, 160, 89, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-gold, #c5a059);
  flex-shrink: 0;
}

.upload-btn-texts {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.upload-btn-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: #fff;
}

.upload-btn-desc {
  font-size: 0.75rem;
  color: #9ca3af;
}

.current-image-preview-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #11141c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px;
}

.preview-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.preview-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.preview-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.preview-status-text {
  font-size: 0.74rem;
  color: #10b981;
  font-weight: 600;
}

.preview-buttons {
  display: flex;
  gap: 8px;
}

.btn-change-image,
.btn-remove-image {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.74rem;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-change-image {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #e5e7eb;
}

.btn-change-image:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.btn-remove-image {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #ef4444;
}

.btn-remove-image:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.cloudinary-error {
  font-size: 0.78rem;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  padding: 6px 10px;
}

.manual-url-details {
  margin-top: 4px;
}

.manual-url-details summary {
  font-size: 0.74rem;
  color: #888;
  cursor: pointer;
  user-select: none;
}

.manual-url-details summary:hover {
  color: #aaa;
}

.manual-url-input {
  margin-top: 6px;
  width: 100%;
}

.checkbox-group {
  padding: 4px 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: #ccc;
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-cancel {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ccc;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-save {
  background: var(--accent-gold, #c5a059);
  color: #000;
  border: none;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-save:hover:not(:disabled) {
  background: #d4b26f;
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
