'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CALL_STATES } from '@voice/shared';
import { AppShell } from '@/components/AppShell';
import { Badge, Field, Input, Panel } from '@/components/ui';
import type { CallRecord } from '@/lib/api';
import { voiceApi } from '@/lib/api';

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load(nextStatus = status, nextQ = q) {
    const res = await voiceApi.calls({
      status: nextStatus || undefined,
      q: nextQ || undefined,
    });
    setCalls(res.calls);
  }

  useEffect(() => {
    void voiceApi
      .calls()
      .then((res) => setCalls(res.calls))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <AppShell
      title="Call history"
      subtitle="Filter by status. Stubbed calls are always marked simulated."
    >
      <Panel className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status">
            <select
              className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2 text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                void load(e.target.value, q).catch((err: Error) => setError(err.message));
              }}
            >
              <option value="">All</option>
              {CALL_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Search">
            <Input
              value={q}
              placeholder="Call id, contact, campaign…"
              onChange={(e) => {
                setQ(e.target.value);
                void load(status, e.target.value).catch((err: Error) => setError(err.message));
              }}
            />
          </Field>
        </div>
      </Panel>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <Panel>
        <ul className="divide-y divide-[var(--line)]">
          {calls.length === 0 ? (
            <li className="py-3 text-sm text-[var(--muted)]">No calls yet.</li>
          ) : (
            calls.map((call) => (
              <li
                key={call.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <Link
                    href={`/calls/${call.id}`}
                    className="font-medium hover:text-[var(--accent)]"
                  >
                    {call.id}
                  </Link>
                  <p className="text-[var(--muted)]">
                    campaign {call.campaignId} · contact {call.contactId}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge tone={call.mode === 'live' ? 'warn' : 'accent'}>{call.mode}</Badge>
                  <Badge>{call.status}</Badge>
                  <Badge tone="muted">{call.outcome}</Badge>
                </div>
              </li>
            ))
          )}
        </ul>
      </Panel>
    </AppShell>
  );
}
