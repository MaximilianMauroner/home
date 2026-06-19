export type LeaveifyUnmatchedTrack = {
  albumName: string | null;
  artists: string[];
  name: string;
  spotifyUrl: string | null;
};

export type LeaveifyTransferResult = {
  addedTracks: number;
  countryCode: string;
  deduplicateTracks: boolean;
  duplicateTracksSkipped: number;
  matchedTracks: number;
  requestId: string;
  sourcePlaylist: {
    id: string;
    name: string;
    spotifyUrl: string | null;
    tracksTotal: number;
  };
  sourceTracks: number;
  tidalPlaylist: {
    id: string;
    name: string;
    url: string;
  };
  unmatched: LeaveifyUnmatchedTrack[];
  unmatchedTracks: number;
};

export type LeaveifyTransferFailure = {
  error: string;
  playlistId: string;
  playlistName: string;
  requestId: string | null;
};

export type LeaveifyReportTrack = LeaveifyUnmatchedTrack & {
  requestId: string;
  sourcePlaylistId: string;
  sourcePlaylistName: string;
};

export type LeaveifyTransferReport = {
  createdAt: string;
  failures: LeaveifyTransferFailure[];
  id: string;
  results: LeaveifyTransferResult[];
  unmatched: LeaveifyReportTrack[];
};

export const LEAVEIFY_REPORT_STORAGE_KEY = "leaveify:lastTransferReport:v1";

export function createLeaveifyTransferReport({
  failures,
  now = new Date(),
  results,
}: {
  failures: LeaveifyTransferFailure[];
  now?: Date;
  results: LeaveifyTransferResult[];
}): LeaveifyTransferReport {
  const createdAt = now.toISOString();

  return {
    createdAt,
    failures,
    id: `leaveify-${createdAt}`,
    results,
    unmatched: results.flatMap((result) =>
      result.unmatched.map((track) => ({
        ...track,
        requestId: result.requestId,
        sourcePlaylistId: result.sourcePlaylist.id,
        sourcePlaylistName: result.sourcePlaylist.name,
      })),
    ),
  };
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function serializeUnmatchedTracksCsv(report: LeaveifyTransferReport) {
  const rows = [
    ["Source", "Track", "Artists", "Album", "Spotify URL", "Request ID"],
    ...report.unmatched.map((track) => [
      track.sourcePlaylistName,
      track.name,
      track.artists.join(", "),
      track.albumName ?? "",
      track.spotifyUrl ?? "",
      track.requestId,
    ]),
  ];

  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}
