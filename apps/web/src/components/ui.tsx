import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)]/80 p-5 backdrop-blur ${className}`}
    >
      {children}
    </section>
  );
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles =
    variant === 'primary'
      ? 'bg-[var(--accent)] text-[#041018] hover:brightness-110'
      : variant === 'danger'
        ? 'bg-red-500/20 text-red-200 hover:bg-red-500/30'
        : 'bg-white/5 text-[var(--ink)] hover:bg-white/10';
  return (
    <button
      className={`rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      {...props}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      {...props}
    />
  );
}

export function Badge({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'ok' | 'warn' | 'accent';
}) {
  const color =
    tone === 'ok'
      ? 'text-[var(--ok)] border-[var(--ok)]/30'
      : tone === 'warn'
        ? 'text-[var(--warn)] border-[var(--warn)]/30'
        : tone === 'accent'
          ? 'text-[var(--accent)] border-[var(--accent)]/30'
          : 'text-[var(--muted)] border-[var(--line)]';
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${color}`}>
      {children}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
