import type { APIRoute } from "astro";

import {
  createOAuthState,
  createPkcePair,
  getTidalAuthorizationUrl,
  LeaveifyApiError,
  setOAuthCookies,
} from "@/utils/leaveify";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect, url }) => {
  try {
    const state = createOAuthState();
    const { challenge, verifier } = createPkcePair();
    setOAuthCookies(cookies, "tidal", state, verifier);

    return redirect(
      getTidalAuthorizationUrl({
        challenge,
        origin: url.origin,
        state,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start TIDAL OAuth";
    const status = error instanceof LeaveifyApiError ? error.status : 500;
    return Response.json({ error: message }, { status });
  }
};
