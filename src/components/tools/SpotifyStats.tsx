import { useEffect, useState, useRef, useMemo } from "react";
import JSZip from "jszip";
import { type Track } from "@/types/spotify";

const CHUNK_SIZE = 1000; // Process 1000 tracks at a time

export default function SpotifyStats() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [files, setFiles] = useState<{ name: string; content: string }[]>([]);
  const [tracks, setTracks] = useState<Map<string, Track[]>>(new Map());
  const [artists, setArtists] = useState<Map<string, number>>(new Map());
  const [timeframe, setTimeframe] = useState<string>("year");
  const [dateRange, setDateRange] = useState<{
    start: string;
    end: string;
  }>({
    start: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [pendingDateRange, setPendingDateRange] = useState<{
    start: string;
    end: string;
  }>(dateRange);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const resetData = () => {
    setStatus("");
    setFiles([]);
    setTracks(new Map());
    setArtists(new Map());
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !file.name.endsWith(".zip")) {
      setStatus("Please select a zip file");
      return;
    }

    try {
      setIsLoading(true);
      setStatus("Processing zip file...");
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const extractedFiles: { name: string; content: string }[] = [];

      for (const [filename, file] of Object.entries(contents.files)) {
        if (
          !file.dir &&
          filename.endsWith(".json") &&
          filename.includes("Audio")
        ) {
          const content = await file.async("text");
          extractedFiles.push({ name: filename, content });
        }
      }

      setFiles(extractedFiles);
      setStatus(`Successfully extracted ${extractedFiles.length} files`);
    } catch (error) {
      setStatus("Error processing zip file");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (files.length > 0) {
      handleProcessFile();
    }
  }, [files]);

  const processInChunks = async (
    tracks: Track[],
    startDate: Date,
    endDate: Date | null,
  ) => {
    const results = {
      tracks: new Map<string, Track[]>(),
      artists: new Map<string, number>(),
    };

    const totalChunks = Math.ceil(tracks.length / CHUNK_SIZE);
    let processedChunks = 0;

    for (let i = 0; i < tracks.length; i += CHUNK_SIZE) {
      const chunk = tracks.slice(i, i + CHUNK_SIZE);

      // Process each chunk
      for (const track of chunk) {
        if (!track.skipped && track.ms_played > 10000) {
          const trackDate = new Date(track.ts);
          if (endDate && (trackDate < startDate || trackDate > endDate))
            continue;
          if (!endDate && trackDate < startDate) continue;

          const trackUri = track.spotify_track_uri;
          if (!trackUri) continue;

          if (results.tracks.has(trackUri)) {
            results.tracks.get(trackUri)?.push(track);
          } else {
            results.tracks.set(trackUri, [track]);
          }

          if (track.master_metadata_album_artist_name) {
            const artist = track.master_metadata_album_artist_name;
            results.artists.set(artist, (results.artists.get(artist) || 0) + 1);
          }
        }
      }

      // Update progress based on processed chunks
      processedChunks++;
      setProgress(Math.round((processedChunks / totalChunks) * 100));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return results;
  };

  const handleProcessFile = async () => {
    try {
      setIsLoading(true);
      setProgress(0);

      const allTracks: Track[] = files.flatMap((file) =>
        JSON.parse(file.content),
      );

      const now = new Date();
      const startDate = isCustomRange
        ? new Date(dateRange.start)
        : (() => {
            const date = new Date();
            switch (timeframe) {
              case "month":
                date.setMonth(now.getMonth() - 1);
                break;
              case "6months":
                date.setMonth(now.getMonth() - 6);
                break;
              case "year":
                date.setFullYear(now.getFullYear() - 1);
                break;
              case "all":
                return new Date(0);
            }
            return date;
          })();

      const endDate = isCustomRange ? new Date(dateRange.end) : null;

      const results = await processInChunks(allTracks, startDate, endDate);

      setTracks(results.tracks);
      setArtists(results.artists);
    } catch (error) {
      console.error("Error parsing JSON:", error);
      setStatus("Error processing JSON data");
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (tracks.size > 0) {
      handleProcessFile();
    }
  }, [timeframe]);

  // Memoize the sorted artists and tracks
  const sortedArtists = useMemo(
    () => [...artists.entries()].sort((a, b) => b[1] - a[1]),
    [artists],
  );

  const sortedTracks = useMemo(
    () => [...tracks.entries()].sort((a, b) => b[1].length - a[1].length),
    [tracks],
  );

  // Memoize the artist list component
  const ArtistList = useMemo(
    () => (
      <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2">
        {sortedArtists.map(([artist, count], index) => (
          <div
            key={artist}
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2">
              <span className="min-w-[2rem] text-muted-foreground">
                {index + 1}.
              </span>
              <span>{artist}</span>
            </span>
            <span className="text-muted-foreground">
              {count} {count === 1 ? "play" : "plays"}
            </span>
          </div>
        ))}
      </div>
    ),
    [sortedArtists],
  );

  // Memoize the track list component
  const TrackList = useMemo(
    () => (
      <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2">
        {sortedTracks.map(([uri, trackList], index) => (
          <div key={uri} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="min-w-[2rem] text-muted-foreground">
                {index + 1}.
              </span>
              <div className="flex flex-col">
                <span>{trackList[0].master_metadata_track_name}</span>
              </div>
            </span>
            <span className="text-muted-foreground">
              {trackList.length} {trackList.length === 1 ? "play" : "plays"}
            </span>
          </div>
        ))}
      </div>
    ),
    [sortedTracks],
  );

  return (
    <div className="pt-4">
      <div className="grid w-full items-center gap-4">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileUpload}
            disabled={isLoading}
            className="h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {tracks.size > 0 && (
            <button
              onClick={resetData}
              disabled={isLoading}
              className="h-10 rounded-md bg-destructive px-4 py-2 text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Reset
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <p className="flex-1 text-sm italic text-muted-foreground">
              {status}
            </p>
          )}
          {isLoading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>
      </div>

      {tracks.size > 0 && (
        <div className="relative space-y-4">
          {isLoading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/50 backdrop-blur-sm">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              {progress > 0 && (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-2 w-48 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: progress + "%" }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {progress}%
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!isCustomRange}
                  onChange={() => setIsCustomRange(false)}
                  className="h-4 w-4"
                />
                <span>Preset Range</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={isCustomRange}
                  onChange={() => setIsCustomRange(true)}
                  className="h-4 w-4"
                />
                <span>Custom Range</span>
              </label>
            </div>

            {!isCustomRange ? (
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="month">Last Month</option>
                <option value="6months">Last 6 Months</option>
                <option value="year">Last Year</option>
                <option value="all">All Time</option>
              </select>
            ) : (
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-sm text-muted-foreground">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={pendingDateRange.start}
                    onChange={(e) =>
                      setPendingDateRange((prev) => ({
                        ...prev,
                        start: e.target.value,
                      }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-sm text-muted-foreground">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={pendingDateRange.end}
                    onChange={(e) =>
                      setPendingDateRange((prev) => ({
                        ...prev,
                        end: e.target.value,
                      }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>
              </div>
            )}
            {isCustomRange && (
              <button
                onClick={() => {
                  setDateRange(pendingDateRange);
                  handleProcessFile();
                }}
                className="h-10 w-full rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
              >
                Apply Range
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <h2 className="mb-4 text-xl font-semibold">Artists</h2>
              {ArtistList}
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h2 className="mb-4 text-xl font-semibold">Tracks</h2>
              {TrackList}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
