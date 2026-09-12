import { defineStore } from 'pinia';
import { UserRole, AuthUser } from '@qr-menu/shared';
import {
  loginApi,
  logoutApi,
  fetchCurrentUserApi,
  ApiClientError,
} from '../services/api.js';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    isLoading: false,
    error: null,
    initialized: false,
  }),

  getters: {
    isAuthenticated: (state): boolean => state.user !== null,
    role: (state): UserRole | null => state.user?.role || null,
    isAdmin: (state): boolean => state.user?.role === UserRole.ADMIN,
    isCashier: (state): boolean => state.user?.role === UserRole.CASHIER,
  },

  actions: {
    async checkAuth(): Promise<boolean> {
      try {
        const data = await fetchCurrentUserApi();
        this.user = data.user as AuthUser;
        this.error = null;
        this.initialized = true;
        return true;
      } catch {
        this.user = null;
        this.initialized = true;
        return false;
      }
    },

    async login(username: string, password: string): Promise<void> {
      this.isLoading = true;
      this.error = null;
      try {
        const data = await loginApi({ username, password });
        this.user = data.user as AuthUser;
        this.initialized = true;
      } catch (err: unknown) {
        this.user = null;
        if (err instanceof ApiClientError) {
          this.error = err.message;
        } else {
          this.error = 'Error inesperado al iniciar sesión';
        }
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async logout(): Promise<void> {
      this.isLoading = true;
      try {
        await logoutApi();
      } catch {
        // Ignorar errores de red al cerrar sesión
      } finally {
        this.user = null;
        this.error = null;
        this.isLoading = false;
      }
    },

    clearError() {
      this.error = null;
    },
  },
});
