/**
 * Connects a figure's Max effort switch (MaxToggle.astro): shows it, mirrors its state in the figure's
 * data-max attribute for CSS, and reports changes.
 */
export function bindMaxToggle(figure: HTMLElement, onChange?: (includeMax: boolean) => void) {
  const toggle = figure.querySelector<HTMLElement>("[data-max-toggle]");
  if (!toggle) return;
  const buttons = toggle.querySelectorAll<HTMLButtonElement>("[data-max-value]");
  toggle.hidden = false;
  buttons.forEach((button) =>
    button.addEventListener("click", () => {
      const includeMax = button.dataset.maxValue === "true";
      if (String(includeMax) === figure.dataset.max) return;
      figure.dataset.max = String(includeMax);
      buttons.forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
      onChange?.(includeMax);
    }),
  );
}
