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
  const totalDurationRef = useRef<number>(0);
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

  const calculateTotalDuration = () => {
    return stretches.reduce((total, stretch) => {
      const reps = stretch.repetitions || 1;
      return total + stretch.duration * reps;
    }, 0);
  };

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
    if (newStretches[0]) {
      setTimeRemaining(newStretches[0].duration);
    }
  };

  useEffect(() => {
    if (hasRestored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stretches));
    }
    totalDurationRef.current = calculateTotalDuration();
  }, [hasRestored, stretches]);

  useEffect(() => {
    if (!hasRestored) return;
    localStorage.setItem(TIME_BETWEEN_KEY, timeBetween.toString());
  }, [hasRestored, timeBetween]);

  useEffect(() => {
    isRunningRef.current = isRunning;
    isPausedRef.current = isPaused;
    isRestingRef.current = isResting;
  }, [isRunning, isPaused, isResting]);

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
  }, [currentIndex, currentRepetition, stretches, isRunning, isPaused]);

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

  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        if (isRestingRef.current) {
          setTimeRemaining((prev) => {
            if (
              !isRunningRef.current ||
              isPausedRef.current ||
              !isRestingRef.current
            ) {
              return prev;
            }

            if (prev <= 1) {
              setIsResting(false);
              const nextIndex = nextStretchIndexRef.current;
              const nextRep = nextRepetitionRef.current;

              if (nextIndex !== null && nextRep !== null) {
                setCurrentIndex(nextIndex);
                setCurrentRepetition(nextRep);
                const nextStretch = stretches[nextIndex];
                if (nextStretch) {
                  setTimeRemaining(nextStretch.duration);
                }
                setNextStretchIndex(null);
                setNextRepetition(null);
                nextStretchIndexRef.current = null;
                nextRepetitionRef.current = null;
                playTickSound();
              }
              return 0;
            }
            return prev - 1;
          });
        } else {
          setTimeRemaining((prev) => {
            if (
              !isRunningRef.current ||
              isPausedRef.current ||
              isRestingRef.current
            ) {
              return prev;
            }

            if (prev <= 1) {
              playEndSound();
              setTimeout(() => {
                setCurrentRepetition((rep) => {
                  setCurrentIndex((idx) => {
                    const currentStretch = stretches[idx];
                    const reps = currentStretch?.repetitions || 1;

                    if (rep < reps) {
                      if (timeBetween > 0) {
                        setIsResting(true);
                        setTimeRemaining(timeBetween);
                        setNextStretchIndex(idx);
                        setNextRepetition(rep + 1);
                        nextStretchIndexRef.current = idx;
                        nextRepetitionRef.current = rep + 1;
                      } else {
                        setCurrentRepetition(rep + 1);
                        setTimeRemaining(currentStretch.duration);
                        playTickSound();
                      }
                    } else {
                      if (idx < stretches.length - 1) {
                        if (timeBetween > 0) {
                          setIsResting(true);
                          setTimeRemaining(timeBetween);
                          setNextStretchIndex(idx + 1);
                          setNextRepetition(1);
                          nextStretchIndexRef.current = idx + 1;
                          nextRepetitionRef.current = 1;
                        } else {
                          setCurrentIndex(idx + 1);
                          setCurrentRepetition(1);
                          const nextStretch = stretches[idx + 1];
                          if (nextStretch) {
                            setTimeRemaining(nextStretch.duration);
                          }
                          playTickSound();
                        }
                      } else {
                        setIsRunning(false);
                      }
                    }
                    return idx;
                  });
                  return rep;
                });
              }, 0);
              return 0;
            }
            return prev - 1;
          });
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
  }, [isRunning, isPaused, isResting, stretches.length, timeBetween]);

  const start = () => {
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
    setCurrentIndex(0);
    setCurrentRepetition(1);
    setNextStretchIndex(null);
    setNextRepetition(null);
    startTimeRef.current = null;
    nextStretchIndexRef.current = null;
    nextRepetitionRef.current = null;
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
        setCurrentIndex(nextIndex);
        setCurrentRepetition(nextRep);
        const nextStretch = stretches[nextIndex];
        if (nextStretch) {
          setTimeRemaining(nextStretch.duration);
        }
        setNextStretchIndex(null);
        setNextRepetition(null);
        nextStretchIndexRef.current = null;
        nextRepetitionRef.current = null;
      }
      return;
    }

    const currentStretch = stretches[currentIndex];
    const reps = currentStretch?.repetitions || 1;

    if (currentRepetition < reps) {
      setCurrentRepetition(currentRepetition + 1);
      setTimeRemaining(currentStretch.duration);
    } else if (currentIndex < stretches.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentRepetition(1);
      const nextStretch = stretches[currentIndex + 1];
      if (nextStretch) {
        setTimeRemaining(nextStretch.duration);
      }
    } else {
      setIsRunning(false);
    }
  };

  const previous = () => {
    if (currentRepetition > 1) {
      setCurrentRepetition(currentRepetition - 1);
      const currentStretch = stretches[currentIndex];
      setTimeRemaining(currentStretch.duration);
    } else if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      const prevStretch = stretches[currentIndex - 1];
      const prevReps = prevStretch?.repetitions || 1;
      setCurrentRepetition(prevReps);
      setTimeRemaining(prevStretch.duration);
    }
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
    setTimeRemaining(routineStretches[0]?.duration || 60);
  };

  const currentStretch = stretches[currentIndex];

  const calculateProgress = () => {
    if (totalDurationRef.current === 0) return 0;

    let elapsed = 0;

    for (let i = 0; i < currentIndex; i++) {
      const stretch = stretches[i];
      const reps = stretch.repetitions || 1;
      elapsed += stretch.duration * reps;
    }

    const currentReps = currentStretch?.repetitions || 1;
    if (currentRepetition > 1) {
      elapsed += currentStretch.duration * (currentRepetition - 1);
    }

    if (currentStretch) {
      const isLastStretch = currentIndex === stretches.length - 1;
      const isLastRep = currentRepetition === currentReps;
      const isCompleted = isLastStretch && isLastRep && !isRunning;

      if (isCompleted) {
        elapsed += currentStretch.duration;
      } else {
        const elapsedInCurrent = currentStretch.duration - timeRemaining;
        elapsed += Math.max(0, elapsedInCurrent);
      }
    }

    const progress = (elapsed / totalDurationRef.current) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  const progress = calculateProgress();

  const calculateTimeRemaining = () => {
    let remaining = 0;

    remaining += timeRemaining;

    const currentReps = currentStretch?.repetitions || 1;
    if (currentRepetition < currentReps) {
      remaining += currentStretch.duration * (currentReps - currentRepetition);
    }

    for (let i = currentIndex + 1; i < stretches.length; i++) {
      const stretch = stretches[i];
      const reps = stretch.repetitions || 1;
      remaining += stretch.duration * reps;
    }

    if (timeBetween > 0) {
      if (currentRepetition < currentReps) {
        remaining += timeBetween * (currentReps - currentRepetition);
      }
      for (let i = currentIndex + 1; i < stretches.length; i++) {
        remaining += timeBetween;
      }
    }

    return remaining;
  };

  const calculateStepsRemaining = () => {
    const isLastStretch = currentIndex === stretches.length - 1;
    const currentReps = currentStretch?.repetitions || 1;
    const isLastRep = currentRepetition === currentReps;
    const isCompleted = isLastStretch && isLastRep && !isRunning;

    if (isCompleted) {
      return 0;
    }

    let steps = 0;

    steps += currentReps - currentRepetition;

    for (let i = currentIndex + 1; i < stretches.length; i++) {
      const stretch = stretches[i];
      const reps = stretch.repetitions || 1;
      steps += reps;
    }

    return steps;
  };

  const timeRemainingTotal = calculateTimeRemaining();
  const stepsRemaining = calculateStepsRemaining();

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
        <StretchingShell variant="focus" className="space-y-4 sm:space-y-6">
          {/* Back button and routine info */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleBackToQuickStart}
              aria-label="Back to stretching overview"
              className="rounded-full bg-white/80 p-2 shadow-sm transition-colors hover:bg-white dark:bg-card dark:hover:bg-card/80"
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
              <h2 className="truncate text-lg font-semibold text-foreground">
                {currentRoutine?.name}
              </h2>
              <p className="truncate text-sm text-muted-foreground">
                {currentRoutine?.goal}
              </p>
            </div>
            <button
              onClick={() => setViewState("content-manager")}
              className="px-4 py-2 text-sm font-medium text-amber-600 transition-colors hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            >
              Edit
            </button>
          </div>

          {/* Time Between Settings */}
          {showTimeBetweenSettings && (
            <TimeBetweenSettings
              timeBetween={timeBetween}
              onTimeBetweenChange={setTimeBetween}
              onClose={() => setShowTimeBetweenSettings(false)}
            />
          )}

          {/* Rest Period Screen */}
          {isResting && (
            <RestPeriodScreen
              timeRemaining={timeRemaining}
              isRunning={isRunning}
              isPaused={isPaused}
              nextStretchIndex={nextStretchIndex}
              nextRepetition={nextRepetition}
              stretches={stretches}
              onPause={pause}
              onResume={resume}
            />
          )}

          {/* Control Panel */}
          {currentStretch && !isResting && (
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
                setShowTimeBetweenSettings(!showTimeBetweenSettings)
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
          )}

          {/* Stretch Details */}
          {currentStretch && !isResting && (
            <StretchDetails stretch={currentStretch} />
          )}
        </StretchingShell>
      )}
    </div>
  );
}
