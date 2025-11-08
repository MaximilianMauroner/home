import type { APIRoute } from "astro";

import {
  extractHashtags,
  getDocumentById,
  updateDocumentApi,
} from "@/components/tools/ReadwiseTagsMapper/utils/readwise";
import { getAccessTokenFromRequest } from "@/components/tools/ReadwiseTagsMapper/utils/session";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const id = params.id;

  if (!id) {
    return Response.json({ error: "Document id is required" }, { status: 400 });
  }

  const token = getAccessTokenFromRequest(request);
  if (!token) {
    return Response.json(
      { error: "Missing Readwise access token cookie" },
      { status: 401 },
    );
  }

  const doc = await getDocumentById(token, id);

  return Response.json({
    doc,
    tags: extractHashtags(doc?.summary),
  });
};

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id;

  if (!id) {
    return Response.json({ error: "Document id is required" }, { status: 400 });
  }

  const token = getAccessTokenFromRequest(request);
  if (!token) {
    return Response.json(
      { error: "Missing Readwise access token cookie" },
      { status: 401 },
    );
  }

  const data = (await request.json().catch(() => ({}))) as {
    tags?: string[];
  };

  if (!Array.isArray(data.tags)) {
    return Response.json(
      { error: "The 'tags' field must be an array" },
      { status: 400 },
    );
  }

  const response = await updateDocumentApi(token, id, {
    tags: data.tags,
  });

  return Response.json(response);
};
