import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Heart,
  Link2,
  ListChecks,
  Loader2,
  Music2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Unplug,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import type {
  LeaveifyPlaylist,
  TransferProgressPhase,
  TransferProgressSnapshot,
} from "@/utils/leaveifyTypes";

import {
  createLeaveifyTransferReport,
  LEAVEIFY_REPORT_STORAGE_KEY,
  serializeUnmatchedTracksCsv,
  type LeaveifyTransferFailure,
  type LeaveifyTransferReport,
  type LeaveifyTransferResult,
} from "./report";

type ProviderStatus = {
  configured: boolean;
  connected: boolean;
  label: string;
  loginHref: string;
};

type LeaveifyStatus = {
  configured: {
    spotify: boolean;
    tidal: boolean;
  };
  connected: {
    spotify: boolean;
    tidal: boolean;
  };
  countryCode: string;
  ready: boolean;
};

type Notice = {
  text: string;
  tone: "error" | "info" | "success";
};

type TransferProgress = {
  addedTracks: number;
  completed: number;
  currentTrackCompleted: number;
  currentTrackTotal: number;
  currentName: string | null;
  matchedTracks: number;
  message: string;
  phase: TransferProgressPhase;
  startedAt: number;
  trackCompleted: number;
  trackTotal: number;
  total: number;
  unmatchedTracks: number;
  updatedAt: number;
};

const noticeClasses: Record<Notice["tone"], string> = {
  error:
    "border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40",
  info: "border-border bg-card text-muted-foreground dark:border-neutral-800",
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

type TransferStreamEvent =
  | {
      progress: TransferProgressSnapshot;
      type: "progress";
    }
  | {
      result: LeaveifyTransferResult;
      type: "result";
    }
  | {
      error?: string;
      partial?: LeaveifyTransferFailure["partial"];
      requestId?: string;
      status?: number;
      type: "error";
    };

type TransferResponseResult =
  | {
      ok: true;
      result: LeaveifyTransferResult;
    }
  | {
      error: string;
      ok: false;
      partial?: LeaveifyTransferFailure["partial"];
      requestId: string | null;
      status?: number;
    };

type TransferControlState = {
  cancelConfirming: boolean;
  cancelling: boolean;
  pausing: boolean;
  paused: boolean;
  requestId: string | null;
};

type DestructiveAction = "connections" | "manualSources" | "report";

type SourceFilter = "all" | "failed" | "liked" | "playlists" | "selected";

type SourceSort =
  | "name_asc"
  | "name_desc"
  | "owner_asc"
  | "tracks_asc"
  | "tracks_desc";

type ManualSourceStep = "idle" | "reading" | "fetching" | "added";

type ReportMatchMethod = "isrc" | "search";

type ReportMatchMethodCounts = {
  exact: number;
  search: number;
  supported: boolean;
  unknown: number;
};

type TransferResultWithMatchMethods = LeaveifyTransferResult & {
  matched?: Array<{
    method?: ReportMatchMethod | string | null;
  }>;
};

const sourceFilterLabels: Record<SourceFilter, string> = {
  all: "All sources",
  failed: "Failed",
  liked: "Liked songs",
  playlists: "Playlists",
  selected: "Selected",
};

const sourceSortLabels: Record<SourceSort, string> = {
  name_asc: "Name A-Z",
  name_desc: "Name Z-A",
  owner_asc: "Owner",
  tracks_asc: "Fewest tracks",
  tracks_desc: "Most tracks",
};

const manualSourceStepLabels: Array<{
  label: string;
  step: Exclude<ManualSourceStep, "idle">;
}> = [
  { label: "Read link", step: "reading" },
  { label: "Fetch details", step: "fetching" },
  { label: "Add source", step: "added" },
];

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

const LEAVEIFY_MANUAL_SOURCES_STORAGE_KEY = "leaveify:manualSpotifySources:v1";

function formatNumber(value: number) {
  return numberFormatter.format(Math.max(0, Math.round(value)));
}

function formatDefaultTargetName(playlist: LeaveifyPlaylist) {
  return `${playlist.name} (Spotify import)`;
}

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`;
}

function formatEta(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  if (seconds < 60) {
    return `~${Math.max(1, Math.round(seconds))} sec left`;
  }

  return `~${Math.max(1, Math.round(seconds / 60))} min left`;
}

function getTransferPhaseLabel(phase: TransferProgressPhase) {
  switch (phase) {
    case "starting":
      return "Preparing export";
    case "loading_source":
      return "Reading Spotify tracks";
    case "matching_isrc":
      return "Checking exact matches";
    case "matching_search":
      return "Searching TIDAL";
    case "creating_playlist":
      return "Creating playlist";
    case "adding_tracks":
      return "Adding matched songs";
    case "done":
      return "Finishing report";
  }
}

function readSavedReport() {
  try {
    const stored = window.localStorage.getItem(LEAVEIFY_REPORT_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as LeaveifyTransferReport;
  } catch {
    return null;
  }
}

function saveReport(report: LeaveifyTransferReport) {
  try {
    window.localStorage.setItem(
      LEAVEIFY_REPORT_STORAGE_KEY,
      JSON.stringify(report),
    );
  } catch {
    // Losing local persistence should not turn a completed transfer into an error.
  }
}

function clearSavedReport() {
  try {
    window.localStorage.removeItem(LEAVEIFY_REPORT_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

function isLeaveifyPlaylist(value: unknown): value is LeaveifyPlaylist {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Partial<LeaveifyPlaylist>;
  return (
    typeof source.id === "string" &&
    typeof source.name === "string" &&
    (source.kind === "liked_songs" || source.kind === "playlist") &&
    (source.description === null || typeof source.description === "string") &&
    (source.imageUrl === null || typeof source.imageUrl === "string") &&
    (source.ownerName === null || typeof source.ownerName === "string") &&
    typeof source.tracksTotal === "number"
  );
}

function readSavedManualSources() {
  try {
    const stored = window.localStorage.getItem(
      LEAVEIFY_MANUAL_SOURCES_STORAGE_KEY,
    );
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isLeaveifyPlaylist) : [];
  } catch {
    return [];
  }
}

function saveManualSources(sources: LeaveifyPlaylist[]) {
  try {
    window.localStorage.setItem(
      LEAVEIFY_MANUAL_SOURCES_STORAGE_KEY,
      JSON.stringify(sources),
    );
  } catch {
    // A pasted playlist can still be used in this session without storage.
  }
}

function clearSavedManualSources() {
  try {
    window.localStorage.removeItem(LEAVEIFY_MANUAL_SOURCES_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

function mergeSpotifySources(...sourceGroups: LeaveifyPlaylist[][]) {
  const seenSourceIds = new Set<string>();
  const mergedSources: LeaveifyPlaylist[] = [];

  for (const sources of sourceGroups) {
    for (const source of sources) {
      if (seenSourceIds.has(source.id)) {
        continue;
      }

      seenSourceIds.add(source.id);
      mergedSources.push(source);
    }
  }

  return mergedSources;
}

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getResultMatchMethodCounts(
  result: LeaveifyTransferResult,
): ReportMatchMethodCounts {
  const matched = (result as TransferResultWithMatchMethods).matched;

  if (!Array.isArray(matched)) {
    return {
      exact: 0,
      search: 0,
      supported: false,
      unknown: 0,
    };
  }

  return matched.reduce<ReportMatchMethodCounts>(
    (counts, track) => {
      if (track.method === "isrc") {
        counts.exact += 1;
      } else if (track.method === "search") {
        counts.search += 1;
      } else {
        counts.unknown += 1;
      }
      return counts;
    },
    {
      exact: 0,
      search: 0,
      supported: true,
      unknown: 0,
    },
  );
}

function getReportMatchMethodCounts(
  report: LeaveifyTransferReport,
): ReportMatchMethodCounts {
  if (!report.results.length) {
    return {
      exact: 0,
      search: 0,
      supported: false,
      unknown: 0,
    };
  }

  const counts = report.results.reduce<ReportMatchMethodCounts>(
    (totals, result) => {
      const resultCounts = getResultMatchMethodCounts(result);
      return {
        exact: totals.exact + resultCounts.exact,
        search: totals.search + resultCounts.search,
        supported: totals.supported && resultCounts.supported,
        unknown: totals.unknown + resultCounts.unknown,
      };
    },
    {
      exact: 0,
      search: 0,
      supported: true,
      unknown: 0,
    },
  );

  return counts;
}

function downloadUnmatchedTracks(report: LeaveifyTransferReport) {
  const blob = new Blob([serializeUnmatchedTracksCsv(report)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `leaveify-unmatched-${report.createdAt.slice(0, 10)}.csv`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

async function readTransferResponse(
  response: Response,
  onProgress: (progress: TransferProgressSnapshot) => void,
): Promise<TransferResponseResult> {
  const contentType = response.headers.get("Content-Type") ?? "";

  if (response.body && contentType.includes("application/x-ndjson")) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const streamState: {
      error: {
        error: string;
        partial?: LeaveifyTransferFailure["partial"];
        requestId: string | null;
        status?: number;
      } | null;
      result: LeaveifyTransferResult | null;
    } = {
      error: null,
      result: null,
    };

    const consumeLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const event = JSON.parse(trimmed) as TransferStreamEvent;
      if (event.type === "progress") {
        onProgress(event.progress);
      } else if (event.type === "result") {
        streamState.result = event.result;
      } else if (event.type === "error") {
        streamState.error = {
          error: event.error ?? "Transfer failed.",
          partial: event.partial,
          requestId: event.requestId ?? null,
          status: event.status,
        };
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        consumeLine(line);
      }
    }

    buffer += decoder.decode();
    consumeLine(buffer);

    if (streamState.result) {
      return { ok: true, result: streamState.result };
    }

    if (streamState.error) {
      return {
        error: streamState.error.error,
        ok: false,
        partial: streamState.error.partial,
        requestId: streamState.error.requestId,
        status: streamState.error.status,
      };
    }

    return {
      error: "Transfer ended before Leaveify returned a result.",
      ok: false,
      requestId: null,
    };
  }

  const data = (await response.json().catch(() => ({}))) as
    | LeaveifyTransferResult
    | {
        error?: string;
        partial?: LeaveifyTransferFailure["partial"];
        requestId?: string;
      };

  if (response.ok) {
    return { ok: true, result: data as LeaveifyTransferResult };
  }

  return {
    error:
      "error" in data && data.error
        ? data.error
        : `Transfer failed (${response.status}).`,
    ok: false,
    partial: "partial" in data ? data.partial : undefined,
    requestId: "requestId" in data && data.requestId ? data.requestId : null,
    status: response.status,
  };
}

function ProviderCard({
  disabled = false,
  provider,
}: {
  disabled?: boolean;
  provider: ProviderStatus;
}) {
  const Icon = provider.connected ? CheckCircle2 : Unplug;
  const badge = provider.connected
    ? "Connected"
    : provider.configured
      ? "Ready"
      : "Not ready yet";

  return (
    <div className="tool-panel flex min-h-44 flex-col justify-between gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            {provider.label}
          </p>
          <div className="flex items-center gap-2">
            <Icon
              aria-hidden="true"
              className={
                provider.connected
                  ? "h-5 w-5 text-emerald-600 dark:text-emerald-300"
                  : "h-5 w-5 text-muted-foreground"
              }
            />
            <h2 className="text-xl font-semibold text-foreground">
              {provider.connected ? "Connected" : "Connect account"}
            </h2>
          </div>
        </div>
        <span
          className={`rounded-md border px-2 py-1 text-xs font-medium ${
            provider.connected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : provider.configured
                ? "border-border bg-background text-muted-foreground dark:border-neutral-800 dark:bg-neutral-950"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }`}
        >
          {badge}
        </span>
      </div>

      {provider.configured ? (
        <a
          aria-disabled={disabled}
          className={`tool-button w-full ${disabled ? "pointer-events-none opacity-60" : ""}`}
          href={provider.loginHref}
          onClick={(event) => {
            if (disabled) {
              event.preventDefault();
            }
          }}
          tabIndex={disabled ? -1 : undefined}
        >
          {provider.connected ? "Reconnect" : "Connect"}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </a>
      ) : (
        <button className="tool-button w-full" disabled type="button">
          Coming soon
        </button>
      )}
    </div>
  );
}

function EmptyArtwork({
  className = "h-12 w-12",
  kind,
  name,
}: {
  className?: string;
  kind: LeaveifyPlaylist["kind"];
  name: string;
}) {
  const Icon = kind === "liked_songs" ? Heart : Music2;

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground dark:border-neutral-800 ${className}`}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
      <span className="sr-only">{name}</span>
    </div>
  );
}

function SourceSelectionMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors ${
        selected
          ? "border-[var(--tool-accent-border)] bg-[var(--tool-accent)] text-[var(--tool-accent-foreground)]"
          : "border-border bg-background text-transparent dark:border-neutral-800 dark:bg-neutral-950"
      }`}
    >
      <Check className="h-5 w-5" />
    </span>
  );
}

function SpotifyLibraryArtwork() {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[oklch(0.72_0.12_132)] text-[oklch(0.16_0.03_132)] shadow-sm">
      <Music2 aria-hidden="true" className="h-7 w-7" />
    </div>
  );
}

function SourceSelectionRow({
  disabled = false,
  onToggle,
  playlist,
  prominent = false,
  selected,
}: {
  disabled?: boolean;
  onToggle: () => void;
  playlist: LeaveifyPlaylist;
  prominent?: boolean;
  selected: boolean;
}) {
  const selectedTrackLabel = selected
    ? `${formatNumber(playlist.tracksTotal)}/${formatNumber(
        playlist.tracksTotal,
      )} selected`
    : `0/${formatNumber(playlist.tracksTotal)} selected`;
  const artworkSize = prominent ? "h-16 w-16" : "h-14 w-14";

  return (
    <label
      className={`relative grid min-h-[76px] grid-cols-[2rem_3.5rem_minmax(0,1fr)_1.25rem] items-center gap-4 rounded-xl px-3 py-2 text-left transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--tool-accent-soft)] sm:grid-cols-[2rem_4rem_minmax(0,1fr)_1.5rem] ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${
        selected
          ? "bg-[var(--tool-accent-soft)]"
          : disabled
            ? ""
            : "hover:bg-muted/60 dark:hover:bg-neutral-900/70"
      }`}
    >
      <input
        aria-label={`Select ${playlist.name}`}
        checked={selected}
        className="sr-only"
        disabled={disabled}
        onChange={onToggle}
        type="checkbox"
      />
      <SourceSelectionMark selected={selected} />
      {playlist.imageUrl ? (
        <img
          alt=""
          className={`${artworkSize} shrink-0 rounded-lg object-cover`}
          src={playlist.imageUrl}
        />
      ) : (
        <EmptyArtwork
          className={artworkSize}
          kind={playlist.kind}
          name={playlist.name}
        />
      )}
      <span className="min-w-0">
        <span className="block truncate text-base font-medium text-foreground">
          {playlist.name}
        </span>
        <span className="mt-1 block truncate text-sm text-muted-foreground">
          {selectedTrackLabel}
          {playlist.ownerName ? ` · ${playlist.ownerName}` : ""}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="h-5 w-5 justify-self-end text-muted-foreground/80"
      />
    </label>
  );
}

export default function Leaveify() {
  const [status, setStatus] = useState<LeaveifyStatus | null>(null);
  const [playlists, setPlaylists] = useState<LeaveifyPlaylist[]>([]);
  const [manualSources, setManualSources] = useState<LeaveifyPlaylist[]>([]);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceSort, setSourceSort] = useState<SourceSort>("name_asc");
  const [manualSourceInput, setManualSourceInput] = useState("");
  const [manualSourceStep, setManualSourceStep] =
    useState<ManualSourceStep>("idle");
  const [isResolvingManualSource, setIsResolvingManualSource] = useState(false);
  const [targetName, setTargetName] = useState("");
  const [targetNameManuallyEdited, setTargetNameManuallyEdited] =
    useState(false);
  const [visibility, setVisibility] = useState<"PUBLIC" | "UNLISTED">(
    "UNLISTED",
  );
  const [deduplicateTracks, setDeduplicateTracks] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [latestReport, setLatestReport] =
    useState<LeaveifyTransferReport | null>(null);
  const [transferProgress, setTransferProgress] =
    useState<TransferProgress | null>(null);
  const [activeTransferSources, setActiveTransferSources] = useState<
    LeaveifyPlaylist[]
  >([]);
  const [transferControl, setTransferControl] = useState<TransferControlState>({
    cancelConfirming: false,
    cancelling: false,
    pausing: false,
    paused: false,
    requestId: null,
  });
  const [pendingDestructiveAction, setPendingDestructiveAction] =
    useState<DestructiveAction | null>(null);
  const transferAbortControllerRef = useRef<AbortController | null>(null);
  const transferCancelRequestedRef = useRef(false);
  const transferRequestIdRef = useRef<string | null>(null);
  const autoTargetNameRef = useRef("");

  const playlistById = useMemo(
    () => new Map(playlists.map((playlist) => [playlist.id, playlist])),
    [playlists],
  );

  const selectedPlaylistIdSet = useMemo(
    () => new Set(selectedPlaylistIds),
    [selectedPlaylistIds],
  );

  const selectedPlaylists = useMemo(
    () =>
      selectedPlaylistIds
        .map((playlistId) => playlistById.get(playlistId))
        .filter((playlist): playlist is LeaveifyPlaylist => Boolean(playlist)),
    [playlistById, selectedPlaylistIds],
  );

  const selectedPlaylist =
    selectedPlaylists.length === 1 ? selectedPlaylists[0] : null;

  const failedPlaylistIds = useMemo(
    () =>
      new Set(
        latestReport?.failures.map((failure) => failure.playlistId) ?? [],
      ),
    [latestReport],
  );

  const likedSongsSource = useMemo(
    () => playlists.find((playlist) => playlist.kind === "liked_songs") ?? null,
    [playlists],
  );

  const playlistSources = useMemo(
    () => playlists.filter((playlist) => playlist.kind === "playlist"),
    [playlists],
  );

  const visiblePlaylists = useMemo(() => {
    const searchTerm = sourceSearch.trim().toLocaleLowerCase();
    const nextPlaylists = playlists.filter((playlist) => {
      if (
        sourceFilter === "selected" &&
        !selectedPlaylistIdSet.has(playlist.id)
      ) {
        return false;
      }

      if (sourceFilter === "failed" && !failedPlaylistIds.has(playlist.id)) {
        return false;
      }

      if (sourceFilter === "liked" && playlist.kind !== "liked_songs") {
        return false;
      }

      if (sourceFilter === "playlists" && playlist.kind !== "playlist") {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      const searchableText = [
        playlist.name,
        playlist.ownerName ?? "",
        playlist.description ?? "",
        playlist.kind === "liked_songs" ? "liked songs" : "playlist",
      ]
        .join(" ")
        .toLocaleLowerCase();

      return searchableText.includes(searchTerm);
    });

    return nextPlaylists.sort((first, second) => {
      const nameCompare = first.name.localeCompare(second.name, undefined, {
        sensitivity: "base",
      });

      switch (sourceSort) {
        case "name_desc":
          return -nameCompare;
        case "owner_asc": {
          const ownerCompare = (first.ownerName ?? "").localeCompare(
            second.ownerName ?? "",
            undefined,
            { sensitivity: "base" },
          );
          return ownerCompare || nameCompare;
        }
        case "tracks_asc":
          return first.tracksTotal - second.tracksTotal || nameCompare;
        case "tracks_desc":
          return second.tracksTotal - first.tracksTotal || nameCompare;
        case "name_asc":
          return nameCompare;
      }
    });
  }, [
    failedPlaylistIds,
    playlists,
    selectedPlaylistIdSet,
    sourceFilter,
    sourceSearch,
    sourceSort,
  ]);

  const visibleLikedSource =
    likedSongsSource &&
    visiblePlaylists.some((playlist) => playlist.id === likedSongsSource.id)
      ? likedSongsSource
      : null;

  const visiblePlaylistSources = useMemo(
    () => visiblePlaylists.filter((playlist) => playlist.kind === "playlist"),
    [visiblePlaylists],
  );

  const sourceListIsFiltered =
    Boolean(sourceSearch.trim()) || sourceFilter !== "all";

  const canAddManualSource = Boolean(
    status?.ready &&
    status.connected.spotify &&
    manualSourceInput.trim() &&
    !isResolvingManualSource &&
    !isTransferring,
  );

  const manualSourceStepIndex = manualSourceStepLabels.findIndex(
    ({ step }) => step === manualSourceStep,
  );

  const allSourcesSelected = Boolean(
    playlists.length && selectedPlaylistIds.length === playlists.length,
  );

  const allVisiblePlaylistsSelected = Boolean(
    visiblePlaylistSources.length &&
    visiblePlaylistSources.every((playlist) =>
      selectedPlaylistIdSet.has(playlist.id),
    ),
  );

  const retryableFailedPlaylistIds = useMemo(
    () =>
      Array.from(failedPlaylistIds).filter((playlistId) =>
        playlistById.has(playlistId),
      ),
    [failedPlaylistIds, playlistById],
  );

  const selectedTrackTotal = selectedPlaylists.reduce(
    (total, playlist) => total + playlist.tracksTotal,
    0,
  );

  const sourceTrackTotal = playlists.reduce(
    (total, playlist) => total + playlist.tracksTotal,
    0,
  );

  const selectedPlaylistSourceCount = playlistSources.filter((playlist) =>
    selectedPlaylistIdSet.has(playlist.id),
  ).length;
  const transferSources =
    transferProgress && activeTransferSources.length
      ? activeTransferSources
      : selectedPlaylists;
  const transferSourceTrackTotal = transferSources.reduce(
    (total, playlist) => total + playlist.tracksTotal,
    0,
  );

  const transferCompletionPercent = transferProgress
    ? Math.round(
        (transferProgress.trackCompleted /
          Math.max(transferProgress.trackTotal, 1)) *
          100,
      )
    : 0;
  const transferVisualPercent = transferProgress
    ? transferProgress.trackTotal > 0 &&
      transferProgress.trackCompleted >= transferProgress.trackTotal
      ? 100
      : transferCompletionPercent
    : 0;
  const transferStepLabel = transferProgress
    ? transferProgress.completed >= transferProgress.total
      ? "Finalizing report"
      : `Source ${transferProgress.completed + 1} of ${transferProgress.total}`
    : null;
  const transferElapsedSeconds = transferProgress
    ? Math.max(
        1,
        (transferProgress.updatedAt - transferProgress.startedAt) / 1000,
      )
    : 0;
  const transferSongsPerMinute =
    transferProgress && transferProgress.trackCompleted > 0
      ? Math.round(
          (transferProgress.trackCompleted / transferElapsedSeconds) * 60,
        )
      : null;
  const transferEtaLabel =
    transferProgress && transferSongsPerMinute && transferSongsPerMinute > 0
      ? formatEta(
          ((transferProgress.trackTotal - transferProgress.trackCompleted) /
            transferSongsPerMinute) *
            60,
        )
      : null;
  const transferBreakpoints = transferSources
    .reduce<Array<{ id: string; percent: number }>>((breakpoints, playlist) => {
      const previousTotal =
        breakpoints.length > 0
          ? (breakpoints[breakpoints.length - 1]?.percent ?? 0) *
            transferSourceTrackTotal
          : 0;
      const nextTotal = previousTotal + playlist.tracksTotal;
      if (nextTotal > 0 && transferSourceTrackTotal > 0) {
        breakpoints.push({
          id: playlist.id,
          percent: nextTotal / transferSourceTrackTotal,
        });
      }
      return breakpoints;
    }, [])
    .slice(0, -1);
  const transferDisplayMessage = transferProgress
    ? transferControl.cancelling
      ? "Cancelling transfer"
      : transferControl.pausing
        ? "Pausing at the next checkpoint"
        : transferControl.paused
          ? "Paused. Resume when ready."
          : transferProgress.message
    : null;
  const transferActivityLabel = transferProgress
    ? transferControl.cancelling
      ? "Cancelling"
      : transferControl.pausing
        ? "Pausing"
        : transferControl.paused
          ? "Paused"
          : transferSongsPerMinute
            ? `${formatNumber(transferSongsPerMinute)}/min`
            : getTransferPhaseLabel(transferProgress.phase)
    : null;
  const transferIsPausedOrPausing =
    transferControl.paused || transferControl.pausing;

  const reportTotals = useMemo(() => {
    if (!latestReport) {
      return null;
    }

    const initialTotals = {
      addedTracks: 0,
      duplicateTracksSkipped: 0,
      matchedTracks: 0,
      partialPlaylists: 0,
      sourceTracks: 0,
      unmatchedTracks: 0,
    };
    const resultTotals = latestReport.results.reduce(
      (totals, result) => ({
        ...totals,
        addedTracks: totals.addedTracks + result.addedTracks,
        duplicateTracksSkipped:
          totals.duplicateTracksSkipped + result.duplicateTracksSkipped,
        matchedTracks: totals.matchedTracks + result.matchedTracks,
        sourceTracks: totals.sourceTracks + result.sourceTracks,
        unmatchedTracks: totals.unmatchedTracks + result.unmatchedTracks,
      }),
      initialTotals,
    );

    return latestReport.failures.reduce((totals, failure) => {
      if (!failure.partial) {
        return totals;
      }

      return {
        ...totals,
        addedTracks: totals.addedTracks + failure.partial.addedTracks,
        duplicateTracksSkipped:
          totals.duplicateTracksSkipped +
          failure.partial.duplicateTracksSkipped,
        matchedTracks: totals.matchedTracks + failure.partial.matchedTracks,
        partialPlaylists: totals.partialPlaylists + 1,
        sourceTracks: totals.sourceTracks + failure.partial.sourceTracks,
        unmatchedTracks:
          totals.unmatchedTracks + failure.partial.unmatchedTracks,
      };
    }, resultTotals);
  }, [latestReport]);

  const reportMatchMethodCounts = useMemo(
    () => (latestReport ? getReportMatchMethodCounts(latestReport) : null),
    [latestReport],
  );

  const reportMetricItems = reportTotals
    ? [
        ["Source tracks", reportTotals.sourceTracks],
        ["Matched", reportTotals.matchedTracks],
        ...(reportMatchMethodCounts?.supported
          ? [
              ["Exact", reportMatchMethodCounts.exact],
              ["Search", reportMatchMethodCounts.search],
            ]
          : []),
        ["Added", reportTotals.addedTracks],
        ...(reportTotals.partialPlaylists > 0
          ? [["Partial", reportTotals.partialPlaylists]]
          : []),
        ["Misses", reportTotals.unmatchedTracks],
        ["Duplicates", reportTotals.duplicateTracksSkipped],
      ]
    : [];

  const sourceFilterOptions = useMemo(
    () =>
      (
        [
          "all",
          "selected",
          "playlists",
          "liked",
          ...(latestReport?.failures.length || sourceFilter === "failed"
            ? ["failed"]
            : []),
        ] as SourceFilter[]
      ).map((value) => ({
        label:
          value === "failed"
            ? `${sourceFilterLabels[value]} (${latestReport?.failures.length ?? 0})`
            : sourceFilterLabels[value],
        value,
      })),
    [latestReport?.failures.length, sourceFilter],
  );

  const sourceSummary = !status?.ready
    ? "Spotify login is not enabled yet"
    : playlists.length
      ? sourceListIsFiltered
        ? `${pluralize(visiblePlaylists.length, "source")} shown · ${selectedPlaylistIds.length} of ${playlists.length} selected`
        : `${selectedPlaylistIds.length} of ${playlists.length} selected`
      : "Connect Spotify to load sources";

  const providers = useMemo<ProviderStatus[]>(
    () => [
      {
        configured: Boolean(status?.configured.spotify),
        connected: Boolean(status?.connected.spotify),
        label: "Spotify source",
        loginHref: "/api/tools/leaveify/spotify/login",
      },
      {
        configured: Boolean(status?.configured.tidal),
        connected: Boolean(status?.connected.tidal),
        label: "TIDAL destination",
        loginHref: "/api/tools/leaveify/tidal/login",
      },
    ],
    [status],
  );

  const canTransfer = Boolean(
    status?.ready &&
    status?.connected.spotify &&
    status.connected.tidal &&
    selectedPlaylists.length > 0 &&
    !isTransferring,
  );

  async function loadStatus() {
    setIsLoadingStatus(true);
    try {
      const response = await fetch("/api/tools/leaveify/status");
      if (!response.ok) {
        throw new Error(`Status request failed (${response.status}).`);
      }
      const data = (await response.json()) as LeaveifyStatus;
      setStatus(data);
      return data;
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Could not load Leaveify status.",
        tone: "error",
      });
      return null;
    } finally {
      setIsLoadingStatus(false);
    }
  }

  async function loadPlaylists() {
    setIsLoadingPlaylists(true);
    try {
      const response = await fetch("/api/tools/leaveify/playlists");
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        playlists?: LeaveifyPlaylist[];
      };

      if (!response.ok) {
        throw new Error(
          data.error ?? `Spotify source request failed (${response.status}).`,
        );
      }

      const nextPlaylists = data.playlists ?? [];
      const librarySourceIds = new Set(
        nextPlaylists.map((playlist) => playlist.id),
      );
      const nextManualSources = readSavedManualSources().filter(
        (source) => !librarySourceIds.has(source.id),
      );
      saveManualSources(nextManualSources);
      const nextSources = mergeSpotifySources(nextPlaylists, nextManualSources);
      setManualSources(nextManualSources);
      setPlaylists(nextSources);
      setSelectedPlaylistIds((currentIds) =>
        currentIds.filter((playlistId) =>
          nextSources.some((playlist) => playlist.id === playlistId),
        ),
      );
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Could not load Spotify sources.",
        tone: "error",
      });
    } finally {
      setIsLoadingPlaylists(false);
    }
  }

  useEffect(() => {
    const savedManualSources = readSavedManualSources();
    setManualSources(savedManualSources);
    setPlaylists(savedManualSources);
    setLatestReport(readSavedReport());

    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const spotifyError = params.get("spotify_error");
    const tidalError = params.get("tidal_error");

    if (connected) {
      setNotice({ text: `${connected} connected.`, tone: "success" });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (spotifyError || tidalError) {
      setNotice({
        text: spotifyError
          ? `Spotify connection failed: ${spotifyError}`
          : `TIDAL connection failed: ${tidalError}`,
        tone: "error",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }

    void loadStatus().then((nextStatus) => {
      if (nextStatus?.connected.spotify) {
        void loadPlaylists();
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedPlaylist) {
      autoTargetNameRef.current = "";
      if (!targetNameManuallyEdited && targetName) {
        setTargetName("");
      }
      return;
    }

    const nextAutoTargetName = formatDefaultTargetName(selectedPlaylist);
    autoTargetNameRef.current = nextAutoTargetName;

    if (!targetNameManuallyEdited) {
      setTargetName(nextAutoTargetName);
    }
  }, [selectedPlaylist, targetName, targetNameManuallyEdited]);

  useEffect(() => {
    if (sourceFilter === "failed" && !latestReport?.failures.length) {
      setSourceFilter("all");
    }
  }, [latestReport?.failures.length, sourceFilter]);

  function confirmDestructiveAction(
    action: DestructiveAction,
    message: string,
  ) {
    if (pendingDestructiveAction !== action) {
      setPendingDestructiveAction(action);
      setNotice({ text: message, tone: "info" });
      return false;
    }

    setPendingDestructiveAction(null);
    return true;
  }

  function togglePlaylist(playlistId: string) {
    if (isTransferring) return;

    setSelectedPlaylistIds((currentIds) =>
      currentIds.includes(playlistId)
        ? currentIds.filter((currentId) => currentId !== playlistId)
        : [...currentIds, playlistId],
    );
  }

  async function handleManualSourceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input = manualSourceInput.trim();
    if (!input) {
      return;
    }

    if (isTransferring) {
      setNotice({
        text: "Finish or cancel the active transfer before adding sources.",
        tone: "info",
      });
      return;
    }

    if (!status?.ready || !status.connected.spotify) {
      setNotice({
        text: "Connect Spotify before adding a playlist link.",
        tone: "error",
      });
      return;
    }

    setIsResolvingManualSource(true);
    setManualSourceStep("reading");

    try {
      setManualSourceStep("fetching");
      const response = await fetch("/api/tools/leaveify/sources/resolve", {
        body: JSON.stringify({ input }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        playlist?: LeaveifyPlaylist;
      };

      if (!response.ok || !data.playlist) {
        throw new Error(
          data.error ?? `Spotify playlist request failed (${response.status}).`,
        );
      }

      const playlist = data.playlist;
      const alreadyLoaded = playlistById.has(playlist.id);
      setManualSourceStep("added");

      if (!alreadyLoaded) {
        setManualSources((currentSources) => {
          const nextSources = mergeSpotifySources(currentSources, [playlist]);
          saveManualSources(nextSources);
          return nextSources;
        });
        setPlaylists((currentSources) =>
          mergeSpotifySources(currentSources, [playlist]),
        );
      }

      setSelectedPlaylistIds((currentIds) =>
        currentIds.includes(playlist.id)
          ? currentIds
          : [...currentIds, playlist.id],
      );
      setManualSourceInput("");
      setSourceFilter("all");
      setSourceSearch("");
      setNotice({
        text: alreadyLoaded
          ? `${playlist.name} was already loaded and is now selected.`
          : `${playlist.name} added and selected.`,
        tone: "success",
      });
    } catch (error) {
      setManualSourceStep("idle");
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Could not add Spotify playlist.",
        tone: "error",
      });
    } finally {
      setIsResolvingManualSource(false);
    }
  }

  function handleTargetNameChange(event: ChangeEvent<HTMLInputElement>) {
    const nextTargetName = event.target.value;
    setTargetName(nextTargetName);
    setTargetNameManuallyEdited(nextTargetName !== autoTargetNameRef.current);
  }

  function selectVisiblePlaylists() {
    if (isTransferring) return;

    setSelectedPlaylistIds((currentIds) => {
      const nextIds = new Set(currentIds);
      for (const playlist of visiblePlaylistSources) {
        nextIds.add(playlist.id);
      }
      return Array.from(nextIds);
    });
  }

  function toggleAllSources() {
    if (isTransferring || !playlists.length) return;

    if (allSourcesSelected) {
      clearPlaylistSelection();
      return;
    }

    setSelectedPlaylistIds(playlists.map((playlist) => playlist.id));
  }

  function clearSourceFilters() {
    setSourceFilter("all");
    setSourceSearch("");
    setSourceSort("name_asc");
  }

  function clearPlaylistSelection() {
    if (isTransferring) return;

    setSelectedPlaylistIds([]);
    setTargetName("");
    setTargetNameManuallyEdited(false);
  }

  function clearManualSources() {
    if (isTransferring) return;

    if (
      !confirmDestructiveAction(
        "manualSources",
        "Click Confirm clear pasted to remove pasted Spotify sources.",
      )
    ) {
      return;
    }

    const manualSourceIds = new Set(manualSources.map((source) => source.id));
    clearSavedManualSources();
    setManualSources([]);
    setPlaylists((currentSources) =>
      currentSources.filter((source) => !manualSourceIds.has(source.id)),
    );
    setSelectedPlaylistIds((currentIds) =>
      currentIds.filter((playlistId) => !manualSourceIds.has(playlistId)),
    );
    setNotice({ text: "Pasted Spotify sources cleared.", tone: "info" });
  }

  function selectFailedSourcesFromReport() {
    if (isTransferring) return;

    if (!retryableFailedPlaylistIds.length) {
      setNotice({
        text: "Reload Spotify sources to retry failed sources that are still in your library.",
        tone: "info",
      });
      return;
    }

    setSelectedPlaylistIds(retryableFailedPlaylistIds);
    setSourceFilter("failed");
    setSourceSearch("");
    setNotice({
      text: `${pluralize(retryableFailedPlaylistIds.length, "failed source")} selected for retry.`,
      tone: "info",
    });
  }

  function handleClearReport() {
    if (isTransferring) return;

    if (
      !confirmDestructiveAction(
        "report",
        "Click Confirm clear report to remove the saved transfer report.",
      )
    ) {
      return;
    }

    clearSavedReport();
    setLatestReport(null);
  }

  async function handleSignOut() {
    if (isTransferring) return;

    if (
      !confirmDestructiveAction(
        "connections",
        "Click Confirm disconnect to clear Spotify and TIDAL connections.",
      )
    ) {
      return;
    }

    await fetch("/api/tools/leaveify/signout", { method: "POST" });
    setPlaylists([]);
    setManualSources([]);
    setSelectedPlaylistIds([]);
    clearSourceFilters();
    setManualSourceInput("");
    setManualSourceStep("idle");
    setTargetName("");
    setTargetNameManuallyEdited(false);
    setLatestReport(null);
    clearSavedReport();
    clearSavedManualSources();
    await loadStatus();
    setNotice({ text: "Connections cleared.", tone: "info" });
  }

  async function updateActiveTransfer(action: "cancel" | "pause" | "resume") {
    const requestId = transferRequestIdRef.current;

    if (action === "cancel") {
      transferCancelRequestedRef.current = true;
      setTransferControl((current) => ({
        ...current,
        cancelConfirming: false,
        cancelling: true,
        pausing: false,
        paused: false,
      }));
    } else if (action === "pause") {
      setTransferControl((current) => ({
        ...current,
        cancelConfirming: false,
        pausing: true,
        paused: false,
      }));
    } else {
      setTransferControl((current) => ({
        ...current,
        cancelConfirming: false,
        pausing: false,
        paused: false,
      }));
    }

    if (!requestId) {
      if (action === "cancel") {
        transferAbortControllerRef.current?.abort();
      }
      return;
    }

    try {
      const response = await fetch(
        `/api/tools/leaveify/transfer/${encodeURIComponent(requestId)}`,
        {
          body: JSON.stringify({ action }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error ?? `Could not ${action} transfer (${response.status}).`,
        );
      }
    } catch (error) {
      if (action === "cancel") {
        transferAbortControllerRef.current?.abort();
        return;
      }

      setTransferControl((current) => ({
        ...current,
        pausing: false,
        paused: action === "resume",
      }));
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : `Could not ${action} transfer.`,
        tone: "error",
      });
    }
  }

  function handlePauseResumeTransfer() {
    void updateActiveTransfer(transferControl.paused ? "resume" : "pause");
  }

  function handleCancelTransfer() {
    if (!transferControl.cancelConfirming) {
      setTransferControl((current) => ({
        ...current,
        cancelConfirming: true,
      }));
      return;
    }

    void updateActiveTransfer("cancel");
  }

  async function handleTransfer() {
    if (selectedPlaylists.length === 0) {
      setNotice({
        text: "Select at least one Spotify source first.",
        tone: "error",
      });
      return;
    }

    const transferPlaylists = [...selectedPlaylists];
    const results: LeaveifyTransferResult[] = [];
    const failures: LeaveifyTransferFailure[] = [];
    const transferStartedAt = Date.now();
    const transferTrackTotal = transferPlaylists.reduce(
      (total, playlist) => total + playlist.tracksTotal,
      0,
    );
    const abortController = new AbortController();
    let transferCancelled = false;

    transferAbortControllerRef.current = abortController;
    transferCancelRequestedRef.current = false;
    transferRequestIdRef.current = null;

    setActiveTransferSources(transferPlaylists);
    setIsTransferring(true);
    setPendingDestructiveAction(null);
    setTransferControl({
      cancelConfirming: false,
      cancelling: false,
      pausing: false,
      paused: false,
      requestId: null,
    });
    setTransferProgress({
      addedTracks: 0,
      completed: 0,
      currentTrackCompleted: 0,
      currentTrackTotal: transferPlaylists[0]?.tracksTotal ?? 0,
      currentName: transferPlaylists[0]?.name ?? null,
      matchedTracks: 0,
      message: "Preparing export",
      phase: "starting",
      startedAt: transferStartedAt,
      trackCompleted: 0,
      trackTotal: transferTrackTotal,
      total: transferPlaylists.length,
      unmatchedTracks: 0,
      updatedAt: transferStartedAt,
    });
    setNotice({
      text:
        transferPlaylists.length === 1
          ? "Matching Spotify tracks on TIDAL."
          : `Exporting ${transferPlaylists.length} sources to TIDAL.`,
      tone: "info",
    });

    try {
      for (const [index, playlist] of transferPlaylists.entries()) {
        if (transferCancelled) break;

        const completedTracksBeforeSource = transferPlaylists
          .slice(0, index)
          .reduce((total, source) => total + source.tracksTotal, 0);
        const addedTracksBeforeSource = results.reduce(
          (total, result) => total + result.addedTracks,
          0,
        );
        const matchedTracksBeforeSource = results.reduce(
          (total, result) => total + result.matchedTracks,
          0,
        );
        const unmatchedTracksBeforeSource = results.reduce(
          (total, result) => total + result.unmatchedTracks,
          0,
        );

        const applyProgress = (progress: TransferProgressSnapshot) => {
          if (
            progress.requestId &&
            transferRequestIdRef.current !== progress.requestId
          ) {
            transferRequestIdRef.current = progress.requestId;
          }

          setTransferControl((current) => {
            const reachedPauseCheckpoint =
              current.pausing && !current.cancelling;
            const nextRequestId = progress.requestId ?? current.requestId;

            if (
              nextRequestId === current.requestId &&
              !reachedPauseCheckpoint
            ) {
              return current;
            }

            return {
              ...current,
              cancelConfirming: false,
              pausing: reachedPauseCheckpoint ? false : current.pausing,
              paused: reachedPauseCheckpoint ? true : current.paused,
              requestId: nextRequestId,
            };
          });

          const sourceTrackTotal =
            playlist.tracksTotal || progress.tracksTotal || 0;
          const progressTrackTotal =
            progress.tracksTotal || sourceTrackTotal || 1;
          const rawTrackProgress =
            progress.tracksProcessed ?? progress.tracksLoaded ?? 0;
          const scaledCurrentTracks =
            progressTrackTotal > 0
              ? Math.round(
                  (rawTrackProgress / progressTrackTotal) * sourceTrackTotal,
                )
              : 0;
          const currentTrackCompleted = Math.min(
            sourceTrackTotal,
            Math.max(0, scaledCurrentTracks),
          );
          const trackCompleted = Math.min(
            transferTrackTotal,
            completedTracksBeforeSource + currentTrackCompleted,
          );
          const now = Date.now();

          setTransferProgress({
            addedTracks:
              addedTracksBeforeSource + Math.max(0, progress.addedTracks ?? 0),
            completed: index,
            currentTrackCompleted,
            currentTrackTotal: sourceTrackTotal,
            currentName: progress.sourceName ?? playlist.name,
            matchedTracks:
              matchedTracksBeforeSource +
              Math.max(0, progress.matchedTracks ?? 0),
            message: progress.message ?? getTransferPhaseLabel(progress.phase),
            phase: progress.phase,
            startedAt: transferStartedAt,
            trackCompleted,
            trackTotal: transferTrackTotal,
            total: transferPlaylists.length,
            unmatchedTracks:
              unmatchedTracksBeforeSource +
              Math.max(0, progress.unmatchedTracks ?? 0),
            updatedAt: now,
          });
        };

        setTransferProgress({
          addedTracks: addedTracksBeforeSource,
          completed: index,
          currentTrackCompleted: 0,
          currentTrackTotal: playlist.tracksTotal,
          currentName: playlist.name,
          matchedTracks: matchedTracksBeforeSource,
          message: "Preparing source",
          phase: "starting",
          startedAt: transferStartedAt,
          trackCompleted: completedTracksBeforeSource,
          trackTotal: transferTrackTotal,
          total: transferPlaylists.length,
          unmatchedTracks: unmatchedTracksBeforeSource,
          updatedAt: Date.now(),
        });

        try {
          const response = await fetch("/api/tools/leaveify/transfer", {
            body: JSON.stringify({
              deduplicateTracks,
              playlistId: playlist.id,
              targetName:
                transferPlaylists.length === 1 ? targetName.trim() : undefined,
              visibility,
            }),
            headers: {
              Accept: "application/x-ndjson",
              "Content-Type": "application/json",
            },
            method: "POST",
            signal: abortController.signal,
          });
          const transferResponse = await readTransferResponse(
            response,
            applyProgress,
          );

          if (transferResponse.ok) {
            results.push(transferResponse.result);
          } else if (transferResponse.status === 499) {
            transferCancelled = true;
            transferCancelRequestedRef.current = true;
            break;
          } else {
            failures.push({
              error:
                transferResponse.error ??
                `Transfer failed (${response.status}).`,
              partial: transferResponse.partial,
              playlistId: playlist.id,
              playlistName: playlist.name,
              requestId: transferResponse.requestId,
            });
          }
        } catch (error) {
          if (
            transferCancelRequestedRef.current ||
            (error instanceof Error && error.name === "AbortError")
          ) {
            transferCancelled = true;
            break;
          }

          failures.push({
            error:
              error instanceof Error
                ? error.message
                : "Transfer request failed.",
            playlistId: playlist.id,
            playlistName: playlist.name,
            requestId: null,
          });
        }

        if (transferCancelled) break;

        const nextAddedTracks = results.reduce(
          (total, result) => total + result.addedTracks,
          0,
        );
        const nextMatchedTracks = results.reduce(
          (total, result) => total + result.matchedTracks,
          0,
        );
        const nextUnmatchedTracks = results.reduce(
          (total, result) => total + result.unmatchedTracks,
          0,
        );
        const nextTrackCompleted = transferPlaylists
          .slice(0, index + 1)
          .reduce((total, source) => total + source.tracksTotal, 0);

        setTransferProgress({
          addedTracks: nextAddedTracks,
          completed: index + 1,
          currentTrackCompleted:
            index + 1 >= transferPlaylists.length ? playlist.tracksTotal : 0,
          currentTrackTotal:
            transferPlaylists[index + 1]?.tracksTotal ?? playlist.tracksTotal,
          currentName: transferPlaylists[index + 1]?.name ?? "Finishing report",
          matchedTracks: nextMatchedTracks,
          message:
            index + 1 >= transferPlaylists.length
              ? "Finishing report"
              : "Preparing next source",
          phase: index + 1 >= transferPlaylists.length ? "done" : "starting",
          startedAt: transferStartedAt,
          trackCompleted: Math.min(transferTrackTotal, nextTrackCompleted),
          trackTotal: transferTrackTotal,
          total: transferPlaylists.length,
          unmatchedTracks: nextUnmatchedTracks,
          updatedAt: Date.now(),
        });
      }

      const report =
        results.length > 0 || failures.length > 0
          ? createLeaveifyTransferReport({ failures, results })
          : null;
      if (report) {
        setLatestReport(report);
        saveReport(report);
      }

      if (transferCancelled || transferCancelRequestedRef.current) {
        setNotice({
          text: results.length
            ? `Transfer cancelled. ${results.length} source${results.length === 1 ? "" : "s"} exported before cancellation.`
            : "Transfer cancelled.",
          tone: "info",
        });
      } else if (results.length > 0 && failures.length === 0) {
        setNotice({
          text:
            transferPlaylists.length === 1
              ? "TIDAL playlist created."
              : `${results.length} TIDAL playlists created.`,
          tone: "success",
        });
      } else if (results.length > 0) {
        setNotice({
          text: `${results.length} source${results.length === 1 ? "" : "s"} exported. ${failures.length} failed.`,
          tone: "info",
        });
      } else {
        setNotice({
          text: "No sources were exported. Check the report below.",
          tone: "error",
        });
      }
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Could not transfer the selected sources.",
        tone: "error",
      });
    } finally {
      setIsTransferring(false);
      setTransferProgress(null);
      setTransferControl({
        cancelConfirming: false,
        cancelling: false,
        pausing: false,
        paused: false,
        requestId: null,
      });
      transferAbortControllerRef.current = null;
      transferRequestIdRef.current = null;
      transferCancelRequestedRef.current = false;
      setActiveTransferSources([]);
    }
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div
          aria-live={notice.tone === "error" ? "assertive" : "polite"}
          className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${noticeClasses[notice.tone]}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.tone === "error" ? (
            <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0"
            />
          )}
          <p>{notice.text}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {providers.map((provider) => (
          <ProviderCard
            disabled={isTransferring}
            key={provider.label}
            provider={provider}
          />
        ))}
      </div>

      {!isLoadingStatus && status && !status.ready && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200">
          Leaveify is not available yet. Spotify and TIDAL login will be enabled
          soon.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <section
          aria-labelledby="leaveify-sources-heading"
          className="tool-panel-lg flex min-h-0 flex-col overflow-hidden p-0 xl:h-[calc(100svh-9rem)] xl:max-h-[860px]"
        >
          <div className="border-b border-border bg-muted/50 p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900/45">
            <div className="grid gap-4 sm:grid-cols-[2rem_3.5rem_minmax(0,1fr)_auto] sm:items-center">
              <button
                aria-label={
                  allSourcesSelected
                    ? "Clear all Spotify sources"
                    : "Select all Spotify sources"
                }
                aria-pressed={allSourcesSelected}
                className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tool-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!playlists.length || isTransferring}
                onClick={toggleAllSources}
                type="button"
              >
                <SourceSelectionMark selected={allSourcesSelected} />
              </button>
              <SpotifyLibraryArtwork />
              <div className="min-w-0">
                <h2
                  className="truncate text-lg font-semibold text-foreground"
                  id="leaveify-sources-heading"
                >
                  Entire Spotify library
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {playlists.length
                    ? `${selectedPlaylistIds.length}/${playlists.length} sources selected · ${formatNumber(selectedTrackTotal)}/${formatNumber(sourceTrackTotal)} tracks`
                    : sourceSummary}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {status?.configured.spotify && (
                  <a
                    aria-disabled={isTransferring}
                    className={`text-sm font-medium underline-offset-4 ${
                      isTransferring
                        ? "pointer-events-none text-muted-foreground/60"
                        : "text-muted-foreground hover:text-foreground hover:underline"
                    }`}
                    href="/api/tools/leaveify/spotify/login"
                    onClick={(event) => {
                      if (isTransferring) {
                        event.preventDefault();
                      }
                    }}
                  >
                    Switch account
                  </a>
                )}
                <button
                  className="tool-button-secondary min-h-9 px-3"
                  disabled={
                    !status?.ready ||
                    !status.connected.spotify ||
                    isLoadingPlaylists ||
                    isTransferring
                  }
                  onClick={loadPlaylists}
                  type="button"
                >
                  {isLoadingPlaylists ? (
                    <Loader2
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                  ) : (
                    <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  )}
                  Reload
                </button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-5">
            <form
              className="rounded-xl border border-border bg-background p-3 dark:border-neutral-800 dark:bg-neutral-950"
              onSubmit={handleManualSourceSubmit}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Link2
                      aria-hidden="true"
                      className="h-4 w-4 text-muted-foreground"
                    />
                    Add Spotify playlist
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Paste a Spotify playlist URL or URI that is not listed
                    below.
                  </p>
                </div>
                {manualSources.length > 0 && (
                  <button
                    className="tool-button-secondary min-h-9 self-start px-3"
                    disabled={isResolvingManualSource || isTransferring}
                    onClick={clearManualSources}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    {pendingDestructiveAction === "manualSources"
                      ? "Confirm clear"
                      : "Clear pasted"}
                  </button>
                )}
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <label
                  className="relative block"
                  htmlFor="leaveify-manual-source"
                >
                  <span className="sr-only">Spotify playlist URL or URI</span>
                  <input
                    className="tool-field h-11 w-full"
                    disabled={
                      !status?.connected.spotify ||
                      isResolvingManualSource ||
                      isTransferring
                    }
                    id="leaveify-manual-source"
                    onChange={(event) => {
                      setManualSourceInput(event.target.value);
                      if (manualSourceStep === "added") {
                        setManualSourceStep("idle");
                      }
                    }}
                    placeholder="https://open.spotify.com/playlist/..."
                    type="text"
                    value={manualSourceInput}
                  />
                </label>
                <button
                  className="tool-button min-h-11 px-4"
                  disabled={!canAddManualSource}
                  type="submit"
                >
                  {isResolvingManualSource ? (
                    <Loader2
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                  ) : (
                    <Plus aria-hidden="true" className="h-4 w-4" />
                  )}
                  Add
                </button>
              </div>

              {manualSourceStep !== "idle" && (
                <ol className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  {manualSourceStepLabels.map(({ label, step }, index) => {
                    const isCurrent = step === manualSourceStep;
                    const isComplete =
                      manualSourceStep === "added"
                        ? index <= manualSourceStepIndex
                        : index < manualSourceStepIndex;

                    return (
                      <li
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                          isCurrent
                            ? "border-[var(--tool-accent-border)] bg-[var(--tool-accent-soft)] text-[var(--tool-accent-text)]"
                            : isComplete
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border-border bg-muted/40 dark:border-neutral-800"
                        }`}
                        key={step}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-semibold">
                          {isComplete ? (
                            <Check aria-hidden="true" className="h-3 w-3" />
                          ) : isCurrent && isResolvingManualSource ? (
                            <Loader2
                              aria-hidden="true"
                              className="h-3 w-3 animate-spin"
                            />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span className="truncate">{label}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </form>

            {isLoadingPlaylists ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  className="h-[76px] animate-pulse rounded-xl border border-border bg-muted/60 dark:border-neutral-800"
                  key={index}
                />
              ))
            ) : playlists.length ? (
              visiblePlaylists.length ? (
                <>
                  {visibleLikedSource && (
                    <SourceSelectionRow
                      disabled={isTransferring}
                      onToggle={() => togglePlaylist(visibleLikedSource.id)}
                      playlist={visibleLikedSource}
                      prominent
                      selected={selectedPlaylistIdSet.has(
                        visibleLikedSource.id,
                      )}
                    />
                  )}

                  {playlistSources.length > 0 && (
                    <div className="space-y-3 pt-1">
                      <div className="flex flex-col gap-3 border-t border-border pt-4 lg:flex-row lg:items-center lg:justify-between dark:border-neutral-800">
                        <div className="min-w-0">
                          <h3 className="text-base font-medium text-foreground">
                            Playlists ({formatNumber(playlistSources.length)})
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatNumber(selectedPlaylistSourceCount)}/
                            {formatNumber(playlistSources.length)} selected
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="tool-button-secondary min-h-9 px-3"
                            disabled={
                              !visiblePlaylistSources.length ||
                              allVisiblePlaylistsSelected ||
                              isTransferring
                            }
                            onClick={selectVisiblePlaylists}
                            type="button"
                          >
                            <ListChecks
                              aria-hidden="true"
                              className="h-4 w-4"
                            />
                            {sourceListIsFiltered
                              ? "Select visible"
                              : "Select all"}
                          </button>
                          <button
                            className="tool-button-secondary min-h-9 px-3"
                            disabled={
                              !selectedPlaylistIds.length || isTransferring
                            }
                            onClick={clearPlaylistSelection}
                            type="button"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_170px]">
                        <label
                          className="relative block"
                          htmlFor="leaveify-source-search"
                        >
                          <span className="sr-only">
                            Search Spotify sources
                          </span>
                          <Search
                            aria-hidden="true"
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                          />
                          <input
                            className="tool-field h-11 w-full pl-9"
                            id="leaveify-source-search"
                            onChange={(event) =>
                              setSourceSearch(event.target.value)
                            }
                            placeholder="Search"
                            type="search"
                            value={sourceSearch}
                          />
                        </label>

                        <label htmlFor="leaveify-source-filter">
                          <span className="sr-only">Show source group</span>
                          <select
                            className="tool-field h-11 w-full"
                            id="leaveify-source-filter"
                            onChange={(event) =>
                              setSourceFilter(
                                event.target.value as SourceFilter,
                              )
                            }
                            value={sourceFilter}
                          >
                            {sourceFilterOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label htmlFor="leaveify-source-sort">
                          <span className="sr-only">Sort Spotify sources</span>
                          <select
                            className="tool-field h-11 w-full"
                            id="leaveify-source-sort"
                            onChange={(event) =>
                              setSourceSort(event.target.value as SourceSort)
                            }
                            value={sourceSort}
                          >
                            {(
                              Object.keys(sourceSortLabels) as SourceSort[]
                            ).map((option) => (
                              <option key={option} value={option}>
                                {sourceSortLabels[option]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {visiblePlaylistSources.length ? (
                        <div className="space-y-1">
                          {visiblePlaylistSources.map((playlist) => (
                            <SourceSelectionRow
                              disabled={isTransferring}
                              key={playlist.id}
                              onToggle={() => togglePlaylist(playlist.id)}
                              playlist={playlist}
                              selected={selectedPlaylistIdSet.has(playlist.id)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground dark:border-neutral-800">
                          <p>No playlists match those filters.</p>
                          <button
                            className="tool-button-secondary mt-4"
                            onClick={clearSourceFilters}
                            type="button"
                          >
                            Clear filters
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground dark:border-neutral-800">
                  <p>No Spotify sources match those filters.</p>
                  <button
                    className="tool-button-secondary mt-4"
                    onClick={clearSourceFilters}
                    type="button"
                  >
                    Clear filters
                  </button>
                </div>
              )
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground dark:border-neutral-800">
                No Spotify sources loaded.
              </div>
            )}
          </div>
        </section>

        <aside
          aria-labelledby="leaveify-export-heading"
          className="tool-panel-lg h-fit space-y-5"
        >
          <div className="space-y-1">
            <h2
              className="text-lg font-semibold text-foreground"
              id="leaveify-export-heading"
            >
              TIDAL export
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {selectedPlaylist
                ? `${selectedPlaylist.name} will become a new TIDAL playlist.`
                : selectedPlaylists.length
                  ? `${selectedPlaylists.length} sources will be exported.`
                  : "Select one or more Spotify sources."}
            </p>
          </div>

          <div className="space-y-2">
            <label className="tool-label" htmlFor="leaveify-target-name">
              Playlist name
            </label>
            <input
              className="tool-field w-full"
              disabled={!selectedPlaylist || isTransferring}
              id="leaveify-target-name"
              onChange={handleTargetNameChange}
              placeholder={
                selectedPlaylists.length > 1
                  ? "Batch exports use source names"
                  : "Target playlist name"
              }
              type="text"
              value={selectedPlaylist ? targetName : ""}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="tool-label">Visibility</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["UNLISTED", "PUBLIC"] as const).map((option) => (
                <button
                  aria-pressed={visibility === option}
                  className={`min-h-10 rounded-lg border px-3 text-sm font-medium transition-colors ${
                    visibility === option
                      ? "border-[var(--tool-accent-border)] bg-[var(--tool-accent-soft)] text-[var(--tool-accent-text)]"
                      : "border-border bg-background text-foreground hover:bg-muted dark:border-neutral-800 dark:bg-neutral-950"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                  disabled={isTransferring}
                  key={option}
                  onClick={() => setVisibility(option)}
                  type="button"
                >
                  {option === "UNLISTED" ? "Unlisted" : "Public"}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 dark:border-neutral-800 dark:bg-neutral-950">
            <input
              checked={deduplicateTracks}
              className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--tool-accent)]"
              disabled={isTransferring}
              onChange={(event) => setDeduplicateTracks(event.target.checked)}
              type="checkbox"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                Deduplicate entries
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Keep the first matched copy.
              </span>
            </span>
          </label>

          <button
            className="tool-button w-full"
            disabled={!canTransfer}
            onClick={handleTransfer}
            type="button"
          >
            {isTransferring ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            )}
            {isTransferring
              ? "Transferring"
              : selectedPlaylistIds.length > 1
                ? "Export selected"
                : "Export to TIDAL"}
          </button>

          {transferProgress && (
            <>
              <p aria-live="polite" className="sr-only" role="status">
                {transferDisplayMessage}. {transferCompletionPercent}% complete.
              </p>
              <div className="rounded-lg border border-[var(--tool-accent-border)] bg-background p-4 text-sm shadow-sm dark:bg-neutral-950">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Export progress
                    </p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {transferProgress.currentName ?? "Preparing transfer"}
                      {transferStepLabel ? ` · ${transferStepLabel}` : ""}
                    </p>
                  </div>
                  <span className="rounded-md border border-[var(--tool-accent-border)] bg-[var(--tool-accent-soft)] px-2 py-1 text-xs font-semibold text-[var(--tool-accent-text)]">
                    {transferCompletionPercent}%
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-2xl font-semibold tabular-nums leading-none tracking-normal text-foreground">
                      {formatNumber(transferProgress.trackCompleted)}
                      <span className="text-base font-medium text-muted-foreground">
                        {" "}
                        / {formatNumber(transferProgress.trackTotal)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      songs processed
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">
                      {transferActivityLabel}
                    </p>
                    {transferEtaLabel &&
                      !transferControl.paused &&
                      !transferControl.cancelling && <p>{transferEtaLabel}</p>}
                  </div>
                </div>

                <div
                  aria-label="Overall export progress"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={transferVisualPercent}
                  className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                      transferControl.cancelling
                        ? "bg-destructive/70"
                        : transferIsPausedOrPausing
                          ? "bg-[var(--tool-accent)] opacity-45"
                          : "bg-[var(--tool-accent)]"
                    }`}
                    style={{
                      width: `${transferVisualPercent}%`,
                    }}
                  />
                  {transferBreakpoints.map((breakpoint) => (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 h-full w-px bg-background/80 dark:bg-neutral-950/80"
                      key={breakpoint.id}
                      style={{ left: `${breakpoint.percent * 100}%` }}
                    />
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="truncate">{transferDisplayMessage}</span>
                  <span>
                    {formatNumber(transferProgress.currentTrackCompleted)} /{" "}
                    {formatNumber(transferProgress.currentTrackTotal)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-[var(--tool-accent)] px-3 text-sm font-medium text-[var(--tool-accent-foreground)] transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      !transferControl.requestId ||
                      transferControl.cancelling ||
                      transferControl.pausing
                    }
                    onClick={handlePauseResumeTransfer}
                    type="button"
                  >
                    {transferControl.pausing ? (
                      <Loader2
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                      />
                    ) : transferControl.paused ? (
                      <Play aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Pause aria-hidden="true" className="h-4 w-4" />
                    )}
                    {transferControl.pausing
                      ? "Pausing"
                      : transferControl.paused
                        ? "Resume"
                        : "Pause"}
                  </button>
                  <button
                    className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      transferControl.cancelConfirming ||
                      transferControl.cancelling
                        ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
                        : "border-border bg-background text-muted-foreground hover:border-destructive/30 hover:text-destructive dark:border-neutral-800 dark:bg-neutral-950"
                    }`}
                    disabled={transferControl.cancelling}
                    onClick={handleCancelTransfer}
                    type="button"
                  >
                    {transferControl.cancelling ? (
                      <Loader2
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                      />
                    ) : (
                      <XCircle aria-hidden="true" className="h-4 w-4" />
                    )}
                    {transferControl.cancelling
                      ? "Cancelling"
                      : transferControl.cancelConfirming
                        ? "Confirm cancel"
                        : "Cancel"}
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    ["Added", transferProgress.addedTracks],
                    ["Matched", transferProgress.matchedTracks],
                    ["Misses", transferProgress.unmatchedTracks],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-lg border border-border bg-card/70 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                      key={label}
                    >
                      <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {formatNumber(Number(value))}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                <ol className="mt-4 max-h-52 space-y-2 overflow-y-auto pr-1">
                  {transferSources.map((playlist, index) => {
                    const isComplete = index < transferProgress.completed;
                    const isCurrent =
                      index === transferProgress.completed &&
                      transferProgress.completed < transferProgress.total;
                    const sourceTrackCompleted = isComplete
                      ? playlist.tracksTotal
                      : isCurrent
                        ? transferProgress.currentTrackCompleted
                        : 0;
                    const sourceProgressPercent = Math.round(
                      (sourceTrackCompleted /
                        Math.max(playlist.tracksTotal, 1)) *
                        100,
                    );
                    const statusLabel = isComplete
                      ? "Exported"
                      : isCurrent
                        ? transferControl.cancelling
                          ? "Cancelling"
                          : transferControl.pausing
                            ? "Pausing"
                            : transferControl.paused
                              ? "Paused"
                              : getTransferPhaseLabel(transferProgress.phase)
                        : "Waiting";

                    return (
                      <li
                        className={`rounded-lg border px-3 py-2 ${
                          isCurrent
                            ? "border-[var(--tool-accent-border)] bg-[var(--tool-accent-soft)]"
                            : "border-border bg-card/70 dark:border-neutral-800 dark:bg-neutral-950"
                        }`}
                        key={playlist.id}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                              isComplete
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : isCurrent
                                  ? "border-[var(--tool-accent-border)] bg-background text-[var(--tool-accent-text)] dark:bg-neutral-950"
                                  : "border-border bg-background text-muted-foreground dark:border-neutral-800 dark:bg-neutral-950"
                            }`}
                          >
                            {isComplete ? (
                              <CheckCircle2
                                aria-hidden="true"
                                className="h-4 w-4"
                              />
                            ) : isCurrent && transferControl.cancelling ? (
                              <XCircle aria-hidden="true" className="h-4 w-4" />
                            ) : isCurrent && transferControl.pausing ? (
                              <Loader2
                                aria-hidden="true"
                                className="h-4 w-4 animate-spin"
                              />
                            ) : isCurrent && transferControl.paused ? (
                              <Pause aria-hidden="true" className="h-4 w-4" />
                            ) : isCurrent ? (
                              <Loader2
                                aria-hidden="true"
                                className="h-4 w-4 animate-spin"
                              />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {playlist.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {statusLabel}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                            {isComplete || isCurrent
                              ? `${sourceProgressPercent}%`
                              : formatNumber(playlist.tracksTotal)}
                          </span>
                        </div>
                        {(isCurrent || isComplete) && (
                          <div
                            aria-label={`${playlist.name} export progress`}
                            aria-valuemax={100}
                            aria-valuemin={0}
                            aria-valuenow={sourceProgressPercent}
                            className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                          >
                            <div
                              className={`h-full rounded-full transition-all duration-300 ease-out ${
                                isCurrent && transferControl.cancelling
                                  ? "bg-destructive/70"
                                  : isCurrent && transferIsPausedOrPausing
                                    ? "bg-[var(--tool-accent)] opacity-45"
                                    : "bg-[var(--tool-accent)]"
                              }`}
                              style={{ width: `${sourceProgressPercent}%` }}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </>
          )}

          <button
            className="tool-button-secondary w-full"
            disabled={isTransferring}
            onClick={handleSignOut}
            type="button"
          >
            <Unplug aria-hidden="true" className="h-4 w-4" />
            {pendingDestructiveAction === "connections"
              ? "Confirm disconnect"
              : "Clear connections"}
          </button>
        </aside>
      </div>

      {latestReport && reportTotals && (
        <section
          aria-labelledby="leaveify-report-heading"
          className="tool-panel-lg space-y-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2
                className="text-lg font-semibold text-foreground"
                id="leaveify-report-heading"
              >
                Transfer report
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {latestReport.results.length} source
                {latestReport.results.length === 1 ? "" : "s"} exported.
                {latestReport.failures.length
                  ? ` ${latestReport.failures.length} failed.`
                  : ""}
                {reportTotals.partialPlaylists
                  ? ` ${formatNumber(reportTotals.partialPlaylists)} partially created.`
                  : ""}
                {reportMatchMethodCounts?.supported
                  ? ` ${formatNumber(reportMatchMethodCounts.exact)} exact and ${formatNumber(reportMatchMethodCounts.search)} search matches.`
                  : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Saved {formatReportDate(latestReport.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="tool-button-secondary"
                disabled={latestReport.unmatched.length === 0}
                onClick={() => downloadUnmatchedTracks(latestReport)}
                type="button"
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                Download misses
              </button>
              <button
                className="tool-button-secondary"
                disabled={isTransferring}
                onClick={handleClearReport}
                type="button"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                {pendingDestructiveAction === "report"
                  ? "Confirm clear"
                  : "Clear report"}
              </button>
            </div>
          </div>

          <div
            className={`grid gap-3 sm:grid-cols-2 ${
              reportMatchMethodCounts?.supported
                ? "lg:grid-cols-7"
                : "lg:grid-cols-5"
            }`}
          >
            {reportMetricItems.map(([label, value]) => (
              <div
                className="rounded-lg border border-border bg-background p-4 dark:border-neutral-800 dark:bg-neutral-950"
                key={label}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {formatNumber(Number(value))}
                </p>
              </div>
            ))}
          </div>

          {latestReport.results.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Created playlists
              </h3>
              <div className="overflow-hidden rounded-lg border border-border dark:border-neutral-800">
                <div className="max-h-72 overflow-x-auto overflow-y-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="sticky top-0 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium" scope="col">
                          Source
                        </th>
                        <th className="px-3 py-2 font-medium" scope="col">
                          Added
                        </th>
                        {reportMatchMethodCounts?.supported && (
                          <>
                            <th className="px-3 py-2 font-medium" scope="col">
                              Exact
                            </th>
                            <th className="px-3 py-2 font-medium" scope="col">
                              Search
                            </th>
                          </>
                        )}
                        <th className="px-3 py-2 font-medium" scope="col">
                          Misses
                        </th>
                        <th className="px-3 py-2 font-medium" scope="col">
                          TIDAL
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border dark:divide-neutral-800">
                      {latestReport.results.map((result) => {
                        const resultMatchMethodCounts =
                          getResultMatchMethodCounts(result);

                        return (
                          <tr key={result.requestId}>
                            <th
                              className="max-w-64 truncate px-3 py-2 text-left font-medium text-foreground"
                              scope="row"
                            >
                              {result.sourcePlaylist.name}
                            </th>
                            <td className="px-3 py-2 text-muted-foreground">
                              {formatNumber(result.addedTracks)}
                            </td>
                            {reportMatchMethodCounts?.supported && (
                              <>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {formatNumber(resultMatchMethodCounts.exact)}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {formatNumber(resultMatchMethodCounts.search)}
                                </td>
                              </>
                            )}
                            <td className="px-3 py-2 text-muted-foreground">
                              {formatNumber(result.unmatchedTracks)}
                            </td>
                            <td className="px-3 py-2">
                              <a
                                aria-label={`Open ${result.tidalPlaylist.name} on TIDAL`}
                                className="inline-flex items-center gap-1 text-[var(--tool-accent-text)] hover:underline"
                                href={result.tidalPlaylist.url}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Open
                                <ExternalLink
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5"
                                />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {latestReport.failures.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Failed sources
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {retryableFailedPlaylistIds.length
                      ? `${pluralize(retryableFailedPlaylistIds.length, "source")} can be selected from the loaded Spotify list.`
                      : "Reload Spotify sources to retry failures that are still in your library."}
                  </p>
                </div>
                <button
                  className="tool-button-secondary"
                  disabled={
                    !retryableFailedPlaylistIds.length || isTransferring
                  }
                  onClick={selectFailedSourcesFromReport}
                  type="button"
                >
                  <ListChecks aria-hidden="true" className="h-4 w-4" />
                  Select failed
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border dark:border-neutral-800">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium" scope="col">
                        Source
                      </th>
                      <th className="px-3 py-2 font-medium" scope="col">
                        Problem
                      </th>
                      <th className="px-3 py-2 font-medium" scope="col">
                        Reference
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-neutral-800">
                    {latestReport.failures.map((failure) => (
                      <tr key={`${failure.playlistId}-${failure.requestId}`}>
                        <th
                          className="max-w-52 truncate px-3 py-2 text-left font-medium text-foreground"
                          scope="row"
                        >
                          {failure.playlistName}
                        </th>
                        <td className="px-3 py-2 text-muted-foreground">
                          <p className="break-words">{failure.error}</p>
                          {failure.partial && (
                            <p className="mt-1 text-xs">
                              Partial playlist:{" "}
                              {formatNumber(failure.partial.addedTracks)} /{" "}
                              {formatNumber(failure.partial.totalTracksToAdd)}{" "}
                              tracks added.{" "}
                              <a
                                aria-label={`Open partially created ${failure.partial.tidalPlaylist.name} on TIDAL`}
                                className="inline-flex items-center gap-1 text-[var(--tool-accent-text)] hover:underline"
                                href={failure.partial.tidalPlaylist.url}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Open
                                <ExternalLink
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5"
                                />
                              </a>
                            </p>
                          )}
                        </td>
                        <td className="break-all px-3 py-2 font-mono text-xs text-muted-foreground">
                          {failure.requestId ?? "No request id"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {latestReport.unmatched.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Not matched
              </h3>
              <div className="overflow-hidden rounded-lg border border-border dark:border-neutral-800">
                <div className="max-h-80 overflow-x-auto overflow-y-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="sticky top-0 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium" scope="col">
                          Source
                        </th>
                        <th className="px-3 py-2 font-medium" scope="col">
                          Track
                        </th>
                        <th className="px-3 py-2 font-medium" scope="col">
                          Artist
                        </th>
                        <th className="px-3 py-2 font-medium" scope="col">
                          Album
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border dark:divide-neutral-800">
                      {latestReport.unmatched.map((track, index) => (
                        <tr
                          key={`${track.sourcePlaylistId}-${track.name}-${index}`}
                        >
                          <th
                            className="px-3 py-2 text-left font-medium text-muted-foreground"
                            scope="row"
                          >
                            <span className="block max-w-52 truncate">
                              {track.sourcePlaylistName}
                            </span>
                          </th>
                          <td className="px-3 py-2 text-foreground">
                            {track.spotifyUrl ? (
                              <a
                                aria-label={`Open ${track.name} on Spotify`}
                                className="block max-w-64 truncate hover:underline"
                                href={track.spotifyUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                {track.name}
                              </a>
                            ) : (
                              <span className="block max-w-64 truncate">
                                {track.name}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            <span className="block max-w-56 truncate">
                              {track.artists.join(", ") || "Unknown"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            <span className="block max-w-56 truncate">
                              {track.albumName ?? "Unknown"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
