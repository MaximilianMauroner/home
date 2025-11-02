import { blogType, logType, snackType } from "@/utils/types";
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: blogType,
});
const log = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/log" }),
  schema: logType,
});
const snacks = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/snacks" }),
  schema: snackType,
});

export const collections = { blog, log, snacks };
