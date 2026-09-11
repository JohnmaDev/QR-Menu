<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    name: string;
    size?: number | string;
    color?: string;
  }>(),
  {
    size: 20,
    color: 'currentColor',
  }
);

const pixelSize = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size));
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="pixelSize"
    :height="pixelSize"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="svg-icon"
  >
    <!-- Cerveza / Beer -->
    <g v-if="name === 'beer'">
      <path d="M17 11h1a3 3 0 0 1 0 6h-1" />
      <path d="M9 12v6" />
      <path d="M13 12v6" />
      <path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5s1.44-.5 3-.5 2 .5 3 .5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z" />
      <path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
    </g>

    <!-- Licor / Wine -->
    <g v-else-if="name === 'wine'">
      <path d="M8 22h8" />
      <path d="M7 10h10" />
      <path d="M12 15v7" />
      <path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" />
    </g>

    <!-- Granizados / Slush / Snowflake -->
    <g v-else-if="name === 'snowflake'">
      <path d="m10 20-1.25-2.5L6 18" />
      <path d="M10 4 8.75 6.5 6 6" />
      <path d="m14 20 1.25-2.5L18 18" />
      <path d="m14 4 1.25 2.5L18 6" />
      <path d="m17 21-3-6h-4l-3 6" />
      <path d="m17 3-3 6h-4L7 3" />
      <path d="M2 12h20" />
      <path d="m20 10-2.5 1.25L18 14" />
      <path d="m4 10 2.5 1.25L6 14" />
      <path d="m20 14-2.5-1.25L18 10" />
      <path d="m4 14 2.5-1.25L6 10" />
      <path d="m21 7-6 3v4l6 3" />
      <path d="m3 7 6 3v4l-6 3" />
      <path d="M12 2v20" />
    </g>

    <!-- Gaseosas / Sodas / Cup -->
    <g v-else-if="name === 'cup-soda' || name === 'soda'">
      <path d="m6 8 1.75 12.28A2 2 0 0 0 9.74 22h4.52a2 2 0 0 0 1.99-1.72L18 8" />
      <path d="M5 8h14" />
      <path d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0" />
      <path d="m12 8 1-6h2" />
    </g>

    <!-- Snacks / Popcorn -->
    <g v-else-if="name === 'popcorn' || name === 'snack'">
      <path d="M18 8a2 2 0 0 0 0-4 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0 0 4" />
      <path d="M10 22 9 8" />
      <path d="m14 22 1-14" />
      <path d="M20 8c.5 0 .9.4.8 1l-2.6 12.2a2 2 0 0 1-2 1.8H7.8a2 2 0 0 1-2-1.8L3.2 9c-.1-.6.3-1 .8-1Z" />
    </g>

    <!-- Carrito / Cart -->
    <g v-else-if="name === 'cart'">
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </g>

    <!-- Fuego / Fire / Kitchen Preparing -->
    <g v-else-if="name === 'fire'">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </g>

    <!-- Check / Ready / Delivered -->
    <g v-else-if="name === 'check'">
      <path d="M20 6 9 17l-5-5" />
    </g>

    <!-- Check Circle -->
    <g v-else-if="name === 'check-circle'">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </g>

    <!-- Reloj / Clock -->
    <g v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </g>

    <!-- Refrescar / Refresh -->
    <g v-else-if="name === 'refresh'">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </g>

    <!-- Salir / Logout -->
    <g v-else-if="name === 'logout'">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </g>

    <!-- Usuario / User / Chef -->
    <g v-else-if="name === 'user'">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </g>

    <!-- Mesa / Pin -->
    <g v-else-if="name === 'table' || name === 'pin'">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </g>

    <!-- Nota / Note -->
    <g v-else-if="name === 'note'">
      <path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.6L13.4 2z" />
      <polyline points="13 2 13 9 20 9" />
    </g>

    <!-- Tarjeta / Card -->
    <g v-else-if="name === 'card'">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </g>

    <!-- Efectivo / Cash -->
    <g v-else-if="name === 'cash'">
      <rect width="20" height="12" x="2" y="6" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </g>

    <!-- Bre-B -->
    <g v-else-if="name === 'bre-b'">
      <circle cx="12" cy="12" r="10" />
      <path d="M9 8h4.5a2.5 2.5 0 0 1 0 5H9m0 0h5a2.5 2.5 0 0 1 0 5H9m0-10v10" />
    </g>

    <!-- Nequi -->
    <g v-else-if="name === 'nequi'">
      <rect width="18" height="18" x="3" y="3" rx="4" />
      <path d="M8 8v8l8-8v8" />
    </g>

    <!-- Bancolombia -->
    <g v-else-if="name === 'bancolombia'">
      <path d="M4 14c2-4 6-6 10-5" />
      <path d="M6 18c3-3 8-4 14-2" />
      <path d="M10 8c2-2 5-2 8-1" />
      <circle cx="18" cy="7" r="1.5" />
    </g>

    <!-- Teléfono / Phone -->
    <g v-else-if="name === 'phone'">
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </g>

    <!-- Plus -->
    <g v-else-if="name === 'plus'">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </g>

    <!-- Minus -->
    <g v-else-if="name === 'minus'">
      <path d="M5 12h14" />
    </g>

    <!-- Basura / Trash -->
    <g v-else-if="name === 'trash'">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </g>

    <!-- Flechas -->
    <g v-else-if="name === 'arrow-left'">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </g>
    <g v-else-if="name === 'chevron-right'">
      <path d="m9 18 6-6-6-6" />
    </g>

    <!-- Alerta / Warning -->
    <g v-else-if="name === 'alert'">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </g>

    <!-- Fallback / Sparkle -->
    <g v-else>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </g>
  </svg>
</template>

<style scoped>
.svg-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  transition: transform 0.15s ease, stroke 0.15s ease;
}
</style>
