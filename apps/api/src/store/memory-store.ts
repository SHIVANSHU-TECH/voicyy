import type { AppSettings, CallRecord, Campaign, Contact } from '@voice/shared';
import { randomUUID } from 'node:crypto';

export interface PreviewSession {
  id: string;
  createdAt: string;
  sourceFile: string;
  sourceKind: 'csv' | 'xlsx' | 'pdf';
  rows: PreviewRow[];
  scriptText?: string;
  expiresAt: string;
}

export interface PreviewRow {
  rowIndex: number;
  name: string;
  phoneRaw: string;
  phoneE164: string | null;
  email?: string;
  company?: string;
  notes?: string;
  valid: boolean;
  errors: string[];
  duplicateOfContactId?: string;
  duplicateInBatch?: boolean;
}

export class MemoryStore {
  contacts = new Map<string, Contact>();
  campaigns = new Map<string, Campaign>();
  calls = new Map<string, CallRecord>();
  previews = new Map<string, PreviewSession>();
  settings: AppSettings;
  /** phoneE164 → contactId for duplicate detection */
  phoneIndex = new Map<string, string>();

  constructor(initialSettings: AppSettings) {
    this.settings = { ...initialSettings };
  }

  newId(prefix: string): string {
    return `${prefix}_${randomUUID().slice(0, 8)}`;
  }

  reset(): void {
    this.contacts.clear();
    this.campaigns.clear();
    this.calls.clear();
    this.previews.clear();
    this.phoneIndex.clear();
  }
}

let singleton: MemoryStore | null = null;

export function getStore(initialSettings?: AppSettings): MemoryStore {
  if (!singleton) {
    if (!initialSettings) {
      throw new Error('MemoryStore requires initial settings on first access');
    }
    singleton = new MemoryStore(initialSettings);
  }
  return singleton;
}

export function resetStore(initialSettings: AppSettings): MemoryStore {
  singleton = new MemoryStore(initialSettings);
  return singleton;
}

export function createStore(initialSettings: AppSettings): MemoryStore {
  return new MemoryStore(initialSettings);
}
