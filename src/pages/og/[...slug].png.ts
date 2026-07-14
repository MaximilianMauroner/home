import type { APIRoute } from "astro";
import {
  ARTICLE_COLLECTIONS,
  getArticlesByCollection,
} from "@/utils/server/content";
import { renderOgImage, type OgCollection } from "@/utils/server/og";

interface OgProps {
  title: string;
  description: string;
  collection: OgCollection;
  releaseDate: Date;
}

export async function getStaticPaths() {
  const paths: { params: { slug: string }; props: OgProps }[] = [];

  for (const descriptor of ARTICLE_COLLECTIONS) {
    const entries = await getArticlesByCollection(descriptor.collection);
    const pathSegment = descriptor.pathPrefix.replace(/^\/|\/$/g, "");
    for (const entry of entries) {
      paths.push({
        params: { slug: `${pathSegment}/${entry.id}` },
        props: {
          title: entry.data.title,
          description: entry.data.description,
          collection: descriptor.ogCollection,
          releaseDate: entry.data.releaseDate,
        },
      });
    }
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
