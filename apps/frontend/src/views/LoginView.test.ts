import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import LoginView from './LoginView.vue';
import * as api from '../services/api.js';

const replaceMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  useRoute: () => ({
    query: {},
  }),
}));

describe('LoginView Component', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    replaceMock.mockClear();
  });

  it('renders login form with username, password and submit button', () => {
    const wrapper = mount(LoginView);
    expect(wrapper.text()).toContain('Control de Caja');
    expect(wrapper.find('input#username').exists()).toBe(true);
    expect(wrapper.find('input#password').exists()).toBe(true);
    expect(wrapper.find('button#btn-login').exists()).toBe(true);
  });

  it('displays error banner when login fails', async () => {
    vi.spyOn(api, 'loginApi').mockRejectedValue(
      new api.ApiClientError('INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos', 401)
    );

    const wrapper = mount(LoginView);
    await wrapper.find('input#username').setValue('admin');
    await wrapper.find('input#password').setValue('wrong');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.find('.error-banner').exists()).toBe(true);
    expect(wrapper.text()).toContain('Usuario o contraseña incorrectos');
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redirects to /ops on successful login', async () => {
    vi.spyOn(api, 'loginApi').mockResolvedValue({
      user: {
        id: '11111111-1111-1111-1111-111111111111',
        username: 'admin',
        role: 'ADMIN' as any,
      },
    });

    const wrapper = mount(LoginView);
    await wrapper.find('input#username').setValue('admin');
    await wrapper.find('input#password').setValue('Password123!');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(replaceMock).toHaveBeenCalledWith('/ops');
  });
});
