import { Buffer } from "node:buffer";
import { createHash, randomBytes, randomUUID } from "node:crypto";

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

export type OAuthTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export type LeaveifyPlaylist = {
  id: string;
  kind: "liked_songs" | "playlist";
  name: string;
  description: string | null;
  imageUrl: string | null;
  ownerName: string | null;
  tracksTotal: number;
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
  id: string;
  title: string;
  isrc: string | null;
  durationMs: number | null;
  method: "isrc" | "search";
};

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
}: {
  accessToken: string;
  body?: unknown;
  idempotencyKey?: string;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
  path: string;
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
    },
    "TIDAL",
  );
}

export async function getTidalClientCredentialsToken() {
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
): Promise<LeaveifyPlaylist> {
  const data = await spotifyApi<SpotifySavedTracksResponse>(
    "/me/tracks?limit=1&offset=0",
    accessToken,
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
): Promise<LeaveifyPlaylist[]> {
  const playlists: LeaveifyPlaylist[] = [];
  let nextUrl: string | null =
    `${SPOTIFY_API_URL}/me/playlists?limit=50&offset=0`;

  while (nextUrl) {
    const data: SpotifyPlaylistsResponse =
      await spotifyApi<SpotifyPlaylistsResponse>(nextUrl, accessToken);

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
): Promise<LeaveifyPlaylist[]> {
  const [likedSongs, playlists] = await Promise.all([
    fetchSpotifyLikedSongsSource(accessToken),
    fetchSpotifyPlaylists(accessToken),
  ]);

  return [likedSongs, ...playlists];
}

type SpotifyPlaylistResponse = {
  description: string | null;
  external_urls?: { spotify?: string };
  id: string;
  name: string;
  owner: { display_name?: string | null } | null;
  tracks: { total: number };
};

function isSpotifyLikedSongsSource(sourceId: string) {
  return sourceId === SPOTIFY_LIKED_SONGS_SOURCE_ID;
}

export async function fetchSpotifyPlaylist(
  accessToken: string,
  playlistId: string,
): Promise<SpotifyPlaylistResponse> {
  const fields = [
    "description",
    "external_urls",
    "id",
    "name",
    "owner(display_name)",
    "tracks(total)",
  ].join(",");

  return spotifyApi<SpotifyPlaylistResponse>(
    `/playlists/${encodeURIComponent(playlistId)}?fields=${fields}`,
    accessToken,
  );
}

export async function fetchSpotifySource(
  accessToken: string,
  sourceId: string,
): Promise<SpotifyPlaylistResponse> {
  if (!isSpotifyLikedSongsSource(sourceId)) {
    return fetchSpotifyPlaylist(accessToken, sourceId);
  }

  const likedSongs = await fetchSpotifyLikedSongsSource(accessToken);
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
      await spotifyApi<SpotifyPlaylistTracksResponse>(nextUrl, accessToken);

    for (const item of data.items) {
      if (item.is_local) {
        continue;
      }

      const track = spotifyTrackToTransfer(item.track);
      if (track) tracks.push(track);
    }

    nextUrl = data.next;
  }

  return tracks;
}

export async function fetchSpotifyLikedSongsTracks(
  accessToken: string,
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
      await spotifyApi<SpotifySavedTracksResponse>(nextUrl, accessToken);

    for (const item of data.items) {
      const track = spotifyTrackToTransfer(item.track);
      if (track) tracks.push(track);
    }

    nextUrl = data.next;
  }

  return tracks;
}

export async function fetchSpotifySourceTracks(
  accessToken: string,
  sourceId: string,
): Promise<SpotifyTrackForTransfer[]> {
  return isSpotifyLikedSongsSource(sourceId)
    ? fetchSpotifyLikedSongsTracks(accessToken)
    : fetchSpotifyPlaylistTracks(accessToken, sourceId);
}

type TidalResourceIdentifier = {
  id: string;
  type: string;
};

