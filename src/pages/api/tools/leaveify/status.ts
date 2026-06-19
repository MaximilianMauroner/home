import type { APIRoute } from "astro";

import {
  getSpotifyClientId,
  getTidalClientId,
  getTidalCountryCode,
  hasProviderSession,
} from "@/utils/leaveify";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) =>
  Response.json({
    configured: {
      spotify: Boolean(getSpotifyClientId()),
      tidal: Boolean(getTidalClientId()),
    },
    connected: {
      spotify: hasProviderSession(cookies, "spotify"),
      tidal: hasProviderSession(cookies, "tidal"),
    },
    countryCode: getTidalCountryCode(),
    ready: Boolean(getSpotifyClientId() && getTidalClientId()),
  });
