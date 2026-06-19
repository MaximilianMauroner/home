import type { APIRoute } from "astro";

import {
  clearOAuthCookies,
  exchangeTidalCode,
  getOAuthCookies,
  setProviderTokens,
} from "@/utils/leaveify";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect, url }) => {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const stored = getOAuthCookies(cookies, "tidal");

  if (error) {
    clearOAuthCookies(cookies, "tidal");
    return redirect(
      `/tools/leaveify/?tidal_error=${encodeURIComponent(error)}`,
    );
  }

  if (
    !code ||
    !state ||
    !stored.state ||
    state !== stored.state ||
    !stored.verifier
  ) {
    clearOAuthCookies(cookies, "tidal");
    return redirect("/tools/leaveify/?tidal_error=invalid_oauth_state");
  }

  try {
    const tokens = await exchangeTidalCode({
      code,
      origin: url.origin,
      verifier: stored.verifier,
    });
    setProviderTokens(cookies, "tidal", tokens);
    clearOAuthCookies(cookies, "tidal");
    return redirect("/tools/leaveify/?connected=tidal");
  } catch (callbackError) {
    const message =
      callbackError instanceof Error
        ? callbackError.message
        : "tidal_callback_failed";
    clearOAuthCookies(cookies, "tidal");
    return redirect(
      `/tools/leaveify/?tidal_error=${encodeURIComponent(message)}`,
    );
  }
};
