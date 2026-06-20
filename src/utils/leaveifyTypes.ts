export type LeaveifyPlaylist = {
  description: string | null;
  id: string;
  imageUrl: string | null;
  kind: "liked_songs" | "playlist";
  name: string;
  ownerName: string | null;
  tracksTotal: number;
};

export type TransferProgressPhase =
  | "starting"
  | "loading_source"
  | "matching_isrc"
  | "matching_search"
  | "creating_playlist"
  | "adding_tracks"
  | "done";

export type TransferProgressSnapshot = {
  addedTracks?: number;
  matchedTracks?: number;
  message?: string;
  phase: TransferProgressPhase;
  requestId: string;
  sourceId?: string;
  sourceName?: string;
  tracksLoaded?: number;
  tracksProcessed?: number;
  tracksTotal?: number;
  unmatchedTracks?: number;
};
