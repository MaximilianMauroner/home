import { useState, useEffect, useRef, useCallback } from "react";
import type { Stretch, StretchRoutine } from "./types";
import {
  DEFAULT_ROUTINES,
  STORAGE_KEY,
  ROUTINE_SELECTOR_KEY,
  TIME_BETWEEN_KEY,
  CUSTOM_ROUTINES_KEY,
} from "./constants";
import { playTickSound, playEndSound } from "./utils";
import { StretchDetails } from "./components/StretchDetails";
import { RestPeriodScreen } from "./components/RestPeriodScreen";
import { TimeBetweenSettings } from "./components/TimeBetweenSettings";
import { ControlPanel } from "./components/ControlPanel";
import { ContentManager } from "./components/ContentManager";
import { QuickStart } from "./components/QuickStart";
import { RoutineBrowser } from "./components/RoutineBrowser";
import { StretchPreview } from "./components/StretchPreview";
import { StretchingShell } from "./components/StretchingShell";
import {
  parseStretchingNavigation,
  serializeStretchingNavigation,
  type StretchingNavigationState,
  type StretchingView,
} from "./navigation";
import {
  parseStoredCustomRoutines,
  parseStoredRestDuration,
  parseStoredStretches,
} from "./persistence";
import {
  calculateSessionProgress,
  calculateSessionTimeRemaining,
  calculateStepsRemaining,
  getNextSessionPosition,
  getPreviousSessionPosition,
  type SessionPosition,
} from "./sessionState";

const DEFAULT_ROUTINE_ID = DEFAULT_ROUTINES[0]?.id || "routine_1";

function getRoutineStretches(
  routineId: string,
  customRoutines: StretchRoutine[],
): Stretch[] {
  const routine =
    customRoutines.find((candidate) => candidate.id === routineId) ??
    DEFAULT_ROUTINES.find((candidate) => candidate.id === routineId) ??
    DEFAULT_ROUTINES[0];

  return (
    routine?.stretches.map((stretch, index) => ({
      ...stretch,
      id: `${routine.id}_${stretch.id || index + 1}`,
    })) ?? []
  );
}

function replaceNavigation(navigation: StretchingNavigationState) {
  const url = new URL(window.location.href);
  url.search = serializeStretchingNavigation(url.search, navigation);
  window.history.replaceState({}, "", url.toString());
}

