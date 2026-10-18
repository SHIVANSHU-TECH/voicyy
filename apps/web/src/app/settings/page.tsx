'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge, Button, Field, Input, Panel } from '@/components/ui';
import type { AppSettings } from '@/lib/api';
import { voiceApi } from '@/lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void voiceApi
      .settings()
      .then((res) => setSettings(res.settings))
      .catch((err: Error) => setError(err.message));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const res = await voiceApi.patchSettings({
        telephonyProvider: settings.telephonyProvider,
        sttProvider: settings.sttProvider,
        ttsProvider: settings.ttsProvider,
        conversationProvider: settings.conversationProvider,
        maxConcurrentCalls: Number(settings.maxConcurrentCalls),
        dailyCallSpendLimitUsd: Number(settings.dailyCallSpendLimitUsd),
        transcriptRetentionDays: Number(settings.transcriptRetentionDays),
        auditRetentionDays: Number(settings.auditRetentionDays),
        defaultPhoneRegion: settings.defaultPhoneRegion,
      });
      setSettings(res.settings);
      setMessage('Settings saved (live calling still gated by server env).');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Settings"
      subtitle="Providers, concurrency, spend limit, and retention. Secrets stay on the server."
    >
      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-[var(--ok)]">{message}</p> : null}
      {!settings ? (
        <Panel>
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </Panel>
      ) : (
        <Panel>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void save(e)}>
            <Field label="Telephony provider">
              <select
                className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2 text-sm"
                value={settings.telephonyProvider}
                onChange={(e) => setSettings({ ...settings, telephonyProvider: e.target.value })}
              >
                {['simulated', 'twilio', 'exotel', 'plivo'].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="STT provider">
              <select
                className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2 text-sm"
                value={settings.sttProvider}
                onChange={(e) => setSettings({ ...settings, sttProvider: e.target.value })}
              >
                {['simulated', 'groq', 'deepgram'].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="TTS provider">
              <select
                className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2 text-sm"
                value={settings.ttsProvider}
                onChange={(e) => setSettings({ ...settings, ttsProvider: e.target.value })}
              >
                {['simulated', 'groq', 'twilio', 'elevenlabs'].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Conversation provider">
              <select
                className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2 text-sm"
                value={settings.conversationProvider}
                onChange={(e) => setSettings({ ...settings, conversationProvider: e.target.value })}
              >
                {['simulated', 'groq'].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Max concurrent calls">
              <Input
                type="number"
                min={1}
                value={settings.maxConcurrentCalls}
                onChange={(e) =>
                  setSettings({ ...settings, maxConcurrentCalls: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Daily spend limit (USD)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={settings.dailyCallSpendLimitUsd}
                onChange={(e) =>
                  setSettings({ ...settings, dailyCallSpendLimitUsd: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Transcript retention (days)">
              <Input
                type="number"
                min={0}
                value={settings.transcriptRetentionDays}
                onChange={(e) =>
                  setSettings({ ...settings, transcriptRetentionDays: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Audit retention (days)">
              <Input
                type="number"
                min={0}
                value={settings.auditRetentionDays}
                onChange={(e) =>
                  setSettings({ ...settings, auditRetentionDays: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Default phone region">
              <Input
                maxLength={2}
                value={settings.defaultPhoneRegion}
                onChange={(e) =>
                  setSettings({ ...settings, defaultPhoneRegion: e.target.value.toUpperCase() })
                }
              />
            </Field>
            <div className="flex items-end">
              <div className="space-y-2 text-sm">
                <p className="text-[var(--muted)]">Live calling (env-gated)</p>
                <Badge tone={settings.liveCallingAllowed ? 'warn' : 'ok'}>
                  {settings.liveCallingAllowed ? 'allowed' : 'disabled'}
                </Badge>
              </div>
            </div>
            <div className="sm:col-span-2">
              <p className="mb-3 text-xs text-[var(--muted)]">{settings.note}</p>
              <Button type="submit" disabled={busy}>
                Save settings
              </Button>
            </div>
          </form>
        </Panel>
      )}
    </AppShell>
  );
}
