import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from './auth.js';
import { UserRole } from '@qr-menu/shared';
import * as api from '../services/api.js';

describe('Frontend Auth Store (Pinia)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('initializes with unauthenticated state', () => {
    const auth = useAuthStore();
    expect(auth.user).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.isAdmin).toBe(false);
    expect(auth.isCashier).toBe(false);
    expect(auth.isKitchen).toBe(false);
    expect(auth.role).toBeNull();
    expect(auth.error).toBeNull();
  });

  it('login success sets authenticated user and computed role getters', async () => {
    const auth = useAuthStore();
    vi.spyOn(api, 'loginApi').mockResolvedValue({
      user: {
        id: '11111111-1111-1111-1111-111111111111',
        username: 'cocina_master',
        role: UserRole.KITCHEN,
      },
    });

    await auth.login('cocina_master', 'Pass123!');

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user?.username).toBe('cocina_master');
    expect(auth.role).toBe(UserRole.KITCHEN);
    expect(auth.isKitchen).toBe(true);
    expect(auth.isAdmin).toBe(false);
    expect(auth.isCashier).toBe(false);
    expect(auth.error).toBeNull();
  });

  it('login failure handles error and clears user state', async () => {
    const auth = useAuthStore();
    vi.spyOn(api, 'loginApi').mockRejectedValue(
      new api.ApiClientError('INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos', 401)
    );

    await expect(auth.login('user', 'badpass')).rejects.toThrow();

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.user).toBeNull();
    expect(auth.error).toBe('Usuario o contraseña incorrectos');
  });

  it('logout clears authenticated user', async () => {
    const auth = useAuthStore();
    auth.user = {
      id: '22222222-2222-2222-2222-222222222222',
      username: 'admin',
      role: UserRole.ADMIN,
    };

    vi.spyOn(api, 'logoutApi').mockResolvedValue({ status: 'logged_out' });

    await auth.logout();

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.user).toBeNull();
    expect(auth.isAdmin).toBe(false);
  });

  it('checkAuth validates session with server and updates state', async () => {
    const auth = useAuthStore();
    vi.spyOn(api, 'fetchCurrentUserApi').mockResolvedValue({
      user: {
        id: '33333333-3333-3333-3333-333333333333',
        username: 'caja_test',
        role: UserRole.CASHIER,
      },
    });

    const isOk = await auth.checkAuth();

    expect(isOk).toBe(true);
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.isCashier).toBe(true);
  });
});