export default function Stretching() {
  const [viewState, setViewStateInternal] =
    useState<StretchingView>("quickstart");
  const [previewRoutineId, setPreviewRoutineId] = useState<string | null>(null);
  const [hasRestored, setHasRestored] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] =
    useState(DEFAULT_ROUTINE_ID);
  const [stretches, setStretches] = useState<Stretch[]>(() =>
    getRoutineStretches(DEFAULT_ROUTINE_ID, []),
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRepetition, setCurrentRepetition] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(
    stretches[0]?.duration || 60,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [timeBetween, setTimeBetween] = useState(10);
  const [showTimeBetweenSettings, setShowTimeBetweenSettings] = useState(false);
  const [customRoutines, setCustomRoutines] = useState<StretchRoutine[]>([]);

  const availableRoutineIdsRef = useRef<ReadonlySet<string>>(
    new Set(DEFAULT_ROUTINES.map((routine) => routine.id)),
  );
  availableRoutineIdsRef.current = new Set(
    [...DEFAULT_ROUTINES, ...customRoutines].map((routine) => routine.id),
  );

  // Wrapper to update both state and URL
  const setViewState = useCallback(
    (view: StretchingView, routineId?: string | null) => {
      const navigation: StretchingNavigationState =
        view === "preview" && routineId
          ? { view, routineId }
          : { view: view === "preview" ? "browser" : view, routineId: null };

      setViewStateInternal(navigation.view);
      setPreviewRoutineId(navigation.routineId);
      replaceNavigation(navigation);
    },
    [],
  );

  // Sync with URL on popstate (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const { view, routineId } = parseStretchingNavigation(
        window.location.search,
        availableRoutineIdsRef.current,
      );
      setViewStateInternal(view);
      setPreviewRoutineId(routineId);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const loadRoutineStretches = (routineId: string): Stretch[] => {
    return getRoutineStretches(routineId, customRoutines);
  };

  useEffect(() => {
    if (!hasRestored) return;
    localStorage.setItem(CUSTOM_ROUTINES_KEY, JSON.stringify(customRoutines));
  }, [customRoutines, hasRestored]);

  const [nextStretchIndex, setNextStretchIndex] = useState<number | null>(null);
  const [nextRepetition, setNextRepetition] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);
  const isRestingRef = useRef(false);
  const previousIndexRef = useRef<number>(0);
  const previousRepetitionRef = useRef<number>(1);
  const hasPlayedStartSoundRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const timeRemainingRef = useRef(timeRemaining);
  const nextStretchIndexRef = useRef<number | null>(null);
  const nextRepetitionRef = useRef<number | null>(null);

  useEffect(() => {
    const restoredCustomRoutines = parseStoredCustomRoutines(
      localStorage.getItem(CUSTOM_ROUTINES_KEY),
    );
    const restoredRoutines = [...DEFAULT_ROUTINES, ...restoredCustomRoutines];
    const storedRoutineId = localStorage.getItem(ROUTINE_SELECTOR_KEY);
    const restoredRoutineId = restoredRoutines.some(
      (routine) => routine.id === storedRoutineId,
    )
      ? (storedRoutineId ?? DEFAULT_ROUTINE_ID)
      : DEFAULT_ROUTINE_ID;
    const restoredStretches =
      parseStoredStretches(localStorage.getItem(STORAGE_KEY)) ??
      getRoutineStretches(restoredRoutineId, restoredCustomRoutines);
    const navigation = parseStretchingNavigation(
      window.location.search,
      new Set(restoredRoutines.map((routine) => routine.id)),
    );

    setCustomRoutines(restoredCustomRoutines);
    setSelectedRoutineId(restoredRoutineId);
    setStretches(restoredStretches);
    setTimeBetween(
      parseStoredRestDuration(localStorage.getItem(TIME_BETWEEN_KEY)),
    );
    setTimeRemaining(restoredStretches[0]?.duration || 60);
    setViewStateInternal(navigation.view);
    setPreviewRoutineId(navigation.routineId);
    replaceNavigation(navigation);
    setHasRestored(true);
  }, []);

  useEffect(() => {
    const isFocusView =
      viewState === "active" || viewState === "content-manager";
    const body = document.body;

    body.classList.toggle("stretching-focus-mode", isFocusView);
    if (isFocusView) {
      body.dataset.stretchingFocus = "true";
    } else {
      delete body.dataset.stretchingFocus;
    }

    return () => {
      body.classList.remove("stretching-focus-mode");
      delete body.dataset.stretchingFocus;
    };
  }, [viewState]);

  useEffect(() => {
    if (!hasRestored) return;
    localStorage.setItem(ROUTINE_SELECTOR_KEY, selectedRoutineId);
  }, [hasRestored, selectedRoutineId]);

  const loadRoutine = (routineId: string) => {
    const newStretches = loadRoutineStretches(routineId);
    setStretches(newStretches);
    setSelectedRoutineId(routineId);
    setCurrentIndex(0);
    setCurrentRepetition(1);
    setIsRunning(false);
    setIsPaused(false);
    setIsResting(false);
    setIsCompleted(false);
    setNextStretchIndex(null);
    setNextRepetition(null);
    nextStretchIndexRef.current = null;
    nextRepetitionRef.current = null;
    if (newStretches[0]) {
      setTimeRemaining(newStretches[0].duration);
    }
  };

  useEffect(() => {
    if (hasRestored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stretches));
    }
  }, [hasRestored, stretches]);

  useEffect(() => {
    if (!hasRestored) return;
    localStorage.setItem(TIME_BETWEEN_KEY, timeBetween.toString());
  }, [hasRestored, timeBetween]);

  useEffect(() => {
    isRunningRef.current = isRunning;
    isPausedRef.current = isPaused;
    isRestingRef.current = isResting;
    timeRemainingRef.current = timeRemaining;
  }, [isRunning, isPaused, isResting, timeRemaining]);

  useEffect(() => {
    if (stretches[currentIndex]) {
      setTimeRemaining(stretches[currentIndex].duration);
      if (
        isRunning &&
        !isPaused &&
        (currentIndex !== previousIndexRef.current ||
          currentRepetition !== previousRepetitionRef.current)
      ) {
        playTickSound();
      }
      previousIndexRef.current = currentIndex;
      previousRepetitionRef.current = currentRepetition;
    }
  }, [currentIndex, currentRepetition, stretches]);

  useEffect(() => {
    if (isRunning && !isPaused && !hasPlayedStartSoundRef.current) {
      playTickSound();
      hasPlayedStartSoundRef.current = true;
      startTimeRef.current = Date.now();
    }
    if (!isRunning || isPaused) {
      hasPlayedStartSoundRef.current = false;
      if (!isRunning) {
        startTimeRef.current = null;
      }
    }
  }, [isRunning, isPaused]);

  const clearRestDestination = () => {
    setNextStretchIndex(null);
    setNextRepetition(null);
    nextStretchIndexRef.current = null;
    nextRepetitionRef.current = null;
  };

  const moveToPosition = (position: SessionPosition) => {
    setCurrentIndex(position.index);
    setCurrentRepetition(position.repetition);
    setTimeRemaining(stretches[position.index]?.duration ?? 0);
  };

  const completeRoutine = () => {
    setIsRunning(false);
    setIsPaused(false);
    setIsResting(false);
    setIsCompleted(true);
    setTimeRemaining(0);
    clearRestDestination();
  };

  const movePastCurrent = (withRest: boolean) => {
    const destination = getNextSessionPosition(stretches, {
      index: currentIndex,
      repetition: currentRepetition,
    });

    if (!destination) {
      completeRoutine();
      return;
    }

    if (withRest && timeBetween > 0) {
      setIsResting(true);
      setTimeRemaining(timeBetween);
      setNextStretchIndex(destination.index);
      setNextRepetition(destination.repetition);
      nextStretchIndexRef.current = destination.index;
      nextRepetitionRef.current = destination.repetition;
      return;
    }

    moveToPosition(destination);
  };

  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        if (!isRunningRef.current || isPausedRef.current) return;

        const remaining = timeRemainingRef.current;
        if (isRestingRef.current) {
          if (remaining <= 1) {
            const nextIndex = nextStretchIndexRef.current;
            const nextRep = nextRepetitionRef.current;
            setTimeRemaining(0);
            setIsResting(false);

            if (nextIndex !== null && nextRep !== null) {
              moveToPosition({ index: nextIndex, repetition: nextRep });
              clearRestDestination();
            }
          } else {
            setTimeRemaining(remaining - 1);
          }
          return;
        }

        if (remaining <= 1) {
          setTimeRemaining(0);
          playEndSound();
          movePastCurrent(true);
        } else {
          setTimeRemaining(remaining - 1);
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    currentIndex,
    currentRepetition,
    isRunning,
    isPaused,
    isResting,
    stretches,
    timeBetween,
  ]);

  const start = () => {
    if (isCompleted) return;
    setIsRunning(true);
    setIsPaused(false);
    if (currentIndex === 0 && timeRemaining === stretches[0]?.duration) {
      setCurrentRepetition(1);
      startTimeRef.current = Date.now();
    }
  };

  const pause = () => {
    setIsPaused(true);
  };

  const resume = () => {
    setIsPaused(false);
  };

  const reset = () => {
    setIsRunning(false);
    setIsPaused(false);
    setIsResting(false);
    setIsCompleted(false);
    setCurrentIndex(0);
    setCurrentRepetition(1);
    startTimeRef.current = null;
    clearRestDestination();
    if (stretches[0]) {
      setTimeRemaining(stretches[0].duration);
    }
  };

  const next = () => {
    if (isResting) {
      setIsResting(false);
      const nextIndex = nextStretchIndexRef.current;
      const nextRep = nextRepetitionRef.current;

      if (nextIndex !== null && nextRep !== null) {
        moveToPosition({ index: nextIndex, repetition: nextRep });
        clearRestDestination();
      }
      return;
    }
    movePastCurrent(false);
  };

  const previous = () => {
    const destination = getPreviousSessionPosition(stretches, {
      index: currentIndex,
      repetition: currentRepetition,
    });
    if (destination) moveToPosition(destination);
  };

  const jumpToStretch = (index: number) => {
    if (isPaused && index >= 0 && index < stretches.length) {
      setCurrentIndex(index);
      setCurrentRepetition(1);
      setTimeRemaining(stretches[index].duration);
    }
  };

  const addStretch = (stretch: Omit<Stretch, "id">) => {
    const newStretch: Stretch = {
      ...stretch,
      id: Date.now().toString(),
    };
    setStretches([...stretches, newStretch]);
  };

  const updateStretch = (id: string, stretch: Omit<Stretch, "id">) => {
    setStretches(
      stretches.map((s) => (s.id === id ? { ...stretch, id: s.id } : s)),
    );
  };

  const deleteStretch = (id: string) => {
    const newStretches = stretches.filter((s) => s.id !== id);
    setStretches(newStretches);
    if (currentIndex >= newStretches.length && newStretches.length > 0) {
      setCurrentIndex(newStretches.length - 1);
    } else if (newStretches.length === 0) {
      setCurrentIndex(0);
      setTimeRemaining(0);
    }
  };

  const moveStretch = (fromIndex: number, toIndex: number) => {
    const newStretches = [...stretches];
    const [moved] = newStretches.splice(fromIndex, 1);
    newStretches.splice(toIndex, 0, moved);
    setStretches(newStretches);
    if (currentIndex === fromIndex) {
      setCurrentIndex(toIndex);
    } else if (currentIndex === toIndex && fromIndex > toIndex) {
      setCurrentIndex(currentIndex + 1);
    } else if (currentIndex === toIndex && fromIndex < toIndex) {
      setCurrentIndex(currentIndex - 1);
    } else if (currentIndex > fromIndex && currentIndex <= toIndex) {
      setCurrentIndex(currentIndex - 1);
    } else if (currentIndex < fromIndex && currentIndex >= toIndex) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const saveRoutine = (routine: StretchRoutine) => {
    setCustomRoutines([...customRoutines, routine]);
  };

  const updateRoutine = (id: string, routine: Omit<StretchRoutine, "id">) => {
    setCustomRoutines(
      customRoutines.map((r) => (r.id === id ? { ...r, ...routine } : r)),
    );
  };

  const deleteRoutine = (id: string) => {
    setCustomRoutines(customRoutines.filter((r) => r.id !== id));
    if (selectedRoutineId === id) {
      loadRoutine(DEFAULT_ROUTINES[0]?.id || "routine_1");
    }
  };

  const loadRoutineStretchesForEditing = (routine: StretchRoutine) => {
    const routineStretches = routine.stretches.map((s, idx) => ({
      ...s,
      id: `${routine.id}_${s.id || idx + 1}`,
    }));
    setStretches(routineStretches);
    setSelectedRoutineId(routine.id);
  };

  const resetToDefault = (routineId: string) => {
    const routineStretches = loadRoutineStretches(routineId);
    setStretches(routineStretches);
    setCurrentIndex(0);
    setCurrentRepetition(1);
    setIsCompleted(false);
    setTimeRemaining(routineStretches[0]?.duration || 60);
  };

  const currentStretch = stretches[currentIndex];
  const sessionTimingState = {
    index: currentIndex,
    repetition: currentRepetition,
    timeRemaining,
    isResting,
    isCompleted,
    nextPosition:
      nextStretchIndex !== null && nextRepetition !== null
        ? { index: nextStretchIndex, repetition: nextRepetition }
        : null,
  };
  const progress = calculateSessionProgress(stretches, sessionTimingState);
  const timeRemainingTotal = calculateSessionTimeRemaining(
    stretches,
    sessionTimingState,
    timeBetween,
  );
  const stepsRemaining = calculateStepsRemaining(stretches, sessionTimingState);

  const allRoutines = [...DEFAULT_ROUTINES, ...customRoutines];
  const currentRoutine = allRoutines.find((r) => r.id === selectedRoutineId);

  // Get preview routine from ID
  const previewRoutine = previewRoutineId
    ? allRoutines.find((r) => r.id === previewRoutineId)
    : null;

  // Handler functions for view navigation
  const handleSelectRoutineFromQuickStart = (routineId: string) => {
    setViewState("preview", routineId);
  };

  const handleSelectRoutineFromBrowser = (routineId: string) => {
    setViewState("preview", routineId);
  };

  const handleBeginRoutine = () => {
    if (previewRoutineId) {
      loadRoutine(previewRoutineId);
      setViewState("active");
    }
  };

  const handleBackToQuickStart = () => {
    setIsRunning(false);
    setIsPaused(false);
    setViewState("quickstart");
  };

  // Featured routines for quick start (therapeutic + popular)
  const featuredRoutines = [
    ...DEFAULT_ROUTINES.filter((r) => r.category === "pain-relief").slice(0, 1),
    ...DEFAULT_ROUTINES.filter(
      (r) => r.category === "posture-correction",
    ).slice(0, 1),
    ...DEFAULT_ROUTINES.filter((r) => r.category === "mobility").slice(0, 1),
  ];

  // Get recent routine from localStorage
  const recentRoutine = currentRoutine;
  const phaseAnnouncement = isCompleted
    ? "Routine complete."
    : isResting
      ? `Rest period. ${nextStretchIndex !== null ? (stretches[nextStretchIndex]?.name ?? "Next stretch") : "Next stretch"} is up next.`
      : isPaused
        ? `Paused on ${currentStretch?.name ?? "the current stretch"}.`
        : isRunning
          ? `${currentStretch?.name ?? "Stretch"} started, repetition ${currentRepetition}.`
          : `Ready for ${currentStretch?.name ?? "the routine"}.`;

  const restart = () => {
    reset();
    setIsRunning(true);
  };

  return (
    <div
      className="stretching-app min-h-screen"
      data-stretching-view={viewState}
    >
      {/* QuickStart View */}
      {viewState === "quickstart" && (
        <StretchingShell variant="discovery">
          <QuickStart
            featuredRoutines={featuredRoutines}
            recentRoutine={recentRoutine}
            onSelectRoutine={handleSelectRoutineFromQuickStart}
            onBrowseAll={() => setViewState("browser")}
          />
        </StretchingShell>
      )}

      {/* Routine Browser */}
      {viewState === "browser" && (
        <StretchingShell variant="wide">
          <RoutineBrowser
            routines={DEFAULT_ROUTINES}
            customRoutines={customRoutines}
            selectedRoutineId={selectedRoutineId}
            onSelectRoutine={handleSelectRoutineFromBrowser}
            onEditRoutine={(routine) => {
              loadRoutineStretchesForEditing(routine);
              setViewState("content-manager");
            }}
            onDeleteRoutine={deleteRoutine}
            onCreateRoutine={() => setViewState("content-manager")}
            onClose={() => setViewState("quickstart")}
          />
        </StretchingShell>
      )}

      {/* Stretch Preview */}
      {viewState === "preview" && previewRoutine && (
        <StretchingShell variant="wide">
          <StretchPreview
            routine={previewRoutine}
            onBegin={handleBeginRoutine}
            onBack={() => setViewState("browser")}
          />
        </StretchingShell>
      )}

      {/* Content Manager */}
      {viewState === "content-manager" && (
        <StretchingShell variant="focus">
          <ContentManager
            defaultRoutines={DEFAULT_ROUTINES}
            customRoutines={customRoutines}
            selectedRoutineId={selectedRoutineId}
            currentStretches={stretches}
            onAddStretch={addStretch}
            onUpdateStretch={updateStretch}
            onDeleteStretch={deleteStretch}
            onMoveStretch={moveStretch}
            onSelectRoutine={(id) => {
              loadRoutine(id);
              setViewState("active");
            }}
            onLoadRoutineStretches={loadRoutineStretchesForEditing}
            onSaveRoutine={saveRoutine}
            onUpdateRoutine={updateRoutine}
            onDeleteRoutine={deleteRoutine}
            onResetToDefault={resetToDefault}
            onClose={() => setViewState("quickstart")}
          />
        </StretchingShell>
      )}

      {/* Active Stretching View */}
      {viewState === "active" && (
        <StretchingShell variant="focus" className="space-y-3 sm:space-y-5">
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {phaseAnnouncement}
          </p>
          <header className="flex min-h-[44px] items-center gap-3">
            <button
              type="button"
              onClick={handleBackToQuickStart}
              aria-label="Back to stretching overview"
              className="rounded-full bg-card p-2 shadow-sm transition-colors hover:bg-muted"
            >
              <svg
                className="h-5 w-5 text-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-foreground sm:text-lg">
                {currentRoutine?.name}
              </h2>
              <p className="hidden truncate text-sm text-muted-foreground sm:block">
                {currentRoutine?.goal}
              </p>
            </div>
            <details className="group relative">
              <summary
                className="flex min-h-[44px] min-w-[44px] cursor-pointer list-none items-center justify-center rounded-full text-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Routine menu"
              >
                <span aria-hidden="true">•••</span>
              </summary>
              <div className="stretching-popover absolute right-0 z-20 mt-2 w-52 space-y-1 p-2">
                <button
                  type="button"
                  onClick={() => setShowTimeBetweenSettings(true)}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-muted"
                >
                  Rest duration ({timeBetween}s)
                </button>
                <button
                  type="button"
                  onClick={() => setViewState("content-manager")}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-muted"
                >
                  Edit routine
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Reset routine
                </button>
              </div>
            </details>
          </header>

          {/* Time Between Settings */}
          {showTimeBetweenSettings && (
            <TimeBetweenSettings
              timeBetween={timeBetween}
              onApply={(value) => {
                setTimeBetween(value);
                setShowTimeBetweenSettings(false);
              }}
              onCancel={() => setShowTimeBetweenSettings(false)}
            />
          )}

          {isCompleted ? (
            <section className="mx-auto flex min-h-[65dvh] max-w-2xl flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-10">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-3xl text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              >
                ✓
              </div>
              <p className="mt-5 text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                Routine complete
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Nicely done.
              </h1>
              <p className="mt-3 max-w-md text-muted-foreground">
                You completed{" "}
                {currentRoutine?.name ?? "your stretching routine"}. Take a
                moment before moving on.
              </p>
              <div className="mt-8 grid w-full max-w-sm gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={restart}
                  className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Restart routine
                </button>
                <button
                  type="button"
                  onClick={handleBackToQuickStart}
                  className="rounded-xl bg-muted px-5 py-3 font-medium text-foreground transition-colors hover:bg-primary/10"
                >
                  Exit to overview
                </button>
              </div>
            </section>
          ) : isResting ? (
            <RestPeriodScreen
              timeRemaining={timeRemaining}
              isRunning={isRunning}
              isPaused={isPaused}
              nextStretchIndex={nextStretchIndex}
              nextRepetition={nextRepetition}
              stretches={stretches}
              totalDuration={timeBetween}
              onPause={pause}
              onResume={resume}
              onSkip={next}
            />
          ) : currentStretch ? (
            <>
              <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:items-stretch lg:gap-5">
                <StretchDetails stretch={currentStretch} section="image" />
                <ControlPanel
                  currentStretch={currentStretch}
                  currentIndex={currentIndex}
                  currentRepetition={currentRepetition}
                  stretchesLength={stretches.length}
                  timeRemaining={timeRemaining}
                  isRunning={isRunning}
                  isPaused={isPaused}
                  progress={progress}
                  timeRemainingTotal={timeRemainingTotal}
                  stepsRemaining={stepsRemaining}
                  timeBetween={timeBetween}
                  onTimeBetweenSettingsClick={() =>
                    setShowTimeBetweenSettings(true)
                  }
                  onStart={start}
                  onPause={pause}
                  onResume={resume}
                  onNext={next}
                  onPrevious={previous}
                  onReset={reset}
                  isResting={isResting}
                  stretches={stretches}
                  onJumpTo={jumpToStretch}
                />
              </div>
              <StretchDetails stretch={currentStretch} section="guidance" />
            </>
          ) : null}
        </StretchingShell>
      )}
    </div>
  );
}
