'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge, Panel } from '@/components/ui';
import type { CallDetail } from '@/lib/api';
import { voiceApi } from '@/lib/api';

export default function CallDetailPage() {
  const params = useParams<{ id: string }>();
  const [call, setCall] = useState<CallDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void voiceApi
      .call(params.id)
      .then((res) => setCall(res.call))
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  return (
    <AppShell title="Call detail" subtitle="Permitted transcript, summary, and outcome.">
      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
      {!call ? (
        <Panel>
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge tone={call.mode === 'live' ? 'warn' : 'accent'}>{call.mode}</Badge>
              <Badge>{call.status}</Badge>
              <Badge>{call.outcome}</Badge>
            </div>
            <p>
              <span className="text-[var(--muted)]">Campaign:</span>{' '}
              {call.campaignName ?? call.campaignId}
            </p>
            <p>
              <span className="text-[var(--muted)]">Contact:</span>{' '}
              {call.contactName ?? call.contactId}{' '}
              {call.contactPhone ? `· ${call.contactPhone}` : ''}
            </p>
            <p>
              <span className="text-[var(--muted)]">Duration:</span> {call.durationSeconds}s
            </p>
            <div>
              <h2 className="text-[var(--muted)] uppercase text-xs tracking-wide">Summary</h2>
              <p className="mt-1">{call.summary || 'No summary yet (call not connected).'}</p>
            </div>
            {call.errorMessage ? <p className="text-red-300">{call.errorMessage}</p> : null}
          </Panel>
          <Panel>
            <h2 className="mb-3 text-xs tracking-wide text-[var(--muted)] uppercase">Transcript</h2>
            {call.transcript.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No transcript stored for this stub.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {call.transcript.map((turn, idx) => (
                  <li key={`${turn.at}-${idx}`} className="rounded-xl bg-black/20 px-3 py-2">
                    <p className="text-xs text-[var(--muted)]">
                      {turn.role} · {new Date(turn.at).toLocaleString()}
                    </p>
                    <p className="mt-1">{turn.text}</p>
                  </li>
                ))}
              </ul>
            )}
            {Object.keys(call.structuredAnswers).length > 0 ? (
              <div className="mt-4">
                <h2 className="mb-2 text-xs tracking-wide text-[var(--muted)] uppercase">
                  Answers
                </h2>
                <ul className="space-y-1 text-sm">
                  {Object.entries(call.structuredAnswers).map(([k, v]) => (
                    <li key={k}>
                      <span className="text-[var(--muted)]">{k}:</span> {v}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
