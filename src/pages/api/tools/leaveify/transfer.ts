import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import {
  addTracksToTidalPlaylist,
  createTidalPlaylist,
  fetchSpotifySource,
  fetchSpotifySourceTracks,
  findTidalTrackBySearch,
  findTidalTracksByIsrc,
  createProviderAccessTokenAccessor,
  getTidalClientCredentialsToken,
  getTidalCountryCode,
  LeaveifyApiError,
  LeaveifyPartialAddTracksError,
  mapWithConcurrency,
  type LeaveifyProvider,
  type ProviderAccessTokenAccessor,
  type SpotifyTrackForTransfer,
  type TidalTrackMatch,
} from "@/utils/leaveify";
import {
  createLeaveifyTransferControl,
  LeaveifyTransferCancelledError,
  updateLeaveifyTransferControl,
  type LeaveifyTransferControl,
} from "@/utils/leaveifyTransferControl";
import type { TransferProgressSnapshot } from "@/utils/leaveifyTypes";

export const prerender = false;

type TransferPayload = {
  deduplicateTracks?: boolean;
  // Kept as playlistId for request compatibility. It may also be the synthetic
  // Liked Songs source id.
  playlistId?: string;
  targetName?: string;
  visibility?: "PUBLIC" | "UNLISTED";
};

type MatchResult = {
  match: TidalTrackMatch | null;
  source: SpotifyTrackForTransfer;
};

type TidalSearchCache = Map<string, Promise<TidalTrackMatch | null>>;

type TransferResult = {
  addedTracks: number;
  countryCode: string;
  deduplicateTracks: boolean;
  duplicateTracksSkipped: number;
  matched: Array<{
    method: TidalTrackMatch["method"];
    sourceArtists: string[];
    sourceName: string;
    tidalId: string;
    tidalTitle: string;
  }>;
  matchedTracks: number;
  requestId: string;
  sourcePlaylist: {
    id: string;
    name: string;
    spotifyUrl: string | null;
    tracksTotal: number;
  };
  sourceTracks: number;
  tidalClientCredentialsUsed: boolean;
  tidalMatchingTokenSource: "client_credentials" | "user";
  tidalPlaylist: {
    id: string;
    name: string;
    url: string;
  };
  unmatched: Array<{
    albumName: string | null;
    artists: string[];
    name: string;
    spotifyUrl: string | null;
  }>;
  unmatchedTracks: number;
};

type TransferPartialFailureContext = {
  addedTracks: number;
  countryCode: string;
  deduplicateTracks: boolean;
  duplicateTracksSkipped: number;
  failedChunkIndex: number;
  failedChunkStart: number;
  failedTrackIds: string[];
  kind: "tidal_add_tracks";
  matchedTracks: number;
  remainingTrackIds: string[];
  requestId: string;
  sourcePlaylist: TransferResult["sourcePlaylist"];
  sourceTracks: number;
  tidalPlaylist: TransferResult["tidalPlaylist"];
  totalTracksToAdd: number;
  unmatchedTracks: number;
};

class LeaveifyPartialTransferFailureError extends LeaveifyApiError {
  cause: unknown;
  partial: TransferPartialFailureContext;

  constructor(
    cause: LeaveifyPartialAddTracksError,
    partial: TransferPartialFailureContext,
  ) {
    super(cause.message, cause.status);
    this.name = "LeaveifyPartialTransferFailureError";
    this.cause = cause;
    this.partial = partial;
  }
}

type TransferLogger = ReturnType<typeof createTransferLogger>;

type TransferTokenLookupPhase =
  | "stream_preflight"
  | "transfer_start"
  | "spotify_source"
  | "tidal_matching"
  | "tidal_playlist_create"
  | "tidal_playlist_add";

const shouldLogLeaveify =
  import.meta.env.DEV || import.meta.env.LEAVEIFY_DEBUG === "true";
const DEFAULT_TIDAL_SEARCH_CONCURRENCY = 3;
const MAX_TIDAL_SEARCH_CONCURRENCY = 6;

function getTidalSearchConcurrency() {
  const raw = import.meta.env.LEAVEIFY_TIDAL_SEARCH_CONCURRENCY?.trim();
  if (!raw) {
    return DEFAULT_TIDAL_SEARCH_CONCURRENCY;
  }

  const configured = Number(raw);
  if (!Number.isFinite(configured)) {
    return DEFAULT_TIDAL_SEARCH_CONCURRENCY;
  }

  return Math.max(
    1,
    Math.min(MAX_TIDAL_SEARCH_CONCURRENCY, Math.floor(configured)),
  );
}

