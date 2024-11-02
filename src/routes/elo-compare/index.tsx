import {
  $,
  component$,
  useSignal,
  useStore,
  useVisibleTask$,
} from "@builder.io/qwik";
import { Form, useNavigate } from "@builder.io/qwik-city";
import {
  type EloItem,
  type Item,
  useEloRanking,
} from "~/components/handle-elo";
import { useSession, useSignIn, useSignOut } from "../plugin@auth";

const STORAGE_KEY = "elo-compare-items";
const GAME_STATE_KEY = "elo-compare-game-state";

// Add TypeScript interface for Spotify track
interface SpotifyTrack {
  track: {
    name: string;
    id: string;
    preview_url: string | null;
    artists: Array<{
      name: string;
    }>;
    album: {
      images: Array<{
        url: string;
        height: number;
        width: number;
      }>;
    };
  };
}

export const RatingComponent = component$(() => {
  const navigate = useNavigate();
  const gameStarted = useSignal(false);
  const newItem = useSignal("");
  const items = useStore<Item[]>([]);
  const isSpotifyMode = useSignal(false);
  const playlists = useStore<{ id: string; name: string }[]>([]);
  const selectedPlaylist = useSignal<string>("");
  const isLoading = useSignal(false);
  const playingTrackId = useSignal<string | null>(null);
  const audioElement = useSignal<HTMLAudioElement | null>(null);
  const isItemListVisible = useSignal(true);
  const session = useSession();
  const signIn = useSignIn();
  const signOut = useSignOut();

  const handleUnauthorized = $(() => {
    navigate("/auth/signin");
  });

  const { store, handleCompare } = useEloRanking(
    items.map((item) => ({
      name: item.name,
      spotifyId: item.spotifyId,
      previewUrl: item.previewUrl,
      albumImageUrl: item.albumImageUrl,
    })),
  );

  // Load items and game state from localStorage on mount
  useVisibleTask$(async () => {
    const [storedItems, storedGameState] = await Promise.all([
      (async () => {
        const items = localStorage.getItem(STORAGE_KEY);
        return items ? JSON.parse(items) : null;
      })(),
      (async () => {
        const gameState = localStorage.getItem(GAME_STATE_KEY);
        return gameState ? JSON.parse(gameState) : null;
      })(),
    ]);

    if (storedItems) {
      items.splice(0, items.length, ...storedItems);
    }

    if (storedGameState) {
      const { isStarted, gameStore } = storedGameState;
      if (gameStore && isStarted) {
        gameStarted.value = true;
        store.items = gameStore.items;
        store.itemOne = gameStore.itemOne;
        store.itemTwo = gameStore.itemTwo;
        store.round = gameStore.round;
      }
    }
  });

  // Save items to localStorage whenever they change
  useVisibleTask$(({ track }) => {
    track(() => items.length);
    track(() => [...items]); // track array content

    queueMicrotask(async () => {
      await new Promise<void>((resolve) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        resolve();
      });
    });
  });

  // Save game state to localStorage whenever it changes
  useVisibleTask$(({ track }) => {
    track(() => gameStarted.value);
    track(() => store.items);
    track(() => store.round);
    track(() => store.itemOne);
    track(() => store.itemTwo);

    if (gameStarted.value) {
      const gameState = {
        isStarted: gameStarted.value,
        gameStore: {
          items: store.items,
          itemOne: store.itemOne,
          itemTwo: store.itemTwo,
          round: store.round,
        },
      };

      queueMicrotask(async () => {
        await new Promise<void>((resolve) => {
          localStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
          resolve();
        });
      });
    }
  });

  const handleInput = $((e: Event) => {
    const target = e.target as HTMLInputElement;
    const input = target.value;
    const lines = input.split("\n");

    if (lines.length > 1) {
      // handle spotify as multiline input

      const validItems = lines
        .map((line) => {
          return { name: line.trim() };
        })
        .filter((line) => line.name.length > 0);

      items.push(...validItems);
      target.value = "";
      newItem.value = "";
    } else {
      // Handle single line input
      newItem.value = input;
    }
  });

  const fetchPlaylists = $(async () => {
    try {
      isLoading.value = true;
      const response = await fetch("/api/spotify/playlist");

      const data = await response.json();
      if (response.status === 500 && data.error?.includes("Unauthorized")) {
        handleUnauthorized();
        return;
      }

      playlists.splice(0, playlists.length, ...data.items);
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    } finally {
      isLoading.value = false;
    }
  });

  const handlePlaylistSelect = $(async (playlistId: string) => {
    if (!playlistId) return;

    try {
      isLoading.value = true;
      const response = await fetch(`/api/spotify/playlist/${playlistId}`);
      const data = await response.json();

      if (
        response.status === 500 &&
        data.message === "Spotify API error: Unauthorized"
      ) {
        handleUnauthorized();
        return;
      }

      if (data?.items) {
        // Add tracks to items
        const tracks = data.items
          .filter(
            (item: SpotifyTrack) =>
              item.track.name && item.track.artists?.[0]?.name,
          )
          .map((item: SpotifyTrack) => ({
            name: `${item.track.name} - ${item.track.artists[0].name}`,
            spotifyId: item.track.id,
            previewUrl: item.track.preview_url,
            albumImageUrl: item.track.album.images[0]?.url,
          }));

        if (tracks.length > 0) {
          items.push(...tracks);
          selectedPlaylist.value = "";
        }
      }
    } catch (error) {
      console.error("Failed to fetch playlist tracks:", error);
    } finally {
      isLoading.value = false;
    }
  });

  const togglePlayPause = $(
    (previewUrl: string | undefined, trackId: string) => {
      if (!previewUrl) return;

      if (playingTrackId.value === trackId) {
        // Stop current track
        audioElement.value?.pause();
        audioElement.value = null;
        playingTrackId.value = null;
      } else {
        // Stop previous track if any
        audioElement.value?.pause();

        // Play new track
        const audio = new Audio(previewUrl);
        audio.addEventListener("ended", () => {
          playingTrackId.value = null;
          audioElement.value = null;
        });
        audio.play();
        audioElement.value = audio;
        playingTrackId.value = trackId;
      }
    },
  );

  return (
    <div class="mx-auto my-2 max-w-2xl rounded-lg bg-gray-100 p-6 shadow-lg">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-center text-2xl font-bold text-gray-800">
          {gameStarted.value
            ? "ELO Rating System"
            : "Setup Items for Comparison"}
        </h2>
        {session.value === null ? (
          <Form action={signIn}>
            <button class="rounded-lg bg-gray-500 px-4 py-2 text-white hover:bg-gray-600">
              Sign In
            </button>
          </Form>
        ) : (
          <Form action={signOut}>
            <button class="rounded-lg bg-gray-500 px-4 py-2 text-white hover:bg-gray-600">
              Sign Out
            </button>
          </Form>
        )}
      </div>

      {!gameStarted.value && (
        <div class="mb-4">
          <div class="flex justify-center space-x-4">
            <button
              onClick$={() => {
                isSpotifyMode.value = false;
                playlists.splice(0, playlists.length);
              }}
              class={`rounded-lg px-4 py-2 ${
                !isSpotifyMode.value ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
            >
              Normal Mode
            </button>
            <button
              onClick$={async () => {
                isSpotifyMode.value = true;
                await fetchPlaylists();
              }}
              class={`rounded-lg px-4 py-2 ${
                isSpotifyMode.value ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
            >
              Spotify Mode
            </button>
          </div>
        </div>
      )}

      {!gameStarted.value ? (
        <div class="space-y-4">
          {isSpotifyMode.value ? (
            <div class="space-y-4">
              {isLoading.value ? (
                <div class="text-center">Loading...</div>
              ) : (
                <select
                  value={selectedPlaylist.value}
                  onChange$={(e) =>
                    handlePlaylistSelect((e.target as HTMLSelectElement).value)
                  }
                  class="w-full rounded-lg border p-2"
                >
                  <option value="">Select a playlist</option>
                  {playlists.map((playlist) => (
                    <option key={playlist.id} value={playlist.id}>
                      {playlist.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div class="flex space-x-2">
              <textarea
                value={newItem.value}
                onInput$={handleInput}
                class="h-11 flex-1 resize-none rounded-lg border p-2 leading-normal"
                placeholder="Enter item name (or paste multiple items)"
              />
              <button
                onClick$={() => {
                  if (newItem.value.trim()) {
                    items.push({ name: newItem.value.trim() });
                    newItem.value = "";
                  }
                }}
                class="rounded-lg bg-green-500 px-4 py-2 text-white hover:bg-green-600"
              >
                Add Item
              </button>
            </div>
          )}

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">Current Items:</h3>
              <button
                onClick$={() =>
                  (isItemListVisible.value = !isItemListVisible.value)
                }
                class="text-blue-500 hover:text-blue-700"
              >
                {isItemListVisible.value ? "▼" : "▶"}
              </button>
            </div>

            <div
              class={`space-y-2 transition-all ${isItemListVisible.value ? "block" : "hidden"}`}
            >
              {items.map((item, index) => (
                <div
                  key={index + "-" + item.spotifyId}
                  class="flex items-center justify-between rounded-lg bg-white p-3 shadow"
                >
                  <div class="flex items-center gap-3">
                    {item.albumImageUrl && (
                      <img
                        height={40}
                        width={40}
                        src={item.albumImageUrl}
                        alt="Album cover"
                        class="h-10 w-10 rounded-sm"
                      />
                    )}
                    <span>{item.name}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    {item.previewUrl && (
                      <button
                        onClick$={() => {
                          const audio = new Audio(item.previewUrl);
                          audio.play();
                        }}
                        class="text-blue-500 hover:text-blue-700"
                      >
                        ▶
                      </button>
                    )}
                    <button
                      onClick$={() => items.splice(index, 1)}
                      class="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div class="sticky bottom-0 bg-gray-100 p-4">
            <div class="flex justify-between">
              <button
                onClick$={() => {
                  if (items.length >= 2) {
                    store.items = items.map((item, index) => ({
                      id: index,
                      item: item,
                      rating: 1000,
                      round: 0,
                      winsAgainst: [],
                      lossesAgainst: [],
                      lastDifference: 0,
                    }));
                    gameStarted.value = true;
                  }
                }}
                disabled={items.length < 2}
                class={`flex-1 rounded-lg p-3 text-white ${
                  items.length >= 2
                    ? "bg-blue-500 hover:bg-blue-600"
                    : "cursor-not-allowed bg-gray-400"
                }`}
              >
                {items.length < 2
                  ? "Add at least 2 items to start"
                  : "Start Comparison Game"}
              </button>
              {items.length > 0 && (
                <button
                  onClick$={() => {
                    items.splice(0, items.length);
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.removeItem(GAME_STATE_KEY);
                    gameStarted.value = false;
                  }}
                  class="ml-2 rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Game UI */}
          <div class="mb-3 flex items-center justify-between">
            <div class="space-y-2">
              <h3 class="text-xl font-semibold text-gray-700">
                Round {store.round + 1}
              </h3>
              <div class="text-sm text-gray-600">
                {(() => {
                  const totalItems = store.items.length;
                  const totalPossibleComparisons =
                    (totalItems * (totalItems - 1)) / 2;
                  const completedComparisons =
                    store.items.reduce(
                      (sum, item) =>
                        sum +
                        item.winsAgainst.length +
                        item.lossesAgainst.length,
                      0,
                    ) / 2;
                  const progressPercent =
                    (completedComparisons / totalPossibleComparisons) * 100;
                  return `Progress: ${progressPercent.toFixed(1)}% (${completedComparisons} of ${totalPossibleComparisons} comparisons)`;
                })()}
              </div>
            </div>
            <button
              onClick$={() => {
                items.splice(0, items.length);
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(GAME_STATE_KEY);
                gameStarted.value = false;
              }}
              class="rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
            >
              Reset Everything
            </button>
          </div>

          {/* Rest of the existing comparison UI */}
          <div class="mb-6 space-y-2">
            {store.itemOne !== -1 && store.itemTwo !== -1 ? (
              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col space-y-4">
                  <div class="flex flex-col items-center">
                    {store.items[store.itemOne].item.albumImageUrl && (
                      <button
                        onClick$={() =>
                          togglePlayPause(
                            store.items[store.itemOne].item.previewUrl,
                            store.items[store.itemOne].item.spotifyId ||
                              "item1",
                          )
                        }
                        class="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-lg hover:opacity-90"
                      >
                        <img
                          height={1280}
                          width={1280}
                          src={store.items[store.itemOne].item.albumImageUrl}
                          alt="Album cover"
                          class="h-full w-full object-cover"
                        />
                        {store.items[store.itemOne].item.previewUrl && (
                          <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
                            <span class="text-4xl text-white">
                              {playingTrackId.value ===
                              (store.items[store.itemOne].item.spotifyId ||
                                "item1")
                                ? "⏸"
                                : "▶"}
                            </span>
                          </div>
                        )}
                      </button>
                    )}
                    <span class="mt-2 text-center">
                      {store.items[store.itemOne].item.name}
                    </span>
                    <button
                      onClick$={() =>
                        handleCompare(store.itemOne, store.itemTwo, 1)
                      }
                      class="mt-4 w-full max-w-[200px] rounded-lg bg-blue-500 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-blue-600 sm:text-base"
                    >
                      Choose Left
                    </button>
                  </div>
                </div>

                <div class="flex flex-col space-y-4">
                  <div class="flex flex-col items-center">
                    {store.items[store.itemTwo].item.albumImageUrl && (
                      <button
                        onClick$={() =>
                          togglePlayPause(
                            store.items[store.itemTwo].item.previewUrl,
                            store.items[store.itemTwo].item.spotifyId ||
                              "item2",
                          )
                        }
                        class="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-lg hover:opacity-90"
                      >
                        <img
                          height={1280}
                          width={1280}
                          src={store.items[store.itemTwo].item.albumImageUrl}
                          alt="Album cover"
                          class="h-full w-full object-cover"
                        />
                        {store.items[store.itemTwo].item.previewUrl && (
                          <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
                            <span class="text-4xl text-white">
                              {playingTrackId.value ===
                              (store.items[store.itemTwo].item.spotifyId ||
                                "item2")
                                ? "⏸"
                                : "▶"}
                            </span>
                          </div>
                        )}
                      </button>
                    )}
                    <span class="mt-2 text-center">
                      {store.items[store.itemTwo].item.name}
                    </span>
                    <button
                      onClick$={() =>
                        handleCompare(store.itemOne, store.itemTwo, 0)
                      }
                      class="mt-4 w-full max-w-[200px] rounded-lg bg-red-500 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-red-600 sm:text-base"
                    >
                      Choose Right
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div class="text-center">
                <div class="text-gray-600">
                  Comparison complete! Check out the results below.
                </div>
              </div>
            )}
          </div>

          <ol class="max-h-[440px] space-y-2 overflow-y-auto">
            {store.items.map((i, index) => (
              <li
                key={index + i.item.name}
                class="flex items-center justify-between rounded-lg bg-white p-3 shadow"
              >
                <span class="font-medium text-gray-700">
                  {index + 1}. {i.item.name}
                </span>
                <span class="font-semibold text-gray-900">
                  {i.rating.toFixed(2)}
                </span>
              </li>
            ))}
          </ol>
          <ItemsHistory items={store.items} />
        </>
      )}
    </div>
  );
});

const ItemHistoryAccordion = component$(
  ({ item, items }: { item: EloItem; items: EloItem[] }) => {
    const isOpen = useSignal(false);

    const getNameById = (id: number) => {
      const found = items.find((item) => item.id === id);
      return found ? found.item.name : id;
    };

    return (
      <div class="mt-2 rounded-lg bg-white shadow">
        <button
          onClick$={() => (isOpen.value = !isOpen.value)}
          class="flex w-full items-center justify-between p-4 text-left"
        >
          <span class="font-medium text-gray-700">{item.item.name}</span>
          <span
            class={`transform transition-transform ${isOpen.value ? "rotate-180" : ""}`}
          >
            ▼
          </span>
        </button>

        <div
          class={`overflow-hidden transition-all ${isOpen.value ? "h-[300px] p-4" : "h-0"}`}
        >
          <div class="h-full space-y-4 overflow-y-auto pr-2">
            <div>
              <h4 class="mb-2 font-semibold text-gray-700">Won Against:</h4>
              {item.winsAgainst.length > 0 ? (
                <ul class="ml-4 list-disc space-y-1">
                  {item.winsAgainst.map((opponentId, idx) => (
                    <li key={idx} class="text-gray-600">
                      {getNameById(opponentId)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p class="italic text-gray-500">No wins yet</p>
              )}
            </div>

            <div>
              <h4 class="mb-2 font-semibold text-gray-700">Lost Against:</h4>
              {item.lossesAgainst.length > 0 ? (
                <ul class="ml-4 list-disc space-y-1">
                  {item.lossesAgainst.map((opponentId, idx) => (
                    <li key={idx} class="text-gray-600">
                      {getNameById(opponentId)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p class="italic text-gray-500">No losses yet</p>
              )}
            </div>

            <div class="flex justify-between border-t pt-2">
              <span class="text-sm text-gray-600">
                Total Matches:{" "}
                {item.winsAgainst.length + item.lossesAgainst.length}
              </span>
              <span class="text-sm text-gray-600">
                Win Rate:{" "}
                {(
                  (item.winsAgainst.length /
                    (item.winsAgainst.length + item.lossesAgainst.length)) *
                    100 || 0
                ).toFixed(1)}
                %
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

const ItemsHistory = component$(({ items }: { items: EloItem[] }) => {
  return (
    <div class="mt-8">
      <h3 class="mb-4 text-xl font-semibold text-gray-700">Match History</h3>
      <div class="max-h-[400px] space-y-2 overflow-y-auto">
        {items.map((item, index) => (
          <ItemHistoryAccordion
            key={index + item.item.name}
            item={item}
            items={items}
          />
        ))}
      </div>
    </div>
  );
});

export default RatingComponent;
