import { describe, expect, it } from 'vitest';
import { formatPrice } from './lib';

describe('formatPrice', () => {
  it('does not invent a missing price', () => expect(formatPrice(null)).toBe('Unknown'));
  it('formats known prices', () => expect(formatPrice(0.55)).toBe('$0.55'));
});
