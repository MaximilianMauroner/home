import {
  $,
  component$,
  useSignal,
  useStore,
  useVisibleTask$,
} from "@builder.io/qwik";
import { type EloItem, useEloRanking } from "~/components/handle-elo";

const STORAGE_KEY = "elo-compare-items";

export const RatingComponent = component$(() => {
  const gameStarted = useSignal(false);
  const newItem = useSignal("");
  const items = useStore<string[]>([]);

  // Load items from localStorage on mount
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const storedItems = localStorage.getItem(STORAGE_KEY);
    if (storedItems) {
      const parsedItems = JSON.parse(storedItems);
      items.splice(0, items.length, ...parsedItems);
    }
  });

  // Save items to localStorage whenever they change
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => items.length);
    track(() => [...items]); // track array content
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  });

  const { store, handleCompare } = useEloRanking(items);

  const handleInput = $((e: Event) => {
    const target = e.target as HTMLInputElement;
    const input = target.value;
    const lines = input.split("\n");

    if (lines.length > 1) {
      // Handle multi-line input/paste
      const validItems = lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      items.push(...validItems);
      target.value = "";
      newItem.value = "";
    } else {
      // Handle single line input
      newItem.value = input;
    }
  });

  return (
    <div class="mx-auto my-2 max-w-2xl rounded-lg bg-gray-100 p-6 shadow-lg">
      <h2 class="mb-4 text-center text-2xl font-bold text-gray-800">
        {gameStarted.value ? "ELO Rating System" : "Setup Items for Comparison"}
      </h2>

      {!gameStarted.value ? (
        <div class="space-y-4">
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
                  items.push(newItem.value.trim());
                  newItem.value = "";
                }
              }}
              class="rounded-lg bg-green-500 px-4 py-2 text-white hover:bg-green-600"
            >
              Add Item
            </button>
          </div>

          <div class="space-y-2">
            <h3 class="text-lg font-semibold">Current Items:</h3>
            {items.map((item, index) => (
              <div
                key={index}
                class="flex items-center justify-between rounded-lg bg-white p-3 shadow"
              >
                <span>{item}</span>
                <button
                  onClick$={() => items.splice(index, 1)}
                  class="text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div class="flex justify-between">
            <button
              onClick$={() => {
                if (items.length >= 2) {
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
                }}
                class="ml-2 rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Existing game UI */}
          <h3 class="mb-3 text-xl font-semibold text-gray-700">
            Round {store.round} /{" "}
            {store.items.reduce((sum, item) => sum + item.round, 0)}
          </h3>

          {/* Rest of the existing comparison UI */}
          <div class="mb-6 space-y-2">
            {store.itemOne !== -1 && store.itemTwo !== -1 ? (
              <div class="grid grid-cols-5 items-center justify-center space-x-2">
                <button
                  onClick$={() =>
                    handleCompare(store.itemOne, store.itemTwo, 1)
                  }
                  class="col-span-2 rounded-lg bg-blue-500 px-4 py-2 text-white transition hover:bg-blue-600"
                >
                  {store.items[store.itemOne].item.name}
                </button>
                <span class="col-span-1 text-center">vs</span>
                <button
                  onClick$={() =>
                    handleCompare(store.itemOne, store.itemTwo, 0)
                  }
                  class="col-span-2 rounded-lg bg-red-500 px-4 py-2 text-white transition hover:bg-red-600"
                >
                  {store.items[store.itemTwo].item.name}
                </button>
              </div>
            ) : (
              <div class="text-center text-gray-600">
                Comparison complete! Check out the results below.
              </div>
            )}
          </div>

          <ol class="space-y-2">
            {store.items.map((i, index) => (
              <li
                key={index + i.item.name}
                class="flex items-center justify-between rounded-lg bg-white p-3 shadow"
              >
                <span class="font-medium text-gray-700">
                  {index + 1}. {i.item.name}
                </span>
                <span class="font-semibold text-gray-900">
                  {i.rating.toFixed(2)} / {i.lastDifference.toFixed(2)}
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
          class={`overflow-hidden transition-all ${isOpen.value ? "max-h-[500px] p-4" : "max-h-0"}`}
        >
          <div class="space-y-4">
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
      <div class="space-y-2">
        {items.map((item, index) => (
          <ItemHistoryAccordion
            key={index + item.item.name}
            item={item}
            items={items} // Pass the items array to lookup names
          />
        ))}
      </div>
    </div>
  );
});

export default RatingComponent;
