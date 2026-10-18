import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it('normalizes valid Indian mobiles to E.164', () => {
    expect(normalizePhone('9876543210', 'IN').e164).toBe('+919876543210');
    expect(normalizePhone('+91 98765 43210', 'IN').e164).toBe('+919876543210');
  });

  it('rejects missing and invalid numbers', () => {
    expect(normalizePhone('', 'IN').error).toMatch(/required/i);
    expect(normalizePhone('123', 'IN').e164).toBeNull();
  });
});
