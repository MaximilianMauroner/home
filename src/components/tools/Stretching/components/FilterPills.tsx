import { useCallback, useEffect, useId, useRef, useState } from "react";
import type {
  RoutineCategoryFilter,
  RoutineDifficultyFilter,
} from "../routineDiscovery";
import {
  ROUTINE_CATEGORIES,
  ROUTINE_DIFFICULTIES,
} from "../routineDiscovery";

interface FilterPillsProps {
  activeFilterCount: number;
  onCategoryChange: (category: RoutineCategoryFilter) => void;
  onDifficultyChange: (difficulty: RoutineDifficultyFilter) => void;
  onReset: () => void;
  resultCount: number;
  selectedCategory: RoutineCategoryFilter;
  selectedDifficulty: RoutineDifficultyFilter;
}

const pillClass = (selected: boolean) =>
  `shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
  }`;

export function FilterPills({
  selectedCategory,
  selectedDifficulty,
  activeFilterCount,
  resultCount,
  onCategoryChange,
  onDifficultyChange,
  onReset,
}: FilterPillsProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeSheet = useCallback(() => {
    setIsSheetOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isSheetOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSheet();

      if (event.key === "Tab") {
        const controls = sheetRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled])",
        );
        const firstControl = controls?.[0];
        const lastControl = controls
          ? controls[controls.length - 1]
          : undefined;

        if (event.shiftKey && document.activeElement === firstControl) {
          event.preventDefault();
          lastControl?.focus();
        } else if (!event.shiftKey && document.activeElement === lastControl) {
          event.preventDefault();
          firstControl?.focus();
        }
      }
    };
    closeButtonRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSheet, isSheetOpen]);

  return (
    <div className="space-y-3">
      <div
        className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:hidden"
        role="group"
        aria-label="Routine category"
      >
        {ROUTINE_CATEGORIES.map((category) => (
          <button
            type="button"
            key={category.value}
            onClick={() => onCategoryChange(category.value)}
            aria-pressed={selectedCategory === category.value}
            className={`${pillClass(selectedCategory === category.value)} snap-start`}
          >
            {category.label}
          </button>
        ))}
      </div>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsSheetOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isSheetOpen}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 text-left sm:hidden"
      >
        <span className="font-medium text-foreground">
          Difficulty
          {selectedDifficulty !== "all" && (
            <span className="font-normal text-muted-foreground"> · {selectedDifficulty}</span>
          )}
        </span>
        <span className="text-sm text-muted-foreground">
          {activeFilterCount} active · {resultCount} results
        </span>
      </button>

      <div className="hidden space-y-3 sm:block">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Routine category">
          {ROUTINE_CATEGORIES.map((category) => (
            <button
              type="button"
              key={category.value}
              onClick={() => onCategoryChange(category.value)}
              aria-pressed={selectedCategory === category.value}
              className={pillClass(selectedCategory === category.value)}
            >
              {category.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Difficulty level">
          {ROUTINE_DIFFICULTIES.map((difficulty) => (
            <button
              type="button"
              key={difficulty.value}
              onClick={() => onDifficultyChange(difficulty.value)}
              aria-pressed={selectedDifficulty === difficulty.value}
              className={pillClass(selectedDifficulty === difficulty.value)}
            >
              {difficulty.label}
            </button>
          ))}
          <span className="ml-auto text-sm text-muted-foreground" aria-live="polite">
            {resultCount} {resultCount === 1 ? "routine" : "routines"}
          </span>
        </div>
      </div>

      {isSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:hidden">
          <button
            type="button"
            aria-label="Close difficulty filters"
            className="absolute inset-0 h-full w-full bg-foreground/30 backdrop-blur-[1px]"
            onClick={closeSheet}
          />
          <section
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="stretching-sheet relative z-10 w-full rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id={titleId} className="text-lg font-semibold text-foreground">Difficulty</h3>
                <p className="text-sm text-muted-foreground">
                  {resultCount} {resultCount === 1 ? "routine matches" : "routines match"}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeSheet}
                aria-label="Close difficulty filters"
                className="grid h-11 w-11 place-items-center rounded-full hover:bg-muted"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-5 grid gap-2" role="group" aria-label="Difficulty level">
              {ROUTINE_DIFFICULTIES.map((difficulty) => (
                <button
                  type="button"
                  key={difficulty.value}
                  onClick={() => onDifficultyChange(difficulty.value)}
                  aria-pressed={selectedDifficulty === difficulty.value}
                  className="flex min-h-11 items-center justify-between rounded-xl border border-border px-4 py-3 text-left font-medium text-foreground hover:bg-muted"
                >
                  {difficulty.label}
                  {selectedDifficulty === difficulty.value && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={onReset} className="tool-button-secondary !min-h-11">
                Reset all
              </button>
              <button type="button" onClick={closeSheet} className="tool-button !min-h-11">
                Show {resultCount}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
