import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { APIRoute } from "astro";

import type {
  CookieStore,
  SpotifyTrackForTransfer,
  TidalTrackMatch,
} from "../src/utils/leaveify";
import {
  getSpotifyAuthorizationUrl,
  getTidalAuthorizationUrl,
  SPOTIFY_LIKED_SONGS_SOURCE_ID,
} from "../src/utils/leaveify";
import {
  createLeaveifyTransferControl,
  LeaveifyTransferCancelledError,
} from "../src/utils/leaveifyTransferControl";

process.env.TIDAL_CLIENT_ID = "";
process.env.TIDAL_CLIENT_SECRET = "";
process.env.TIDAL_COUNTRY_CODE = "US";
process.env.LEAVEIFY_DEBUG = "false";

const { POST } = (await import("../src/pages/api/tools/leaveify/transfer")) as {
  POST: APIRoute;
};
const { PATCH: PATCH_TRANSFER_CONTROL } = (await import(
  "../src/pages/api/tools/leaveify/transfer/[requestId]"
)) as {
  PATCH: APIRoute;
};

const originalFetch = globalThis.fetch;

type TransferResponse = {
  addedTracks: number;
  deduplicateTracks: boolean;
  duplicateTracksSkipped: number;
  matched: Array<{
    method: TidalTrackMatch["method"];
    sourceName: string;
    tidalId: string;
  }>;
  matchedTracks: number;
  sourcePlaylist: {
    id: string;
    name: string;
    spotifyUrl: string | null;
    tracksTotal: number;
  };
  sourceTracks: number;
  unmatched: Array<{
    name: string;
  }>;
  unmatchedTracks: number;
};

type ProviderFixture = {
  isrcMatches: Map<string, TidalTrackMatch>;
  likedTracks?: SpotifyTrackForTransfer[];
  playlistId?: string;
  playlistName?: string;
  searchDelayMs?: number;
  searchMatches?: Map<string, TidalTrackMatch | null>;
  tracks: SpotifyTrackForTransfer[];
};

