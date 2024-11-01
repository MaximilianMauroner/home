import { component$ } from "@builder.io/qwik";
import { useEloRanking } from "~/components/handle-elo";

const christmasSongs = [
  "All I Want for Christmas Is You",
  "Last Christmas",
  "Jingle Bell Rock",
  "It's Beginning to Look a Lot Like Christmas",
  "Rockin' Around the Christmas Tree",
];

export const RatingComponent = component$(() => {
  const { store, handleCompare } = useEloRanking(christmasSongs);

  return (
    <div class="mx-auto my-2 max-w-2xl rounded-lg bg-gray-100 p-6 shadow-lg">
      <h2 class="mb-4 text-center text-2xl font-bold text-gray-800">
        ELO Rating System {store.round} /{" "}
        {store.items.reduce((sum, item) => sum + item.round, 0)}
      </h2>

      <h3 class="mb-3 text-xl font-semibold text-gray-700">Compare Items</h3>

      <div class="mb-6 space-y-2">
        {store.itemOne !== -1 && store.itemTwo !== -1 ? (
          <div class="grid grid-cols-5 items-center justify-center space-x-2">
            <button
              onClick$={() => handleCompare(store.itemOne, store.itemTwo, 1)}
              class="col-span-2 rounded-lg bg-blue-500 px-4 py-2 text-white transition hover:bg-blue-600"
            >
              {store.items[store.itemOne].item.name}
            </button>
            <span class="col-span-1 text-center">vs</span>
            <button
              onClick$={() => handleCompare(store.itemOne, store.itemTwo, 0)}
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
    </div>
  );
});

export default RatingComponent;
