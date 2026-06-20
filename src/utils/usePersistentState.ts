import { useEffect, useRef, useState } from "react";

/**
 * Like useState, but persisted to localStorage under `key`. The initial value
 * is used for the first (SSR-safe) render; the stored value is loaded on mount
 * to avoid hydration mismatches.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setState(JSON.parse(raw) as T);
    } catch {
      /* ignore malformed / unavailable storage */
    }
    hydrated.current = true;
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore quota / unavailable storage */
    }
  }, [key, state]);

  return [state, setState] as const;
}
