import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import {
  addTracksToTidalPlaylist,
  createTidalPlaylist,
  fetchSpotifyPlaylist,
  fetchSpotifyPlaylistTracks,
  findTidalTrackBySearch,
  findTidalTracksByIsrc,
  getTidalClientCredentialsToken,
  getTidalCountryCode,
  LeaveifyApiError,
  mapWithConcurrency,
  requireProviderAccessToken,
  type SpotifyTrackForTransfer,
  type TidalTrackMatch,
} from "@/utils/leaveify";

export const prerender = false;

type TransferPayload = {
  deduplicateTracks?: boolean;
  playlistId?: string;
  targetName?: string;
  visibility?: "PUBLIC" | "UNLISTED";
};

type MatchResult = {
  match: TidalTrackMatch | null;
  source: SpotifyTrackForTransfer;
};

const shouldLogLeaveify =
  import.meta.env.DEV || import.meta.env.LEAVEIFY_DEBUG === "true";

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

export const POST: APIRoute = async ({ cookies, request }) => {
  const requestId = randomUUID();
  const log = createTransferLogger(requestId);

  try {
    const payload = (await request.json().catch(() => ({}))) as TransferPayload;
    const playlistId = payload.playlistId?.trim();
    const deduplicateTracks = Boolean(payload.deduplicateTracks);
    log("info", "transfer_start", {
      deduplicateTracks,
      hasTargetName: Boolean(payload.targetName?.trim()),
      playlistId,
      visibility: payload.visibility ?? "UNLISTED",
    });

    if (!playlistId) {
      log("warn", "transfer_rejected", { reason: "missing_playlist_id" });
      return Response.json(
        { error: "The 'playlistId' field is required", requestId },
        { status: 400 },
      );
    }

    const visibility = payload.visibility === "PUBLIC" ? "PUBLIC" : "UNLISTED";
    log("info", "token_lookup_start");
    const [spotifyToken, tidalToken] = await Promise.all([
      requireProviderAccessToken(cookies, "spotify"),
      requireProviderAccessToken(cookies, "tidal"),
    ]);
    log("info", "token_lookup_done");
    const countryCode = getTidalCountryCode();

    log("info", "spotify_playlist_fetch_start", { playlistId });
    const [sourcePlaylist, sourceTracks] = await Promise.all([
      fetchSpotifyPlaylist(spotifyToken, playlistId),
      fetchSpotifyPlaylistTracks(spotifyToken, playlistId),
    ]);
    log("info", "spotify_playlist_fetch_done", {
      playlistId,
      playlistName: sourcePlaylist.name,
      playlistReportedTracks: sourcePlaylist.tracks.total,
      transferableTracks: sourceTracks.length,
      tracksWithIsrc: sourceTracks.filter((track) => track.isrc).length,
    });

    const targetName =
      payload.targetName?.trim() || `${sourcePlaylist.name} (Spotify import)`;
    log("info", "tidal_client_token_start");
    const tidalClientToken = await getTidalClientCredentialsToken().catch(
      (error) => {
        log("warn", "tidal_client_token_failed", {
          error: serializeError(error),
        });
        return null;
      },
    );
    log("info", "tidal_client_token_done", {
      available: Boolean(tidalClientToken),
    });
    const tidalMatchingToken = tidalClientToken ?? tidalToken;

    log("info", "isrc_match_start", {
      eligibleTracks: sourceTracks.filter((track) => track.isrc).length,
      tokenSource: tidalClientToken ? "client_credentials" : "user",
    });
    const isrcMatches = tidalMatchingToken
      ? await findTidalTracksByIsrc({
          accessToken: tidalMatchingToken,
          countryCode,
          tracks: sourceTracks,
        })
      : new Map<string, TidalTrackMatch>();
    log("info", "isrc_match_done", { matches: isrcMatches.size });

    const prefilledResults: MatchResult[] = sourceTracks.map((source) => ({
      match: source.isrc ? (isrcMatches.get(source.isrc) ?? null) : null,
      source,
    }));
    const searchWork = prefilledResults
      .map((result, index) => ({ index, result }))
      .filter(({ result }) => !result.match);

    log("info", "search_match_start", { tracksToSearch: searchWork.length });
    const searched = await mapWithConcurrency(
      searchWork,
      1,
      async ({ index, result }) => ({
        index,
        match: await findTidalTrackBySearch({
          accessToken: tidalMatchingToken,
          countryCode,
          track: result.source,
        }).catch((error) => {
          log("warn", "search_match_failed", {
            error: serializeError(error),
            sourceArtists: result.source.artists,
            sourceName: result.source.name,
          });
          return null;
        }),
      }),
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
      matches: searched.filter((result) => result.match).length,
      misses: searched.filter((result) => !result.match).length,
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
    const tidalPlaylist = await createTidalPlaylist({
      accessToken: tidalToken,
      countryCode,
      description: `Imported from Spotify with Leaveify. Source playlist: ${sourcePlaylist.name}`,
      name: targetName,
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
    const addedTracks =
      trackIdsToAdd.length > 0
        ? await addTracksToTidalPlaylist({
            accessToken: tidalToken,
            countryCode,
            playlistId: tidalPlaylist.id,
            trackIds: trackIdsToAdd,
          })
        : 0;
    log("info", "tidal_playlist_add_tracks_done", { addedTracks });

    const unmatched = prefilledResults
      .filter((result) => !result.match)
      .map((result) => ({
        albumName: result.source.albumName,
        artists: result.source.artists,
        name: result.source.name,
        spotifyUrl: result.source.spotifyUrl,
      }));
    const matched = prefilledResults
      .filter((result) => result.match)
      .map((result) => ({
        method: result.match?.method,
        sourceArtists: result.source.artists,
        sourceName: result.source.name,
        tidalId: result.match?.id,
        tidalTitle: result.match?.title,
      }));

    log("info", "transfer_done", {
      addedTracks,
      deduplicateTracks,
      duplicateTracksSkipped,
      matchedTracks: matched.length,
      sourceTracks: sourceTracks.length,
      unmatchedTracks: unmatched.length,
    });

    return Response.json({
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
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not transfer playlist";
    const status = error instanceof LeaveifyApiError ? error.status : 500;
    log("error", "transfer_failed", {
      error: serializeError(error),
      status,
    });
    return Response.json({ error: message, requestId }, { status });
  }
};
