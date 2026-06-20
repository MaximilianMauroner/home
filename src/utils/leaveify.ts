import { Buffer } from "node:buffer";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { LeaveifyPlaylist } from "./leaveifyTypes";

export type { LeaveifyPlaylist } from "./leaveifyTypes";

type CookieOptions = {
  httpOnly?: boolean;
  path?: string;
  maxAge?: number;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
};

export type CookieStore = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: CookieOptions): void;
  delete(name: string, options?: { path?: string }): void;
};

export type LeaveifyProvider = "spotify" | "tidal";

export type ProviderAccessTokenAccessor = {
  requireAccessToken(provider: LeaveifyProvider): Promise<string>;
};

export type OAuthTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export type SpotifyTrackForTransfer = {
  id: string;
  name: string;
  artists: string[];
  albumName: string | null;
  durationMs: number;
  isrc: string | null;
  spotifyUrl: string | null;
};

export type TidalTrackMatch = {
  artists?: string[];
  id: string;
  title: string;
  isrc: string | null;
  durationMs: number | null;
  method: "isrc" | "search";
};

type TrackPageProgress = {
  loaded: number;
  total: number;
};

type MaybePromise<T> = T | Promise<T>;

const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";
export const SPOTIFY_LIKED_SONGS_SOURCE_ID = "__spotify_liked_songs__";

const TIDAL_AUTHORIZE_URL = "https://login.tidal.com/authorize";
const TIDAL_TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token";
const TIDAL_API_URL = "https://openapi.tidal.com/v2";

const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
  "user-read-private",
].join(" ");

const TIDAL_SCOPES = ["playlists.write", "search.read", "user.read"].join(" ");

const cookiePrefix = (provider: LeaveifyProvider) => `leaveify_${provider}`;

const accessTokenCookie = (provider: LeaveifyProvider) =>
  `${cookiePrefix(provider)}_access_token`;
const refreshTokenCookie = (provider: LeaveifyProvider) =>
  `${cookiePrefix(provider)}_refresh_token`;
const expiresAtCookie = (provider: LeaveifyProvider) =>
  `${cookiePrefix(provider)}_expires_at`;
const stateCookie = (provider: LeaveifyProvider) =>
  `${cookiePrefix(provider)}_oauth_state`;
const verifierCookie = (provider: LeaveifyProvider) =>
  `${cookiePrefix(provider)}_code_verifier`;

const tokenCookieOptions = (maxAge: number): CookieOptions => ({
  httpOnly: true,
  maxAge,
  path: "/",
  sameSite: "lax",
  secure: import.meta.env.PROD,
});

const shortLivedCookieOptions: CookieOptions = {
  httpOnly: true,
  maxAge: 60 * 10,
  path: "/",
  sameSite: "lax",
  secure: import.meta.env.PROD,
};

export class LeaveifyApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "LeaveifyApiError";
    this.status = status;
  }
}

export type TidalAddTracksPartialFailure = {
  addedTracks: number;
  failedChunkIndex: number;
  failedChunkStart: number;
  failedTrackIds: string[];
  playlistId: string;
  remainingTrackIds: string[];
  totalTracks: number;
};

export class LeaveifyPartialAddTracksError extends LeaveifyApiError {
  addedTracks: number;
  cause: unknown;
  failedChunkIndex: number;
  failedChunkStart: number;
  failedTrackIds: string[];
  playlistId: string;
  remainingTrackIds: string[];
  totalTracks: number;

  constructor({
    addedTracks,
    cause,
    failedChunkIndex,
    failedChunkStart,
    failedTrackIds,
    playlistId,
    remainingTrackIds,
    totalTracks,
  }: TidalAddTracksPartialFailure & { cause: unknown }) {
    const causeMessage =
      cause instanceof Error ? cause.message : "TIDAL request failed";
    const status = cause instanceof LeaveifyApiError ? cause.status : 500;

    super(
      `TIDAL playlist was created, but adding tracks stopped after ${addedTracks} of ${totalTracks} tracks. ${causeMessage}`,
      status,
    );
    this.name = "LeaveifyPartialAddTracksError";
    this.addedTracks = addedTracks;
    this.cause = cause;
    this.failedChunkIndex = failedChunkIndex;
    this.failedChunkStart = failedChunkStart;
    this.failedTrackIds = failedTrackIds;
    this.playlistId = playlistId;
    this.remainingTrackIds = remainingTrackIds;
    this.totalTracks = totalTracks;
  }
}

export function createPkcePair() {
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { challenge, verifier };
}

export function createOAuthState() {
  return randomBytes(24).toString("base64url");
}

export function setOAuthCookies(
  cookies: CookieStore,
  provider: LeaveifyProvider,
  state: string,
  verifier: string,
) {
  cookies.set(stateCookie(provider), state, shortLivedCookieOptions);
  cookies.set(verifierCookie(provider), verifier, shortLivedCookieOptions);
}

