import type { APIRoute } from "astro";

import {
  getAccessTokenFromRequest,
  verifyTokenWithReadwise,
} from "@/components/tools/ReadwiseTagsMapper/utils/session";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string | null;
  };

  const suppliedToken = body.token?.trim() ?? null;
  const cookieToken = getAccessTokenFromRequest(request);
  const token = suppliedToken ?? cookieToken;

  if (!token) {
    return Response.json(
      { error: "No token supplied or stored" },
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

  return new Response(null, { status: 204 });
};
