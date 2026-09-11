<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { sanitizeRedirectTarget } from '../utils/redirect.js';
import Icon from '../components/common/Icon.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const username = ref('');
const password = ref('');
const localError = ref<string | null>(null);

async function handleLogin() {
  localError.value = null;
  authStore.clearError();

  if (!username.value.trim() || !password.value) {
    localError.value = 'Por favor ingresa tu usuario y contraseña';
    return;
  }

  try {
    await authStore.login(username.value.trim(), password.value);
    const redirectTarget = sanitizeRedirectTarget(route.query.redirect, '/ops');
    await router.replace(redirectTarget);
  } catch {
    localError.value = authStore.error || 'Credenciales inválidas. Intenta nuevamente.';
  }
}
</script>

<template>
  <main class="login-container">
    <div class="login-card">
      <header class="login-header">
        <div class="brand-badge">
          <span>El Mora Ops</span>
        </div>
        <h1 class="login-title">Control de Caja</h1>
        <p class="login-subtitle">
          Acceso exclusivo para el personal de caja y administración.
        </p>
      </header>

      <div
        v-if="localError || authStore.error"
        class="error-banner"
        role="alert"
        aria-live="polite"
      >
        <Icon name="alert" :size="16" color="var(--accent-red)" />
        <span class="error-text">{{ localError || authStore.error }}</span>
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="username" class="form-label">Usuario</label>
          <div class="input-wrapper">
            <Icon name="user" :size="16" color="var(--text-muted)" class="input-icon" />
            <input
              id="username"
              v-model="username"
              type="text"
              class="form-input"
              autocomplete="username"
              placeholder="Usuario"
              required
              :disabled="authStore.isLoading"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="password" class="form-label">Contraseña</label>
          <div class="input-wrapper">
            <Icon name="card" :size="16" color="var(--text-muted)" class="input-icon" />
            <input
              id="password"
              v-model="password"
              type="password"
              class="form-input"
              autocomplete="current-password"
              placeholder="••••••••"
              required
              :disabled="authStore.isLoading"
            />
          </div>
        </div>

        <button
          type="submit"
          class="btn-submit"
          :disabled="authStore.isLoading"
          id="btn-login"
        >
          <span v-if="authStore.isLoading" class="spinner-inline" aria-hidden="true" />
          <span>{{ authStore.isLoading ? 'Verificando...' : 'Iniciar Sesión' }}</span>
        </button>
      </form>
    </div>
  </main>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background-color: var(--bg-primary);
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-card-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-highlight);
  border-radius: var(--radius-xl);
  padding: 36px 30px;
  box-shadow: var(--shadow-lg), 0 0 40px rgba(0, 0, 0, 0.5);
  animation: fadeIn 0.3s ease;
}

.login-header {
  text-align: center;
  margin-bottom: 28px;
}

.brand-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--accent-gold);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 5px 12px;
  border-radius: var(--radius-full);
  margin-bottom: 12px;
}

.login-title {
  font-family: var(--font-heading);
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 6px;
  letter-spacing: -0.02em;
}

.login-subtitle {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--accent-red-bg);
  border: 1px solid var(--accent-red-border);
  color: #fca5a5;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  font-size: 0.86rem;
  margin-bottom: 20px;
  animation: fadeIn 0.2s ease;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  pointer-events: none;
}

.form-input {
  width: 100%;
  padding: 12px 14px 12px 38px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.95rem;
  transition: all 0.2s;
}

.form-input:focus {
  border-color: var(--accent-gold);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
}

.btn-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  background: var(--accent-gold-gradient);
  color: #0b0e14;
  font-family: var(--font-sans);
  font-size: 0.98rem;
  font-weight: 800;
  border-radius: var(--radius-full);
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.35);
  margin-top: 6px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-submit:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.45);
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner-inline {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(11, 14, 20, 0.3);
  border-top-color: #0b0e14;
  border-radius: 50%;
  animation: spin-loader 0.6s linear infinite;
}
</style>
