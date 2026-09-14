<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  method: string;
  width?: number | string;
  height?: number | string;
}

const props = withDefaults(defineProps<Props>(), {
  width: 58,
  height: 28,
});

const normalizedMethod = computed(() => {
  const m = (props.method || '').toUpperCase();
  if (m.includes('BRE') || m.includes('BRE_B') || m.includes('BRE-B')) return 'BRE_B';
  if (m.includes('NEQUI')) return 'NEQUI';
  if (m.includes('BANCOLOMBIA') || m.includes('BANCO')) return 'BANCOLOMBIA';
  if (m.includes('CASH') || m.includes('EFECTIVO')) return 'CASH';
  return 'CASH';
});

const numericWidth = computed(() => {
  return typeof props.width === 'number' ? props.width : parseInt(String(props.width), 10) || 58;
});

const numericHeight = computed(() => {
  return typeof props.height === 'number' ? props.height : parseInt(String(props.height), 10) || 28;
});
</script>

<template>
  <div
    class="payment-brand-logo"
    :class="`brand-${normalizedMethod.toLowerCase()}`"
    :style="{ width: `${numericWidth}px`, height: `${numericHeight}px` }"
    :aria-label="normalizedMethod"
    role="img"
  >
    <!-- ======================================================================= -->
    <!-- 1. BRE-B (Manual MIV Banco de la República)                            -->
    <!-- Degradado horizontal Azul (#00BAFF) -> Verde Eléctrico (#00FF87)        -->
    <!-- Fondo sólido oscuro (#0A0214) según especificación técnica              -->
    <!-- ======================================================================= -->
    <svg
      v-if="normalizedMethod === 'BRE_B'"
      viewBox="0 0 72 36"
      class="brand-svg svg-bre-b"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <!-- Gradiente oficial MIV: azul a verde eléctrico -->
        <linearGradient id="breBGradient" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stop-color="#00BAFF" />
          <stop offset="50%" stop-color="#00DF9E" />
          <stop offset="100%" stop-color="#00FF82" />
        </linearGradient>
      </defs>

      <!-- Fondo oscuro de contraste reglamentario MIV -->
      <rect width="72" height="36" rx="7" fill="#0A0214" />
      <rect width="72" height="36" rx="7" stroke="rgba(0, 186, 255, 0.3)" stroke-width="1" />

      <!-- Composición Tipográfica Oficial Bre-B con B's en flecha dinámica -->
      <g fill="url(#breBGradient)">
        <!-- Letra B inicial (con notch de flecha hacia la derecha en lomo izquierdo) -->
        <path
          d="M 12 9 
             L 19.2 9 
             C 22 9 23.8 10.3 23.8 12.5 
             C 23.8 14 22.8 15.1 21.3 15.6 
             C 23.2 16.1 24.4 17.4 24.4 19.3 
             C 24.4 22 22.2 23.5 19 23.5 
             L 12 23.5 
             L 14.2 16.2 
             Z
             M 16.5 11.5 
             L 14.8 15 
             L 18.8 15 
             C 19.8 15 20.6 14.4 20.6 13.2 
             C 20.6 12.1 19.8 11.5 18.5 11.5 
             Z
             M 14.3 17.5 
             L 12.8 21 
             L 18.8 21 
             C 20.1 21 21.1 20.2 21.1 19.1 
             C 21.1 18 20 17.5 18.6 17.5 
             Z"
        />

        <!-- Letra 'r' -->
        <path
          d="M 26.5 13.8 
             L 29.3 13.8 
             L 29.3 15.5 
             C 30.1 14.3 31.4 13.6 32.8 13.6 
             C 33.6 13.6 34.2 13.8 34.6 14.1 
             L 33.6 16.8 
             C 33.1 16.5 32.5 16.4 31.8 16.4 
             C 30.5 16.4 29.5 17.4 29.5 19.2 
             L 29.5 23.5 
             L 26.5 23.5 
             Z"
        />

        <!-- Letra 'e' -->
        <path
          d="M 40.8 13.5 
             C 44.2 13.5 46.5 15.8 46.5 18.8 
             C 46.5 19.2 46.4 19.6 46.4 19.9 
             L 37.8 19.9 
             C 38 21.3 39.2 22.2 40.8 22.2 
             C 41.9 22.2 42.9 21.7 43.5 20.9 
             L 45.6 22.3 
             C 44.5 23.8 42.8 24.6 40.7 24.6 
             C 36.8 24.6 34.8 22 34.8 18.9 
             C 34.8 15.6 37.1 13.5 40.8 13.5 
             Z
             M 43.6 18 
             C 43.5 16.8 42.4 15.7 40.8 15.7 
             C 39.2 15.7 38.1 16.8 37.8 18 
             Z"
        />

        <!-- Guion '-' -->
        <rect x="48.5" y="17.5" width="4.5" height="2.8" rx="1.2" />

        <!-- Letra 'B' final (dinámica y en flecha) -->
        <path
          d="M 55 9 
             L 62.2 9 
             C 65 9 66.8 10.3 66.8 12.5 
             C 66.8 14 65.8 15.1 64.3 15.6 
             C 66.2 16.1 67.4 17.4 67.4 19.3 
             C 67.4 22 65.2 23.5 62 23.5 
             L 55 23.5 
             L 57.2 16.2 
             Z
             M 59.5 11.5 
             L 57.8 15 
             L 61.8 15 
             C 62.8 15 63.6 14.4 63.6 13.2 
             C 63.6 12.1 62.8 11.5 61.5 11.5 
             Z
             M 57.3 17.5 
             L 55.8 21 
             L 61.8 21 
             C 63.1 21 64.1 20.2 64.1 19.1 
             C 64.1 18 63 17.5 61.6 17.5 
             Z"
        />
      </g>
    </svg>

    <!-- ======================================================================= -->
    <!-- 2. NEQUI (Identidad Oficial)                                            -->
    <!-- Punto cuadrado Magenta (#DA0081) + Wordmark Nequi en Blanco Puro        -->
    <!-- Fondo ciruela profundo (#1E0329)                                        -->
    <!-- ======================================================================= -->
    <svg
      v-else-if="normalizedMethod === 'NEQUI'"
      viewBox="0 0 72 36"
      class="brand-svg svg-nequi"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Fondo ciruela oficial -->
      <rect width="72" height="36" rx="7" fill="#1E0329" />
      <rect width="72" height="36" rx="7" stroke="rgba(218, 0, 129, 0.3)" stroke-width="1" />

      <!-- El icónico punto cuadrado superior fucsia / magenta de Nequi -->
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" fill="#DA0081" />

      <!-- Wordmark Nequi vectorizado -->
      <g fill="#FFFFFF">
        <!-- N -->
        <path
          d="M 16 10.5 
             L 19.8 10.5 
             L 26 19.5 
             L 26 10.5 
             L 29.5 10.5 
             L 29.5 24.5 
             L 25.7 24.5 
             L 19.5 15.5 
             L 19.5 24.5 
             L 16 24.5 
             Z"
        />

        <!-- e -->
        <path
          d="M 35.8 14.5 
             C 38.8 14.5 40.8 16.5 40.8 19.3 
             C 40.8 19.7 40.7 20 40.7 20.3 
             L 33.2 20.3 
             C 33.4 21.6 34.4 22.5 35.8 22.5 
             C 36.8 22.5 37.6 22 38.1 21.3 
             L 40.2 22.3 
             C 39.2 23.7 37.7 24.5 35.8 24.5 
             C 32.3 24.5 30.5 22.2 30.5 19.5 
             C 30.5 16.6 32.5 14.5 35.8 14.5 
             Z
             M 38.2 18.3 
             C 38.1 17.2 37.2 16.3 35.8 16.3 
             C 34.4 16.3 33.5 17.2 33.2 18.3 
             Z"
        />

        <!-- q -->
        <path
          d="M 47 14.8 
             L 47 16.3 
             C 46.4 15.3 45.2 14.5 43.8 14.5 
             C 41.4 14.5 39.5 16.6 39.5 19.6 
             C 39.5 22.6 41.4 24.6 43.8 24.6 
             C 45.2 24.6 46.4 23.8 47 22.8 
             L 47 28.5 
             L 49.8 28.5 
             L 49.8 14.8 
             Z
             M 44.7 22.2 
             C 43.3 22.2 42.3 21.1 42.3 19.5 
             C 42.3 18 43.3 16.9 44.7 16.9 
             C 46.1 16.9 47.1 18 47.1 19.5 
             C 47.1 21.1 46.1 22.2 44.7 22.2 
             Z"
        />

        <!-- u -->
        <path
          d="M 52.5 14.8 
             L 55.3 14.8 
             L 55.3 20.3 
             C 55.3 21.7 56.1 22.4 57.3 22.4 
             C 58.5 22.4 59.3 21.7 59.3 20.3 
             L 59.3 14.8 
             L 62.1 14.8 
             L 62.1 24.5 
             L 59.3 24.5 
             L 59.3 23 
             C 58.7 24 57.6 24.6 56.3 24.6 
             C 53.9 24.6 52.5 23.1 52.5 20.5 
             Z"
        />

        <!-- i (el punto de la i es el cuadrado que antecede el nombre) -->
        <rect x="64" y="14.8" width="2.8" height="9.7" rx="1.2" />
      </g>
    </svg>

    <!-- ======================================================================= -->
    <!-- 3. BANCOLOMBIA (Símbolo Oficial 3 Cintas Dinámicas + Tipografía)         -->
    <!-- Las 3 franjas curvas aerodinámicas de la identidad Bancolombia          -->
    <!-- Fondo grafito oscuro (#111622)                                          -->
    <!-- ======================================================================= -->
    <svg
      v-else-if="normalizedMethod === 'BANCOLOMBIA'"
      viewBox="0 0 72 36"
      class="brand-svg svg-bancolombia"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Fondo oscuro -->
      <rect width="72" height="36" rx="7" fill="#111622" />
      <rect width="72" height="36" rx="7" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1" />

      <!-- Símbolo de las 3 Cintas Curvas Superpuestas de Bancolombia -->
      <!-- Cinta superior -->
      <path
        d="M 44 8.5 
           C 50.5 7.5 59.5 9 64.5 11.8 
           L 62 14.5 
           C 57.5 12.6 50 11.2 44.5 12.3 
           Z"
        fill="#FDDA24"
      />
      <!-- Cinta central -->
      <path
        d="M 40 14 
           C 47.5 12.6 58.5 14.2 65.5 18.2 
           L 62.8 21 
           C 56.5 17.5 47 16 40.5 17.6 
           Z"
        fill="#FFFFFF"
      />
      <!-- Cinta inferior -->
      <path
        d="M 46.5 21.5 
           C 53 20.2 59.5 21.6 64.5 24.6 
           L 62 27 
           C 58 24.8 52.5 23.5 47 24.8 
           Z"
        fill="#002F6C"
      />

      <!-- Wordmark Bancolombia estilizado -->
      <text
        x="6"
        y="22.5"
        fill="#FFFFFF"
        font-family="system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif"
        font-size="8.8"
        font-weight="800"
        letter-spacing="-0.3px"
      >
        Bancolombia
      </text>
    </svg>

    <!-- ======================================================================= -->
    <!-- 4. EFECTIVO (Cash)                                                      -->
    <!-- Billete elegante con monedas y brillo dorado Gastropub                  -->
    <!-- ======================================================================= -->
    <svg
      v-else
      viewBox="0 0 72 36"
      class="brand-svg svg-cash"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="cashGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#F59E0B" />
          <stop offset="100%" stop-color="#D97706" />
        </linearGradient>
      </defs>

      <!-- Fondo cálido -->
      <rect width="72" height="36" rx="7" fill="#1C180E" />
      <rect width="72" height="36" rx="7" stroke="rgba(245, 158, 11, 0.3)" stroke-width="1" />

      <!-- Billete central -->
      <rect x="11" y="9.5" width="34" height="17" rx="3" stroke="url(#cashGoldGrad)" stroke-width="1.6" />
      <circle cx="28" cy="18" r="4.5" stroke="url(#cashGoldGrad)" stroke-width="1.4" />
      <path d="M 15 18 L 17.5 18 M 38.5 18 L 41 18" stroke="url(#cashGoldGrad)" stroke-width="1.5" stroke-linecap="round" />

      <!-- Monedas superpuestas a la derecha -->
      <circle cx="53" cy="20.5" r="6" fill="#1C180E" stroke="url(#cashGoldGrad)" stroke-width="1.5" />
      <text x="50.8" y="23.5" fill="#F59E0B" font-size="8" font-weight="900">$</text>

      <circle cx="48" cy="13.5" r="5" fill="#1C180E" stroke="url(#cashGoldGrad)" stroke-width="1.3" />
      <text x="46.2" y="16" fill="#F59E0B" font-size="6.5" font-weight="900">$</text>
    </svg>
  </div>
</template>

<style scoped>
.payment-brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease;
}

.brand-svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* Efectos sutiles al pasar el mouse */
.brand-bre_b:hover .brand-svg {
  filter: drop-shadow(0 0 6px rgba(0, 255, 130, 0.35));
}

.brand-nequi:hover .brand-svg {
  filter: drop-shadow(0 0 6px rgba(218, 0, 129, 0.35));
}

.brand-bancolombia:hover .brand-svg {
  filter: drop-shadow(0 0 6px rgba(253, 218, 36, 0.3));
}

.brand-cash:hover .brand-svg {
  filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.3));
}
</style>
