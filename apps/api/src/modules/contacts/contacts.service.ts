import type { Contact } from '@voice/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { MemoryStore, PreviewRow, PreviewSession } from '../../store/memory-store.js';
import { parseCsvContacts } from './parsers/csv.js';
import { parsePdfDocument } from './parsers/pdf.js';
import { parseXlsxContacts } from './parsers/xlsx.js';
import { normalizePhone } from './phone.js';

export type UploadKind = 'csv' | 'xlsx' | 'pdf';

function detectKind(filename: string, mime?: string): UploadKind {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv') || mime === 'text/csv') return 'csv';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || mime?.includes('spreadsheet'))
    return 'xlsx';
  if (lower.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  throw new ValidationError('Unsupported file type. Use PDF, CSV, or XLSX.');
}

export class ContactsService {
  constructor(private readonly store: MemoryStore) {}

  list(query?: string): Contact[] {
    const q = query?.trim().toLowerCase();
    const all = [...this.store.contacts.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    if (!q) return all;
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phoneE164.includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.company?.toLowerCase().includes(q) ?? false),
    );
  }

  get(id: string): Contact {
    const contact = this.store.contacts.get(id);
    if (!contact) throw new NotFoundError('Contact not found');
    return contact;
  }

  async previewUpload(input: {
    buffer: Buffer;
    filename: string;
    mime?: string;
  }): Promise<PreviewSession> {
    const kind = detectKind(input.filename, input.mime);
    const region = this.store.settings.defaultPhoneRegion;
    let scriptText: string | undefined;
    let rawRows;

    if (kind === 'csv') {
      rawRows = parseCsvContacts(input.buffer);
    } else if (kind === 'xlsx') {
      rawRows = parseXlsxContacts(input.buffer);
    } else {
      const parsed = await parsePdfDocument(input.buffer);
      scriptText = parsed.scriptText;
      rawRows = parsed.rows;
    }

    const batchPhones = new Map<string, number>();
    const rows: PreviewRow[] = rawRows.map((raw) => {
      const errors: string[] = [];
      if (!raw.name?.trim()) errors.push('Name is required');

      const phone = normalizePhone(raw.phone, region);
      if (phone.error) errors.push(phone.error);

      let duplicateOfContactId: string | undefined;
      let duplicateInBatch = false;
      if (phone.e164) {
        const existing = this.store.phoneIndex.get(phone.e164);
        if (existing) duplicateOfContactId = existing;
        if (batchPhones.has(phone.e164)) {
          duplicateInBatch = true;
          errors.push('Duplicate phone within this upload');
        } else {
          batchPhones.set(phone.e164, raw.rowIndex);
        }
      }

      if (duplicateOfContactId) {
        errors.push(`Duplicate of existing contact ${duplicateOfContactId}`);
      }

      return {
        rowIndex: raw.rowIndex,
        name: raw.name?.trim() || '',
        phoneRaw: raw.phone ?? '',
        phoneE164: phone.e164,
        email: raw.email,
        company: raw.company,
        notes: raw.notes,
        valid: errors.length === 0,
        errors,
        duplicateOfContactId,
        duplicateInBatch,
      };
    });

    const session: PreviewSession = {
      id: this.store.newId('prev'),
      createdAt: new Date().toISOString(),
      sourceFile: input.filename,
      sourceKind: kind,
      rows,
      scriptText,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };

    this.store.previews.set(session.id, session);
    return session;
  }

  getPreview(previewId: string): PreviewSession {
    const preview = this.store.previews.get(previewId);
    if (!preview) throw new NotFoundError('Preview session not found or expired');
    if (new Date(preview.expiresAt).getTime() < Date.now()) {
      this.store.previews.delete(previewId);
      throw new NotFoundError('Preview session expired');
    }
    return preview;
  }

  confirmImport(input: {
    previewId: string;
    rowIndexes: number[];
    corrections?: Array<{
      rowIndex: number;
      name?: string;
      phoneRaw?: string;
      email?: string;
      company?: string;
      notes?: string;
      consentCaptured?: boolean;
    }>;
  }): { saved: Contact[]; skipped: number; invalid: number } {
    const preview = this.getPreview(input.previewId);
    const region = this.store.settings.defaultPhoneRegion;
    const correctionMap = new Map((input.corrections ?? []).map((c) => [c.rowIndex, c]));
    const selected = new Set(input.rowIndexes);

    if (selected.size === 0) {
      throw new ValidationError('Select at least one row to import');
    }

    const saved: Contact[] = [];
    let skipped = 0;
    let invalid = 0;

    for (const row of preview.rows) {
      if (!selected.has(row.rowIndex)) {
        skipped += 1;
        continue;
      }

      const correction = correctionMap.get(row.rowIndex);
      const name = (correction?.name ?? row.name).trim();
      const phoneRaw = correction?.phoneRaw ?? row.phoneRaw;
      const phone = normalizePhone(phoneRaw, region);
      const email = correction?.email ?? row.email;
      const company = correction?.company ?? row.company;
      const notes = correction?.notes ?? row.notes;

      if (!name || !phone.e164) {
        invalid += 1;
        continue;
      }

      if (this.store.phoneIndex.has(phone.e164)) {
        throw new ConflictError(`Phone ${phone.e164} already exists`, {
          phoneE164: phone.e164,
          contactId: this.store.phoneIndex.get(phone.e164),
        });
      }

      const now = new Date().toISOString();
      const contact: Contact = {
        id: this.store.newId('ct'),
        name,
        phoneE164: phone.e164,
        email: email || undefined,
        company,
        notes,
        sourceFile: preview.sourceFile,
        suppressed: false,
        consentCaptured: correction?.consentCaptured ?? false,
        createdAt: now,
        updatedAt: now,
      };

      this.store.contacts.set(contact.id, contact);
      this.store.phoneIndex.set(contact.phoneE164, contact.id);
      saved.push(contact);
    }

    this.store.previews.delete(input.previewId);
    return { saved, skipped, invalid };
  }
}
