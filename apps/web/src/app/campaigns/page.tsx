'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge, Button, Field, Input, Panel, Textarea } from '@/components/ui';
import type { Campaign, Contact } from '@/lib/api';
import { voiceApi } from '@/lib/api';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    goal: '',
    script: '',
    openingMessage: '',
    closingMessage: '',
    approvedFacts: '',
    forbiddenClaims: '',
    contactIds: [] as string[],
  });

  async function refresh() {
    const [c, ct] = await Promise.all([voiceApi.campaigns(), voiceApi.contacts()]);
    setCampaigns(c.campaigns);
    setContacts(ct.contacts);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await voiceApi.createCampaign({
        name: form.name,
        goal: form.goal,
        script: form.script,
        openingMessage: form.openingMessage,
        closingMessage: form.closingMessage,
        approvedFacts: form.approvedFacts
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        forbiddenClaims: form.forbiddenClaims
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        contactIds: form.contactIds,
      });
      setForm({
        name: '',
        goal: '',
        script: '',
        openingMessage: '',
        closingMessage: '',
        approvedFacts: '',
        forbiddenClaims: '',
        contactIds: [],
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Campaigns"
      subtitle="Create a campaign, review the script, then approve before any call stubs can be queued."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-4 text-sm tracking-wide text-[var(--muted)] uppercase">New campaign</h2>
          <form className="space-y-3" onSubmit={(e) => void onCreate(e)}>
            <Field label="Name">
              <Input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field label="Goal">
              <Input
                required
                value={form.goal}
                onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
              />
            </Field>
            <Field label="Opening message">
              <Textarea
                rows={2}
                value={form.openingMessage}
                onChange={(e) => setForm((f) => ({ ...f, openingMessage: e.target.value }))}
              />
            </Field>
            <Field label="Script (requires approval)">
              <Textarea
                required
                rows={5}
                value={form.script}
                onChange={(e) => setForm((f) => ({ ...f, script: e.target.value }))}
              />
            </Field>
            <Field label="Closing message">
              <Textarea
                rows={2}
                value={form.closingMessage}
                onChange={(e) => setForm((f) => ({ ...f, closingMessage: e.target.value }))}
              />
            </Field>
            <Field label="Approved facts (one per line)">
              <Textarea
                rows={2}
                value={form.approvedFacts}
                onChange={(e) => setForm((f) => ({ ...f, approvedFacts: e.target.value }))}
              />
            </Field>
            <Field label="Forbidden claims (one per line)">
              <Textarea
                rows={2}
                value={form.forbiddenClaims}
                onChange={(e) => setForm((f) => ({ ...f, forbiddenClaims: e.target.value }))}
              />
            </Field>
            <Field label="Assign contacts">
              <div className="max-h-36 space-y-1 overflow-auto rounded-xl border border-[var(--line)] p-2">
                {contacts.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">Import contacts first.</p>
                ) : (
                  contacts.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.contactIds.includes(c.id)}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            contactIds: e.target.checked
                              ? [...f.contactIds, c.id]
                              : f.contactIds.filter((id) => id !== c.id),
                          }))
                        }
                      />
                      <span>
                        {c.name} · {c.phoneE164}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </Field>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <Button type="submit" disabled={busy}>
              Create draft
            </Button>
          </form>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-sm tracking-wide text-[var(--muted)] uppercase">
            All campaigns
          </h2>
          <ul className="space-y-3">
            {campaigns.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">No campaigns yet.</li>
            ) : (
              campaigns.map((c) => (
                <li key={c.id} className="rounded-xl border border-[var(--line)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="font-medium hover:text-[var(--accent)]"
                      >
                        {c.name}
                      </Link>
                      <p className="mt-1 text-sm text-[var(--muted)]">{c.goal}</p>
                    </div>
                    <Badge tone={c.status === 'approved' ? 'ok' : 'warn'}>{c.status}</Badge>
                  </div>
                </li>
              ))
            )}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
