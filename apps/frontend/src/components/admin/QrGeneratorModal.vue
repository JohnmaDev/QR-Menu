<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue';
import QRCodeStyling from 'qr-code-styling';
import Icon from '../common/Icon.vue';
import { AdminTable } from '@qr-menu/shared';

const props = defineProps<{
  table: AdminTable | null;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const qrContainer = ref<HTMLDivElement | null>(null);
const isCopied = ref(false);
const isGeneratingDownload = ref(false);
let qrCode: QRCodeStyling | null = null;

// ==============================================================================
// OPCIONES DE CONFIGURACIÓN DEL QR
// ==============================================================================

// Modo de Fondo: 'NONE' (Sin imagen / fondo liso) o 'IMAGE' (Con foto de fondo)
const bgMode = ref<'NONE' | 'IMAGE'>('NONE');

// Fondos lisos para modo 'NONE'
const solidBgColor = ref('#121212'); // Oscuro bar por defecto
const solidBgPresets = [
  { id: 'dark', name: 'Oscuro Bar', color: '#121212', qrColor: '#f59e0b' },
  { id: 'pure-black', name: 'Negro Profundo', color: '#05070a', qrColor: '#fbbf24' },
  { id: 'white', name: 'Blanco Nítido', color: '#ffffff', qrColor: '#0f172a' },
  { id: 'amber-dark', name: 'Dorado Dark', color: '#1a1610', qrColor: '#f59e0b' },
  { id: 'transparent', name: 'Transparente', color: 'transparent', qrColor: '#f59e0b' },
];

// Color de los módulos del QR
const selectedQrColor = ref('#f59e0b');

// Detectar si el fondo es blanco/claro para invertir contraste de textos
const isLightBg = computed(() => {
  if (bgMode.value === 'IMAGE') return false;
  return solidBgColor.value.toLowerCase() === '#ffffff';
});

// Paleta de colores para los módulos del QR adaptada al fondo
const availableQrColors = computed(() => {
  if (isLightBg.value) {
    return ['#0f172a', '#b45309', '#0369a1', '#047857', '#4338ca', '#be123c'];
  }
  return ['#f59e0b', '#fbbf24', '#ffffff', '#10b981', '#38bdf8', '#cbd5e1'];
});

// Fondo con Foto para modo 'IMAGE'
const customBgImageUrl = ref<string | null>(null);
const overlayOpacity = ref(0.65); // Oscurecimiento del 65% para garantizar 100% de escaneabilidad

// Presets de imágenes de fondo integrados en SVG (100% autónomos sin dependencias externas)
const bgPresets = [
  {
    id: 'wood',
    name: 'Madera Roble',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="w" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%232b1810"/><stop offset="50%" stop-color="%231a0e08"/><stop offset="100%" stop-color="%230e0704"/></linearGradient><radialGradient id="h" cx="50%" cy="30%" r="70%"><stop offset="0%" stop-color="%235a321d" stop-opacity="0.5"/><stop offset="100%" stop-color="%23000000" stop-opacity="0.9"/></radialGradient></defs><rect width="600" height="600" fill="url(%23w)"/><rect width="600" height="600" fill="url(%23h)"/><path d="M0 100 Q 150 120 300 100 T 600 110 M0 240 Q 200 220 400 250 T 600 230 M0 400 Q 180 430 350 390 T 600 410" stroke="%233e2114" stroke-width="2" fill="none" opacity="0.4"/></svg>`,
  },
  {
    id: 'lounge',
    name: 'Lounge Bar',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><radialGradient id="g1" cx="30%" cy="20%" r="60%"><stop offset="0%" stop-color="%23d97706" stop-opacity="0.6"/><stop offset="100%" stop-color="%230f172a" stop-opacity="0"/></radialGradient><radialGradient id="g2" cx="80%" cy="80%" r="50%"><stop offset="0%" stop-color="%230284c7" stop-opacity="0.5"/><stop offset="100%" stop-color="%23020617" stop-opacity="0"/></radialGradient></defs><rect width="600" height="600" fill="%23090d16"/><circle cx="200" cy="150" r="180" fill="url(%23g1)"/><circle cx="450" cy="450" r="160" fill="url(%23g2)"/><rect width="600" height="600" fill="rgba(0,0,0,0.4)"/></svg>`,
  },
  {
    id: 'marble',
    name: 'Mármol Noche',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="m" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2318181b"/><stop offset="50%" stop-color="%2309090b"/><stop offset="100%" stop-color="%23000000"/></linearGradient></defs><rect width="600" height="600" fill="url(%23m)"/><path d="M50 0 L 250 600 M 200 0 L 450 600 M 400 0 L 580 600" stroke="%23fbbf24" stroke-width="1.5" stroke-dasharray="8,12" opacity="0.25"/><path d="M0 200 L 600 350 M 0 450 L 600 520" stroke="%2338bdf8" stroke-width="1" stroke-dasharray="6,16" opacity="0.2"/></svg>`,
  },
  {
    id: 'neon',
    name: 'Neón Amber',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><radialGradient id="rad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%23f59e0b" stop-opacity="0.45"/><stop offset="70%" stop-color="%23b45309" stop-opacity="0.15"/><stop offset="100%" stop-color="%23030712" stop-opacity="0"/></radialGradient></defs><rect width="600" height="600" fill="%23030712"/><rect width="600" height="600" fill="url(%23rad)"/></svg>`,
  },
];

const selectedBgPreset = ref(bgPresets[0].url);

// Logo Central por defecto: Jarra de cerveza espumosa dorada con escudo de protección
const logoMode = ref<'DEFAULT' | 'CUSTOM' | 'NONE'>('DEFAULT');
const defaultLogoSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64"><defs><linearGradient id="beerGold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23fbbf24"/><stop offset="100%" stop-color="%23d97706"/></linearGradient></defs><circle cx="32" cy="32" r="30" fill="%230f172a" stroke="%23f59e0b" stroke-width="2.5"/><g fill="none" stroke="url(%23beerGold)" stroke-linecap="round" stroke-linejoin="round"><path d="M44 26h3a5 5 0 0 1 0 10h-3" stroke-width="3.2"/><path d="M19 22v22a4 4 0 0 0 4 4h17a4 4 0 0 0 4-4V22" stroke-width="3.2"/><path d="M27 28v14" stroke-width="2.5" opacity="0.8"/><path d="M36 28v14" stroke-width="2.5" opacity="0.8"/><path d="M41 21c-1.5 0-2.2.8-4.5.8s-3-.8-4.5-.8-2.6.8-3.8.8a3.8 3.8 0 0 1 0-7.5c1.2 0 2.4.8 3.8.8s2.2-.8 4.5-.8 3 .8 4.5.8 2.6-.8 3.8-.8a3.8 3.8 0 0 1 0 7.5c-1.2 0-2.3-.8-3.8-.8Z" fill="%23fbbf24" stroke="%23fbbf24" stroke-width="1.5"/></g></svg>`;
const customLogoUrl = ref<string | null>(null);

// Nombre formateado de la mesa sin duplicar número (evita '#3 Mesa 3')
const tableDisplayName = computed(() => {
  if (!props.table) return '';
  const name = props.table.name.trim();
  const numStr = String(props.table.number);
  // Si el nombre ya contiene el número (por ejemplo 'Mesa 3', 'Mesa #3', 'Terraza 3')
  if (name.includes(numStr)) {
    return name;
  }
  return `Mesa ${props.table.number} - ${name}`;
});

function getTableUrl(): string {
  if (!props.table) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/m/${props.table.publicToken}`;
}

function getActiveBgImageUrl(): string | null {
  if (bgMode.value !== 'IMAGE') return null;
  return customBgImageUrl.value || selectedBgPreset.value;
}

function getActiveLogoImage(): string | undefined {
  if (logoMode.value === 'NONE') return undefined;
  if (logoMode.value === 'CUSTOM') return customLogoUrl.value || undefined;
  return defaultLogoSvg;
}

// ==============================================================================
// RENDERIZADO DEL QR CON qr-code-styling
// ==============================================================================

function updateQr() {
  if (!props.table) return;
  const url = getTableUrl();

  const isImageMode = bgMode.value === 'IMAGE';
  const qrBgColor = isImageMode
    ? 'rgba(10, 14, 23, 0.45)'
    : solidBgColor.value;

  const currentLogo = getActiveLogoImage();

  const options = {
    width: 250,
    height: 250,
    type: 'canvas' as const,
    data: url,
    image: currentLogo,
    dotsOptions: {
      color: selectedQrColor.value,
      type: 'rounded' as const,
    },
    backgroundOptions: {
      color: qrBgColor,
      round: 0.08,
    },
    cornersSquareOptions: {
      color: selectedQrColor.value,
      type: 'extra-rounded' as const,
    },
    cornersDotOptions: {
      color: selectedQrColor.value,
      type: 'dot' as const,
    },
    imageOptions: {
      crossOrigin: 'anonymous',
      margin: 4,
      imageSize: 0.34,
      hideBackgroundDots: true,
    },
    qrOptions: {
      errorCorrectionLevel: 'H' as const, // Máxima redundancia 30%
    },
  };

  if (!qrCode) {
    qrCode = new QRCodeStyling(options);
    nextTick(() => {
      if (qrContainer.value) {
        qrContainer.value.innerHTML = '';
        qrCode?.append(qrContainer.value);
      }
    });
  } else {
    qrCode.update(options);
  }
}

// ==============================================================================
// HANDLERS DE CARGA DE ARCHIVOS
// ==============================================================================

function handleBgImageUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      customBgImageUrl.value = event.target?.result as string;
      bgMode.value = 'IMAGE';
      updateQr();
    };
    reader.readAsDataURL(file);
  }
}

function handleLogoUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      customLogoUrl.value = event.target?.result as string;
      logoMode.value = 'CUSTOM';
      updateQr();
    };
    reader.readAsDataURL(file);
  }
}

function selectSolidBg(preset: (typeof solidBgPresets)[0]) {
  solidBgColor.value = preset.color;
  selectedQrColor.value = preset.qrColor;
  updateQr();
}

function selectBgPreset(url: string) {
  selectedBgPreset.value = url;
  customBgImageUrl.value = null;
  updateQr();
}

async function copyUrl() {
  const url = getTableUrl();
  try {
    await navigator.clipboard.writeText(url);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch {
    // Fallback
  }
}

// ==============================================================================
// DESCARGA COMPUESTA EN ALTA RESOLUCIÓN (CANVAS)
// ==============================================================================

async function downloadCompositePng() {
  if (!props.table || !qrCode) return;
  isGeneratingDownload.value = true;

  try {
    const rawQrBlob = await qrCode.getRawData('png');
    if (!rawQrBlob) {
      qrCode.download({
        name: `QR_Mesa_${props.table.number}`,
        extension: 'png',
      });
      return;
    }

    const qrImageObj = new Image();
    const qrImagePromise = new Promise((resolve) => {
      qrImageObj.onload = resolve;
    });
    qrImageObj.src = URL.createObjectURL(rawQrBlob as Blob);
    await qrImagePromise;

    // Si está en modo "Sin Imagen" y fondo simple:
    if (bgMode.value === 'NONE') {
      const canvas = document.createElement('canvas');
      const size = 1000;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (solidBgColor.value !== 'transparent') {
          ctx.fillStyle = solidBgColor.value;
          ctx.fillRect(0, 0, size, size);
        }
        ctx.drawImage(qrImageObj, 100, 100, 800, 800);
      }
      triggerCanvasDownload(canvas, `QR_Mesa_${props.table.number}_limpio.png`);
      return;
    }

    // Si está en modo "Con Foto de Fondo": Renderizar tarjeta de mesa de alta resolución (1200 x 1500)
    const width = 1200;
    const height = 1500;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 2. Cargar imagen de fondo
    const bgUrl = getActiveBgImageUrl();
    if (bgUrl) {
      const bgImg = new Image();
      const bgPromise = new Promise((resolve) => {
        bgImg.onload = resolve;
      });
      bgImg.src = bgUrl;
      await bgPromise;

      const scale = Math.max(width / bgImg.width, height / bgImg.height);
      const x = width / 2 - (bgImg.width / 2) * scale;
      const y = height / 2 - (bgImg.height / 2) * scale;
      ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);
    } else {
      ctx.fillStyle = '#0a0e17';
      ctx.fillRect(0, 0, width, height);
    }

    // 3. Dibujar filtro de oscurecimiento (overlay)
    ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity.value})`;
    ctx.fillRect(0, 0, width, height);

    // 4. Dibujar borde decorativo dorado sutil
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 40, width - 80, height - 80);

    // 5. Cabecera: Marca y Mesa
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText('LICORES DISTRITO 4', width / 2, 140);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 68px sans-serif';
    ctx.fillText(tableDisplayName.value.toUpperCase(), width / 2, 230);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '500 32px sans-serif';
    ctx.fillText('Menú Digital Autónomo • Ordena Directo', width / 2, 285);

    // 6. Contenedor tarjeta oscura para el QR (para legibilidad óptima)
    const cardSize = 820;
    const cardX = (width - cardSize) / 2;
    const cardY = 340;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardSize, cardSize, 36);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 7. Dibujar código QR en el centro de la tarjeta
    const qrSize = 720;
    const qrX = (width - qrSize) / 2;
    const qrY = cardY + 50;
    ctx.drawImage(qrImageObj, qrX, qrY, qrSize, qrSize);

    // 8. Pie de página con instrucción
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Apunta la cámara de tu celular para ordenar', width / 2, 1260);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 28px sans-serif';
    ctx.fillText('Sin descargar aplicaciones • Rápido y seguro', width / 2, 1315);

    triggerCanvasDownload(canvas, `Tarjeta_Mesa_${props.table.number}_${props.table.name.replace(/\s+/g, '_')}.png`);
  } catch (err) {
    console.error('Error al generar la imagen compuesta:', err);
    qrCode.download({
      name: `QR_Mesa_${props.table.number}`,
      extension: 'png',
    });
  } finally {
    isGeneratingDownload.value = false;
  }
}

