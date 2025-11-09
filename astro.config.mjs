// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import react from "@astrojs/react";

import mdx from "@astrojs/mdx";

import sitemap from "@astrojs/sitemap";

import expressiveCode from "astro-expressive-code";
import { remarkReadingTime } from "./plugins/remark-reading-time.mjs";
import { remarkModifiedTime } from "./plugins/remark-modified-time.mjs";

import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  site: "https://www.mauroner.net",
  integrations: [
    tailwind({ applyBaseStyles: false }),
    react(),
    expressiveCode(),
    mdx({
      remarkRehype: { footnoteLabel: "Footnotes" },
    }),
    sitemap({
      filter: (page) => !page.includes('/admin'),
      serialize: (item) => {
        if (item.url.includes("/tags/")) {
          return { ...item, priority: 0.3 };
        }
        if (item.url.endsWith("/dev-log/") || item.url.endsWith("/blog/") || item.url.endsWith("/snacks/") || item.url.endsWith("/tools/")) {
          return { ...item, priority: 0.7 };
        }
        if (item.url.includes("/dev-log/") || item.url.includes("/blog/") || item.url.includes("/snacks/") || item.url.includes("/tools/")) {
          return { ...item, priority: 0.5 };
        }
        return { ...item, priority: 0.9 };
      },
      i18n: {
        defaultLocale: "en",
        locales: {
          en: "en-US",
        },
      },
    }),
  ],

  markdown: {
    remarkPlugins: [remarkReadingTime, remarkModifiedTime],
  },
  adapter: vercel(),
});
