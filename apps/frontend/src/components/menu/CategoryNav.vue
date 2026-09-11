<script setup lang="ts">
import { MenuCategory } from '@qr-menu/shared';
import Icon from '../common/Icon.vue';

defineProps<{
  categories: MenuCategory[];
  activeCategoryId: number | null;
}>();

const emit = defineEmits<{
  (e: 'select', categoryId: number): void;
}>();

function onSelect(id: number) {
  emit('select', id);
}
</script>

<template>
  <nav class="category-nav" aria-label="Categorías de productos">
    <div class="category-scroll">
      <button
        v-for="cat in categories"
        :key="cat.id"
        type="button"
        class="category-pill"
        :class="{ active: activeCategoryId === cat.id }"
        :aria-pressed="activeCategoryId === cat.id"
        @click="onSelect(cat.id)"
      >
        <span v-if="cat.icon" class="cat-icon" aria-hidden="true">
          <Icon :name="cat.icon" :size="16" />
        </span>
        <span class="cat-name">{{ cat.name }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.category-nav {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(10, 14, 23, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  padding: 10px 0;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 20px;
}

.category-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 2px 16px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.category-scroll::-webkit-scrollbar {
  display: none;
}

.category-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.category-pill:hover:not(.active) {
  background: var(--bg-card-hover);
  color: var(--text-primary);
  border-color: var(--border-highlight);
  transform: translateY(-1px);
}

.category-pill.active {
  background: var(--accent-gold-gradient);
  color: #0b0e14;
  border-color: transparent;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);
  transform: translateY(-1px);
}

.cat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.category-pill.active .cat-icon {
  color: #0b0e14;
}
</style>
