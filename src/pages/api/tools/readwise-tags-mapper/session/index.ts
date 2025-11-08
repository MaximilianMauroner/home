import type { APIRoute } from "astro";

import {
  buildAccessTokenCookie,
  clearAccessTokenCookie,
  getAccessTokenFromRequest,
  verifyTokenWithReadwise,
} from "@/components/tools/ReadwiseTagsMapper/utils/session";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const token = getAccessTokenFromRequest(request);
  return Response.json({ authenticated: Boolean(token) });
};

export const POST: APIRoute = async ({ request }) => {
  const payload = (await request.json().catch(() => ({}))) as {
    token?: string | null;
  };
  const token = payload.token?.trim();

  if (!token) {
    return Response.json(
      { error: "The 'token' field is required" },
      { status: 400 },
    );
  }

  try {
    await verifyTokenWithReadwise(token);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Token validation failed";
    return Response.json({ error: message }, { status: 401 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": buildAccessTokenCookie(token),
    },
  });
};

export const DELETE: APIRoute = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": clearAccessTokenCookie(),
    },
  });
