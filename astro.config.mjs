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
  trailingSlash: "always",

  integrations: [
    tailwind({ applyBaseStyles: false }),
    react(),
    expressiveCode(),
    mdx(),
    sitemap({
      changefreq: "weekly",
      priority: 0.7,
      lastmod: new Date(),
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
