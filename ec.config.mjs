import { defineEcConfig } from "astro-expressive-code";

// Expressive Code configuration. Picked up automatically by the
// astro-expressive-code integration. Enables the copy button, line
// highlighting (`{1,3-4}` meta), and frame titles for code blocks.
export default defineEcConfig({
  themes: ["github-dark", "github-light"],
  // Switch theme alongside the site's `.dark` class instead of media query.
  themeCssSelector: (theme) =>
    theme.name === "github-dark" ? ".dark" : ":root:not(.dark)",
  useDarkModeMediaQuery: false,
  defaultProps: {
    // Wrap long lines instead of horizontal scrolling.
    wrap: true,
    showLineNumbers: false,
  },
  frames: {
    // Tooltip shown on the copy button.
    extractFileNameFromCode: true,
  },
  styleOverrides: {
    borderRadius: "0.5rem",
    borderColor: "rgba(129, 140, 248, 0.25)",
    frames: {
      shadowColor: "rgba(99, 102, 241, 0.15)",
    },
  },
});