type TidalTrackResource = TidalResourceIdentifier & {
  attributes?: {
    duration?: string;
    isrc?: string;
    title?: string;
    version?: string;
  };
};

type TidalTracksResponse = {
  data?: TidalTrackResource[];
};

type TidalRelationshipResponse = {
  data?: TidalResourceIdentifier[];
  included?: TidalTrackResource[];
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

function tidalTrackToMatch(
  track: TidalTrackResource,
  method: TidalTrackMatch["method"],
): TidalTrackMatch {
  const title = [
    track.attributes?.title ?? "Untitled track",
    track.attributes?.version,
  ]
    .filter(Boolean)
    .join(" ");

  return {
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
  tracks,
}: {
  accessToken: string;
  countryCode: string;
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
    });

    for (const track of data.data ?? []) {
      const isrc = track.attributes?.isrc?.toUpperCase();
      if (isrc && !matches.has(isrc)) {
        matches.set(isrc, tidalTrackToMatch(track, "isrc"));
      }
    }
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

function removeBracketedText(value: string) {
  return value
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTidalCandidate(
  source: SpotifyTrackForTransfer,
  candidate: TidalTrackMatch,
) {
  const sourceTitle = normalizeForMatch(source.name);
  const candidateTitle = normalizeForMatch(candidate.title);
  let score = 0;

  if (source.isrc && candidate.isrc && source.isrc === candidate.isrc) {
    score += 10;
  }

  if (sourceTitle === candidateTitle) {
    score += 5;
  } else if (
    sourceTitle.includes(candidateTitle) ||
    candidateTitle.includes(sourceTitle)
  ) {
    score += 3;
  }

  if (candidate.durationMs && source.durationMs) {
    const durationDelta = Math.abs(candidate.durationMs - source.durationMs);
    if (durationDelta <= 3_000) score += 2;
    else if (durationDelta <= 8_000) score += 1;
  }

  return score;
}

export async function findTidalTrackBySearch({
  accessToken,
  countryCode,
  track,
}: {
  accessToken: string;
  countryCode: string;
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

  let bestFallback: { candidate: TidalTrackMatch; score: number } | null = null;

  for (const query of queries) {
    const params = new URLSearchParams({
      countryCode,
      include: "tracks",
    });

    const data = await tidalApi<TidalRelationshipResponse>({
      accessToken,
      path: `/searchResults/${encodeURIComponent(query)}/relationships/tracks?${params.toString()}`,
    });

    const trackIds = new Set(
      (data.data ?? [])
        .filter((resource) => resource.type === "tracks")
        .map((resource) => resource.id),
    );
    const candidates = (data.included ?? [])
      .filter(
        (resource) => resource.type === "tracks" && trackIds.has(resource.id),
      )
      .map((resource) => tidalTrackToMatch(resource, "search"));

    if (candidates.length === 0) {
      continue;
    }

    const ranked = candidates
      .map((candidate) => ({
        candidate,
        score: scoreTidalCandidate(track, candidate),
      }))
      .sort((a, b) => b.score - a.score);

    if (ranked[0]?.score >= 3) {
      return ranked[0].candidate;
    }

    if (ranked[0] && (!bestFallback || ranked[0].score > bestFallback.score)) {
      bestFallback = ranked[0];
    }
  }

  return bestFallback && bestFallback.score >= 3
    ? bestFallback.candidate
    : null;
}

export async function createTidalPlaylist({
  accessToken,
  countryCode,
  description,
  name,
  visibility,
}: {
  accessToken: string;
  countryCode: string;
  description: string;
  name: string;
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
  playlistId,
  trackIds,
}: {
  accessToken: string;
  countryCode: string;
  playlistId: string;
  trackIds: string[];
}) {
  let added = 0;

  for (let index = 0; index < trackIds.length; index += 50) {
    const chunk = trackIds.slice(index, index + 50);

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
    });

    added += chunk.length;
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
