<script setup lang="ts">
defineProps<{
  title?: string;
  message: string;
  retryLabel?: string;
}>();

defineEmits<{
  (e: 'retry'): void;
}>();
</script>

<template>
  <div class="error-card" role="alert">
    <div class="error-icon" aria-hidden="true">⚠️</div>
    <h3 class="error-title">{{ title || 'Ha ocurrido un error' }}</h3>
    <p class="error-message">{{ message }}</p>
    <button
      v-if="retryLabel"
      type="button"
      class="retry-btn"
      @click="$emit('retry')"
    >
      {{ retryLabel }}
    </button>
  </div>
</template>

<style scoped>
.error-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-left: 4px solid var(--accent-red);
  padding: 24px;
  border-radius: 8px;
  margin: 20px 0;
  text-align: center;
}

.error-icon {
  font-size: 2rem;
  margin-bottom: 8px;
}

.error-title {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.error-message {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-bottom: 16px;
  line-height: 1.4;
}

.retry-btn {
  background-color: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.retry-btn:hover,
.retry-btn:active {
  background-color: var(--border-subtle);
}
</style>