export function getOAuthCookies(
  cookies: CookieStore,
  provider: LeaveifyProvider,
) {
  return {
    state: cookies.get(stateCookie(provider))?.value ?? null,
    verifier: cookies.get(verifierCookie(provider))?.value ?? null,
  };
}

export function clearOAuthCookies(
  cookies: CookieStore,
  provider: LeaveifyProvider,
) {
  cookies.delete(stateCookie(provider), { path: "/" });
  cookies.delete(verifierCookie(provider), { path: "/" });
}

export function clearProviderTokens(
  cookies: CookieStore,
  provider: LeaveifyProvider,
) {
  cookies.delete(accessTokenCookie(provider), { path: "/" });
  cookies.delete(refreshTokenCookie(provider), { path: "/" });
  cookies.delete(expiresAtCookie(provider), { path: "/" });
  clearOAuthCookies(cookies, provider);
}

export function hasProviderSession(
  cookies: CookieStore,
  provider: LeaveifyProvider,
) {
  return Boolean(
    cookies.get(accessTokenCookie(provider))?.value ||
      cookies.get(refreshTokenCookie(provider))?.value,
  );
}

export function getSpotifyClientId() {
  return import.meta.env.SPOTIFY_CLIENT_ID as string | undefined;
}

export function getTidalClientId() {
  return import.meta.env.TIDAL_CLIENT_ID as string | undefined;
}

export function getTidalClientSecret() {
  return import.meta.env.TIDAL_CLIENT_SECRET as string | undefined;
}

export function getTidalCountryCode() {
  return ((import.meta.env.TIDAL_COUNTRY_CODE as string | undefined) ?? "US")
    .trim()
    .toUpperCase();
}

export function getSpotifyRedirectUri(origin: string) {
  return (
    (import.meta.env.LEAVEIFY_SPOTIFY_REDIRECT_URI as string | undefined) ??
    `${origin}/api/tools/leaveify/spotify/callback`
  );
}

export function getTidalRedirectUri(origin: string) {
  return (
    (import.meta.env.LEAVEIFY_TIDAL_REDIRECT_URI as string | undefined) ??
    `${origin}/api/tools/leaveify/tidal/callback`
  );
}

export function getSpotifyAuthorizationUrl({
  origin,
  state,
  challenge,
}: {
  origin: string;
  state: string;
  challenge: string;
}) {
  const clientId = getSpotifyClientId();
  if (!clientId) {
    throw new LeaveifyApiError("SPOTIFY_CLIENT_ID is not configured", 500);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: getSpotifyRedirectUri(origin),
    response_type: "code",
    scope: SPOTIFY_SCOPES,
    show_dialog: "true",
    state,
  });

  return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
}

export function getTidalAuthorizationUrl({
  origin,
  state,
  challenge,
}: {
  origin: string;
  state: string;
  challenge: string;
}) {
  const clientId = getTidalClientId();
  if (!clientId) {
    throw new LeaveifyApiError("TIDAL_CLIENT_ID is not configured", 500);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: getTidalRedirectUri(origin),
    response_type: "code",
    scope: TIDAL_SCOPES,
    state,
  });

  return `${TIDAL_AUTHORIZE_URL}?${params.toString()}`;
}

async function parseTokenResponse(response: Response) {
  const payload = (await response
    .json()
    .catch(() => ({}))) as OAuthTokenResponse;

  if (!response.ok || !payload.access_token) {
    const message =
      payload.error_description ??
      payload.error ??
      `OAuth token request failed with status ${response.status}`;
    throw new LeaveifyApiError(message, response.ok ? 500 : response.status);
  }

  return payload;
}

