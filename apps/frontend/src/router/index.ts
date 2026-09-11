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

  // Si no se ha comprobado la sesión en el store aún, verificarla con el backend
  if (!authStore.initialized) {
    await authStore.checkAuth();
  }

  // 1. Ruta protegida que requiere autenticación
  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      return next({
        path: '/login',
        query: { redirect: to.fullPath },
      });
    }
  }

  // 2. Si el usuario ya está autenticado e intenta ir al login, redirigir a /ops
  if (to.path === '/login' && authStore.isAuthenticated) {
    return next({ path: '/ops' });
  }

  next();
});

