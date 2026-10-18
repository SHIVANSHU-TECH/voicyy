import { parse } from 'csv-parse/sync';

export interface RawContactRow {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  notes?: string;
  rowIndex: number;
}

function pick(record: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const found = Object.entries(record).find(([k]) => k.trim().toLowerCase() === key);
    if (found && found[1]?.trim()) return found[1].trim();
  }
  return '';
}

export function parseCsvContacts(buffer: Buffer): RawContactRow[] {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  return records.map((record, index) => ({
    rowIndex: index + 2, // header is row 1
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
