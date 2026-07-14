import type { APIRoute } from "astro";
import { renderOgImage, type OgCollection } from "@/utils/server/og";

interface SectionOg {
  collection: OgCollection;
  description: string;
  title: string;
}

const sections: Record<string, SectionOg> = {
  blog: {
    collection: "blog",
    title: "Blog",
    description: "Technical essays, experiments, and lessons from building software.",
  },
  "dev-log": {
    collection: "dev-log",
    title: "Dev Log",
    description: "Progress notes and practical lessons from projects in motion.",
  },
  home: {
    collection: "home",
    title: "Maximilian Mauroner",
    description: "Software projects, technical writing, experiments, and useful tools.",
  },
  snacks: {
    collection: "snacks",
    title: "Snacks",
    description: "Short notes, useful links, and ideas worth keeping.",
  },
  tags: {
    collection: "tags",
    title: "Browse by topic",
    description: "Explore blog posts, dev logs, and snacks by subject.",
  },
  tools: {
    collection: "tools",
    title: "Tools",
    description: "Browser-based utilities and experiments built by Maximilian Mauroner.",
  },
};

export function getStaticPaths() {
  return Object.entries(sections).map(([slug, props]) => ({
    params: { slug },
    props,
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { collection, description, title } = props as SectionOg;
  const png = await renderOgImage({ collection, description, title });

  return new Response(new Uint8Array(png), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/png",
    },
  });
};
