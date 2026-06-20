import type { APIRoute } from "astro";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { CookieStore } from "../src/utils/leaveify";
import { parseSpotifyPlaylistId } from "../src/utils/leaveify";

const { POST } = (await import(
  "../src/pages/api/tools/leaveify/sources/resolve"
)) as {
  POST: APIRoute;
};

const originalFetch = globalThis.fetch;
const playlistId = "37i9dQZF1DXcBWIGoYBM5M";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function createSpotifySessionCookies(): CookieStore {
  const values = new Map([
    ["leaveify_spotify_access_token", "spotify-user-token"],
    ["leaveify_spotify_expires_at", String(Date.now() + 60 * 60 * 1000)],
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

async function resolveSpotifySource(input: string) {
  return POST({
    cookies: createSpotifySessionCookies(),
    request: new Request(
      "http://localhost/api/tools/leaveify/sources/resolve",
      {
        body: JSON.stringify({ input }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    ),
  } as Parameters<APIRoute>[0]);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("parseSpotifyPlaylistId", () => {
  test("accepts Spotify playlist URLs, URIs, and raw IDs", () => {
    expect(parseSpotifyPlaylistId(playlistId)).toBe(playlistId);
    expect(
      parseSpotifyPlaylistId(
        `https://open.spotify.com/playlist/${playlistId}?si=abc123`,
      ),
    ).toBe(playlistId);
    expect(
      parseSpotifyPlaylistId(
        `https://open.spotify.com/intl-de/playlist/${playlistId}`,
      ),
    ).toBe(playlistId);
    expect(
      parseSpotifyPlaylistId(
        `https://open.spotify.com/embed/playlist/${playlistId}`,
      ),
    ).toBe(playlistId);
    expect(parseSpotifyPlaylistId(`spotify:playlist:${playlistId}`)).toBe(
      playlistId,
    );
    expect(
      parseSpotifyPlaylistId(`spotify:user:spotify:playlist:${playlistId}`),
    ).toBe(playlistId);
  });

  test("rejects non-playlist Spotify inputs", () => {
    expect(parseSpotifyPlaylistId("")).toBeNull();
    expect(parseSpotifyPlaylistId("not a spotify playlist")).toBeNull();
    expect(
      parseSpotifyPlaylistId(`https://open.spotify.com/album/${playlistId}`),
    ).toBeNull();
    expect(parseSpotifyPlaylistId(`spotify:album:${playlistId}`)).toBeNull();
  });
});

describe("Leaveify source resolve API", () => {
  test("resolves a pasted Spotify playlist into a Leaveify source", async () => {
    const requests: Array<{
      authorization: string | null;
      pathname: string;
    }> = [];

    globalThis.fetch = (async (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      requests.push({
        authorization: new Headers(init?.headers).get("Authorization"),
        pathname: url.pathname,
      });

      if (
        url.origin === "https://api.spotify.com" &&
        url.pathname === `/v1/playlists/${playlistId}`
      ) {
        return jsonResponse({
          description: "Fresh weekly recommendations.",
          external_urls: {
            spotify: `https://open.spotify.com/playlist/${playlistId}`,
          },
          id: playlistId,
          images: [{ url: "https://images.example/cover.jpg" }],
          name: "Discover Weekly",
          owner: { display_name: "Spotify" },
          tracks: { total: 30 },
        });
      }

      throw new Error(`Unexpected request: ${url.toString()}`);
    }) as typeof fetch;

    const response = await resolveSpotifySource(
      `https://open.spotify.com/playlist/${playlistId}`,
    );
    const body = (await response.json()) as {
      playlist: {
        id: string;
        imageUrl: string | null;
        kind: string;
        name: string;
        ownerName: string | null;
        tracksTotal: number;
      };
    };

    expect(response.status).toBe(200);
    expect(body.playlist).toEqual({
      description: "Fresh weekly recommendations.",
      id: playlistId,
      imageUrl: "https://images.example/cover.jpg",
      kind: "playlist",
      name: "Discover Weekly",
      ownerName: "Spotify",
      tracksTotal: 30,
    });
    expect(requests).toEqual([
      {
        authorization: "Bearer spotify-user-token",
        pathname: `/v1/playlists/${playlistId}`,
      },
    ]);
  });

  test("returns 400 for invalid playlist input before calling Spotify", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const response = await resolveSpotifySource(
      "https://open.spotify.com/album/notaplaylist",
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Paste a Spotify playlist URL or URI.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