function triggerCanvasDownload(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function downloadSvg() {
  if (!qrCode || !props.table) return;
  qrCode.download({
    name: `QR_Mesa_${props.table.number}_vectorial`,
    extension: 'svg',
  });
}

// Observadores para actualización en tiempo real
watch(isLightBg, (light) => {
  if (light && selectedQrColor.value === '#ffffff') {
    selectedQrColor.value = '#0f172a';
  }
});

watch(
  [
    () => props.table,
    bgMode,
    solidBgColor,
    selectedQrColor,
    selectedBgPreset,
    customBgImageUrl,
    overlayOpacity,
    logoMode,
    customLogoUrl,
  ],
  () => {
    updateQr();
  }
);

onMounted(() => {
  updateQr();
});
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="qr-modal-card" role="dialog" aria-modal="true">
      <!-- Encabezado del modal -->
      <header class="modal-header">
        <div class="modal-title-group">
          <div class="qr-icon-badge">
            <Icon name="table" :size="20" color="var(--accent-gold)" />
          </div>
          <div>
            <h2 class="modal-title">Generador de Código QR</h2>
            <p class="modal-subtitle">
              {{ tableDisplayName }}
            </p>
          </div>
        </div>
        <button type="button" class="btn-close" title="Cerrar" @click="$emit('close')">×</button>
      </header>

      <main class="modal-body">
        <!-- Previsualizador Dinámico de la Tarjeta/QR -->
        <div class="qr-preview-container">
          <div
            class="qr-live-stand"
            :class="{
              'with-photo': bgMode === 'IMAGE',
              'light-theme-stand': isLightBg,
            }"
            :style="{
              backgroundImage: bgMode === 'IMAGE' ? `url(${getActiveBgImageUrl()})` : 'none',
              backgroundColor: bgMode === 'NONE' ? solidBgColor : 'transparent',
            }"
          >
            <!-- Overlay de contraste para modo con foto -->
            <div
              v-if="bgMode === 'IMAGE'"
              class="stand-photo-overlay"
              :style="{ opacity: overlayOpacity }"
            />

            <!-- Contenido de la tarjeta en vivo -->
            <div class="stand-content">
              <div class="stand-header">
                <span class="stand-brand">Licores Distrito 4</span>
                <span class="stand-table-tag">{{ tableDisplayName }}</span>
              </div>

              <div ref="qrContainer" class="qr-canvas-holder" />

              <div class="stand-footer">
                <span class="live-pulse" />
                <span>Escanea para ver la carta y pedir</span>
              </div>
            </div>
          </div>
        </div>

        <!-- URL directa con botón de copiar -->
        <div class="url-bar-section">
          <span class="url-tag">Enlace:</span>
          <input type="text" readonly :value="getTableUrl()" class="url-input" />
          <button type="button" class="btn-copy-url" @click="copyUrl">
            <Icon :name="isCopied ? 'check' : 'copy'" :size="14" />
            <span>{{ isCopied ? '¡Copiado!' : 'Copiar' }}</span>
          </button>
        </div>

        <!-- Selector Principal: ¿Con Foto de Fondo o Sin Imagen? -->
        <div class="config-panel">
          <div class="config-tabs-row">
            <span class="config-label">Fondo del QR:</span>
            <div class="mode-toggle-group">
              <button
                type="button"
                class="mode-btn"
                :class="{ active: bgMode === 'NONE' }"
                @click="bgMode = 'NONE'"
              >
                <Icon name="check" :size="13" v-if="bgMode === 'NONE'" />
                <span>Sin Imagen (Limpio)</span>
              </button>
              <button
                type="button"
                class="mode-btn"
                :class="{ active: bgMode === 'IMAGE' }"
                @click="bgMode = 'IMAGE'"
              >
                <Icon name="plus" :size="13" v-if="bgMode === 'IMAGE'" />
                <span>Con Foto de Fondo</span>
              </button>
            </div>
          </div>

          <!-- Opciones Modo: SIN IMAGEN (Limpio / Colores) -->
          <div v-if="bgMode === 'NONE'" class="options-subgroup">
            <div class="option-row">
              <span class="sub-label">Color de Fondo Sólido:</span>
              <div class="presets-row">
                <button
                  v-for="p in solidBgPresets"
                  :key="p.id"
                  type="button"
                  class="solid-color-btn"
                  :class="{ active: solidBgColor === p.color }"
                  :title="p.name"
                  :style="{
                    backgroundColor: p.color === 'transparent' ? '#1e293b' : p.color,
                    border: p.color === '#ffffff' ? '1px solid #94a3b8' : '1px solid rgba(255,255,255,0.15)'
                  }"
                  @click="selectSolidBg(p)"
                >
                  <span v-if="p.color === 'transparent'" class="trans-label">Transp</span>
                </button>
              </div>
            </div>

            <div class="option-row">
              <span class="sub-label">Color del QR:</span>
              <div class="presets-row">
                <button
                  v-for="color in availableQrColors"
                  :key="color"
                  type="button"
                  class="color-dot-btn"
                  :class="{ active: selectedQrColor === color }"
                  :style="{ backgroundColor: color }"
                  @click="selectedQrColor = color; updateQr()"
                />
              </div>
            </div>
          </div>

          <!-- Opciones Modo: CON FOTO DE FONDO -->
          <div v-else class="options-subgroup">
            <div class="option-row">
              <span class="sub-label">Elige o sube una foto:</span>
              <div class="presets-row bg-presets-grid">
                <button
                  v-for="preset in bgPresets"
                  :key="preset.id"
                  type="button"
                  class="bg-preset-btn"
                  :class="{ active: selectedBgPreset === preset.url && !customBgImageUrl }"
                  :style="{ backgroundImage: `url(${preset.url})` }"
                  :title="preset.name"
                  @click="selectBgPreset(preset.url)"
                >
                  <span class="bg-preset-name">{{ preset.name }}</span>
                </button>

                <!-- Botón Subir Foto Propia -->
                <label class="bg-upload-btn" :class="{ active: !!customBgImageUrl }">
                  <Icon name="plus" :size="14" />
                  <span>{{ customBgImageUrl ? 'Foto cargada' : 'Subir Foto' }}</span>
                  <input
                    type="file"
                    accept="image/*"
                    class="file-input-hidden"
                    @change="handleBgImageUpload"
                  />
                </label>
              </div>
            </div>

            <!-- Slider de oscurecimiento de fondo -->
            <div class="option-row slider-row">
              <div class="slider-header">
                <span class="sub-label">Oscurecimiento / Contraste de Foto:</span>
                <span class="slider-val">{{ Math.round(overlayOpacity * 100) }}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="0.9"
                step="0.05"
                v-model.number="overlayOpacity"
                class="range-slider"
              />
              <span class="hint-text">Aumenta el oscurecimiento para asegurar que la cámara escanee el QR al instante.</span>
            </div>
          </div>

          <!-- Personalización del Logo Central -->
          <div class="logo-config-row">
            <span class="sub-label">Logo Central:</span>
            <div class="logo-toggle-pills">
              <button
                type="button"
                class="pill-btn"
                :class="{ active: logoMode === 'NONE' }"
                @click="logoMode = 'NONE'"
              >
                Sin logo
              </button>
              <button
                type="button"
                class="pill-btn"
                :class="{ active: logoMode === 'DEFAULT' }"
                @click="logoMode = 'DEFAULT'"
              >
                Cerveza 🍺
              </button>
              <label
                class="pill-btn upload-pill"
                :class="{ active: logoMode === 'CUSTOM' }"
              >
                <span>{{ customLogoUrl ? 'Logo subido' : 'Subir logo' }}</span>
                <input
                  type="file"
                  accept="image/*"
                  class="file-input-hidden"
                  @change="handleLogoUpload"
                />
              </label>
            </div>
          </div>
        </div>
      </main>

      <!-- Botones de Acción / Descarga -->
      <footer class="modal-footer">
        <button
          type="button"
          class="btn-action btn-primary"
          :disabled="isGeneratingDownload"
          @click="downloadCompositePng"
        >
          <Icon name="check" :size="16" />
          <span>{{ isGeneratingDownload ? 'Generando PNG...' : (bgMode === 'IMAGE' ? 'Descargar Tarjeta con Foto (PNG)' : 'Descargar QR en Alta Calidad (PNG)') }}</span>
        </button>

        <button
          type="button"
          class="btn-action btn-secondary"
          title="Descargar versión vectorial"
          @click="downloadSvg"
        >
          <span>Descargar Vectorial (SVG)</span>
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  animation: fadeIn 0.2s ease-out;
}

