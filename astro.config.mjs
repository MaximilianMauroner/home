// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import react from "@astrojs/react";

import mdx from "@astrojs/mdx";

import sitemap from "@astrojs/sitemap";

import expressiveCode from "astro-expressive-code";
import { remarkReadingTime } from "./plugins/remark-reading-time.mjs";
import { remarkModifiedTime } from "./plugins/remark-modified-time.mjs";

import vercel from "@astrojs/vercel/serverless";

// https://astro.build/config
export default defineConfig({
  site: "https://www.mauroner.net",
  adapter: vercel(),
  output: "hybrid",
  integrations: [
    tailwind({ applyBaseStyles: false }),
    react(),
    expressiveCode(),
    mdx(),
    sitemap(),
  ],
  markdown: {
    remarkPlugins: [remarkReadingTime, remarkModifiedTime],
  },
});
