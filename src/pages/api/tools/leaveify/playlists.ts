import type { APIRoute } from "astro";

import {
  fetchSpotifySources,
  LeaveifyApiError,
  requireProviderAccessToken,
} from "@/utils/leaveify";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const spotifyToken = await requireProviderAccessToken(cookies, "spotify");
    const playlists = await fetchSpotifySources(spotifyToken);
    return Response.json({ playlists });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not fetch playlists";
    const status = error instanceof LeaveifyApiError ? error.status : 500;
    return Response.json({ error: message }, { status });
  }
};
