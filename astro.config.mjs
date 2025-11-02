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
      changefreq: "weekly",
      priority: 0.7,
      lastmod: new Date(),
      filter: (page) => !page.includes('/admin'),
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
