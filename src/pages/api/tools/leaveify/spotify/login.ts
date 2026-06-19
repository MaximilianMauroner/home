import type { APIRoute } from "astro";

import {
  createOAuthState,
  createPkcePair,
  getSpotifyAuthorizationUrl,
  LeaveifyApiError,
  setOAuthCookies,
} from "@/utils/leaveify";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect, url }) => {
  try {
    const state = createOAuthState();
    const { challenge, verifier } = createPkcePair();
    setOAuthCookies(cookies, "spotify", state, verifier);

    return redirect(
      getSpotifyAuthorizationUrl({
        challenge,
        origin: url.origin,
        state,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start Spotify OAuth";
    const status = error instanceof LeaveifyApiError ? error.status : 500;
    return Response.json({ error: message }, { status });
  }
};
