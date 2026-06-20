import type { APIRoute } from "astro";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  createLeaveifyTransferReport,
  type LeaveifyTransferPartialFailure,
} from "../src/components/tools/Leaveify/report";
import type {
  CookieStore,
  SpotifyTrackForTransfer,
  TidalTrackMatch,
} from "../src/utils/leaveify";

process.env.TIDAL_CLIENT_ID = "";
process.env.TIDAL_CLIENT_SECRET = "";
process.env.TIDAL_COUNTRY_CODE = "US";
process.env.LEAVEIFY_DEBUG = "false";

const { POST } = (await import("../src/pages/api/tools/leaveify/transfer")) as {
  POST: APIRoute;
};

const originalFetch = globalThis.fetch;

type TransferFailureResponse = {
  error: string;
  partial?: LeaveifyTransferPartialFailure;
  requestId: string;
};

function createSessionCookies(): CookieStore {
  const values = new Map([
    ["leaveify_spotify_access_token", "spotify-user-token"],
    ["leaveify_spotify_expires_at", String(Date.now() + 60 * 60 * 1000)],
    ["leaveify_tidal_access_token", "tidal-user-token"],
    ["leaveify_tidal_expires_at", String(Date.now() + 60 * 60 * 1000)],
  ]);

  return {
    delete(name) {
      values.delete(name);
    },
    get(name) {
      const value = values.get(name);
      return value ? { value } : undefined;
    },
    set(name, value) {
      values.set(name, value);
    },
  };
}

function spotifyTrack(index: number): SpotifyTrackForTransfer {
  return {
    albumName: `Source Album ${index}`,
    artists: [`Source Artist ${index}`],
    durationMs: 180_000,
    id: `spotify-${index}`,
    isrc: `ISRC${index}`,
    name: `Source Track ${index}`,
    spotifyUrl: `https://open.spotify.com/track/spotify-${index}`,
  };
}

function tidalMatch(index: number): TidalTrackMatch {
  return {
    durationMs: 180_000,
    id: `tidal-${index}`,
    isrc: `ISRC${index}`,
    method: "isrc",
    title: `TIDAL Track ${index}`,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function installProviderFetch({
  failAddRequestIndex,
  isrcMatches,
  tracks,
}: {
  failAddRequestIndex: number;
  isrcMatches: Map<string, TidalTrackMatch>;
  tracks: SpotifyTrackForTransfer[];
}) {
  const addedTrackChunks: string[][] = [];
  let addRequestIndex = 0;

  globalThis.fetch = (async (input, init) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );

    if (
      url.origin === "https://api.spotify.com" &&
      url.pathname === "/v1/playlists/spotify-playlist"
    ) {
      return jsonResponse({
        description: null,
        external_urls: {
          spotify: "https://open.spotify.com/playlist/spotify-playlist",
        },
        id: "spotify-playlist",
        name: "Source Playlist",
        owner: { display_name: "Spotify User" },
        tracks: { total: tracks.length },
      });
    }

    if (
      url.origin === "https://api.spotify.com" &&
      url.pathname === "/v1/playlists/spotify-playlist/tracks"
    ) {
      return jsonResponse({
        items: tracks.map((track) => ({
          is_local: false,
          track: {
            album: { name: track.albumName },
            artists: track.artists.map((name) => ({ name })),
            duration_ms: track.durationMs,
            external_ids: { isrc: track.isrc },
            external_urls: { spotify: track.spotifyUrl },
            id: track.id,
            name: track.name,
            type: "track",
          },
        })),
        next: null,
        total: tracks.length,
      });
    }

    if (
      url.origin === "https://openapi.tidal.com" &&
      url.pathname === "/v2/tracks"
    ) {
      return jsonResponse({
        data: url.searchParams.getAll("filter[isrc]").flatMap((isrc) => {
          const match = isrcMatches.get(isrc.toUpperCase());
          if (!match) return [];

          return [
            {
              attributes: {
                duration: "PT3M0S",
                isrc: match.isrc,
                title: match.title,
              },
              id: match.id,
              type: "tracks",
            },
          ];
        }),
      });
    }

    if (
      url.origin === "https://openapi.tidal.com" &&
      url.pathname === "/v2/playlists"
    ) {
      return jsonResponse({
        data: {
          attributes: { name: "Source Playlist (Spotify import)" },
          id: "tidal-playlist",
        },
      });
    }

    if (
      url.origin === "https://openapi.tidal.com" &&
      url.pathname === "/v2/playlists/tidal-playlist/relationships/items"
    ) {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        data?: Array<{ id: string }>;
      };
      const chunk = body.data?.map((track) => track.id) ?? [];

      if (addRequestIndex === failAddRequestIndex) {
        addRequestIndex += 1;
        return jsonResponse({ errors: "TIDAL add failed" }, 503);
      }

      addRequestIndex += 1;
      addedTrackChunks.push(chunk);
      return jsonResponse({ data: [] });
    }

    throw new Error(`Unexpected provider request: ${url.toString()}`);
  }) as typeof fetch;

  return { addedTrackChunks };
}

async function transferPlaylist(payload: Record<string, unknown>) {
  const response = await POST({
    cookies: createSessionCookies(),
    request: new Request("http://localhost/api/tools/leaveify/transfer", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  } as Parameters<APIRoute>[0]);

  return {
    body: (await response.json()) as TransferFailureResponse,
    response,
  };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Leaveify partial add-track failures", () => {
  test("reports created playlist and added count when a later add chunk fails", async () => {
    const tracks = Array.from({ length: 51 }, (_, index) =>
      spotifyTrack(index),
    );
    const provider = installProviderFetch({
      failAddRequestIndex: 1,
      isrcMatches: new Map(
        tracks.map((_, index) => [`ISRC${index}`, tidalMatch(index)]),
      ),
      tracks,
    });

    const { body, response } = await transferPlaylist({
      playlistId: "spotify-playlist",
    });

    expect(response.status).toBe(503);
    expect(body.error).toContain(
      "TIDAL playlist was created, but adding tracks stopped after 50 of 51 tracks",
    );
    expect(provider.addedTrackChunks).toEqual([
      Array.from({ length: 50 }, (_, index) => `tidal-${index}`),
    ]);
    expect(body.partial).toMatchObject({
      addedTracks: 50,
      failedChunkIndex: 1,
      failedChunkStart: 50,
      failedTrackIds: ["tidal-50"],
      kind: "tidal_add_tracks",
      remainingTrackIds: ["tidal-50"],
      sourcePlaylist: {
        id: "spotify-playlist",
        name: "Source Playlist",
        tracksTotal: 51,
      },
      tidalPlaylist: {
        id: "tidal-playlist",
        name: "Source Playlist (Spotify import)",
        url: "https://tidal.com/browse/playlist/tidal-playlist",
      },
      totalTracksToAdd: 51,
    });
    expect(body.partial?.requestId).toBe(body.requestId);

    const report = createLeaveifyTransferReport({
      failures: [
        {
          error: body.error,
          partial: body.partial,
          playlistId: "spotify-playlist",
          playlistName: "Source Playlist",
          requestId: body.requestId,
        },
      ],
      now: new Date("2026-06-19T12:00:00.000Z"),
      results: [],
    });
    expect(
      JSON.parse(JSON.stringify(report)).failures[0].partial,
    ).toMatchObject({
      addedTracks: 50,
      kind: "tidal_add_tracks",
      remainingTrackIds: ["tidal-50"],
    });
  });
});
