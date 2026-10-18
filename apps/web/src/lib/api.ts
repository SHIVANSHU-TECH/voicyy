const DEFAULT_API_URL = 'http://localhost:4100';

export function getPublicApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || DEFAULT_API_URL;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getPublicApiUrl()}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const voiceApi = {
  stats: () => api<{ stats: DashboardStats }>('/api/v1/dashboard/stats'),
  contacts: (q?: string) =>
    api<{ contacts: Contact[] }>(`/api/v1/contacts${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  previewContacts: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api<PreviewResponse>('/api/v1/contacts/preview', { method: 'POST', body: form });
  },
  confirmContacts: (body: {
    previewId: string;
    rowIndexes: number[];
    corrections?: Array<{
      rowIndex: number;
      consentCaptured?: boolean;
      name?: string;
      phoneRaw?: string;
    }>;
  }) =>
    api<{ savedCount: number; contacts: Contact[] }>('/api/v1/contacts/confirm', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  campaigns: () => api<{ campaigns: Campaign[] }>('/api/v1/campaigns'),
  campaign: (id: string) => api<{ campaign: Campaign }>(`/api/v1/campaigns/${id}`),
  createCampaign: (body: Partial<Campaign> & { name: string; goal: string; script: string }) =>
    api<{ campaign: Campaign }>('/api/v1/campaigns', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCampaign: (id: string, body: Partial<Campaign>) =>
    api<{ campaign: Campaign }>(`/api/v1/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  approveScript: (id: string) =>
    api<{ campaign: Campaign }>(`/api/v1/campaigns/${id}/approve-script`, { method: 'POST' }),
  calls: (params?: { status?: string; q?: string }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.q) search.set('q', params.q);
    const qs = search.toString();
    return api<{ calls: CallRecord[] }>(`/api/v1/calls${qs ? `?${qs}` : ''}`);
  },
  call: (id: string) => api<{ call: CallDetail }>(`/api/v1/calls/${id}`),
  createCallStubs: (campaignId: string) =>
    api<{ calls: CallRecord[]; warning: string }>('/api/v1/calls/stubs', {
      method: 'POST',
      body: JSON.stringify({ campaignId }),
    }),
  settings: () => api<{ settings: AppSettings }>('/api/v1/settings'),
  patchSettings: (body: Partial<AppSettings>) =>
    api<{ settings: AppSettings }>('/api/v1/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export interface DashboardStats {
  contacts: number;
  campaigns: number;
  campaignsApproved: number;
  callsTotal: number;
  callsByStatus: Record<string, number>;
  suppressedContacts: number;
  liveCallingAllowed: boolean;
}

export interface Contact {
  id: string;
  name: string;
  phoneE164: string;
  email?: string;
  company?: string;
  notes?: string;
  suppressed: boolean;
  consentCaptured: boolean;
  sourceFile?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  goal: string;
  language: string;
  openingMessage: string;
  closingMessage: string;
  script: string;
  scriptApproved: boolean;
  scriptApprovedAt: string | null;
  questions: string[];
  qualificationCriteria: string[];
  approvedFacts: string[];
  forbiddenClaims: string[];
  status: string;
  contactIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CallRecord {
  id: string;
  campaignId: string;
  contactId: string;
  status: string;
  outcome: string;
  mode: 'simulated' | 'live';
  summary?: string;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface CallDetail extends CallRecord {
  contactName?: string;
  contactPhone?: string;
  campaignName?: string;
  transcript: Array<{ role: string; text: string; at: string }>;
  structuredAnswers: Record<string, string>;
  errorMessage?: string;
}

export interface AppSettings {
  telephonyProvider: string;
  sttProvider: string;
  ttsProvider: string;
  conversationProvider: string;
  liveCallingEnabled: boolean;
  liveCallingAllowed?: boolean;
  maxConcurrentCalls: number;
  dailyCallSpendLimitUsd: number;
  transcriptRetentionDays: number;
  auditRetentionDays: number;
  defaultPhoneRegion: string;
  note?: string;
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

export interface PreviewResponse {
  previewId: string;
  sourceFile: string;
  sourceKind: string;
  scriptText?: string;
  rows: PreviewRow[];
  summary: { total: number; valid: number; invalid: number; duplicates: number };
  requiresConfirmation: boolean;
}
