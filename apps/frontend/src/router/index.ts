import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/m/:tableToken',
    name: 'MenuView',
    component: () => import('../views/MenuView.vue'),
  },
  {
    path: '/m/:tableToken/cart',
    name: 'CartView',
    component: () => import('../views/CartView.vue'),
  },
  {
    path: '/m/:tableToken/confirmation/:orderCode',
    name: 'OrderConfirmationView',
    component: () => import('../views/OrderConfirmationView.vue'),
  },
  {
    path: '/login',
    name: 'LoginView',
    component: () => import('../views/LoginView.vue'),
  },
  {
    path: '/ops',
    name: 'OpsDashboardView',
    component: () => import('../views/OpsDashboardView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
    return { top: 0 };
  },
});

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();

  // 1. Ruta protegida que requiere autenticación (ej. /ops)
  if (to.meta.requiresAuth) {
    if (!authStore.initialized) {
      await authStore.checkAuth();
    }
    if (!authStore.isAuthenticated) {
      return next({
        path: '/login',
        query: { redirect: to.fullPath },
      });
    }
  }

  // 2. Si el usuario va a /login, chequear si ya tiene sesión activa para redirigir a /ops
  if (to.path === '/login') {
    if (!authStore.initialized) {
      await authStore.checkAuth();
    }
    if (authStore.isAuthenticated) {
      return next({ path: '/ops' });
    }
  }

  // 3. Rutas públicas (ej. /m/:tableToken, /m/:tableToken/cart, /) navegan de forma inmediata sin esperas
  next();
});

