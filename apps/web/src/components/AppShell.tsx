import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/calls', label: 'Calls' },
  { href: '/settings', label: 'Settings' },
];

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Voicyy
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--ink)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-2xl text-[var(--muted)]">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
