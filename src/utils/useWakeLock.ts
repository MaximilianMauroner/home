import { useEffect, useRef } from "react";

/**
 * Holds a Screen Wake Lock while `active` is true so the display doesn't sleep
 * mid-session. Re-acquires when the tab returns to the foreground (the lock is
 * automatically released by the browser when the page is hidden). No-ops where
 * the Wake Lock API is unavailable.
 */
export function useWakeLock(active: boolean) {
  // WakeLockSentinel isn't in every TS lib target; keep it loose.
  const sentinelRef = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    const request = async () => {
      try {
        sentinelRef.current = await (
          navigator as Navigator & {
            wakeLock: { request: (type: "screen") => Promise<any> };
          }
        ).wakeLock.request("screen");
      } catch {
        /* user gesture / permission denied — ignore */
      }
    };

    request();

    const onVisibility = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [active]);
}
