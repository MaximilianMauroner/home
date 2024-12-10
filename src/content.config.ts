import { blogType, logType } from '@/utils/types';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
    schema: blogType
});
const log = defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/log" }),
    schema: logType
});

export const collections = { blog, log };