.qr-modal-card {
  background: #111827;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  width: 100%;
  max-width: 520px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: #0f172a;
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.qr-icon-badge {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.modal-subtitle {
  font-size: 0.8rem;
  color: var(--accent-gold);
  margin: 0;
  font-weight: 600;
}

.btn-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.6rem;
  cursor: pointer;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;
}

.btn-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.modal-body {
  padding: 16px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Previsualizador de Tarjeta de Mesa */
.qr-preview-container {
  display: flex;
  justify-content: center;
  background: #090d16;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.qr-live-stand {
  position: relative;
  border-radius: 16px;
  background-size: cover;
  background-position: center;
  width: 290px;
  padding: 16px 14px;
  border: 1px solid rgba(245, 158, 11, 0.35);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  transition: all 0.25s ease;
}

.stand-photo-overlay {
  position: absolute;
  inset: 0;
  background-color: #000;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.stand-content {
  position: relative;
  z-index: 2;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stand-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-bottom: 10px;
}

.stand-brand {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 800;
  color: var(--accent-gold);
}

.stand-table-tag {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
}

.qr-canvas-holder {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 12px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stand-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
}

/* Soporte temático claro cuando el fondo es blanco */
.light-theme-stand {
  border-color: rgba(0, 0, 0, 0.18) !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15) !important;
}

.light-theme-stand .stand-brand {
  color: #b45309 !important;
}

.light-theme-stand .stand-table-tag {
  color: #0f172a !important;
}

.light-theme-stand .qr-canvas-holder {
  background: rgba(255, 255, 255, 0.95) !important;
  border: 1px solid rgba(0, 0, 0, 0.1) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.light-theme-stand .stand-footer {
  color: #0f172a !important; /* Texto negro nítido y 100% visible sobre blanco */
  font-weight: 700 !important;
}

.light-theme-stand .live-pulse {
  background-color: #059669 !important;
  box-shadow: 0 0 8px rgba(5, 150, 105, 0.6) !important;
}

.live-pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 8px #10b981;
}

/* Barra de URL */
.url-bar-section {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0f172a;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.url-tag {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}

.url-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #e2e8f0;
  font-size: 0.78rem;
  font-family: monospace;
  outline: none;
  text-overflow: ellipsis;
}

.btn-copy-url {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--accent-gold);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-copy-url:hover {
  background: var(--accent-gold);
  color: #000;
}

/* Panel de Configuración */
.config-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: #141c2e;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.config-tabs-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.config-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: #fff;
}

