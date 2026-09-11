<script setup lang="ts">
defineProps<{
  message?: string;
}>();
</script>

<template>
  <div class="spinner-container" role="status" aria-live="polite">
    <div class="spinner" aria-hidden="true"></div>
    <p v-if="message" class="spinner-text">{{ message }}</p>
  </div>
</template>

<style scoped>
.spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-subtle);
  border-top-color: var(--accent-gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-text {
  margin-top: 14px;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
