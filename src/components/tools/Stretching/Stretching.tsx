import { useState, useEffect, useRef, useCallback } from "react";
import type { RoutineCategory, Stretch, StretchRoutine } from "./types";
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
import { DurationRail } from "./components/DurationRail";
import { buildRailSegments, describeRepetition } from "./rail";
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
  shouldAdvanceSession,
  type SessionPosition,
} from "./sessionState";
import {
  createRoutine,
  createStudioSessionStartState,
  deleteRoutineWithFallback,
  type RoutineStudioIntent,
  updateRoutineCollection,
} from "./studioHelpers";

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
  const [browserInitialCategory, setBrowserInitialCategory] = useState<
    RoutineCategory | undefined
  >(undefined);
  const [studioIntent, setStudioIntent] = useState<RoutineStudioIntent>({
    mode: "manage",
  });
  const [studioReturnView, setStudioReturnView] =
    useState<StretchingView>("quickstart");
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
  const [showRoutineMenu, setShowRoutineMenu] = useState(false);
  const [customRoutines, setCustomRoutines] = useState<StretchRoutine[]>([]);
  const routineMenuRef = useRef<HTMLDivElement | null>(null);

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
    if (!showRoutineMenu) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        routineMenuRef.current &&
        !routineMenuRef.current.contains(target)
      ) {
        setShowRoutineMenu(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [showRoutineMenu]);

  useEffect(() => {
    if (viewState !== "active" && isRunning && !isPaused) {
      setIsPaused(true);
    }
  }, [viewState, isRunning, isPaused]);

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
    setShowRoutineMenu(false);
    setShowTimeBetweenSettings(false);
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
    if (shouldAdvanceSession(viewState === "active", isRunning, isPaused)) {
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
    viewState,
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
    if (index < 0 || index >= stretches.length) return;

    setCurrentIndex(index);
    setCurrentRepetition(1);
    setTimeRemaining(stretches[index]?.duration ?? 0);
    setIsResting(false);
    setIsCompleted(false);
    clearRestDestination();
  };

  const saveRoutine = (routine: StretchRoutine) => {
    setCustomRoutines((current) => createRoutine(current, routine));
  };

  const updateRoutine = (id: string, routine: Omit<StretchRoutine, "id">) => {
    setCustomRoutines((current) =>
      updateRoutineCollection(current, id, routine),
    );
  };

  const deleteRoutine = (id: string) => {
    const result = deleteRoutineWithFallback(
      customRoutines,
      id,
      selectedRoutineId,
      DEFAULT_ROUTINE_ID,
    );
    setCustomRoutines(result.routines);
    if (result.selectedId !== selectedRoutineId) loadRoutine(result.selectedId);
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
  const railSegments = buildRailSegments(stretches, sessionTimingState);
  const timeRemainingTotal = calculateSessionTimeRemaining(
    stretches,
    sessionTimingState,
    timeBetween,
  );
  const stepsRemaining = calculateStepsRemaining(stretches, sessionTimingState);

  const allRoutines = [...DEFAULT_ROUTINES, ...customRoutines];
  const currentRoutine = allRoutines.find((r) => r.id === selectedRoutineId);
  const currentRepetitionLabel = currentStretch
    ? describeRepetition(currentRepetition, currentStretch.repetitions || 1)
    : null;

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

  const handleBrowseAll = (category?: RoutineCategory) => {
    setBrowserInitialCategory(category);
    setViewState("browser");
  };

  const openStudio = (
    returnView: StretchingView,
    intent: RoutineStudioIntent = { mode: "manage" },
  ) => {
    if (isRunning && !isPaused) setIsPaused(true);
    setShowRoutineMenu(false);
    setShowTimeBetweenSettings(false);
    setStudioReturnView(returnView);
    setStudioIntent(intent);
    setViewState("content-manager");
  };

  const startWorkingRoutine = (
    routineId: string,
    workingStretches: readonly Stretch[],
  ) => {
    const startState = createStudioSessionStartState(workingStretches);
    setSelectedRoutineId(routineId);
    setStretches(startState.stretches);
    setCurrentIndex(startState.currentIndex);
    setCurrentRepetition(startState.currentRepetition);
    setTimeRemaining(startState.timeRemaining);
    setIsRunning(startState.isRunning);
    setIsPaused(startState.isPaused);
    setIsResting(startState.isResting);
    setIsCompleted(startState.isCompleted);
    setNextStretchIndex(startState.nextStretchIndex);
    setNextRepetition(startState.nextRepetition);
    nextStretchIndexRef.current = startState.nextStretchIndex;
    nextRepetitionRef.current = startState.nextRepetition;
    startTimeRef.current = null;
    setViewState("active");
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
    setShowRoutineMenu(false);
    setShowTimeBetweenSettings(false);
    setViewState("quickstart");
  };

  // Keep the minimum routine visible in the first library view as the clear
  // starting point, then add a few routines from the main categories.
  const suggestedRoutine = DEFAULT_ROUTINES.find(
    (routine) => routine.id === "routine_10",
  );
  const featuredRoutines = [
    ...(suggestedRoutine ? [suggestedRoutine] : []),
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

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isEditable) return;

      if (event.key === "Escape") {
        if (showTimeBetweenSettings) {
          event.preventDefault();
          setShowTimeBetweenSettings(false);
          return;
        }
        if (showRoutineMenu) {
          event.preventDefault();
          setShowRoutineMenu(false);
          return;
        }
        if (viewState === "active") {
          event.preventDefault();
          handleBackToQuickStart();
        }
        return;
      }

      if (viewState !== "active" || isCompleted) return;

      if (
        event.key === " " ||
        event.key === "Space" ||
        event.key === "Spacebar" ||
        event.code === "Space"
      ) {
        event.preventDefault();
        if (!isRunning) start();
        else if (isPaused) resume();
        else pause();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        previous();
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        reset();
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [
    isCompleted,
    isPaused,
    isRunning,
    showRoutineMenu,
    showTimeBetweenSettings,
    viewState,
  ]);

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
            onBrowseAll={handleBrowseAll}
          />
        </StretchingShell>
      )}

      {/* Routine Browser */}
      {viewState === "browser" && (
        <StretchingShell variant="wide">
          <RoutineBrowser
            routines={DEFAULT_ROUTINES}
            customRoutines={customRoutines}
            initialCategory={browserInitialCategory}
            selectedRoutineId={selectedRoutineId}
            onSelectRoutine={handleSelectRoutineFromBrowser}
            onEditRoutine={(routine) => {
              openStudio("browser", { mode: "edit", routineId: routine.id });
            }}
            onDeleteRoutine={deleteRoutine}
            onCreateRoutine={() => openStudio("browser", { mode: "create" })}
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
            onStartRoutine={startWorkingRoutine}
            onSaveRoutine={saveRoutine}
            onUpdateRoutine={updateRoutine}
            onDeleteRoutine={deleteRoutine}
            onClose={() => setViewState(studioReturnView)}
            initialRoutineIntent={studioIntent}
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
            <div ref={routineMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowRoutineMenu((open) => !open)}
                aria-expanded={showRoutineMenu}
                aria-haspopup="menu"
                aria-label="Routine menu"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span aria-hidden="true">•••</span>
              </button>
              {showRoutineMenu && (
                <div
                  className="stretching-popover absolute right-0 z-20 mt-2 w-52 space-y-1 p-2"
                  role="menu"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowRoutineMenu(false);
                      openStudio("active");
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-muted"
                    role="menuitem"
                  >
                    Edit routine
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRoutineMenu(false);
                      reset();
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    role="menuitem"
                  >
                    Reset routine
                  </button>
                </div>
              )}
            </div>
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

          <section
            className={`stretching-session-frame ${isResting ? "stretching-session-frame--resting" : ""}`.trim()}
            aria-label="Stretching session"
          >
            <div className="stretching-session-rail">
              <div className="stretching-session-rail__meta">
                <span>
                  <strong>
                    {isCompleted
                      ? "Complete"
                      : isResting
                        ? "Rest"
                        : isPaused
                          ? "Paused"
                          : isRunning
                            ? "In progress"
                            : "Ready"}
                  </strong>
                  {currentRepetitionLabel && !isResting && (
                    <span className="ml-2 normal-case tracking-normal">
                      {currentRepetitionLabel}
                    </span>
                  )}
                </span>
                <span>
                  {currentRoutine?.name ?? "Your routine"} ·{" "}
                  {Math.round(progress)}%
                </span>
              </div>
              <DurationRail
                segments={railSegments}
                onJumpTo={jumpToStretch}
                isResting={isResting}
                label="Jump to any stretch in the routine"
              />
            </div>

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
              <div className="grid min-w-0 gap-3 min-[660px]:grid-cols-2 min-[660px]:gap-4 min-[1000px]:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)_minmax(15rem,0.72fr)] min-[1000px]:gap-5">
                <div className="min-w-0">
                  <StretchDetails stretch={currentStretch} section="image" />
                </div>
                <ControlPanel
                  currentStretch={currentStretch}
                  currentIndex={currentIndex}
                  currentRepetition={currentRepetition}
                  stretchesLength={stretches.length}
                  timeRemaining={timeRemaining}
                  isRunning={isRunning}
                  isPaused={isPaused}
                  timeRemainingTotal={timeRemainingTotal}
                  stepsRemaining={stepsRemaining}
                  onStart={start}
                  onPause={pause}
                  onResume={resume}
                  onNext={next}
                  onPrevious={previous}
                  isResting={isResting}
                />
                <aside className="stretching-session-context min-w-0 min-[660px]:col-span-2 min-[1000px]:col-span-1">
                  <div className="space-y-4">
                    {currentStretch.targetAreas &&
                      currentStretch.targetAreas.length > 0 && (
                        <section
                          className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                          aria-labelledby="session-targets-heading"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                            Focus
                          </p>
                          <h3
                            id="session-targets-heading"
                            className="mt-1 text-lg font-semibold text-foreground"
                          >
                            Target areas
                          </h3>
                          <ul className="mt-3 flex flex-wrap gap-2">
                            {currentStretch.targetAreas.map((area) => (
                              <li
                                key={area}
                                className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
                              >
                                {area}
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                    <StretchDetails
                      stretch={currentStretch}
                      section="guidance"
                    />
                    <section
                      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                      aria-labelledby="session-settings-heading"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                        Session
                      </p>
                      <h3
                        id="session-settings-heading"
                        className="mt-1 text-lg font-semibold text-foreground"
                      >
                        Settings
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowTimeBetweenSettings(true)}
                        className="mt-3 min-h-11 w-full rounded-xl bg-muted px-4 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-primary/10"
                      >
                        Rest between steps
                        <span className="float-right tabular-nums text-muted-foreground">
                          {timeBetween}s
                        </span>
                      </button>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Space to pause · ← / → to move · R to reset
                      </p>
                    </section>
                  </div>
                </aside>
              </div>
            ) : null}
          </section>
        </StretchingShell>
      )}
    </div>
  );
}