function serializeError(error: unknown) {
  if (error instanceof LeaveifyApiError) {
    return {
      message: error.message,
      name: error.name,
      status: error.status,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  return {
    message: String(error),
    name: "UnknownError",
  };
}

function getPartialFailureContext(error: unknown) {
  return error instanceof LeaveifyPartialTransferFailureError
    ? error.partial
    : undefined;
}

function createTransferLogger(requestId: string) {
  const startedAt = Date.now();

  return (
    level: "error" | "info" | "warn",
    event: string,
    fields: Record<string, unknown> = {},
  ) => {
    if (!shouldLogLeaveify) return;

    console[level](
      "[leaveify]",
      JSON.stringify({
        elapsedMs: Date.now() - startedAt,
        event,
        requestId,
        ...fields,
      }),
    );
  };
}

function deduplicatePreservingOrder(trackIds: string[]) {
  const seen = new Set<string>();
  const deduplicated: string[] = [];

  for (const trackId of trackIds) {
    if (seen.has(trackId)) {
      continue;
    }

    seen.add(trackId);
    deduplicated.push(trackId);
  }

  return deduplicated;
}

function normalizeCachePart(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getSearchCacheKey(track: SpotifyTrackForTransfer) {
  return JSON.stringify({
    albumName: normalizeCachePart(track.albumName),
    artists: track.artists.map(normalizeCachePart),
    durationMs: track.durationMs,
    isrc: track.isrc ?? "",
    name: normalizeCachePart(track.name),
  });
}

async function findTidalTrackBySearchForRun({
  accessToken,
  cache,
  countryCode,
  signal,
  track,
}: {
  accessToken: string;
  cache: TidalSearchCache;
  countryCode: string;
  signal?: AbortSignal;
  track: SpotifyTrackForTransfer;
}) {
  const cacheKey = getSearchCacheKey(track);
  const cached = cache.get(cacheKey);

  if (cached) {
    return {
      cacheHit: true,
      match: await cached,
    };
  }

  const lookup = findTidalTrackBySearch({
    accessToken,
    countryCode,
    signal,
    track,
  }).catch((error) => {
    cache.delete(cacheKey);
    throw error;
  });
  cache.set(cacheKey, lookup);

  return {
    cacheHit: false,
    match: await lookup,
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

async function checkpoint(
  control: LeaveifyTransferControl | null,
  onPaused?: () => void | Promise<void>,
) {
  if (control) {
    await control.checkpoint({ onPaused });
  }
}

async function requireTransferAccessToken({
  log,
  phase,
  provider,
  tokenAccessor,
}: {
  log: TransferLogger;
  phase: TransferTokenLookupPhase;
  provider: LeaveifyProvider;
  tokenAccessor: ProviderAccessTokenAccessor;
}) {
  log("info", "token_lookup_start", { phase, provider });
  const token = await tokenAccessor.requireAccessToken(provider);
  log("info", "token_lookup_done", { phase, provider });
  return token;
}

async function requireTransferAccessTokens({
  log,
  phase,
  providers,
  tokenAccessor,
}: {
  log: TransferLogger;
  phase: TransferTokenLookupPhase;
  providers: LeaveifyProvider[];
  tokenAccessor: ProviderAccessTokenAccessor;
}) {
  await Promise.all(
    providers.map((provider) =>
      requireTransferAccessToken({ log, phase, provider, tokenAccessor }),
    ),
  );
}

async function runTransfer({
  control = null,
  log,
  onProgress,
  payload,
  requestId,
  tokenAccessor,
}: {
  control?: LeaveifyTransferControl | null;
  log: TransferLogger;
  onProgress?: (progress: TransferProgressSnapshot) => void | Promise<void>;
  payload: TransferPayload;
  requestId: string;
  tokenAccessor: ProviderAccessTokenAccessor;
}): Promise<TransferResult> {
  const sourceId = payload.playlistId?.trim();
  const deduplicateTracks = Boolean(payload.deduplicateTracks);
  log("info", "transfer_start", {
    deduplicateTracks,
    hasTargetName: Boolean(payload.targetName?.trim()),
    sourceId,
    visibility: payload.visibility ?? "UNLISTED",
  });

  if (!sourceId) {
    log("warn", "transfer_rejected", { reason: "missing_source_id" });
    throw new LeaveifyApiError("The 'playlistId' field is required", 400);
  }

  let lastProgress: TransferProgressSnapshot | null = null;
  const emitPausedProgress = async () => {
    if (!lastProgress) {
      return;
    }

    await onProgress?.({
      ...lastProgress,
      message: "Paused. Resume when ready.",
    });
  };
  const waitForCheckpoint = () => checkpoint(control, emitPausedProgress);
  const emitProgress = async (progress: TransferProgressSnapshot) => {
    lastProgress = progress;
    await onProgress?.(progress);
    await waitForCheckpoint();
  };

  await emitProgress({
    message: "Preparing transfer",
    phase: "starting",
    requestId,
    sourceId,
    tracksProcessed: 0,
    tracksTotal: 0,
  });

  const visibility = payload.visibility === "PUBLIC" ? "PUBLIC" : "UNLISTED";
  await requireTransferAccessTokens({
    log,
    phase: "transfer_start",
    providers: ["spotify", "tidal"],
    tokenAccessor,
  });
  const countryCode = getTidalCountryCode();
  await waitForCheckpoint();

  log("info", "spotify_source_fetch_start", { sourceId });
  let sourceName: string | undefined;
  const [sourcePlaylist, sourceTracks] = await Promise.all([
    requireTransferAccessToken({
      log,
      phase: "spotify_source",
      provider: "spotify",
      tokenAccessor,
    }).then((spotifyToken) =>
      fetchSpotifySource(spotifyToken, sourceId, {
        signal: control?.signal,
      }).then(async (playlist) => {
        sourceName = playlist.name;
        await emitProgress({
          message: "Reading Spotify source",
          phase: "loading_source",
          requestId,
          sourceId,
          sourceName: playlist.name,
          tracksProcessed: 0,
          tracksTotal: playlist.tracks.total,
        });
        return playlist;
      }),
    ),
    requireTransferAccessToken({
      log,
      phase: "spotify_source",
      provider: "spotify",
      tokenAccessor,
    }).then((spotifyToken) =>
      fetchSpotifySourceTracks(spotifyToken, sourceId, {
        onProgress: ({ loaded, total }) =>
          emitProgress({
            message: "Reading Spotify tracks",
            phase: "loading_source",
            requestId,
            sourceId,
            sourceName,
            tracksLoaded: loaded,
            tracksProcessed: loaded,
            tracksTotal: total,
          }),
        signal: control?.signal,
      }),
    ),
  ]);
  log("info", "spotify_source_fetch_done", {
    sourceId,
    sourceName: sourcePlaylist.name,
    sourceReportedTracks: sourcePlaylist.tracks.total,
    transferableTracks: sourceTracks.length,
    tracksWithIsrc: sourceTracks.filter((track) => track.isrc).length,
  });

  await emitProgress({
    message: "Spotify tracks loaded",
    phase: "loading_source",
    requestId,
    sourceId,
    sourceName: sourcePlaylist.name,
    tracksLoaded: sourceTracks.length,
    tracksProcessed: sourceTracks.length,
    tracksTotal: sourceTracks.length,
  });

  const targetName =
    payload.targetName?.trim() || `${sourcePlaylist.name} (Spotify import)`;
  log("info", "tidal_client_token_start");
  const tidalClientToken = await getTidalClientCredentialsToken({
    signal: control?.signal,
  }).catch((error) => {
    if (isAbortError(error) || control?.isCancelled()) {
      throw new LeaveifyTransferCancelledError();
    }
    log("warn", "tidal_client_token_failed", {
      error: serializeError(error),
    });
    return null;
  });
  log("info", "tidal_client_token_done", {
    available: Boolean(tidalClientToken),
  });
  const tidalMatchingToken =
    tidalClientToken ??
    (await requireTransferAccessToken({
      log,
      phase: "tidal_matching",
      provider: "tidal",
      tokenAccessor,
    }));
  await waitForCheckpoint();

  log("info", "isrc_match_start", {
    eligibleTracks: sourceTracks.filter((track) => track.isrc).length,
    tokenSource: tidalClientToken ? "client_credentials" : "user",
  });
  const isrcMatches = await findTidalTracksByIsrc({
    accessToken: tidalMatchingToken,
    countryCode,
    onProgress: ({ processed, total }) =>
      emitProgress({
        message: "Checking ISRC matches",
        phase: "matching_isrc",
        requestId,
        sourceId,
        sourceName: sourcePlaylist.name,
        tracksProcessed: total
          ? Math.min(
              sourceTracks.length,
              Math.round((processed / total) * sourceTracks.length),
            )
          : sourceTracks.length,
        tracksTotal: sourceTracks.length,
      }),
    signal: control?.signal,
    tracks: sourceTracks,
  });
  log("info", "isrc_match_done", { matches: isrcMatches.size });

  const prefilledResults: MatchResult[] = sourceTracks.map((source) => ({
    match: source.isrc ? (isrcMatches.get(source.isrc) ?? null) : null,
    source,
  }));
  const isrcMatchedTracks = prefilledResults.filter(
    (result) => result.match,
  ).length;
  const searchWork = prefilledResults
    .map((result, index) => ({ index, result }))
    .filter(({ result }) => !result.match);

  const searchConcurrency = getTidalSearchConcurrency();
  log("info", "search_match_start", {
    searchConcurrency,
    tracksToSearch: searchWork.length,
  });
  const searchCache: TidalSearchCache = new Map();
  let searchCacheHits = 0;
  let searchedTracks = 0;
  let searchMatches = 0;
  let searchMisses = 0;
  const searched = await mapWithConcurrency(
    searchWork,
    searchConcurrency,
    async ({ index, result }) => {
      const { cacheHit, match } = await findTidalTrackBySearchForRun({
        accessToken: tidalMatchingToken,
        cache: searchCache,
        countryCode,
        signal: control?.signal,
        track: result.source,
      }).catch((error) => {
        if (isAbortError(error) || control?.isCancelled()) {
          throw new LeaveifyTransferCancelledError();
        }
        log("warn", "search_match_failed", {
          error: serializeError(error),
          sourceArtists: result.source.artists,
          sourceName: result.source.name,
        });
        return { cacheHit: false, match: null };
      });

      if (cacheHit) {
        searchCacheHits += 1;
      }

      searchedTracks += 1;
      if (match) {
        searchMatches += 1;
      } else {
        searchMisses += 1;
      }

      await emitProgress({
        matchedTracks: isrcMatchedTracks + searchMatches,
        message: "Searching TIDAL",
        phase: "matching_search",
        requestId,
        sourceId,
        sourceName: sourcePlaylist.name,
        tracksProcessed: Math.min(
          sourceTracks.length,
          isrcMatchedTracks + searchedTracks,
        ),
        tracksTotal: sourceTracks.length,
        unmatchedTracks: searchMisses,
      });

      return { index, match };
    },
  );

  for (const { index, match } of searched) {
    prefilledResults[index].match = match;
    if (!match) {
      log("info", "search_match_miss", {
        sourceArtists: prefilledResults[index].source.artists,
        sourceName: prefilledResults[index].source.name,
      });
    }
  }
  log("info", "search_match_done", {
    cacheEntries: searchCache.size,
    cacheHits: searchCacheHits,
    matches: searched.filter((result) => result.match).length,
    misses: searched.filter((result) => !result.match).length,
  });

  const unmatched = prefilledResults
    .filter((result) => !result.match)
    .map((result) => ({
      albumName: result.source.albumName,
      artists: result.source.artists,
      name: result.source.name,
      spotifyUrl: result.source.spotifyUrl,
    }));
  const matched = prefilledResults
    .filter(
      (
        result,
      ): result is {
        match: TidalTrackMatch;
        source: SpotifyTrackForTransfer;
      } => Boolean(result.match),
    )
    .map((result) => ({
      method: result.match.method,
      sourceArtists: result.source.artists,
      sourceName: result.source.name,
      tidalId: result.match.id,
      tidalTitle: result.match.title,
    }));

  await emitProgress({
    matchedTracks: matched.length,
    message: "Creating TIDAL playlist",
    phase: "creating_playlist",
    requestId,
    sourceId,
    sourceName: sourcePlaylist.name,
    tracksProcessed: sourceTracks.length,
    tracksTotal: sourceTracks.length,
    unmatchedTracks: unmatched.length,
  });

  const matchedTrackIds = prefilledResults
    .map((result) => result.match?.id)
    .filter((id): id is string => Boolean(id));
  const trackIdsToAdd = deduplicateTracks
    ? deduplicatePreservingOrder(matchedTrackIds)
    : matchedTrackIds;
  const duplicateTracksSkipped = matchedTrackIds.length - trackIdsToAdd.length;

  log("info", "tidal_playlist_create_start", {
    targetName,
    visibility,
  });
  const tidalPlaylistToken = await requireTransferAccessToken({
    log,
    phase: "tidal_playlist_create",
    provider: "tidal",
    tokenAccessor,
  });
  const tidalPlaylist = await createTidalPlaylist({
    accessToken: tidalPlaylistToken,
    countryCode,
    description: `Imported from Spotify with Leaveify. Source: ${sourcePlaylist.name}`,
    name: targetName,
    signal: control?.signal,
    visibility,
  });
  log("info", "tidal_playlist_create_done", {
    tidalPlaylistId: tidalPlaylist.id,
    tidalPlaylistName: tidalPlaylist.name,
  });

  log("info", "tidal_playlist_add_tracks_start", {
    deduplicateTracks,
    duplicateTracksSkipped,
    matchedTrackEntries: matchedTrackIds.length,
    uniqueMatchedTracks: new Set(matchedTrackIds).size,
  });
  let addedTracks = 0;
  if (trackIdsToAdd.length > 0) {
    try {
      const tidalAddTracksToken = await requireTransferAccessToken({
        log,
        phase: "tidal_playlist_add",
        provider: "tidal",
        tokenAccessor,
      });
      addedTracks = await addTracksToTidalPlaylist({
        accessToken: tidalAddTracksToken,
        countryCode,
        onProgress: ({ added }) =>
          emitProgress({
            addedTracks: added,
            matchedTracks: matched.length,
            message: "Adding matched songs",
            phase: "adding_tracks",
            requestId,
            sourceId,
            sourceName: sourcePlaylist.name,
            tracksProcessed: sourceTracks.length,
            tracksTotal: sourceTracks.length,
            unmatchedTracks: unmatched.length,
          }),
        playlistId: tidalPlaylist.id,
        signal: control?.signal,
        trackIds: trackIdsToAdd,
      });
    } catch (error) {
      if (error instanceof LeaveifyPartialAddTracksError) {
        throw new LeaveifyPartialTransferFailureError(error, {
          addedTracks: error.addedTracks,
          countryCode,
          deduplicateTracks,
          duplicateTracksSkipped,
          failedChunkIndex: error.failedChunkIndex,
          failedChunkStart: error.failedChunkStart,
          failedTrackIds: error.failedTrackIds,
          kind: "tidal_add_tracks",
          matchedTracks: matched.length,
          remainingTrackIds: error.remainingTrackIds,
          requestId,
          sourcePlaylist: {
            id: sourcePlaylist.id,
            name: sourcePlaylist.name,
            spotifyUrl: sourcePlaylist.external_urls?.spotify ?? null,
            tracksTotal: sourcePlaylist.tracks.total,
          },
          sourceTracks: sourceTracks.length,
          tidalPlaylist: {
            id: tidalPlaylist.id,
            name: tidalPlaylist.name,
            url: `https://tidal.com/browse/playlist/${tidalPlaylist.id}`,
          },
          totalTracksToAdd: error.totalTracks,
          unmatchedTracks: unmatched.length,
        });
      }

      throw error;
    }
  }
  log("info", "tidal_playlist_add_tracks_done", { addedTracks });

  log("info", "transfer_done", {
    addedTracks,
    deduplicateTracks,
    duplicateTracksSkipped,
    matchedTracks: matched.length,
    sourceTracks: sourceTracks.length,
    unmatchedTracks: unmatched.length,
  });

  const result: TransferResult = {
    addedTracks,
    countryCode,
    deduplicateTracks,
    duplicateTracksSkipped,
    matched,
    matchedTracks: matched.length,
    requestId,
    sourcePlaylist: {
      id: sourcePlaylist.id,
      name: sourcePlaylist.name,
      spotifyUrl: sourcePlaylist.external_urls?.spotify ?? null,
      tracksTotal: sourcePlaylist.tracks.total,
    },
    sourceTracks: sourceTracks.length,
    tidalClientCredentialsUsed: Boolean(tidalClientToken),
    tidalMatchingTokenSource: tidalClientToken ? "client_credentials" : "user",
    tidalPlaylist: {
      id: tidalPlaylist.id,
      name: tidalPlaylist.name,
      url: `https://tidal.com/browse/playlist/${tidalPlaylist.id}`,
    },
    unmatched,
    unmatchedTracks: unmatched.length,
  };

  await emitProgress({
    addedTracks,
    matchedTracks: matched.length,
    message: "Transfer complete",
    phase: "done",
    requestId,
    sourceId,
    sourceName: sourcePlaylist.name,
    tracksProcessed: sourceTracks.length,
    tracksTotal: sourceTracks.length,
    unmatchedTracks: unmatched.length,
  });

  return result;
}

function shouldStreamProgress(request: Request) {
  return request.headers
    .get("Accept")
    ?.split(",")
    .some((value) => value.trim().startsWith("application/x-ndjson"));
}

function streamErrorResponse({
  error,
  log,
  requestId,
}: {
  error: unknown;
  log: TransferLogger;
  requestId: string;
}) {
  const message =
    error instanceof Error ? error.message : "Could not transfer source";
  const status = error instanceof LeaveifyApiError ? error.status : 500;
  const partial = getPartialFailureContext(error);

  log("error", "transfer_failed", {
    error: serializeError(error),
    partial,
    status,
  });

  return new Response(
    `${JSON.stringify({ error: message, partial, requestId, status, type: "error" })}\n`,
    {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
      status,
    },
  );
}

function streamTransfer({
  log,
  payload,
  requestId,
  requestSignal,
  tokenAccessor,
}: {
  log: TransferLogger;
  payload: TransferPayload;
  requestId: string;
  requestSignal: AbortSignal;
  tokenAccessor: ProviderAccessTokenAccessor;
}) {
  const encoder = new TextEncoder();
  const control = createLeaveifyTransferControl(requestId);
  let streamClosed = false;
  const cancelFromRequest = () => {
    updateLeaveifyTransferControl(requestId, "cancel");
  };
  requestSignal.addEventListener("abort", cancelFromRequest, { once: true });

  return new ReadableStream({
    async start(controller) {
      const write = (event: unknown) => {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          streamClosed = true;
        }
      };

      try {
        const result = await runTransfer({
          control,
          log,
          onProgress: (progress) => write({ progress, type: "progress" }),
          payload,
          requestId,
          tokenAccessor,
        });
        write({ result, type: "result" });
      } catch (error) {
        const cancelled =
          error instanceof LeaveifyTransferCancelledError ||
          isAbortError(error) ||
          control.isCancelled();
        const message = cancelled
          ? "Transfer cancelled."
          : error instanceof Error
            ? error.message
            : "Could not transfer source";
        const status = cancelled
          ? 499
          : error instanceof LeaveifyApiError
            ? error.status
            : 500;
        const partial = getPartialFailureContext(error);
        log("error", "transfer_failed", {
          error: serializeError(error),
          partial,
          status,
        });
        write({ error: message, partial, requestId, status, type: "error" });
      } finally {
        requestSignal.removeEventListener("abort", cancelFromRequest);
        control.dispose();
        if (!streamClosed) {
          streamClosed = true;
          controller.close();
        }
      }
    },
    cancel() {
      streamClosed = true;
      updateLeaveifyTransferControl(requestId, "cancel");
      requestSignal.removeEventListener("abort", cancelFromRequest);
      control.dispose();
    },
  });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const requestId = randomUUID();
  const log = createTransferLogger(requestId);
  const payload = (await request.json().catch(() => ({}))) as TransferPayload;
  const tokenAccessor = createProviderAccessTokenAccessor(cookies);

  if (shouldStreamProgress(request)) {
    if (payload.playlistId?.trim()) {
      try {
        // Once the streamed Response is returned, later cookie writes cannot be
        // serialized into Set-Cookie headers reliably. Run the first provider
        // lookup before fixing response headers so startup refreshes persist.
        // Later phase lookups can still refresh tokens for this server-side run.
        await requireTransferAccessTokens({
          log,
          phase: "stream_preflight",
          providers: ["spotify", "tidal"],
          tokenAccessor,
        });
      } catch (error) {
        return streamErrorResponse({ error, log, requestId });
      }
    }

    return new Response(
      streamTransfer({
        log,
        payload,
        requestId,
        requestSignal: request.signal,
        tokenAccessor,
      }),
      {
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/x-ndjson; charset=utf-8",
        },
      },
    );
  }

  try {
    const result = await runTransfer({
      log,
      payload,
      requestId,
      tokenAccessor,
    });
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not transfer source";
    const status = error instanceof LeaveifyApiError ? error.status : 500;
    const partial = getPartialFailureContext(error);
    log("error", "transfer_failed", {
      error: serializeError(error),
      partial,
      status,
    });
    return Response.json({ error: message, partial, requestId }, { status });
  }
};
