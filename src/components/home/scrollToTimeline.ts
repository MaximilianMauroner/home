// Return cleanup so another click or unmount can cancel pending navigation.
export function beginTimelineScroll(
  section: HTMLElement | null,
  reducedMotion: boolean,
) {
  if (!section) return () => undefined;
  const controller = new AbortController();
  let frame = 0;
  let timeout = 0;
  const finish = () => {
    cancelAnimationFrame(frame);
    window.clearTimeout(timeout);
    controller.abort();
  };
  const cancel = () => {
    if (controller.signal.aborted) return;
    // An instant scroll at the current position stops the native smooth scroll.
    // The user's input then continues with its normal browser behavior.
    window.scrollTo({
      top: window.scrollY,
      left: window.scrollX,
      behavior: "instant",
    });
    finish();
  };
  const options = { passive: true, signal: controller.signal };
  window.addEventListener("wheel", cancel, options);
  window.addEventListener("touchstart", cancel, options);
  window.addEventListener("pointerdown", cancel, options);
  window.addEventListener(
    "keydown",
    (event) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        cancel();
    },
    { signal: controller.signal },
  );
  window.addEventListener("scrollend", finish, { signal: controller.signal });
  frame = requestAnimationFrame(() => {
    section.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    section.focus({ preventScroll: true });
  });
  // Also release listeners if the browser does not dispatch scrollend.
  timeout = window.setTimeout(finish, 1500);
  return cancel;
}
