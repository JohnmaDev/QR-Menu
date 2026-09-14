<script setup lang="ts">
// Vista de inicio / fallback
</script>

<template>
  <main class="home-container">
    <h1>Licores Distrito 4</h1>
    <p>Por favor escanea el código QR ubicado en tu mesa para realizar un pedido.</p>
  </main>
</template>

<style scoped>
.home-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 24px;
  text-align: center;
}

h1 {
  font-size: 1.5rem;
  color: var(--accent-gold);
  margin-bottom: 12px;
}

p {
  color: var(--text-secondary);
  max-width: 320px;
}
</style>
