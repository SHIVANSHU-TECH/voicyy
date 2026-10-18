import { CALL_STATES } from '@voice/shared';
import { getPublicApiUrl } from '@/lib/api';

async function loadMeta() {
  try {
    const res = await fetch(`${getPublicApiUrl()}/api/v1/meta`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      phase: number;
      version: string;
      config: {
        liveCallingAllowed: boolean;
        queueDriver: string;
        providers: Record<string, string>;
      };
    };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const meta = await loadMeta();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm tracking-[0.2em] text-[var(--muted)] uppercase">Phase 1</p>
      <h1 className="mb-4 text-4xl font-semibold tracking-tight sm:text-5xl">Voice Agent</h1>
      <p className="mb-10 max-w-xl text-lg text-[var(--muted)]">
        Foundation for authorized outbound AI calling campaigns. Dashboard, ingestion, and live
        telephony arrive in later phases.
      </p>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)]/80 p-6 backdrop-blur">
        <h2 className="mb-4 text-sm font-medium tracking-wide text-[var(--muted)] uppercase">
          API status
        </h2>
        {meta ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--muted)]">Reachable</dt>
              <dd className="text-[var(--ok)]">
                Yes · v{meta.version} · phase {meta.phase}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Queue</dt>
              <dd>{meta.config.queueDriver}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Live calling</dt>
              <dd className={meta.config.liveCallingAllowed ? 'text-[var(--warn)]' : ''}>
                {meta.config.liveCallingAllowed ? 'Enabled' : 'Disabled (safe default)'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Telephony</dt>
              <dd>{meta.config.providers.telephony}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-[var(--warn)]">
            API not reachable at {getPublicApiUrl()}. Start it with{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5">npm run dev:api</code>.
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium tracking-wide text-[var(--muted)] uppercase">
          Call states (shared)
        </h2>
        <ul className="flex flex-wrap gap-2">
          {CALL_STATES.map((state) => (
            <li
              key={state}
              className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]"
            >
              {state}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
