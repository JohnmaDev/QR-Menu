<template>
  <div class="menu-skeleton" aria-busy="true" aria-label="Cargando menú...">
    <!-- Category pills skeleton -->
    <div class="skeleton-nav">
      <div v-for="i in 4" :key="`cat-skel-${i}`" class="skeleton-pill shimmer"></div>
    </div>

    <!-- Section title skeleton -->
    <div class="skeleton-header shimmer"></div>

    <!-- Product cards skeleton -->
    <div class="skeleton-cards">
      <div v-for="i in 6" :key="`prod-skel-${i}`" class="skeleton-card">
        <div class="skeleton-card-body">
          <div class="skeleton-title-row">
            <div class="skeleton-line skeleton-title shimmer"></div>
            <div class="skeleton-line skeleton-price shimmer"></div>
          </div>
          <div class="skeleton-line skeleton-desc shimmer"></div>
        </div>
        <div class="skeleton-btn shimmer"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu-skeleton {
  width: 100%;
  padding: 0 16px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.skeleton-nav {
  display: flex;
  gap: 8px;
  padding: 12px 0 16px 0;
  overflow-x: hidden;
}

.skeleton-pill {
  width: 90px;
  height: 38px;
  border-radius: 20px;
  flex-shrink: 0;
}

.skeleton-header {
  width: 140px;
  height: 24px;
  border-radius: 6px;
  margin: 12px 0 16px 0;
}

.skeleton-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-card-glass, rgba(26, 26, 26, 0.7));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius-lg, 12px);
  padding: 14px 16px;
}

.skeleton-card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.skeleton-line {
  border-radius: 4px;
}

.skeleton-title {
  width: 55%;
  height: 18px;
}

.skeleton-price {
  width: 60px;
  height: 18px;
}

.skeleton-desc {
  width: 80%;
  height: 12px;
}

.skeleton-btn {
  width: 84px;
  height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
}

/* Efecto Shimmer ultra-fluido a 60 FPS */
.shimmer {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 25%,
    rgba(255, 255, 255, 0.12) 50%,
    rgba(255, 255, 255, 0.04) 75%
  );
  background-size: 200% 100%;
  animation: shimmerAnim 1.5s infinite;
}

@keyframes shimmerAnim {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
