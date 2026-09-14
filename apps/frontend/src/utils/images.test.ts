import { describe, it, expect } from 'vitest';
import { optimizeProductImage, getProductImage } from './images';

describe('images utility', () => {
  describe('optimizeProductImage', () => {
    it('returns empty string for null, undefined or empty input', () => {
      expect(optimizeProductImage(null)).toBe('');
      expect(optimizeProductImage(undefined)).toBe('');
      expect(optimizeProductImage('   ')).toBe('');
    });

    it('injects f_auto, q_auto and width into Cloudinary upload URLs', () => {
      const original = 'https://res.cloudinary.com/demo/image/upload/v1726278888/products/corona.jpg';
      const expected = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_320,c_limit/v1726278888/products/corona.jpg';
      expect(optimizeProductImage(original, 320)).toBe(expected);
    });

    it('supports custom width specifications', () => {
      const original = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
      const expected = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_80,c_limit/sample.jpg';
      expect(optimizeProductImage(original, 80)).toBe(expected);
    });

    it('does not duplicate transformations if f_auto is already present', () => {
      const alreadyOptimized = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_400/sample.jpg';
      expect(optimizeProductImage(alreadyOptimized)).toBe(alreadyOptimized);
    });

    it('leaves non-Cloudinary URLs unmodified', () => {
      const externalUrl = 'https://images.unsplash.com/photo-1514933651103-005eec06c04b';
      expect(optimizeProductImage(externalUrl)).toBe(externalUrl);
    });
  });

  describe('getProductImage', () => {
    it('returns optimized Cloudinary URL when imageUrl is provided', () => {
      const original = 'https://res.cloudinary.com/demo/image/upload/sample.png';
      expect(getProductImage(1, original, 400)).toContain('/upload/f_auto,q_auto,w_400,c_limit/');
    });

    it('falls back to category placeholder when imageUrl is missing', () => {
      expect(getProductImage(1, null)).toBe('/images/beers.jpg');
      expect(getProductImage(2, '')).toBe('/images/liquors.jpg');
      expect(getProductImage(3, undefined)).toBe('/images/slush.jpg');
      expect(getProductImage(4, null)).toBe('/images/sodas.jpg');
      expect(getProductImage(5, null)).toBe('/images/snacks.jpg');
      expect(getProductImage(99, null)).toBe('/images/beers.jpg');
    });
  });
});
