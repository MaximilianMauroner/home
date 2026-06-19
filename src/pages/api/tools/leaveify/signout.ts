import type { APIRoute } from "astro";

import { clearProviderTokens } from "@/utils/leaveify";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  clearProviderTokens(cookies, "spotify");
  clearProviderTokens(cookies, "tidal");
  return new Response(null, { status: 204 });
};
