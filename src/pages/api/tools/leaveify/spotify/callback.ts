import type { APIRoute } from "astro";

import {
  clearOAuthCookies,
  exchangeSpotifyCode,
  getOAuthCookies,
  setProviderTokens,
} from "@/utils/leaveify";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect, url }) => {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const stored = getOAuthCookies(cookies, "spotify");

  if (error) {
    clearOAuthCookies(cookies, "spotify");
    return redirect(
      `/tools/leaveify/?spotify_error=${encodeURIComponent(error)}`,
    );
  }

  if (
    !code ||
    !state ||
    !stored.state ||
    state !== stored.state ||
    !stored.verifier
  ) {
    clearOAuthCookies(cookies, "spotify");
    return redirect("/tools/leaveify/?spotify_error=invalid_oauth_state");
  }

  try {
    const tokens = await exchangeSpotifyCode({
      code,
      origin: url.origin,
      verifier: stored.verifier,
    });
    setProviderTokens(cookies, "spotify", tokens);
    clearOAuthCookies(cookies, "spotify");
    return redirect("/tools/leaveify/?connected=spotify");
  } catch (callbackError) {
    const message =
      callbackError instanceof Error
        ? callbackError.message
        : "spotify_callback_failed";
    clearOAuthCookies(cookies, "spotify");
    return redirect(
      `/tools/leaveify/?spotify_error=${encodeURIComponent(message)}`,
    );
  }
};