.mode-toggle-group {
  display: flex;
  background: #090d16;
  padding: 3px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  gap: 4px;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 600;
  background: transparent;
  color: #94a3b8;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-btn.active {
  background: var(--accent-gold);
  color: #000;
  font-weight: 700;
}

.options-subgroup {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.option-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sub-label {
  font-size: 0.75rem;
  color: #cbd5e1;
  font-weight: 600;
}

.presets-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.solid-color-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s;
}

.solid-color-btn.active {
  transform: scale(1.15);
  box-shadow: 0 0 0 2px var(--accent-gold);
}

.trans-label {
  font-size: 0.55rem;
  color: #94a3b8;
  font-weight: 700;
}

.color-dot-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s;
}

.color-dot-btn.active {
  transform: scale(1.2);
  border-color: #fff;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
}

/* Presets con Foto */
.bg-presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
  width: 100%;
}

.bg-preset-btn {
  height: 52px;
  border-radius: 8px;
  border: 2px solid transparent;
  background-size: cover;
  background-position: center;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  padding: 4px;
  transition: all 0.15s;
}

.bg-preset-btn.active {
  border-color: var(--accent-gold);
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
}

.bg-preset-name {
  font-size: 0.65rem;
  font-weight: 700;
  color: #fff;
  background: rgba(0, 0, 0, 0.65);
  padding: 1px 4px;
  border-radius: 4px;
  width: 100%;
  text-align: center;
}

