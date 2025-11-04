import { z } from "astro:content";

export const blogType = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  image: z.string().optional(),
  published: z.boolean(),
  releaseDate: z.date(),
  lastModified: z.string().optional(), // Added by remark-modified-time plugin
});

export const logType = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  image: z.string().optional(),
  published: z.boolean(),
  releaseDate: z.date(),
  lastModified: z.string().optional(), // Added by remark-modified-time plugin
});

export const snackType = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  image: z.string().optional(),
  published: z.boolean(),
  releaseDate: z.date(),
  lastModified: z.string().optional(), // Added by remark-modified-time plugin
});

export type HeadingType = {
  depth: number;
  slug: string;
  text: string;
};
