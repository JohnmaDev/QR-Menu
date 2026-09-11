import { describe, it, expect } from 'vitest';
import { sanitizeRedirectTarget } from './redirect.js';

describe('SEC-05: sanitizeRedirectTarget (Open Redirect Prevention)', () => {
  it('permite rutas relativas internas válidas', () => {
    expect(sanitizeRedirectTarget('/ops')).toBe('/ops');
    expect(sanitizeRedirectTarget('/ops/orders')).toBe('/ops/orders');
    expect(sanitizeRedirectTarget('/m/table123/cart')).toBe('/m/table123/cart');
  });

  it('rechaza URLs absolutas externas y retorna /ops por defecto', () => {
    expect(sanitizeRedirectTarget('https://evil.example.com')).toBe('/ops');
    expect(sanitizeRedirectTarget('http://malicious.org/phishing')).toBe('/ops');
    expect(sanitizeRedirectTarget('//evil.example.com')).toBe('/ops');
    expect(sanitizeRedirectTarget('//evil.example.com/path')).toBe('/ops');
  });

  it('rechaza esquemas peligrosos como javascript: o data:', () => {
    expect(sanitizeRedirectTarget('javascript:alert(1)')).toBe('/ops');
    expect(sanitizeRedirectTarget('data:text/html,evil')).toBe('/ops');
    expect(sanitizeRedirectTarget('/\\evil.example.com')).toBe('/ops');
  });

  it('maneja valores vacíos, nulos o indefinidos con el fallback seguro', () => {
    expect(sanitizeRedirectTarget('')).toBe('/ops');
    expect(sanitizeRedirectTarget('   ')).toBe('/ops');
    expect(sanitizeRedirectTarget(undefined)).toBe('/ops');
    expect(sanitizeRedirectTarget(null)).toBe('/ops');
    expect(sanitizeRedirectTarget(12345)).toBe('/ops');
    expect(sanitizeRedirectTarget({})).toBe('/ops');
  });

  it('respeta fallback personalizado si es necesario', () => {
    expect(sanitizeRedirectTarget('https://evil.com', '/custom')).toBe('/custom');
  });
});
