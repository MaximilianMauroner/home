import { $, component$, useStore } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";

export const head: DocumentHead = {
  title: "Elo Compare",
  meta: [
    {
      name: "description",
      content:
        "A simple tool to compare a list of items by facing them off in a head-to-head battle.",
    },
  ],
};
const christmasSongs = [
  "All I Want for Christmas Is You",
  "Last Christmas",
  "Jingle Bell Rock",
  "It's Beginning to Look a Lot Like Christmas",
  "Rockin' Around the Christmas Tree",
  "Feliz Navidad",
  "Rudolph the Red-Nosed Reindeer",
  "Santa Claus Is Coming to Town",
  "Let It Snow! Let It Snow! Let It Snow!",
  "White Christmas",
  "The Christmas Song (Chestnuts Roasting on an Open Fire)",
  "Winter Wonderland",
  "Have Yourself a Merry Little Christmas",
  "Silent Night",
  "Blue Christmas",
  "O Holy Night",
  "Sleigh Ride",
  "Do They Know It's Christmas?",
  "Happy Xmas (War Is Over)",
  "Baby, It's Cold Outside",
];

// ELO system constants
const INITIAL_RATING = 1200; // Initial rating for new items
const K_FACTOR = 32; // Constant to adjust rating change sensitivity

// Define an Item type
interface Item {
  name: string;
  rating: number;
}

// Calculate the expected score for each item
function getExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// Update ratings based on match result
function updateRatings(itemA: Item, itemB: Item, result: number): void {
  if (result !== 0 && result !== 1) throw new Error("Invalid result");
  const expectedA = getExpectedScore(itemA.rating, itemB.rating);
  const expectedB = getExpectedScore(itemB.rating, itemA.rating);

  const scoreA = result === 1 ? 1 : 0;
  const scoreB = result === 1 ? 0 : 1;

  itemA.rating += K_FACTOR * (scoreA - expectedA);
  itemB.rating += K_FACTOR * (scoreB - expectedB);
}

// Qwik component to manage the rating system
export const RatingComponent = component$(() => {
  // Initialize items in the Qwik store
  const store = useStore({
    items: christmasSongs.map((name) => ({
      name,
      rating: INITIAL_RATING,
    })),
    itemOne: 0,
    itemTwo: 1,
  });

  const getRandomItems = $(() => {
    const indexA = Math.floor(Math.random() * store.items.length);
    let indexB = Math.floor(Math.random() * store.items.length);
    while (indexB === indexA) {
      indexB = Math.floor(Math.random() * store.items.length);
    }
    store.itemOne = indexA;
    store.itemTwo = indexB;
  });

  const handleCompare = $((indexA: number, indexB: number, winner: number) => {
    updateRatings(store.items[indexA], store.items[indexB], winner);
    getRandomItems();
    store.items.sort((a, b) => b.rating - a.rating);
  });

  return (
    <div class="mx-auto max-w-2xl rounded-lg bg-gray-100 p-6 shadow-lg">
      <h2 class="mb-4 text-center text-2xl font-bold text-gray-800">
        ELO Rating System
      </h2>

      <h3 class="mb-3 text-xl font-semibold text-gray-700">Compare Items</h3>

      <div class="mb-6 space-y-2">
        <div class="grid grid-cols-5 items-center justify-center space-x-2">
          <button
            onClick$={() => handleCompare(0, 1, 1)}
            class="col-span-2 rounded-lg bg-blue-500 px-4 py-2 text-white transition hover:bg-blue-600"
          >
            {store.items[store.itemOne].name}
          </button>
          <span class="col-span-1 text-center">vs</span>
          <button
            onClick$={() => handleCompare(0, 1, 0)}
            class="col-span-2 rounded-lg bg-red-500 px-4 py-2 text-white transition hover:bg-red-600"
          >
            {store.items[store.itemTwo].name}
          </button>
        </div>
      </div>

      <ol class="space-y-2">
        {store.items.map((item, index) => (
          <li
            key={index}
            class="flex items-center justify-between rounded-lg bg-white p-3 shadow"
          >
            <span class="font-medium text-gray-700">
              {index + 1}. {item.name}
            </span>
            <span class="font-semibold text-gray-900">
              {item.rating.toFixed(2)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
});
export default RatingComponent;
