import { describe, it, expect } from 'vitest';
import { formatCOP } from './currency.js';

describe('Frontend Currency Formatter (formatCOP)', () => {
  it('formats whole Colombian pesos amounts correctly', () => {
    expect(formatCOP(5000)).toBe('$5.000');
    expect(formatCOP(13500)).toBe('$13.500');
    expect(formatCOP(120000)).toBe('$120.000');
  });

  it('handles zero gracefully', () => {
    const formatted = formatCOP(0);
    expect(formatted).toContain('0');
  });

  it('handles invalid numbers gracefully without throwing', () => {
    expect(formatCOP(NaN)).toBe('$0');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(formatCOP(null as any)).toBe('$0');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(formatCOP(undefined as any)).toBe('$0');
  });
});