function getRetryAfterMs(response: Response) {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) return 1_000;

  const retryAfterSeconds = Number(retryAfter);
  if (Number.isFinite(retryAfterSeconds)) {
    return Math.max(1_000, retryAfterSeconds * 1000);
  }

  const retryAt = Date.parse(retryAfter);
  if (Number.isFinite(retryAt)) {
    return Math.max(1_000, retryAt - Date.now());
  }

  return 1_000;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function exchangeSpotifyCode({
  code,
  origin,
  verifier,
}: {
  code: string;
  origin: string;
  verifier: string;
}) {
  const clientId = getSpotifyClientId();
  if (!clientId) {
    throw new LeaveifyApiError("SPOTIFY_CLIENT_ID is not configured", 500);
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: getSpotifyRedirectUri(origin),
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  return parseTokenResponse(response);
}

export async function exchangeTidalCode({
  code,
  origin,
  verifier,
}: {
  code: string;
  origin: string;
  verifier: string;
}) {
  const clientId = getTidalClientId();
  if (!clientId) {
    throw new LeaveifyApiError("TIDAL_CLIENT_ID is not configured", 500);
  }

  const response = await fetch(TIDAL_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: getTidalRedirectUri(origin),
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  return parseTokenResponse(response);
}

export function setProviderTokens(
  cookies: CookieStore,
  provider: LeaveifyProvider,
  tokens: OAuthTokenResponse,
) {
  if (!tokens.access_token) {
    throw new LeaveifyApiError(`Missing ${provider} access token`, 500);
  }

  const accessMaxAge = Math.max(60, tokens.expires_in ?? 3600);
  const refreshMaxAge = 60 * 60 * 24 * 30;
  const expiresAt = Date.now() + accessMaxAge * 1000;

  cookies.set(
    accessTokenCookie(provider),
    tokens.access_token,
    tokenCookieOptions(accessMaxAge),
  );
  cookies.set(
    expiresAtCookie(provider),
    String(expiresAt),
    tokenCookieOptions(refreshMaxAge),
  );

  if (tokens.refresh_token) {
    cookies.set(
      refreshTokenCookie(provider),
      tokens.refresh_token,
      tokenCookieOptions(refreshMaxAge),
    );
  }
}

async function refreshProviderToken(
  cookies: CookieStore,
  provider: LeaveifyProvider,
) {
  const refreshToken = cookies.get(refreshTokenCookie(provider))?.value;
  if (!refreshToken) {
    return null;
  }

  const clientId =
    provider === "spotify" ? getSpotifyClientId() : getTidalClientId();
  const tokenUrl = provider === "spotify" ? SPOTIFY_TOKEN_URL : TIDAL_TOKEN_URL;
  if (!clientId) {
    return null;
  }

  const response = await fetch(tokenUrl, {
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  const tokens = await parseTokenResponse(response);
  setProviderTokens(
    cookies,
    provider,
    tokens.refresh_token ? tokens : { ...tokens, refresh_token: refreshToken },
  );

  return tokens.access_token ?? null;
}

export async function getProviderAccessToken(
  cookies: CookieStore,
  provider: LeaveifyProvider,
) {
  const accessToken = cookies.get(accessTokenCookie(provider))?.value ?? null;
  const expiresAt = Number(cookies.get(expiresAtCookie(provider))?.value ?? 0);

  if (accessToken && expiresAt > Date.now() + 60_000) {
    return accessToken;
  }

  return refreshProviderToken(cookies, provider);
}

export async function requireProviderAccessToken(
  cookies: CookieStore,
  provider: LeaveifyProvider,
) {
  const token = await getProviderAccessToken(cookies, provider);
  if (!token) {
    throw new LeaveifyApiError(`Connect ${provider} before continuing`, 401);
  }

  return token;
}

export function createProviderAccessTokenAccessor(
  cookies: CookieStore,
): ProviderAccessTokenAccessor {
  const activeLookups = new Map<LeaveifyProvider, Promise<string>>();

  return {
    requireAccessToken(provider) {
      const activeLookup = activeLookups.get(provider);
      if (activeLookup) {
        return activeLookup;
      }

      const lookup = requireProviderAccessToken(cookies, provider).finally(
        () => {
          if (activeLookups.get(provider) === lookup) {
            activeLookups.delete(provider);
          }
        },
      );
      activeLookups.set(provider, lookup);

      return lookup;
    },
  };
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  service: string,
): Promise<T> {
  let response = await fetch(url, init);
  let retryCount = 0;

  while (response.status === 429 && retryCount < 3) {
    retryCount += 1;
    await sleep(getRetryAfterMs(response) * retryCount);
    response = await fetch(url, init);
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const errorPayload = payload as {
      error?: { message?: string };
      errors?: unknown;
    } | null;
    const message =
      errorPayload?.error?.message ??
      (typeof errorPayload?.errors === "string"
        ? errorPayload.errors
        : `${service} request failed with status ${response.status}`);
    throw new LeaveifyApiError(message, response.status);
  }

  if (!payload) {
    throw new LeaveifyApiError(`${service} returned an empty response`, 502);
  }

  return payload;
}

export async function spotifyApi<T>(
  pathOrUrl: string,
  accessToken: string,
  options: {
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const url = pathOrUrl.startsWith("https://")
    ? pathOrUrl
    : `${SPOTIFY_API_URL}${pathOrUrl}`;

  return fetchJson<T>(
    url,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: options.signal,
    },
    "Spotify",
  );
}

export async function tidalApi<T>({
  accessToken,
  body,
  idempotencyKey,
  method = "GET",
  path,
  signal,
}: {
  accessToken: string;
  body?: unknown;
  idempotencyKey?: string;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
  path: string;
  signal?: AbortSignal;
}): Promise<T> {
  const headers = new Headers({
    Accept: "application/vnd.api+json",
    Authorization: `Bearer ${accessToken}`,
  });

  if (body !== undefined) {
    headers.set("Content-Type", "application/vnd.api+json");
  }

  if (idempotencyKey) {
    headers.set("Idempotency-Key", idempotencyKey);
  }

  return fetchJson<T>(
    `${TIDAL_API_URL}${path}`,
    {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
      method,
      signal,
    },
    "TIDAL",
  );
}

export async function getTidalClientCredentialsToken({
  signal,
}: {
  signal?: AbortSignal;
} = {}) {
  const clientId = getTidalClientId();
  const clientSecret = getTidalClientSecret();

  if (!clientId || !clientSecret) {
    return null;
  }

  const response = await fetch(TIDAL_TOKEN_URL, {
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
    signal,
  });

  const tokens = await parseTokenResponse(response);
  return tokens.access_token ?? null;
}

type SpotifyPlaylistsResponse = {
  items: Array<{
    description: string | null;
    id: string;
    images: Array<{ url: string }> | null;
    name: string;
    owner: { display_name?: string | null } | null;
    tracks: { total: number };
  }>;
  next: string | null;
};

async function fetchSpotifyLikedSongsSource(
  accessToken: string,
  options: {
    signal?: AbortSignal;
  } = {},
): Promise<LeaveifyPlaylist> {
  const data = await spotifyApi<SpotifySavedTracksResponse>(
    "/me/tracks?limit=1&offset=0",
    accessToken,
    { signal: options.signal },
  );

  return {
    description: "Songs saved in your Spotify library.",
    id: SPOTIFY_LIKED_SONGS_SOURCE_ID,
    imageUrl: null,
    kind: "liked_songs",
    name: "Liked Songs",
    ownerName: "Your Library",
    tracksTotal: data.total,
  };
}

export async function fetchSpotifyPlaylists(
  accessToken: string,
  options: {
    signal?: AbortSignal;
  } = {},
): Promise<LeaveifyPlaylist[]> {
  const playlists: LeaveifyPlaylist[] = [];
  let nextUrl: string | null =
    `${SPOTIFY_API_URL}/me/playlists?limit=50&offset=0`;

  while (nextUrl) {
    const data: SpotifyPlaylistsResponse =
      await spotifyApi<SpotifyPlaylistsResponse>(nextUrl, accessToken, {
        signal: options.signal,
      });

    playlists.push(
      ...data.items.map(
        (playlist): LeaveifyPlaylist => ({
          description: playlist.description,
          id: playlist.id,
          imageUrl: playlist.images?.[0]?.url ?? null,
          kind: "playlist",
          name: playlist.name,
          ownerName: playlist.owner?.display_name ?? null,
          tracksTotal: playlist.tracks.total,
        }),
      ),
    );

    nextUrl = data.next;
  }

  return playlists.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchSpotifySources(
  accessToken: string,
  options: {
    signal?: AbortSignal;
  } = {},
): Promise<LeaveifyPlaylist[]> {
  const [likedSongs, playlists] = await Promise.all([
    fetchSpotifyLikedSongsSource(accessToken, options),
    fetchSpotifyPlaylists(accessToken, options),
  ]);

  return [likedSongs, ...playlists];
}

type SpotifyPlaylistResponse = {
  description: string | null;
  external_urls?: { spotify?: string };
  id: string;
  images?: Array<{ url: string }> | null;
  name: string;
  owner: { display_name?: string | null } | null;
  tracks: { total: number };
};

const SPOTIFY_PLAYLIST_ID_PATTERN = /^[A-Za-z0-9]{22}$/;

function isSpotifyLikedSongsSource(sourceId: string) {
  return sourceId === SPOTIFY_LIKED_SONGS_SOURCE_ID;
}

export function parseSpotifyPlaylistId(input: string) {
  const value = input.trim();

  if (!value) {
    return null;
  }

  if (SPOTIFY_PLAYLIST_ID_PATTERN.test(value)) {
    return value;
  }

  const uriMatch = value.match(
    /^spotify:(?:user:[^:]+:)?playlist:([A-Za-z0-9]{22})$/i,
  );
  if (uriMatch) {
    return uriMatch[1];
  }

  try {
    const url = new URL(value);
    if (!/(^|\.)spotify\.com$/i.test(url.hostname)) {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const playlistSegmentIndex = segments.findIndex(
      (segment) => segment.toLowerCase() === "playlist",
    );
    const playlistId =
      playlistSegmentIndex >= 0 ? segments[playlistSegmentIndex + 1] : null;

    return playlistId && SPOTIFY_PLAYLIST_ID_PATTERN.test(playlistId)
      ? playlistId
      : null;
  } catch {
    return null;
  }
}

function spotifyPlaylistToLeaveifyPlaylist(
  playlist: SpotifyPlaylistResponse,
): LeaveifyPlaylist {
  return {
    description: playlist.description,
    id: playlist.id,
    imageUrl: playlist.images?.[0]?.url ?? null,
    kind: "playlist",
    name: playlist.name,
    ownerName: playlist.owner?.display_name ?? null,
    tracksTotal: playlist.tracks.total,
  };
}

export async function fetchSpotifyPlaylist(
  accessToken: string,
  playlistId: string,
  options: {
    signal?: AbortSignal;
  } = {},
): Promise<SpotifyPlaylistResponse> {
  const fields = [
    "description",
    "external_urls",
    "id",
    "images(url)",
    "name",
    "owner(display_name)",
    "tracks(total)",
  ].join(",");

  return spotifyApi<SpotifyPlaylistResponse>(
    `/playlists/${encodeURIComponent(playlistId)}?fields=${fields}`,
    accessToken,
    { signal: options.signal },
  );
}

export async function fetchSpotifyPlaylistSource(
  accessToken: string,
  playlistId: string,
  options: {
    signal?: AbortSignal;
  } = {},
): Promise<LeaveifyPlaylist> {
  const playlist = await fetchSpotifyPlaylist(accessToken, playlistId, options);
  return spotifyPlaylistToLeaveifyPlaylist(playlist);
}

export async function fetchSpotifySource(
  accessToken: string,
  sourceId: string,
  options: {
    signal?: AbortSignal;
  } = {},
): Promise<SpotifyPlaylistResponse> {
  if (!isSpotifyLikedSongsSource(sourceId)) {
    return fetchSpotifyPlaylist(accessToken, sourceId, options);
  }

  const likedSongs = await fetchSpotifyLikedSongsSource(accessToken, options);
  return {
    description: likedSongs.description,
    id: likedSongs.id,
    name: likedSongs.name,
    owner: { display_name: likedSongs.ownerName },
    tracks: { total: likedSongs.tracksTotal },
  };
}

type SpotifyTrackObjectForTransfer = {
  album?: { name?: string | null };
  artists?: Array<{ name: string }>;
  duration_ms?: number;
  external_ids?: { isrc?: string };
  external_urls?: { spotify?: string };
  id?: string | null;
  name?: string;
  type?: string;
};

type SpotifyPlaylistTracksResponse = {
  items: Array<{
    is_local: boolean;
    track: SpotifyTrackObjectForTransfer | null;
  }>;
  next: string | null;
  total: number;
};

type SpotifySavedTracksResponse = {
  items: Array<{
    added_at: string;
    track: SpotifyTrackObjectForTransfer | null;
  }>;
  next: string | null;
  total: number;
};

function spotifyTrackToTransfer(
  track: SpotifyTrackObjectForTransfer | null,
): SpotifyTrackForTransfer | null {
  if (!track || track.type !== "track" || !track.id) {
    return null;
  }

  return {
    albumName: track.album?.name ?? null,
    artists: track.artists?.map((artist) => artist.name) ?? [],
    durationMs: track.duration_ms ?? 0,
    id: track.id,
    isrc: track.external_ids?.isrc?.toUpperCase() ?? null,
    name: track.name ?? "Untitled track",
    spotifyUrl: track.external_urls?.spotify ?? null,
  };
}

export async function fetchSpotifyPlaylistTracks(
  accessToken: string,
  playlistId: string,
  options: {
    onProgress?: (progress: TrackPageProgress) => MaybePromise<void>;
    signal?: AbortSignal;
  } = {},
): Promise<SpotifyTrackForTransfer[]> {
  const tracks: SpotifyTrackForTransfer[] = [];
  const fields = [
    "items(is_local,track(id,name,type,duration_ms,external_ids,external_urls,album(name),artists(name)))",
    "next",
    "total",
  ].join(",");
  let nextUrl: string | null =
    `${SPOTIFY_API_URL}/playlists/${encodeURIComponent(
      playlistId,
    )}/tracks?limit=50&offset=0&fields=${encodeURIComponent(fields)}`;

  while (nextUrl) {
    const data: SpotifyPlaylistTracksResponse =
      await spotifyApi<SpotifyPlaylistTracksResponse>(nextUrl, accessToken, {
        signal: options.signal,
      });

    for (const item of data.items) {
      if (item.is_local) {
        continue;
      }

      const track = spotifyTrackToTransfer(item.track);
      if (track) tracks.push(track);
    }

    await options.onProgress?.({ loaded: tracks.length, total: data.total });
    nextUrl = data.next;
  }

  return tracks;
}

export async function fetchSpotifyLikedSongsTracks(
  accessToken: string,
  options: {
    onProgress?: (progress: TrackPageProgress) => MaybePromise<void>;
    signal?: AbortSignal;
  } = {},
): Promise<SpotifyTrackForTransfer[]> {
  const tracks: SpotifyTrackForTransfer[] = [];
  const fields = [
    "items(added_at,track(id,name,type,duration_ms,external_ids,external_urls,album(name),artists(name)))",
    "next",
    "total",
  ].join(",");
  let nextUrl: string | null =
    `${SPOTIFY_API_URL}/me/tracks?limit=50&offset=0&fields=${encodeURIComponent(
      fields,
    )}`;

  while (nextUrl) {
    const data: SpotifySavedTracksResponse =
      await spotifyApi<SpotifySavedTracksResponse>(nextUrl, accessToken, {
        signal: options.signal,
      });

    for (const item of data.items) {
      const track = spotifyTrackToTransfer(item.track);
      if (track) tracks.push(track);
    }

    await options.onProgress?.({ loaded: tracks.length, total: data.total });
    nextUrl = data.next;
  }

  return tracks;
}

export async function fetchSpotifySourceTracks(
  accessToken: string,
  sourceId: string,
  options: {
    onProgress?: (progress: TrackPageProgress) => MaybePromise<void>;
    signal?: AbortSignal;
  } = {},
): Promise<SpotifyTrackForTransfer[]> {
  return isSpotifyLikedSongsSource(sourceId)
    ? fetchSpotifyLikedSongsTracks(accessToken, options)
    : fetchSpotifyPlaylistTracks(accessToken, sourceId, options);
}

type TidalResourceIdentifier = {
  id: string;
  type: string;
};

type TidalTrackResource = TidalResourceIdentifier & {
  attributes?: {
    artist?: { name?: string } | string;
    artistName?: string;
    artists?: Array<{ name?: string } | string>;
    duration?: string;
    isrc?: string;
    title?: string;
    version?: string;
  };
  relationships?: {
    artists?: {
      data?: TidalResourceIdentifier[];
    };
  };
};

type TidalTracksResponse = {
  data?: TidalTrackResource[];
};

type TidalArtistResource = TidalResourceIdentifier & {
  attributes?: {
    name?: string;
  };
};

type TidalIncludedResource = TidalArtistResource | TidalTrackResource;

type TidalRelationshipResponse = {
  data?: TidalResourceIdentifier[];
  included?: TidalIncludedResource[];
};

type TidalPlaylistCreateResponse = {
  data?: {
    id: string;
    attributes?: {
      name?: string;
    };
  };
};

function parseIsoDurationToMs(duration: string | undefined) {
  if (!duration) return null;

  const match = duration.match(
    /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/,
  );
  if (!match) return null;

  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return Math.round(
    (((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60 +
      Number(seconds)) *
      1000,
  );
}

function uniqueNonEmpty(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

function getIncludedArtistsById(included: TidalIncludedResource[] = []) {
  const artists = new Map<string, string>();

  for (const resource of included) {
    if (!resource.type.includes("artist")) {
      continue;
    }

    const name =
      resource.attributes && "name" in resource.attributes
        ? resource.attributes.name?.trim()
        : undefined;
    if (name) {
      artists.set(resource.id, name);
    }
  }

  return artists;
}

function isTidalTrackResource(
  resource: TidalIncludedResource,
): resource is TidalTrackResource {
  return resource.type === "tracks";
}

function getTidalTrackArtists(
  track: TidalTrackResource,
  includedArtistsById: Map<string, string>,
) {
  const artists: string[] = [];
  const attributeArtist = track.attributes?.artist;

  if (typeof attributeArtist === "string") {
    artists.push(attributeArtist);
  } else if (attributeArtist?.name) {
    artists.push(attributeArtist.name);
  }

  if (track.attributes?.artistName) {
    artists.push(track.attributes.artistName);
  }

  for (const artist of track.attributes?.artists ?? []) {
    if (typeof artist === "string") {
      artists.push(artist);
    } else if (artist.name) {
      artists.push(artist.name);
    }
  }

  for (const artist of track.relationships?.artists?.data ?? []) {
    const name = includedArtistsById.get(artist.id);
    if (name) {
      artists.push(name);
    }
  }

  return uniqueNonEmpty(artists);
}

function tidalTrackToMatch(
  track: TidalTrackResource,
  method: TidalTrackMatch["method"],
  includedArtistsById = new Map<string, string>(),
): TidalTrackMatch {
  const title = [
    track.attributes?.title ?? "Untitled track",
    track.attributes?.version,
  ]
    .filter(Boolean)
    .join(" ");
  const artists = getTidalTrackArtists(track, includedArtistsById);

  return {
    ...(artists.length > 0 ? { artists } : {}),
    durationMs: parseIsoDurationToMs(track.attributes?.duration),
    id: track.id,
    isrc: track.attributes?.isrc?.toUpperCase() ?? null,
    method,
    title,
  };
}

export async function findTidalTracksByIsrc({
  accessToken,
  countryCode,
  onProgress,
  signal,
  tracks,
}: {
  accessToken: string;
  countryCode: string;
  onProgress?: (progress: {
    processed: number;
    total: number;
  }) => MaybePromise<void>;
  signal?: AbortSignal;
  tracks: SpotifyTrackForTransfer[];
}) {
  const matches = new Map<string, TidalTrackMatch>();
  const isrcs = [
    ...new Set(
      tracks
        .map((track) => track.isrc)
        .filter((isrc): isrc is string => Boolean(isrc)),
    ),
  ];

  for (let index = 0; index < isrcs.length; index += 20) {
    const chunk = isrcs.slice(index, index + 20);
    const params = new URLSearchParams({ countryCode });
    for (const isrc of chunk) {
      params.append("filter[isrc]", isrc);
    }

    const data = await tidalApi<TidalTracksResponse>({
      accessToken,
      path: `/tracks?${params.toString()}`,
      signal,
    });

    for (const track of data.data ?? []) {
      const isrc = track.attributes?.isrc?.toUpperCase();
      if (isrc && !matches.has(isrc)) {
        matches.set(isrc, tidalTrackToMatch(track, "isrc"));
      }
    }

    await onProgress?.({
      processed: Math.min(index + chunk.length, isrcs.length),
      total: isrcs.length,
    });
  }

  return matches;
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeArtistForMatch(value: string) {
  return normalizeForMatch(value).replace(/^the\s+/, "");
}

function removeBracketedText(value: string) {
  return value
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTitleScore(sourceTitle: string, candidateTitle: string) {
  if (!sourceTitle || !candidateTitle) {
    return 0;
  }

  if (sourceTitle === candidateTitle) {
    return 6;
  }

  if (
    sourceTitle.includes(candidateTitle) ||
    candidateTitle.includes(sourceTitle)
  ) {
    return 4;
  }

  const sourceTokens = new Set(sourceTitle.split(" ").filter(Boolean));
  const candidateTokens = new Set(candidateTitle.split(" ").filter(Boolean));
  const sharedTokens = [...sourceTokens].filter((token) =>
    candidateTokens.has(token),
  ).length;
  const coverage =
    sharedTokens / Math.max(sourceTokens.size, candidateTokens.size, 1);

  return sharedTokens >= 2 && coverage >= 0.67 ? 3 : 0;
}

function getDurationScore(
  sourceDurationMs: number,
  candidateDurationMs: number | null,
) {
  if (!sourceDurationMs || !candidateDurationMs) {
    return 0;
  }

  const durationDelta = Math.abs(candidateDurationMs - sourceDurationMs);
  if (durationDelta <= 3_000) return 3;
  if (durationDelta <= 8_000) return 2;
  if (durationDelta <= 15_000) return 1;
  if (durationDelta > 30_000) return -4;
  return -2;
}

function getArtistScore(
  sourceArtists: string[],
  candidateArtists: string[] | undefined,
) {
  const normalizedSourceArtists = sourceArtists
    .map(normalizeArtistForMatch)
    .filter(Boolean);
  const normalizedCandidateArtists =
    candidateArtists?.map(normalizeArtistForMatch).filter(Boolean) ?? [];

  if (
    normalizedSourceArtists.length === 0 ||
    normalizedCandidateArtists.length === 0
  ) {
    return { score: 0, mismatch: false };
  }

  for (const sourceArtist of normalizedSourceArtists) {
    for (const candidateArtist of normalizedCandidateArtists) {
      if (sourceArtist === candidateArtist) {
        return { score: 4, mismatch: false };
      }

      if (
        sourceArtist.length > 3 &&
        candidateArtist.length > 3 &&
        (sourceArtist.includes(candidateArtist) ||
          candidateArtist.includes(sourceArtist))
      ) {
        return { score: 2, mismatch: false };
      }
    }
  }

  return { score: -4, mismatch: true };
}

function hasDistinctiveTitle(title: string) {
  const tokens = title.split(" ").filter(Boolean);
  return title.length >= 14 || tokens.length >= 3;
}

function scoreTidalCandidate(
  source: SpotifyTrackForTransfer,
  candidate: TidalTrackMatch,
) {
  const sourceTitle = normalizeForMatch(source.name);
  const candidateTitle = normalizeForMatch(candidate.title);
  const titleScore = getTitleScore(sourceTitle, candidateTitle);
  const durationScore = getDurationScore(
    source.durationMs,
    candidate.durationMs,
  );
  const artistScore = getArtistScore(source.artists, candidate.artists);
  const isrcMatch = Boolean(
    source.isrc && candidate.isrc && source.isrc === candidate.isrc,
  );
  const score =
    (isrcMatch ? 20 : 0) + titleScore + durationScore + artistScore.score;

  if (isrcMatch) {
    return { acceptable: true, score };
  }

  if (titleScore === 0 || artistScore.mismatch) {
    return { acceptable: false, score };
  }

  if (artistScore.score > 0) {
    return {
      acceptable: titleScore >= 4 || (titleScore >= 3 && durationScore >= 1),
      score,
    };
  }

  if (durationScore >= 2 && titleScore >= 4) {
    return { acceptable: true, score };
  }

  if (durationScore >= 3 && titleScore >= 3) {
    return { acceptable: true, score };
  }

  return {
    acceptable:
      durationScore === 0 &&
      titleScore >= 6 &&
      hasDistinctiveTitle(sourceTitle),
    score,
  };
}

export async function findTidalTrackBySearch({
  accessToken,
  countryCode,
  signal,
  track,
}: {
  accessToken: string;
  countryCode: string;
  signal?: AbortSignal;
  track: SpotifyTrackForTransfer;
}) {
  const cleanedName = removeBracketedText(track.name);
  const primaryArtist = track.artists[0];
  const queries = [
    [track.name, primaryArtist, track.albumName],
    [track.name, primaryArtist],
    [cleanedName, primaryArtist],
    [cleanedName, track.artists.join(" ")],
    [cleanedName],
    [track.name],
  ]
    .map((parts) => parts.filter(Boolean).join(" ").trim())
    .filter(
      (query, index, allQueries) =>
        query && allQueries.indexOf(query) === index,
    );

  let bestFallback: {
    candidate: TidalTrackMatch;
    score: ReturnType<typeof scoreTidalCandidate>;
  } | null = null;

  for (const query of queries) {
    const params = new URLSearchParams({
      countryCode,
      include: "tracks",
    });

    const data = await tidalApi<TidalRelationshipResponse>({
      accessToken,
      path: `/searchResults/${encodeURIComponent(query)}/relationships/tracks?${params.toString()}`,
      signal,
    });

    const trackIds = new Set(
      (data.data ?? [])
        .filter((resource) => resource.type === "tracks")
        .map((resource) => resource.id),
    );
    const included = data.included ?? [];
    const includedArtistsById = getIncludedArtistsById(included);
    const candidates = included
      .filter(
        (resource): resource is TidalTrackResource =>
          isTidalTrackResource(resource) && trackIds.has(resource.id),
      )
      .map((resource) =>
        tidalTrackToMatch(resource, "search", includedArtistsById),
      );

    if (candidates.length === 0) {
      continue;
    }

    const ranked = candidates
      .map((candidate) => ({
        candidate,
        score: scoreTidalCandidate(track, candidate),
      }))
      .sort((a, b) => b.score.score - a.score.score);

    const accepted = ranked.find(({ score }) => score.acceptable);
    if (accepted) {
      return accepted.candidate;
    }

    if (
      ranked[0] &&
      (!bestFallback || ranked[0].score.score > bestFallback.score.score)
    ) {
      bestFallback = ranked[0];
    }
  }

  return bestFallback && bestFallback.score.acceptable
    ? bestFallback.candidate
    : null;
}

export async function createTidalPlaylist({
  accessToken,
  countryCode,
  description,
  name,
  signal,
  visibility,
}: {
  accessToken: string;
  countryCode: string;
  description: string;
  name: string;
  signal?: AbortSignal;
  visibility: "PUBLIC" | "UNLISTED";
}) {
  const data = await tidalApi<TidalPlaylistCreateResponse>({
    accessToken,
    body: {
      data: {
        attributes: {
          accessType: visibility,
          description,
          name,
        },
        type: "playlists",
      },
    },
    idempotencyKey: randomUUID(),
    method: "POST",
    path: `/playlists?${new URLSearchParams({ countryCode }).toString()}`,
    signal,
  });

  if (!data.data?.id) {
    throw new LeaveifyApiError("TIDAL did not return a playlist id", 502);
  }

  return {
    id: data.data.id,
    name: data.data.attributes?.name ?? name,
  };
}

export async function addTracksToTidalPlaylist({
  accessToken,
  countryCode,
  onProgress,
  playlistId,
  signal,
  trackIds,
}: {
  accessToken: string;
  countryCode: string;
  onProgress?: (progress: {
    added: number;
    total: number;
  }) => MaybePromise<void>;
  playlistId: string;
  signal?: AbortSignal;
  trackIds: string[];
}) {
  let added = 0;

  for (let index = 0; index < trackIds.length; index += 50) {
    const chunk = trackIds.slice(index, index + 50);

    try {
      await tidalApi({
        accessToken,
        body: {
          data: chunk.map((id) => ({
            id,
            meta: {
              addedAt: new Date().toISOString(),
            },
            type: "tracks",
          })),
        },
        idempotencyKey: randomUUID(),
        method: "POST",
        path: `/playlists/${encodeURIComponent(
          playlistId,
        )}/relationships/items?${new URLSearchParams({ countryCode }).toString()}`,
        signal,
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") {
        throw cause;
      }

      throw new LeaveifyPartialAddTracksError({
        addedTracks: added,
        cause,
        failedChunkIndex: index / 50,
        failedChunkStart: index,
        failedTrackIds: chunk,
        playlistId,
        remainingTrackIds: trackIds.slice(index),
        totalTracks: trackIds.length,
      });
    }

    added += chunk.length;
    await onProgress?.({ added, total: trackIds.length });
  }

  return added;
}

export async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () =>
      worker(),
    ),
  );

  return results;
}
