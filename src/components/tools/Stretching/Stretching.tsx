import { useState, useEffect, useRef, useCallback } from "react";
import type { Stretch, StretchRoutine } from "./types";
import { DEFAULT_ROUTINES, STORAGE_KEY, ROUTINE_SELECTOR_KEY, TIME_BETWEEN_KEY, CUSTOM_ROUTINES_KEY } from "./constants";
import { playTickSound, playEndSound } from "./utils";
import { StretchDetails } from "./components/StretchDetails";
import { RestPeriodScreen } from "./components/RestPeriodScreen";
import { TimeBetweenSettings } from "./components/TimeBetweenSettings";
import { ControlPanel } from "./components/ControlPanel";
import { ContentManager } from "./components/ContentManager";
import { QuickStart } from "./components/QuickStart";
import { RoutineBrowser } from "./components/RoutineBrowser";
import { StretchPreview } from "./components/StretchPreview";

type ViewState = "quickstart" | "browser" | "preview" | "active" | "content-manager";

// Helper to get URL params
function getViewFromURL(): { view: ViewState; routineId: string | null } {
  if (typeof window === "undefined") return { view: "quickstart", routineId: null };
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") as ViewState | null;
  const routineId = params.get("routine");
  const validViews: ViewState[] = ["quickstart", "browser", "preview", "active", "content-manager"];
  return {
    view: view && validViews.includes(view) ? view : "quickstart",
    routineId,
  };
}

// Helper to update URL params
function updateURL(view: ViewState, routineId?: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (view === "quickstart") {
    url.searchParams.delete("view");
    url.searchParams.delete("routine");
  } else {
    url.searchParams.set("view", view);
    if (routineId) {
      url.searchParams.set("routine", routineId);
    } else {
      url.searchParams.delete("routine");
    }
  }
  window.history.replaceState({}, "", url.toString());
}

