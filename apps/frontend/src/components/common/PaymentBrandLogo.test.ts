import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PaymentBrandLogo from './PaymentBrandLogo.vue';
import { PaymentMethodDeclared } from '@qr-menu/shared';

describe('PaymentBrandLogo Component', () => {
  it('renders Bre-B SVG logo with official MIV gradient and colors', () => {
    const wrapper = mount(PaymentBrandLogo, {
      props: { method: PaymentMethodDeclared.BRE_B },
    });
    expect(wrapper.classes()).toContain('brand-bre_b');
    expect(wrapper.find('.svg-bre-b').exists()).toBe(true);
    expect(wrapper.html()).toContain('id="breBGradient"');
    expect(wrapper.html()).toContain('#00BAFF');
    expect(wrapper.html()).toContain('#00FF82');
  });

  it('renders Nequi SVG logo with signature magenta square', () => {
    const wrapper = mount(PaymentBrandLogo, {
      props: { method: PaymentMethodDeclared.NEQUI },
    });
    expect(wrapper.classes()).toContain('brand-nequi');
    expect(wrapper.find('.svg-nequi').exists()).toBe(true);
    expect(wrapper.html()).toContain('#DA0081');
    expect(wrapper.html()).toContain('1E0329');
  });

  it('renders Bancolombia SVG logo with ribbon strokes', () => {
    const wrapper = mount(PaymentBrandLogo, {
      props: { method: PaymentMethodDeclared.BANCOLOMBIA },
    });
    expect(wrapper.classes()).toContain('brand-bancolombia');
    expect(wrapper.find('.svg-bancolombia').exists()).toBe(true);
    expect(wrapper.html()).toContain('Bancolombia');
    expect(wrapper.html()).toContain('#FDDA24');
  });

  it('renders Cash SVG logo with gold accents', () => {
    const wrapper = mount(PaymentBrandLogo, {
      props: { method: PaymentMethodDeclared.CASH },
    });
    expect(wrapper.classes()).toContain('brand-cash');
    expect(wrapper.find('.svg-cash').exists()).toBe(true);
    expect(wrapper.html()).toContain('cashGoldGrad');
  });
});
