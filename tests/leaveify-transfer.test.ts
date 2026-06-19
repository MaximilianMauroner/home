import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { APIRoute } from "astro";

import type {
  CookieStore,
  SpotifyTrackForTransfer,
  TidalTrackMatch,
} from "../src/utils/leaveify";
import { getTidalAuthorizationUrl } from "../src/utils/leaveify";

process.env.TIDAL_CLIENT_ID = "";
process.env.TIDAL_CLIENT_SECRET = "";
process.env.TIDAL_COUNTRY_CODE = "US";
process.env.LEAVEIFY_DEBUG = "false";

const { POST } = (await import("../src/pages/api/tools/leaveify/transfer")) as {
  POST: APIRoute;
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
  sourceTracks: number;
  unmatched: Array<{
    name: string;
  }>;
  unmatchedTracks: number;
};

type ProviderFixture = {
  isrcMatches: Map<string, TidalTrackMatch>;
  playlistId?: string;
  playlistName?: string;
  searchMatches?: Map<string, TidalTrackMatch | null>;
  tracks: SpotifyTrackForTransfer[];
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

function installProviderFetch({
  isrcMatches,
  playlistId = "spotify-playlist",
  playlistName = "Source Playlist",
  searchMatches = new Map(),
  tracks,
}: ProviderFixture) {
  const addedTrackChunks: string[][] = [];
  const tidalRequests: Array<{ authorization: string | null; pathname: string }> =
    [];

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
      tidalRequests.push({ authorization, pathname: url.pathname });
      const query = decodeURIComponent(url.pathname.split("/")[3] ?? "");
      const match =
        [...searchMatches.entries()].find(([needle]) =>
          query.includes(needle),
        )?.[1] ?? null;

      return jsonResponse(
        match
          ? {
              data: [{ id: match.id, type: "tracks" }],
              included: [
                {
                  attributes: {
                    duration: "PT3M0S",
                    isrc: match.isrc,
                    title: match.title,
                  },
                  id: match.id,
                  type: "tracks",
                },
              ],
            }
          : { data: [], included: [] },
      );
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
  test("requests the TIDAL user scopes required by transfer endpoints", () => {
    vi.stubEnv("TIDAL_CLIENT_ID", "tidal-client-id");

    const authorizationUrl = new URL(
      getTidalAuthorizationUrl({
        challenge: "challenge",
        origin: "http://localhost:4321",
        state: "state",
      }),
    );

    expect(authorizationUrl.searchParams.get("client_id")).toBe("tidal-client-id");
    expect(authorizationUrl.searchParams.get("scope")?.split(" ")).toEqual(
      expect.arrayContaining([
        "playlists.write",
        "w_usr",
        "search.read",
        "r_usr",
        "user.read",
      ]),
    );
  });
});

describe("Leaveify transfer", () => {
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
