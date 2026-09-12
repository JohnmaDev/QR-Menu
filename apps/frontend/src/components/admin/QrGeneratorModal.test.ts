import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import QrGeneratorModal from './QrGeneratorModal.vue';
import { AdminTable } from '@qr-menu/shared';

// Mock de qr-code-styling para entorno de test sin canvas nativo complejo
const appendMock = vi.fn();
const updateMock = vi.fn();
const downloadMock = vi.fn();
const getRawDataMock = vi.fn().mockResolvedValue(new Blob(['fake-png-bytes'], { type: 'image/png' }));

vi.mock('qr-code-styling', () => {
  return {
    default: class MockQRCodeStyling {
      append = appendMock;
      update = updateMock;
      download = downloadMock;
      getRawData = getRawDataMock;
    },
  };
});

describe('QrGeneratorModal Component', () => {
  const sampleTable: AdminTable = {
    id: 1,
    number: 5,
    name: 'Terraza VIP',
    publicToken: 't_m5_abc123',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders table information and table URL properly without duplicating table number', async () => {
    const tableWithNumberInName: AdminTable = {
      id: 3,
      number: 3,
      name: 'Mesa 3',
      publicToken: 't_m3_xyz789',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const wrapper = mount(QrGeneratorModal, {
      props: { table: tableWithNumberInName },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Generador de Código QR');
    expect(wrapper.text()).toContain('Mesa 3');
    // Verificar expresamente que NO muestre '#3 Mesa 3' duplicado
    expect(wrapper.text()).not.toContain('#3 Mesa 3');

    const input = wrapper.find('.url-input');
    expect(input.exists()).toBe(true);
    expect((input.element as HTMLInputElement).value).toContain('/m/t_m3_xyz789');
  });

  it('allows toggling between "Sin Imagen" and "Con Foto de Fondo" modes', async () => {
    const wrapper = mount(QrGeneratorModal, {
      props: { table: sampleTable },
    });
    await flushPromises();

    // Por defecto inicia en modo 'NONE' (Sin Imagen)
    const modeButtons = wrapper.findAll('.mode-btn');
    expect(modeButtons.length).toBe(2);

    expect(wrapper.text()).toContain('Sin Imagen (Limpio)');
    expect(wrapper.text()).toContain('Color de Fondo Sólido');

    // Cambiar a "Con Foto de Fondo"
    await modeButtons[1].trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Elige o sube una foto');
    expect(wrapper.text()).toContain('Oscurecimiento / Contraste de Foto');
    expect(wrapper.find('.range-slider').exists()).toBe(true);

    // Cambiar de vuelta a "Sin Imagen"
    await modeButtons[0].trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Color de Fondo Sólido');
  });

  it('allows selecting solid color background presets in "Sin Imagen" mode and adapts theme on white', async () => {
    const wrapper = mount(QrGeneratorModal, {
      props: { table: sampleTable },
    });
    await flushPromises();

    const solidColorBtns = wrapper.findAll('.solid-color-btn');
    expect(solidColorBtns.length).toBeGreaterThan(0);

    // Seleccionar color blanco
    await solidColorBtns[2].trigger('click');
    await flushPromises();

    // Debe haber invocado update en la instancia de QRCodeStyling
    expect(updateMock).toHaveBeenCalled();

    // Debe aplicar la clase light-theme-stand para contraste oscuro sobre blanco
    expect(wrapper.find('.light-theme-stand').exists()).toBe(true);
    expect(wrapper.find('.stand-footer').text()).toContain('Escanea para ver la carta y pedir');
  });

  it('allows switching background presets in "Con Foto de Fondo" mode', async () => {
    const wrapper = mount(QrGeneratorModal, {
      props: { table: sampleTable },
    });
    await flushPromises();

    // Activar modo con foto
    const modeButtons = wrapper.findAll('.mode-btn');
    await modeButtons[1].trigger('click');
    await flushPromises();

    const bgPresetBtns = wrapper.findAll('.bg-preset-btn');
    expect(bgPresetBtns.length).toBeGreaterThan(0);

    // Click en segundo preset (Lounge)
    await bgPresetBtns[1].trigger('click');
    await flushPromises();

    expect(updateMock).toHaveBeenCalled();
  });

  it('allows changing logo mode to NONE, DEFAULT or CUSTOM', async () => {
    const wrapper = mount(QrGeneratorModal, {
      props: { table: sampleTable },
    });
    await flushPromises();

    const logoBtns = wrapper.findAll('.pill-btn');
    expect(logoBtns.length).toBe(3);

    // Seleccionar 'Sin logo'
    await logoBtns[0].trigger('click');
    await flushPromises();
    expect(updateMock).toHaveBeenCalled();

    // Seleccionar 'Icono Bar'
    await logoBtns[1].trigger('click');
    await flushPromises();
    expect(updateMock).toHaveBeenCalled();
  });

  it('emits close event when close button or backdrop is clicked', async () => {
    const wrapper = mount(QrGeneratorModal, {
      props: { table: sampleTable },
    });

    const closeBtn = wrapper.find('.btn-close');
    await closeBtn.trigger('click');

    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
