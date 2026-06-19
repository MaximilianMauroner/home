import {
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  Heart,
  ListChecks,
  Loader2,
  Music2,
  RefreshCw,
  Trash2,
  Unplug,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

type LeaveifyPlaylist = {
  description: string | null;
  id: string;
  imageUrl: string | null;
  kind: "liked_songs" | "playlist";
  name: string;
  ownerName: string | null;
  tracksTotal: number;
};

type Notice = {
  text: string;
  tone: "error" | "info" | "success";
};

type TransferProgress = {
  completed: number;
  currentName: string | null;
  total: number;
};

const noticeClasses: Record<Notice["tone"], string> = {
  error:
    "border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40",
  info: "border-border bg-card text-muted-foreground dark:border-neutral-800",
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

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

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

function ProviderCard({ provider }: { provider: ProviderStatus }) {
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
        <a className="tool-button w-full" href={provider.loginHref}>
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
  kind,
  name,
}: {
  kind: LeaveifyPlaylist["kind"];
  name: string;
}) {
  const Icon = kind === "liked_songs" ? Heart : Music2;

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground dark:border-neutral-800">
      <Icon aria-hidden="true" className="h-5 w-5" />
      <span className="sr-only">{name}</span>
    </div>
  );
}

export default function Leaveify() {
  const [status, setStatus] = useState<LeaveifyStatus | null>(null);
  const [playlists, setPlaylists] = useState<LeaveifyPlaylist[]>([]);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [targetName, setTargetName] = useState("");
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

  const playlistById = useMemo(
    () => new Map(playlists.map((playlist) => [playlist.id, playlist])),
    [playlists],
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

  const allPlaylistsSelected = Boolean(
    playlists.length && selectedPlaylistIds.length === playlists.length,
  );

  const reportTotals = useMemo(
    () =>
      latestReport
        ? latestReport.results.reduce(
            (totals, result) => ({
              addedTracks: totals.addedTracks + result.addedTracks,
              duplicateTracksSkipped:
                totals.duplicateTracksSkipped + result.duplicateTracksSkipped,
              matchedTracks: totals.matchedTracks + result.matchedTracks,
              sourceTracks: totals.sourceTracks + result.sourceTracks,
              unmatchedTracks: totals.unmatchedTracks + result.unmatchedTracks,
            }),
            {
              addedTracks: 0,
              duplicateTracksSkipped: 0,
              matchedTracks: 0,
              sourceTracks: 0,
              unmatchedTracks: 0,
            },
          )
        : null,
    [latestReport],
  );

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
      setPlaylists(nextPlaylists);
      setSelectedPlaylistIds((currentIds) =>
        currentIds.filter((playlistId) =>
          nextPlaylists.some((playlist) => playlist.id === playlistId),
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
      if (targetName) {
        setTargetName("");
      }
      return;
    }

    if (!targetName.trim()) {
      setTargetName(`${selectedPlaylist.name} (Spotify import)`);
    }
  }, [selectedPlaylist, targetName]);

  function togglePlaylist(playlistId: string) {
    setSelectedPlaylistIds((currentIds) =>
      currentIds.includes(playlistId)
        ? currentIds.filter((currentId) => currentId !== playlistId)
        : [...currentIds, playlistId],
    );
  }

  function selectAllPlaylists() {
    setSelectedPlaylistIds(playlists.map((playlist) => playlist.id));
    setTargetName("");
  }

  function clearPlaylistSelection() {
    setSelectedPlaylistIds([]);
    setTargetName("");
  }

  function handleClearReport() {
    clearSavedReport();
    setLatestReport(null);
  }

  async function handleSignOut() {
    await fetch("/api/tools/leaveify/signout", { method: "POST" });
    setPlaylists([]);
    setSelectedPlaylistIds([]);
    setTargetName("");
    setLatestReport(null);
    clearSavedReport();
    await loadStatus();
    setNotice({ text: "Connections cleared.", tone: "info" });
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

    setIsTransferring(true);
    setTransferProgress({
      completed: 0,
      currentName: transferPlaylists[0]?.name ?? null,
      total: transferPlaylists.length,
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
        setTransferProgress({
          completed: index,
          currentName: playlist.name,
          total: transferPlaylists.length,
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
              "Content-Type": "application/json",
            },
            method: "POST",
          });
          const data = (await response.json().catch(() => ({}))) as
            | LeaveifyTransferResult
            | { error?: string; requestId?: string };

          if (response.ok) {
            results.push(data as LeaveifyTransferResult);
          } else {
            failures.push({
              error:
                "error" in data && data.error
                  ? data.error
                  : `Transfer failed (${response.status}).`,
              playlistId: playlist.id,
              playlistName: playlist.name,
              requestId:
                "requestId" in data && data.requestId ? data.requestId : null,
            });
          }
        } catch (error) {
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

        setTransferProgress({
          completed: index + 1,
          currentName: transferPlaylists[index + 1]?.name ?? "Finishing report",
          total: transferPlaylists.length,
        });
      }

      const report = createLeaveifyTransferReport({ failures, results });
      setLatestReport(report);
      saveReport(report);

      if (results.length > 0 && failures.length === 0) {
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
    }
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${noticeClasses[notice.tone]}`}
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
          <ProviderCard key={provider.label} provider={provider} />
        ))}
      </div>

      {!isLoadingStatus && status && !status.ready && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200">
          Leaveify is not available yet. Spotify and TIDAL login will be enabled
          soon.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="tool-panel-lg space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Spotify sources
              </h2>
              <p className="text-sm text-muted-foreground">
                {!status?.ready
                  ? "Spotify login is not enabled yet"
                  : playlists.length
                    ? `${selectedPlaylistIds.length} of ${playlists.length} selected`
                    : "Connect Spotify to load sources"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="tool-button-secondary"
                disabled={!playlists.length || allPlaylistsSelected}
                onClick={selectAllPlaylists}
                type="button"
              >
                <ListChecks aria-hidden="true" className="h-4 w-4" />
                Select all
              </button>
              <button
                className="tool-button-secondary"
                disabled={!selectedPlaylistIds.length}
                onClick={clearPlaylistSelection}
                type="button"
              >
                Clear
              </button>
              <button
                className="tool-button-secondary"
                disabled={
                  !status?.ready ||
                  !status.connected.spotify ||
                  isLoadingPlaylists
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

          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {isLoadingPlaylists ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  className="h-20 animate-pulse rounded-lg border border-border bg-muted/60 dark:border-neutral-800"
                  key={index}
                />
              ))
            ) : playlists.length ? (
              playlists.map((playlist) => {
                const selected = selectedPlaylistIds.includes(playlist.id);
                return (
                  <label
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? "border-[var(--tool-accent-border)] bg-[var(--tool-accent-soft)]"
                        : "border-border bg-background hover:bg-muted/60 dark:border-neutral-800 dark:bg-neutral-950"
                    }`}
                    key={playlist.id}
                  >
                    <input
                      checked={selected}
                      className="h-4 w-4 shrink-0 rounded border-border accent-[var(--tool-accent)]"
                      onChange={() => togglePlaylist(playlist.id)}
                      type="checkbox"
                    />
                    {playlist.imageUrl ? (
                      <img
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        src={playlist.imageUrl}
                      />
                    ) : (
                      <EmptyArtwork kind={playlist.kind} name={playlist.name} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {playlist.name}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {playlist.tracksTotal} tracks
                        {playlist.ownerName ? ` · ${playlist.ownerName}` : ""}
                      </span>
                    </span>
                    {selected && (
                      <CheckCircle2
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-[var(--tool-accent-text)]"
                      />
                    )}
                  </label>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground dark:border-neutral-800">
                No Spotify sources loaded.
              </div>
            )}
          </div>
        </section>

        <aside className="tool-panel-lg h-fit space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
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

          <label className="block space-y-2">
            <span className="tool-label">Playlist name</span>
            <input
              className="tool-field w-full"
              disabled={!selectedPlaylist}
              onChange={(event) => setTargetName(event.target.value)}
              placeholder={
                selectedPlaylists.length > 1
                  ? "Batch exports use source names"
                  : "Target playlist name"
              }
              type="text"
              value={targetName}
            />
          </label>

          <div className="space-y-2">
            <p className="tool-label">Visibility</p>
            <div className="grid grid-cols-2 gap-2">
              {(["UNLISTED", "PUBLIC"] as const).map((option) => (
                <button
                  className={`min-h-10 rounded-lg border px-3 text-sm font-medium transition-colors ${
                    visibility === option
                      ? "border-[var(--tool-accent-border)] bg-[var(--tool-accent-soft)] text-[var(--tool-accent-text)]"
                      : "border-border bg-background text-foreground hover:bg-muted dark:border-neutral-800 dark:bg-neutral-950"
                  }`}
                  key={option}
                  onClick={() => setVisibility(option)}
                  type="button"
                >
                  {option === "UNLISTED" ? "Unlisted" : "Public"}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 dark:border-neutral-800 dark:bg-neutral-950">
            <input
              checked={deduplicateTracks}
              className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--tool-accent)]"
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
            <div className="rounded-lg border border-border bg-background p-3 text-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>
                  {transferProgress.completed} of {transferProgress.total}
                </span>
                <span className="truncate">
                  {transferProgress.currentName ?? "Preparing"}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[var(--tool-accent)] transition-all"
                  style={{
                    width: `${Math.round(
                      (transferProgress.completed / transferProgress.total) *
                        100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          <button
            className="tool-button-secondary w-full"
            onClick={handleSignOut}
            type="button"
          >
            <Unplug aria-hidden="true" className="h-4 w-4" />
            Clear connections
          </button>
        </aside>
      </div>

      {latestReport && reportTotals && (
        <section className="tool-panel-lg space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Transfer report
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {latestReport.results.length} source
                {latestReport.results.length === 1 ? "" : "s"} exported.
                {latestReport.failures.length
                  ? ` ${latestReport.failures.length} failed.`
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
                onClick={handleClearReport}
                type="button"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Clear report
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Source tracks", reportTotals.sourceTracks],
              ["Matched", reportTotals.matchedTracks],
              ["Added", reportTotals.addedTracks],
              ["Misses", reportTotals.unmatchedTracks],
              ["Duplicates", reportTotals.duplicateTracksSkipped],
            ].map(([label, value]) => (
              <div
                className="rounded-lg border border-border bg-background p-4 dark:border-neutral-800 dark:bg-neutral-950"
                key={label}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {value}
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
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Source</th>
                        <th className="px-3 py-2 font-medium">Added</th>
                        <th className="px-3 py-2 font-medium">Misses</th>
                        <th className="px-3 py-2 font-medium">TIDAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border dark:divide-neutral-800">
                      {latestReport.results.map((result) => (
                        <tr key={result.requestId}>
                          <td className="px-3 py-2 text-foreground">
                            {result.sourcePlaylist.name}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {result.addedTracks}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {result.unmatchedTracks}
                          </td>
                          <td className="px-3 py-2">
                            <a
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {latestReport.failures.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Failed sources
              </h3>
              <div className="overflow-hidden rounded-lg border border-border dark:border-neutral-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Source</th>
                      <th className="px-3 py-2 font-medium">Problem</th>
                      <th className="px-3 py-2 font-medium">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-neutral-800">
                    {latestReport.failures.map((failure) => (
                      <tr key={`${failure.playlistId}-${failure.requestId}`}>
                        <td className="px-3 py-2 text-foreground">
                          {failure.playlistName}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {failure.error}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
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
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Source</th>
                        <th className="px-3 py-2 font-medium">Track</th>
                        <th className="px-3 py-2 font-medium">Artist</th>
                        <th className="px-3 py-2 font-medium">Album</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border dark:divide-neutral-800">
                      {latestReport.unmatched.map((track, index) => (
                        <tr
                          key={`${track.sourcePlaylistId}-${track.name}-${index}`}
                        >
                          <td className="px-3 py-2 text-muted-foreground">
                            {track.sourcePlaylistName}
                          </td>
                          <td className="px-3 py-2 text-foreground">
                            {track.spotifyUrl ? (
                              <a
                                className="hover:underline"
                                href={track.spotifyUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                {track.name}
                              </a>
                            ) : (
                              track.name
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {track.artists.join(", ") || "Unknown"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {track.albumName ?? "Unknown"}
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