.bg-upload-btn {
  height: 52px;
  border-radius: 8px;
  border: 1px dashed rgba(245, 158, 11, 0.5);
  background: rgba(245, 158, 11, 0.05);
  color: var(--accent-gold);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.bg-upload-btn.active {
  background: rgba(245, 158, 11, 0.2);
  border-style: solid;
  color: #fff;
}

.file-input-hidden {
  display: none;
}

/* Slider de Oscurecimiento */
.slider-row {
  background: rgba(0, 0, 0, 0.2);
  padding: 10px;
  border-radius: 8px;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.slider-val {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent-gold);
}

.range-slider {
  width: 100%;
  accent-color: var(--accent-gold);
  cursor: pointer;
  margin-top: 4px;
}

.hint-text {
  font-size: 0.68rem;
  color: var(--text-muted);
  line-height: 1.2;
}

/* Configuración de Logo */
.logo-config-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-wrap: wrap;
  gap: 8px;
}

.logo-toggle-pills {
  display: flex;
  gap: 6px;
}

.pill-btn {
  background: #090d16;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.pill-btn.active {
  background: rgba(245, 158, 11, 0.2);
  border-color: var(--accent-gold);
  color: var(--accent-gold);
}

.upload-pill {
  display: inline-flex;
  align-items: center;
}

/* Footer y Botones de Descarga */
.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #0f172a;
  display: flex;
  gap: 10px;
}

.btn-action {
  flex: 1;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.15s;
}

.btn-primary {
  background: var(--accent-gold-gradient);
  color: #000;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
</style>