export default function Stretching() {
  const [viewState, setViewStateInternal] = useState<ViewState>(() => getViewFromURL().view);
  const [previewRoutineId, setPreviewRoutineId] = useState<string | null>(() => getViewFromURL().routineId);

  const [selectedRoutineId, setSelectedRoutineId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(ROUTINE_SELECTOR_KEY);
      return stored || "routine_1";
    }
    return "routine_1";
  });

  const [stretches, setStretches] = useState<Stretch[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.length > 0) {
            return parsed;
          }
        } catch {
          // Fall through to load routine
        }
      }
    }
    const routineId = typeof window !== "undefined"
      ? (localStorage.getItem(ROUTINE_SELECTOR_KEY) || "routine_1")
      : "routine_1";

    if (typeof window !== "undefined") {
      const customRoutinesStored = localStorage.getItem(CUSTOM_ROUTINES_KEY);
      if (customRoutinesStored) {
        try {
          const customRoutines = JSON.parse(customRoutinesStored);
          const customRoutine = customRoutines.find((r: StretchRoutine) => r.id === routineId);
          if (customRoutine) {
            return customRoutine.stretches.map((s: Stretch, idx: number) => ({
              ...s,
              id: `${routineId}_${s.id || idx + 1}`,
            }));
          }
        } catch {
          // Fall through to default routines
        }
      }
    }

    const routine = DEFAULT_ROUTINES.find((r) => r.id === routineId);
    if (routine) {
      return routine.stretches.map((s, idx) => ({
        ...s,
        id: `${routineId}_${s.id || idx + 1}`,
      }));
    }
    return DEFAULT_ROUTINES[0]?.stretches || [];
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRepetition, setCurrentRepetition] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(stretches[0]?.duration || 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [timeBetween, setTimeBetween] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(TIME_BETWEEN_KEY);
      return stored ? parseInt(stored, 10) : 10;
    }
    return 10;
  });
  const [showTimeBetweenSettings, setShowTimeBetweenSettings] = useState(false);
  const [customRoutines, setCustomRoutines] = useState<StretchRoutine[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(CUSTOM_ROUTINES_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  // Wrapper to update both state and URL
  const setViewState = useCallback((view: ViewState, routineId?: string | null) => {
    setViewStateInternal(view);
    if (view === "preview" && routineId) {
      setPreviewRoutineId(routineId);
    } else if (view !== "preview") {
      setPreviewRoutineId(null);
    }
    updateURL(view, view === "preview" ? routineId : null);
  }, []);

  // Sync with URL on popstate (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const { view, routineId } = getViewFromURL();
      setViewStateInternal(view);
      setPreviewRoutineId(routineId);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const loadRoutineStretches = (routineId: string): Stretch[] => {
    const customRoutine = customRoutines.find((r) => r.id === routineId);
    if (customRoutine) {
      return customRoutine.stretches.map((s, idx) => ({
        ...s,
        id: `${routineId}_${s.id || idx + 1}`,
      }));
    }
    const routine = DEFAULT_ROUTINES.find((r) => r.id === routineId);
    if (routine) {
      return routine.stretches.map((s, idx) => ({
        ...s,
        id: `${routineId}_${s.id || idx + 1}`,
      }));
    }
    return DEFAULT_ROUTINES[0]?.stretches || [];
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CUSTOM_ROUTINES_KEY, JSON.stringify(customRoutines));
    }
  }, [customRoutines]);

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

  const calculateTotalDuration = () => {
    return stretches.reduce((total, stretch) => {
      const reps = stretch.repetitions || 1;
      return total + (stretch.duration * reps);
    }, 0);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ROUTINE_SELECTOR_KEY, selectedRoutineId);
    }
  }, [selectedRoutineId]);

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
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stretches));
    }
    totalDurationRef.current = calculateTotalDuration();
  }, [stretches]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TIME_BETWEEN_KEY, timeBetween.toString());
    }
  }, [timeBetween]);

  useEffect(() => {
    isRunningRef.current = isRunning;
    isPausedRef.current = isPaused;
    isRestingRef.current = isResting;
  }, [isRunning, isPaused, isResting]);

  useEffect(() => {
    if (stretches[currentIndex]) {
      setTimeRemaining(stretches[currentIndex].duration);
      if (isRunning && !isPaused && (currentIndex !== previousIndexRef.current || currentRepetition !== previousRepetitionRef.current)) {
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
            if (!isRunningRef.current || isPausedRef.current || !isRestingRef.current) {
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
            if (!isRunningRef.current || isPausedRef.current || isRestingRef.current) {
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
    setStretches(stretches.map((s) => (s.id === id ? { ...stretch, id: s.id } : s)));
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
    setCustomRoutines(customRoutines.map((r) =>
      r.id === id ? { ...r, ...routine } : r
    ));
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
  const previewRoutine = previewRoutineId ? allRoutines.find((r) => r.id === previewRoutineId) : null;

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
    ...DEFAULT_ROUTINES.filter(r => r.category === "pain-relief").slice(0, 1),
    ...DEFAULT_ROUTINES.filter(r => r.category === "posture-correction").slice(0, 1),
    ...DEFAULT_ROUTINES.filter(r => r.category === "mobility").slice(0, 1),
  ];

  // Get recent routine from localStorage
  const recentRoutine = currentRoutine;

  return (
    <div className="min-h-screen">
      {/* QuickStart View */}
      {viewState === "quickstart" && (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 safe-area-inset">
          <QuickStart
            featuredRoutines={featuredRoutines}
            recentRoutine={recentRoutine}
            onSelectRoutine={handleSelectRoutineFromQuickStart}
            onBrowseAll={() => setViewState("browser")}
          />
        </div>
      )}

      {/* Routine Browser */}
      {viewState === "browser" && (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 safe-area-inset">
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
        </div>
      )}

      {/* Stretch Preview */}
      {viewState === "preview" && previewRoutine && (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 safe-area-inset">
          <StretchPreview
            routine={previewRoutine}
            onBegin={handleBeginRoutine}
            onBack={() => setViewState("browser")}
          />
        </div>
      )}

      {/* Content Manager */}
      {viewState === "content-manager" && (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 safe-area-inset">
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
        </div>
      )}

      {/* Active Stretching View */}
      {viewState === "active" && (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 space-y-4 sm:space-y-6 safe-area-inset">
          {/* Back button and routine info */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToQuickStart}
              className="p-2 rounded-full bg-white/80 dark:bg-card hover:bg-white dark:hover:bg-card/80 shadow-sm transition-all"
            >
              <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate">{currentRoutine?.name}</h2>
              <p className="text-sm text-muted-foreground truncate">{currentRoutine?.goal}</p>
            </div>
            <button
              onClick={() => setViewState("content-manager")}
              className="px-4 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
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
              onTimeBetweenSettingsClick={() => setShowTimeBetweenSettings(!showTimeBetweenSettings)}
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
        </div>
      )}

      <style>{`
        .safe-area-inset {
          padding-left: max(1rem, env(safe-area-inset-left));
          padding-right: max(1rem, env(safe-area-inset-right));
          padding-bottom: max(2rem, env(safe-area-inset-bottom));
        }
      `}</style>
    </div>
  );
}
