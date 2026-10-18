import * as XLSX from 'xlsx';
import type { RawContactRow } from './csv.js';

function pick(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const found = Object.entries(record).find(([k]) => String(k).trim().toLowerCase() === key);
    if (found && found[1] != null && String(found[1]).trim()) return String(found[1]).trim();
  }
  return '';
}

export function parseXlsxContacts(buffer: Buffer): RawContactRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return records.map((record, index) => ({
    rowIndex: index + 2,
    name: pick(record, ['name', 'full_name', 'fullname', 'contact', 'contact_name']),
    phone: pick(record, [
      'phone',
      'phone_number',
      'mobile',
      'mobile_number',
      'msisdn',
      'contact_number',
    ]),
    email: pick(record, ['email', 'email_address']) || undefined,
    company: pick(record, ['company', 'organization', 'org']) || undefined,
    notes: pick(record, ['notes', 'note', 'remarks']) || undefined,
  }));
}
