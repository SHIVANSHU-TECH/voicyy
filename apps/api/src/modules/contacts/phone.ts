import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export function normalizePhone(
  raw: string,
  defaultRegion: string = 'IN',
): { e164: string | null; error?: string } {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    return { e164: null, error: 'Phone number is required' };
  }

  const region = (defaultRegion || 'IN').toUpperCase() as CountryCode;
  const parsed = parsePhoneNumberFromString(trimmed, region);
  if (!parsed || !parsed.isValid()) {
    return { e164: null, error: 'Invalid phone number' };
  }

  return { e164: parsed.format('E.164') };
}
