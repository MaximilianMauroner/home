import type { APIRoute } from "astro";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { CookieStore } from "../src/utils/leaveify";

process.env.TIDAL_CLIENT_ID = "";
process.env.TIDAL_CLIENT_SECRET = "";
process.env.TIDAL_COUNTRY_CODE = "US";
process.env.LEAVEIFY_DEBUG = "false";

const { POST } = (await import("../src/pages/api/tools/leaveify/transfer")) as {
  POST: APIRoute;
};

const originalFetch = globalThis.fetch;
const startTime = new Date("2026-06-19T12:00:00.000Z");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function createRefreshingSessionCookies() {
  const values = new Map([
    ["leaveify_spotify_access_token", "spotify-user-token"],
    ["leaveify_spotify_expires_at", String(Date.now() + 60 * 60 * 1000)],
    ["leaveify_tidal_access_token", "tidal-initial-token"],
    ["leaveify_tidal_refresh_token", "tidal-refresh-token"],
    ["leaveify_tidal_expires_at", String(Date.now() + 120_000)],
  ]);

  const cookies: CookieStore = {
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

  return { cookies, values };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(startTime);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Leaveify transfer token refresh", () => {
  test("re-reads and refreshes the TIDAL user token before later write phases", async () => {
    vi.stubEnv("TIDAL_CLIENT_ID", "tidal-client-id");

    const { cookies, values } = createRefreshingSessionCookies();
    const refreshRequests: URLSearchParams[] = [];
    const tidalAuthorizations: Array<{
      authorization: string | null;
      pathname: string;
    }> = [];

    globalThis.fetch = (async (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      const authorization = new Headers(init?.headers).get("Authorization");

      if (
        url.origin === "https://accounts.spotify.com" &&
        url.pathname === "/api/token"
      ) {
        throw new Error("Spotify token should not refresh in this test");
      }

      if (
        url.origin === "https://auth.tidal.com" &&
        url.pathname === "/v1/oauth2/token"
      ) {
        refreshRequests.push(new URLSearchParams(String(init?.body ?? "")));
        return jsonResponse({
          access_token: "tidal-refreshed-token",
          expires_in: 3600,
          refresh_token: "tidal-rotated-refresh-token",
          token_type: "Bearer",
        });
      }

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
          tracks: { total: 1 },
        });
      }

      if (
        url.origin === "https://api.spotify.com" &&
        url.pathname === "/v1/playlists/spotify-playlist/tracks"
      ) {
        vi.setSystemTime(new Date(startTime.getTime() + 70_000));
        return jsonResponse({
          items: [
            {
              is_local: false,
              track: {
                album: { name: "Source Album" },
                artists: [{ name: "Source Artist" }],
                duration_ms: 180_000,
                external_ids: { isrc: "REFRESHISRC" },
                external_urls: {
                  spotify: "https://open.spotify.com/track/spotify-track",
                },
                id: "spotify-track",
                name: "Refresh Song",
                type: "track",
              },
            },
          ],
          next: null,
          total: 1,
        });
      }

      if (
        url.origin === "https://openapi.tidal.com" &&
        url.pathname === "/v2/tracks"
      ) {
        tidalAuthorizations.push({ authorization, pathname: url.pathname });
        return jsonResponse({
          data: [
            {
              attributes: {
                duration: "PT3M0S",
                isrc: "REFRESHISRC",
                title: "Refresh Song",
              },
              id: "tidal-track",
              type: "tracks",
            },
          ],
        });
      }

      if (
        url.origin === "https://openapi.tidal.com" &&
        url.pathname === "/v2/playlists"
      ) {
        tidalAuthorizations.push({ authorization, pathname: url.pathname });
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
        tidalAuthorizations.push({ authorization, pathname: url.pathname });
        return jsonResponse({ data: [] });
      }

      throw new Error(`Unexpected provider request: ${url.toString()}`);
    }) as typeof fetch;

    const response = await POST({
      cookies,
      request: new Request("http://localhost/api/tools/leaveify/transfer", {
        body: JSON.stringify({ playlistId: "spotify-playlist" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    } as Parameters<APIRoute>[0]);
    const body = (await response.json()) as { addedTracks: number };

    expect(response.status).toBe(200);
    expect(body.addedTracks).toBe(1);
    expect(refreshRequests).toHaveLength(1);
    expect(refreshRequests[0].get("client_id")).toBe("tidal-client-id");
    expect(refreshRequests[0].get("grant_type")).toBe("refresh_token");
    expect(refreshRequests[0].get("refresh_token")).toBe("tidal-refresh-token");
    expect(values.get("leaveify_tidal_access_token")).toBe(
      "tidal-refreshed-token",
    );
    expect(values.get("leaveify_tidal_refresh_token")).toBe(
      "tidal-rotated-refresh-token",
    );
    expect(tidalAuthorizations).toEqual([
      { authorization: "Bearer tidal-refreshed-token", pathname: "/v2/tracks" },
      {
        authorization: "Bearer tidal-refreshed-token",
        pathname: "/v2/playlists",
      },
      {
        authorization: "Bearer tidal-refreshed-token",
        pathname: "/v2/playlists/tidal-playlist/relationships/items",
      },
    ]);
  });
});
