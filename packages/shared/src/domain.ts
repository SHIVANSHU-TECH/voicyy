import { z } from 'zod';
import { CallStateSchema } from './call-states.js';

export const ContactSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  phoneE164: z.string().min(5),
  email: z.string().email().optional().or(z.literal('')),
  company: z.string().optional(),
  notes: z.string().optional(),
  sourceFile: z.string().optional(),
  suppressed: z.boolean().default(false),
  consentCaptured: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Contact = z.infer<typeof ContactSchema>;

export const CampaignStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'paused',
  'archived',
]);
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

const HmOrEmpty = z
  .string()
  .refine((v) => v === '' || /^\d{2}:\d{2}$/.test(v), 'Expected HH:mm or empty');

/** Local calling window for a campaign (Phase 3 schedule gate). */
export const CampaignScheduleSchema = z.object({
  timezone: z.string().default('Asia/Kolkata'),
  /** HH:mm inclusive start in campaign timezone. Empty = always open. */
  windowStartLocal: HmOrEmpty.default(''),
  /** HH:mm exclusive end in campaign timezone. Empty = always open. */
  windowEndLocal: HmOrEmpty.default(''),
  /** 0=Sun … 6=Sat. Empty = every day. */
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
});

export type CampaignSchedule = z.infer<typeof CampaignScheduleSchema>;

export const CampaignSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  goal: z.string().min(1),
  language: z.string().default('en-IN'),
  openingMessage: z.string().default(''),
  closingMessage: z.string().default(''),
  script: z.string().min(1),
  scriptApproved: z.boolean().default(false),
  scriptApprovedAt: z.string().nullable().default(null),
  questions: z.array(z.string()).default([]),
  qualificationCriteria: z.array(z.string()).default([]),
  approvedFacts: z.array(z.string()).default([]),
  forbiddenClaims: z.array(z.string()).default([]),
  status: CampaignStatusSchema.default('draft'),
  contactIds: z.array(z.string()).default([]),
  schedule: CampaignScheduleSchema.default({
    timezone: 'Asia/Kolkata',
    daysOfWeek: [],
  }),
  /** Max dial attempts per contact (idempotent key includes attempt). */
  maxAttempts: z.number().int().positive().default(3),
  /** Minutes to wait after a failed attempt before creating the next attempt. */
  retryBackoffMinutes: z.number().int().nonnegative().default(30),
  /** Campaign concurrency; null/omit uses global MAX_CONCURRENT_CALLS. */
  maxConcurrentCalls: z.number().int().positive().nullable().default(null),
  /** When true, contacts must have consentCaptured before enqueue. */
  requireConsent: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Campaign = z.infer<typeof CampaignSchema>;

export const CallOutcomeSchema = z.enum([
  'unknown',
  'completed',
  'no_answer',
  'busy',
  'voicemail',
  'failed',
  'opted_out',
  'escalated',
  'cancelled',
]);

export type CallOutcome = z.infer<typeof CallOutcomeSchema>;

export const TranscriptTurnSchema = z.object({
  role: z.enum(['agent', 'user', 'system']),
  text: z.string(),
  at: z.string(),
});

export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;

export const CallRecordSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  contactId: z.string(),
  status: CallStateSchema,
  outcome: CallOutcomeSchema.default('unknown'),
  mode: z.enum(['simulated', 'live']).default('simulated'),
  summary: z.string().optional(),
  transcript: z.array(TranscriptTurnSchema).default([]),
  structuredAnswers: z.record(z.string()).default({}),
  errorMessage: z.string().optional(),
  durationSeconds: z.number().nonnegative().default(0),
  attempt: z.number().int().positive().default(1),
  idempotencyKey: z.string(),
  /** When set on a failed call, engine may create attempt+1 after this time. */
  nextRetryAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().nullable().default(null),
  endedAt: z.string().nullable().default(null),
});

export type CallRecord = z.infer<typeof CallRecordSchema>;

export const AppSettingsSchema = z.object({
  telephonyProvider: z.string(),
  sttProvider: z.string(),
  ttsProvider: z.string(),
  conversationProvider: z.string(),
  liveCallingEnabled: z.boolean(),
  maxConcurrentCalls: z.number().int().positive(),
  dailyCallSpendLimitUsd: z.number().nonnegative(),
  transcriptRetentionDays: z.number().int().nonnegative(),
  auditRetentionDays: z.number().int().nonnegative(),
  defaultPhoneRegion: z.string().default('IN'),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

export const DashboardStatsSchema = z.object({
  contacts: z.number().int().nonnegative(),
  campaigns: z.number().int().nonnegative(),
  campaignsApproved: z.number().int().nonnegative(),
  callsTotal: z.number().int().nonnegative(),
  callsByStatus: z.record(z.number()),
  suppressedContacts: z.number().int().nonnegative(),
  liveCallingAllowed: z.boolean(),
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
