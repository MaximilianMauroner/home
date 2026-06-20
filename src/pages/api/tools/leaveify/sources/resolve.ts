import type { APIRoute } from "astro";

import {
  fetchSpotifyPlaylistSource,
  LeaveifyApiError,
  parseSpotifyPlaylistId,
  requireProviderAccessToken,
} from "@/utils/leaveify";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, request }) => {
  try {
    const body = (await request.json().catch(() => null)) as {
      input?: unknown;
    } | null;
    const input = typeof body?.input === "string" ? body.input : "";
    const playlistId = parseSpotifyPlaylistId(input);

    if (!playlistId) {
      return Response.json(
        { error: "Paste a Spotify playlist URL or URI." },
        { status: 400 },
      );
    }

    const spotifyToken = await requireProviderAccessToken(cookies, "spotify");
    const playlist = await fetchSpotifyPlaylistSource(spotifyToken, playlistId);

    return Response.json({ playlist });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not add Spotify playlist.";
    const status = error instanceof LeaveifyApiError ? error.status : 500;
    return Response.json({ error: message }, { status });
  }
};
