import sharedConfig from "./tailwind.config.mjs";

// Scan every homepage state, including previews, the full timeline and the
// mobile menu. Add shared components here when the homepage starts using them.
export default {
  ...sharedConfig,
  content: {
    relative: true,
    files: [
      "./src/pages/index.astro",
      "./src/layouts/{DefaultLayout,StarLayout}.astro",
      "./src/components/layout/{Header,Footer,NavItem,ThemeToggle}.astro",
      "./src/components/home/**/*.{ts,tsx}",
      "./src/components/content/{BlogPreview,LogPreview,SnackPreview,ContentPreview,TagsList}.tsx",
    ],
  },
};
