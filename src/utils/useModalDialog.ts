import { useEffect, useRef, type RefObject } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter(
    (element) =>
      !element.hidden && element.getAttribute("aria-hidden") !== "true",
  );
}

interface ModalDialogOptions {
  dialogRef: RefObject<HTMLElement | null>;
  initialFocusSelector?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function useModalDialog({
  dialogRef,
  initialFocusSelector,
  isOpen,
  onClose,
}: ModalDialogOptions) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const returnFocusTarget =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let portalRoot: HTMLElement = dialog;
    while (
      portalRoot.parentElement &&
      portalRoot.parentElement !== document.body
    ) {
      portalRoot = portalRoot.parentElement;
    }

    const backgroundElements = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element !== portalRoot,
    );
    const previousInert = backgroundElements.map((element) => element.inert);
    backgroundElements.forEach((element) => {
      element.inert = true;
    });

    const initialFocus = initialFocusSelector
      ? dialog.querySelector<HTMLElement>(initialFocusSelector)
      : null;
    const focusableElements = getFocusableElements(dialog);
    (initialFocus ?? focusableElements[0] ?? dialog).focus({
      preventScroll: true,
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const currentFocusableElements = getFocusableElements(dialog);
      if (currentFocusableElements.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = currentFocusableElements[0];
      const last =
        currentFocusableElements[currentFocusableElements.length - 1];
      const activeElement = document.activeElement;

      if (
        event.shiftKey &&
        (activeElement === first || !dialog.contains(activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === last || !dialog.contains(activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach((element, index) => {
        element.inert = previousInert[index];
      });
      returnFocusTarget?.focus({ preventScroll: true });
    };
  }, [dialogRef, initialFocusSelector, isOpen]);
}
