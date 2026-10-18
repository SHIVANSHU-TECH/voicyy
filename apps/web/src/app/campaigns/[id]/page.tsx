'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge, Button, Panel } from '@/components/ui';
import type { Campaign } from '@/lib/api';
import { voiceApi } from '@/lib/api';

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void voiceApi
      .campaign(params.id)
      .then((res) => setCampaign(res.campaign))
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  async function approve() {
    if (!campaign) return;
    setBusy(true);
    setError(null);
    try {
      const res = await voiceApi.approveScript(campaign.id);
      setCampaign(res.campaign);
      setMessage('Script approved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setBusy(false);
    }
  }

  async function queueStubs() {
    if (!campaign) return;
    setBusy(true);
    setError(null);
    try {
      const res = await voiceApi.createCallStubs(campaign.id);
      setMessage(`${res.calls.length} simulated call stub(s) queued. ${res.warning}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Queue failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title={campaign?.name ?? 'Campaign'}
      subtitle="Review script, approve, then queue non-dialing stubs."
    >
      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-[var(--ok)]">{message}</p> : null}
      {!campaign ? (
        <Panel>
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Panel className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone={campaign.scriptApproved ? 'ok' : 'warn'}>
                {campaign.scriptApproved ? 'script approved' : 'needs approval'}
              </Badge>
              <Badge>{campaign.status}</Badge>
              <Badge>{campaign.language}</Badge>
            </div>
            <div>
              <h2 className="text-sm text-[var(--muted)] uppercase">Goal</h2>
              <p className="mt-1">{campaign.goal}</p>
            </div>
            <div>
              <h2 className="text-sm text-[var(--muted)] uppercase">Opening</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm">{campaign.openingMessage || '—'}</p>
            </div>
            <div>
              <h2 className="text-sm text-[var(--muted)] uppercase">Script</h2>
              <pre className="mt-1 whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-sm">
                {campaign.script}
              </pre>
            </div>
            <div>
              <h2 className="text-sm text-[var(--muted)] uppercase">Closing</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm">{campaign.closingMessage || '—'}</p>
            </div>
          </Panel>
          <Panel className="space-y-4">
            <div>
              <h2 className="text-sm text-[var(--muted)] uppercase">Approved facts</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {campaign.approvedFacts.length === 0 ? <li>—</li> : null}
                {campaign.approvedFacts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-sm text-[var(--muted)] uppercase">Forbidden claims</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {campaign.forbiddenClaims.length === 0 ? <li>—</li> : null}
                {campaign.forbiddenClaims.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {campaign.contactIds.length} contact(s) assigned
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || campaign.scriptApproved} onClick={() => void approve()}>
                Approve script
              </Button>
              <Button
                variant="ghost"
                disabled={busy || !campaign.scriptApproved}
                onClick={() => void queueStubs()}
              >
                Queue call stubs
              </Button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Queueing creates simulated stubs only. No real phone numbers are dialed.
            </p>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
