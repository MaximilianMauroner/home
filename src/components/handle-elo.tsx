import { $, useStore } from "@builder.io/qwik";

// ELO system constants
const INITIAL_RATING = 1200;
const K_FACTOR = 32;

interface Item {
  name: string;
  [key: string]: any;
}

// Item interface
interface EloItem {
  rating: number;
  round: number;
  lastDifference: number;
  item: Item;
}

interface EloRankingStore {
  items: EloItem[];
  itemOne: number;
  itemTwo: number;
  round: number;
}

// Utility function to calculate the expected score
function getExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// Return updated copies of items rather than mutating originals
function getUpdatedRatings(
  itemA: EloItem,
  itemB: EloItem,
  result: number,
): { updatedA: EloItem; updatedB: EloItem } {
  const newRoundA = itemA.round + 1;
  const newRoundB = itemB.round + 1;

  const expectedA = getExpectedScore(itemA.rating, itemB.rating);
  const expectedB = 1 - expectedA;

  const scoreA = result === 1 ? 1 : 0;
  const scoreB = result === 1 ? 0 : 1;

  const diffA = K_FACTOR * (scoreA - expectedA);
  const diffB = K_FACTOR * (scoreB - expectedB);

  return {
    updatedA: {
      ...itemA,
      rating: itemA.rating + diffA,
      round: newRoundA,
      lastDifference: diffA,
    },
    updatedB: {
      ...itemB,
      rating: itemB.rating + diffB,
      round: newRoundB,
      lastDifference: diffB,
    },
  };
}

// Ensure transitive consistency
function enforceTransitivity(items: EloItem[]) {
  const updatedItems = [...items];

  for (let i = 0; i < updatedItems.length; i++) {
    for (let j = i + 1; j < updatedItems.length; j++) {
      // If item A's rating is greater than item B's, ensure all items below B are less than A
      if (updatedItems[i].rating > updatedItems[j].rating) {
        for (let k = j + 1; k < updatedItems.length; k++) {
          if (
            updatedItems[j].rating > updatedItems[k].rating &&
            updatedItems[i].rating <= updatedItems[k].rating
          ) {
            // Adjust C's rating to ensure A > C
            updatedItems[k].rating = updatedItems[i].rating - 1;
          }
        }
      }
    }
  }

  return updatedItems;
}

// Custom hook to manage Elo ranking logic
export function useEloRanking(initialItems: string[]) {
  const store = useStore<EloRankingStore>({
    items: initialItems.map((name) => ({
      name,
      rating: INITIAL_RATING,
      round: 0,
      lastDifference: 0,
    })),
    itemOne: 0,
    itemTwo: 1,
    round: 0,
  });

  const getRandomItems = $(() => {
    const weights = store.items.map((item) => 1 / Math.pow(item.round + 1, 2));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    const getWeightedRandomIndex = () => {
      let rand = Math.random() * totalWeight;
      for (let i = 0; i < store.items.length; i++) {
        if (rand < weights[i]) return i;
        rand -= weights[i];
      }
      return store.items.length - 1;
    };

    const indexA = getWeightedRandomIndex();
    let indexB = getWeightedRandomIndex();
    while (indexB === indexA) {
      indexB = getWeightedRandomIndex();
    }

    store.itemOne = indexA;
    store.itemTwo = indexB;
  });

  const handleCompare = $((indexA: number, indexB: number, winner: number) => {
    const { updatedA, updatedB } = getUpdatedRatings(
      store.items[indexA],
      store.items[indexB],
      winner,
    );

    // Update the items in the store immutably
    store.items = store.items.map((item, idx) =>
      idx === indexA
        ? updatedA
        : idx === indexB
          ? updatedB
          : { ...item, lastDifference: 0 },
    );

    store.round += 1;

    // Sort items by rating after updating
    store.items = [...store.items].sort((a, b) => b.rating - a.rating);

    // Enforce transitive consistency across all items
    store.items = enforceTransitivity(store.items);

    // Pick new items after updating
    getRandomItems();
  });

  return { store, handleCompare, getRandomItems };
}
