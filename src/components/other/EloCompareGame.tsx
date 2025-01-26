import { useState, useEffect } from "react";

type Playlist = {
  id: string;
  name: string;
};

type Track = {
  track: {
    id: string;
    name: string;
    artists: { name: string }[];
    preview_url: string | null;
    album: {
      images: { url: string }[];
    };
  };
};

type Item = {
  name: string;
  spotifyId?: string;
  albumImageUrl?: string;
  previewUrl?: string;
};

export default function EloCompare() {
  const [elements, setElements] = useState<string[]>([]);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState("");
  const [isItemListVisible, setIsItemListVisible] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<{
    audio: HTMLAudioElement | null;
    url: string | null;
  }>({ audio: null, url: null });
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("audioVolume");
    return saved ? parseFloat(saved) : 1;
  });

  const removeDuplicatePreviewUrls = (items: Item[]): Item[] => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (!item.previewUrl) return true;
      if (seen.has(item.previewUrl)) return false;
      seen.add(item.previewUrl);
      return true;
    });
  };

  const fetchPlaylists = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/spotify/playlist");
      if (!response.ok) throw new Error("Failed to fetch playlists");
      const data = await response.json();
      setPlaylists(data.items || []);
    } catch (error) {
      console.error("Error fetching playlists:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchTracks = async (playlistId: string) => {
    try {
      setIsLoadingTracks(true);
      const response = await fetch(`/api/spotify/${playlistId}`);
      if (!response.ok) throw new Error("Failed to fetch tracks");
      const data = await response.json();
      setTracks(data.items || []);

      // Convert tracks to items and add them
      const newItems = data.items.map((item: Track) => ({
        name: `${item.track.name} - ${item.track.artists[0].name}`,
        spotifyId: item.track.id,
        // Note: You might need to adjust these properties based on your actual Track type
        albumImageUrl: item.track.album?.images?.[0]?.url,
        previewUrl: item.track.preview_url,
      }));

      // Remove duplicates before setting items
      const uniqueItems = removeDuplicatePreviewUrls(newItems);
      setItems(uniqueItems);
      setElements(uniqueItems.map((item) => item.name));
    } catch (error) {
      console.error("Error fetching tracks:", error);
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const handlePlaylistSelect = (id: string) => {
    setSelectedPlaylist(id);
    if (id) {
      fetchTracks(id);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewItem(e.target.value);
  };

  const addItem = () => {
    if (newItem.trim()) {
      setItems([...items, { name: newItem.trim() }]);
      setNewItem("");
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    localStorage.setItem("audioVolume", newVolume.toString());
    if (currentlyPlaying.audio) {
      currentlyPlaying.audio.volume = newVolume;
    }
  };

  const playPreview = (url: string) => {
    // If there's already something playing
    if (currentlyPlaying.audio) {
      currentlyPlaying.audio.pause();
      // If it's the same track, just pause it
      if (currentlyPlaying.url === url) {
        setCurrentlyPlaying({ audio: null, url: null });
        return;
      }
    }

    // Play new track
    const audio = new Audio(url);
    audio.volume = volume;
    audio.play();
    audio.addEventListener("ended", () => {
      setCurrentlyPlaying({ audio: null, url: null });
    });
    setCurrentlyPlaying({ audio, url });
  };

  const clearGame = () => {
    setIsGameStarted(false);
    setElements([]);
    setItems([]);
    setSelectedPlaylist("");
    setTracks([]);
    if (currentlyPlaying.audio) {
      currentlyPlaying.audio.pause();
      setCurrentlyPlaying({ audio: null, url: null });
    }
  };

  const startGame = () => {
    if (items.length < 2) {
      alert("Please add at least 2 items before starting the game");
      return;
    }
    setIsGameStarted(true);
  };

  function calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const costs = new Array(shorter.length + 1);
    for (let i = 0; i <= shorter.length; i++) costs[i] = i;

    for (let i = 0; i < longer.length; i++) {
      let nw = i;
      costs[0] = i + 1;
      for (let j = 0; j < shorter.length; j++) {
        const cj = Math.min(
          costs[j] + 1,
          costs[j + 1] + 1,
          nw + (longer[i] === shorter[j] ? 0 : 1)
        );
        nw = costs[j + 1];
        costs[j + 1] = cj;
      }
    }
    return (longer.length - costs[shorter.length]) / longer.length;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-gray-100 p-2 rounded-lg">
        <span className="text-sm">🔈</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={handleVolumeChange}
          className="w-24 h-2"
        />
        <span className="text-sm">🔊</span>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center">Loading playlists...</div>
        ) : (
          <>
            <select
              value={selectedPlaylist}
              onChange={(e) =>
                handlePlaylistSelect((e.target as HTMLSelectElement).value)
              }
              className="w-full rounded-lg border p-2"
            >
              <option value="">Select a playlist</option>
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}
                </option>
              ))}
            </select>
            {isLoadingTracks && (
              <div className="text-center">Loading tracks...</div>
            )}
            {!isLoadingTracks && tracks.length > 0 && (
              <div className="mt-4">
                <p>Loaded {tracks.length} tracks</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex space-x-2">
        <textarea
          value={newItem}
          onChange={handleInput}
          className="h-11 flex-1 resize-none rounded-lg border p-2 leading-normal"
          placeholder="Enter item name (or paste multiple items)"
        />
        <button
          onClick={addItem}
          className="rounded-lg bg-green-500 px-4 py-2 text-white hover:bg-green-600"
        >
          Add Item
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Current Items:</h3>
          <button
            onClick={() => setIsItemListVisible(!isItemListVisible)}
            className="text-blue-500 hover:text-blue-700"
          >
            {isItemListVisible ? "▼" : "▶"}
          </button>
        </div>

        <div
          className={`space-y-2 transition-all ${
            isItemListVisible ? "block" : "hidden"
          }`}
        >
          {items.map((item, index) => {
            const getSongName = (fullName: string) => fullName.split(" - ")[0];
            const similarItems = items.filter((otherItem, otherIndex) => {
              if (index === otherIndex) return false;
              const similarity = calculateSimilarity(
                getSongName(item.name).toLowerCase(),
                getSongName(otherItem.name).toLowerCase()
              );
              return similarity > 0.8;
            });
            const hasSimilar = similarItems.length > 0;

            return (
              <div
                key={index + "-" + item.spotifyId}
                className={`flex items-center justify-between rounded-lg ${
                  hasSimilar ? "bg-yellow-50" : "bg-white"
                } p-3 shadow`}
              >
                <div className="flex items-center gap-3">
                  {item.previewUrl && (
                    <button
                      onClick={() => playPreview(item.previewUrl!)}
                      className="text-blue-500 hover:text-blue-700 text-xl"
                    >
                      {currentlyPlaying.url === item.previewUrl ? "⏸" : "▶"}
                    </button>
                  )}
                  {item.albumImageUrl && (
                    <img
                      height={40}
                      width={40}
                      src={item.albumImageUrl}
                      alt="Album cover"
                      className="h-10 w-10 rounded-sm"
                    />
                  )}
                  <span className={hasSimilar ? "text-yellow-700" : ""}>
                    {item.name}
                    {hasSimilar && (
                      <span className="ml-2 text-xs text-yellow-600">
                        (Similar: {similarItems.length})
                      </span>
                    )}
                  </span>
                </div>
                <button
                  onClick={() => removeItem(index)}
                  className="text-red-500 hover:text-red-700 text-xl px-2"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex justify-center space-x-4">
        <button
          onClick={clearGame}
          className="rounded-lg bg-red-500 px-6 py-2 text-white hover:bg-red-600"
        >
          Clear
        </button>
        <button
          onClick={startGame}
          disabled={items.length < 2}
          className="rounded-lg bg-blue-500 px-6 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
        >
          Start Game
        </button>
      </div>
    </div>
  );
}
