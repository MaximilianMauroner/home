import type { APIRoute } from "astro";
import { getBlogs, getLogs, getSnacks } from "@/utils/server/content";
import { renderOgImage, type OgCollection } from "@/utils/server/og";

interface OgProps {
  title: string;
  description: string;
  collection: OgCollection;
  releaseDate: Date;
}

export async function getStaticPaths() {
  const [blogs, logs, snacks] = await Promise.all([
    getBlogs(),
    getLogs(),
    getSnacks(),
  ]);

  const paths: { params: { slug: string }; props: OgProps }[] = [];

  for (const entry of blogs) {
    paths.push({
      params: { slug: `blog/${entry.id}` },
      props: {
        title: entry.data.title,
        description: entry.data.description,
        collection: "blog",
        releaseDate: entry.data.releaseDate,
      },
    });
  }
  for (const entry of logs) {
    paths.push({
      params: { slug: `dev-log/${entry.id}` },
      props: {
        title: entry.data.title,
        description: entry.data.description,
        collection: "dev-log",
        releaseDate: entry.data.releaseDate,
      },
    });
  }
  for (const entry of snacks) {
    paths.push({
      params: { slug: `snacks/${entry.id}` },
      props: {
        title: entry.data.title,
        description: entry.data.description,
        collection: "snacks",
        releaseDate: entry.data.releaseDate,
      },
    });
  }

  return paths;
};

export const GET: APIRoute = async ({ props }) => {
  const { title, description, collection, releaseDate } = props as OgProps;
  const png = await renderOgImage({
    title,
    description,
    collection,
    date: releaseDate ? new Date(releaseDate) : undefined,
  });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
