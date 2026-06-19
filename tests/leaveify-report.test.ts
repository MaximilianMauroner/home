import { describe, expect, test } from "vitest";

import {
  createLeaveifyTransferReport,
  serializeUnmatchedTracksCsv,
  type LeaveifyTransferResult,
} from "../src/components/tools/Leaveify/report";

function transferResult(
  overrides: Partial<LeaveifyTransferResult>,
): LeaveifyTransferResult {
  return {
    addedTracks: 1,
    countryCode: "US",
    deduplicateTracks: false,
    duplicateTracksSkipped: 0,
    matchedTracks: 1,
    requestId: "request-1",
    sourcePlaylist: {
      id: "spotify-playlist-1",
      name: "Source Playlist",
      spotifyUrl: "https://open.spotify.com/playlist/source",
      tracksTotal: 2,
    },
    sourceTracks: 2,
    tidalPlaylist: {
      id: "tidal-playlist-1",
      name: "Source Playlist (Spotify import)",
      url: "https://tidal.com/browse/playlist/tidal-playlist-1",
    },
    unmatched: [],
    unmatchedTracks: 0,
    ...overrides,
  };
}

describe("Leaveify transfer report", () => {
  test("keeps unmatched tracks attached to their source playlists", () => {
    const report = createLeaveifyTransferReport({
      failures: [],
      now: new Date("2026-06-19T12:00:00.000Z"),
      results: [
        transferResult({
          requestId: "request-a",
          sourcePlaylist: {
            id: "playlist-a",
            name: "Playlist A",
            spotifyUrl: null,
            tracksTotal: 1,
          },
          unmatched: [
            {
              albumName: "Album A",
              artists: ["Artist A"],
              name: "Missing A",
              spotifyUrl: "https://open.spotify.com/track/a",
            },
          ],
          unmatchedTracks: 1,
        }),
        transferResult({
          requestId: "request-b",
          sourcePlaylist: {
            id: "playlist-b",
            name: "Playlist B",
            spotifyUrl: null,
            tracksTotal: 1,
          },
          unmatched: [
            {
              albumName: null,
              artists: ["Artist B"],
              name: "Missing B",
              spotifyUrl: null,
            },
          ],
          unmatchedTracks: 1,
        }),
      ],
    });

    expect(report.id).toBe("leaveify-2026-06-19T12:00:00.000Z");
    expect(
      report.unmatched.map(({ name, requestId, sourcePlaylistName }) => ({
        name,
        requestId,
        sourcePlaylistName,
      })),
    ).toEqual([
      {
        name: "Missing A",
        requestId: "request-a",
        sourcePlaylistName: "Playlist A",
      },
      {
        name: "Missing B",
        requestId: "request-b",
        sourcePlaylistName: "Playlist B",
      },
    ]);
  });

  test("serializes unmatched tracks as a spreadsheet-friendly CSV", () => {
    const report = createLeaveifyTransferReport({
      failures: [],
      now: new Date("2026-06-19T12:00:00.000Z"),
      results: [
        transferResult({
          requestId: "request-a",
          sourcePlaylist: {
            id: "playlist-a",
            name: "Playlist, A",
            spotifyUrl: null,
            tracksTotal: 1,
          },
          unmatched: [
            {
              albumName: 'Album "A"',
              artists: ["Artist A", "Artist B"],
              name: "Missing A",
              spotifyUrl: "https://open.spotify.com/track/a",
            },
          ],
          unmatchedTracks: 1,
        }),
      ],
    });

    expect(serializeUnmatchedTracksCsv(report)).toBe(
      [
        '"Source","Track","Artists","Album","Spotify URL","Request ID"',
        '"Playlist, A","Missing A","Artist A, Artist B","Album ""A""","https://open.spotify.com/track/a","request-a"',
        "",
      ].join("\n"),
    );
  });
});
