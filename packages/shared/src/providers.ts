import { z } from 'zod';

export const ProviderModeSchema = z.enum(['simulated', 'live']);
export type ProviderMode = z.infer<typeof ProviderModeSchema>;

export const TelephonyProviderNameSchema = z.enum(['simulated', 'twilio', 'exotel', 'plivo']);
export const SttProviderNameSchema = z.enum(['simulated', 'groq', 'deepgram']);
export const TtsProviderNameSchema = z.enum(['simulated', 'groq', 'twilio', 'elevenlabs']);
export const ConversationProviderNameSchema = z.enum(['simulated', 'groq']);

export type TelephonyProviderName = z.infer<typeof TelephonyProviderNameSchema>;
export type SttProviderName = z.infer<typeof SttProviderNameSchema>;
export type TtsProviderName = z.infer<typeof TtsProviderNameSchema>;
export type ConversationProviderName = z.infer<typeof ConversationProviderNameSchema>;

/** Marker returned by simulated adapters so clients never confuse them with live calls. */
export interface SimulatedCallMarker {
  mode: 'simulated';
  warning: 'NOT_A_REAL_CALL';
}
