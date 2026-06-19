import type { StatusMessage } from "./types";

interface StatusToastProps {
  message: StatusMessage;
  onDismiss: () => void;
}

export function StatusToast({ message, onDismiss }: StatusToastProps) {
  const toneClass =
    message.tone === "success"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200"
      : message.tone === "error"
        ? "border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200"
        : "border-indigo-100 bg-indigo-50 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-200";

  const dotClass =
    message.tone === "success"
      ? "bg-emerald-500"
      : message.tone === "error"
        ? "bg-rose-500"
        : "bg-indigo-500";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center px-4">
      <div
        role={message.tone === "error" ? "alert" : "status"}
        className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border px-5 py-4 text-sm backdrop-blur-sm transition-colors lg:text-base ${toneClass}`}
      >
        <span
          className={`mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-md ${dotClass}`}
        />
        <span className="flex-1 leading-snug">{message.text}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-xs font-semibold text-current transition-colors hover:border-current hover:bg-white/20 dark:hover:bg-white/10"
        >
          <span className="sr-only">Dismiss message</span>x
        </button>
      </div>
    </div>
  );
}
