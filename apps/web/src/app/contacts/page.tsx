'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge, Button, Field, Input, Panel } from '@/components/ui';
import type { Contact, PreviewResponse, PreviewRow } from '@/lib/api';
import { voiceApi } from '@/lib/api';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    const res = await voiceApi.contacts(q);
    setContacts(res.contacts);
  }, []);

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);

  const validSelected = useMemo(
    () => preview?.rows.filter((r) => selected.has(r.rowIndex) && r.valid) ?? [],
    [preview, selected],
  );

  async function onUpload(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await voiceApi.previewContacts(file);
      setPreview(res);
      setSelected(new Set(res.rows.filter((r) => r.valid).map((r) => r.rowIndex)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await voiceApi.confirmContacts({
        previewId: preview.previewId,
        rowIndexes: [...selected],
        corrections: [...selected].map((rowIndex) => ({ rowIndex, consentCaptured: true })),
      });
      setMessage(`Saved ${res.savedCount} contact(s).`);
      setPreview(null);
      setSelected(new Set());
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSearch(value: string) {
    setQuery(value);
    try {
      await load(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  }

  return (
    <AppShell
      title="Contacts"
      subtitle="Upload CSV/XLSX contact lists or PDF scripts. Preview and confirm before anything is saved."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <h2 className="mb-4 text-sm tracking-wide text-[var(--muted)] uppercase">Upload</h2>
          <Field label="PDF, CSV, or XLSX">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              disabled={busy}
              onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
            />
          </Field>
          {preview ? (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge>{preview.sourceKind}</Badge>
                <Badge tone="ok">{preview.summary.valid} valid</Badge>
                <Badge tone="warn">{preview.summary.invalid} invalid</Badge>
                <Badge>{preview.summary.duplicates} duplicates</Badge>
              </div>
              {preview.scriptText ? (
                <details className="rounded-xl border border-[var(--line)] p-3 text-sm">
                  <summary className="cursor-pointer text-[var(--muted)]">
                    Extracted PDF script/context
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-[var(--muted)]">
                    {preview.scriptText.slice(0, 4000)}
                  </pre>
                </details>
              ) : null}
              <PreviewTable
                rows={preview.rows}
                selected={selected}
                onToggle={(rowIndex, on) => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (on) next.add(rowIndex);
                    else next.delete(rowIndex);
                    return next;
                  });
                }}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={busy || validSelected.length === 0}
                  onClick={() => void onConfirm()}
                >
                  Confirm & save {validSelected.length} valid
                </Button>
                <Button variant="ghost" onClick={() => setPreview(null)}>
                  Discard preview
                </Button>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Nothing is persisted until you confirm. Invalid and duplicate rows stay out unless
                corrected.
              </p>
            </div>
          ) : null}
        </Panel>

        <Panel>
          <div className="mb-4 flex items-end gap-3">
            <Field label="Search">
              <Input
                value={query}
                placeholder="Name, phone, email…"
                onChange={(e) => void onSearch(e.target.value)}
              />
            </Field>
          </div>
          {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}
          {message ? <p className="mb-3 text-sm text-[var(--ok)]">{message}</p> : null}
          <ul className="space-y-3">
            {contacts.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">No contacts saved yet.</li>
            ) : (
              contacts.map((c) => (
                <li key={c.id} className="rounded-xl border border-[var(--line)] px-3 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-[var(--muted)]">{c.phoneE164}</p>
                      {c.email ? <p className="text-[var(--muted)]">{c.email}</p> : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {c.consentCaptured ? (
                        <Badge tone="ok">consent</Badge>
                      ) : (
                        <Badge tone="warn">no consent</Badge>
                      )}
                      {c.suppressed ? <Badge tone="warn">suppressed</Badge> : null}
                    </div>
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

function PreviewTable({
  rows,
  selected,
  onToggle,
}: {
  rows: PreviewRow[];
  selected: Set<number>;
  onToggle: (rowIndex: number, on: boolean) => void;
}) {
  return (
    <div className="max-h-80 overflow-auto rounded-xl border border-[var(--line)]">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-[var(--bg-elevated)] text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2">Save</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Phone</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowIndex} className="border-t border-[var(--line)]">
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  disabled={!row.valid}
                  checked={selected.has(row.rowIndex)}
                  onChange={(e) => onToggle(row.rowIndex, e.target.checked)}
                />
              </td>
              <td className="px-3 py-2">{row.name || '—'}</td>
              <td className="px-3 py-2">{row.phoneE164 || row.phoneRaw || '—'}</td>
              <td className="px-3 py-2">
                {row.valid ? (
                  <span className="text-[var(--ok)]">valid</span>
                ) : (
                  <span className="text-[var(--warn)]">{row.errors.join('; ')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
