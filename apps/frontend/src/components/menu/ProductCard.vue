<script setup lang="ts">
import { ref, computed } from 'vue';
import { MenuItem } from '@qr-menu/shared';
import { formatCOP } from '../../utils/currency.js';
import { optimizeProductImage } from '../../utils/images.js';
import Icon from '../common/Icon.vue';

const props = defineProps<{
  product: MenuItem;
  quantityInCart: number;
  categoryId?: number;
}>();

defineEmits<{
  (e: 'add', product: MenuItem): void;
  (e: 'increment', productId: number): void;
  (e: 'decrement', productId: number): void;
}>();

const imageError = ref(false);

const optimizedImage = computed(() => {
  if (!props.product.imageUrl || imageError.value) return null;
  return optimizeProductImage(props.product.imageUrl, 160);
});
</script>

<template>
  <article class="product-card" :aria-labelledby="`prod-title-${product.id}`">
    <!-- Miniatura optimizada de Cloudinary -->
    <div v-if="optimizedImage" class="product-media">
      <img
        :src="optimizedImage"
        :alt="product.name"
        class="product-card-img"
        loading="lazy"
        decoding="async"
        @error="imageError = true"
      />
    </div>

    <div class="product-info">
      <div class="product-header-row">
        <h3 :id="`prod-title-${product.id}`" class="product-name">
          {{ product.name }}
        </h3>
        <span class="product-price">
          {{ formatCOP(product.price) }}
        </span>
      </div>
      <p v-if="product.description" class="product-desc">
        {{ product.description }}
      </p>
    </div>

    <div class="product-actions">
      <div v-if="quantityInCart > 0" class="qty-selector" aria-label="Selector de cantidad">
        <button
          type="button"
          class="qty-btn"
          aria-label="Disminuir cantidad"
          @click="$emit('decrement', product.id)"
        >
          <Icon name="minus" :size="14" />
        </button>
        <span class="qty-count" aria-live="polite">{{ quantityInCart }}</span>
        <button
          type="button"
          class="qty-btn"
          aria-label="Aumentar cantidad"
          @click="$emit('increment', product.id)"
        >
          <Icon name="plus" :size="14" />
        </button>
      </div>
      <button
        v-else
        type="button"
        class="add-btn"
        :aria-label="`Agregar ${product.name} al carrito`"
        @click="$emit('add', product)"
      >
        <Icon name="plus" :size="15" />
        <span>Agregar</span>
      </button>
    </div>
  </article>
</template>

<style scoped>
.product-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-card-glass);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  margin-bottom: 12px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: var(--shadow-sm);
  position: relative;
}

.product-card:hover {
  border-color: var(--border-highlight);
  background: var(--bg-card-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.product-media {
  width: 66px;
  height: 66px;
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-card, #141720);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  box-shadow: var(--shadow-sm);
}

.product-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s ease;
}

.product-card:hover .product-card-img {
  transform: scale(1.06);
}

.product-info {
  flex: 1 1 auto;
  min-width: 0;
}

.product-header-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.product-name {
  font-family: var(--font-heading);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.product-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-price {
  font-family: var(--font-heading);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--accent-gold);
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.product-actions {
  flex-shrink: 0;
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent-gold-gradient);
  color: #0b0e14;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 8px 14px;
  border-radius: var(--radius-full);
  box-shadow: 0 2px 10px rgba(245, 158, 11, 0.25);
  transition: all 0.18s ease;
}

.add-btn:hover {
  filter: brightness(1.08);
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);
  transform: translateY(-1px);
}

.add-btn:active {
  transform: scale(0.95);
}

.qty-selector {
  display: inline-flex;
  align-items: center;
  background-color: var(--bg-card);
  border: 1px solid var(--border-highlight);
  border-radius: var(--radius-full);
  padding: 3px;
  box-shadow: var(--shadow-sm);
}

.qty-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-elevated);
  color: var(--text-primary);
  border-radius: 50%;
  transition: all 0.15s;
}

.qty-btn:hover {
  background-color: var(--border-highlight);
  color: var(--accent-gold);
}

.qty-btn:active {
  transform: scale(0.9);
}

.qty-count {
  min-width: 26px;
  text-align: center;
  font-family: var(--font-heading);
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--accent-gold);
}
</style>
