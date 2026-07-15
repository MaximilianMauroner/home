import type { APIRoute } from "astro";

import { getPostSearchDocuments } from "@/utils/server/searchIndex";
import { serializePostSearchIndex } from "@/utils/searchIndex";

export const prerender = true;

export const GET: APIRoute = async () => {
  const documents = await getPostSearchDocuments();
  const body = serializePostSearchIndex(documents);

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};