function createSessionCookies({
  includeTidal = true,
}: {
  includeTidal?: boolean;
} = {}): CookieStore {
  const values = new Map([
    ["leaveify_spotify_access_token", "spotify-user-token"],
    ["leaveify_spotify_expires_at", String(Date.now() + 60 * 60 * 1000)],
  ]);

  if (includeTidal) {
    values.set("leaveify_tidal_access_token", "tidal-user-token");
    values.set(
      "leaveify_tidal_expires_at",
      String(Date.now() + 60 * 60 * 1000),
    );
  }

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

function spotifyTrack(
  overrides: Partial<SpotifyTrackForTransfer>,
): SpotifyTrackForTransfer {
  return {
    albumName: "Source Album",
    artists: ["Source Artist"],
    durationMs: 180_000,
    id: "spotify-track",
    isrc: null,
    name: "Source Track",
    spotifyUrl: "https://open.spotify.com/track/spotify-track",
    ...overrides,
  };
}

function tidalMatch(
  overrides: Partial<TidalTrackMatch> & Pick<TidalTrackMatch, "id">,
): TidalTrackMatch {
  return {
    durationMs: 180_000,
    isrc: null,
    method: "isrc",
    title: "TIDAL Track",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function tidalDuration(durationMs: number | null) {
  if (!durationMs) {
    return undefined;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `PT${minutes}M${seconds}S`;
}

function tidalIncludedResources(match: TidalTrackMatch) {
  const artistResources =
    match.artists?.map((name, index) => ({
      attributes: { name },
      id: `${match.id}-artist-${index}`,
      type: "artists",
    })) ?? [];

  return [
    {
      attributes: {
        duration: tidalDuration(match.durationMs),
        isrc: match.isrc,
        title: match.title,
      },
      id: match.id,
      relationships:
        artistResources.length > 0
          ? {
              artists: {
                data: artistResources.map((artist) => ({
                  id: artist.id,
                  type: artist.type,
                })),
              },
            }
          : undefined,
      type: "tracks",
    },
    ...artistResources,
  ];
}

function installProviderFetch({
  isrcMatches,
  likedTracks = [],
  playlistId = "spotify-playlist",
  playlistName = "Source Playlist",
  searchDelayMs = 0,
  searchMatches = new Map(),
  tracks,
}: ProviderFixture) {
  const addedTrackChunks: string[][] = [];
  const tidalRequests: Array<{
    authorization: string | null;
    pathname: string;
  }> = [];
  let activeSearchRequests = 0;
  let maxActiveSearchRequests = 0;

  globalThis.fetch = (async (input, init) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );
    const authorization = new Headers(init?.headers).get("Authorization");

    if (
      url.origin === "https://auth.tidal.com" &&
      url.pathname === "/v1/oauth2/token"
    ) {
      return jsonResponse({
        access_token: "tidal-client-token",
        expires_in: 3600,
        token_type: "Bearer",
      });
    }

    if (
      url.origin === "https://api.spotify.com" &&
      url.pathname === "/v1/me/tracks"
    ) {
      return jsonResponse({
        items: likedTracks.map((track) => ({
          added_at: "2026-06-19T12:00:00Z",
          track: {
            album: { name: track.albumName },
            artists: track.artists.map((name) => ({ name })),
            duration_ms: track.durationMs,
            external_ids: track.isrc ? { isrc: track.isrc } : {},
            external_urls: track.spotifyUrl
              ? { spotify: track.spotifyUrl }
              : undefined,
            id: track.id,
            name: track.name,
            type: "track",
          },
        })),
        next: null,
        total: likedTracks.length,
      });
    }

    if (
      url.origin === "https://api.spotify.com" &&
      url.pathname === `/v1/playlists/${playlistId}`
    ) {
      return jsonResponse({
        description: null,
        external_urls: {
          spotify: `https://open.spotify.com/playlist/${playlistId}`,
        },
        id: playlistId,
        name: playlistName,
        owner: { display_name: "Spotify User" },
        tracks: { total: tracks.length },
      });
    }

    if (
      url.origin === "https://api.spotify.com" &&
      url.pathname === `/v1/playlists/${playlistId}/tracks`
    ) {
      return jsonResponse({
        items: tracks.map((track) => ({
          is_local: false,
          track: {
            album: { name: track.albumName },
            artists: track.artists.map((name) => ({ name })),
            duration_ms: track.durationMs,
            external_ids: track.isrc ? { isrc: track.isrc } : {},
            external_urls: track.spotifyUrl
              ? { spotify: track.spotifyUrl }
              : undefined,
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
      tidalRequests.push({ authorization, pathname: url.pathname });
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
      url.pathname.startsWith("/v2/searchResults/")
    ) {
      activeSearchRequests += 1;
      maxActiveSearchRequests = Math.max(
        maxActiveSearchRequests,
        activeSearchRequests,
      );
      tidalRequests.push({ authorization, pathname: url.pathname });
      try {
        if (searchDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, searchDelayMs));
        }

        const query = decodeURIComponent(url.pathname.split("/")[3] ?? "");
        const match =
          [...searchMatches.entries()].find(([needle]) =>
            query.includes(needle),
          )?.[1] ?? null;

        return jsonResponse(
          match
            ? {
                data: [{ id: match.id, type: "tracks" }],
                included: tidalIncludedResources(match),
              }
            : { data: [], included: [] },
        );
      } finally {
        activeSearchRequests -= 1;
      }
    }

    if (
      url.origin === "https://openapi.tidal.com" &&
      url.pathname === "/v2/playlists"
    ) {
      tidalRequests.push({ authorization, pathname: url.pathname });
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        data?: { attributes?: { name?: string } };
      };

      return jsonResponse({
        data: {
          attributes: { name: body.data?.attributes?.name ?? "Imported" },
          id: "tidal-playlist",
        },
      });
    }

    if (
      url.origin === "https://openapi.tidal.com" &&
      url.pathname === "/v2/playlists/tidal-playlist/relationships/items"
    ) {
      tidalRequests.push({ authorization, pathname: url.pathname });
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        data?: Array<{ id: string }>;
      };
      addedTrackChunks.push(body.data?.map((track) => track.id) ?? []);
      return jsonResponse({ data: [] });
    }

    throw new Error(`Unexpected provider request: ${url.toString()}`);
  }) as typeof fetch;

  return {
    addedTrackChunks,
    getMaxActiveSearchRequests: () => maxActiveSearchRequests,
    tidalRequests,
  };
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
    body: (await response.json()) as TransferResponse,
    response,
  };
}

async function transferPlaylistStream(
  payload: Record<string, unknown>,
  options: { cookies?: CookieStore } = {},
) {
  const response = await POST({
    cookies: options.cookies ?? createSessionCookies(),
    request: new Request("http://localhost/api/tools/leaveify/transfer", {
      body: JSON.stringify(payload),
      headers: {
        Accept: "application/x-ndjson",
        "Content-Type": "application/json",
      },
      method: "POST",
    }),
  } as Parameters<APIRoute>[0]);
  const text = await response.text();
  const events = text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line)) as Array<{
    error?: string;
    progress?: { phase: string; tracksProcessed?: number };
    result?: TransferResponse;
    status?: number;
    type: string;
  }>;

  return { events, response };
}

async function updateTransferControl(
  requestId: string,
  action: "cancel" | "pause" | "resume",
) {
  return PATCH_TRANSFER_CONTROL({
    params: { requestId },
    request: new Request(
      `http://localhost/api/tools/leaveify/transfer/${requestId}`,
      {
        body: JSON.stringify({ action }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
    ),
  } as unknown as Parameters<APIRoute>[0]);
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

describe("Leaveify OAuth", () => {
  test("requests the Spotify user library scope needed for Liked Songs", () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "spotify-client-id");

    const authorizationUrl = new URL(
      getSpotifyAuthorizationUrl({
        challenge: "challenge",
        origin: "http://localhost:4321",
        state: "state",
      }),
    );

    expect(authorizationUrl.searchParams.get("client_id")).toBe(
      "spotify-client-id",
    );
    expect(authorizationUrl.searchParams.get("scope")?.split(" ")).toEqual([
      "playlist-read-private",
      "playlist-read-collaborative",
      "user-library-read",
      "user-read-private",
    ]);
  });

  test("requests the TIDAL user scopes required by transfer endpoints", () => {
    vi.stubEnv("TIDAL_CLIENT_ID", "tidal-client-id");

    const authorizationUrl = new URL(
      getTidalAuthorizationUrl({
        challenge: "challenge",
        origin: "http://localhost:4321",
        state: "state",
      }),
    );

    expect(authorizationUrl.searchParams.get("client_id")).toBe(
      "tidal-client-id",
    );
    expect(authorizationUrl.searchParams.get("scope")?.split(" ")).toEqual([
      "playlists.write",
      "search.read",
      "user.read",
    ]);
  });
});

describe("Leaveify transfer", () => {
  test("pauses, resumes, and cancels an active transfer control", async () => {
    const control = createLeaveifyTransferControl("transfer-control-test");

    const pausedResponse = await updateTransferControl(
      "transfer-control-test",
      "pause",
    );
    expect(pausedResponse.status).toBe(200);
    await expect(pausedResponse.json()).resolves.toMatchObject({
      cancelled: false,
      paused: true,
      requestId: "transfer-control-test",
    });

    const resumedResponse = await updateTransferControl(
      "transfer-control-test",
      "resume",
    );
    expect(resumedResponse.status).toBe(200);
    await expect(resumedResponse.json()).resolves.toMatchObject({
      cancelled: false,
      paused: false,
      requestId: "transfer-control-test",
    });

    const cancelledResponse = await updateTransferControl(
      "transfer-control-test",
      "cancel",
    );
    expect(cancelledResponse.status).toBe(200);
    await expect(cancelledResponse.json()).resolves.toMatchObject({
      cancelled: true,
      paused: false,
      requestId: "transfer-control-test",
    });
    await expect(control.checkpoint()).rejects.toBeInstanceOf(
      LeaveifyTransferCancelledError,
    );

    control.dispose();
  });

  test("keeps duplicate matched entries when deduplication is not requested", async () => {
    const provider = installProviderFetch({
      isrcMatches: new Map([
        [
          "ISRC1",
          tidalMatch({ id: "tidal-1", isrc: "ISRC1", title: "First Song" }),
        ],
        [
          "ISRC2",
          tidalMatch({ id: "tidal-2", isrc: "ISRC2", title: "Second Song" }),
        ],
      ]),
      tracks: [
        spotifyTrack({ id: "spotify-1", isrc: "ISRC1", name: "First Song" }),
        spotifyTrack({ id: "spotify-1", isrc: "ISRC1", name: "First Song" }),
        spotifyTrack({ id: "spotify-2", isrc: "ISRC2", name: "Second Song" }),
      ],
    });

    const { body, response } = await transferPlaylist({
      playlistId: "spotify-playlist",
    });

    expect(response.status).toBe(200);
    expect(body.addedTracks).toBe(3);
    expect(body.deduplicateTracks).toBe(false);
    expect(body.duplicateTracksSkipped).toBe(0);
    expect(body.matchedTracks).toBe(3);
    expect(body.unmatchedTracks).toBe(0);
    expect(provider.addedTrackChunks).toEqual([
      ["tidal-1", "tidal-1", "tidal-2"],
    ]);
  });

  test("deduplicates matched entries when deduplication is requested", async () => {
    const provider = installProviderFetch({
      isrcMatches: new Map([
        [
          "ISRC1",
          tidalMatch({ id: "tidal-1", isrc: "ISRC1", title: "First Song" }),
        ],
        [
          "ISRC2",
          tidalMatch({ id: "tidal-2", isrc: "ISRC2", title: "Second Song" }),
        ],
      ]),
      tracks: [
        spotifyTrack({ id: "spotify-1", isrc: "ISRC1", name: "First Song" }),
        spotifyTrack({ id: "spotify-1", isrc: "ISRC1", name: "First Song" }),
        spotifyTrack({ id: "spotify-2", isrc: "ISRC2", name: "Second Song" }),
      ],
    });

    const { body, response } = await transferPlaylist({
      deduplicateTracks: true,
      playlistId: "spotify-playlist",
    });

    expect(response.status).toBe(200);
    expect(body.addedTracks).toBe(2);
    expect(body.deduplicateTracks).toBe(true);
    expect(body.duplicateTracksSkipped).toBe(1);
    expect(body.matchedTracks).toBe(3);
    expect(body.unmatchedTracks).toBe(0);
    expect(provider.addedTrackChunks).toEqual([["tidal-1", "tidal-2"]]);
  });

  test("reports search matches and unmatched source tracks", async () => {
    const provider = installProviderFetch({
      isrcMatches: new Map([
        [
          "ISRC1",
          tidalMatch({ id: "tidal-isrc", isrc: "ISRC1", title: "ISRC Song" }),
        ],
      ]),
      searchMatches: new Map([
        [
          "Search Song",
          tidalMatch({
            id: "tidal-search",
            isrc: null,
            method: "search",
            title: "Search Song",
          }),
        ],
      ]),
      tracks: [
        spotifyTrack({ id: "spotify-isrc", isrc: "ISRC1", name: "ISRC Song" }),
        spotifyTrack({
          albumName: "Search Album",
          artists: ["Search Artist"],
          id: "spotify-search",
          isrc: null,
          name: "Search Song",
        }),
        spotifyTrack({
          albumName: "Missing Album",
          artists: ["Missing Artist"],
          id: "spotify-missing",
          isrc: null,
          name: "Missing Song",
        }),
      ],
    });

    const { body, response } = await transferPlaylist({
      playlistId: "spotify-playlist",
    });

    expect(response.status).toBe(200);
    expect(body.addedTracks).toBe(2);
    expect(body.matchedTracks).toBe(2);
    expect(body.sourceTracks).toBe(3);
    expect(body.unmatchedTracks).toBe(1);
    expect(provider.addedTrackChunks).toEqual([["tidal-isrc", "tidal-search"]]);
    expect(
      body.matched.map(({ method, sourceName, tidalId }) => ({
        method,
        sourceName,
        tidalId,
      })),
    ).toEqual([
      { method: "isrc", sourceName: "ISRC Song", tidalId: "tidal-isrc" },
      { method: "search", sourceName: "Search Song", tidalId: "tidal-search" },
    ]);
    expect(body.unmatched.map((track) => track.name)).toEqual(["Missing Song"]);
  });

  test("accepts exact-title search matches with close duration confidence", async () => {
    const provider = installProviderFetch({
      isrcMatches: new Map(),
      searchMatches: new Map([
        [
          "Specific Search Song",
          tidalMatch({
            durationMs: 182_000,
            id: "tidal-specific",
            isrc: null,
            method: "search",
            title: "Specific Search Song",
          }),
        ],
      ]),
      tracks: [
        spotifyTrack({
          artists: ["Source Artist"],
          durationMs: 181_000,
          id: "spotify-specific",
          isrc: null,
          name: "Specific Search Song",
        }),
      ],
    });

    const { body, response } = await transferPlaylist({
      playlistId: "spotify-playlist",
    });

    expect(response.status).toBe(200);
    expect(body.matchedTracks).toBe(1);
    expect(body.unmatchedTracks).toBe(0);
    expect(provider.addedTrackChunks).toEqual([["tidal-specific"]]);
  });

  test("rejects common-title search matches with poor duration confidence", async () => {
    const provider = installProviderFetch({
      isrcMatches: new Map(),
      searchMatches: new Map([
        [
          "Intro",
          tidalMatch({
            durationMs: 180_000,
            id: "tidal-wrong-intro",
            isrc: null,
            method: "search",
            title: "Intro",
          }),
        ],
      ]),
      tracks: [
        spotifyTrack({
          artists: ["Source Artist"],
          durationMs: 60_000,
          id: "spotify-intro",
          isrc: null,
          name: "Intro",
        }),
      ],
    });

    const { body, response } = await transferPlaylist({
      playlistId: "spotify-playlist",
    });

    expect(response.status).toBe(200);
    expect(body.matchedTracks).toBe(0);
    expect(body.unmatchedTracks).toBe(1);
    expect(body.unmatched.map((track) => track.name)).toEqual(["Intro"]);
    expect(provider.addedTrackChunks).toEqual([]);
  });

  test("rejects exact-title search matches when TIDAL artists conflict", async () => {
    const provider = installProviderFetch({
      isrcMatches: new Map(),
      searchMatches: new Map([
        [
          "Home",
          tidalMatch({
            artists: ["Different Artist"],
            id: "tidal-wrong-home",
            isrc: null,
            method: "search",
            title: "Home",
          }),
        ],
      ]),
      tracks: [
        spotifyTrack({
          artists: ["Source Artist"],
          id: "spotify-home",
          isrc: null,
          name: "Home",
        }),
      ],
    });

    const { body, response } = await transferPlaylist({
      playlistId: "spotify-playlist",
    });

    expect(response.status).toBe(200);
    expect(body.matchedTracks).toBe(0);
    expect(body.unmatchedTracks).toBe(1);
    expect(body.unmatched.map((track) => track.name)).toEqual(["Home"]);
    expect(provider.addedTrackChunks).toEqual([]);
  });

  test("bounds fallback TIDAL search concurrency", async () => {
    const tracks = Array.from({ length: 6 }, (_, index) =>
      spotifyTrack({
        id: `spotify-concurrent-${index + 1}`,
        isrc: null,
        name: `Concurrent Song ${index + 1}`,
      }),
    );
    const provider = installProviderFetch({
      isrcMatches: new Map(),
      searchDelayMs: 25,
      searchMatches: new Map(
        tracks.map((track, index) => [
          track.name,
          tidalMatch({
            id: `tidal-concurrent-${index + 1}`,
            isrc: null,
            method: "search",
            title: track.name,
          }),
        ]),
      ),
      tracks,
    });

    const { body, response } = await transferPlaylist({
      playlistId: "spotify-playlist",
    });

    expect(response.status).toBe(200);
    expect(body.matchedTracks).toBe(tracks.length);
    expect(provider.getMaxActiveSearchRequests()).toBeGreaterThan(1);
    expect(provider.getMaxActiveSearchRequests()).toBeLessThanOrEqual(3);
  });

  test("caches identical fallback searches within one transfer run", async () => {
    const provider = installProviderFetch({
      isrcMatches: new Map(),
      searchMatches: new Map([
        [
          "Repeated Song",
          tidalMatch({
            id: "tidal-repeated",
            isrc: null,
            method: "search",
            title: "Repeated Song",
          }),
        ],
      ]),
      tracks: [
        spotifyTrack({
          albumName: "Repeated Album",
          artists: ["Repeated Artist"],
          id: "spotify-repeated-1",
          isrc: null,
          name: "Repeated Song",
        }),
        spotifyTrack({
          albumName: "Repeated Album",
          artists: ["Repeated Artist"],
          id: "spotify-repeated-2",
          isrc: null,
          name: "Repeated Song",
        }),
      ],
    });

    const { body, response } = await transferPlaylist({
      playlistId: "spotify-playlist",
    });

    const searchRequests = provider.tidalRequests.filter(({ pathname }) =>
      pathname.startsWith("/v2/searchResults/"),
    );
    expect(response.status).toBe(200);
    expect(searchRequests).toHaveLength(1);
    expect(body.matchedTracks).toBe(2);
    expect(body.addedTracks).toBe(2);
    expect(provider.addedTrackChunks).toEqual([
      ["tidal-repeated", "tidal-repeated"],
    ]);
  });

  test("transfers Spotify Liked Songs as a synthetic source", async () => {
    const provider = installProviderFetch({
      isrcMatches: new Map([
        [
          "LIKEDISRC",
          tidalMatch({
            id: "tidal-liked",
            isrc: "LIKEDISRC",
            title: "Liked Song",
          }),
        ],
      ]),
      likedTracks: [
        spotifyTrack({
          id: "spotify-liked",
          isrc: "LIKEDISRC",
          name: "Liked Song",
          spotifyUrl: "https://open.spotify.com/track/spotify-liked",
        }),
      ],
      tracks: [],
    });

    const { body, response } = await transferPlaylist({
      playlistId: SPOTIFY_LIKED_SONGS_SOURCE_ID,
    });

    expect(response.status).toBe(200);
    expect(body.sourcePlaylist).toEqual({
      id: SPOTIFY_LIKED_SONGS_SOURCE_ID,
      name: "Liked Songs",
      spotifyUrl: null,
      tracksTotal: 1,
    });
    expect(body.sourceTracks).toBe(1);
    expect(body.matchedTracks).toBe(1);
    expect(body.addedTracks).toBe(1);
    expect(provider.addedTrackChunks).toEqual([["tidal-liked"]]);
  });

  test("streams preflight auth failures with the matching HTTP status", async () => {
    const { events, response } = await transferPlaylistStream(
      {
        playlistId: "spotify-playlist",
      },
      {
        cookies: createSessionCookies({ includeTidal: false }),
      },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toContain(
      "application/x-ndjson",
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      error: "Connect tidal before continuing",
      status: 401,
      type: "error",
    });
  });

  test("streams song-level progress before the final transfer result", async () => {
    installProviderFetch({
      isrcMatches: new Map([
        [
          "ISRC1",
          tidalMatch({ id: "tidal-1", isrc: "ISRC1", title: "First Song" }),
        ],
      ]),
      searchMatches: new Map([
        [
          "Second Song",
          tidalMatch({
            id: "tidal-2",
            isrc: null,
            method: "search",
            title: "Second Song",
          }),
        ],
      ]),
      tracks: [
        spotifyTrack({ id: "spotify-1", isrc: "ISRC1", name: "First Song" }),
        spotifyTrack({ id: "spotify-2", isrc: null, name: "Second Song" }),
      ],
    });

    const { events, response } = await transferPlaylistStream({
      playlistId: "spotify-playlist",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain(
      "application/x-ndjson",
    );
    expect(events.map((event) => event.type)).toContain("progress");
    expect(
      events
        .filter((event) => event.type === "progress")
        .map((event) => event.progress?.phase),
    ).toEqual(
      expect.arrayContaining([
        "loading_source",
        "matching_search",
        "adding_tracks",
        "done",
      ]),
    );
    expect(events.at(-1)?.type).toBe("result");
    expect(events.at(-1)?.result?.matchedTracks).toBe(2);
    expect(events.at(-1)?.result?.addedTracks).toBe(2);
  });

  test("uses client credentials for TIDAL search when available", async () => {
    vi.stubEnv("TIDAL_CLIENT_ID", "tidal-client-id");
    vi.stubEnv("TIDAL_CLIENT_SECRET", "tidal-client-secret");

    const provider = installProviderFetch({
      isrcMatches: new Map(),
      searchMatches: new Map([
        [
          "Search Song",
          tidalMatch({
            id: "tidal-search",
            isrc: null,
            method: "search",
            title: "Search Song",
          }),
        ],
      ]),
      tracks: [
        spotifyTrack({
          albumName: "Search Album",
          artists: ["Search Artist"],
          id: "spotify-search",
          isrc: null,
          name: "Search Song",
        }),
      ],
    });

    const { response } = await transferPlaylist({
      playlistId: "spotify-playlist",
    });

    expect(response.status).toBe(200);
    expect(
      provider.tidalRequests
        .filter(({ pathname }) => pathname.startsWith("/v2/searchResults/"))
        .map(({ authorization }) => authorization),
    ).toContain("Bearer tidal-client-token");
    expect(
      provider.tidalRequests
        .filter(
          ({ pathname }) =>
            pathname === "/v2/playlists" ||
            pathname === "/v2/playlists/tidal-playlist/relationships/items",
        )
        .map(({ authorization }) => authorization),
    ).toEqual(["Bearer tidal-user-token", "Bearer tidal-user-token"]);
  });
});
