import type { APIRoute } from "astro";

import {
  extractHashtags,
  getDocumentPage,
} from "@/components/tools/ReadwiseTagsMapper/utils/readwise";
import { getAccessTokenFromRequest } from "@/components/tools/ReadwiseTagsMapper/utils/session";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const token = getAccessTokenFromRequest(request);
  if (!token) {
    return Response.json(
      { error: "Missing Readwise access token cookie" },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    locations?: string[];
    categories?: string[];
    cursor?: string | null;
  };

  const locations = Array.isArray(body.locations) ? body.locations : [];
  const categories = Array.isArray(body.categories) ? body.categories : [];
  const cursor =
    typeof body.cursor === "string" || body.cursor === null
      ? body.cursor
      : null;

  const { docs, nextPageCursor } = await getDocumentPage(
    token,
    locations,
    categories,
    cursor,
  );

  return Response.json({
    docs: docs.map((doc) => ({
      doc,
      tags: extractHashtags(doc?.summary),
    })),
    nextPageCursor,
  });
};
