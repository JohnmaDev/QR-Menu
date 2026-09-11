import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import MenuView from './MenuView.vue';
import * as api from '../services/api.js';

// Mock vue-router
const pushMock = vi.fn();
vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {
      tableToken: 't_m1_test',
    },
  }),
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe('MenuView Component', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    pushMock.mockClear();
    localStorage.clear();
  });

  it('renders loading spinner and then categories and products', async () => {
    const mockMenu = {
      categories: [
        {
          id: 1,
          name: 'Cervezas',
          icon: 'beer',
          sortOrder: 1,
          products: [
            {
              id: 10,
              name: 'Pilsen 330ml',
              description: 'Lata fría',
              price: 5000,
              imageUrl: null,
              sortOrder: 1,
            },
          ],
        },
      ],
    };

    vi.spyOn(api, 'fetchMenu').mockResolvedValue(mockMenu);

    const wrapper = mount(MenuView);
    expect(wrapper.text()).toContain('Cargando menú frío...');

    await flushPromises();

    expect(wrapper.text()).toContain('El Mora');
    expect(wrapper.text()).toContain('Cervezas');
    expect(wrapper.text()).toContain('Pilsen 330ml');
    expect(wrapper.text()).toContain('$5.000');
  });

  it('renders error message on fetch failure and retries on button click', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchMenu').mockRejectedValue(new Error('Network fail'));

    const wrapper = mount(MenuView);
    await flushPromises();

    expect(wrapper.text()).toContain('No pudimos cargar el menú');

    // Simular clic en Reintentar
    const retryBtn = wrapper.find('.retry-btn');
    expect(retryBtn.exists()).toBe(true);

    fetchSpy.mockResolvedValueOnce({ categories: [] });
    await retryBtn.trigger('click');
    await flushPromises();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
