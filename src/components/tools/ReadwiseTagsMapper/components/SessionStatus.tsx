import type { AuthStatus } from "./types";

interface SessionStatusProps {
  authStatus: AuthStatus;
}

export function SessionStatus({ authStatus }: SessionStatusProps) {
  const statusClass =
    authStatus === "authenticated"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
      : authStatus === "missing"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200"
        : "border-border bg-muted text-muted-foreground dark:border-neutral-800";

  const statusText =
    authStatus === "authenticated"
      ? "Token active"
      : authStatus === "missing"
        ? "Token required"
        : "Status unknown";

  return (
    <section className="tool-panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-sm font-semibold text-foreground dark:border-neutral-800 dark:bg-neutral-950">
          RW
        </div>
        <div className="min-w-0">
          <span className="tool-label">Session status</span>
          <p className="text-sm leading-5 text-gray-700 dark:text-gray-300">
            Manage your Readwise token and workspace preferences.
          </p>
        </div>
      </div>
      <span
        className={`inline-flex w-fit items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${statusClass}`}
      >
        <span className="flex h-1.5 w-1.5 rounded-md bg-current" />
        {statusText}
      </span>
    </section>
  );
}
