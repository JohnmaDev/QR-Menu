<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchMenu, ApiClientError } from '../services/api.js';
import { PublicMenuResponse } from '@qr-menu/shared';
import { useCartStore } from '../stores/cart.js';
import CategoryNav from '../components/menu/CategoryNav.vue';
import ProductCard from '../components/menu/ProductCard.vue';
import BottomCartBar from '../components/cart/BottomCartBar.vue';
import LoadingSpinner from '../components/common/LoadingSpinner.vue';
import ErrorMessage from '../components/common/ErrorMessage.vue';
import Icon from '../components/common/Icon.vue';

const route = useRoute();
const router = useRouter();
const cart = useCartStore();

const tableToken = computed(() => route.params.tableToken as string);

const menuData = ref<PublicMenuResponse | null>(null);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);
const activeCategoryId = ref<number | null>(null);

const CACHE_KEY = 'qr_menu_cached_data';

// Hidratación instantánea desde localStorage si existe (render en 0ms)
const cachedMenu = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(CACHE_KEY) : null;
let hasInitialCache = false;
if (cachedMenu) {
  try {
    const parsed = JSON.parse(cachedMenu);
    if (parsed && Array.isArray(parsed.categories) && parsed.categories.length > 0) {
      menuData.value = parsed;
      activeCategoryId.value = parsed.categories[0].id;
      isLoading.value = false;
      hasInitialCache = true;
    }
  } catch {
    // Si la caché estuviera corrupta, continuar normalmente
  }
}

async function loadMenu() {
  if (!hasInitialCache && !menuData.value) {
    isLoading.value = true;
  }
  errorMessage.value = null;

  try {
    const data = await fetchMenu();
    menuData.value = data;
    if (data.categories.length > 0 && !activeCategoryId.value) {
      activeCategoryId.value = data.categories[0].id;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch {
        // QuotaExceededError o modo incógnito restringido
      }
    }
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      errorMessage.value = err.message;
    } else {
      errorMessage.value = 'No pudimos cargar el menú. Comprueba tu conexión e inténtalo nuevamente.';
    }
  } finally {
    isLoading.value = false;
  }
}

function handleSelectCategory(categoryId: number) {
  activeCategoryId.value = categoryId;
  const section = document.getElementById(`cat-sec-${categoryId}`);
  if (section) {
    const offset = 70;
    const elementPosition = section.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo({
      top: elementPosition - offset,
      behavior: 'smooth',
    });
  }
}

function goToCart() {
  router.push(`/m/${tableToken.value}/cart`);
}

onMounted(() => {
  if (tableToken.value) {
    cart.setTableToken(tableToken.value);
  }
  loadMenu();
});
</script>

<template>
  <div class="menu-page">
    <header class="bar-header">
      <div class="header-inner">
        <div class="brand-block">
          <h1 class="brand-title">El Mora</h1>
        </div>
        <div v-if="tableToken" class="table-chip">
          <span class="live-dot" />
          <Icon name="table" :size="14" color="var(--accent-gold)" />
          <span class="table-text">Mesa Activa</span>
        </div>
      </div>
      <p class="welcome-tagline">
        Selecciona tus bebidas y bocados favoritos para ordenar directo a tu mesa.
      </p>
    </header>

    <!-- Estado de Carga -->
    <div v-if="isLoading" class="loading-container">
      <LoadingSpinner message="Cargando menú frío..." />
    </div>

    <!-- Estado de Error -->
    <div v-else-if="errorMessage" class="error-wrapper">
      <ErrorMessage
        :message="errorMessage"
        retry-label="Reintentar"
        @retry="loadMenu"
      />
    </div>

    <!-- Menú Cargado -->
    <div v-else-if="menuData" class="menu-content">
      <!-- Navegación sticky de categorías -->
      <CategoryNav
        :categories="menuData.categories"
        :active-category-id="activeCategoryId"
        @select="handleSelectCategory"
      />

      <!-- Listado de Productos agrupados por Categoría -->
      <main class="categories-list">
        <section
          v-for="category in menuData.categories"
          :key="category.id"
          :id="`cat-sec-${category.id}`"
          class="category-section"
        >
          <div class="category-header-wrap">
            <div class="category-icon-bubble">
              <Icon :name="category.icon || 'beer'" :size="18" color="var(--accent-gold)" />
            </div>
            <h2 class="category-heading">
              {{ category.name }}
            </h2>
          </div>

          <div class="products-grid">
            <ProductCard
              v-for="product in category.products"
              :key="product.id"
              :product="product"
              :category-id="category.id"
              :quantity-in-cart="cart.getItemQuantity(product.id)"
              @add="cart.addItem"
              @increment="cart.incrementItem"
              @decrement="cart.decrementItem"
            />
          </div>
        </section>
      </main>

      <!-- Barra flotante de carrito inferior en móvil -->
      <BottomCartBar
        :total-count="cart.totalCount"
        :estimated-total="cart.estimatedTotal"
        @view-cart="goToCart"
      />
    </div>
  </div>
</template>

<style scoped>
.menu-page {
  max-width: 520px;
  margin: 0 auto;
  min-height: 100vh;
  padding-bottom: 110px;
  position: relative;
}

.bar-header {
  padding: 24px 20px 16px 20px;
  background: linear-gradient(180deg, rgba(21, 29, 46, 0.95) 0%, rgba(10, 14, 23, 0.8) 100%);
  border-bottom: 1px solid var(--border-subtle);
  position: relative;
}

.header-inner {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.brand-block {
  display: flex;
  flex-direction: column;
}

.brand-badge {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--accent-gold);
  text-transform: uppercase;
  margin-bottom: 2px;
}

.brand-title {
  font-family: var(--font-heading);
  font-size: 1.65rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  line-height: 1.15;
}

.table-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  padding: 6px 12px;
  border-radius: var(--radius-full);
}

.live-dot {
  width: 7px;
  height: 7px;
  background-color: var(--accent-green);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--accent-green);
  animation: pulse-dot 2s infinite ease-in-out;
}

.table-text {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}

.welcome-tagline {
  font-size: 0.88rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-top: 4px;
}

.loading-container {
  padding: 60px 20px;
  display: flex;
  justify-content: center;
}

.error-wrapper {
  padding: 40px 20px;
}

.menu-content {
  animation: fadeIn 0.3s ease;
}

.categories-list {
  padding: 0 16px;
}

.category-section {
  margin-bottom: 28px;
}

.category-header-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.category-icon-bubble {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.category-heading {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.products-grid {
  display: flex;
  flex-direction: column;
}
</style>
