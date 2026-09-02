import { useRef } from "react";
import { createPortal } from "react-dom";
import type { Stretch } from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";
import { useModalDialog } from "@/utils/useModalDialog";
import { StretchDetails } from "./StretchDetails";

interface StretchPreviewDialogProps {
  index: number;
  onClose: () => void;
  stretch: Stretch;
  total: number;
}

export function StretchPreviewDialog({
  index,
  onClose,
  stretch,
  total,
}: StretchPreviewDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = `stretch-preview-title-${stretch.id}`;
  const descriptionId = `stretch-preview-description-${stretch.id}`;

  useModalDialog({
    dialogRef,
    initialFocusSelector: "[data-dialog-initial-focus]",
    isOpen: true,
    onClose,
  });

  return createPortal(
    <div data-modal-root="stretch-preview">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/45"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <section
          ref={dialogRef}
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          aria-modal="true"
          className="stretching-sheet pointer-events-auto relative flex max-h-[92dvh] w-full flex-col rounded-b-none p-5 focus:outline-none sm:max-w-2xl sm:rounded-xl sm:p-6"
          role="dialog"
          tabIndex={-1}
        >
          <header className="mb-4 flex shrink-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Stretch {index + 1} of {total}
              </p>
              <h2
                id={titleId}
                className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
              >
                {stretch.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{formatTime(stretch.duration)} each</span>
                {(stretch.repetitions || 1) > 1 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      {stretch.repetitions === 2
                        ? "Left side · Right side"
                        : `${stretch.repetitions} rounds`}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close stretch preview"
              data-dialog-initial-focus
              className="min-h-11 min-w-11 shrink-0 rounded-full text-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <div className="min-h-0 overflow-y-auto pr-1">
            <p
              id={descriptionId}
              className="mb-4 text-sm leading-relaxed text-muted-foreground"
            >
              {stretch.description}
            </p>
            <StretchDetails stretch={stretch} />
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
