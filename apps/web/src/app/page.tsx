import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Badge, Panel } from '@/components/ui';
import { getPublicApiUrl, voiceApi } from '@/lib/api';

export default async function DashboardPage() {
  let stats = null;
  let error: string | null = null;
  try {
    const res = await voiceApi.stats();
    stats = res.stats;
  } catch {
    error = `API not reachable at ${getPublicApiUrl()}. Run npm run dev:api.`;
  }

  return (
    <AppShell
      title="Dashboard"
      subtitle="Campaign and call overview. Live dialing stays off until providers and consent controls are verified."
    >
      {error ? (
        <Panel>
          <p className="text-[var(--warn)]">{error}</p>
        </Panel>
      ) : stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Contacts" value={stats.contacts} href="/contacts" />
            <Stat label="Campaigns" value={stats.campaigns} href="/campaigns" />
            <Stat label="Approved" value={stats.campaignsApproved} href="/campaigns" />
            <Stat label="Calls" value={stats.callsTotal} href="/calls" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Panel>
              <h2 className="mb-3 text-sm tracking-wide text-[var(--muted)] uppercase">
                Call status
              </h2>
              {Object.keys(stats.callsByStatus).length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  No calls yet. Approve a campaign and queue stubs.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {Object.entries(stats.callsByStatus).map(([status, count]) => (
                    <li
                      key={status}
                      className="flex justify-between border-b border-[var(--line)] py-2"
                    >
                      <span>{status}</span>
                      <span>{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel>
              <h2 className="mb-3 text-sm tracking-wide text-[var(--muted)] uppercase">Safety</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Live calling</span>
                  <Badge tone={stats.liveCallingAllowed ? 'warn' : 'ok'}>
                    {stats.liveCallingAllowed ? 'Allowed' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Suppressed contacts</span>
                  <span>{stats.suppressedContacts}</span>
                </div>
                <p className="text-[var(--muted)]">
                  Uploaded scripts and documents cannot override opt-out, spend limits, or
                  permissions.
                </p>
              </div>
            </Panel>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <Panel className="transition hover:border-[var(--accent)]/40">
        <p className="text-sm text-[var(--muted)]">{label}</p>
        <p className="mt-2 text-3xl font-semibold">{value}</p>
      </Panel>
    </Link>
  );
}
