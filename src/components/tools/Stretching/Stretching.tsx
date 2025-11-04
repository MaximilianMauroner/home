import { useState, useEffect, useRef } from "react";
import type { Stretch, StretchRoutine } from "./types";
import { DEFAULT_ROUTINES, STORAGE_KEY, ROUTINE_SELECTOR_KEY, TIME_BETWEEN_KEY, CUSTOM_ROUTINES_KEY } from "./constants";
import { formatTime, playTickSound, playEndSound } from "./utils";
import { StretchDetails } from "./components/StretchDetails";
import { RestPeriodScreen } from "./components/RestPeriodScreen";
import { TimeBetweenSettings } from "./components/TimeBetweenSettings";
import { ControlPanel } from "./components/ControlPanel";
import { ContentManager } from "./components/ContentManager";

export default function Stretching() {
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(ROUTINE_SELECTOR_KEY);
      return stored || "routine_0";
    }
    return "routine_0";
  });

  const [stretches, setStretches] = useState<Stretch[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Check if stored stretches match a routine (basic check)
          if (parsed.length > 0) {
            return parsed;
          }
        } catch {
          // Fall through to load routine
        }
      }
    }
    // Inline routine loading logic (avoiding dependency on loadRoutineStretches)
    const routineId = typeof window !== "undefined" 
      ? (localStorage.getItem(ROUTINE_SELECTOR_KEY) || "routine_0")
      : "routine_0";
    
    // Check custom routines first
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
    
    // Then check default routines
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
      return stored ? parseInt(stored, 10) : 10; // Default 10 seconds
    }
    return 10;
  });
  const [showTimeBetweenSettings, setShowTimeBetweenSettings] = useState(false);
  const [showContentManager, setShowContentManager] = useState(false);
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

  const loadRoutineStretches = (routineId: string): Stretch[] => {
    // Check custom routines first
    const customRoutine = customRoutines.find((r) => r.id === routineId);
    if (customRoutine) {
      return customRoutine.stretches.map((s, idx) => ({
        ...s,
        id: `${routineId}_${s.id || idx + 1}`,
      }));
    }
    // Then check default routines
    const routine = DEFAULT_ROUTINES.find((r) => r.id === routineId);
    if (routine) {
      return routine.stretches.map((s, idx) => ({
        ...s,
        id: `${routineId}_${s.id || idx + 1}`,
      }));
    }
    return DEFAULT_ROUTINES[0]?.stretches || [];
  };

  // Save custom routines to localStorage
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

  // Calculate total duration across all stretches with repetitions
  const calculateTotalDuration = () => {
    return stretches.reduce((total, stretch) => {
      const reps = (stretch as any).repetitions || 1;
      return total + (stretch.duration * reps);
    }, 0);
  };

  // Save routine selection to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ROUTINE_SELECTOR_KEY, selectedRoutineId);
    }
  }, [selectedRoutineId]);

  // Load routine when selected
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

  // Save stretches to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stretches));
    }
    totalDurationRef.current = calculateTotalDuration();
  }, [stretches]);

  // Save timeBetween to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TIME_BETWEEN_KEY, timeBetween.toString());
    }
  }, [timeBetween]);

  // Keep refs in sync with state
  useEffect(() => {
    isRunningRef.current = isRunning;
    isPausedRef.current = isPaused;
    isRestingRef.current = isResting;
  }, [isRunning, isPaused, isResting]);

  // Update time remaining when current stretch or repetition changes
  useEffect(() => {
    if (stretches[currentIndex]) {
      setTimeRemaining(stretches[currentIndex].duration);
      // Play start sound when moving to a new stretch or repetition (if running)
      if (isRunning && !isPaused && (currentIndex !== previousIndexRef.current || currentRepetition !== previousRepetitionRef.current)) {
        playTickSound();
      }
      previousIndexRef.current = currentIndex;
      previousRepetitionRef.current = currentRepetition;
    }
  }, [currentIndex, currentRepetition, stretches, isRunning, isPaused]);

  // Play start sound when timer begins
  useEffect(() => {
    if (isRunning && !isPaused && !hasPlayedStartSoundRef.current) {
      // Only play if timer just started (wasn't running before)
      playTickSound();
      hasPlayedStartSoundRef.current = true;
      startTimeRef.current = Date.now();
    }
    // Reset flag when paused or stopped
    if (!isRunning || isPaused) {
      hasPlayedStartSoundRef.current = false;
      if (!isRunning) {
        startTimeRef.current = null;
      }
    }
  }, [isRunning, isPaused]);

  // Timer logic - use functional updates to avoid dependency on timeRemaining
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        if (isRestingRef.current) {
          // Handle rest period countdown
          setTimeRemaining((prev) => {
            if (!isRunningRef.current || isPausedRef.current || !isRestingRef.current) {
              return prev;
            }
            
            if (prev <= 1) {
              // Rest period is over, move to next stretch/rep
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
          // Handle stretch countdown
          setTimeRemaining((prev) => {
            // Check if still running via refs (avoid stale closures)
            if (!isRunningRef.current || isPausedRef.current || isRestingRef.current) {
              return prev;
            }
            
            if (prev <= 1) {
              // Play end sound
              playEndSound();
              // Move to next repetition or stretch when timer reaches 0
              setTimeout(() => {
                setCurrentRepetition((rep) => {
                  setCurrentIndex((idx) => {
                    const currentStretch = stretches[idx];
                    const reps = (currentStretch as any)?.repetitions || 1;
                    
                    if (rep < reps) {
                      // Continue to next repetition of current stretch
                      if (timeBetween > 0) {
                        // Start rest period
                        setIsResting(true);
                        setTimeRemaining(timeBetween);
                        setNextStretchIndex(idx);
                        setNextRepetition(rep + 1);
                        nextStretchIndexRef.current = idx;
                        nextRepetitionRef.current = rep + 1;
                      } else {
                        // No rest, go directly to next rep
                        setCurrentRepetition(rep + 1);
                        setTimeRemaining(currentStretch.duration);
                        playTickSound();
                      }
                    } else {
                      // Finished all repetitions, move to next stretch
                      if (idx < stretches.length - 1) {
                        if (timeBetween > 0) {
                          // Start rest period
                          setIsResting(true);
                          setTimeRemaining(timeBetween);
                          setNextStretchIndex(idx + 1);
                          setNextRepetition(1);
                          nextStretchIndexRef.current = idx + 1;
                          nextRepetitionRef.current = 1;
                        } else {
                          // No rest, go directly to next stretch
                          setCurrentIndex(idx + 1);
                          setCurrentRepetition(1);
                          const nextStretch = stretches[idx + 1];
                          if (nextStretch) {
                            setTimeRemaining(nextStretch.duration);
                          }
                          playTickSound();
                        }
                      } else {
                        // Last stretch completed
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
      // Skip rest period and go directly to next
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
    const reps = (currentStretch as any)?.repetitions || 1;
    
    // If there are more repetitions of current stretch, go to next rep
    if (currentRepetition < reps) {
      setCurrentRepetition(currentRepetition + 1);
      // Reset timer for new repetition
      setTimeRemaining(currentStretch.duration);
    } 
    // Otherwise, move to next stretch (first rep)
    else if (currentIndex < stretches.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentRepetition(1);
      const nextStretch = stretches[currentIndex + 1];
      if (nextStretch) {
        setTimeRemaining(nextStretch.duration);
      }
    } 
    // Last stretch, last rep - stop
    else {
      setIsRunning(false);
    }
  };

  const previous = () => {
    // If we're not on the first repetition, go to previous rep
    if (currentRepetition > 1) {
      setCurrentRepetition(currentRepetition - 1);
      const currentStretch = stretches[currentIndex];
      setTimeRemaining(currentStretch.duration);
    }
    // Otherwise, go to previous stretch (last rep)
    else if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      const prevStretch = stretches[currentIndex - 1];
      const prevReps = (prevStretch as any)?.repetitions || 1;
      setCurrentRepetition(prevReps);
      setTimeRemaining(prevStretch.duration);
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
    // Adjust current index if needed
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

  // Routine management functions
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
      // Switch to first default routine if deleting current
      loadRoutine(DEFAULT_ROUTINES[0]?.id || "routine_0");
    }
  };

  const loadRoutineStretchesForEditing = (routine: StretchRoutine) => {
    // Load the routine's stretches for editing
    const routineStretches = routine.stretches.map((s, idx) => ({
      ...s,
      id: `${routine.id}_${s.id || idx + 1}`,
    }));
    setStretches(routineStretches);
    // Also select the routine
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

  // Calculate progress based on elapsed time vs total duration
  const calculateProgress = () => {
    if (totalDurationRef.current === 0) return 0;
    
    // Calculate elapsed time
    let elapsed = 0;
    
    // Time from previous stretches (with their repetitions)
    for (let i = 0; i < currentIndex; i++) {
      const stretch = stretches[i];
      const reps = (stretch as any).repetitions || 1;
      elapsed += stretch.duration * reps;
    }
    
    // Time from previous repetitions of current stretch
    const currentReps = (currentStretch as any)?.repetitions || 1;
    if (currentRepetition > 1) {
      elapsed += currentStretch.duration * (currentRepetition - 1);
    }
    
    // Time elapsed in current repetition
    if (currentStretch) {
      // If we're on the last stretch, last rep, and not running, count the full rep as complete
      const isLastStretch = currentIndex === stretches.length - 1;
      const isLastRep = currentRepetition === currentReps;
      const isCompleted = isLastStretch && isLastRep && !isRunning;
      
      if (isCompleted) {
        // Count the full duration of the last rep as elapsed
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

  // Calculate total time remaining
  const calculateTimeRemaining = () => {
    let remaining = 0;
    
    // Time remaining in current repetition
    remaining += timeRemaining;
    
    // Remaining repetitions of current stretch
    const currentReps = (currentStretch as any)?.repetitions || 1;
    if (currentRepetition < currentReps) {
      remaining += currentStretch.duration * (currentReps - currentRepetition);
    }
    
    // All remaining stretches
    for (let i = currentIndex + 1; i < stretches.length; i++) {
      const stretch = stretches[i];
      const reps = (stretch as any).repetitions || 1;
      remaining += stretch.duration * reps;
    }
    
    // Add rest periods if timeBetween is set
    if (timeBetween > 0) {
      // Count rest periods between remaining reps
      if (currentRepetition < currentReps) {
        remaining += timeBetween * (currentReps - currentRepetition);
      }
      // Count rest periods between remaining stretches
      for (let i = currentIndex + 1; i < stretches.length; i++) {
        remaining += timeBetween;
      }
    }
    
    return remaining;
  };

  // Calculate steps remaining
  const calculateStepsRemaining = () => {
    // If routine is completed, return 0
    const isLastStretch = currentIndex === stretches.length - 1;
    const currentReps = (currentStretch as any)?.repetitions || 1;
    const isLastRep = currentRepetition === currentReps;
    const isCompleted = isLastStretch && isLastRep && !isRunning;
    
    if (isCompleted) {
      return 0;
    }
    
    let steps = 0;
    
    // Remaining repetitions of current stretch
    steps += currentReps - currentRepetition;
    
    // All remaining stretches with their repetitions
    for (let i = currentIndex + 1; i < stretches.length; i++) {
      const stretch = stretches[i];
      const reps = (stretch as any).repetitions || 1;
      steps += reps;
    }
    
    return steps;
  };

  const timeRemainingTotal = calculateTimeRemaining();
  const stepsRemaining = calculateStepsRemaining();

  const allRoutines = [...DEFAULT_ROUTINES, ...customRoutines];
  const currentRoutine = allRoutines.find((r) => r.id === selectedRoutineId);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-8">
      {/* Content Manager */}
      {showContentManager && (
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
            setShowContentManager(false);
          }}
          onLoadRoutineStretches={loadRoutineStretchesForEditing}
          onSaveRoutine={saveRoutine}
          onUpdateRoutine={updateRoutine}
          onDeleteRoutine={deleteRoutine}
          onResetToDefault={resetToDefault}
          onClose={() => setShowContentManager(false)}
        />
      )}

      {/* Current Routine Display */}
      {!showContentManager && (
        <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base sm:text-lg font-semibold">{currentRoutine?.name || "No Routine"}</h3>
                {customRoutines.some((r) => r.id === selectedRoutineId) && (
                  <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                    Custom
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{currentRoutine?.goal || ""}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>⏱️ {currentRoutine ? formatTime(currentRoutine.totalDuration) : "0:00"}</span>
                <span>•</span>
                <span>{currentRoutine?.stretches.length || 0} stretches</span>
              </div>
            </div>
            <button
              onClick={() => {
                setIsRunning(false);
                setIsPaused(false);
                setShowContentManager(true);
              }}
              className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium text-sm"
            >
              Manage Content
            </button>
          </div>
        </div>
      )}

      {/* Time Between Settings */}
      {!showContentManager && showTimeBetweenSettings && (
        <TimeBetweenSettings
          timeBetween={timeBetween}
          onTimeBetweenChange={setTimeBetween}
          onClose={() => setShowTimeBetweenSettings(false)}
        />
      )}

      {/* Rest Period Screen */}
      {!showContentManager && isResting && (
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

      {/* Control Bar */}
      {!showContentManager && currentStretch && !isResting && (
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
        />
      )}

      {/* Stretch Details */}
      {!showContentManager && currentStretch && !isResting && (
        <StretchDetails stretch={currentStretch} />
      )}
    </div>
  );
}
